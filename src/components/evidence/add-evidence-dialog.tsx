"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Upload, FileText, Image as ImageIcon } from "lucide-react";
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

type Mode = "single" | "bulk" | "file";

const ACCEPTED_FILE_TYPES = "image/png,image/jpeg,image/gif,image/webp,application/pdf,text/csv,text/plain";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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

  // File mode state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileUploading, setFileUploading] = useState(false);
  const [fileExtractedText, setFileExtractedText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setSelectedFile(null);
      setFileUploading(false);
      setFileExtractedText("");
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

    // Embed this evidence, then check for similar artifacts
    try {
      await fetch("/api/embeddings/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: data.id, sourceType: "evidence" }),
      });
    } catch (err) {
      console.log("[embeddings] Background indexing failed:", err);
    }

    // Fire-and-forget: trigger cluster recomputation
    fetch("/api/clusters/compute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId }),
    }).catch(() => {});

    // Auto-link to similar artifacts (embedding is now ready)
    try {
      const linkRes = await fetch("/api/links/auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: data.id,
          sourceType: "evidence",
          workspaceId,
        }),
      });

      if (linkRes.ok) {
        const { linksCreated } = await linkRes.json();
        if (linksCreated > 0) {
          toast({
            message: `Added to evidence pool. Linked to ${linksCreated} spec${linksCreated !== 1 ? "s" : ""}.`,
          });
        } else {
          toast({ message: "Added to evidence pool" });
        }
      } else {
        toast({ message: "Added to evidence pool" });
      }
    } catch {
      toast({ message: "Added to evidence pool" });
    }

    setSaving(false);
    onCreated?.(data.id);
    onClose();
  }

  // ── File mode save ─────────────────────────────────────────────
  async function handleFileSave() {
    if (!selectedFile) return;
    setFileUploading(true);

    try {
      // Upload file to Supabase Storage
      const fileExt = selectedFile.name.split(".").pop();
      const filePath = `${workspaceId}/${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("evidence-files")
        .upload(filePath, selectedFile);

      if (uploadError) {
        toast({ message: "File upload failed" });
        setFileUploading(false);
        return;
      }

      // Get a signed URL (works for private buckets)
      const { data: urlData, error: urlError } = await supabase.storage
        .from("evidence-files")
        .createSignedUrl(filePath, 600); // 10 min expiry

      if (urlError || !urlData?.signedUrl) {
        toast({ message: "Failed to get file URL" });
        setFileUploading(false);
        return;
      }

      const fileUrl = urlData.signedUrl;

      // Extract text from file
      let extractedText = "";
      let fileContent = "";

      // For text/csv files, read content directly
      if (
        selectedFile.type === "text/plain" ||
        selectedFile.type === "text/csv"
      ) {
        fileContent = await selectedFile.text();
      }

      const extractRes = await fetch("/api/evidence/extract-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileUrl,
          fileType: selectedFile.type,
          fileContent,
        }),
      });

      if (extractRes.ok) {
        const { extractedText: text } = await extractRes.json();
        extractedText = text;
      }

      setFileExtractedText(extractedText);

      // Create evidence record
      const evidenceTitle =
        title.trim() || selectedFile.name.replace(/\.[^.]+$/, "");
      const evidenceContent = extractedText || `[File: ${selectedFile.name}]`;

      const { data, error } = await supabase
        .from("evidence")
        .insert({
          workspace_id: workspaceId,
          type,
          title: evidenceTitle,
          content: evidenceContent,
          source: source.trim() || null,
          tags,
          file_url: fileUrl,
          file_name: selectedFile.name,
          file_type: selectedFile.type,
          file_size: selectedFile.size,
          extracted_text: extractedText || null,
        })
        .select("id")
        .single();

      if (error || !data) {
        toast({ message: "Failed to save evidence" });
        setFileUploading(false);
        return;
      }

      // Embed the evidence
      try {
        await fetch("/api/embeddings/index", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceId: data.id, sourceType: "evidence" }),
        });
      } catch {
        // Silent fail
      }

      // Auto-link
      try {
        const linkRes = await fetch("/api/links/auto", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceId: data.id,
            sourceType: "evidence",
            workspaceId,
          }),
        });

        if (linkRes.ok) {
          const { linksCreated } = await linkRes.json();
          if (linksCreated > 0) {
            toast({
              message: `File uploaded. Linked to ${linksCreated} spec${linksCreated !== 1 ? "s" : ""}.`,
            });
          } else {
            toast({ message: "File uploaded to evidence pool" });
          }
        } else {
          toast({ message: "File uploaded to evidence pool" });
        }
      } catch {
        toast({ message: "File uploaded to evidence pool" });
      }

      setFileUploading(false);
      setSaving(false);
      onCreated?.(data.id);
      onClose();
    } catch (err) {
      console.error("[evidence] File upload failed:", err);
      toast({ message: "Failed to process file" });
      setFileUploading(false);
    }
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
            {(["single", "bulk", "file"] as const).map((m, i) => (
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
                {m === "single" ? "Single" : m === "bulk" ? "Bulk Import" : "File"}
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

        {/* ── File mode ──────────────────────────────────────── */}
        {mode === "file" && (
          <>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_FILE_TYPES}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setSelectedFile(file);
                    setFileExtractedText("");
                  }
                }}
              />
              {!selectedFile ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full cursor-pointer flex-col items-center gap-3 border-2 border-dashed border-border-default px-6 py-10 hover:border-border-strong"
                >
                  <Icon icon={Upload} className="text-text-tertiary" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-text-primary">
                      Click to upload a file
                    </p>
                    <p className="mt-1 text-xs text-text-tertiary">
                      Images, PDFs, CSVs, or text files (up to 50MB)
                    </p>
                  </div>
                </button>
              ) : (
                <div className="flex items-center gap-3 border border-border-default p-4">
                  <Icon
                    icon={
                      selectedFile.type.startsWith("image/")
                        ? ImageIcon
                        : FileText
                    }
                    className="shrink-0 text-text-tertiary"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-text-tertiary">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setFileExtractedText("");
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="cursor-pointer text-text-tertiary hover:text-text-primary"
                  >
                    <Icon icon={X} size={16} />
                  </button>
                </div>
              )}
            </div>

            {selectedFile && (
              <>
                <Input
                  label="Title"
                  placeholder="Brief title for this evidence"
                  value={title || selectedFile.name.replace(/\.[^.]+$/, "")}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <Input
                  label="Source (optional)"
                  placeholder="e.g., Customer screenshot, PDF report"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                />
              </>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleFileSave}
                disabled={!selectedFile || saving || fileUploading}
              >
                {fileUploading
                  ? "Processing..."
                  : saving
                    ? "Saving..."
                    : "Upload & Save"}
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
