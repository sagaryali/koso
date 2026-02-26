export interface SpecSection {
  section: string;
  text: string;
}

interface TiptapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

interface TiptapTextNode {
  type: "text";
  text: string;
  marks?: TiptapMark[];
}

interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: (TiptapNode | TiptapTextNode)[];
  marks?: TiptapMark[];
}

/**
 * Parse inline markdown formatting into an array of TiptapTextNodes with marks.
 * Handles: **bold**, *italic*, _italic_, `code`, [text](url)
 */
function parseInlineMarks(text: string): TiptapTextNode[] {
  const nodes: TiptapTextNode[] = [];

  // Regex that matches inline patterns in order of priority
  const inlinePattern =
    /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(_(.+?)_)|(`(.+?)`)|(\[([^\]]+)\]\(([^)]+)\))/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = inlinePattern.exec(text)) !== null) {
    // Add any plain text before this match
    if (match.index > lastIndex) {
      nodes.push({ type: "text", text: text.slice(lastIndex, match.index) });
    }

    if (match[1]) {
      // **bold**
      nodes.push({
        type: "text",
        text: match[2],
        marks: [{ type: "bold" }],
      });
    } else if (match[3]) {
      // *italic*
      nodes.push({
        type: "text",
        text: match[4],
        marks: [{ type: "italic" }],
      });
    } else if (match[5]) {
      // _italic_
      nodes.push({
        type: "text",
        text: match[6],
        marks: [{ type: "italic" }],
      });
    } else if (match[7]) {
      // `code`
      nodes.push({
        type: "text",
        text: match[8],
        marks: [{ type: "code" }],
      });
    } else if (match[9]) {
      // [text](url)
      nodes.push({
        type: "text",
        text: match[10],
        marks: [{ type: "link", attrs: { href: match[11] } }],
      });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add any remaining plain text
  if (lastIndex < text.length) {
    nodes.push({ type: "text", text: text.slice(lastIndex) });
  }

  // If no matches at all, return the whole text as a single node
  if (nodes.length === 0 && text.length > 0) {
    nodes.push({ type: "text", text });
  }

  return nodes;
}

/**
 * Create a paragraph node with inline marks parsed from markdown.
 */
function paragraphNode(text: string): TiptapNode {
  return {
    type: "paragraph",
    content: parseInlineMarks(text),
  };
}

/**
 * Parse a markdown section text into an array of TiptapNodes.
 */
function parseMarkdownToNodes(text: string): TiptapNode[] {
  const lines = text.split("\n");
  const nodes: TiptapNode[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Blank line — skip
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+\s*$/.test(line) || /^\*\*\*+\s*$/.test(line)) {
      nodes.push({ type: "horizontalRule" });
      i++;
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      nodes.push({
        type: "heading",
        attrs: { level },
        content: parseInlineMarks(headingMatch[2]),
      });
      i++;
      continue;
    }

    // Blockquote (collect consecutive > lines)
    if (line.startsWith("> ") || line === ">") {
      const quoteLines: string[] = [];
      while (i < lines.length && (lines[i].startsWith("> ") || lines[i] === ">")) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      // Parse blockquote content as paragraphs split by empty lines
      const quoteParagraphs = quoteLines.join("\n").split("\n\n").filter(Boolean);
      nodes.push({
        type: "blockquote",
        content: quoteParagraphs.map((p) => paragraphNode(p.trim())),
      });
      continue;
    }

    // Task list (- [ ] or - [x])
    const taskMatch = line.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/);
    if (taskMatch) {
      const taskItems: TiptapNode[] = [];
      while (i < lines.length) {
        const tm = lines[i].match(/^[-*]\s+\[([ xX])\]\s+(.*)$/);
        if (!tm) break;
        taskItems.push({
          type: "taskItem",
          attrs: { checked: tm[1] !== " " },
          content: [paragraphNode(tm[2])],
        });
        i++;
      }
      nodes.push({
        type: "taskList",
        content: taskItems,
      });
      continue;
    }

    // Unordered list (- item or * item)
    const ulMatch = line.match(/^[-*]\s+(.*)$/);
    if (ulMatch) {
      const listItems: TiptapNode[] = [];
      while (i < lines.length) {
        const lm = lines[i].match(/^[-*]\s+(.*)$/);
        if (!lm) break;
        // Skip if it's a task list item
        if (/^[-*]\s+\[[ xX]\]/.test(lines[i])) break;
        listItems.push({
          type: "listItem",
          content: [paragraphNode(lm[1])],
        });
        i++;
      }
      nodes.push({
        type: "bulletList",
        content: listItems,
      });
      continue;
    }

    // Ordered list (1. item, 2. item, etc.)
    const olMatch = line.match(/^\d+\.\s+(.*)$/);
    if (olMatch) {
      const listItems: TiptapNode[] = [];
      while (i < lines.length) {
        const lm = lines[i].match(/^\d+\.\s+(.*)$/);
        if (!lm) break;
        listItems.push({
          type: "listItem",
          content: [paragraphNode(lm[1])],
        });
        i++;
      }
      nodes.push({
        type: "orderedList",
        content: listItems,
      });
      continue;
    }

    // Code block (```)
    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i++; // skip opening ```
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing ```
      nodes.push({
        type: "codeBlock",
        content: [{ type: "text", text: codeLines.join("\n") }],
      });
      continue;
    }

    // Regular paragraph — collect consecutive non-special lines
    const paraLines: string[] = [];
    while (i < lines.length) {
      const l = lines[i];
      if (l.trim() === "") break;
      if (/^#{1,3}\s/.test(l)) break;
      if (/^[-*]\s/.test(l)) break;
      if (/^\d+\.\s/.test(l)) break;
      if (l.startsWith("> ") || l === ">") break;
      if (l.startsWith("```")) break;
      if (/^---+\s*$/.test(l) || /^\*\*\*+\s*$/.test(l)) break;
      paraLines.push(l);
      i++;
    }
    if (paraLines.length > 0) {
      nodes.push(paragraphNode(paraLines.join(" ")));
    }
  }

  return nodes;
}

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
    const parsed = parseMarkdownToNodes(section.text.trim());
    nodes.push(...parsed);
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
