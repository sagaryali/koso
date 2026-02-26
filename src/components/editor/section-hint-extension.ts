import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export const sectionHintPluginKey = new PluginKey("sectionHint");

export interface SectionBriefingData {
  suggestedTopics: string[];
  summary: string;
  inconsistencies: string[];
}

export const SectionHintExtension = Extension.create({
  name: "sectionHint",

  addStorage() {
    return {
      insightCount: 0,
      onOpenPanel: (() => {}) as () => void,
      briefing: null as SectionBriefingData | null,
      onDraftSection: (() => {}) as () => void,
    };
  },

  addProseMirrorPlugins() {
    const storage = this.storage;

    return [
      new Plugin({
        key: sectionHintPluginKey,
        props: {
          decorations: (state) => {
            const { insightCount, onOpenPanel, briefing, onDraftSection } =
              storage;

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

            // Check if there's any content to show
            const hasBriefing =
              briefing &&
              (briefing.suggestedTopics.length > 0 ||
                briefing.inconsistencies.length > 0);
            const hasInsights = insightCount > 0;

            if (!hasBriefing && !hasInsights) return DecorationSet.empty;

            // Insert widget right after the heading node
            const pos = targetHeadingPos + headingNode.nodeSize;

            const decoration = Decoration.widget(
              pos,
              () => {
                const wrapper = document.createElement("div");
                wrapper.className = "section-hint-widget";
                wrapper.contentEditable = "false";

                // Rich briefing mode
                if (hasBriefing) {
                  // Summary
                  if (briefing.summary) {
                    const summaryEl = document.createElement("div");
                    summaryEl.className = "section-hint-summary";
                    summaryEl.textContent = briefing.summary;
                    wrapper.appendChild(summaryEl);
                  }

                  // Suggested topics
                  if (briefing.suggestedTopics.length > 0) {
                    const topicsList = document.createElement("ul");
                    topicsList.className = "section-hint-topics";
                    for (const topic of briefing.suggestedTopics.slice(0, 3)) {
                      const li = document.createElement("li");
                      li.textContent = topic;
                      topicsList.appendChild(li);
                    }
                    wrapper.appendChild(topicsList);
                  }

                  // Inconsistency warnings
                  if (briefing.inconsistencies.length > 0) {
                    for (const issue of briefing.inconsistencies) {
                      const warn = document.createElement("div");
                      warn.className = "section-hint-warning";
                      warn.textContent = `\u26A0 ${issue}`;
                      wrapper.appendChild(warn);
                    }
                  }

                  // Action buttons row
                  const actionsRow = document.createElement("div");
                  actionsRow.className = "section-hint-actions";

                  if (hasInsights) {
                    const insightBtn = document.createElement("button");
                    insightBtn.className = "section-hint-button";
                    insightBtn.textContent = `${insightCount} ${insightCount === 1 ? "insight" : "insights"}`;
                    insightBtn.addEventListener("mousedown", (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onOpenPanel();
                    });
                    actionsRow.appendChild(insightBtn);
                  }

                  const draftBtn = document.createElement("button");
                  draftBtn.className = "section-hint-button section-hint-draft";
                  draftBtn.textContent = "Draft this section";
                  draftBtn.addEventListener("mousedown", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDraftSection();
                  });
                  actionsRow.appendChild(draftBtn);

                  wrapper.appendChild(actionsRow);
                } else {
                  // Simple fallback — just insight count
                  const button = document.createElement("button");
                  button.className = "section-hint-button";
                  button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg><span>${insightCount} ${insightCount === 1 ? "insight" : "insights"} for this section</span><span class="section-hint-arrow">\u2192</span>`;

                  button.addEventListener("mousedown", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onOpenPanel();
                  });

                  wrapper.appendChild(button);
                }

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
