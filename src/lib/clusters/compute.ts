import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";

const PRD_SECTIONS = [
  "Problem",
  "Goals & Success Metrics",
  "User Stories",
  "Requirements",
  "Open Questions",
];

interface ClusterRaw {
  label: string;
  summary: string;
  items: number[];
}

interface SectionRelevanceResult {
  label: string;
  relevance: Record<string, number>;
}

interface CriticalityResult {
  label: string;
  score: number;
  level: "critical" | "high" | "medium" | "low";
  reason: string;
}

function isDemoMode() {
  return (
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    !process.env.ANTHROPIC_API_KEY
  );
}

export async function shouldRecompute(
  workspaceId: string
): Promise<boolean> {
  const supabase = createAdminClient();

  // Check current evidence count
  const { count: evidenceCount } = await supabase
    .from("evidence")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);

  if (!evidenceCount || evidenceCount < 3) return false;

  // Check computation log
  const { data: log } = await supabase
    .from("cluster_computation_log")
    .select("*")
    .eq("workspace_id", workspaceId)
    .single();

  if (!log) return true; // Never computed

  // If stuck in computing for more than 5 minutes, allow recompute
  const minutesSinceLastCompute =
    (Date.now() - new Date(log.last_computed_at).getTime()) / (1000 * 60);
  if (log.status === "computing" && minutesSinceLastCompute < 5) return false;

  const hoursSinceLastCompute = minutesSinceLastCompute / 60;
  if (hoursSinceLastCompute >= 6) return true;

  const evidenceDelta = evidenceCount - log.evidence_count_at_computation;
  if (evidenceDelta >= 5) return true;

  return false;
}

export async function computeClusters(
  workspaceId: string,
  onProgress?: (step: string) => void
): Promise<void> {
  const supabase = createAdminClient();

  // Mark as computing
  await supabase.from("cluster_computation_log").upsert({
    workspace_id: workspaceId,
    status: "computing",
    last_computed_at: new Date().toISOString(),
    evidence_count_at_computation: 0,
  });

  try {
    // 1. Fetch evidence (cap at 200 most recent)
    onProgress?.("Fetching evidence...");
    const { data: evidence, error: evidenceError } = await supabase
      .from("evidence")
      .select("id, title, content, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (evidenceError || !evidence || evidence.length < 3) {
      await updateLog(workspaceId, "completed", evidence?.length ?? 0);
      return;
    }

    // 2. Call Claude to group into clusters
    onProgress?.(`Identifying patterns across ${evidence.length} items...`);
    const clusters = await clusterEvidence(evidence);

    // 3. For each cluster, compute centroid from member embeddings
    onProgress?.(`Computing embeddings for ${clusters.length} themes...`);
    const clustersWithEmbeddings = await Promise.all(
      clusters.map(async (cluster) => {
        const memberIds = cluster.items
          .filter((i) => i < evidence.length)
          .map((i) => evidence[i].id);

        if (memberIds.length === 0) return null;

        const centroid = await computeCentroid(memberIds);

        return {
          workspace_id: workspaceId,
          label: cluster.label,
          summary: cluster.summary,
          evidence_ids: memberIds,
          evidence_count: memberIds.length,
          representative_embedding: centroid
            ? JSON.stringify(centroid)
            : null,
          section_relevance: {} as Record<string, number>,
          criticality_score: null as number | null,
          criticality_level: null as string | null,
          criticality_reason: null as string | null,
          computed_at: new Date().toISOString(),
        };
      })
    );

    const validClusters = clustersWithEmbeddings.filter(
      (c): c is NonNullable<typeof c> => c !== null
    );

    // 4. Assign section relevance scores
    if (validClusters.length > 0 && !isDemoMode()) {
      onProgress?.("Scoring section relevance...");
      const relevanceScores = await computeSectionRelevance(
        validClusters.map((c) => ({ label: c.label, summary: c.summary }))
      );

      for (const cluster of validClusters) {
        const match = relevanceScores.find((r) => r.label === cluster.label);
        if (match) {
          cluster.section_relevance = match.relevance;
        }
      }
    }

    // 5. Assess criticality
    if (validClusters.length > 0 && !isDemoMode()) {
      onProgress?.("Assessing criticality...");
      const critResults = await computeCriticality(
        validClusters.map((c) => ({
          label: c.label,
          summary: c.summary,
          evidenceCount: c.evidence_count,
        })),
        evidence
      );

      for (const cluster of validClusters) {
        const match = critResults.find((r) => r.label === cluster.label);
        if (match) {
          cluster.criticality_score = match.score;
          cluster.criticality_level = match.level;
          cluster.criticality_reason = match.reason;
        }
      }
    }

    // 6. Delete old clusters, insert new ones
    onProgress?.("Saving themes...");
    await supabase
      .from("evidence_clusters")
      .delete()
      .eq("workspace_id", workspaceId);

    if (validClusters.length > 0) {
      await supabase.from("evidence_clusters").insert(validClusters);
    }

    // 7. Update log
    await updateLog(workspaceId, "completed", evidence.length);
  } catch (err) {
    console.error("[clusters] Computation failed:", err);
    await updateLog(workspaceId, "failed", 0);
    throw err;
  }
}

async function updateLog(
  workspaceId: string,
  status: string,
  evidenceCount: number
) {
  const supabase = createAdminClient();
  await supabase.from("cluster_computation_log").upsert({
    workspace_id: workspaceId,
    status,
    last_computed_at: new Date().toISOString(),
    evidence_count_at_computation: evidenceCount,
  });
}

async function clusterEvidence(
  evidence: { id: string; title: string; content: string }[]
): Promise<ClusterRaw[]> {
  if (isDemoMode()) {
    return [
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
        items: evidence.length > 2 ? [2, 3] : [0],
      },
    ];
  }

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const feedbackText = evidence
    .map((e, i) => `${i}. ${e.title}: ${e.content.slice(0, 300)}`)
    .join("\n");

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system:
      'You are a product research analyst. Group these evidence items into 3-8 thematic clusters. For each cluster return a JSON object with: label (3-5 words), summary (one sentence), items (array of 0-based indices). Return valid JSON — an object with a "clusters" key containing the array. No markdown, no code fences.',
    messages: [{ role: "user", content: feedbackText }],
  });

  let raw =
    response.content[0].type === "text"
      ? response.content[0].text.trim()
      : '{"clusters":[]}';

  raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/g, "");

  try {
    const parsed = JSON.parse(raw);
    const clusters = parsed.clusters ?? (Array.isArray(parsed) ? parsed : []);
    return clusters as ClusterRaw[];
  } catch {
    return [
      {
        label: "All evidence",
        summary: "Could not cluster.",
        items: evidence.map((_, i) => i),
      },
    ];
  }
}

async function computeCentroid(
  evidenceIds: string[]
): Promise<number[] | null> {
  const supabase = createAdminClient();

  const { data: chunks, error } = await supabase
    .from("embeddings")
    .select("embedding")
    .in("source_id", evidenceIds)
    .eq("source_type", "evidence");

  if (error || !chunks || chunks.length === 0) return null;

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

  return centroid;
}

async function computeCriticality(
  clusters: { label: string; summary: string; evidenceCount: number }[],
  evidence: { id: string; created_at: string }[]
): Promise<CriticalityResult[]> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  // Compute recency: fraction of evidence from last 30 days
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentCount = evidence.filter(
    (e) => new Date(e.created_at).getTime() > thirtyDaysAgo
  ).length;
  const recencyRatio =
    evidence.length > 0 ? (recentCount / evidence.length).toFixed(2) : "0";

  const clusterDescriptions = clusters
    .map(
      (c) =>
        `- "${c.label}": ${c.summary} (${c.evidenceCount} evidence items)`
    )
    .join("\n");

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: `You are a product analyst assessing business criticality of evidence themes. Score each on a 0.0-1.0 scale considering: frequency (evidence count), business impact (revenue, churn, compliance risk), breadth (how many users affected), and recency. ${recencyRatio} of evidence is from the last 30 days. Assign a level: critical (>=0.8), high (>=0.6), medium (>=0.4), low (<0.4). Provide a short reason (one sentence). Return JSON: {"results": [{"label": "...", "score": 0.85, "level": "critical", "reason": "..."}]}. No markdown, no code fences.`,
    messages: [{ role: "user", content: clusterDescriptions }],
  });

  let raw =
    response.content[0].type === "text"
      ? response.content[0].text.trim()
      : '{"results":[]}';

  raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/g, "");

  try {
    const parsed = JSON.parse(raw);
    return (parsed.results ?? []) as CriticalityResult[];
  } catch {
    return [];
  }
}

async function computeSectionRelevance(
  clusters: { label: string; summary: string }[]
): Promise<SectionRelevanceResult[]> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const clusterDescriptions = clusters
    .map((c) => `- "${c.label}": ${c.summary}`)
    .join("\n");

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: `You are a product research analyst. For each cluster, score its relevance (0.0 to 1.0) to each PRD section: ${PRD_SECTIONS.join(", ")}. Return JSON: {"results": [{"label": "...", "relevance": {"Problem": 0.9, ...}}]}. No markdown, no code fences.`,
    messages: [{ role: "user", content: clusterDescriptions }],
  });

  let raw =
    response.content[0].type === "text"
      ? response.content[0].text.trim()
      : '{"results":[]}';

  raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/g, "");

  try {
    const parsed = JSON.parse(raw);
    return (parsed.results ?? []) as SectionRelevanceResult[];
  } catch {
    return [];
  }
}
