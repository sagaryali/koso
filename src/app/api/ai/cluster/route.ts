import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthenticatedWorkspace } from "@/lib/api/get-workspace";

function isDemoMode() {
  return (
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    !process.env.ANTHROPIC_API_KEY
  );
}

interface ClusterResult {
  label: string;
  summary: string;
  items: number[];
  existingCode?: string[];
  codeNote?: string;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedWorkspace();
    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const { feedback, codeContext } = await request.json();

    if (!feedback || !Array.isArray(feedback) || feedback.length === 0) {
      return NextResponse.json(
        { error: "feedback array is required" },
        { status: 400 }
      );
    }

    // Demo mode: return mock clusters
    if (isDemoMode()) {
      return NextResponse.json({
        clusters: [
          {
            label: "Onboarding friction",
            summary:
              "Users struggle with initial setup and first-time experience.",
            items: [0, 1],
          },
          {
            label: "Performance issues",
            summary:
              "Slow load times and laggy interactions reported across key flows.",
            items: [2, 3],
          },
          {
            label: "Missing integrations",
            summary:
              "Requests for third-party tool connections and API access.",
            items: feedback.length > 4 ? [4, 5] : [0],
          },
        ],
      });
    }

    // Build system prompt
    let systemPrompt =
      "You are a product research analyst. Group these feedback items into 3-6 thematic clusters. For each cluster return a JSON object with: label (3-5 words), summary (one sentence), items (array of 0-based indices of feedback items in this cluster).";

    if (codeContext) {
      systemPrompt +=
        " You also have the product's codebase architecture. For each cluster, if relevant code already exists, add: existingCode (array of file paths that relate to this theme) and codeNote (one sentence describing what already exists and its relevance). Only include these fields when there's a genuine match — don't force it.";
    }

    systemPrompt +=
      ' Return valid JSON — an object with a "clusters" key containing the array. No markdown, no code fences. Only output the JSON object, nothing else.';

    // Build user prompt
    let userPrompt = "Feedback items:\n\n";
    feedback.forEach((item: string, i: number) => {
      userPrompt += `${i}. ${item}\n`;
    });

    if (codeContext?.architectureSummary) {
      userPrompt += `\n\nArchitecture summary: ${codeContext.architectureSummary}`;
    }
    if (codeContext?.modules && codeContext.modules.length > 0) {
      userPrompt += "\n\nKey modules:\n";
      codeContext.modules
        .slice(0, 15)
        .forEach(
          (m: { filePath: string; moduleType: string; summary: string }) => {
            userPrompt += `- ${m.filePath} (${m.moduleType}): ${m.summary}\n`;
          }
        );
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    let raw =
      response.content[0].type === "text"
        ? response.content[0].text.trim()
        : '{"clusters":[]}';

    // Strip markdown code fences the model may wrap around JSON
    raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/g, "");

    let parsed: { clusters: ClusterResult[] };
    try {
      parsed = JSON.parse(raw);
      if (!parsed.clusters || !Array.isArray(parsed.clusters)) {
        // Try parsing as a bare array
        const arr = Array.isArray(parsed) ? parsed : JSON.parse(raw);
        if (Array.isArray(arr)) {
          parsed = { clusters: arr };
        } else {
          throw new Error("unexpected shape");
        }
      }
    } catch {
      parsed = {
        clusters: [
          { label: "All feedback", summary: "Could not cluster.", items: feedback.map((_: string, i: number) => i) },
        ],
      };
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[api/ai/cluster] Error:", err);
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
