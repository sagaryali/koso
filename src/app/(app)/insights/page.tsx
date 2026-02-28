"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button, Skeleton, Icon } from "@/components/ui";
import { Input } from "@/components/ui";
import { RefreshCw } from "lucide-react";
import { AssessWorthDialog } from "@/components/insights/assess-worth-dialog";
import { placeholderSpecDoc } from "@/lib/sections-to-tiptap";
import { ClusterCard } from "@/components/insights/cluster-card";
import { BuildQueue } from "@/components/insights/build-queue";
import { FilterChips, EMPTY_FILTERS, hasActiveFilters } from "@/components/insights/filter-chips";
import type { InsightFilters } from "@/components/insights/filter-chips";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { parseSSEStream } from "@/lib/sse-parser";
import type { EvidenceCluster, Evidence, ClusterVerdict } from "@/types";

type SortMode = "evidence_count" | "most_urgent";

const CRITICALITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export default function InsightsPage() {
  const { workspace } = useWorkspace();
  const router = useRouter();
  const supabase = createClient();

  const [clusters, setClusters] = useState<EvidenceCluster[]>([]);
  const [evidenceMap, setEvidenceMap] = useState<Record<string, Evidence>>({});
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [computeStep, setComputeStep] = useState<string | null>(null);
  const [computeError, setComputeError] = useState<string | null>(null);
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set());
  const [sortMode, setSortMode] = useState<SortMode>("evidence_count");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResultIds, setSearchResultIds] = useState<Set<string> | null>(null);
  const [searching, setSearching] = useState(false);

  // Filters
  const [filters, setFilters] = useState<InsightFilters>({ ...EMPTY_FILTERS });

  // Multi-select
  const [selectedClusterIds, setSelectedClusterIds] = useState<Set<string>>(new Set());

  // Dismissed toggle
  const [showDismissed, setShowDismissed] = useState(false);

  // Build queue
  const [buildQueueExpanded, setBuildQueueExpanded] = useState(true);

  // Creating spec (disable buttons during async)
  const [creatingSpec, setCreatingSpec] = useState(false);

  // Assess worth dialog
  const [assessDialogCluster, setAssessDialogCluster] = useState<EvidenceCluster | null>(null);
  const [assessDialogOpen, setAssessDialogOpen] = useState(false);


  // Cluster-to-specs mapping
  const [clusterToSpecs, setClusterToSpecs] = useState<Record<string, { artifactId: string; title: string }[]>>({});


  // Stats
  const [totalEvidence, setTotalEvidence] = useState(0);
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({});
  const [newEvidenceCount, setNewEvidenceCount] = useState(0);

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
        { data: linkedArtifacts },
      ] = await Promise.all([
        supabase
          .from("evidence_clusters")
          .select("*")
          .eq("workspace_id", wsId)
          .order("evidence_count", { ascending: false }),
        supabase
          .from("evidence")
          .select("id, type, created_at")
          .eq("workspace_id", wsId),
        supabase
          .from("artifacts")
          .select("id, title, source_cluster_ids")
          .eq("workspace_id", wsId)
          .neq("source_cluster_ids", "{}"),
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

        // Detect stale clusters: evidence added after last computation
        if (clusterData && clusterData.length > 0) {
          const computedAt = clusterData[0]?.computed_at;
          if (computedAt) {
            const newSinceCompute = allEvidence.filter(
              (e) => new Date(e.created_at) > new Date(computedAt)
            );
            setNewEvidenceCount(newSinceCompute.length);
          }
        }
      }

      // Build cluster → specs map
      if (linkedArtifacts) {
        const map: Record<string, { artifactId: string; title: string }[]> = {};
        for (const a of linkedArtifacts) {
          for (const cid of a.source_cluster_ids) {
            if (!map[cid]) map[cid] = [];
            map[cid].push({ artifactId: a.id, title: a.title });
          }
        }
        setClusterToSpecs(map);
      }

      setLoading(false);

      // Auto-compute clusters on first visit when none exist yet
      if (allEvidence && allEvidence.length >= 3 && (!clusterData || clusterData.length === 0)) {
        setComputing(true);
        setComputeStep("Starting...");
        fetch("/api/clusters/compute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId: wsId, force: true }),
        })
          .then(async (res) => {
            if (!res.ok) {
              setComputeError("Cluster computation failed. Try the manual button.");
              return;
            }

            const ok = await parseSSEStream(res, {
              onStep: (step) => setComputeStep(step),
              onError: (error) => setComputeError(error),
            });

            if (ok) {
              // Refetch clusters after computation completes
              const { data: fresh } = await supabase
                .from("evidence_clusters")
                .select("*")
                .eq("workspace_id", wsId)
                .order("evidence_count", { ascending: false });
              if (fresh) {
                setClusters(fresh);
                setSelectedClusterIds(new Set());
              }
            }
          })
          .catch((err) => {
            console.error("[insights] Auto-compute failed:", err);
            setComputeError("Cluster computation failed unexpectedly.");
          })
          .finally(() => {
            setComputing(false);
            setComputeStep(null);
          });
      }
    }

    load();
  }, [workspace?.id]);

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

  function toggleClusterSelection(clusterId: string) {
    setSelectedClusterIds((prev) => {
      const next = new Set(prev);
      if (next.has(clusterId)) next.delete(clusterId);
      else next.add(clusterId);
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
        const ids: string[] = evidenceResults.map((r: { sourceId: string }) => r.sourceId);
        setSearchResultIds(new Set(ids));

        // Pre-fetch evidence details for matching clusters so expanded view works
        if (ids.length > 0) {
          const missingIds = ids.filter((id) => !evidenceMap[id]);
          if (missingIds.length > 0) {
            const { data: items } = await supabase
              .from("evidence")
              .select("*")
              .in("id", missingIds);
            if (items) {
              setEvidenceMap((prev) => {
                const next = { ...prev };
                for (const e of items) next[e.id] = e;
                return next;
              });
            }
          }
        }
      }
    } catch {
      setSearchResultIds(new Set());
    } finally {
      setSearching(false);
    }
  }

  function clearSearch() {
    setSearchQuery("");
    setSearchResultIds(null);
  }

  // Sort clusters
  const sortedClusters = [...clusters].sort((a, b) => {
    // Pinned clusters always sort to the top
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;

    if (sortMode === "evidence_count") return b.evidence_count - a.evidence_count;
    if (sortMode === "most_urgent") {
      const oa = a.criticality_level ? CRITICALITY_ORDER[a.criticality_level] ?? 999 : 999;
      const ob = b.criticality_level ? CRITICALITY_ORDER[b.criticality_level] ?? 999 : 999;
      if (oa !== ob) return oa - ob;
      return (b.criticality_score ?? 0) - (a.criticality_score ?? 0);
    }
    return 0;
  });

  // Filter clusters by search
  let filteredClusters = sortedClusters;
  if (searchQuery.trim() && !searchResultIds) {
    // Live text filter (before Enter is pressed)
    filteredClusters = filteredClusters.filter(
      (c) =>
        c.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.summary.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }
  if (searchResultIds && searchResultIds.size > 0) {
    // Semantic search: show only clusters that contain matching evidence
    filteredClusters = filteredClusters.filter((c) =>
      c.evidence_ids.some((eid) => searchResultIds.has(eid))
    );
  }

  // Apply filter chips
  const filtersActive = hasActiveFilters(filters);
  if (filtersActive) {
    filteredClusters = filteredClusters.filter((c) => {
      // Criticality filter (multi-select OR)
      if (filters.criticality.size > 0) {
        if (!c.criticality_level || !filters.criticality.has(c.criticality_level)) return false;
      }
      // Verdict filter (multi-select OR)
      if (filters.verdict.size > 0) {
        const clusterVerdict = c.verdict ?? "unassessed";
        if (!filters.verdict.has(clusterVerdict as never)) return false;
      }
      // Coverage filter
      if (filters.coverage === "has_spec" && !clusterToSpecs[c.id]?.length) return false;
      if (filters.coverage === "no_spec" && clusterToSpecs[c.id]?.length) return false;
      return true;
    });
  }

  // Count dismissed before filtering them out
  const dismissedCount = filteredClusters.filter((c) => c.dismissed).length;
  if (!showDismissed) {
    filteredClusters = filteredClusters.filter((c) => !c.dismissed);
  }

  const handleVerdictSaved = useCallback(
    (clusterId: string, verdict: ClusterVerdict, reasoning: string) => {
      setClusters((prev) =>
        prev.map((c) =>
          c.id === clusterId
            ? { ...c, verdict, verdict_reasoning: reasoning, verdict_at: new Date().toISOString() }
            : c
        )
      );
    },
    []
  );

  async function handleCreateSpecFromClusters(selectedClusters: EvidenceCluster[]) {
    if (!workspace || creatingSpec) return;
    setCreatingSpec(true);

    try {
      // 1. Fetch evidence content for selected clusters
      const allEvidenceIds = selectedClusters.flatMap((c) => c.evidence_ids);
      const uniqueIds = [...new Set(allEvidenceIds)];

      const { data: evidenceItems } = await supabase
        .from("evidence")
        .select("id, content, title")
        .in("id", uniqueIds);

      const evidenceById = new Map(
        (evidenceItems ?? []).map((e: { id: string; content: string; title: string }) => [e.id, e])
      );

      // 2. Build themes array
      const themes = selectedClusters.map((cluster) => ({
        label: cluster.label,
        summary: cluster.summary,
        feedback: cluster.evidence_ids
          .map((id) => {
            const e = evidenceById.get(id);
            return e ? e.content : "";
          })
          .filter(Boolean),
      }));

      // 3. Build title
      const specTitle = selectedClusters.map((c) => c.custom_label ?? c.label).join(" + ");

      // 4. Create placeholder artifact
      const { data: artifact } = await supabase
        .from("artifacts")
        .insert({
          workspace_id: workspace.id,
          type: "prd",
          title: specTitle,
          content: placeholderSpecDoc(),
          status: "draft",
          source_cluster_ids: selectedClusters.map((c) => c.id),
        })
        .select("id")
        .single();

      if (!artifact) {
        console.error("[insights] Failed to create placeholder artifact");
        setCreatingSpec(false);
        return;
      }

      // 5. Store generation context in sessionStorage
      const generationContext = {
        themes,
        product: {
          name: workspace.name,
          description: workspace.product_description,
          principles: workspace.principles,
        },
      };
      sessionStorage.setItem(
        `koso_draft_spec_context_${artifact.id}`,
        JSON.stringify(generationContext)
      );

      // 6. Navigate to editor with generating flag
      router.push(`/editor/${artifact.id}?generating=true`);
    } catch (err) {
      console.error("[insights] Create spec failed:", err);
      setCreatingSpec(false);
    }
  }

  function handleCreateCombinedSpec() {
    const selected = clusters.filter((c) => selectedClusterIds.has(c.id));
    if (selected.length === 0) return;
    handleCreateSpecFromClusters(selected);
  }

  async function handleDismiss(clusterId: string) {
    await supabase
      .from("evidence_clusters")
      .update({ dismissed: true })
      .eq("id", clusterId);
    setClusters((prev) =>
      prev.map((c) => (c.id === clusterId ? { ...c, dismissed: true } : c))
    );
  }

  async function handleRestore(clusterId: string) {
    await supabase
      .from("evidence_clusters")
      .update({ dismissed: false })
      .eq("id", clusterId);
    setClusters((prev) =>
      prev.map((c) => (c.id === clusterId ? { ...c, dismissed: false } : c))
    );
  }

  async function handleMerge() {
    const selected = clusters.filter((c) => selectedClusterIds.has(c.id));
    if (selected.length < 2) return;

    // Pick target: cluster with highest evidence_count
    const target = selected.reduce((best, c) =>
      c.evidence_count > best.evidence_count ? c : best
    );
    const sources = selected.filter((c) => c.id !== target.id);

    // Combine all evidence_ids (deduplicated)
    const mergedIds = [...new Set(selected.flatMap((c) => c.evidence_ids))];
    const mergedLabel = selected
      .map((c) => c.custom_label ?? c.label)
      .join(" + ");

    // Update target cluster in supabase (clear verdict since evidence changed)
    await supabase
      .from("evidence_clusters")
      .update({
        evidence_ids: mergedIds,
        evidence_count: mergedIds.length,
        custom_label: mergedLabel,
        verdict: null,
        verdict_reasoning: null,
        verdict_at: null,
      })
      .eq("id", target.id);

    // Delete source clusters
    const sourceIds = sources.map((c) => c.id);
    await supabase
      .from("evidence_clusters")
      .delete()
      .in("id", sourceIds);

    // Update local state
    const updatedTarget: EvidenceCluster = {
      ...target,
      evidence_ids: mergedIds,
      evidence_count: mergedIds.length,
      custom_label: mergedLabel,
      verdict: null,
      verdict_reasoning: null,
      verdict_at: null,
    };
    setClusters((prev) =>
      prev
        .filter((c) => !sourceIds.includes(c.id))
        .map((c) => (c.id === target.id ? updatedTarget : c))
    );
    setSelectedClusterIds(new Set());
  }

  function formatType(type: string) {
    return type
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // Check if any cluster has criticality data
  const hasCriticalityData = clusters.some((c) => c.criticality_level != null);

  // Stat counters for subtitle
  const withSpecs = clusters.filter((c) => clusterToSpecs[c.id]?.length).length;
  const assessed = clusters.filter((c) => c.verdict != null).length;

  // Build queue: BUILD-verdict clusters sorted by criticality
  const buildQueueClusters = clusters
    .filter((c) => c.verdict === "BUILD" && !c.dismissed)
    .sort((a, b) => {
      const ca = a.criticality_level ? CRITICALITY_ORDER[a.criticality_level] ?? 999 : 999;
      const cb = b.criticality_level ? CRITICALITY_ORDER[b.criticality_level] ?? 999 : 999;
      if (ca !== cb) return ca - cb;
      return b.evidence_count - a.evidence_count;
    });

  function handleScrollToCluster(clusterId: string) {
    const el = document.getElementById(`cluster-${clusterId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-green-300");
      setTimeout(() => el.classList.remove("ring-2", "ring-green-300"), 2000);
    }
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Insights</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Themes and patterns surfaced from your evidence.
          </p>
          <p className="mt-1 text-xs text-text-tertiary">
            {filtersActive || searchResultIds
              ? `Showing ${filteredClusters.length} of ${clusters.length} theme${clusters.length !== 1 ? "s" : ""}`
              : `${clusters.length} theme${clusters.length !== 1 ? "s" : ""}`}
            {withSpecs > 0 && ` · ${withSpecs} with spec${withSpecs !== 1 ? "s" : ""}`}
            {assessed > 0 && ` · ${assessed} assessed`}
          </p>
        </div>
        {clusters.length > 0 && (
          <div className="flex flex-col items-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={computing}
              onClick={async () => {
                if (!workspace) return;
                setComputing(true);
                setComputeStep("Starting...");
                setComputeError(null);
                try {
                  const res = await fetch("/api/clusters/compute", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ workspaceId: workspace.id, force: true }),
                  });
                  if (!res.ok) {
                    const errBody = await res.json().catch(() => ({}));
                    setComputeError(errBody.error || `Server error (${res.status})`);
                    return;
                  }
                  const ok = await parseSSEStream(res, {
                    onStep: (step) => setComputeStep(step),
                    onError: (error) => setComputeError(error),
                  });
                  if (ok) {
                    const { data } = await supabase
                      .from("evidence_clusters")
                      .select("*")
                      .eq("workspace_id", workspace.id)
                      .order("evidence_count", { ascending: false });
                    if (data) {
                      setClusters(data);
                      setSelectedClusterIds(new Set());
                    }
                  }
                } catch (err) {
                  console.error("[insights] Recompute failed:", err);
                  setComputeError("Recompute failed.");
                } finally {
                  setComputing(false);
                  setComputeStep(null);
                }
              }}
              className="gap-1.5 text-text-tertiary hover:text-text-primary"
            >
              <Icon icon={RefreshCw} size={14} className={computing ? "animate-spin" : ""} />
              {computing ? (computeStep || "Recomputing...") : "Recompute"}
            </Button>
            {!computing && clusters[0]?.computed_at && (
              <span className="text-[10px] text-text-tertiary">
                Last computed {new Date(clusters[0].computed_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div className="mt-6 flex items-center gap-6 text-sm text-text-secondary">
        {Object.entries(typeCounts).map(([type, count]) => (
          <span key={type}>
            {count} {formatType(type)}
            {count !== 1 ? "s" : ""}
          </span>
        ))}
      </div>

      {/* Search + Sort */}
      <div className="mt-6 flex items-center gap-3">
        <div className="flex-1">
          <Input
            placeholder="Filter themes..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (!e.target.value.trim()) setSearchResultIds(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
          />
        </div>
        {searchQuery.trim() && !searchResultIds && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSearch}
            disabled={searching}
          >
            {searching ? "Searching..." : "Search evidence"}
          </Button>
        )}
        <div className="flex items-center gap-1">
          {(
            [
              { key: "evidence_count" as SortMode, label: "Most evidence" },
              { key: "most_urgent" as SortMode, label: "Most urgent" },
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
          {dismissedCount > 0 && (
            <button
              onClick={() => setShowDismissed((v) => !v)}
              className={cn(
                "cursor-pointer px-2 py-1 text-xs transition-none",
                showDismissed
                  ? "bg-bg-inverse text-text-inverse"
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              {showDismissed ? "Hide dismissed" : `Show dismissed (${dismissedCount})`}
            </button>
          )}
        </div>
      </div>

      {/* Filter chips */}
      {clusters.length > 0 && (
        <div className="mt-3">
          <FilterChips
            activeFilters={filters}
            onFiltersChange={setFilters}
            clusterToSpecs={clusterToSpecs}
            hasCriticalityData={hasCriticalityData}
          />
        </div>
      )}


      {/* New evidence banner */}
      {newEvidenceCount > 0 && !computing && (
        <div className="mt-4 flex items-center justify-between border border-yellow-200 bg-yellow-50/50 px-4 py-2">
          <span className="text-sm text-text-secondary">
            {newEvidenceCount} new evidence item{newEvidenceCount !== 1 ? "s" : ""} since last computation
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              if (!workspace) return;
              setComputing(true);
              setComputeStep("Starting...");
              setComputeError(null);
              try {
                const res = await fetch("/api/clusters/compute", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ workspaceId: workspace.id, force: true }),
                });
                if (!res.ok) {
                  const errBody = await res.json().catch(() => ({}));
                  setComputeError(errBody.error || `Server error (${res.status})`);
                  return;
                }
                const ok = await parseSSEStream(res, {
                  onStep: (step) => setComputeStep(step),
                  onError: (error) => setComputeError(error),
                });
                if (ok) {
                  const { data } = await supabase
                    .from("evidence_clusters")
                    .select("*")
                    .eq("workspace_id", workspace.id)
                    .order("evidence_count", { ascending: false });
                  if (data) {
                    setClusters(data);
                    setSelectedClusterIds(new Set());
                    setNewEvidenceCount(0);
                  }
                }
              } catch (err) {
                console.error("[insights] Recompute failed:", err);
                setComputeError("Recompute failed.");
              } finally {
                setComputing(false);
                setComputeStep(null);
              }
            }}
          >
            Recompute themes
          </Button>
        </div>
      )}

      {/* Build Queue */}
      {buildQueueClusters.length > 0 && !searchResultIds && (
        <div id="build-queue" className="mt-4 transition-shadow">
          <BuildQueue
            clusters={buildQueueClusters}
            clusterToSpecs={clusterToSpecs}
            expanded={buildQueueExpanded}
            onExpandedChange={setBuildQueueExpanded}
            onCreateSpec={(c) => handleCreateSpecFromClusters([c])}
            onScrollToCluster={handleScrollToCluster}
          />
        </div>
      )}

      {/* Search results banner */}
      {searchResultIds && (
        <div className="mt-4 flex items-center justify-between border border-border-default bg-bg-secondary px-4 py-2">
          <span className="text-sm text-text-secondary">
            {searchResultIds.size === 0
              ? <>No evidence found matching &ldquo;{searchQuery}&rdquo;</>
              : <>Found matches in <strong>{filteredClusters.length}</strong> theme{filteredClusters.length !== 1 ? "s" : ""} for &ldquo;{searchQuery}&rdquo;</>
            }
          </span>
          <button
            onClick={clearSearch}
            className="cursor-pointer text-xs text-text-tertiary hover:text-text-primary"
          >
            Clear search
          </button>
        </div>
      )}

      {/* Clusters */}
      {!(searchResultIds && searchResultIds.size === 0) && (
        <div className="mt-8">
          {clusters.length === 0 ? (
            <div className="flex flex-col items-center border border-border-default py-12">
              {computing ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2 text-sm text-text-tertiary">
                    <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-text-tertiary" />
                    {computeStep || "Starting..."}
                  </div>
                </div>
              ) : computeError ? (
                <div className="flex flex-col items-center gap-2">
                  <p className="text-sm text-state-error">{computeError}</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setComputeError(null);
                    }}
                  >
                    Dismiss
                  </Button>
                </div>
              ) : totalEvidence < 3 ? (
                <p className="text-sm text-text-tertiary">
                  Add at least 3 evidence items to see theme clusters.
                </p>
              ) : (
                <>
                  <p className="text-sm text-text-tertiary">
                    Analyze your evidence to discover recurring themes.
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-4"
                    onClick={async () => {
                      if (!workspace) return;
                      setComputing(true);
                      setComputeStep("Starting...");
                      setComputeError(null);
                      try {
                        const res = await fetch("/api/clusters/compute", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ workspaceId: workspace.id, force: true }),
                        });

                        if (!res.ok) {
                          const errBody = await res.json().catch(() => ({}));
                          setComputeError(errBody.error || `Server error (${res.status})`);
                          return;
                        }

                        const ok = await parseSSEStream(res, {
                          onStep: (step) => setComputeStep(step),
                          onError: (error) => setComputeError(error),
                        });

                        if (ok) {
                          // Refetch clusters after computation
                          const { data } = await supabase
                            .from("evidence_clusters")
                            .select("*")
                            .eq("workspace_id", workspace.id)
                            .order("evidence_count", { ascending: false });
                          if (data) {
                            setClusters(data);
                            setSelectedClusterIds(new Set());
                          }
                        }
                      } catch (err) {
                        console.error("[insights] Compute themes failed:", err);
                        setComputeError("Compute themes failed. Check the console for details.");
                      } finally {
                        setComputing(false);
                        setComputeStep(null);
                      }
                    }}
                  >
                    Compute themes
                  </Button>
                </>
              )}
            </div>
          ) : filteredClusters.length === 0 ? (
            <div className="flex flex-col items-center border border-border-default py-12">
              <p className="text-sm text-text-tertiary">
                No themes match the current filters.
              </p>
            </div>
          ) : (
            <div className="space-y-3 pb-20">
              {filteredClusters.map((cluster) => (
                <ClusterCard
                  key={cluster.id}
                  id={`cluster-${cluster.id}`}
                  cluster={cluster}
                  isExpanded={expandedClusters.has(cluster.id)}
                  isSelected={selectedClusterIds.has(cluster.id)}
                  linkedSpecs={clusterToSpecs[cluster.id] ?? []}
                  evidenceMap={evidenceMap}
                  onToggleExpand={() => toggleClusterExpansion(cluster)}
                  onToggleSelect={() => toggleClusterSelection(cluster.id)}
                  onCreateSpec={() => handleCreateSpecFromClusters([cluster])}
                  onAssess={() => {
                    setAssessDialogCluster(cluster);
                    setAssessDialogOpen(true);
                  }}
                  onClusterUpdated={(updated) => {
                    setClusters((prev) =>
                      prev.map((c) => (c.id === updated.id ? updated : c))
                    );
                  }}
                  onDismiss={() => handleDismiss(cluster.id)}
                  onRestore={() => handleRestore(cluster.id)}
                  highlightedEvidenceIds={searchResultIds}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Floating action bar for multi-select */}
      {selectedClusterIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 border border-border-strong bg-bg-primary px-5 py-3 shadow-lg">
          <span className="text-sm text-text-primary">
            {selectedClusterIds.size} theme{selectedClusterIds.size !== 1 ? "s" : ""} selected
          </span>
          {selectedClusterIds.size >= 2 && (
            <Button variant="secondary" size="sm" onClick={handleMerge}>
              Merge
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={handleCreateCombinedSpec} disabled={creatingSpec}>
            {creatingSpec ? "Creating..." : "Create combined spec"}
          </Button>
          <button
            onClick={() => setSelectedClusterIds(new Set())}
            className="cursor-pointer text-xs text-text-tertiary hover:text-text-primary"
          >
            Clear
          </button>
        </div>
      )}

      {/* Assess worth dialog */}
      {workspace && assessDialogCluster && (
        <AssessWorthDialog
          open={assessDialogOpen}
          onClose={() => {
            setAssessDialogOpen(false);
            setAssessDialogCluster(null);
          }}
          cluster={assessDialogCluster}
          workspaceId={workspace.id}
          onVerdictSaved={handleVerdictSaved}
        />
      )}

    </div>
  );
}
