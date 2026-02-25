"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";
import { Button, Input, TextArea, Badge, Dialog } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { Icon } from "@/components/ui/icon";
import { FeedbackList } from "@/components/evidence/feedback-list";
import { parseFeedback, type FeedbackItem } from "@/lib/parse-feedback";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { EvidenceType } from "@/types";

const EVIDENCE_TYPES: { label: string; value: EvidenceType }[] = [
  { label: "Feedback", value: "feedback" },
  { label: "Metric", value: "metric" },
  { label: "Research", value: "research" },
  { label: "Meeting Note", value: "meeting_note" },
];

type Mode = "single" | "bulk";

interface AddEvidenceDialogProps {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  onCreated?: (evidenceId: string) => void;
  prefillContent?: string;
  prefillSource?: string;
  mini?: boolean;
}

export function AddEvidenceDialog({
  open,
  onClose,
  workspaceId,
  onCreated,
  prefillContent,
  prefillSource,
  mini,
}: AddEvidenceDialogProps) {
  const [mode, setMode] = useState<Mode>("single");
  const [type, setType] = useState<EvidenceType>("feedback");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [source, setSource] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Bulk mode state
  const [bulkRaw, setBulkRaw] = useState("");
  const [bulkItems, setBulkItems] = useState<FeedbackItem[]>([]);
  const [bulkParsed, setBulkParsed] = useState(false);

  const supabase = createClient();
  const tagInputRef = useRef<HTMLInputElement>(null);

  // Reset form when opening
  useEffect(() => {
    if (open) {
      setMode("single");
      setType("feedback");
      setTitle("");
      setContent(prefillContent ?? "");
      setSource(prefillSource ?? "");
      setTags([]);
      setTagInput("");
      setBulkRaw("");
      setBulkItems([]);
      setBulkParsed(false);
    }
  }, [open, prefillContent, prefillSource]);

  // Fetch existing tags for auto-suggest
  useEffect(() => {
    if (!open || !workspaceId) return;

    async function fetchTags() {
      const { data } = await supabase
        .from("evidence")
        .select("tags")
        .eq("workspace_id", workspaceId);

      if (data) {
        const allTags = new Set<string>();
        for (const row of data) {
          for (const tag of row.tags ?? []) {
            allTags.add(tag);
          }
        }
        setTagSuggestions(Array.from(allTags).sort());
      }
    }

    fetchTags();
  }, [open, workspaceId]);

  const filteredSuggestions = tagInput.trim()
    ? tagSuggestions.filter(
        (s) =>
          s.toLowerCase().includes(tagInput.toLowerCase()) &&
          !tags.includes(s)
      )
    : [];

  const addTag = useCallback(
    (tag: string) => {
      const trimmed = tag.trim().toLowerCase();
      if (trimmed && !tags.includes(trimmed)) {
        setTags((prev) => [...prev, trimmed]);
      }
      setTagInput("");
    },
    [tags]
  );

  const removeTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  // ── Single mode save ────────────────────────────────────────────
  async function handleSave() {
    if (!content.trim()) return;
    setSaving(true);

    const evidenceTitle = title.trim() || content.trim().slice(0, 60);

    const { data, error } = await supabase
      .from("evidence")
      .insert({
        workspace_id: workspaceId,
        type,
        title: evidenceTitle,
        content: content.trim(),
        source: source.trim() || null,
        tags,
      })
      .select("id")
      .single();

    if (error || !data) {
      setSaving(false);
      return;
    }

    // Fire-and-forget: embed this evidence
    fetch("/api/embeddings/index", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceId: data.id, sourceType: "evidence" }),
    }).catch((err) =>
      console.log("[embeddings] Background indexing failed:", err)
    );

    // Fire-and-forget: trigger cluster recomputation
    fetch("/api/clusters/compute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId }),
    }).catch(() => {});

    // Check for similar artifacts
    checkSimilarArtifacts(data.id, content.trim());

    setSaving(false);
    onCreated?.(data.id);
    onClose();
  }

  async function checkSimilarArtifacts(evidenceId: string, text: string) {
    try {
      // Wait briefly for the embedding to be created
      await new Promise((r) => setTimeout(r, 2000));

      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: text.slice(0, 500),
          workspaceId,
          sourceTypes: ["artifact"],
          limit: 3,
        }),
      });

      if (!res.ok) return;
      const { results } = await res.json();

      if (results && results.length > 0) {
        const topMatch = results[0];
        if (topMatch.similarity > 0.8) {
          const artifactTitle =
            (topMatch.metadata?.title as string) || "an artifact";

          toast({
            message: `This seems related to "${artifactTitle}"`,
            action: {
              label: "Link it",
              onClick: () => linkEvidence(evidenceId, topMatch.sourceId),
            },
            duration: 8000,
          });
        }
      }
    } catch {
      // Silent fail — similarity check is optional
    }
  }

  async function linkEvidence(evidenceId: string, artifactId: string) {
    await supabase.from("links").insert({
      workspace_id: workspaceId,
      source_id: evidenceId,
      source_type: "evidence",
      target_id: artifactId,
      target_type: "artifact",
      relationship: "related_to",
    });
    toast({ message: "Linked successfully" });
  }

  // ── Bulk mode handlers ──────────────────────────────────────────
  function handleParseBulk() {
    const items = parseFeedback(bulkRaw);
    setBulkItems(items);
    setBulkParsed(true);

    // Fire-and-forget: generate AI titles
    items.forEach((item) => {
      fetch("/api/ai/title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: item.content }),
      })
        .then((res) => res.json())
        .then(({ title: aiTitle }) => {
          if (aiTitle) {
            setBulkItems((prev) =>
              prev.map((fi) =>
                fi.id === item.id ? { ...fi, title: aiTitle } : fi
              )
            );
          }
        })
        .catch(() => {});
    });
  }

  function handleUpdateBulkItem(id: string, updatedContent: string) {
    setBulkItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, content: updatedContent } : item
      )
    );
  }

  function handleRemoveBulkItem(id: string) {
    setBulkItems((prev) => prev.filter((item) => item.id !== id));
  }

  async function handleSaveBulk() {
    if (bulkItems.length === 0) return;
    setSaving(true);

    let firstId: string | null = null;
    const sourceVal = source.trim() || null;

    for (const item of bulkItems) {
      const evidenceTitle = item.title || item.content.slice(0, 60);

      const { data } = await supabase
        .from("evidence")
        .insert({
          workspace_id: workspaceId,
          type,
          title: evidenceTitle,
          content: item.content,
          source: sourceVal,
          tags,
        })
        .select("id")
        .single();

      if (data?.id) {
        if (!firstId) firstId = data.id;

        // Fire-and-forget: embed
        fetch("/api/embeddings/index", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceId: data.id,
            sourceType: "evidence",
          }),
        }).catch(() => {});
      }
    }

    // Fire-and-forget: trigger cluster recomputation
    fetch("/api/clusters/compute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId }),
    }).catch(() => {});

    toast({
      message: `Added ${bulkItems.length} items to evidence pool`,
    });

    setSaving(false);
    if (firstId) onCreated?.(firstId);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      className={mini ? "max-w-md" : "max-w-lg"}
    >
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-bold tracking-tight">
            {mini ? "Save as Evidence" : "Add Evidence"}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            {mini
              ? "Save this text to your evidence pool."
              : "Add feedback, metrics, research, or meeting notes."}
          </p>
        </div>

        {/* Mode toggle (hidden in mini mode) */}
        {!mini && (
          <div className="flex border border-border-default">
            {(["single", "bulk"] as const).map((m, i) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "flex-1 cursor-pointer px-3 py-2 text-sm font-medium transition-none",
                  i > 0 && "border-l border-border-default",
                  mode === m
                    ? "bg-bg-inverse text-text-inverse"
                    : "bg-bg-primary text-text-primary hover:bg-bg-hover"
                )}
              >
                {m === "single" ? "Single" : "Bulk Import"}
              </button>
            ))}
          </div>
        )}

        {/* Type selector */}
        <div>
          <label className="mb-2 block text-sm font-medium">Type</label>
          <div className="flex border border-border-default">
            {EVIDENCE_TYPES.map((et, i) => (
              <button
                key={et.value}
                onClick={() => setType(et.value)}
                className={cn(
                  "flex-1 cursor-pointer px-3 py-2 text-sm font-medium transition-none",
                  i > 0 && "border-l border-border-default",
                  type === et.value
                    ? "bg-bg-inverse text-text-inverse"
                    : "bg-bg-primary text-text-primary hover:bg-bg-hover"
                )}
              >
                {et.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Single mode ──────────────────────────────────────── */}
        {mode === "single" && (
          <>
            <Input
              label="Title"
              placeholder="Brief title for this evidence"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <TextArea
              label="Content"
              placeholder="Paste or type the evidence content..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <Input
              label="Source (optional)"
              placeholder="e.g., Customer interview, Support ticket #1234"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />

            {/* Tags */}
            <div>
              <label className="mb-2 block text-sm font-medium">Tags</label>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <Badge key={tag} className="gap-1">
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      className="cursor-pointer opacity-60 hover:opacity-100"
                      aria-label={`Remove tag ${tag}`}
                    >
                      <Icon icon={X} size={12} />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="relative mt-2">
                <input
                  ref={tagInputRef}
                  type="text"
                  placeholder="Type and press Enter to add a tag"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && tagInput.trim()) {
                      e.preventDefault();
                      addTag(tagInput);
                    }
                  }}
                  className="h-10 w-full border border-border-default bg-bg-primary px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-strong focus:outline-none"
                />
                {filteredSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 z-10 mt-1 w-full border border-border-default bg-bg-primary shadow-sm">
                    {filteredSuggestions.slice(0, 5).map((s) => (
                      <button
                        key={s}
                        onClick={() => addTag(s)}
                        className="block w-full cursor-pointer px-3 py-2 text-left text-sm hover:bg-bg-hover"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!content.trim() || saving}
              >
                {saving ? "Saving..." : "Save Evidence"}
              </Button>
            </div>
          </>
        )}

        {/* ── Bulk mode ────────────────────────────────────────── */}
        {mode === "bulk" && (
          <>
            {!bulkParsed ? (
              <>
                <TextArea
                  label="Paste multiple items"
                  placeholder="Paste feedback from Slack, email, surveys, support tickets... We'll split them into individual items."
                  value={bulkRaw}
                  onChange={(e) => setBulkRaw(e.target.value)}
                  className="min-h-[200px] max-h-[200px]"
                />
                <Input
                  label="Source (optional)"
                  placeholder="e.g., Slack #feedback channel, Q4 survey"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                />
                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="secondary" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleParseBulk}
                    disabled={!bulkRaw.trim()}
                  >
                    Process
                  </Button>
                </div>
              </>
            ) : (
              <>
                <FeedbackList
                  items={bulkItems}
                  onUpdateItem={handleUpdateBulkItem}
                  onRemoveItem={handleRemoveBulkItem}
                />
                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setBulkParsed(false);
                      setBulkItems([]);
                    }}
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleSaveBulk}
                    disabled={bulkItems.length === 0 || saving}
                  >
                    {saving
                      ? "Saving..."
                      : `Save ${bulkItems.length} ${bulkItems.length === 1 ? "Item" : "Items"}`}
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
