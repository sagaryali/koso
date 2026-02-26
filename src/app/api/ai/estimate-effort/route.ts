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

interface ClusterInput {
  label: string;
  summary: string;
  evidenceCount: number;
}

interface EffortEstimate {
  label: string;
  effortLevel: "Quick Win" | "Medium" | "Complex";
  reason: string;
  affectedModuleCount: number;
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

    const { clusters, architectureSummary, modules } = await request.json();

    if (!clusters || !Array.isArray(clusters) || clusters.length === 0) {
      return new Response(
        JSON.stringify({ error: "clusters array is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (isDemoMode()) {
      const mockEstimates: EffortEstimate[] = clusters.map((c: ClusterInput) => ({
        label: c.label,
        effortLevel: c.evidenceCount > 5 ? "Complex" : c.evidenceCount > 2 ? "Medium" : "Quick Win",
        reason: `Mock estimate for "${c.label}".`,
        affectedModuleCount: Math.ceil(Math.random() * 5),
      }));
      return Response.json({ estimates: mockEstimates });
    }

    const clusterDescriptions = clusters
      .map(
        (c: ClusterInput, i: number) =>
          `${i + 1}. "${c.label}": ${c.summary} (${c.evidenceCount} evidence items)`
      )
      .join("\n");

    const systemPrompt = [
      "You are a senior engineering lead assessing implementation effort for product feature clusters.",
      "For each cluster, estimate the effort level based on the codebase architecture and the scope of changes needed.",
      "",
      'Effort levels: "Quick Win" (can be done in a day or two, mostly config/UI changes), "Medium" (a few days to a week, requires some new logic), "Complex" (a week or more, significant architecture changes).',
      "",
      "Return a JSON array with one object per cluster, in the same order as input.",
      'Each object: { "label": string, "effortLevel": "Quick Win"|"Medium"|"Complex", "reason": string (1 sentence), "affectedModuleCount": number }',
      "",
      "Return ONLY the JSON array, no other text.",
    ].join("\n");

    const userParts: string[] = [];

    userParts.push("Feature clusters to assess:");
    userParts.push(clusterDescriptions);
    userParts.push("");

    if (architectureSummary) {
      userParts.push(`Architecture: ${architectureSummary}`);
      userParts.push("");
    }

    if (modules && modules.length > 0) {
      userParts.push("Codebase modules:");
      for (const m of modules.slice(0, 15)) {
        userParts.push(`- ${m.filePath} (${m.moduleType}): ${m.summary}`);
      }
      userParts.push("");
    }

    userParts.push("Provide your effort estimates as a JSON array.");

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userParts.join("\n") }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Parse JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return Response.json({ estimates: [] });
    }

    const estimates: EffortEstimate[] = JSON.parse(jsonMatch[0]);

    return Response.json({ estimates });
  } catch (err) {
    console.error("[api/ai/estimate-effort] Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
