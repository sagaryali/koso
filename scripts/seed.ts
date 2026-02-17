/**
 * Seed script: populates the database with demo data for testing.
 *
 * Usage:
 *   npx tsx scripts/seed.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * Creates:
 *   - Demo user (demo@koso.dev / demo1234)
 *   - Workspace with realistic product config
 *   - 8 artifacts (PRDs, stories, decisions, etc.)
 *   - 14 evidence items (feedback, metrics, research, notes)
 *   - Links between evidence and artifacts
 *   - Codebase connection + 20 modules
 *   - Embeddings (from pre-computed file if available, otherwise random vectors)
 */

import { createClient } from "@supabase/supabase-js";
import { DEMO_USER, DEMO_WORKSPACE } from "./seed-data/workspace";
import { ARTIFACTS, type SeedArtifact } from "./seed-data/artifacts";
import { EVIDENCE, type SeedEvidence } from "./seed-data/evidence";
import { CODEBASE_CONNECTION, CODEBASE_MODULES } from "./seed-data/codebase";
import * as fs from "fs";
import * as path from "path";

// Load env from .env.local
function loadEnv() {
  const envPath = path.resolve(__dirname, "../.env.local");
  if (!fs.existsSync(envPath)) {
    console.error("Error: .env.local not found. Copy .env.local.example and fill in values.");
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Generate a random 1536-dim vector (used when pre-computed embeddings are not available)
function randomVector(): number[] {
  const v = Array.from({ length: 1536 }, () => Math.random() * 2 - 1);
  const norm = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
  return v.map((x) => x / norm);
}

async function main() {
  console.log("Starting seed...\n");

  // 1. Check if demo user already exists
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existingDemo = existingUsers?.users?.find((u) => u.email === DEMO_USER.email);

  if (existingDemo) {
    console.log(`Demo user ${DEMO_USER.email} already exists. Run 'npm run unseed' first to clean up.`);
    process.exit(1);
  }

  // 2. Create demo user
  console.log(`Creating user: ${DEMO_USER.email}`);
  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    email: DEMO_USER.email,
    password: DEMO_USER.password,
    email_confirm: true,
  });

  if (userError || !userData.user) {
    console.error("Failed to create user:", userError?.message);
    process.exit(1);
  }

  const userId = userData.user.id;
  console.log(`  User ID: ${userId}`);

  // 3. Create workspace
  console.log(`\nCreating workspace: ${DEMO_WORKSPACE.name}`);
  const { data: workspace, error: wsError } = await supabase
    .from("workspaces")
    .insert({
      user_id: userId,
      name: DEMO_WORKSPACE.name,
      product_description: DEMO_WORKSPACE.product_description,
      principles: DEMO_WORKSPACE.principles,
    })
    .select()
    .single();

  if (wsError || !workspace) {
    console.error("Failed to create workspace:", wsError?.message);
    process.exit(1);
  }

  const workspaceId = workspace.id;
  console.log(`  Workspace ID: ${workspaceId}`);

  // 4. Create artifacts
  console.log(`\nCreating ${ARTIFACTS.length} artifacts...`);
  const artifactIdMap = new Map<string, string>(); // key -> uuid

  // First pass: create artifacts without parent_id
  for (const artifact of ARTIFACTS) {
    const { data, error } = await supabase
      .from("artifacts")
      .insert({
        workspace_id: workspaceId,
        type: artifact.type,
        title: artifact.title,
        content: artifact.content,
        status: artifact.status,
      })
      .select("id")
      .single();

    if (error || !data) {
      console.error(`  Failed to create artifact "${artifact.title}":`, error?.message);
      continue;
    }

    artifactIdMap.set(artifact.key, data.id);
    console.log(`  [${artifact.type}] ${artifact.title}`);
  }

  // Second pass: set parent_id for child artifacts
  for (const artifact of ARTIFACTS) {
    if (artifact.parentKey) {
      const childId = artifactIdMap.get(artifact.key);
      const parentId = artifactIdMap.get(artifact.parentKey);
      if (childId && parentId) {
        await supabase
          .from("artifacts")
          .update({ parent_id: parentId })
          .eq("id", childId);
      }
    }
  }

  // 5. Create evidence
  console.log(`\nCreating ${EVIDENCE.length} evidence items...`);
  const evidenceIdMap = new Map<string, string>(); // key -> uuid

  for (const ev of EVIDENCE) {
    const { data, error } = await supabase
      .from("evidence")
      .insert({
        workspace_id: workspaceId,
        type: ev.type,
        title: ev.title,
        content: ev.content,
        source: ev.source,
        tags: ev.tags,
      })
      .select("id")
      .single();

    if (error || !data) {
      console.error(`  Failed to create evidence "${ev.title}":`, error?.message);
      continue;
    }

    evidenceIdMap.set(ev.key, data.id);
    console.log(`  [${ev.type}] ${ev.title}`);
  }

  // 6. Create links (evidence -> artifact)
  console.log("\nCreating links...");
  let linkCount = 0;

  for (const ev of EVIDENCE) {
    if (!ev.linkedArtifactKeys?.length) continue;
    const evidenceId = evidenceIdMap.get(ev.key);
    if (!evidenceId) continue;

    for (const artifactKey of ev.linkedArtifactKeys) {
      const artifactId = artifactIdMap.get(artifactKey);
      if (!artifactId) continue;

      const { error } = await supabase.from("links").insert({
        workspace_id: workspaceId,
        source_id: evidenceId,
        source_type: "evidence",
        target_id: artifactId,
        target_type: "artifact",
        relationship: "supports",
      });

      if (!error) linkCount++;
    }
  }

  console.log(`  Created ${linkCount} links`);

  // 7. Create codebase connection
  console.log("\nCreating codebase connection...");
  const { data: connection, error: connError } = await supabase
    .from("codebase_connections")
    .insert({
      workspace_id: workspaceId,
      repo_url: CODEBASE_CONNECTION.repo_url,
      repo_name: CODEBASE_CONNECTION.repo_name,
      default_branch: CODEBASE_CONNECTION.default_branch,
      status: CODEBASE_CONNECTION.status,
      last_synced_at: new Date().toISOString(),
      file_count: CODEBASE_CONNECTION.file_count,
      module_count: CODEBASE_CONNECTION.module_count,
    })
    .select("id")
    .single();

  if (connError || !connection) {
    console.error("Failed to create codebase connection:", connError?.message);
  } else {
    console.log(`  Connection ID: ${connection.id}`);

    // 8. Create codebase modules
    console.log(`\nCreating ${CODEBASE_MODULES.length} codebase modules...`);

    for (const mod of CODEBASE_MODULES) {
      const { error } = await supabase.from("codebase_modules").insert({
        connection_id: connection.id,
        workspace_id: workspaceId,
        file_path: mod.file_path,
        module_name: mod.module_name,
        module_type: mod.module_type,
        language: mod.language,
        summary: mod.summary,
        dependencies: mod.dependencies,
        exports: mod.exports,
        raw_content: mod.raw_content,
        embedding: JSON.stringify(randomVector()),
      });

      if (error) {
        console.error(`  Failed to create module "${mod.file_path}":`, error.message);
      } else {
        console.log(`  ${mod.file_path}`);
      }
    }
  }

  // 9. Create embeddings
  console.log("\nCreating embeddings...");

  // Try to load pre-computed embeddings
  const embeddingsPath = path.resolve(__dirname, "seed-data/embeddings.json");
  let precomputed: Record<string, number[][]> | null = null;

  if (fs.existsSync(embeddingsPath)) {
    try {
      precomputed = JSON.parse(fs.readFileSync(embeddingsPath, "utf-8"));
      console.log("  Using pre-computed embeddings");
    } catch {
      console.log("  Pre-computed embeddings file invalid, using random vectors");
    }
  } else {
    console.log("  No pre-computed embeddings found, using random vectors");
    console.log("  (Run 'npm run seed:embeddings' to generate real embeddings for better search)");
  }

  // Embed artifacts
  for (const artifact of ARTIFACTS) {
    const sourceId = artifactIdMap.get(artifact.key);
    if (!sourceId) continue;

    const vectors = precomputed?.[`artifact:${artifact.key}`];
    const chunkTexts = extractTextFromTiptap(artifact.content);

    for (let i = 0; i < chunkTexts.length; i++) {
      const embedding = vectors?.[i] ?? randomVector();
      await supabase.from("embeddings").insert({
        workspace_id: workspaceId,
        source_id: sourceId,
        source_type: "artifact",
        chunk_text: chunkTexts[i],
        chunk_index: i,
        embedding: JSON.stringify(embedding),
        metadata: {},
      });
    }
  }

  // Embed evidence
  for (const ev of EVIDENCE) {
    const sourceId = evidenceIdMap.get(ev.key);
    if (!sourceId) continue;

    const vectors = precomputed?.[`evidence:${ev.key}`];
    const embedding = vectors?.[0] ?? randomVector();

    await supabase.from("embeddings").insert({
      workspace_id: workspaceId,
      source_id: sourceId,
      source_type: "evidence",
      chunk_text: ev.content.slice(0, 500),
      chunk_index: 0,
      embedding: JSON.stringify(embedding),
      metadata: {},
    });
  }

  console.log(`  Created embeddings for ${ARTIFACTS.length} artifacts and ${EVIDENCE.length} evidence items`);

  // Done
  console.log("\n--- Seed complete! ---");
  console.log(`\nLogin credentials:`);
  console.log(`  Email:    ${DEMO_USER.email}`);
  console.log(`  Password: ${DEMO_USER.password}`);
  console.log(`\nWorkspace: ${DEMO_WORKSPACE.name}`);
  console.log(`\nTo enable mock APIs (no external API keys needed):`);
  console.log(`  Add NEXT_PUBLIC_DEMO_MODE=true to .env.local`);
  console.log(`  Or run: npm run dev:demo`);
  console.log(`\nTo remove all seed data:`);
  console.log(`  npm run unseed`);
}

// Extract plain text chunks from Tiptap JSON doc
function extractTextFromTiptap(doc: Record<string, unknown>): string[] {
  const chunks: string[] = [];
  let currentChunk = "";

  function walk(node: Record<string, unknown>) {
    if (node.type === "text" && typeof node.text === "string") {
      currentChunk += node.text;
    }
    if (node.type === "heading") {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = "";
      }
    }
    if (node.type === "paragraph") {
      currentChunk += "\n";
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content) {
        walk(child as Record<string, unknown>);
      }
    }
  }

  walk(doc);
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  // If no chunks extracted, return the title or a fallback
  if (chunks.length === 0) {
    chunks.push("No content");
  }

  return chunks;
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
