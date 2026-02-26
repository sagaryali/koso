import { NextRequest, NextResponse } from "next/server";
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

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedWorkspace();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { sectionName, priorSections, sectionGuidance, productDescription } =
      await request.json();

    if (!sectionName) {
      return NextResponse.json(
        { error: "sectionName is required" },
        { status: 400 }
      );
    }

    if (isDemoMode()) {
      return NextResponse.json({
        suggestedTopics: [
          "Key customer pain points from evidence",
          "Quantitative impact metrics",
          "Affected user segments",
        ],
        summary: "This section should ground the problem in customer evidence.",
        inconsistencies: [],
      });
    }

    const systemPrompt =
      "You are a product management assistant. Given the context of a spec being written, " +
      "suggest what should be covered in the upcoming section. " +
      "Respond in JSON with exactly this shape: " +
      '{ "suggestedTopics": ["topic1", "topic2", "topic3"], "summary": "one sentence", "inconsistencies": ["issue1"] }. ' +
      "Keep topics to 3-5 items. Keep summary to 1 sentence. Only include inconsistencies if there are real conflicts in prior sections.";

    const userParts: string[] = [];
    if (productDescription) {
      userParts.push(`Product: ${productDescription}`);
    }
    if (priorSections && priorSections.length > 0) {
      userParts.push("Prior sections:");
      for (const s of priorSections) {
        userParts.push(`## ${s.heading}\n${s.text}`);
      }
    }
    if (sectionGuidance) {
      userParts.push(`Section guidance: ${sectionGuidance}`);
    }
    userParts.push(`\nWhat should the "${sectionName}" section cover?`);

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: "user", content: userParts.join("\n") }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    try {
      const parsed = JSON.parse(text);
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json({
        suggestedTopics: [],
        summary: text.slice(0, 200),
        inconsistencies: [],
      });
    }
  } catch (err) {
    console.error("[api/ai/section-briefing] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
