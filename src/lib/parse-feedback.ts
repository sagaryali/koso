export interface FeedbackItem {
  id: string;
  content: string;
  title: string;
  isSample?: boolean;
}

// Lines that are structural noise, not actual evidence content
function isNoiseLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false; // empty lines are handled by splitting logic
  // Horizontal rules / separators: ---, ***, ___, ===, ~~~, etc.
  if (/^[-*_=~]{3,}\s*$/.test(trimmed)) return true;
  // Markdown headings that are just labels like "# Feedback" or "## ---"
  if (/^#{1,6}\s*[-*_=~]{3,}\s*$/.test(trimmed)) return true;
  // Standalone numbers (e.g. "1" "2" between items, not "1." which is a list)
  if (/^\d+$/.test(trimmed)) return true;
  // Common pasted artifacts: page numbers, timestamps with no content
  if (/^page\s+\d+$/i.test(trimmed)) return true;
  if (/^-{1,2}$/.test(trimmed)) return true;
  return false;
}

export function parseFeedback(raw: string): FeedbackItem[] {
  const text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) return [];

  // Strip noise lines before any splitting logic.
  // Noise lines act as separators (replaced with blank lines) so they
  // naturally become split points without leaking into content.
  const cleaned = text
    .split("\n")
    .map((line) => (isNoiseLine(line) ? "" : line))
    .join("\n")
    .trim();

  if (!cleaned) return [];

  const lines = cleaned.split("\n");

  // Check for numbered list pattern (1. or 1) style)
  const numberedPattern = /^\d+[\.\)]\s/;
  const hasNumbered = lines.some((l) => numberedPattern.test(l.trim()));
  if (hasNumbered) {
    return splitByLinePattern(lines, numberedPattern);
  }

  // Check for bullet pattern (- , * , • )
  const bulletPattern = /^[-\*\u2022]\s/;
  const hasBullets = lines.some((l) => bulletPattern.test(l.trim()));
  if (hasBullets) {
    return splitByLinePattern(lines, bulletPattern);
  }

  // Check for blockquote pattern (> )
  const quotePattern = /^>\s?/;
  const hasQuotes = lines.some((l) => quotePattern.test(l.trim()));
  if (hasQuotes) {
    return splitByLinePattern(lines, quotePattern);
  }

  // Split on double newlines
  const doubleNewlineSplit = cleaned
    .split(/\n\n+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  if (doubleNewlineSplit.length > 1) {
    return doubleNewlineSplit.map((content) => ({
      id: crypto.randomUUID(),
      content,
      title: "",
    }));
  }

  // Detect hard-wrapped text (e.g. pasted from terminal) and split into paragraphs.
  // A paragraph ends when a line is significantly shorter than the typical wrap width,
  // meaning it's the last line of a block before a new thought begins.
  const hardWrapped = splitHardWrapped(lines);
  if (hardWrapped.length > 1) {
    return hardWrapped.map((content) => ({
      id: crypto.randomUUID(),
      content,
      title: "",
    }));
  }

  // Fallback: split on single newlines if lines are long enough to be distinct items
  const singleLines = lines.map((l) => l.trim()).filter(Boolean);
  if (singleLines.length > 1 && singleLines.every((l) => l.length > 20)) {
    return singleLines.map((content) => ({
      id: crypto.randomUUID(),
      content,
      title: "",
    }));
  }

  // Truly a single item
  return [{ id: crypto.randomUUID(), content: cleaned, title: "" }];
}

/**
 * Detect hard-wrapped text and split into paragraphs.
 * In hard-wrapped text most lines hit a consistent width (~70-80 chars).
 * A paragraph's last line is shorter than that width.
 * We detect the wrap width, then treat any line significantly shorter
 * than it as a paragraph boundary.
 */
function splitHardWrapped(lines: string[]): string[] {
  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  if (nonEmpty.length < 4) return [];

  // Use trimmed lengths to detect the wrap width
  const trimmedLengths = nonEmpty
    .map((l) => l.trim().length)
    .sort((a, b) => b - a);
  const wrapWidth = trimmedLengths[Math.floor(trimmedLengths.length * 0.15)];

  // If lines aren't consistently long, this isn't hard-wrapped text
  if (wrapWidth < 50) return [];
  const longLines = nonEmpty.filter((l) => l.trim().length >= wrapWidth * 0.9);
  if (longLines.length < nonEmpty.length * 0.25) return [];

  const threshold = wrapWidth * 0.9;
  const paragraphs: string[] = [];
  let current: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (!trimmed) {
      if (current.length > 0) {
        paragraphs.push(current.join(" ").trim());
        current = [];
      }
      continue;
    }

    current.push(trimmed);

    // If this line is shorter than threshold, it might be a paragraph ending.
    // Confirm by checking signals from both this line and the next.
    if (trimmed.length < threshold && i < lines.length - 1) {
      const nextLine = lines.slice(i + 1).find((l) => l.trim());
      if (nextLine) {
        const nextTrimmed = nextLine.trim();
        // Strong signal: next line starts with uppercase, digit, or quote
        const nextStartsUpper = /^[A-Z"'\d]/.test(nextTrimmed);
        // This line ends a sentence (period, ?, !, or is very short)
        const endsWithPunctuation = /[.!?)"'\d]$/.test(trimmed);
        const isVeryShort = trimmed.length < wrapWidth * 0.5;

        if (nextStartsUpper || endsWithPunctuation || isVeryShort) {
          paragraphs.push(current.join(" ").trim());
          current = [];
        }
      }
    }
  }

  if (current.length > 0) {
    paragraphs.push(current.join(" ").trim());
  }

  return paragraphs.filter(Boolean);
}

function splitByLinePattern(
  lines: string[],
  pattern: RegExp
): FeedbackItem[] {
  const chunks: string[] = [];
  let current = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (pattern.test(trimmed)) {
      if (current.trim()) {
        chunks.push(current.trim());
      }
      // Strip the prefix
      current = trimmed.replace(pattern, "");
    } else if (trimmed) {
      // Continuation line
      current += (current ? " " : "") + trimmed;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks
    .filter(Boolean)
    .map((content) => ({
      id: crypto.randomUUID(),
      content,
      title: "",
    }));
}
