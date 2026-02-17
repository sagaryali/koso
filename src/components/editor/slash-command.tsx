"use client";

import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { DecorationSet } from "@tiptap/pm/view";
import { type Editor } from "@tiptap/react";
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Code,
  Quote,
  type LucideIcon,
} from "lucide-react";
import { Icon } from "@/components/ui";
import { cn } from "@/lib/utils";

interface SlashCommandItem {
  title: string;
  icon: LucideIcon;
  command: (editor: Editor) => void;
}

const SLASH_ITEMS: SlashCommandItem[] = [
  {
    title: "Heading 1",
    icon: Heading1,
    command: (editor) =>
      editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    title: "Heading 2",
    icon: Heading2,
    command: (editor) =>
      editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    title: "Heading 3",
    icon: Heading3,
    command: (editor) =>
      editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    title: "Bullet List",
    icon: List,
    command: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    title: "Numbered List",
    icon: ListOrdered,
    command: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    title: "Task List",
    icon: ListTodo,
    command: (editor) => editor.chain().focus().toggleTaskList().run(),
  },
  {
    title: "Code Block",
    icon: Code,
    command: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    title: "Blockquote",
    icon: Quote,
    command: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
];

const pluginKey = new PluginKey("slashCommand");

export const SlashCommand = Extension.create({
  name: "slashCommand",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: pluginKey,
        state: {
          init() {
            return { active: false, query: "", from: 0 };
          },
          apply(tr, prev) {
            const meta = tr.getMeta(pluginKey);
            if (meta) return meta;

            // If the document changed while active, check if slash is still there
            if (prev.active && tr.docChanged) {
              const { from } = prev;
              const $pos = tr.doc.resolve(
                Math.min(from, tr.doc.content.size)
              );
              const textBefore = $pos.parent.textBetween(
                0,
                $pos.parentOffset,
                undefined,
                "\ufffc"
              );

              // Find the last slash in the text
              const slashIndex = textBefore.lastIndexOf("/");
              if (slashIndex === -1) {
                return { active: false, query: "", from: 0 };
              }

              const query = textBefore.slice(slashIndex + 1);
              return { active: true, query, from };
            }

            return prev;
          },
        },
        props: {
          handleKeyDown(view, event) {
            const state = pluginKey.getState(view.state);

            if (event.key === "/" && !state?.active) {
              // Check if we're at start of line or after whitespace
              const { $from } = view.state.selection;
              const textBefore = $from.parent.textBetween(
                0,
                $from.parentOffset,
                undefined,
                "\ufffc"
              );

              if (textBefore.trim() === "") {
                // Delay to let the "/" character be inserted first
                setTimeout(() => {
                  const tr = view.state.tr;
                  tr.setMeta(pluginKey, {
                    active: true,
                    query: "",
                    from: view.state.selection.from,
                  });
                  view.dispatch(tr);
                }, 0);
              }
              return false;
            }

            if (state?.active) {
              if (event.key === "Escape") {
                const tr = view.state.tr;
                tr.setMeta(pluginKey, {
                  active: false,
                  query: "",
                  from: 0,
                });
                view.dispatch(tr);
                return true;
              }

              if (
                event.key === "ArrowDown" ||
                event.key === "ArrowUp" ||
                event.key === "Enter"
              ) {
                // Let the React component handle these
                return false;
              }

              // If backspace would delete the slash, close
              if (event.key === "Backspace") {
                const { $from } = view.state.selection;
                const textBefore = $from.parent.textBetween(
                  0,
                  $from.parentOffset,
                  undefined,
                  "\ufffc"
                );
                const slashIndex = textBefore.lastIndexOf("/");
                if (
                  slashIndex !== -1 &&
                  $from.parentOffset - slashIndex <= 1
                ) {
                  const tr = view.state.tr;
                  tr.setMeta(pluginKey, {
                    active: false,
                    query: "",
                    from: 0,
                  });
                  view.dispatch(tr);
                  return false;
                }
              }

              // Space closes the menu
              if (event.key === " ") {
                const tr = view.state.tr;
                tr.setMeta(pluginKey, {
                  active: false,
                  query: "",
                  from: 0,
                });
                view.dispatch(tr);
                return false;
              }

              // Update query on any other key
              setTimeout(() => {
                const { $from } = view.state.selection;
                const textBefore = $from.parent.textBetween(
                  0,
                  $from.parentOffset,
                  undefined,
                  "\ufffc"
                );
                const slashIndex = textBefore.lastIndexOf("/");
                if (slashIndex === -1) {
                  const tr = view.state.tr;
                  tr.setMeta(pluginKey, {
                    active: false,
                    query: "",
                    from: 0,
                  });
                  view.dispatch(tr);
                  return;
                }
                const query = textBefore.slice(slashIndex + 1);
                const tr = view.state.tr;
                tr.setMeta(pluginKey, {
                  active: true,
                  query,
                  from: state.from,
                });
                view.dispatch(tr);
              }, 0);
            }

            return false;
          },

          decorations(state) {
            const pluginState = pluginKey.getState(state);
            if (!pluginState?.active) return DecorationSet.empty;
            return DecorationSet.empty;
          },
        },
      }),
    ];
  },
});

interface SlashMenuProps {
  editor: Editor;
}

export function SlashMenu({ editor }: SlashMenuProps) {
  const [active, setActive] = useState(false);
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState(0);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  const filtered = SLASH_ITEMS.filter((item) =>
    item.title.toLowerCase().includes(query.toLowerCase())
  );

  // Sync plugin state to React state
  useEffect(() => {
    const updateState = () => {
      const state = pluginKey.getState(editor.state);
      if (!state) return;

      if (state.active !== active) {
        setActive(state.active);
        if (state.active) {
          setFocusedIndex(0);
        }
      }
      if (state.query !== query) {
        setQuery(state.query);
        setFocusedIndex(0);
      }
      if (state.from !== from) {
        setFrom(state.from);
      }
    };

    editor.on("transaction", updateState);
    return () => {
      editor.off("transaction", updateState);
    };
  }, [editor, active, query, from]);

  // Calculate position based on cursor
  useLayoutEffect(() => {
    if (!active) return;

    const { view } = editor;
    const coords = view.coordsAtPos(view.state.selection.from);
    const editorRect = view.dom.closest(".tiptap-wrapper")?.getBoundingClientRect();

    if (editorRect) {
      setPosition({
        top: coords.bottom - editorRect.top + 4,
        left: coords.left - editorRect.left,
      });
    }
  }, [active, editor, query]);

  const selectItem = useCallback(
    (item: SlashCommandItem) => {
      // Delete the slash and query text
      const { state } = editor;
      const { $from } = state.selection;
      const textBefore = $from.parent.textBetween(
        0,
        $from.parentOffset,
        undefined,
        "\ufffc"
      );
      const slashIndex = textBefore.lastIndexOf("/");
      if (slashIndex !== -1) {
        const start = $from.start() + slashIndex;
        const end = $from.pos;
        editor.chain().focus().deleteRange({ from: start, to: end }).run();
      }

      // Execute the command
      item.command(editor);

      // Close the menu
      const tr = editor.view.state.tr;
      tr.setMeta(pluginKey, { active: false, query: "", from: 0 });
      editor.view.dispatch(tr);
    },
    [editor]
  );

  // Handle keyboard navigation inside the editor
  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setFocusedIndex((prev) =>
          prev < filtered.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setFocusedIndex((prev) =>
          prev > 0 ? prev - 1 : filtered.length - 1
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        if (filtered[focusedIndex]) {
          selectItem(filtered[focusedIndex]);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [active, filtered, focusedIndex, selectItem]);

  // Scroll focused item into view
  useEffect(() => {
    if (!menuRef.current) return;
    const items = menuRef.current.querySelectorAll("[data-slash-item]");
    items[focusedIndex]?.scrollIntoView({ block: "nearest" });
  }, [focusedIndex]);

  if (!active || filtered.length === 0) return null;

  return (
    <div
      ref={menuRef}
      className="absolute z-50 w-[220px] border border-border-strong bg-bg-primary py-1 shadow-modal"
      style={{ top: position.top, left: position.left }}
    >
      {filtered.map((item, index) => (
        <button
          key={item.title}
          data-slash-item
          className={cn(
            "flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-sm font-medium text-text-primary transition-none",
            focusedIndex === index && "bg-bg-hover"
          )}
          onMouseDown={(e) => {
            e.preventDefault();
            selectItem(item);
          }}
          onMouseEnter={() => setFocusedIndex(index)}
        >
          <Icon icon={item.icon} className="text-text-tertiary" />
          {item.title}
        </button>
      ))}
    </div>
  );
}
