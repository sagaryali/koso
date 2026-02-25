"use client";

import { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import type { Editor } from "@tiptap/core";
import type { EvidenceNudge } from "@/hooks/use-evidence-nudges";
import { cn } from "@/lib/utils";

interface InlineNudgeProps {
  editor: Editor;
  nudges: EvidenceNudge[];
  isSectionThin: boolean;
  currentSectionName: string | null;
}

export function InlineNudge({
  editor,
  nudges,
  isSectionThin,
  currentSectionName,
}: InlineNudgeProps) {
  const [position, setPosition] = useState({ top: 0 });
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [visible, setVisible] = useState(false);

  const isDismissed = currentSectionName
    ? dismissed.has(currentSectionName)
    : false;

  const shouldShow =
    isSectionThin && nudges.length > 0 && !isDismissed;

  // Position below the current section heading
  useLayoutEffect(() => {
    if (!shouldShow) return;

    const updatePosition = () => {
      const { view } = editor;
      const { from } = view.state.selection;
      const doc = view.state.doc;

      // Find the heading node that starts the current section
      let headingPos = 0;
      doc.forEach((node, offset) => {
        if (node.type.name === "heading" && offset <= from) {
          headingPos = offset;
        }
      });

      // Position below the heading
      const headingNode = doc.nodeAt(headingPos);
      const targetPos = headingNode
        ? headingPos + headingNode.nodeSize
        : from;

      const coords = view.coordsAtPos(
        Math.min(targetPos, doc.content.size)
      );
      const editorRect = view.dom
        .closest(".tiptap-wrapper")
        ?.getBoundingClientRect();

      if (editorRect) {
        setPosition({
          top: coords.bottom - editorRect.top + 8,
        });
      }
    };

    updatePosition();

    editor.on("selectionUpdate", updatePosition);
    return () => {
      editor.off("selectionUpdate", updatePosition);
    };
  }, [shouldShow, editor, currentSectionName]);

  // Animate in when becoming visible; reset on hide via cleanup
  const prevShouldShowRef = useRef(false);
  useEffect(() => {
    if (!shouldShow) return;
    // Reset visibility on fresh show
    if (!prevShouldShowRef.current) {
      prevShouldShowRef.current = true;
    }
    const timer = setTimeout(() => setVisible(true), 50);
    return () => {
      clearTimeout(timer);
      prevShouldShowRef.current = false;
      setVisible(false);
    };
  }, [shouldShow]);

  const handleDismiss = useCallback(() => {
    if (currentSectionName) {
      setDismissed((prev) => new Set(prev).add(currentSectionName));
    }
  }, [currentSectionName]);

  if (!shouldShow) return null;

  return (
    <div
      className={cn(
        "absolute left-0 right-0 z-40 border border-border-default bg-bg-primary shadow-modal transition-opacity duration-200",
        visible ? "opacity-100" : "opacity-0"
      )}
      style={{ top: position.top }}
    >
      <div className="px-4 py-3 space-y-2.5">
        {nudges.map((nudge) => (
          <div key={nudge.id} className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-text-tertiary">
                {nudge.evidenceCount} {nudge.evidenceCount === 1 ? "signal" : "signals"}
              </span>
              <span className="text-[13px] font-medium text-text-primary">
                {nudge.label}
              </span>
            </div>
            <p className="text-xs text-text-secondary">{nudge.summary}</p>
          </div>
        ))}
        <button
          onClick={handleDismiss}
          className="cursor-pointer border-none bg-transparent p-0 text-[11px] text-text-tertiary hover:text-text-primary"
        >
          &times; dismiss
        </button>
      </div>
    </div>
  );
}
