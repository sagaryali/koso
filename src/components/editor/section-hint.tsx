"use client";

import { useState, useLayoutEffect, useRef } from "react";
import type { Editor } from "@tiptap/core";
import { Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui";

interface SectionHintProps {
  editor: Editor;
  insightCount: number;
  currentSectionName: string | null;
  onOpenPanel: () => void;
}

export function SectionHint({
  editor,
  insightCount,
  currentSectionName,
  onOpenPanel,
}: SectionHintProps) {
  const [position, setPosition] = useState({ top: 0 });
  const [visible, setVisible] = useState(false);
  const prevSectionRef = useRef<string | null>(null);

  const shouldShow = insightCount > 0 && currentSectionName !== null;

  // Position below the current section heading
  useLayoutEffect(() => {
    if (!shouldShow) {
      setVisible(false);
      return;
    }

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
          top: coords.bottom - editorRect.top + 4,
        });
      }
    };

    updatePosition();

    // Only re-animate when section changes
    if (currentSectionName !== prevSectionRef.current) {
      prevSectionRef.current = currentSectionName;
      setVisible(false);
      requestAnimationFrame(() => setVisible(true));
    }
  }, [shouldShow, editor, currentSectionName]);

  if (!shouldShow) return null;

  return (
    <div
      className={cn(
        "absolute left-0 right-0 z-50 transition-opacity duration-150",
        visible ? "opacity-100" : "opacity-0"
      )}
      style={{ top: position.top }}
    >
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onOpenPanel();
        }}
        className="relative inline-flex cursor-pointer items-center gap-1.5 border-none bg-bg-primary py-1 pr-2 text-[11px] text-text-tertiary hover:text-text-secondary"
      >
        <Icon icon={Lightbulb} size={12} />
        <span>
          {insightCount} {insightCount === 1 ? "insight" : "insights"} for this
          section
        </span>
        <span className="text-[10px]">&rarr;</span>
      </button>
    </div>
  );
}
