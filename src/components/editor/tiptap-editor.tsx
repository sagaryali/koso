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

interface TiptapEditorProps {
  content: Record<string, unknown>;
  onSave: (content: Record<string, unknown>) => void;
  onSaveStatusChange: (status: "saving" | "saved" | "idle") => void;
  onTextChange?: (sectionText: string) => void;
  onReady?: (fullText: string) => void;
  onEditorInstance?: (editor: Editor) => void;
}

function extractCurrentSection(editor: Editor): string {
  const { from } = editor.state.selection;
  const doc = editor.state.doc;

  const headingPositions: number[] = [];
  doc.forEach((node, offset) => {
    if (node.type.name === "heading") {
      headingPositions.push(offset);
    }
  });

  if (headingPositions.length === 0) {
    const text = editor.getText();
    const words = text.split(/\s+/).filter(Boolean);
    return words.slice(-200).join(" ");
  }

  let sectionStart = 0;
  let sectionEnd = doc.content.size;

  for (let i = 0; i < headingPositions.length; i++) {
    if (headingPositions[i] <= from) {
      sectionStart = headingPositions[i];
      sectionEnd =
        i + 1 < headingPositions.length
          ? headingPositions[i + 1]
          : doc.content.size;
    }
  }

  return doc.textBetween(sectionStart, sectionEnd, "\n", " ").trim();
}

export function TiptapEditor({
  content,
  onSave,
  onSaveStatusChange,
  onTextChange,
  onReady,
  onEditorInstance,
}: TiptapEditorProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentInitialized = useRef(false);
  const initializingRef = useRef(false);
  const onTextChangeRef = useRef(onTextChange);
  const onReadyRef = useRef(onReady);
  const onEditorInstanceRef = useRef(onEditorInstance);

  useEffect(() => {
    onTextChangeRef.current = onTextChange;
  }, [onTextChange]);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    onEditorInstanceRef.current = onEditorInstance;
  }, [onEditorInstance]);

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
        const sectionText = extractCurrentSection(editor);
        onTextChangeRef.current(sectionText);
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
