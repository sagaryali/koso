/**
 * Pre-compute embeddings for seed data.
 *
 * Usage:
 *   npx tsx scripts/generate-seed-embeddings.ts
 *
 * Requires OPENAI_API_KEY in .env.local
 *
 * Generates scripts/seed-data/embeddings.json containing real vector embeddings
 * for all seed artifacts and evidence. This file is used by seed.ts so that
 * vector search works without needing an OpenAI key at seed time.
 *
 * Only run this when seed content changes.
 */

import OpenAI from "openai";
import { ARTIFACTS } from "./seed-data/artifacts";
import { EVIDENCE } from "./seed-data/evidence";
import * as fs from "fs";
import * as path from "path";

// Load env from .env.local
function loadEnv() {
  const envPath = path.resolve(__dirname, "../.env.local");
  if (!fs.existsSync(envPath)) {
    console.error("Error: .env.local not found.");
    process.exit(1);
  }
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx);
    const value = trimmed.slice(eqIdx + 1);
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnv();

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("Error: OPENAI_API_KEY is required to generate embeddings.");
  console.error("Add it to .env.local and try again.");
  process.exit(1);
}

const openai = new OpenAI({ apiKey });

// Replicates the chunking logic from src/lib/embeddings/generate.ts
interface TiptapNode {
  type: string;
  content?: TiptapNode[];
  text?: string;
}

function extractTextFromTiptap(node: TiptapNode): string {
  if (node.text) return node.text;
  if (!node.content) return "";
  const isBlock = [
    "paragraph", "heading", "bulletList", "orderedList",
    "taskList", "blockquote", "codeBlock", "listItem", "taskItem",
  ].includes(node.type);
  return node.content.map((child) => extractTextFromTiptap(child)).join(isBlock ? "\n" : "");
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function chunkTiptapDoc(doc: Record<string, unknown>): string[] {
  const node = doc as unknown as TiptapNode;
  if (!node.content) return [];

  const sections: { heading: string; body: string }[] = [];
  let currentHeading = "";
  let currentBody = "";

  for (const child of node.content) {
    if (child.type === "heading") {
      if (currentHeading || currentBody.trim()) {
        sections.push({ heading: currentHeading, body: currentBody.trim() });
      }
      currentHeading = extractTextFromTiptap(child);
      currentBody = "";
    } else {
      currentBody += extractTextFromTiptap(child) + "\n";
    }
  }
  if (currentHeading || currentBody.trim()) {
    sections.push({ heading: currentHeading, body: currentBody.trim() });
  }

  const chunks: string[] = [];
  for (const section of sections) {
    const sectionText = section.heading
      ? `${section.heading}\n${section.body}`
      : section.body;
    if (!sectionText.trim()) continue;

    if (estimateTokens(sectionText) <= 500) {
      chunks.push(sectionText);
    } else {
      const paragraphs = sectionText.split(/\n\n+/);
      let currentChunk = "";
      for (const para of paragraphs) {
        if (estimateTokens(currentChunk + "\n\n" + para) > 500 && currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = section.heading ? `${section.heading}\n${para}` : para;
        } else {
          currentChunk = currentChunk ? `${currentChunk}\n\n${para}` : para;
        }
      }
      if (currentChunk.trim()) chunks.push(currentChunk.trim());
    }
  }

  return chunks.filter((c) => c.trim().length > 0);
}

async function generateEmbedding(text: string): Promise<number[]> {
  const cleaned = text.replace(/\n/g, " ").trim();
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: cleaned,
  });
  return response.data[0].embedding;
}

async function main() {
  console.log("Generating seed embeddings...\n");

  const result: Record<string, number[][]> = {};
  let totalChunks = 0;

  // Process artifacts
  for (const artifact of ARTIFACTS) {
    const key = `artifact:${artifact.key}`;
    const chunks = chunkTiptapDoc(artifact.content);
    console.log(`  ${key}: ${chunks.length} chunks`);

    const vectors: number[][] = [];
    for (const chunk of chunks) {
      const embedding = await generateEmbedding(chunk);
      vectors.push(embedding);
      totalChunks++;
    }
    result[key] = vectors;

    // Small delay to avoid rate limits
    await new Promise((r) => setTimeout(r, 200));
  }

  // Process evidence
  for (const ev of EVIDENCE) {
    const key = `evidence:${ev.key}`;
    console.log(`  ${key}: 1 chunk`);

    const embedding = await generateEmbedding(ev.content.slice(0, 500));
    result[key] = [embedding];
    totalChunks++;

    await new Promise((r) => setTimeout(r, 200));
  }

  // Write to file
  const outputPath = path.resolve(__dirname, "seed-data/embeddings.json");
  fs.writeFileSync(outputPath, JSON.stringify(result));

  const fileSizeKB = Math.round(fs.statSync(outputPath).size / 1024);
  console.log(`\nDone! Generated ${totalChunks} embeddings.`);
  console.log(`Saved to: ${outputPath} (${fileSizeKB} KB)`);
}

main().catch((err) => {
  console.error("Failed to generate embeddings:", err);
  process.exit(1);
});
