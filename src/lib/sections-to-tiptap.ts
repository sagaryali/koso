export interface SpecSection {
  section: string;
  text: string;
}

type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: { type: string; text: string }[];
};

/**
 * Convert an array of spec sections (heading + markdown text) into a TipTap JSON document.
 */
export function sectionsToTiptapDoc(sections: SpecSection[]): {
  type: "doc";
  content: TiptapNode[];
} {
  const nodes: TiptapNode[] = [];
  for (const section of sections) {
    nodes.push({
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: section.section }],
    });
    const paragraphs = section.text.trim().split("\n\n").filter(Boolean);
    for (const para of paragraphs) {
      if (para.startsWith("### ")) {
        nodes.push({
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: para.slice(4) }],
        });
      } else {
        nodes.push({
          type: "paragraph",
          content: [{ type: "text", text: para }],
        });
      }
    }
  }
  return { type: "doc", content: nodes };
}

const SECTION_NAMES = [
  "Problem",
  "Goals & Success Metrics",
  "User Stories",
  "Requirements",
  "Open Questions",
];

/**
 * Create a placeholder TipTap doc with section headings and empty paragraphs.
 */
export function placeholderSpecDoc(): {
  type: "doc";
  content: TiptapNode[];
} {
  const nodes: TiptapNode[] = SECTION_NAMES.flatMap((name) => [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: name }],
    },
    {
      type: "paragraph",
      content: [{ type: "text", text: " " }],
    },
  ]);
  return { type: "doc", content: nodes };
}
