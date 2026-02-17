import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function isDemoMode() {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: "text is required" },
        { status: 400 }
      );
    }

    // Demo mode: generate title from first few words
    if (isDemoMode()) {
      const words = text.trim().split(/\s+/).slice(0, 5);
      const title = words.join(" ") + (text.trim().split(/\s+/).length > 5 ? "..." : "");
      return NextResponse.json({ title });
    }

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 30,
      system:
        "You generate very short titles. Respond with ONLY the title, nothing else. No quotes, no punctuation at the end.",
      messages: [
        {
          role: "user",
          content: `Summarize this in 5 words: ${text}`,
        },
      ],
    });

    const title =
      response.content[0].type === "text"
        ? response.content[0].text.trim()
        : "Untitled evidence";

    return NextResponse.json({ title });
  } catch (err) {
    console.error("[api/ai/title] Error:", err);
    return NextResponse.json({ title: "Untitled evidence" });
  }
}
