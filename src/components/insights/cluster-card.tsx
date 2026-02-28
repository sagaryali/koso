"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Pencil, Pin, X } from "lucide-react";
import { Button, Badge, Icon, Skeleton } from "@/components/ui";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { EvidenceCluster, Evidence } from "@/types";
import {
  CRITICALITY_BADGE_COLORS,
  VERDICT_PILL_COLORS,
} from "./constants";

interface LinkedSpec {
  artifactId: string;
  title: string;
}

interface ClusterCardProps {
  id?: string;
  cluster: EvidenceCluster;
  isExpanded: boolean;
  isSelected: boolean;
  linkedSpecs: LinkedSpec[];
  evidenceMap: Record<string, Evidence>;
  onToggleExpand: () => void;
  onToggleSelect: () => void;
  onCreateSpec: () => void;
  onAssess: () => void;
  onClusterUpdated: (updated: EvidenceCluster) => void;
  onDismiss: () => void;
  onRestore: () => void;
  highlightedEvidenceIds?: Set<string> | null;
}

function formatType(type: string) {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ClusterCard({
  id,
  cluster,
  isExpanded,
  isSelected,
  linkedSpecs,
  evidenceMap,
  onToggleExpand,
  onToggleSelect,
  onCreateSpec,
  onAssess,
  onClusterUpdated,
  onDismiss,
  onRestore,
  highlightedEvidenceIds,
}: ClusterCardProps) {
  const router = useRouter();
  const supabase = createClient();

  // Inline rename state
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  // PM note state
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteValue, setNoteValue] = useState("");
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null);

  const displayLabel = cluster.custom_label ?? cluster.label;

  // Focus rename input when entering rename mode
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  // Focus note textarea when entering edit mode
  useEffect(() => {
    if (isEditingNote && noteTextareaRef.current) {
      noteTextareaRef.current.focus();
    }
  }, [isEditingNote]);

  function startRename() {
    setRenameValue(displayLabel);
    setIsRenaming(true);
  }

  async function saveRename() {
    setIsRenaming(false);
    const trimmed = renameValue.trim();
    // If empty or same as original label, clear custom_label
    const newCustomLabel = !trimmed || trimmed === cluster.label ? null : trimmed;
    if (newCustomLabel === cluster.custom_label) return;

    await supabase
      .from("evidence_clusters")
      .update({ custom_label: newCustomLabel })
      .eq("id", cluster.id);

    onClusterUpdated({ ...cluster, custom_label: newCustomLabel });
  }

  function startEditNote() {
    setNoteValue(cluster.pm_note ?? "");
    setIsEditingNote(true);
  }

  async function saveNote() {
    setIsEditingNote(false);
    const trimmed = noteValue.trim();
    const newNote = trimmed || null;
    if (newNote === cluster.pm_note) return;

    await supabase
      .from("evidence_clusters")
      .update({ pm_note: newNote })
      .eq("id", cluster.id);

    onClusterUpdated({ ...cluster, pm_note: newNote });
  }

  async function togglePin() {
    const newPinned = !cluster.pinned;
    await supabase
      .from("evidence_clusters")
      .update({ pinned: newPinned })
      .eq("id", cluster.id);
    onClusterUpdated({ ...cluster, pinned: newPinned });
  }

  return (
    <div
      id={id}
      className={cn(
        "group/card border transition-shadow",
        isSelected ? "border-border-strong" : "border-border-default",
        cluster.dismissed && "opacity-50"
      )}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {/* Checkbox for multi-select */}
              <input
                type="checkbox"
                checked={isSelected}
                onChange={onToggleSelect}
                className="shrink-0 cursor-pointer accent-black"
              />
              {/* Inline rename */}
              {isRenaming ? (
                  <input
                    ref={renameInputRef}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={saveRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveRename();
                      if (e.key === "Escape") setIsRenaming(false);
                    }}
                    className="min-w-0 flex-1 border-b border-border-strong bg-transparent text-sm font-medium text-text-primary outline-none"
                  />
                ) : (
                  <div className="group/rename flex items-center gap-1">
                    <h3 className="text-sm font-medium text-text-primary">
                      {displayLabel}
                    </h3>
                    <button
                      onClick={startRename}
                      className="cursor-pointer text-text-tertiary opacity-0 hover:text-text-secondary group-hover/rename:opacity-100"
                    >
                      <Icon icon={Pencil} size={12} />
                    </button>
                  </div>
                )}
                {/* Criticality badge — always shown */}
                {cluster.criticality_level && (
                  <span
                    className={cn(
                      "px-1.5 py-0.5 text-[10px] font-medium capitalize",
                      CRITICALITY_BADGE_COLORS[cluster.criticality_level]
                    )}
                  >
                    {cluster.criticality_level}
                  </span>
                )}
                {/* Verdict pill */}
                {cluster.verdict && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium",
                      VERDICT_PILL_COLORS[cluster.verdict]
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-1.5 w-1.5 rounded-full",
                        cluster.verdict === "BUILD" && "bg-green-600",
                        cluster.verdict === "MAYBE" && "bg-yellow-600",
                        cluster.verdict === "SKIP" && "bg-gray-500"
                      )}
                    />
                    {cluster.verdict}
                  </span>
                )}
                {/* Spec badge */}
                {linkedSpecs.length > 0 && (
                  <button
                    onClick={() =>
                      router.push(`/editor/${linkedSpecs[0].artifactId}`)
                    }
                    className="cursor-pointer bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-800 hover:bg-blue-200"
                  >
                    Spec created
                  </button>
                )}
              </div>
              {/* Content indented past checkbox (checkbox ~13px + gap 8px ≈ pl-[21px]) */}
              <div className="pl-[21px]">
                <p className="mt-1 text-xs text-text-secondary">
                  {cluster.summary}
                </p>
                {/* PM note */}
                {isEditingNote ? (
                  <textarea
                    ref={noteTextareaRef}
                    value={noteValue}
                    onChange={(e) => setNoteValue(e.target.value)}
                    onBlur={saveNote}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setIsEditingNote(false);
                    }}
                    rows={2}
                    className="mt-2 w-full resize-none border border-border-default bg-transparent px-2 py-1 text-xs text-text-secondary outline-none focus:border-border-strong"
                    placeholder="Add a PM note..."
                  />
                ) : cluster.pm_note ? (
                  <p
                    className="mt-2 cursor-pointer text-xs italic text-text-tertiary hover:text-text-secondary"
                    onClick={startEditNote}
                  >
                    {cluster.pm_note}
                  </p>
                ) : (
                  <button
                    onClick={startEditNote}
                    className="mt-1 cursor-pointer text-xs text-text-tertiary/40 group-hover/card:text-text-tertiary hover:text-text-secondary"
                  >
                    + note
                  </button>
                )}
              </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Tooltip content={cluster.pinned ? "Unpin" : "Pin to top"}>
              <button
                onClick={togglePin}
                className={cn(
                  "cursor-pointer",
                  cluster.pinned
                    ? "text-text-primary"
                    : "text-text-tertiary hover:text-text-secondary"
                )}
              >
                <Icon icon={Pin} size={14} className={cluster.pinned ? "rotate-45" : ""} />
              </button>
            </Tooltip>
            <Button variant="ghost" size="sm" onClick={onAssess}>
              Deep dive
            </Button>
            <Button variant="secondary" size="sm" onClick={onCreateSpec}>
              Create spec
            </Button>
            {cluster.dismissed ? (
              <button
                onClick={onRestore}
                className="cursor-pointer text-xs text-text-tertiary hover:text-text-primary"
              >
                Restore
              </button>
            ) : (
              <Tooltip content="Dismiss">
                <button
                  onClick={onDismiss}
                  className="cursor-pointer text-text-tertiary hover:text-text-secondary"
                >
                  <Icon icon={X} size={14} />
                </button>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Expand/collapse */}
        <button
          onClick={onToggleExpand}
          className="mt-3 flex cursor-pointer items-center gap-1 pl-[21px] text-xs text-text-tertiary hover:text-text-secondary"
        >
          <Icon icon={isExpanded ? ChevronDown : ChevronRight} size={14} />
          {isExpanded ? "Hide" : "Show"} evidence ({cluster.evidence_count})
        </button>
      </div>

      {/* Expanded evidence list */}
      {(isExpanded || (highlightedEvidenceIds && highlightedEvidenceIds.size > 0)) && (
        <div className="border-t border-border-default bg-bg-secondary px-4 py-3">
          <div className="space-y-2">
            {[...cluster.evidence_ids]
              .sort((a, b) => {
                // Sort highlighted evidence to the top
                if (!highlightedEvidenceIds) return 0;
                const aMatch = highlightedEvidenceIds.has(a) ? 0 : 1;
                const bMatch = highlightedEvidenceIds.has(b) ? 0 : 1;
                return aMatch - bMatch;
              })
              .map((eid) => {
              const evidence = evidenceMap[eid];
              const isHighlighted = highlightedEvidenceIds?.has(eid);

              // When search is active, show non-highlighted items dimmed
              if (highlightedEvidenceIds && !isExpanded && !isHighlighted) return null;

              if (!evidence) {
                return (
                  <div key={eid} className="py-1">
                    <Skeleton variant="text" width="80%" />
                  </div>
                );
              }
              return (
                <div
                  key={eid}
                  className={cn(
                    "py-1",
                    highlightedEvidenceIds && !isHighlighted && "opacity-40"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Badge>{formatType(evidence.type)}</Badge>
                    <span className="text-xs font-medium text-text-primary">
                      {evidence.title}
                    </span>
                    {isHighlighted && (
                      <span className="text-[10px] text-text-tertiary">match</span>
                    )}
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
}
