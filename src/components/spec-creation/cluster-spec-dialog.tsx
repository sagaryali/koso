"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button, Badge, Skeleton } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { StreamedMarkdown } from "@/components/ui/streamed-markdown";
import { sectionsToTiptapDoc } from "@/lib/sections-to-tiptap";
import { textToTiptap } from "@/lib/text-to-tiptap";
import { createClient } from "@/lib/supabase/client";
import type { EvidenceCluster, Workspace } from "@/types";

const CRITICALITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800",
  high: "bg-orange-100 text-orange-800",
  medium: "bg-yellow-100 text-yellow-800",
  low: "bg-green-100 text-green-800",
};

interface ClusterSpecDialogProps {
  open: boolean;
  onClose: () => void;
  clusters: EvidenceCluster[];
  workspace: Workspace;
}

export function ClusterSpecDialog({
  open,
  onClose,
  clusters,
  workspace,
}: ClusterSpecDialogProps) {
  const router = useRouter();
  const supabase = createClient();

  const [phase, setPhase] = useState<"review" | "drafting">("review");
  const [specSections, setSpecSections] = useState<
    { section: string; text: string }[]
  >([]);
  const [specText, setSpecText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [currentSection, setCurrentSection] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const title =
    clusters.length === 1
      ? clusters[0].label
      : `${clusters[0]?.label} + ${clusters.length - 1} more`;

  const handleClose = useCallback(() => {
    abortRef.current?.abort();
    setPhase("review");
    setSpecSections([]);
    setSpecText("");
    setStreaming(false);
    setCurrentSection(null);
    onClose();
  }, [onClose]);

  const handleDraft = useCallback(async () => {
    setPhase("drafting");
    setSpecSections([]);
    setSpecText("");
    setStreaming(true);
    setCurrentSection(null);

    // Fetch evidence content for selected clusters
    const allEvidenceIds = clusters.flatMap((c) => c.evidence_ids);
    const uniqueIds = [...new Set(allEvidenceIds)];

    const { data: evidenceItems } = await supabase
      .from("evidence")
      .select("id, content, title")
      .in("id", uniqueIds);

    const evidenceById = new Map(
      (evidenceItems ?? []).map((e: { id: string; content: string; title: string }) => [e.id, e])
    );

    // Build themes payload matching the draft-structured-spec API
    const themes = clusters.map((cluster) => ({
      label: cluster.label,
      summary: cluster.summary,
      feedback: cluster.evidence_ids
        .map((id) => {
          const e = evidenceById.get(id);
          return e ? e.content : "";
        })
        .filter(Boolean),
    }));

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch("/api/ai/draft-structured-spec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          themes,
          product: {
            name: workspace.name,
            description: workspace.product_description,
            principles: workspace.principles,
          },
        }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error("Draft request failed");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      const sections: { section: string; text: string }[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.section && parsed.text) {
                sections.push({ section: parsed.section, text: parsed.text });
                setSpecSections([...sections]);
                setCurrentSection(parsed.section);
                const fullText = sections
                  .map((s) => `## ${s.section}\n\n${s.text}`)
                  .join("\n\n");
                setSpecText(fullText);
              } else if (parsed.text) {
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

      setStreaming(false);
      setCurrentSection(null);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("[cluster-spec-dialog] Draft error:", err);
      setStreaming(false);
      setCurrentSection(null);
    }
  }, [clusters, workspace, supabase]);

  const handleCreate = useCallback(async () => {
    if (specSections.length === 0 && !specText.trim()) return;
    setSaving(true);

    const content =
      specSections.length > 0
        ? sectionsToTiptapDoc(specSections)
        : textToTiptap(specText);

    const { data: artifact } = await supabase
      .from("artifacts")
      .insert({
        workspace_id: workspace.id,
        type: "prd",
        title,
        content,
        status: "draft",
      })
      .select("id")
      .single();

    if (artifact) {
      fetch("/api/embeddings/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: artifact.id,
          sourceType: "artifact",
        }),
      }).catch(() => {});

      handleClose();
      router.push(`/editor/${artifact.id}`);
    }

    setSaving(false);
  }, [specSections, specText, workspace, title, supabase, router, handleClose]);

  return (
    <Dialog open={open} onClose={handleClose} className="max-w-xl">
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>

      {phase === "review" && (
        <div className="mt-4">
          <p className="text-sm text-text-secondary">
            {clusters.length === 1
              ? "This theme will be used to draft a spec."
              : `${clusters.length} themes will be combined into one spec.`}
          </p>

          <div className="mt-4 max-h-[320px] space-y-2 overflow-y-auto">
            {clusters.map((cluster) => (
              <div
                key={cluster.id}
                className="border border-border-default p-3"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text-primary">
                    {cluster.label}
                  </span>
                  <Badge>{cluster.evidence_count} items</Badge>
                  {cluster.criticality_level && (
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-medium ${CRITICALITY_COLORS[cluster.criticality_level]}`}
                    >
                      {cluster.criticality_level}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-text-secondary">
                  {cluster.summary}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-center gap-3">
            <Button variant="primary" size="sm" onClick={handleDraft}>
              Draft spec
            </Button>
            <Button variant="ghost" size="sm" onClick={handleClose}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {phase === "drafting" && (
        <div className="mt-4">
          <div className="max-h-[400px] space-y-4 overflow-y-auto">
            {specSections.length > 0 ? (
              specSections.map((section) => {
                const isSectionStreaming =
                  streaming && currentSection === section.section;
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
                  </div>
                );
              })
            ) : specText ? (
              <div className="text-text-primary">
                <StreamedMarkdown text={specText} />
              </div>
            ) : null}

            {streaming && (
              <div className="flex items-center gap-2 py-2 text-xs text-text-tertiary">
                <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-text-tertiary" />
                {currentSection
                  ? `Writing ${currentSection}...`
                  : "Preparing draft..."}
              </div>
            )}
          </div>

          {!streaming && (specSections.length > 0 || specText) && (
            <div className="mt-5 flex items-center gap-3">
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreate}
                disabled={saving}
              >
                {saving ? "Creating..." : "Create as spec"}
              </Button>
              <Button variant="secondary" size="sm" onClick={handleDraft}>
                Regenerate
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPhase("review")}
              >
                Back
              </Button>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
