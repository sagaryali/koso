import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateEmbedding } from "@/lib/embeddings/generate";
import {
  fetchRepoTree,
  fetchFileContent,
  shouldIncludeFile,
  detectLanguage,
  detectModuleType,
} from "./github";
import { parseFile } from "./parser";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function indexRepository(
  connectionId: string,
  workspaceId: string,
  githubToken: string
): Promise<void> {
  const supabase = createAdminClient();

  // Get connection details
  const { data: connection, error: connError } = await supabase
    .from("codebase_connections")
    .select("*")
    .eq("id", connectionId)
    .single();

  if (connError || !connection) {
    console.error("[indexer] Connection not found:", connError);
    return;
  }

  const [owner, repo] = connection.repo_name.split("/");

  try {
    // Update status to syncing
    await supabase
      .from("codebase_connections")
      .update({ status: "syncing", error_message: null })
      .eq("id", connectionId);

    // Fetch the repo tree
    console.log(`[indexer] Fetching tree for ${connection.repo_name}...`);
    const tree = await fetchRepoTree(
      githubToken,
      owner,
      repo,
      connection.default_branch
    );

    // Filter to supported files
    const supportedFiles = tree.filter((item) => shouldIncludeFile(item.path));
    console.log(
      `[indexer] Found ${supportedFiles.length} supported files out of ${tree.length} total`
    );

    // Update file count
    await supabase
      .from("codebase_connections")
      .update({ file_count: supportedFiles.length })
      .eq("id", connectionId);

    // Process files in batches
    let processedCount = 0;

    for (let i = 0; i < supportedFiles.length; i += BATCH_SIZE) {
      const batch = supportedFiles.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (file) => {
          try {
            const content = await fetchFileContent(
              githubToken,
              owner,
              repo,
              file.path
            );

            // Skip large files (> 100KB)
            if (content.length > 100_000) {
              console.log(`[indexer] Skipping large file: ${file.path}`);
              return;
            }

            const language = detectLanguage(file.path);
            const moduleType = detectModuleType(file.path);
            const fileName = file.path.split("/").pop() || file.path;
            const moduleName = fileName.replace(/\.[^.]+$/, "");
            const parsed = parseFile(content, language);

            // Upsert module
            await supabase.from("codebase_modules").upsert(
              {
                connection_id: connectionId,
                workspace_id: workspaceId,
                file_path: file.path,
                module_name: moduleName,
                module_type: moduleType,
                language,
                raw_content: content,
                dependencies: parsed.imports.slice(0, 50),
                exports: parsed.exports.slice(0, 50),
                parsed_ast: {
                  functions: parsed.functions,
                  classes: parsed.classes,
                  types: parsed.types,
                },
                updated_at: new Date().toISOString(),
              },
              { onConflict: "connection_id,file_path", ignoreDuplicates: false }
            );

            processedCount++;
          } catch (err) {
            console.error(`[indexer] Failed to process ${file.path}:`, err);
          }
        })
      );

      // Update module count after each batch
      await supabase
        .from("codebase_connections")
        .update({ module_count: processedCount })
        .eq("id", connectionId);

      if (i + BATCH_SIZE < supportedFiles.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    console.log(
      `[indexer] Stored ${processedCount} modules. Starting AI summarization...`
    );

    // AI Summarization pass
    await summarizeModules(connectionId, workspaceId);

    // Generate architecture summary
    await generateArchitectureSummary(connectionId, workspaceId);

    // Mark as ready
    await supabase
      .from("codebase_connections")
      .update({
        status: "ready",
        last_synced_at: new Date().toISOString(),
        module_count: processedCount,
      })
      .eq("id", connectionId);

    console.log(`[indexer] Indexing complete for ${connection.repo_name}`);
  } catch (err) {
    console.error(`[indexer] Indexing failed:`, err);
    await supabase
      .from("codebase_connections")
      .update({
        status: "error",
        error_message:
          err instanceof Error ? err.message : "Unknown error during indexing",
      })
      .eq("id", connectionId);
  }
}

async function summarizeModules(
  connectionId: string,
  workspaceId: string
): Promise<void> {
  const supabase = createAdminClient();

  // Get all modules that need summarization
  const { data: modules, error } = await supabase
    .from("codebase_modules")
    .select("id, file_path, raw_content, exports")
    .eq("connection_id", connectionId)
    .is("summary", null);

  if (error || !modules || modules.length === 0) {
    console.log("[indexer] No modules to summarize");
    return;
  }

  console.log(`[indexer] Summarizing ${modules.length} modules...`);

  for (let i = 0; i < modules.length; i += BATCH_SIZE) {
    const batch = modules.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (mod) => {
        try {
          // Truncate content for summarization (first 4000 chars)
          const truncatedContent = mod.raw_content?.slice(0, 4000) || "";

          const response = await anthropic.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 200,
            messages: [
              {
                role: "user",
                content: `Describe what this code module does in 2-3 sentences. Be specific about its purpose, what data it handles, and what it exports. File: ${mod.file_path}\n\n${truncatedContent}`,
              },
            ],
          });

          const summary =
            response.content[0].type === "text"
              ? response.content[0].text
              : "";

          // Store summary
          await supabase
            .from("codebase_modules")
            .update({ summary })
            .eq("id", mod.id);

          // Generate embedding for summary + exports
          const embeddingText = `${mod.file_path}\n${summary}\nExports: ${(mod.exports || []).join(", ")}`;
          try {
            const embedding = await generateEmbedding(embeddingText);

            await supabase
              .from("codebase_modules")
              .update({ embedding: JSON.stringify(embedding) })
              .eq("id", mod.id);

            // Also store in the main embeddings table for unified search
            await supabase.from("embeddings").upsert(
              {
                workspace_id: workspaceId,
                source_id: mod.id,
                source_type: "codebase_module",
                chunk_text: embeddingText,
                chunk_index: 0,
                embedding: JSON.stringify(embedding),
                metadata: { file_path: mod.file_path },
              },
              { onConflict: "source_id,source_type,chunk_index" }
            );
          } catch (embErr) {
            console.error(
              `[indexer] Embedding failed for ${mod.file_path}:`,
              embErr
            );
          }
        } catch (err) {
          console.error(
            `[indexer] Summarization failed for ${mod.file_path}:`,
            err
          );
        }
      })
    );

    if (i + BATCH_SIZE < modules.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }
}

async function generateArchitectureSummary(
  connectionId: string,
  workspaceId: string
): Promise<void> {
  const supabase = createAdminClient();

  // Fetch all module summaries
  const { data: modules } = await supabase
    .from("codebase_modules")
    .select("file_path, module_name, module_type, language, summary, exports")
    .eq("connection_id", connectionId)
    .not("summary", "is", null)
    .order("file_path");

  if (!modules || modules.length === 0) {
    console.log("[indexer] No summarized modules for architecture overview");
    return;
  }

  // Build module overview string
  const moduleOverview = modules
    .map(
      (m) =>
        `[${m.module_type || "unknown"}] ${m.file_path} (${m.language})\nExports: ${(m.exports || []).join(", ")}\n${m.summary}`
    )
    .join("\n\n");

  console.log(
    `[indexer] Generating architecture summary from ${modules.length} modules...`
  );

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `Based on these code modules, generate a structured architecture overview of this codebase. Include: tech stack, main services/modules, data models, API surface, key dependencies, and how the major pieces connect. Be specific and reference actual file paths.\n\nIMPORTANT: Respond in clean plain text only. Do not use markdown formatting characters like **, ##, \`, or other syntax markers. Use clear paragraphs, dashes for bullet points, and blank lines between sections. Use ALL CAPS for section labels.\n\n${moduleOverview}`,
      },
    ],
  });

  const architectureContent =
    response.content[0].type === "text" ? response.content[0].text : "";

  if (!architectureContent) return;

  // Store as an artifact
  const { data: existing } = await supabase
    .from("artifacts")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("type", "architecture_summary")
    .single();

  if (existing) {
    await supabase
      .from("artifacts")
      .update({
        content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: architectureContent }] }] },
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("artifacts").insert({
      workspace_id: workspaceId,
      type: "architecture_summary",
      title: "Codebase Architecture",
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: architectureContent }] }] },
      status: "active",
    });
  }

  console.log("[indexer] Architecture summary generated");
}

export async function resyncRepository(
  connectionId: string,
  workspaceId: string,
  githubToken: string
): Promise<void> {
  const supabase = createAdminClient();

  const { data: connection } = await supabase
    .from("codebase_connections")
    .select("*")
    .eq("id", connectionId)
    .single();

  if (!connection) return;

  const [owner, repo] = connection.repo_name.split("/");

  try {
    await supabase
      .from("codebase_connections")
      .update({ status: "syncing", error_message: null })
      .eq("id", connectionId);

    // Fetch current tree
    const tree = await fetchRepoTree(
      githubToken,
      owner,
      repo,
      connection.default_branch
    );
    const supportedFiles = tree.filter((item) => shouldIncludeFile(item.path));
    const currentPaths = new Set(supportedFiles.map((f) => f.path));

    // Get existing modules
    const { data: existingModules } = await supabase
      .from("codebase_modules")
      .select("id, file_path")
      .eq("connection_id", connectionId);

    const existingPaths = new Set(
      (existingModules || []).map((m) => m.file_path)
    );

    // Delete removed files
    const removedModules = (existingModules || []).filter(
      (m) => !currentPaths.has(m.file_path)
    );
    if (removedModules.length > 0) {
      const removedIds = removedModules.map((m) => m.id);
      await supabase
        .from("codebase_modules")
        .delete()
        .in("id", removedIds);

      // Clean up embeddings
      await supabase
        .from("embeddings")
        .delete()
        .in("source_id", removedIds)
        .eq("source_type", "codebase_module");

      console.log(`[indexer] Removed ${removedModules.length} deleted files`);
    }

    // Find new files
    const newFiles = supportedFiles.filter(
      (f) => !existingPaths.has(f.path)
    );

    await supabase
      .from("codebase_connections")
      .update({ file_count: supportedFiles.length })
      .eq("id", connectionId);

    // Process new files
    let processedCount = 0;
    for (let i = 0; i < newFiles.length; i += BATCH_SIZE) {
      const batch = newFiles.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (file) => {
          try {
            const content = await fetchFileContent(
              githubToken,
              owner,
              repo,
              file.path
            );

            if (content.length > 100_000) return;

            const language = detectLanguage(file.path);
            const moduleType = detectModuleType(file.path);
            const fileName = file.path.split("/").pop() || file.path;
            const moduleName = fileName.replace(/\.[^.]+$/, "");
            const parsed = parseFile(content, language);

            await supabase.from("codebase_modules").insert({
              connection_id: connectionId,
              workspace_id: workspaceId,
              file_path: file.path,
              module_name: moduleName,
              module_type: moduleType,
              language,
              raw_content: content,
              dependencies: parsed.imports.slice(0, 50),
              exports: parsed.exports.slice(0, 50),
              parsed_ast: {
                functions: parsed.functions,
                classes: parsed.classes,
                types: parsed.types,
              },
              updated_at: new Date().toISOString(),
            });

            processedCount++;
          } catch (err) {
            console.error(`[indexer] Failed to process ${file.path}:`, err);
          }
        })
      );

      if (i + BATCH_SIZE < newFiles.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    console.log(`[indexer] Re-sync: ${processedCount} new files, ${removedModules.length} removed`);

    // Re-summarize new modules
    if (processedCount > 0) {
      await summarizeModules(connectionId, workspaceId);
    }

    // Re-generate architecture summary
    await generateArchitectureSummary(connectionId, workspaceId);

    // Get final counts
    const { count } = await supabase
      .from("codebase_modules")
      .select("*", { count: "exact", head: true })
      .eq("connection_id", connectionId);

    await supabase
      .from("codebase_connections")
      .update({
        status: "ready",
        last_synced_at: new Date().toISOString(),
        module_count: count || 0,
      })
      .eq("id", connectionId);
  } catch (err) {
    console.error("[indexer] Re-sync failed:", err);
    await supabase
      .from("codebase_connections")
      .update({
        status: "error",
        error_message:
          err instanceof Error ? err.message : "Unknown error during re-sync",
      })
      .eq("id", connectionId);
  }
}
