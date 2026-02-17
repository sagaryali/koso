"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Code, ChevronDown, ChevronRight } from "lucide-react";
import { Button, TextArea, Badge, Skeleton } from "@/components/ui";
import { Icon } from "@/components/ui/icon";
import { Dialog } from "@/components/ui/dialog";
import { FeedbackList } from "@/components/evidence/feedback-list";
import { parseFeedback } from "@/lib/parse-feedback";
import type { FeedbackItem } from "@/lib/parse-feedback";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { useCodebaseStatus } from "@/hooks/use-codebase-status";
import { StreamedMarkdown } from "@/components/ui/streamed-markdown";
import { textToTiptap } from "@/lib/text-to-tiptap";
import type { Evidence } from "@/types";

// --- Types ---

interface Cluster {
  label: string;
  summary: string;
  items: number[];
  existingCode?: string[];
  codeNote?: string;
}

interface CodeContext {
  architectureSummary?: string;
  modules?: Array<{ filePath: string; moduleType: string; summary: string }>;
}

// --- Helpers ---

function streamFromResponse(
  res: Response,
  onChunk: (text: string) => void,
  onComplete: (fullText: string) => void,
  onError: (err: Error) => void
) {
  const reader = res.body?.getReader();
  if (!reader) {
    onError(new Error("No response body"));
    return;
  }

  const decoder = new TextDecoder();
  let fullText = "";

  (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                fullText += parsed.text;
                onChunk(parsed.text);
              }
              if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch (e) {
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }
      }
      onComplete(fullText);
    } catch (err) {
      onError(err instanceof Error ? err : new Error(String(err)));
    }
  })();
}

// --- Component ---

export default function InvestigatePage() {
  const { workspace } = useWorkspace();
  const router = useRouter();
  const supabase = createClient();
  const { connection } = useCodebaseStatus(false);

  const hasCodebase = connection?.status === "ready";

  // Step state
  const [step, setStep] = useState(1);

  // Step 1: Feedback collection
  const [rawText, setRawText] = useState("");
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [evidenceDialogOpen, setEvidenceDialogOpen] = useState(false);
  const [evidenceItems, setEvidenceItems] = useState<Evidence[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<Set<string>>(
    new Set()
  );

  // Step 2: Clusters
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [clusterLoading, setClusterLoading] = useState(false);
  const [selectedClusterIndices, setSelectedClusterIndices] = useState<
    Set<number>
  >(new Set());
  const [expandedClusters, setExpandedClusters] = useState<Set<number>>(
    new Set()
  );
  const [codeContext, setCodeContext] = useState<CodeContext | null>(null);

  // Step 3: Spec draft
  const [specText, setSpecText] = useState("");
  const [specStreaming, setSpecStreaming] = useState(false);
  const [showRefine, setShowRefine] = useState(false);
  const [refinementText, setRefinementText] = useState("");
  const specAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    document.title = "Koso — Investigate";
  }, []);

  // --- Step 1 handlers ---

  function handleProcessText() {
    const parsed = parseFeedback(rawText);
    setFeedbackItems((prev) => [...prev, ...parsed]);
    setRawText("");
  }

  function handleUpdateFeedbackItem(id: string, content: string) {
    setFeedbackItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, content } : item))
    );
  }

  function handleRemoveFeedbackItem(id: string) {
    setFeedbackItems((prev) => prev.filter((item) => item.id !== id));
  }

  async function openEvidenceDialog() {
    if (!workspace) return;
    setEvidenceDialogOpen(true);
    setEvidenceLoading(true);
    setSelectedEvidenceIds(new Set());

    const { data } = await supabase
      .from("evidence")
      .select("*")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false });

    setEvidenceItems(data || []);
    setEvidenceLoading(false);
  }

  function toggleEvidenceSelection(id: string) {
    setSelectedEvidenceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function confirmEvidenceSelection() {
    const selected = evidenceItems.filter((e) => selectedEvidenceIds.has(e.id));
    const newItems: FeedbackItem[] = selected.map((e) => ({
      id: crypto.randomUUID(),
      content: e.content,
      title: e.title,
    }));
    setFeedbackItems((prev) => [...prev, ...newItems]);
    setEvidenceDialogOpen(false);
  }

  // --- Step 2: Analyze ---

  const analyzeCallback = useCallback(async () => {
    if (!workspace || feedbackItems.length === 0) return;

    setStep(2);
    setClusterLoading(true);
    setClusters([]);
    setSelectedClusterIndices(new Set());
    setCodeContext(null);

    const feedbackStrings = feedbackItems.map((f) => f.content);

    // Fetch code context in parallel if available
    let fetchedCodeContext: CodeContext | null = null;

    if (hasCodebase) {
      const [searchRes, archRes] = await Promise.all([
        fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: feedbackStrings.join(" ").slice(0, 1000),
            workspaceId: workspace.id,
            sourceTypes: ["codebase_module"],
            grouped: true,
          }),
        }).catch(() => null),
        supabase
          .from("artifacts")
          .select("content")
          .eq("workspace_id", workspace.id)
          .eq("type", "architecture_summary")
          .limit(1),
      ]);

      const modules: CodeContext["modules"] = [];
      if (searchRes?.ok) {
        const searchData = await searchRes.json();
        const codeResults = searchData.results?.codebaseModules ?? [];
        for (const r of codeResults.slice(0, 10)) {
          modules.push({
            filePath: r.metadata?.filePath || r.sourceId,
            moduleType: r.metadata?.moduleType || "unknown",
            summary: r.chunkText?.slice(0, 200) || "",
          });
        }
      }

      const archSummary =
        archRes.data?.[0]?.content &&
        typeof archRes.data[0].content === "object"
          ? JSON.stringify(archRes.data[0].content)
          : typeof archRes.data?.[0]?.content === "string"
            ? archRes.data[0].content
            : undefined;

      if (modules.length > 0 || archSummary) {
        fetchedCodeContext = {
          architectureSummary: archSummary,
          modules,
        };
        setCodeContext(fetchedCodeContext);
      }
    }

    // Call cluster API
    try {
      const res = await fetch("/api/ai/cluster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback: feedbackStrings,
          codeContext: fetchedCodeContext || undefined,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Cluster request failed (${res.status})`);
      }

      const data = await res.json();
      setClusters(data.clusters || []);
    } catch (err) {
      console.error("[investigate] Cluster error:", err);
      // Fallback: single cluster with all items
      setClusters([
        {
          label: "All feedback",
          summary: "Unable to cluster — showing all items.",
          items: feedbackStrings.map((_, i) => i),
        },
      ]);
    } finally {
      setClusterLoading(false);
    }
  }, [workspace, feedbackItems, hasCodebase, supabase]);

  function toggleClusterSelection(index: number) {
    setSelectedClusterIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function toggleClusterExpansion(index: number) {
    setExpandedClusters((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  // --- Step 3: Draft spec ---

  const draftSpec = useCallback(
    async (refinement?: string) => {
      if (!workspace) return;

      setStep(3);
      setSpecText("");
      setSpecStreaming(true);
      setShowRefine(false);

      // Build selected themes payload
      const feedbackStrings = feedbackItems.map((f) => f.content);
      const selectedThemes = clusters
        .filter((_, i) => selectedClusterIndices.has(i))
        .map((cluster) => ({
          label: cluster.label,
          summary: cluster.summary,
          feedback: cluster.items.map((idx) => feedbackStrings[idx] || ""),
          existingCode: cluster.existingCode,
          codeNote: cluster.codeNote,
        }));

      const body: Record<string, unknown> = {
        themes: selectedThemes,
        product: {
          name: workspace.name,
          description: workspace.product_description,
          principles: workspace.principles,
        },
      };

      if (codeContext) {
        body.codeContext = codeContext;
      }

      if (refinement) {
        body.refinement = refinement;
      }

      try {
        const controller = new AbortController();
        specAbortRef.current = controller;

        const res = await fetch("/api/ai/draft-spec", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error("Draft-spec request failed");

        streamFromResponse(
          res,
          (chunk) => setSpecText((prev) => prev + chunk),
          () => setSpecStreaming(false),
          (err) => {
            console.error("[investigate] Stream error:", err);
            setSpecStreaming(false);
          }
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("[investigate] Draft-spec error:", err);
        setSpecStreaming(false);
      }
    },
    [workspace, feedbackItems, clusters, selectedClusterIndices, codeContext]
  );

  async function handleCreateSpec() {
    if (!workspace || !specText.trim()) return;

    const content = textToTiptap(specText);

    const { data: artifact } = await supabase
      .from("artifacts")
      .insert({
        workspace_id: workspace.id,
        type: "prd",
        title: "Investigation Spec",
        content,
        status: "draft",
      })
      .select("id")
      .single();

    if (artifact) {
      // Fire-and-forget embedding
      fetch("/api/embeddings/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: artifact.id,
          sourceType: "artifact",
        }),
      }).catch(() => {});

      router.push(`/editor/${artifact.id}`);
    }
  }

  function handleRefine() {
    if (!refinementText.trim()) return;
    draftSpec(refinementText.trim());
    setRefinementText("");
  }

  // --- Render ---

  if (!workspace) {
    return (
      <div className="px-12 py-10 page-transition">
        <Skeleton variant="text" width={260} height={36} />
      </div>
    );
  }

  return (
    <div className="px-12 py-10 page-transition">
      <div className="mx-auto max-w-[720px]">
        <h1 className="mb-1 text-2xl font-bold tracking-tight">Investigate</h1>
        <p className="mb-8 text-sm text-text-secondary">
          Turn customer feedback into actionable specs.
        </p>

        {/* Step indicators */}
        <div className="mb-8 flex items-center gap-2 text-xs text-text-tertiary">
          <span
            className={
              step === 1 ? "font-medium text-text-primary" : ""
            }
          >
            1. Collect
          </span>
          <span>—</span>
          <span
            className={
              step === 2 ? "font-medium text-text-primary" : ""
            }
          >
            2. Cluster
          </span>
          <span>—</span>
          <span
            className={
              step === 3 ? "font-medium text-text-primary" : ""
            }
          >
            3. Draft
          </span>
        </div>

        {/* ========== STEP 1: Collect Feedback ========== */}
        {step === 1 && (
          <div>
            <TextArea
              label="Paste customer feedback"
              placeholder="Paste messy customer feedback here — Koso will make sense of it."
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              className="min-h-[160px] max-h-[320px] overflow-y-auto"
            />

            <div className="mt-3 flex items-center gap-3">
              <Button
                variant="primary"
                size="sm"
                onClick={handleProcessText}
                disabled={!rawText.trim()}
              >
                Process
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={openEvidenceDialog}
              >
                Or pull from evidence pool
              </Button>
            </div>

            {/* Feedback list */}
            {feedbackItems.length > 0 && (
              <div className="mt-6">
                <FeedbackList
                  items={feedbackItems}
                  onUpdateItem={handleUpdateFeedbackItem}
                  onRemoveItem={handleRemoveFeedbackItem}
                />

                {/* Code context banner */}
                {hasCodebase && connection && (
                  <div className="mt-4 flex items-center gap-2 text-[13px] text-text-tertiary">
                    <Icon icon={Code} size={16} className="text-[#999]" />
                    <span>
                      Code context from {connection.repo_name} will be used to
                      ground the analysis
                    </span>
                  </div>
                )}

                <div className="mt-6">
                  <Button
                    variant="primary"
                    onClick={analyzeCallback}
                    disabled={feedbackItems.length === 0}
                  >
                    Analyze
                  </Button>
                </div>
              </div>
            )}

            {/* Evidence Dialog */}
            <Dialog
              open={evidenceDialogOpen}
              onClose={() => setEvidenceDialogOpen(false)}
              className="max-w-xl"
            >
              <div className="space-y-4">
                <h2 className="text-lg font-medium">
                  Pull from evidence pool
                </h2>
                <p className="text-sm text-text-secondary">
                  Select evidence items to include in your investigation.
                </p>

                {evidenceLoading ? (
                  <div className="space-y-3">
                    <Skeleton variant="text" width="100%" height={20} />
                    <Skeleton variant="text" width="100%" height={20} />
                    <Skeleton variant="text" width="100%" height={20} />
                  </div>
                ) : evidenceItems.length === 0 ? (
                  <p className="py-6 text-center text-sm text-text-tertiary">
                    No evidence items found.
                  </p>
                ) : (
                  <div className="max-h-[360px] space-y-2 overflow-y-auto">
                    {evidenceItems.map((item) => (
                      <label
                        key={item.id}
                        className="flex cursor-pointer items-start gap-3 border border-border-default p-4 hover:border-border-strong"
                      >
                        <input
                          type="checkbox"
                          checked={selectedEvidenceIds.has(item.id)}
                          onChange={() => toggleEvidenceSelection(item.id)}
                          className="mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-text-primary">
                            {item.title}
                          </p>
                          <p className="mt-1 line-clamp-2 text-xs text-text-secondary">
                            {item.content}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setEvidenceDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={confirmEvidenceSelection}
                    disabled={selectedEvidenceIds.size === 0}
                  >
                    Add {selectedEvidenceIds.size} item
                    {selectedEvidenceIds.size !== 1 ? "s" : ""}
                  </Button>
                </div>
              </div>
            </Dialog>
          </div>
        )}

        {/* ========== STEP 2: Cluster Display ========== */}
        {step === 2 && (
          <div>
            {clusterLoading ? (
              <div className="space-y-4">
                <Skeleton variant="text" width={200} height={24} />
                <Skeleton variant="block" width="100%" height={100} />
                <Skeleton variant="block" width="100%" height={100} />
                <Skeleton variant="block" width="100%" height={100} />
              </div>
            ) : (
              <>
                <p className="mb-4 text-sm text-text-secondary">
                  Select one or more theme clusters, then draft a spec.
                </p>

                <div className="space-y-3">
                  {clusters.map((cluster, i) => {
                    const isSelected = selectedClusterIndices.has(i);
                    const isExpanded = expandedClusters.has(i);
                    const feedbackStrings = feedbackItems.map(
                      (f) => f.content
                    );

                    return (
                      <div
                        key={i}
                        onClick={() => toggleClusterSelection(i)}
                        className={`cursor-pointer border p-6 transition-none ${
                          isSelected
                            ? "border-border-strong"
                            : "border-border-default"
                        }`}
                      >
                        <h3 className="text-lg font-medium">{cluster.label}</h3>
                        <p className="mt-1 text-[13px] text-text-secondary">
                          {cluster.summary}
                        </p>

                        {cluster.codeNote && (
                          <div className="mt-2 flex items-start gap-1.5">
                            <Icon
                              icon={Code}
                              size={16}
                              className="mt-0.5 shrink-0 text-[#999]"
                            />
                            <p className="text-[13px] text-text-tertiary">
                              {cluster.codeNote}
                            </p>
                          </div>
                        )}

                        {cluster.existingCode &&
                          cluster.existingCode.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {cluster.existingCode.map((path) => (
                                <Badge key={path} className="text-xs">
                                  {path}
                                </Badge>
                              ))}
                            </div>
                          )}

                        {/* Collapsible feedback items */}
                        <div className="mt-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleClusterExpansion(i);
                            }}
                            className="flex cursor-pointer items-center gap-1 text-xs text-text-tertiary hover:text-text-secondary"
                          >
                            <Icon
                              icon={isExpanded ? ChevronDown : ChevronRight}
                              size={14}
                            />
                            Show {cluster.items.length} item
                            {cluster.items.length !== 1 ? "s" : ""}
                          </button>
                          {isExpanded && (
                            <ul className="mt-2 space-y-1 pl-5">
                              {cluster.items.map((idx) => (
                                <li
                                  key={idx}
                                  className="text-xs text-text-secondary"
                                >
                                  {feedbackStrings[idx] || `Item ${idx}`}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 flex items-center gap-3">
                  <Button
                    variant="primary"
                    onClick={() => draftSpec()}
                    disabled={selectedClusterIndices.size === 0}
                  >
                    Draft spec
                  </Button>
                  <Button variant="ghost" onClick={() => setStep(1)}>
                    Back
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ========== STEP 3: Spec Draft ========== */}
        {step === 3 && (
          <div>
            {/* Streamed spec display */}
            <div className="text-text-primary">
              {specText ? (
                <StreamedMarkdown text={specText} />
              ) : (
                !specStreaming && <p className="text-[15px] text-text-tertiary">No content generated.</p>
              )}
              {specStreaming && (
                <span className="inline-block h-4 w-1 animate-pulse bg-text-primary" />
              )}
            </div>

            {/* Actions below spec */}
            {!specStreaming && specText && (
              <div className="mt-8 flex items-center gap-3">
                <Button variant="primary" onClick={handleCreateSpec}>
                  Create as spec
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setShowRefine(true)}
                >
                  Refine
                </Button>
                <Button variant="ghost" onClick={() => setStep(2)}>
                  Back
                </Button>
              </div>
            )}

            {/* Refinement input */}
            {showRefine && (
              <div className="mt-4 flex items-center gap-2">
                <input
                  type="text"
                  value={refinementText}
                  onChange={(e) => setRefinementText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRefine();
                  }}
                  placeholder="e.g. focus more on enterprise users"
                  className="flex-1 border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-strong focus:outline-none"
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleRefine}
                  disabled={!refinementText.trim()}
                >
                  Regenerate
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
