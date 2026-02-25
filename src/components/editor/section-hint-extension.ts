import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export const sectionHintPluginKey = new PluginKey("sectionHint");

export const SectionHintExtension = Extension.create({
  name: "sectionHint",

  addStorage() {
    return {
      insightCount: 0,
      onOpenPanel: (() => {}) as () => void,
    };
  },

  addProseMirrorPlugins() {
    const storage = this.storage;

    return [
      new Plugin({
        key: sectionHintPluginKey,
        props: {
          decorations: (state) => {
            const { insightCount, onOpenPanel } = storage;
            if (insightCount <= 0) return DecorationSet.empty;

            const { from } = state.selection;
            const doc = state.doc;

            // Find the heading at or before the cursor
            let targetHeadingPos: number | null = null;
            doc.forEach((node, offset) => {
              if (node.type.name === "heading" && offset <= from) {
                targetHeadingPos = offset;
              }
            });

            if (targetHeadingPos === null) return DecorationSet.empty;

            const headingNode = doc.nodeAt(targetHeadingPos);
            if (!headingNode) return DecorationSet.empty;

            // Insert widget right after the heading node
            const pos = targetHeadingPos + headingNode.nodeSize;

            const decoration = Decoration.widget(
              pos,
              () => {
                const wrapper = document.createElement("div");
                wrapper.className = "section-hint-widget";
                wrapper.contentEditable = "false";

                const button = document.createElement("button");
                button.className = "section-hint-button";
                button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg><span>${insightCount} ${insightCount === 1 ? "insight" : "insights"} for this section</span><span class="section-hint-arrow">\u2192</span>`;

                button.addEventListener("mousedown", (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onOpenPanel();
                });

                wrapper.appendChild(button);
                return wrapper;
              },
              { side: -1 }
            );

            return DecorationSet.create(doc, [decoration]);
          },
        },
      }),
    ];
  },
});
