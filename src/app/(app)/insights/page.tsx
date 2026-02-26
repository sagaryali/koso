"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, ArrowRight } from "lucide-react";
import { Button, Badge, Icon, Skeleton } from "@/components/ui";
import { Dialog } from "@/components/ui";
import { Input } from "@/components/ui";
import { EvidenceFlow } from "@/components/spec-creation/evidence-flow";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { useCodebaseStatus } from "@/hooks/use-codebase-status";
import type { EvidenceCluster, Evidence, Workspace, CodebaseConnection } from "@/types";

type SortMode = "evidence_count" | "newest" | "effort_easiest" | "effort_hardest";

type EffortLevel = "Quick Win" | "Medium" | "Complex";

interface EffortEstimate {
  label: string;
  effortLevel: EffortLevel;
  reason: string;
  affectedModuleCount: number;
}

const EFFORT_ORDER: Record<EffortLevel, number> = {
  "Quick Win": 0,
  Medium: 1,
  Complex: 2,
};

function EvidenceFlowDialog({
  open,
  onClose,
  workspace,
  connection,
}: {
  open: boolean;
  onClose: () => void;
  workspace: Workspace;
  connection: CodebaseConnection | null;
}) {
  return (
    <Dialog open={open} onClose={onClose} className="max-w-xl">
      <h2 className="text-lg font-bold tracking-tight">
        New Spec from Evidence
      </h2>
      <p className="mt-1 mb-4 text-sm text-text-secondary">
        Select evidence, cluster themes, then draft a spec.
      </p>
      <EvidenceFlow
        workspaceId={workspace.id}
        workspace={workspace}
        hasCodebase={connection?.status === "ready"}
        codebaseRepoName={connection?.repo_name}
        onComplete={onClose}
        onCancel={onClose}
      />
    </Dialog>
  );
}

export default function InsightsPage() {
  const { workspace } = useWorkspace();
  const router = useRouter();
  const supabase = createClient();
  const { connection } = useCodebaseStatus(true);

  const [clusters, setClusters] = useState<EvidenceCluster[]>([]);
  const [evidenceMap, setEvidenceMap] = useState<Record<string, Evidence>>({});
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set());
  const [sortMode, setSortMode] = useState<SortMode>("evidence_count");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Evidence[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [evidenceFlowOpen, setEvidenceFlowOpen] = useState(false);

  // Effort estimation
  const [effortMap, setEffortMap] = useState<Record<string, EffortEstimate>>({});
  const [effortLoading, setEffortLoading] = useState(false);

  // Stats
  const [totalEvidence, setTotalEvidence] = useState(0);
  const [unlinkedCount, setUnlinkedCount] = useState(0);
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    document.title = "Koso — Insights";
  }, []);

  // Fetch clusters + stats
  useEffect(() => {
    if (!workspace) return;
    const wsId = workspace.id;

    async function load() {
      const [
        { data: clusterData },
        { data: allEvidence },
        { data: linkedSourceIds },
      ] = await Promise.all([
        supabase
          .from("evidence_clusters")
          .select("*")
          .eq("workspace_id", wsId)
          .order("evidence_count", { ascending: false }),
        supabase
          .from("evidence")
          .select("id, type")
          .eq("workspace_id", wsId),
        supabase
          .from("links")
          .select("source_id")
          .eq("workspace_id", wsId)
          .eq("source_type", "evidence"),
      ]);

      if (clusterData) setClusters(clusterData);

      if (allEvidence) {
        setTotalEvidence(allEvidence.length);

        // Type breakdown
        const counts: Record<string, number> = {};
        for (const e of allEvidence) {
          counts[e.type] = (counts[e.type] || 0) + 1;
        }
        setTypeCounts(counts);

        // Unlinked count
        if (linkedSourceIds) {
          const linkedSet = new Set(
            linkedSourceIds.map((l: { source_id: string }) => l.source_id)
          );
          const unlinked = allEvidence.filter((e: { id: string }) => !linkedSet.has(e.id));
          setUnlinkedCount(unlinked.length);
        }
      }

      setLoading(false);

      // Trigger cluster recomputation in background if needed
      if (allEvidence && allEvidence.length >= 3) {
        fetch("/api/clusters/compute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId: wsId }),
        })
          .then(async (res) => {
            if (res.ok) {
              const result = await res.json();
              if (result.completed) {
                // Refetch clusters
                const { data: fresh } = await supabase
                  .from("evidence_clusters")
                  .select("*")
                  .eq("workspace_id", wsId)
                  .order("evidence_count", { ascending: false });
                if (fresh) setClusters(fresh);
              }
            }
          })
          .catch(() => {});
      }
    }

    load();
  }, [workspace?.id]);

  // Fetch effort estimates when codebase is connected and clusters are loaded
  useEffect(() => {
    if (!workspace || clusters.length === 0 || connection?.status !== "ready") return;
    if (effortLoading || Object.keys(effortMap).length > 0) return;

    async function fetchEffortEstimates() {
      setEffortLoading(true);

      try {
        const [{ data: modules }, { data: archArtifacts }] = await Promise.all([
          supabase
            .from("codebase_modules")
            .select("file_path, module_type, summary")
            .eq("workspace_id", workspace!.id)
            .order("updated_at", { ascending: false })
            .limit(15),
          supabase
            .from("artifacts")
            .select("content")
            .eq("workspace_id", workspace!.id)
            .eq("type", "architecture_summary")
            .limit(1),
        ]);

        const archSummary =
          archArtifacts?.[0]?.content && typeof archArtifacts[0].content === "string"
            ? archArtifacts[0].content
            : archArtifacts?.[0]?.content
              ? JSON.stringify(archArtifacts[0].content)
              : undefined;

        const res = await fetch("/api/ai/estimate-effort", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clusters: clusters.map((c) => ({
              label: c.label,
              summary: c.summary,
              evidenceCount: c.evidence_count,
            })),
            architectureSummary: archSummary,
            modules: (modules || []).map(
              (m: { file_path: string; module_type: string; summary: string }) => ({
                filePath: m.file_path,
                moduleType: m.module_type,
                summary: m.summary,
              })
            ),
          }),
        });

        if (res.ok) {
          const { estimates } = await res.json();
          if (Array.isArray(estimates)) {
            const map: Record<string, EffortEstimate> = {};
            for (const est of estimates) {
              map[est.label] = est;
            }
            setEffortMap(map);
          }
        }
      } catch (err) {
        console.error("[insights] Effort estimation failed:", err);
      } finally {
        setEffortLoading(false);
      }
    }

    fetchEffortEstimates();
  }, [workspace?.id, clusters.length, connection?.status]);

  // Fetch evidence details when expanding a cluster
  const fetchClusterEvidence = useCallback(
    async (cluster: EvidenceCluster) => {
      const missingIds = cluster.evidence_ids.filter((id) => !evidenceMap[id]);
      if (missingIds.length === 0) return;

      const { data } = await supabase
        .from("evidence")
        .select("*")
        .in("id", missingIds);

      if (data) {
        setEvidenceMap((prev) => {
          const next = { ...prev };
          for (const e of data) {
            next[e.id] = e;
          }
          return next;
        });
      }
    },
    [evidenceMap, supabase]
  );

  function toggleClusterExpansion(cluster: EvidenceCluster) {
    setExpandedClusters((prev) => {
      const next = new Set(prev);
      if (next.has(cluster.id)) {
        next.delete(cluster.id);
      } else {
        next.add(cluster.id);
        fetchClusterEvidence(cluster);
      }
      return next;
    });
  }

  // Search
  async function handleSearch() {
    if (!searchQuery.trim() || !workspace) return;
    setSearching(true);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchQuery,
          workspaceId: workspace.id,
          sourceTypes: ["evidence"],
          grouped: true,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const evidenceResults = data.results?.evidence ?? [];
        // Fetch full evidence items
        const ids = evidenceResults.map((r: { sourceId: string }) => r.sourceId);
        if (ids.length > 0) {
          const { data: items } = await supabase
            .from("evidence")
            .select("*")
            .in("id", ids);
          setSearchResults(items ?? []);
        } else {
          setSearchResults([]);
        }
      }
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  function clearSearch() {
    setSearchQuery("");
    setSearchResults(null);
  }

  // Sort clusters
  const sortedClusters = [...clusters].sort((a, b) => {
    if (sortMode === "evidence_count") return b.evidence_count - a.evidence_count;
    if (sortMode === "newest") return new Date(b.computed_at).getTime() - new Date(a.computed_at).getTime();
    if (sortMode === "effort_easiest" || sortMode === "effort_hardest") {
      const ea = effortMap[a.label]?.effortLevel;
      const eb = effortMap[b.label]?.effortLevel;
      const oa = ea ? EFFORT_ORDER[ea] : 999;
      const ob = eb ? EFFORT_ORDER[eb] : 999;
      return sortMode === "effort_easiest" ? oa - ob : ob - oa;
    }
    return 0;
  });

  // Filter clusters by search
  const filteredClusters = searchQuery.trim() && !searchResults
    ? sortedClusters.filter(
        (c) =>
          c.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.summary.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : sortedClusters;

  function handleCreateSpecFromCluster(cluster: EvidenceCluster) {
    setEvidenceFlowOpen(true);
  }

  function formatType(type: string) {
    return type
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  if (loading) {
    return (
      <div className="px-12 py-10 page-transition">
        <Skeleton variant="text" width={200} height={36} />
        <div className="mt-1">
          <Skeleton variant="text" width={280} />
        </div>
        <div className="mt-8 space-y-4">
          <Skeleton variant="block" height={100} />
          <Skeleton variant="block" height={100} />
          <Skeleton variant="block" height={100} />
        </div>
      </div>
    );
  }

  return (
    <div className="px-12 py-10 page-transition">
      <h1 className="text-2xl font-bold tracking-tight">Insights</h1>
      <p className="mt-1 text-sm text-text-secondary">
        {totalEvidence} evidence items across {clusters.length} theme
        {clusters.length !== 1 ? "s" : ""}
      </p>

      {/* Stats bar */}
      <div className="mt-6 flex items-center gap-6 text-sm text-text-secondary">
        {Object.entries(typeCounts).map(([type, count]) => (
          <span key={type}>
            {count} {formatType(type)}
            {count !== 1 ? "s" : ""}
          </span>
        ))}
        {unlinkedCount > 0 && (
          <button
            onClick={() => router.push("/evidence?filter=unlinked")}
            className="cursor-pointer text-text-primary underline"
          >
            {unlinkedCount} unlinked
          </button>
        )}
      </div>

      {/* Search + Sort */}
      <div className="mt-6 flex items-center gap-3">
        <div className="flex-1">
          <Input
            placeholder="Search evidence..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (!e.target.value.trim()) setSearchResults(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
          />
        </div>
        {searchResults && (
          <button
            onClick={clearSearch}
            className="cursor-pointer text-xs text-text-tertiary hover:text-text-primary"
          >
            Clear
          </button>
        )}
        <div className="flex items-center gap-1">
          <span className="text-xs text-text-tertiary">Sort:</span>
          {(
            [
              { key: "evidence_count" as SortMode, label: "By count" },
              { key: "newest" as SortMode, label: "Newest" },
              ...(Object.keys(effortMap).length > 0
                ? [
                    { key: "effort_easiest" as SortMode, label: "Easiest" },
                    { key: "effort_hardest" as SortMode, label: "Hardest" },
                  ]
                : []),
            ] as { key: SortMode; label: string }[]
          ).map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSortMode(opt.key)}
              className={cn(
                "cursor-pointer px-2 py-1 text-xs transition-none",
                sortMode === opt.key
                  ? "bg-bg-inverse text-text-inverse"
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search results */}
      {searchResults && (
        <div className="mt-6">
          <div className="text-[11px] font-medium uppercase tracking-caps text-text-tertiary">
            Search Results ({searchResults.length})
          </div>
          {searchResults.length === 0 ? (
            <p className="mt-3 text-sm text-text-tertiary">
              No evidence found matching &ldquo;{searchQuery}&rdquo;
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {searchResults.map((item) => (
                <div
                  key={item.id}
                  className="border border-border-default p-3"
                >
                  <div className="flex items-center gap-2">
                    <Badge>{formatType(item.type)}</Badge>
                    <span className="text-sm font-medium text-text-primary">
                      {item.title}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-text-secondary">
                    {item.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Clusters */}
      {!searchResults && (
        <div className="mt-8">
          {clusters.length === 0 ? (
            <div className="flex flex-col items-center border border-border-default py-12">
              <p className="text-sm text-text-tertiary">
                {totalEvidence < 3
                  ? "Add at least 3 evidence items to see theme clusters."
                  : "Computing themes..."}
              </p>
              {totalEvidence >= 3 && !computing && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-4"
                  onClick={async () => {
                    if (!workspace) return;
                    setComputing(true);
                    try {
                      await fetch("/api/clusters/compute", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ workspaceId: workspace.id }),
                      });
                      const { data } = await supabase
                        .from("evidence_clusters")
                        .select("*")
                        .eq("workspace_id", workspace.id)
                        .order("evidence_count", { ascending: false });
                      if (data) setClusters(data);
                    } finally {
                      setComputing(false);
                    }
                  }}
                >
                  Compute themes
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredClusters.map((cluster) => {
                const isExpanded = expandedClusters.has(cluster.id);
                const effort = effortMap[cluster.label];

                return (
                  <div
                    key={cluster.id}
                    className="border border-border-default"
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-medium text-text-primary">
                              {cluster.label}
                            </h3>
                            {effort && (
                              <span
                                className={cn(
                                  "px-1.5 py-0.5 text-[10px] font-medium",
                                  effort.effortLevel === "Quick Win"
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                                    : effort.effortLevel === "Medium"
                                      ? "bg-bg-tertiary text-text-secondary"
                                      : "bg-bg-inverse text-text-inverse"
                                )}
                                title={effort.reason}
                              >
                                {effort.effortLevel}
                              </span>
                            )}
                            {effortLoading && !effort && (
                              <span className="h-3 w-12 animate-pulse bg-bg-tertiary" />
                            )}
                          </div>
                          <p className="mt-1 text-xs text-text-secondary">
                            {cluster.summary}
                          </p>
                          {effort?.reason && (
                            <p className="mt-1 text-[11px] text-text-tertiary">
                              {effort.reason}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge>{cluster.evidence_count} items</Badge>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleCreateSpecFromCluster(cluster)}
                          >
                            Create spec
                          </Button>
                        </div>
                      </div>

                      {/* Section relevance indicators */}
                      {cluster.section_relevance && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {Object.entries(cluster.section_relevance)
                            .filter(([, score]) => score > 0.5)
                            .sort(([, a], [, b]) => b - a)
                            .slice(0, 3)
                            .map(([section]) => (
                              <span
                                key={section}
                                className="bg-bg-tertiary px-1.5 py-0.5 text-[10px] text-text-tertiary"
                              >
                                {section}
                              </span>
                            ))}
                        </div>
                      )}

                      {/* Expand/collapse */}
                      <button
                        onClick={() => toggleClusterExpansion(cluster)}
                        className="mt-3 flex cursor-pointer items-center gap-1 text-xs text-text-tertiary hover:text-text-secondary"
                      >
                        <Icon
                          icon={isExpanded ? ChevronDown : ChevronRight}
                          size={14}
                        />
                        {isExpanded ? "Hide" : "Show"} evidence
                      </button>
                    </div>

                    {/* Expanded evidence list */}
                    {isExpanded && (
                      <div className="border-t border-border-default bg-bg-secondary px-4 py-3">
                        <div className="space-y-2">
                          {cluster.evidence_ids.map((eid) => {
                            const evidence = evidenceMap[eid];
                            if (!evidence) {
                              return (
                                <div key={eid} className="py-1">
                                  <Skeleton variant="text" width="80%" />
                                </div>
                              );
                            }
                            return (
                              <div key={eid} className="py-1">
                                <div className="flex items-center gap-2">
                                  <Badge>{formatType(evidence.type)}</Badge>
                                  <span className="text-xs font-medium text-text-primary">
                                    {evidence.title}
                                  </span>
                                </div>
                                <p className="mt-0.5 line-clamp-2 pl-[52px] text-xs text-text-secondary">
                                  {evidence.content}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {workspace && (
        <EvidenceFlowDialog
          open={evidenceFlowOpen}
          onClose={() => setEvidenceFlowOpen(false)}
          workspace={workspace}
          connection={connection}
        />
      )}
    </div>
  );
}
