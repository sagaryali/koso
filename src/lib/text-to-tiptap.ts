interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
}

interface TiptapDoc {
  type: "doc";
  content: TiptapNode[];
}

export function textToTiptap(text: string): TiptapDoc {
  const paragraphs = text
    .trim()
    .split("\n\n")
    .filter(Boolean);

  return {
    type: "doc",
    content: paragraphs.map((para) => {
      if (para.startsWith("# ")) {
        return {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: para.slice(2) }],
        };
      }
      if (para.startsWith("## ")) {
        return {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: para.slice(3) }],
        };
      }
      if (para.startsWith("### ")) {
        return {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: para.slice(4) }],
        };
      }
      return {
        type: "paragraph",
        content: [{ type: "text", text: para }],
      };
    }),
  };
}
