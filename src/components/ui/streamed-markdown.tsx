"use client";

import type React from "react";

function stripMarkdownChars(text: string): string {
  return text
    .replace(/\*\*\*(.+?)\*\*\*/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\*/g, "")
    .replace(/`/g, "");
}

function renderInline(text: string): React.ReactNode {
  return stripMarkdownChars(text);
}

export function StreamedMarkdown({ text }: { text: string }) {
  if (!text) return null;

  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = stripMarkdownChars(headingMatch[2]);
      if (level <= 2) {
        elements.push(
          <h2 key={i} className="mt-6 mb-3 text-[22px] font-bold tracking-tight text-text-primary">
            {content}
          </h2>
        );
      } else if (level === 3) {
        elements.push(
          <h3 key={i} className="mt-6 mb-2 text-[17px] font-bold tracking-tight text-text-primary">
            {content}
          </h3>
        );
      } else {
        elements.push(
          <h4 key={i} className="mt-5 mb-2 text-[15px] font-bold text-text-primary">
            {content}
          </h4>
        );
      }
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      elements.push(
        <hr key={i} className="my-5 border-border-default" />
      );
      i++;
      continue;
    }

    // Checklist items (check before bullet list)
    if (/^[-*]\s\[[ x]\]\s/.test(line)) {
      const items: { checked: boolean; text: string }[] = [];
      while (i < lines.length && /^[-*]\s\[[ x]\]\s/.test(lines[i])) {
        const checked = lines[i].includes("[x]");
        const text = lines[i].replace(/^[-*]\s\[[ x]\]\s/, "");
        items.push({ checked, text });
        i++;
      }
      elements.push(
        <ul key={`cl-${i}`} className="my-2 space-y-1.5">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-[15px] leading-relaxed">
              <span className="mt-1 inline-block h-3.5 w-3.5 shrink-0 border border-border-strong text-center text-[10px] leading-[13px]">
                {item.checked ? "\u2713" : ""}
              </span>
              <span className="text-text-primary">{renderInline(item.text)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Bullet list items
    if (/^[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s/, ""));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="my-2 space-y-1 pl-5">
          {items.map((item, idx) => (
            <li
              key={idx}
              className="list-disc text-[15px] leading-relaxed text-text-primary"
            >
              {renderInline(item)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list items
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="my-2 list-decimal space-y-1 pl-5">
          {items.map((item, idx) => (
            <li
              key={idx}
              className="text-[15px] leading-relaxed text-text-primary"
            >
              {renderInline(item)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Empty line
    if (!line.trim()) {
      i++;
      continue;
    }

    // Paragraph
    elements.push(
      <p key={i} className="my-2 text-[15px] leading-relaxed text-text-primary">
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return <>{elements}</>;
}
