import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

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
    // Auth: verify user is authenticated (workspace cookie is optional during onboarding)
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { feedback, codeContext } = await request.json();

    if (!feedback || !Array.isArray(feedback) || feedback.length === 0) {
      return NextResponse.json(
        { error: "feedback array is required" },
        { status: 400 }
      );
    }

    // Demo mode: return mock synthesis
    if (isDemoMode()) {
      return NextResponse.json({
        synthesis: [
          {
            theme: "Onboarding friction",
            detail:
              "Users consistently report confusion during first-time setup, requesting clearer documentation and guided walkthroughs.",
          },
          {
            theme: "Performance",
            detail:
              "Slow load times are a recurring complaint, especially on dashboard and list views.",
          },
        ],
      });
    }

    // Build system prompt
    let systemPrompt = `You are a product research analyst. Identify 2-4 distinct themes from customer feedback. Return valid JSON — an array of objects with "theme" (short label, 2-4 words) and "detail" (one sentence explaining the pattern). Output ONLY the raw JSON array. Do not use markdown, headers, bullet characters, or any formatting — just plain text in the JSON string values.`;

    if (codeContext) {
      systemPrompt +=
        "\n\nYou also have access to the product's codebase. When relevant, mention how a theme relates to existing code in the detail — e.g., 'relates to the existing auth module which currently supports basic roles.' Keep code references brief and useful for a PM.";
    }

    // Build user prompt
    let userPrompt = "Synthesize these feedback items:\n\n";
    feedback.forEach((item: string, i: number) => {
      userPrompt += `${i + 1}. ${item}\n`;
    });

    if (codeContext?.architectureSummary) {
      userPrompt += `\n\nArchitecture summary: ${codeContext.architectureSummary}`;
    }
    if (codeContext?.modules && codeContext.modules.length > 0) {
      userPrompt += "\n\nKey modules:\n";
      codeContext.modules
        .slice(0, 10)
        .forEach(
          (m: { filePath: string; moduleType: string; summary: string }) => {
            userPrompt += `- ${m.filePath} (${m.moduleType}): ${m.summary}\n`;
          }
        );
    }

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    let raw =
      response.content[0].type === "text"
        ? response.content[0].text.trim()
        : "[]";

    // Strip markdown code fences the model may wrap around JSON
    raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/g, "");

    let synthesis: { theme: string; detail: string }[];
    try {
      const parsed = JSON.parse(raw);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      synthesis = arr
        .filter(
          (s: unknown): s is { theme: unknown; detail: unknown } =>
            typeof s === "object" && s !== null && "theme" in s && "detail" in s
        )
        .map((s) => ({
          theme: String(s.theme ?? "").replace(/^[#+=*\-{}\[\]"\s]+/, "").replace(/[}\]"]+$/, "").trim(),
          detail: String(s.detail ?? "").replace(/^[#+=*\-{}\[\]"\s]+/, "").replace(/[}\]"]+$/, "").trim(),
        }))
        .filter((s) => s.theme.length > 0 && s.detail.length > 0);
      if (synthesis.length === 0) throw new Error("empty after filtering");
    } catch {
      // Fallback: wrap raw text as a single theme
      const cleaned = raw.replace(/[\[\]{}"]/g, "").trim();
      synthesis = cleaned
        ? [{ theme: "Summary", detail: cleaned }]
        : [{ theme: "Summary", detail: "Unable to synthesize themes from the provided feedback." }];
    }

    return NextResponse.json({ synthesis });
  } catch (err) {
    console.error("[api/ai/synthesize] Error:", err);
    return NextResponse.json({
      synthesis: [
        {
          theme: "Error",
          detail: "Unable to synthesize feedback at this time.",
        },
      ],
    });
  }
}
