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

const SECTION_ORDER = [
  "Problem",
  "Goals & Success Metrics",
  "User Stories",
  "Requirements",
  "Open Questions",
];

const SECTION_GUIDANCE: Record<string, string> = {
  Problem:
    "Ground every statement in the customer evidence provided. Cite specific feedback.",
  "Goals & Success Metrics":
    "Each goal must map to a problem stated above. Define measurable success metrics tied to the evidence.",
  "User Stories":
    "Each story must trace to a goal above. Use personas derived from the evidence.",
  Requirements:
    "Reference codebase modules and architecture constraints when available.",
  "Open Questions":
    "Flag gaps, conflicts, and unresolved decisions across all prior sections.",
};

function createMockStream(): Response {
  const mockSections = SECTION_ORDER.map((section) => ({
    section,
    text: `This is a draft of the "${section}" section based on the evidence provided.`,
  }));

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    start(controller) {
      let i = 0;
      const interval = setInterval(() => {
        if (i >= mockSections.length) {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          clearInterval(interval);
          return;
        }
        const data = JSON.stringify(mockSections[i]);
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        i++;
      }, 500);
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

    const { themes, product, codeContext, templateId, targetSection, existingSections, refinement } = await request.json();

    if (!themes || !Array.isArray(themes) || themes.length === 0) {
      return new Response(
        JSON.stringify({ error: "themes array is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (isDemoMode()) {
      return createMockStream();
    }

    const encoder = new TextEncoder();

    // --- Single section refinement mode ---
    if (targetSection && existingSections?.length > 0 && refinement) {
      const readable = new ReadableStream({
        async start(controller) {
          try {
            const systemParts: string[] = [
              "You are a senior product manager refining a spec section.",
              `Rewrite ONLY the content for the "${targetSection}" section, incorporating this feedback: ${refinement}`,
              "",
              SECTION_GUIDANCE[targetSection] || "",
              "",
              "Write in clean markdown. Be specific and actionable. Do NOT include the heading.",
            ];

            const userParts: string[] = [];

            if (product?.name) {
              userParts.push(`Product: ${product.name}`);
              if (product.description) {
                userParts.push(`Description: ${product.description}`);
              }
              userParts.push("");
            }

            userParts.push("Customer evidence themes:");
            for (const theme of themes) {
              userParts.push(`\nTheme: ${theme.label}`);
              userParts.push(`Summary: ${theme.summary}`);
              if (theme.feedback?.length > 0) {
                userParts.push("Feedback:");
                for (const f of theme.feedback) {
                  userParts.push(`  - ${f}`);
                }
              }
            }
            userParts.push("");

            if (codeContext && targetSection === "Requirements") {
              if (codeContext.architectureSummary) {
                userParts.push(`Architecture: ${codeContext.architectureSummary}`);
              }
              if (codeContext.modules?.length > 0) {
                userParts.push("Relevant modules:");
                for (const m of codeContext.modules.slice(0, 10)) {
                  userParts.push(`- ${m.filePath} (${m.moduleType}): ${m.summary}`);
                }
              }
              userParts.push("");
            }

            // All existing sections as context
            userParts.push("--- Current spec sections ---");
            for (const s of existingSections) {
              userParts.push(`## ${s.section}`);
              userParts.push(s.text);
              userParts.push("");
            }

            userParts.push(
              `Now rewrite the "${targetSection}" section with the requested refinement.`
            );

            const response = await anthropic.messages.create({
              model: "claude-sonnet-4-20250514",
              max_tokens: 2048,
              system: systemParts.join("\n"),
              messages: [{ role: "user", content: userParts.join("\n") }],
            });

            const text =
              response.content[0].type === "text"
                ? response.content[0].text
                : "";

            const data = JSON.stringify({ section: targetSection, text });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          } catch (err) {
            const message = err instanceof Error ? err.message : "Refinement error";
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
    }

    // --- Full spec generation mode ---
    const generatedSections: { section: string; text: string }[] = [];

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for (const sectionName of SECTION_ORDER) {
            const systemParts: string[] = [
              "You are a senior product manager drafting a spec section by section.",
              `Write ONLY the content for the "${sectionName}" section. Do NOT include the heading.`,
              "",
              SECTION_GUIDANCE[sectionName] || "",
              "",
              "Write in clean markdown. Be specific and actionable. Keep it concise but thorough.",
            ];

            const userParts: string[] = [];

            // Product context
            if (product?.name) {
              userParts.push(`Product: ${product.name}`);
              if (product.description) {
                userParts.push(`Description: ${product.description}`);
              }
              if (product.principles?.length > 0) {
                userParts.push(`Principles: ${product.principles.join(", ")}`);
              }
              userParts.push("");
            }

            // Evidence themes
            userParts.push("Customer evidence themes:");
            for (const theme of themes) {
              userParts.push(`\nTheme: ${theme.label}`);
              userParts.push(`Summary: ${theme.summary}`);
              if (theme.feedback?.length > 0) {
                userParts.push("Feedback:");
                for (const f of theme.feedback) {
                  userParts.push(`  - ${f}`);
                }
              }
            }
            userParts.push("");

            // Code context (for later sections)
            if (codeContext && sectionName === "Requirements") {
              if (codeContext.architectureSummary) {
                userParts.push(`Architecture: ${codeContext.architectureSummary}`);
              }
              if (codeContext.modules?.length > 0) {
                userParts.push("Relevant modules:");
                for (const m of codeContext.modules.slice(0, 10)) {
                  userParts.push(
                    `- ${m.filePath} (${m.moduleType}): ${m.summary}`
                  );
                }
              }
              userParts.push("");
            }

            // Prior generated sections (cascade)
            if (generatedSections.length > 0) {
              userParts.push("--- Prior sections (already written) ---");
              for (const prev of generatedSections) {
                userParts.push(`## ${prev.section}`);
                userParts.push(prev.text);
                userParts.push("");
              }
            }

            userParts.push(
              `Now write the content for the "${sectionName}" section.`
            );

            const response = await anthropic.messages.create({
              model: "claude-sonnet-4-20250514",
              max_tokens: 2048,
              system: systemParts.join("\n"),
              messages: [{ role: "user", content: userParts.join("\n") }],
            });

            const text =
              response.content[0].type === "text"
                ? response.content[0].text
                : "";

            generatedSections.push({ section: sectionName, text });

            // Stream the completed section
            const data = JSON.stringify({ section: sectionName, text });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
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
    console.error("[api/ai/draft-structured-spec] Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
