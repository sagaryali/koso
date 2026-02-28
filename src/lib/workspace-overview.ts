import { createClient } from "@/lib/supabase/client";

export interface WorkspaceOverview {
  clusters: { label: string; summary: string; count: number }[];
  allSpecs: { title: string; type: string }[];
  totalEvidenceCount: number;
}

export async function fetchWorkspaceOverview(
  workspaceId: string,
  supabase: ReturnType<typeof createClient>
): Promise<WorkspaceOverview> {
  const [clustersResult, artifactsResult, evidenceResult] =
    await Promise.allSettled([
      supabase
        .from("evidence_clusters")
        .select("label, summary, evidence_count")
        .eq("workspace_id", workspaceId)
        .order("evidence_count", { ascending: false }),
      supabase
        .from("artifacts")
        .select("id, title, type")
        .eq("workspace_id", workspaceId)
        .neq("type", "architecture_summary")
        .order("updated_at", { ascending: false }),
      supabase
        .from("evidence")
        .select("id, title, content")
        .eq("workspace_id", workspaceId),
    ]);

  const clusters =
    clustersResult.status === "fulfilled" && clustersResult.value.data
      ? clustersResult.value.data.map(
          (c: { label: string; summary: string; evidence_count: number }) => ({
            label: c.label,
            summary: c.summary || "",
            count: c.evidence_count,
          })
        )
      : [];

  const allSpecs =
    artifactsResult.status === "fulfilled" && artifactsResult.value.data
      ? artifactsResult.value.data.map(
          (a: { title: string; type: string }) => ({
            title: a.title,
            type: a.type,
          })
        )
      : [];

  const totalEvidenceCount =
    evidenceResult.status === "fulfilled" && evidenceResult.value.data
      ? evidenceResult.value.data.length
      : 0;

  return {
    clusters,
    allSpecs,
    totalEvidenceCount,
  };
}
