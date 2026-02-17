"use client";

import { useEffect, useCallback } from "react";

export interface ShortcutDef {
  key: string;
  label: string;
  description: string;
  meta?: boolean;
  shift?: boolean;
}

export const SHORTCUTS: ShortcutDef[] = [
  { key: "k", label: "\u2318K", description: "Command palette", meta: true },
  { key: ".", label: "\u2318.", description: "Toggle context panel", meta: true },
  { key: "n", label: "\u2318N", description: "New artifact", meta: true },
  { key: "e", label: "\u2318E", description: "Quick-add evidence", meta: true },
  { key: "/", label: "\u2318/", description: "Toggle sidebar", meta: true },
  { key: "E", label: "\u2318\u21E7E", description: "Save selection as evidence", meta: true, shift: true },
  { key: "?", label: "\u2318?", description: "Show keyboard shortcuts", meta: true, shift: true },
];

interface ShortcutHandlers {
  onCommandPalette?: () => void;
  onTogglePanel?: () => void;
  onNewArtifact?: () => void;
  onQuickEvidence?: () => void;
  onToggleSidebar?: () => void;
  onSaveAsEvidence?: () => void;
  onShowShortcuts?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;

      // Don't intercept shortcuts when typing in inputs (except our specific shortcuts)
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      if (e.key === "k") {
        e.preventDefault();
        handlers.onCommandPalette?.();
        return;
      }

      if (e.key === ".") {
        e.preventDefault();
        handlers.onTogglePanel?.();
        return;
      }

      if (e.key === "/" && !e.shiftKey) {
        e.preventDefault();
        handlers.onToggleSidebar?.();
        return;
      }

      // Shift shortcuts
      if (e.shiftKey) {
        if (e.key === "E") {
          e.preventDefault();
          handlers.onSaveAsEvidence?.();
          return;
        }
        if (e.key === "?") {
          e.preventDefault();
          handlers.onShowShortcuts?.();
          return;
        }
      }

      // Skip remaining shortcuts if focused on an input
      if (isInput) return;

      if (e.key === "n") {
        e.preventDefault();
        handlers.onNewArtifact?.();
        return;
      }

      if (e.key === "e" && !e.shiftKey) {
        e.preventDefault();
        handlers.onQuickEvidence?.();
        return;
      }
    },
    [handlers]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
