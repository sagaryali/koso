"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Heading from "@tiptap/extension-heading";
import Link from "@tiptap/extension-link";
import { useEffect, useRef, useCallback } from "react";
import { SlashCommand, SlashMenu } from "./slash-command";
import { SectionHintExtension } from "./section-hint-extension";

interface TiptapEditorProps {
  content: Record<string, unknown>;
  onSave: (content: Record<string, unknown>) => void;
  onSaveStatusChange: (status: "saving" | "saved" | "idle") => void;
  onTextChange?: (sectionText: string, sectionName: string | null) => void;
  onSectionChange?: (sectionText: string, sectionName: string | null) => void;
  onReady?: (fullText: string) => void;
  onEditorInstance?: (editor: Editor) => void;
  onSectionNameChange?: (name: string | null) => void;
  insightCount?: number;
  onOpenPanel?: () => void;
  briefing?: { suggestedTopics: string[]; summary: string; inconsistencies: string[] } | null;
  onDraftSection?: () => void;
}

function extractCumulativeContext(editor: Editor): string {
  const { from } = editor.state.selection;
  const doc = editor.state.doc;

  const headingPositions: number[] = [];
  doc.forEach((node, offset) => {
    if (node.type.name === "heading") {
      headingPositions.push(offset);
    }
  });

  if (headingPositions.length === 0) {
    // No headings — return full text
    const text = editor.getText();
    const words = text.split(/\s+/).filter(Boolean);
    return words.slice(-200).join(" ");
  }

  // Find the end of the current section (all text from doc start through current section)
  let sectionEnd = doc.content.size;
  for (let i = 0; i < headingPositions.length; i++) {
    if (headingPositions[i] <= from) {
      sectionEnd =
        i + 1 < headingPositions.length
          ? headingPositions[i + 1]
          : doc.content.size;
    }
  }

  return doc.textBetween(0, sectionEnd, "\n", " ").trim();
}

function extractCurrentSectionName(editor: Editor): string | null {
  const { from } = editor.state.selection;
  const doc = editor.state.doc;
  let lastHeading: string | null = null;
  doc.forEach((node, offset) => {
    if (node.type.name === "heading" && offset <= from) {
      lastHeading = node.textContent;
    }
  });
  return lastHeading;
}

export function TiptapEditor({
  content,
  onSave,
  onSaveStatusChange,
  onTextChange,
  onSectionChange,
  onReady,
  onEditorInstance,
  onSectionNameChange,
  insightCount,
  onOpenPanel,
  briefing,
  onDraftSection,
}: TiptapEditorProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentInitialized = useRef(false);
  const initializingRef = useRef(false);
  const onTextChangeRef = useRef(onTextChange);
  const onSectionChangeRef = useRef(onSectionChange);
  const onReadyRef = useRef(onReady);
  const onEditorInstanceRef = useRef(onEditorInstance);
  const onSectionNameChangeRef = useRef(onSectionNameChange);
  const lastSectionNameRef = useRef<string | null>(null);

  useEffect(() => {
    onTextChangeRef.current = onTextChange;
  }, [onTextChange]);

  useEffect(() => {
    onSectionChangeRef.current = onSectionChange;
  }, [onSectionChange]);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    onEditorInstanceRef.current = onEditorInstance;
  }, [onEditorInstance]);

  useEffect(() => {
    onSectionNameChangeRef.current = onSectionNameChange;
  }, [onSectionNameChange]);

  const save = useCallback(
    (json: Record<string, unknown>) => {
      onSaveStatusChange("saving");
      onSave(json);
      // The parent will call onSaveStatusChange("saved") after the actual save
    },
    [onSave, onSaveStatusChange]
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false, // We use the standalone Heading extension
      }),
      Heading.configure({
        levels: [1, 2, 3],
      }),
      Placeholder.configure({
        placeholder: "Start writing your spec...",
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-text-primary underline underline-offset-2",
        },
      }),
      SlashCommand,
      SectionHintExtension,
    ],
    content: Object.keys(content).length > 0 ? content : undefined,
    editorProps: {
      attributes: {
        class: "tiptap-editor outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        const json = editor.getJSON();
        save(json as Record<string, unknown>);
      }, 2000);

      // Fire section text change for context panel (skip during initial setContent)
      if (!initializingRef.current && onTextChangeRef.current) {
        const cumulativeText = extractCumulativeContext(editor);
        const sectionName = extractCurrentSectionName(editor);
        onTextChangeRef.current(cumulativeText, sectionName);
        onSectionNameChangeRef.current?.(sectionName);
        lastSectionNameRef.current = sectionName;
      }
    },
    onSelectionUpdate: ({ editor }) => {
      if (initializingRef.current) return;

      const sectionName = extractCurrentSectionName(editor);
      onSectionNameChangeRef.current?.(sectionName);

      // When cursor moves to a different section, fire immediate context refresh
      if (sectionName !== lastSectionNameRef.current) {
        lastSectionNameRef.current = sectionName;
        const cumulativeText = extractCumulativeContext(editor);
        if (onSectionChangeRef.current) {
          onSectionChangeRef.current(cumulativeText, sectionName);
        }
      }
    },
  });

  // Set content when it loads from server (only once)
  useEffect(() => {
    if (
      editor &&
      !contentInitialized.current &&
      Object.keys(content).length > 0
    ) {
      initializingRef.current = true;
      editor.commands.setContent(content);
      initializingRef.current = false;
      contentInitialized.current = true;

      if (onReadyRef.current) {
        onReadyRef.current(editor.getText());
      }
      if (onEditorInstanceRef.current) {
        onEditorInstanceRef.current(editor);
      }
    }
  }, [editor, content]);

  // Sync insightCount, onOpenPanel, briefing, and onDraftSection to extension storage
  useEffect(() => {
    if (!editor) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const storage = (editor.storage as any).sectionHint as
      | {
          insightCount: number;
          onOpenPanel: () => void;
          briefing: { suggestedTopics: string[]; summary: string; inconsistencies: string[] } | null;
          onDraftSection: () => void;
        }
      | undefined;
    if (!storage) return;
    storage.insightCount = insightCount ?? 0;
    storage.onOpenPanel = onOpenPanel ?? (() => {});
    storage.briefing = briefing ?? null;
    storage.onDraftSection = onDraftSection ?? (() => {});
    // Dispatch an empty transaction to force decoration recalculation
    editor.view.dispatch(editor.state.tr);
  }, [editor, insightCount, onOpenPanel, briefing, onDraftSection]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Manual save on Cmd+S
  useEffect(() => {
    if (!editor) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
          debounceRef.current = null;
        }
        const json = editor.getJSON();
        save(json as Record<string, unknown>);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editor, save]);

  if (!editor) return null;

  return (
    <div className="tiptap-wrapper relative">
      <EditorContent editor={editor} />
      <SlashMenu editor={editor} />
    </div>
  );
}
