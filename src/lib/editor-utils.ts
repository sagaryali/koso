import type { Editor } from "@tiptap/core";

export interface SectionContent {
  heading: string;
  level: number;
  text: string;
}

/**
 * Extract all sections from a TipTap editor by walking the ProseMirror doc tree.
 * A "section" = a heading node + all text nodes until the next heading of the same or higher level.
 */
export function extractAllSections(editor: Editor): SectionContent[] {
  const doc = editor.state.doc;
  const sections: SectionContent[] = [];
  let currentHeading: string | null = null;
  let currentLevel = 0;
  let currentText: string[] = [];

  doc.forEach((node) => {
    if (node.type.name === "heading") {
      // Save previous section
      if (currentHeading !== null) {
        sections.push({
          heading: currentHeading,
          level: currentLevel,
          text: currentText.join("\n").trim(),
        });
      }
      currentHeading = node.textContent;
      currentLevel = node.attrs.level as number;
      currentText = [];
    } else if (currentHeading !== null) {
      const text = node.textContent;
      if (text.trim()) {
        currentText.push(text);
      }
    }
  });

  // Save last section
  if (currentHeading !== null) {
    sections.push({
      heading: currentHeading,
      level: currentLevel,
      text: currentText.join("\n").trim(),
    });
  }

  return sections;
}

/**
 * Extract all sections before the current cursor position.
 */
export function extractPriorSections(editor: Editor): SectionContent[] {
  const { from } = editor.state.selection;
  const doc = editor.state.doc;
  const sections: SectionContent[] = [];
  let currentHeading: string | null = null;
  let currentLevel = 0;
  let currentText: string[] = [];

  doc.forEach((node, offset) => {
    // Stop if we've passed the cursor
    if (offset >= from) return;

    if (node.type.name === "heading") {
      // Save previous section
      if (currentHeading !== null) {
        sections.push({
          heading: currentHeading,
          level: currentLevel,
          text: currentText.join("\n").trim(),
        });
      }
      currentHeading = node.textContent;
      currentLevel = node.attrs.level as number;
      currentText = [];
    } else if (currentHeading !== null) {
      const text = node.textContent;
      if (text.trim()) {
        currentText.push(text);
      }
    }
  });

  // Save last section (the one the cursor is currently inside is excluded
  // since its heading offset >= from check may have passed, but its content
  // may still be before from — we include the last partial section)
  if (currentHeading !== null) {
    sections.push({
      heading: currentHeading,
      level: currentLevel,
      text: currentText.join("\n").trim(),
    });
  }

  // The last section is the one containing the cursor — remove it so we only get prior sections
  if (sections.length > 0) {
    sections.pop();
  }

  return sections;
}

/**
 * Extract the current section (heading + text) at the cursor position.
 */
export function extractCurrentSection(editor: Editor): SectionContent | null {
  const { from } = editor.state.selection;
  const doc = editor.state.doc;

  let lastHeading: string | null = null;
  let lastLevel = 0;
  let lastHeadingPos = -1;
  let textParts: string[] = [];

  doc.forEach((node, offset) => {
    if (node.type.name === "heading") {
      if (offset <= from) {
        // This heading is at or before cursor — it's a candidate
        lastHeading = node.textContent;
        lastLevel = node.attrs.level as number;
        lastHeadingPos = offset;
        textParts = [];
      } else if (lastHeading !== null && textParts !== null) {
        // We've gone past the cursor and hit the next heading — stop collecting
        return;
      }
    } else if (lastHeadingPos >= 0 && offset > lastHeadingPos) {
      const text = node.textContent;
      if (text.trim()) {
        textParts.push(text);
      }
    }
  });

  if (lastHeading === null) return null;

  return {
    heading: lastHeading,
    level: lastLevel,
    text: textParts.join("\n").trim(),
  };
}

/**
 * Format sections as a string block for AI prompts.
 */
export function formatSectionsForPrompt(sections: SectionContent[]): string {
  return sections
    .map((s) => `## ${s.heading}\n${s.text}`)
    .join("\n\n");
}
