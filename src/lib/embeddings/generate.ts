import OpenAI from "openai";
import { createAdminClient } from "@/lib/supabase/admin";

interface TiptapNode {
  type: string;
  content?: TiptapNode[];
  text?: string;
  attrs?: Record<string, unknown>;
}

interface ContentChunk {
  text: string;
  index: number;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- Public API ---

export async function generateEmbedding(text: string): Promise<number[]> {
  const cleaned = text.replace(/\n/g, " ").trim();
  if (!cleaned) throw new Error("Cannot embed empty text");

  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: cleaned,
  });
  return response.data[0].embedding;
}

export function chunkContent(
  content: string | Record<string, unknown>,
  sourceType: string
): ContentChunk[] {
  if (sourceType === "artifact") {
    return chunkTiptapContent(content as Record<string, unknown>);
  }
  return chunkPlainText(
    typeof content === "string" ? content : JSON.stringify(content)
  );
}

export async function embedAndStore(
  sourceId: string,
  sourceType: string,
  workspaceId: string,
  content: string | Record<string, unknown>
): Promise<void> {
  const supabase = createAdminClient();

  const chunks = chunkContent(content, sourceType);

  if (chunks.length === 0) {
    console.log(
      `[embeddings] No chunks generated for ${sourceType}:${sourceId}`
    );
    return;
  }

  console.log(
    `[embeddings] Generating embeddings for ${chunks.length} chunks (${sourceType}:${sourceId})`
  );

  const embeddingsData = await Promise.all(
    chunks.map(async (chunk) => {
      const embedding = await generateEmbedding(chunk.text);
      return {
        workspace_id: workspaceId,
        source_id: sourceId,
        source_type: sourceType,
        chunk_text: chunk.text,
        chunk_index: chunk.index,
        embedding: JSON.stringify(embedding),
        metadata: {},
      };
    })
  );

  // Delete existing chunks for this source
  const { error: deleteError } = await supabase
    .from("embeddings")
    .delete()
    .eq("source_id", sourceId)
    .eq("source_type", sourceType);

  if (deleteError) {
    console.error(
      `[embeddings] Delete failed for ${sourceType}:${sourceId}`,
      deleteError
    );
    return;
  }

  // Insert new chunks
  const { error: insertError } = await supabase
    .from("embeddings")
    .insert(embeddingsData);

  if (insertError) {
    console.error(
      `[embeddings] Insert failed for ${sourceType}:${sourceId}`,
      insertError
    );
    return;
  }

  console.log(
    `[embeddings] Stored ${chunks.length} chunks for ${sourceType}:${sourceId}`
  );
}

// --- Internal helpers ---

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function extractTextFromTiptap(node: TiptapNode): string {
  if (node.text) {
    return node.text;
  }
  if (!node.content) {
    return "";
  }
  const isBlock = [
    "paragraph",
    "heading",
    "bulletList",
    "orderedList",
    "taskList",
    "blockquote",
    "codeBlock",
    "listItem",
    "taskItem",
  ].includes(node.type);

  return node.content
    .map((child) => extractTextFromTiptap(child))
    .join(isBlock ? "\n" : "");
}

function chunkTiptapContent(content: Record<string, unknown>): ContentChunk[] {
  const doc = content as unknown as TiptapNode;
  if (!doc.content) return [];

  const sections: { heading: string; body: string }[] = [];
  let currentHeading = "";
  let currentBody = "";

  for (const node of doc.content) {
    if (node.type === "heading") {
      if (currentHeading || currentBody.trim()) {
        sections.push({ heading: currentHeading, body: currentBody.trim() });
      }
      currentHeading = extractTextFromTiptap(node);
      currentBody = "";
    } else {
      currentBody += extractTextFromTiptap(node) + "\n";
    }
  }
  if (currentHeading || currentBody.trim()) {
    sections.push({ heading: currentHeading, body: currentBody.trim() });
  }

  const chunks: ContentChunk[] = [];
  let chunkIndex = 0;

  for (const section of sections) {
    const sectionText = section.heading
      ? `${section.heading}\n${section.body}`
      : section.body;

    if (!sectionText.trim()) continue;

    if (estimateTokens(sectionText) <= 500) {
      chunks.push({ text: sectionText, index: chunkIndex++ });
    } else {
      // Split at paragraph boundaries
      const paragraphs = sectionText.split(/\n\n+/);
      let currentChunk = "";

      for (const para of paragraphs) {
        if (
          estimateTokens(currentChunk + "\n\n" + para) > 500 &&
          currentChunk
        ) {
          chunks.push({ text: currentChunk.trim(), index: chunkIndex++ });
          currentChunk = section.heading
            ? `${section.heading}\n${para}`
            : para;
        } else {
          currentChunk = currentChunk
            ? `${currentChunk}\n\n${para}`
            : para;
        }
      }
      if (currentChunk.trim()) {
        chunks.push({ text: currentChunk.trim(), index: chunkIndex++ });
      }
    }
  }

  return chunks.filter((c) => c.text.trim().length > 0);
}

function chunkPlainText(text: string): ContentChunk[] {
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim());
  if (paragraphs.length === 0) return [];

  const chunks: ContentChunk[] = [];
  let currentChunk = "";
  let chunkIndex = 0;
  const overlapBuffer: string[] = [];

  for (const para of paragraphs) {
    const candidateTokens = estimateTokens(
      currentChunk ? currentChunk + "\n\n" + para : para
    );

    if (candidateTokens > 500 && currentChunk) {
      chunks.push({ text: currentChunk.trim(), index: chunkIndex++ });

      // Build overlap from last paragraphs (~50 tokens)
      let overlap = "";
      for (let i = overlapBuffer.length - 1; i >= 0; i--) {
        const candidate = overlapBuffer[i] + (overlap ? "\n\n" + overlap : "");
        if (estimateTokens(candidate) > 50) break;
        overlap = candidate;
      }
      currentChunk = overlap ? overlap + "\n\n" + para : para;
      overlapBuffer.length = 0;
    } else {
      currentChunk = currentChunk ? `${currentChunk}\n\n${para}` : para;
    }
    overlapBuffer.push(para);
  }

  if (currentChunk.trim()) {
    chunks.push({ text: currentChunk.trim(), index: chunkIndex++ });
  }

  return chunks;
}
