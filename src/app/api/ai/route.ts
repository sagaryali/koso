import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { MOCK_AI_RESPONSES } from "../../../../scripts/seed-data/mock-responses";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function isDemoMode() {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

function detectIntent(system: string, user: string): string {
  const combined = (system + " " + user).toLowerCase();
  if (combined.includes("who is asking") || combined.includes("who's asking")) return "whos_asking";
  if (combined.includes("critical review") || combined.includes("challenge")) return "challenge_spec";
  if (combined.includes("business case") || combined.includes("build the case")) return "build_the_case";
  if (combined.includes("what's missing") || combined.includes("gap analysis")) return "whats_missing";
  if (combined.includes("what should we build next") || combined.includes("prioriti")) return "what_to_build_next";
  if (combined.includes("struggling") || combined.includes("pain point")) return "customer_struggles";
  if (combined.includes("unaddressed") || combined.includes("unlinked evidence") || combined.includes("haven't we addressed")) return "unaddressed_feedback";
  if (combined.includes("user stor")) return "user_stories";
  if (combined.includes("acceptance criteria")) return "acceptance_criteria";
  if (combined.includes("conflict")) return "conflicts";
  if (combined.includes("rewrite") || combined.includes("audience")) return "rewrite";
  if (combined.includes("edge case") || combined.includes("security")) return "edge_cases";
  if (combined.includes("how would engineering") || combined.includes("feasib")) return "engineering";
  if (combined.includes("effort") || combined.includes("estimate")) return "effort";
  if (combined.includes("codebase") || combined.includes("what needs to change")) return "codebase_changes";
  if (combined.includes("market") || combined.includes("competitor") || combined.includes("worth building")) return "market_research";
  if (combined.includes("feedback") || combined.includes("summarize")) return "feedback_summary";
  return "default";
}

function createMockStream(system: string, user: string): Response {
  const intent = detectIntent(system, user);
  const mockText = MOCK_AI_RESPONSES[intent] || MOCK_AI_RESPONSES["default"];
  const encoder = new TextEncoder();
  const words = mockText.split(" ");

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
    const { system, user, messages, model, maxTokens } = await request.json();

    if (!system || (!user && !messages)) {
      return new Response(
        JSON.stringify({ error: "system and user (or messages) are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Build messages array: use multi-turn messages if provided, else single user string
    const chatMessages: { role: "user" | "assistant"; content: string }[] =
      messages || [{ role: "user", content: user }];

    // Demo mode: return mock streaming response
    // For demo, extract the first user message for intent detection
    const demoUserText =
      user || chatMessages.find((m: { role: string }) => m.role === "user")?.content || "";
    if (isDemoMode()) {
      return createMockStream(system, demoUserText);
    }

    const modelId =
      model === "haiku"
        ? "claude-haiku-4-5-20251001"
        : "claude-sonnet-4-20250514";

    const stream = anthropic.messages.stream({
      model: modelId,
      max_tokens: Math.min(maxTokens || 4096, 8192),
      system,
      messages: chatMessages,
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
    console.error("[api/ai] Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
