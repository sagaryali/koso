import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthenticatedWorkspace } from "@/lib/api/get-workspace";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function isDemoMode() {
  return (
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    !process.env.ANTHROPIC_API_KEY
  );
}

const MOCK_SPEC = `Problem Statement

Users are reporting significant friction during onboarding and initial setup, leading to drop-off before they experience core value. Combined with performance issues on key screens, the product is failing to retain new users through the critical first session.

User Impact

- New users abandon the product within the first 5 minutes due to unclear setup steps
- Existing users report frustration with slow dashboard loads, impacting daily workflows
- Power users requesting integrations are considering alternatives that offer better connectivity

Proposed Solution

- Redesign the first-run experience with a guided walkthrough that highlights key features
- What is the minimum viable onboarding flow? Which steps can be deferred?
- Implement progressive loading and caching for the dashboard and list views
- How should we prioritize between perceived performance vs actual load time improvements?

Success Metrics

- Reduce onboarding drop-off rate from 40% to under 20% within 30 days
- Decrease average dashboard load time to under 1.5 seconds (p95)
- Increase 7-day retention for new users by 15%
- Achieve 80% completion rate for the guided setup flow

Open Questions

- Should we gate advanced features behind onboarding completion?
- What is the performance budget for each key screen?
- Which third-party integrations should be prioritized based on user request volume?`;

function createMockStream(): Response {
  const encoder = new TextEncoder();
  const words = MOCK_SPEC.split(" ");

  const readable = new ReadableStream({
    start(controller) {
      let i = 0;
      const interval = setInterval(() => {
        if (i >= words.length) {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          clearInterval(interval);
          return;
        }
        const chunk = (i > 0 ? " " : "") + words[i];
        const data = JSON.stringify({ text: chunk });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        i++;
      }, 25);
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedWorkspace();
    if ("error" in auth) {
      return new Response(
        JSON.stringify({ error: auth.error }),
        { status: auth.status, headers: { "Content-Type": "application/json" } }
      );
    }

    const { themes, product, codeContext, refinement } = await request.json();

    if (!themes || !Array.isArray(themes) || themes.length === 0) {
      return new Response(
        JSON.stringify({ error: "themes array is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Demo mode
    if (isDemoMode()) {
      return createMockStream();
    }

    // Build system prompt
    const hasCode = !!codeContext;
    let systemPrompt =
      "You are a senior product manager. Draft a product spec from customer feedback themes. Use plain text with dashes for bullets, no markdown. Structure:";

    if (hasCode) {
      systemPrompt +=
        " Problem Statement, User Impact, Proposed Solution (thoughtful placeholder with guiding questions), Technical Context (what already exists in the codebase that's relevant, which modules would be affected, rough complexity — Low/Medium/High — written for a PM not an engineer), Success Metrics (3-4 measurable outcomes), Open Questions";
    } else {
      systemPrompt +=
        " Problem Statement, User Impact, Proposed Solution (thoughtful placeholder with guiding questions), Success Metrics (3-4 measurable outcomes), Open Questions";
    }

    // Build user prompt
    let userPrompt = "Selected themes from customer feedback:\n\n";
    themes.forEach(
      (
        theme: {
          label: string;
          summary: string;
          feedback: string[];
          existingCode?: string[];
          codeNote?: string;
        },
        i: number
      ) => {
        userPrompt += `Theme ${i + 1}: ${theme.label}\n`;
        userPrompt += `Summary: ${theme.summary}\n`;
        userPrompt += "Feedback:\n";
        theme.feedback.forEach((f: string) => {
          userPrompt += `  - ${f}\n`;
        });
        if (theme.codeNote) {
          userPrompt += `Code context: ${theme.codeNote}\n`;
        }
        if (theme.existingCode && theme.existingCode.length > 0) {
          userPrompt += `Related files: ${theme.existingCode.join(", ")}\n`;
        }
        userPrompt += "\n";
      }
    );

    if (product) {
      userPrompt += `\nProduct: ${product.name || "Unknown"}`;
      if (product.description) {
        userPrompt += `\nDescription: ${product.description}`;
      }
      if (product.principles && product.principles.length > 0) {
        userPrompt += `\nPrinciples: ${product.principles.join(", ")}`;
      }
    }

    if (codeContext?.architectureSummary) {
      userPrompt += `\n\nArchitecture summary: ${codeContext.architectureSummary}`;
    }
    if (codeContext?.modules && codeContext.modules.length > 0) {
      userPrompt += "\n\nRelevant modules:\n";
      codeContext.modules
        .slice(0, 15)
        .forEach(
          (m: { filePath: string; moduleType: string; summary: string }) => {
            userPrompt += `- ${m.filePath} (${m.moduleType}): ${m.summary}\n`;
          }
        );
    }

    if (refinement) {
      userPrompt += `\n\nThe user wants you to revise with this direction: ${refinement}`;
    }

    const stream = anthropic.messages.stream({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              const data = JSON.stringify({ text: event.delta.text });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Stream error";
          const data = JSON.stringify({ error: message });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("[api/ai/draft-spec] Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
