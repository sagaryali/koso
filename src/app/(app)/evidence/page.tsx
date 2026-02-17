"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Plus, Link as LinkIcon, X, Pencil, Trash2 } from "lucide-react";
import {
  Button,
  Badge,
  Dialog,
  Input,
  TextArea,
  Icon,
  Skeleton,
} from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { AddEvidenceDialog } from "@/components/evidence/add-evidence-dialog";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { useTourTrigger } from "@/hooks/use-tour-trigger";
import { EVIDENCE_TOUR } from "@/lib/tours";
import type { Evidence, EvidenceType } from "@/types";

type FilterType = "all" | EvidenceType;

const FILTERS: { label: string; value: FilterType }[] = [
  { label: "All", value: "all" },
  { label: "Feedback", value: "feedback" },
  { label: "Metric", value: "metric" },
  { label: "Research", value: "research" },
  { label: "Meeting Note", value: "meeting_note" },
];

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatType(type: string) {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface LinkedArtifact {
  id: string;
  title: string;
}

interface EvidenceWithLinks extends Evidence {
  linkedArtifacts?: LinkedArtifact[];
}

export default function EvidencePage() {
  const [evidence, setEvidence] = useState<EvidenceWithLinks[]>([]);
  const { workspace } = useWorkspace();
  const workspaceId = workspace?.id ?? "";

  useTourTrigger("evidence", EVIDENCE_TOUR, 800);

  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<EvidenceWithLinks[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [detailEvidence, setDetailEvidence] = useState<EvidenceWithLinks | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editSource, setEditSource] = useState("");

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supabase = createClient();

  useEffect(() => {
    document.title = "Koso — Evidence";
  }, []);

  // Load evidence
  useEffect(() => {
    if (!workspaceId) return;

    async function load() {
      const { data: evidenceData } = await supabase
        .from("evidence")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });

      if (evidenceData) {
        const enriched = await enrichWithLinks(evidenceData, workspaceId);
        setEvidence(enriched);
      }

      setLoading(false);
    }

    load();
  }, [workspaceId]);

  async function enrichWithLinks(
    items: Evidence[],
    wsId: string
  ): Promise<EvidenceWithLinks[]> {
    const ids = items.map((e) => e.id);
    if (ids.length === 0) return items;

    const { data: links } = await supabase
      .from("links")
      .select("source_id, target_id, target_type")
      .eq("workspace_id", wsId)
      .eq("source_type", "evidence")
      .in("source_id", ids);

    if (!links || links.length === 0) return items;

    const artifactIds = [
      ...new Set(
        links
          .filter((l) => l.target_type === "artifact")
          .map((l) => l.target_id)
      ),
    ];

    let artifactMap = new Map<string, string>();
    if (artifactIds.length > 0) {
      const { data: artifacts } = await supabase
        .from("artifacts")
        .select("id, title")
        .in("id", artifactIds);

      if (artifacts) {
        artifactMap = new Map(artifacts.map((a) => [a.id, a.title]));
      }
    }

    const linksByEvidence = new Map<string, LinkedArtifact[]>();
    for (const link of links) {
      if (link.target_type === "artifact") {
        const existing = linksByEvidence.get(link.source_id) ?? [];
        const artTitle = artifactMap.get(link.target_id);
        if (artTitle) {
          existing.push({ id: link.target_id, title: artTitle });
        }
        linksByEvidence.set(link.source_id, existing);
      }
    }

    return items.map((e) => ({
      ...e,
      linkedArtifacts: linksByEvidence.get(e.id) ?? [],
    }));
  }

  // Semantic search with debounce
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);

      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }

      if (!value.trim()) {
        setSearchResults(null);
        setSearching(false);
        return;
      }

      setSearching(true);
      searchDebounceRef.current = setTimeout(() => {
        performSearch(value.trim());
      }, 500);
    },
    [workspaceId]
  );

  async function performSearch(query: string) {
    if (!workspaceId) return;

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          workspaceId,
          sourceTypes: ["evidence"],
          limit: 20,
        }),
      });

      if (!res.ok) {
        setSearching(false);
        return;
      }

      const { results } = await res.json();

      // Get unique evidence IDs from search results
      const evidenceIds = [
        ...new Set((results ?? []).map((r: { sourceId: string }) => r.sourceId)),
      ] as string[];

      if (evidenceIds.length === 0) {
        setSearchResults([]);
        setSearching(false);
        return;
      }

      // Fetch full evidence records in order
      const { data } = await supabase
        .from("evidence")
        .select("*")
        .in("id", evidenceIds);

      if (data) {
        // Maintain search order
        const map = new Map(data.map((e) => [e.id, e]));
        const ordered = evidenceIds
          .map((id) => map.get(id))
          .filter(Boolean) as Evidence[];
        const enriched = await enrichWithLinks(ordered, workspaceId);
        setSearchResults(enriched);
      }
    } catch {
      // Silent fail
    }
    setSearching(false);
  }

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && searchQuery.trim()) {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
      setSearching(true);
      performSearch(searchQuery.trim());
    }
  }

  // Apply filter to display list
  const displayList = searchResults ?? evidence;
  const filteredList =
    filter === "all"
      ? displayList
      : displayList.filter((e) => e.type === filter);

  // Handle evidence creation
  function handleEvidenceCreated() {
    // Re-fetch evidence list
    async function reload() {
      if (!workspaceId) return;
      const { data } = await supabase
        .from("evidence")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });

      if (data) {
        const enriched = await enrichWithLinks(data, workspaceId);
        setEvidence(enriched);
      }
    }
    reload();
  }

  // Edit / delete handlers
  async function handleSaveEdit() {
    if (!detailEvidence) return;

    await supabase
      .from("evidence")
      .update({
        title: editTitle.trim(),
        content: editContent.trim(),
        source: editSource.trim() || null,
      })
      .eq("id", detailEvidence.id);

    // Update local state
    const updated = {
      ...detailEvidence,
      title: editTitle.trim(),
      content: editContent.trim(),
      source: editSource.trim() || null,
    };
    setDetailEvidence(updated);
    setEvidence((prev) =>
      prev.map((e) => (e.id === updated.id ? { ...e, ...updated } : e))
    );
    setEditMode(false);

    // Re-embed
    fetch("/api/embeddings/index", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceId: detailEvidence.id,
        sourceType: "evidence",
      }),
    }).catch(() => {});
  }

  async function handleDelete() {
    if (!detailEvidence) return;

    await supabase.from("evidence").delete().eq("id", detailEvidence.id);
    setEvidence((prev) => prev.filter((e) => e.id !== detailEvidence.id));
    setDetailEvidence(null);
    toast({ message: "Evidence deleted" });
  }

  if (loading) {
    return (
      <div className="px-12 py-10 page-transition">
        <Skeleton variant="text" width={200} height={36} />
        <div className="mt-1">
          <Skeleton variant="text" width={300} />
        </div>
        <div className="mt-8">
          <Skeleton variant="block" height={40} />
        </div>
        <div className="mt-4 border border-border-default">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className={cn(
                "px-5 py-4",
                i > 0 && "border-t border-border-default"
              )}
            >
              <div className="flex items-center gap-2">
                <Skeleton variant="text" width={70} />
                <Skeleton variant="text" width="40%" />
              </div>
              <div className="mt-2">
                <Skeleton variant="text" width="80%" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-12 py-10 page-transition">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Evidence Pool</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Feedback, metrics, research, and notes — your product truth.
          </p>
        </div>
        <Button icon={Plus} onClick={() => setAddOpen(true)} data-tour="evidence-add">
          Add Evidence
        </Button>
      </div>

      {/* Search */}
      <div className="relative mt-8" data-tour="evidence-search">
        <Icon
          icon={Search}
          className="absolute top-3 left-3 text-text-tertiary"
        />
        <input
          type="text"
          placeholder="Search evidence semantically..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          className="h-10 w-full border border-border-default bg-bg-primary pl-10 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-strong focus:outline-none"
        />
        {searching && (
          <div className="absolute top-3 right-3">
            <div className="h-4 w-4 animate-spin border border-border-default border-t-border-strong" />
          </div>
        )}
      </div>

      {/* Filter toggles */}
      <div className="mt-4 flex border border-border-default w-fit" data-tour="evidence-filters">
        {FILTERS.map((f, i) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "cursor-pointer px-4 py-2 text-sm font-medium transition-none",
              i > 0 && "border-l border-border-default",
              filter === f.value
                ? "bg-bg-inverse text-text-inverse"
                : "bg-bg-primary text-text-primary hover:bg-bg-hover"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Evidence count */}
      <div className="mt-6 text-xs text-text-tertiary">
        {filteredList.length} {filteredList.length === 1 ? "item" : "items"}
        {searchResults !== null && " found"}
        {filter !== "all" && ` in ${formatType(filter)}`}
      </div>

      {/* Evidence list */}
      {filteredList.length === 0 ? (
        <div className="mt-4 flex flex-col items-center border border-border-default py-12">
          <p className="text-sm text-text-tertiary">
            {searchResults !== null
              ? "No evidence matches your search. Try different terms or add new evidence."
              : "Add customer feedback, metrics, or research notes to build your product knowledge base"}
          </p>
          {searchResults === null && (
            <Button variant="primary" size="sm" className="mt-4" onClick={() => setAddOpen(true)}>
              Add Evidence
            </Button>
          )}
        </div>
      ) : (
        <div className="mt-2 border border-border-default">
          {filteredList.map((item, i) => (
            <button
              key={item.id}
              onClick={() => {
                setDetailEvidence(item);
                setEditMode(false);
              }}
              className={cn(
                "flex w-full cursor-pointer items-start justify-between gap-4 px-5 py-4 text-left transition-none hover:bg-bg-hover",
                i > 0 && "border-t border-border-default"
              )}
            >
              {/* Left */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge className="text-[11px]">
                    {formatType(item.type)}
                  </Badge>
                  <span className="truncate text-sm font-medium">
                    {item.title}
                  </span>
                </div>
                <p
                  className={cn(
                    "mt-1.5 line-clamp-2 text-[13px] text-text-secondary",
                    item.type === "feedback" && "italic"
                  )}
                >
                  {item.content}
                </p>
                {item.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {item.tags.map((tag) => (
                      <Badge
                        key={tag}
                        className="text-[11px] px-1.5 py-0.5"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Right */}
              <div className="shrink-0 text-right">
                <div className="text-xs text-text-tertiary">
                  {formatDate(item.created_at)}
                </div>
                {item.linkedArtifacts && item.linkedArtifacts.length > 0 && (
                  <div className="mt-1.5 flex items-center gap-1 text-[11px] text-text-tertiary">
                    <Icon icon={LinkIcon} size={11} />
                    <span className="max-w-[140px] truncate">
                      {item.linkedArtifacts[0].title}
                    </span>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Add Evidence Dialog */}
      <AddEvidenceDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        workspaceId={workspaceId}
        onCreated={handleEvidenceCreated}
      />

      {/* Detail Dialog */}
      <Dialog
        open={!!detailEvidence}
        onClose={() => {
          setDetailEvidence(null);
          setEditMode(false);
        }}
        className="max-w-xl"
      >
        {detailEvidence && (
          <div className="space-y-4">
            {editMode ? (
              <>
                <Input
                  label="Title"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
                <TextArea
                  label="Content"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                />
                <Input
                  label="Source"
                  value={editSource}
                  onChange={(e) => setEditSource(e.target.value)}
                />
                <div className="flex justify-end gap-3">
                  <Button
                    variant="secondary"
                    onClick={() => setEditMode(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSaveEdit}>Save</Button>
                </div>
              </>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-start justify-between gap-4 pr-8">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge>{formatType(detailEvidence.type)}</Badge>
                      <span className="text-xs text-text-tertiary">
                        {formatDate(detailEvidence.created_at)}
                      </span>
                    </div>
                    <h3 className="mt-2 text-lg font-bold tracking-tight">
                      {detailEvidence.title}
                    </h3>
                  </div>
                </div>

                {/* Content */}
                <p
                  className={cn(
                    "whitespace-pre-wrap text-sm text-text-primary leading-relaxed",
                    detailEvidence.type === "feedback" && "italic"
                  )}
                >
                  {detailEvidence.content}
                </p>

                {/* Source */}
                {detailEvidence.source && (
                  <div className="text-sm">
                    <span className="font-medium">Source:</span>{" "}
                    <span className="text-text-secondary">
                      {detailEvidence.source}
                    </span>
                  </div>
                )}

                {/* Tags */}
                {detailEvidence.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {detailEvidence.tags.map((tag) => (
                      <Badge key={tag}>{tag}</Badge>
                    ))}
                  </div>
                )}

                {/* Linked artifacts */}
                {detailEvidence.linkedArtifacts &&
                  detailEvidence.linkedArtifacts.length > 0 && (
                    <div>
                      <div className="text-[11px] font-medium uppercase tracking-caps text-text-tertiary">
                        Linked Artifacts
                      </div>
                      <div className="mt-1.5 space-y-1">
                        {detailEvidence.linkedArtifacts.map((a) => (
                          <div
                            key={a.id}
                            className="flex items-center gap-1.5 text-sm text-text-secondary"
                          >
                            <Icon
                              icon={LinkIcon}
                              size={12}
                              className="text-text-tertiary"
                            />
                            {a.title}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Actions */}
                <div className="flex gap-2 border-t border-border-default pt-4">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={Pencil}
                    onClick={() => {
                      setEditTitle(detailEvidence.title);
                      setEditContent(detailEvidence.content);
                      setEditSource(detailEvidence.source ?? "");
                      setEditMode(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Trash2}
                    onClick={handleDelete}
                    className="text-state-error hover:bg-red-50"
                  >
                    Delete
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
