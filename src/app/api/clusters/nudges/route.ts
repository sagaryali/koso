import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedWorkspace } from "@/lib/api/get-workspace";
import { generateEmbedding } from "@/lib/embeddings/generate";
import { createAdminClient } from "@/lib/supabase/admin";

interface ClusterRow {
  id: string;
  label: string;
  summary: string;
  evidence_ids: string[];
  evidence_count: number;
  section_relevance: Record<string, number>;
  similarity: number;
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

    const { workspaceId, sectionText, sectionName } = await request.json();
    if (!workspaceId || !sectionText) {
      return NextResponse.json(
        { error: "workspaceId and sectionText are required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const queryEmbedding = await generateEmbedding(sectionText);

    const { data, error } = await supabase.rpc("match_clusters", {
      query_embedding: JSON.stringify(queryEmbedding),
      match_workspace_id: workspaceId,
      match_limit: 8,
      match_threshold: 0.25,
    });

    if (error) {
      console.error("[api/clusters/nudges] RPC failed:", error);
      return NextResponse.json({ nudges: [] });
    }

    const clusters = (data ?? []) as ClusterRow[];

    // Score: combinedScore = (similarity * 0.6) + (sectionRelevance * 0.4)
    const scored = clusters.map((c) => {
      const relevance =
        sectionName && c.section_relevance
          ? (c.section_relevance[sectionName] ?? 0)
          : 0;
      const combinedScore = c.similarity * 0.6 + relevance * 0.4;

      return {
        id: c.id,
        label: c.label,
        summary: c.summary,
        evidenceCount: c.evidence_count,
        evidenceIds: c.evidence_ids,
        combinedScore,
      };
    });

    scored.sort((a, b) => b.combinedScore - a.combinedScore);

    return NextResponse.json({ nudges: scored.slice(0, 3) });
  } catch (err) {
    console.error("[api/clusters/nudges] Error:", err);
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
