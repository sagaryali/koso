import { SupabaseClient } from "@supabase/supabase-js";

const SIMILARITY_THRESHOLD = 0.75;

/**
 * Auto-link a newly created/updated evidence item to similar artifacts.
 * Returns the number of new links created.
 */
export async function autoLinkEvidence(
  evidenceId: string,
  workspaceId: string,
  supabase: SupabaseClient
): Promise<number> {
  // Search for similar artifacts
  const { data: results } = await supabase.rpc("match_embeddings", {
    query_embedding: await getEmbeddingForSource(evidenceId, supabase),
    match_workspace_id: workspaceId,
    match_source_type: "artifact",
    match_threshold: SIMILARITY_THRESHOLD,
    match_count: 5,
  });

  if (!results || results.length === 0) return 0;

  // Get unique artifact IDs
  const artifactIds: string[] = [...new Set((results as { source_id: string }[]).map((r) => r.source_id))];

  // Check for existing links
  const { data: existingLinks } = await supabase
    .from("links")
    .select("target_id")
    .eq("workspace_id", workspaceId)
    .eq("source_id", evidenceId)
    .eq("source_type", "evidence")
    .in("target_id", artifactIds);

  const existingTargets = new Set(
    (existingLinks ?? []).map((l: { target_id: string }) => l.target_id)
  );

  // Create new links
  const newLinks = artifactIds
    .filter((id: string) => !existingTargets.has(id))
    .map((artifactId: string) => ({
      workspace_id: workspaceId,
      source_id: evidenceId,
      source_type: "evidence",
      target_id: artifactId,
      target_type: "artifact",
      relationship: "related_to",
    }));

  if (newLinks.length === 0) return 0;

  const { error } = await supabase.from("links").insert(newLinks);
  if (error) {
    console.error("[auto-link] Failed to create links:", error);
    return 0;
  }

  return newLinks.length;
}

/**
 * Auto-link a newly created/updated artifact to similar evidence.
 * Returns the number of new links created.
 */
export async function autoLinkArtifact(
  artifactId: string,
  workspaceId: string,
  supabase: SupabaseClient
): Promise<number> {
  // Search for similar evidence
  const { data: results } = await supabase.rpc("match_embeddings", {
    query_embedding: await getEmbeddingForSource(artifactId, supabase),
    match_workspace_id: workspaceId,
    match_source_type: "evidence",
    match_threshold: SIMILARITY_THRESHOLD,
    match_count: 10,
  });

  if (!results || results.length === 0) return 0;

  // Get unique evidence IDs
  const evidenceIds: string[] = [...new Set((results as { source_id: string }[]).map((r) => r.source_id))];

  // Check for existing links (in either direction)
  const { data: existingLinks } = await supabase
    .from("links")
    .select("source_id, target_id")
    .eq("workspace_id", workspaceId)
    .or(
      `and(source_id.eq.${artifactId},source_type.eq.artifact,target_type.eq.evidence),` +
      `and(target_id.eq.${artifactId},target_type.eq.artifact,source_type.eq.evidence)`
    );

  const existingEvidenceIds = new Set<string>();
  for (const link of existingLinks ?? []) {
    if (link.source_id === artifactId) existingEvidenceIds.add(link.target_id);
    if (link.target_id === artifactId) existingEvidenceIds.add(link.source_id);
  }

  // Create new links (evidence → artifact direction for consistency)
  const newLinks = evidenceIds
    .filter((id: string) => !existingEvidenceIds.has(id))
    .map((evidenceId: string) => ({
      workspace_id: workspaceId,
      source_id: evidenceId,
      source_type: "evidence",
      target_id: artifactId,
      target_type: "artifact",
      relationship: "related_to",
    }));

  if (newLinks.length === 0) return 0;

  const { error } = await supabase.from("links").insert(newLinks);
  if (error) {
    console.error("[auto-link] Failed to create links:", error);
    return 0;
  }

  return newLinks.length;
}

/**
 * Get the embedding vector for a source from the embeddings table.
 */
async function getEmbeddingForSource(
  sourceId: string,
  supabase: SupabaseClient
): Promise<number[]> {
  const { data } = await supabase
    .from("embeddings")
    .select("embedding")
    .eq("source_id", sourceId)
    .limit(1)
    .single();

  if (!data?.embedding) {
    return [];
  }

  // embedding might be stored as JSON string or array
  if (typeof data.embedding === "string") {
    return JSON.parse(data.embedding);
  }
  return data.embedding;
}
