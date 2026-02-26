import { createAdminClient } from "@/lib/supabase/admin";
import { generateEmbedding } from "./generate";

export interface SearchResult {
  id: string;
  sourceId: string;
  sourceType: string;
  chunkText: string;
  chunkIndex: number;
  metadata: Record<string, unknown>;
  similarity: number;
}

export interface SearchOptions {
  sourceTypes?: string[];
  limit?: number;
  threshold?: number;
}

export interface GroupedContext {
  artifacts: SearchResult[];
  evidence: SearchResult[];
  codebaseModules: SearchResult[];
}

export async function similaritySearch(
  query: string,
  workspaceId: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const supabase = createAdminClient();
  const { sourceTypes, limit = 10, threshold = 0.0 } = options;

  const queryEmbedding = await generateEmbedding(query);

  const { data, error } = await supabase.rpc("match_embeddings", {
    query_embedding: JSON.stringify(queryEmbedding),
    match_workspace_id: workspaceId,
    match_source_types: sourceTypes ?? null,
    match_limit: limit,
    match_threshold: threshold,
  });

  if (error) {
    console.error("[search] RPC match_embeddings failed:", error);
    return [];
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    sourceId: row.source_id as string,
    sourceType: row.source_type as string,
    chunkText: row.chunk_text as string,
    chunkIndex: row.chunk_index as number,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    similarity: row.similarity as number,
  }));
}

export async function getRelatedArtifacts(
  artifactId: string,
  workspaceId: string,
  limit: number = 5
): Promise<SearchResult[]> {
  const supabase = createAdminClient();

  // Get all embedding vectors for this artifact
  const { data: chunks, error } = await supabase
    .from("embeddings")
    .select("embedding")
    .eq("source_id", artifactId)
    .eq("source_type", "artifact");

  if (error || !chunks || chunks.length === 0) {
    console.log(`[search] No embeddings found for artifact:${artifactId}`);
    return [];
  }

  // Compute centroid (average of all chunk embeddings)
  const dimension = 1536;
  const centroid = new Array(dimension).fill(0);

  for (const chunk of chunks) {
    const vec: number[] =
      typeof chunk.embedding === "string"
        ? JSON.parse(chunk.embedding)
        : chunk.embedding;
    for (let i = 0; i < dimension; i++) {
      centroid[i] += vec[i];
    }
  }
  for (let i = 0; i < dimension; i++) {
    centroid[i] /= chunks.length;
  }

  // Search for similar chunks, excluding the source artifact
  const { data, error: rpcError } = await supabase.rpc("match_embeddings", {
    query_embedding: JSON.stringify(centroid),
    match_workspace_id: workspaceId,
    match_source_types: null,
    match_limit: limit + 10,
    match_threshold: 0.0,
  });

  if (rpcError) {
    console.error("[search] RPC failed for getRelatedArtifacts:", rpcError);
    return [];
  }

  return (data ?? [])
    .filter((row: Record<string, unknown>) => row.source_id !== artifactId)
    .slice(0, limit)
    .map((row: Record<string, unknown>) => ({
      id: row.id as string,
      sourceId: row.source_id as string,
      sourceType: row.source_type as string,
      chunkText: row.chunk_text as string,
      chunkIndex: row.chunk_index as number,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      similarity: row.similarity as number,
    }));
}

export async function assembleContext(
  query: string,
  workspaceId: string,
  sourceTypes?: string[]
): Promise<GroupedContext> {
  const results = await similaritySearch(query, workspaceId, {
    sourceTypes,
    limit: 20,
    threshold: 0.1,
  });

  return {
    artifacts: results.filter((r) => r.sourceType === "artifact"),
    evidence: results.filter((r) => r.sourceType === "evidence"),
    codebaseModules: results.filter((r) => r.sourceType === "codebase_module"),
  };
}
