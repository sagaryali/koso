"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Code, ChevronDown, ChevronRight } from "lucide-react";
import { Button, Badge, Skeleton } from "@/components/ui";
import { Icon } from "@/components/ui/icon";
import { Dialog } from "@/components/ui/dialog";
import { StreamedMarkdown } from "@/components/ui/streamed-markdown";
import { textToTiptap } from "@/lib/text-to-tiptap";
import { createClient } from "@/lib/supabase/client";
import type { Evidence, Workspace } from "@/types";

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

interface FeedbackItem {
  id: string;
  content: string;
  title?: string;
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

// --- Props ---

interface EvidenceFlowProps {
  workspaceId: string;
  workspace: Workspace;
  hasCodebase: boolean;
  codebaseRepoName?: string;
  onComplete: (artifactId: string) => void;
  onCancel: () => void;
}

// --- Component ---

export function EvidenceFlow({
  workspaceId,
  workspace,
  hasCodebase,
  codebaseRepoName,
  onComplete,
  onCancel,
}: EvidenceFlowProps) {
  const router = useRouter();
  const supabase = createClient();

  // Step state
  const [step, setStep] = useState(1);

  // Step 1: Evidence selection
  const [evidenceItems, setEvidenceItems] = useState<Evidence[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(true);
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<Set<string>>(
    new Set()
  );

  // Step 2: Clusters
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [clusterLoading, setClusterLoading] = useState(false);
  const [selectedClusterIndices, setSelectedClusterIndices] = useState<
    Set<number>
  >(new Set());
  const [expandedClusters, setExpandedClusters] = useState<Set<number>>(
    new Set()
  );
  const [codeContext, setCodeContext] = useState<CodeContext | null>(null);

  // Step 3: Spec draft (structured sections)
  const [specText, setSpecText] = useState("");
  const [specSections, setSpecSections] = useState<{ section: string; text: string }[]>([]);
  const [specStreaming, setSpecStreaming] = useState(false);
  const [currentStreamingSection, setCurrentStreamingSection] = useState<string | null>(null);
  const [refiningSectionIndex, setRefiningSectionIndex] = useState<number | null>(null);
  const [sectionRefinementText, setSectionRefinementText] = useState("");
  const [sectionRefineStreaming, setSectionRefineStreaming] = useState(false);
  const specAbortRef = useRef<AbortController | null>(null);

  // Load evidence on mount
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("evidence")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });

      setEvidenceItems(data || []);
      setEvidenceLoading(false);
    }

    load();
  }, [workspaceId]);

  function toggleEvidenceSelection(id: string) {
    setSelectedEvidenceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedEvidenceIds(new Set(evidenceItems.map((e) => e.id)));
  }

  // --- Step 2: Analyze ---

  const analyzeCallback = useCallback(async () => {
    const selected = evidenceItems.filter((e) =>
      selectedEvidenceIds.has(e.id)
    );
    const items: FeedbackItem[] = selected.map((e) => ({
      id: crypto.randomUUID(),
      content: e.content,
      title: e.title,
    }));
    setFeedbackItems(items);

    setStep(2);
    setClusterLoading(true);
    setClusters([]);
    setSelectedClusterIndices(new Set());
    setCodeContext(null);

    const feedbackStrings = items.map((f) => f.content);

    // Fetch code context in parallel if available
    let fetchedCodeContext: CodeContext | null = null;

    if (hasCodebase) {
      const [searchRes, archRes] = await Promise.all([
        fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: feedbackStrings.join(" ").slice(0, 1000),
            workspaceId,
            sourceTypes: ["codebase_module"],
            grouped: true,
          }),
        }).catch(() => null),
        supabase
          .from("artifacts")
          .select("content")
          .eq("workspace_id", workspaceId)
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
        throw new Error(
          errBody.error || `Cluster request failed (${res.status})`
        );
      }

      const data = await res.json();
      setClusters(data.clusters || []);
    } catch (err) {
      console.error("[evidence-flow] Cluster error:", err);
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
  }, [evidenceItems, selectedEvidenceIds, hasCodebase, workspaceId, supabase]);

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
      setStep(3);
      setSpecText("");
      setSpecSections([]);
      setSpecStreaming(true);
      setCurrentStreamingSection(null);
      setRefiningSectionIndex(null);

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

        // Try structured endpoint first, fall back to plain draft
        const res = await fetch("/api/ai/draft-structured-spec", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error("Draft-spec request failed");

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        const sections: { section: string; text: string }[] = [];

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
                if (parsed.section && parsed.text) {
                  // Structured section response
                  sections.push({ section: parsed.section, text: parsed.text });
                  setSpecSections([...sections]);
                  setCurrentStreamingSection(parsed.section);
                  // Also build full text for fallback
                  const fullText = sections
                    .map((s) => `## ${s.section}\n\n${s.text}`)
                    .join("\n\n");
                  setSpecText(fullText);
                } else if (parsed.text) {
                  // Plain text chunk (fallback)
                  setSpecText((prev) => prev + parsed.text);
                }
                if (parsed.error) throw new Error(parsed.error);
              } catch (e) {
                if (e instanceof SyntaxError) continue;
                throw e;
              }
            }
          }
        }

        setSpecStreaming(false);
        setCurrentStreamingSection(null);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("[evidence-flow] Draft-spec error:", err);
        setSpecStreaming(false);
        setCurrentStreamingSection(null);
      }
    },
    [workspace, feedbackItems, clusters, selectedClusterIndices, codeContext]
  );

  async function handleCreateSpec() {
    if (specSections.length === 0 && !specText.trim()) return;

    // Build structured TipTap document from sections
    let content;
    if (specSections.length > 0) {
      const nodes: { type: string; attrs?: Record<string, unknown>; content?: { type: string; text: string }[] }[] = [];
      for (const section of specSections) {
        nodes.push({
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: section.section }],
        });
        const paragraphs = section.text.trim().split("\n\n").filter(Boolean);
        for (const para of paragraphs) {
          if (para.startsWith("### ")) {
            nodes.push({
              type: "heading",
              attrs: { level: 3 },
              content: [{ type: "text", text: para.slice(4) }],
            });
          } else {
            nodes.push({
              type: "paragraph",
              content: [{ type: "text", text: para }],
            });
          }
        }
      }
      content = { type: "doc", content: nodes };
    } else {
      content = textToTiptap(specText);
    }

    // Derive title from first theme
    const firstTheme = clusters.find((_, i) => selectedClusterIndices.has(i));
    const title = firstTheme ? firstTheme.label : "Untitled Spec";

    const { data: artifact } = await supabase
      .from("artifacts")
      .insert({
        workspace_id: workspaceId,
        type: "prd",
        title,
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

      onComplete(artifact.id);
      router.push(`/editor/${artifact.id}`);
    }
  }

  const refineSingleSection = useCallback(
    async (sectionIndex: number, refinement: string) => {
      if (!refinement.trim()) return;
      setSectionRefineStreaming(true);
      setCurrentStreamingSection(specSections[sectionIndex]?.section ?? null);

      const feedbackStrings = feedbackItems.map((f) => f.content);
      const selectedThemes = clusters
        .filter((_, i) => selectedClusterIndices.has(i))
        .map((cluster) => ({
          label: cluster.label,
          summary: cluster.summary,
          feedback: cluster.items.map((idx) => feedbackStrings[idx] || ""),
        }));

      try {
        const res = await fetch("/api/ai/draft-structured-spec", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            themes: selectedThemes,
            product: {
              name: workspace.name,
              description: workspace.product_description,
              principles: workspace.principles,
            },
            codeContext: codeContext || undefined,
            targetSection: specSections[sectionIndex].section,
            existingSections: specSections,
            refinement,
          }),
        });

        if (!res.ok) throw new Error("Refinement request failed");

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();

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
                if (parsed.section && parsed.text) {
                  setSpecSections((prev) => {
                    const updated = [...prev];
                    const idx = updated.findIndex((s) => s.section === parsed.section);
                    if (idx >= 0) {
                      updated[idx] = { section: parsed.section, text: parsed.text };
                    }
                    return updated;
                  });
                  // Update full text
                  setSpecSections((prev) => {
                    const fullText = prev.map((s) => `## ${s.section}\n\n${s.text}`).join("\n\n");
                    setSpecText(fullText);
                    return prev;
                  });
                }
                if (parsed.error) throw new Error(parsed.error);
              } catch (e) {
                if (e instanceof SyntaxError) continue;
                throw e;
              }
            }
          }
        }
      } catch (err) {
        console.error("[evidence-flow] Section refine error:", err);
      } finally {
        setSectionRefineStreaming(false);
        setCurrentStreamingSection(null);
        setRefiningSectionIndex(null);
        setSectionRefinementText("");
      }
    },
    [workspace, feedbackItems, clusters, selectedClusterIndices, codeContext, specSections]
  );

  // --- Render ---

  return (
    <div className="space-y-5">
      {/* Step indicators */}
      <div className="flex items-center gap-2 text-xs text-text-tertiary">
        <span
          className={step === 1 ? "font-medium text-text-primary" : ""}
        >
          1. Select
        </span>
        <span>—</span>
        <span
          className={step === 2 ? "font-medium text-text-primary" : ""}
        >
          2. Cluster
        </span>
        <span>—</span>
        <span
          className={step === 3 ? "font-medium text-text-primary" : ""}
        >
          3. Draft
        </span>
      </div>

      {/* ========== STEP 1: Select Evidence ========== */}
      {step === 1 && (
        <div>
          <p className="text-sm text-text-secondary">
            Select evidence items to include in your investigation.
          </p>

          {evidenceLoading ? (
            <div className="mt-4 space-y-3">
              <Skeleton variant="text" width="100%" height={20} />
              <Skeleton variant="text" width="100%" height={20} />
              <Skeleton variant="text" width="100%" height={20} />
            </div>
          ) : evidenceItems.length === 0 ? (
            <p className="mt-4 py-6 text-center text-sm text-text-tertiary">
              No evidence items found. Add some evidence first.
            </p>
          ) : (
            <>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-text-tertiary">
                  {selectedEvidenceIds.size} of {evidenceItems.length} selected
                </span>
                <button
                  onClick={selectAll}
                  className="cursor-pointer text-xs text-text-secondary hover:text-text-primary"
                >
                  Select all
                </button>
              </div>

              <div className="mt-2 max-h-[320px] space-y-2 overflow-y-auto">
                {evidenceItems.map((item) => (
                  <label
                    key={item.id}
                    className="flex cursor-pointer items-start gap-3 border border-border-default p-3 hover:border-border-strong"
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

              {/* Code context banner */}
              {hasCodebase && codebaseRepoName && (
                <div className="mt-3 flex items-center gap-2 text-[13px] text-text-tertiary">
                  <Icon icon={Code} size={16} className="text-[#999]" />
                  <span>
                    Code context from {codebaseRepoName} will be used to ground
                    the analysis
                  </span>
                </div>
              )}

              <div className="mt-4 flex items-center gap-3">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={analyzeCallback}
                  disabled={selectedEvidenceIds.size === 0}
                >
                  Analyze
                </Button>
                <Button variant="ghost" size="sm" onClick={onCancel}>
                  Cancel
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========== STEP 2: Cluster Display ========== */}
      {step === 2 && (
        <div>
          {clusterLoading ? (
            <div className="space-y-4">
              <Skeleton variant="text" width={200} height={24} />
              <Skeleton variant="block" width="100%" height={80} />
              <Skeleton variant="block" width="100%" height={80} />
            </div>
          ) : (
            <>
              <p className="mb-3 text-sm text-text-secondary">
                Select one or more theme clusters, then draft a spec.
              </p>

              <div className="max-h-[300px] space-y-2 overflow-y-auto">
                {clusters.map((cluster, i) => {
                  const isSelected = selectedClusterIndices.has(i);
                  const isExpanded = expandedClusters.has(i);
                  const feedbackStrings = feedbackItems.map((f) => f.content);

                  return (
                    <div
                      key={i}
                      onClick={() => toggleClusterSelection(i)}
                      className={`cursor-pointer border p-4 transition-none ${
                        isSelected
                          ? "border-border-strong"
                          : "border-border-default"
                      }`}
                    >
                      <h3 className="text-sm font-medium">{cluster.label}</h3>
                      <p className="mt-1 text-xs text-text-secondary">
                        {cluster.summary}
                      </p>

                      {cluster.codeNote && (
                        <div className="mt-2 flex items-start gap-1.5">
                          <Icon
                            icon={Code}
                            size={14}
                            className="mt-0.5 shrink-0 text-[#999]"
                          />
                          <p className="text-xs text-text-tertiary">
                            {cluster.codeNote}
                          </p>
                        </div>
                      )}

                      {cluster.existingCode &&
                        cluster.existingCode.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {cluster.existingCode.map((path) => (
                              <Badge key={path} className="text-[10px]">
                                {path}
                              </Badge>
                            ))}
                          </div>
                        )}

                      <div className="mt-2">
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
                          {cluster.items.length} item
                          {cluster.items.length !== 1 ? "s" : ""}
                        </button>
                        {isExpanded && (
                          <ul className="mt-1 space-y-1 pl-5">
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

              <div className="mt-4 flex items-center gap-3">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => draftSpec()}
                  disabled={selectedClusterIndices.size === 0}
                >
                  Draft spec
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
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
          <div className="max-h-[400px] space-y-4 overflow-y-auto">
            {specSections.length > 0 ? (
              specSections.map((section, i) => {
                const isSectionStreaming =
                  (specStreaming && currentStreamingSection === section.section) ||
                  (sectionRefineStreaming && currentStreamingSection === section.section);
                const isRefining = refiningSectionIndex === i;

                return (
                  <div
                    key={section.section}
                    className="border-b border-border-default pb-4 last:border-0"
                  >
                    <h3 className="text-sm font-semibold text-text-primary">
                      {section.section}
                    </h3>
                    <div className="mt-2 text-sm text-text-secondary">
                      <StreamedMarkdown text={section.text} />
                      {isSectionStreaming && (
                        <span className="inline-block h-4 w-1 animate-pulse bg-text-primary" />
                      )}
                    </div>
                    {!specStreaming && !sectionRefineStreaming && !isRefining && (
                      <button
                        onClick={() => {
                          setRefiningSectionIndex(i);
                          setSectionRefinementText("");
                        }}
                        className="mt-2 cursor-pointer text-xs text-text-tertiary hover:text-text-secondary"
                      >
                        Refine
                      </button>
                    )}
                    {isRefining && !sectionRefineStreaming && (
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="text"
                          value={sectionRefinementText}
                          onChange={(e) => setSectionRefinementText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && sectionRefinementText.trim()) {
                              refineSingleSection(i, sectionRefinementText.trim());
                            }
                          }}
                          placeholder={`e.g. add more detail about...`}
                          className="flex-1 border border-border-default bg-bg-primary px-2 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-border-strong focus:outline-none"
                          autoFocus
                        />
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => refineSingleSection(i, sectionRefinementText.trim())}
                          disabled={!sectionRefinementText.trim()}
                        >
                          Refine
                        </Button>
                        <button
                          onClick={() => setRefiningSectionIndex(null)}
                          className="cursor-pointer text-xs text-text-tertiary hover:text-text-secondary"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            ) : specText ? (
              <div className="text-text-primary">
                <StreamedMarkdown text={specText} />
              </div>
            ) : !specStreaming ? (
              <p className="text-[15px] text-text-tertiary">
                No content generated.
              </p>
            ) : null}

            {/* Streaming indicator for sections not yet started */}
            {specStreaming && (
              <div className="flex items-center gap-2 py-2 text-xs text-text-tertiary">
                <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-text-tertiary" />
                {currentStreamingSection
                  ? `Writing ${currentStreamingSection}...`
                  : "Preparing draft..."}
              </div>
            )}
          </div>

          {!specStreaming && !sectionRefineStreaming && (specSections.length > 0 || specText) && (
            <div className="mt-5 flex items-center gap-3">
              <Button variant="primary" size="sm" onClick={handleCreateSpec}>
                Create as spec
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => draftSpec()}
              >
                Regenerate all
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setStep(2)}>
                Back
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
