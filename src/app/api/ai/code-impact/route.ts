import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthenticatedWorkspace } from "@/lib/api/get-workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { similaritySearch } from "@/lib/embeddings/retrieve";
import type { CodeImpactReport } from "@/types";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function computeContentHash(content: string): number {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return hash;
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

    const { workspace, supabase } = auth;

    const {
      workspaceId,
      artifactId,
      specContent,
      specTitle,
      specType,
      clusters,
      evidenceIds,
    } = await request.json();

    if (!artifactId || !specContent) {
      return new Response(
        JSON.stringify({ error: "artifactId and specContent are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const effectiveWorkspaceId = workspaceId || (workspace as { id: string }).id;

    // --- Fetch code context ---

    // 1. Similarity search for relevant code modules
    const codeResults = await similaritySearch(
      specContent.slice(0, 2000),
      effectiveWorkspaceId,
      { sourceTypes: ["codebase_module"], limit: 10, threshold: 0.1 }
    );

    // 2. Enrich with full module data
    const admin = createAdminClient();
    const moduleIds = [...new Set(codeResults.map((r) => r.sourceId))];

    let moduleSummaries: string[] = [];
    let fullSourceBlocks: string[] = [];

    if (moduleIds.length > 0) {
      const { data: moduleData } = await admin
        .from("codebase_modules")
        .select("id, file_path, module_name, module_type, language, summary, raw_content")
        .in("id", moduleIds);

      if (moduleData) {
        // Top 10 summaries
        moduleSummaries = moduleData.slice(0, 10).map((m) => {
          const typeLabel = m.module_type ? ` [${m.module_type}]` : "";
          return `**${m.file_path}**${typeLabel} — ${m.summary || "No summary"}`;
        });

        // Top 5 full source
        const withContent = moduleData.filter((m) => m.raw_content).slice(0, 5);
        fullSourceBlocks = withContent.map(
          (m) => `### ${m.file_path}\n\`\`\`${m.language || ""}\n${m.raw_content}\n\`\`\``
        );
      }
    }

    // 3. Fetch architecture summary
    const { data: archData } = await supabase
      .from("artifacts")
      .select("content")
      .eq("workspace_id", effectiveWorkspaceId)
      .eq("type", "architecture_summary")
      .limit(1);

    let architectureSummary = "";
    if (archData?.[0]?.content) {
      architectureSummary =
        typeof archData[0].content === "string"
          ? archData[0].content
          : JSON.stringify(archData[0].content);
    }

    // --- Build prompt ---

    const sourceType = clusters?.length > 0 ? "evidence_flow" : "manual";

    const systemPrompt = [
      "You are a senior software engineer analyzing a product spec to produce a Code Impact Report.",
      "You must return ONLY valid JSON matching the specified schema. No markdown, no commentary outside the JSON.",
      "",
      "Analyze the spec against the provided codebase context to determine:",
      "- Which existing modules need modification and what new modules are needed",
      "- Overall effort sizing (S/M/L/XL) with detailed reasoning",
      "- Schema and API changes required",
      "- Technical risks with severity and mitigation strategies",
      "- Recommended build phases with dependencies",
      "",
      "Effort sizes: S = hours, M = 1-3 days, L = 1-2 weeks, XL = 2+ weeks",
    ].join("\n");

    const userParts: string[] = [];

    userParts.push(`## Spec: ${specTitle || "Untitled"} (${specType || "prd"})`);
    userParts.push("");
    userParts.push(specContent);
    userParts.push("");

    if (architectureSummary) {
      userParts.push("--- Codebase Architecture ---");
      userParts.push(architectureSummary);
      userParts.push("");
    }

    if (moduleSummaries.length > 0) {
      userParts.push("--- Relevant Code Modules ---");
      userParts.push(moduleSummaries.join("\n"));
      userParts.push("");
    }

    if (fullSourceBlocks.length > 0) {
      userParts.push("--- Full Source Code (Most Relevant) ---");
      userParts.push(fullSourceBlocks.join("\n\n"));
      userParts.push("");
    }

    if (clusters?.length > 0) {
      userParts.push("--- Evidence Cluster Metadata ---");
      for (const cluster of clusters) {
        userParts.push(`\nCluster: ${cluster.label}`);
        userParts.push(`Summary: ${cluster.summary}`);
        userParts.push(`Evidence count: ${cluster.evidenceCount || 0}`);
        if (cluster.criticalityLevel) {
          userParts.push(`Criticality: ${cluster.criticalityLevel}`);
        }
      }
      userParts.push("");
    }

    userParts.push("---");
    userParts.push("");
    userParts.push("Return a JSON object with this exact structure:");
    userParts.push(`{
  "affectedModules": [{ "filePath": string, "moduleType": string, "changeType": "modify"|"create"|"schema"|"config", "changeDescription": string, "effort": "S"|"M"|"L"|"XL" }],
  "newModules": [{ "filePath": string, "moduleType": string, "changeType": "create", "changeDescription": string, "effort": "S"|"M"|"L"|"XL" }],
  "totalFileCount": number,
  "overallEffort": "S"|"M"|"L"|"XL",
  "effortReasoning": string,
  "effortBreakdown": [{ "area": string, "effort": "S"|"M"|"L"|"XL", "reason": string }],
  "reusableCode": [{ "filePath": string, "description": string }],
  "netNewAreas": [string],
  "schemaChanges": [{ "description": string, "type": string }],
  "apiChanges": [{ "description": string, "type": string }],
  "risks": [{ "description": string, "severity": "low"|"medium"|"high"|"critical", "mitigation": string }],
  "phases": [{ "name": string, "description": string, "modules": [string], "effort": "S"|"M"|"L"|"XL", "dependencies": [string] }]${
    sourceType === "evidence_flow"
      ? `,\n  "themeMappings": [{ "clusterLabel": string, "clusterSummary": string, "evidenceCount": number, "criticalityLevel": string, "affectedModules": [string], "effort": "S"|"M"|"L"|"XL", "dropImpact": string }]`
      : ""
  }
}`);

    if (sourceType === "evidence_flow") {
      userParts.push("");
      userParts.push(
        "IMPORTANT: For each theme in themeMappings, provide a dropImpact that describes " +
        "what would happen if this theme were dropped from the spec — which customer needs " +
        "go unmet, and how much complexity could be saved."
      );
    }

    // --- Stream response ---

    const encoder = new TextEncoder();
    const contentHash = computeContentHash(specContent);

    const readable = new ReadableStream({
      async start(controller) {
        try {
          let fullText = "";

          const stream = anthropic.messages.stream({
            model: "claude-sonnet-4-20250514",
            max_tokens: 4096,
            system: systemPrompt,
            messages: [{ role: "user", content: userParts.join("\n") }],
          });

          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              fullText += event.delta.text;
              const data = JSON.stringify({ text: event.delta.text });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }

          // Parse and persist the report
          try {
            // Extract JSON from the response (handle potential markdown fences)
            let jsonStr = fullText.trim();
            if (jsonStr.startsWith("```")) {
              jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
            }

            const report: CodeImpactReport = JSON.parse(jsonStr);

            await admin
              .from("artifact_code_impact")
              .upsert(
                {
                  artifact_id: artifactId,
                  workspace_id: effectiveWorkspaceId,
                  report,
                  source_type: sourceType,
                  generated_at: new Date().toISOString(),
                  spec_content_hash: contentHash,
                  source_cluster_ids: clusters?.map((c: { id: string }) => c.id).filter(Boolean) ?? [],
                  evidence_ids: evidenceIds ?? [],
                },
                { onConflict: "artifact_id" }
              );

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`)
            );
          } catch (parseErr) {
            console.error("[api/ai/code-impact] Failed to parse/persist report:", parseErr);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ warning: "Report generated but failed to persist" })}\n\n`)
            );
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          const message = err instanceof Error ? err.message : "Stream error";
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
    console.error("[api/ai/code-impact] Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
