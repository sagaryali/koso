import { NextRequest, NextResponse } from "next/server";
import {
  similaritySearch,
  assembleContext,
} from "@/lib/embeddings/retrieve";
import type { SearchOptions } from "@/lib/embeddings/retrieve";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, workspaceId, sourceTypes, limit, grouped } = body;

    if (!query || !workspaceId) {
      return NextResponse.json(
        { error: "query and workspaceId are required" },
        { status: 400 }
      );
    }

    if (grouped) {
      const context = await assembleContext(query, workspaceId, sourceTypes);
      const supabase = createAdminClient();

      // Parallelize all three enrichment queries
      const artifactIds = [
        ...new Set(context.artifacts.map((a) => a.sourceId)),
      ];
      const evidenceIds = [
        ...new Set(context.evidence.map((e) => e.sourceId)),
      ];
      const moduleIds = [
        ...new Set(context.codebaseModules.map((m) => m.sourceId)),
      ];

      const [artifactData, evidenceData, moduleData] = await Promise.all([
        artifactIds.length > 0
          ? supabase
              .from("artifacts")
              .select("id, title, type")
              .in("id", artifactIds)
              .then((r) => r.data)
          : Promise.resolve(null),
        evidenceIds.length > 0
          ? supabase
              .from("evidence")
              .select("id, title, type, source, tags, content")
              .in("id", evidenceIds)
              .then((r) => r.data)
          : Promise.resolve(null),
        moduleIds.length > 0
          ? supabase
              .from("codebase_modules")
              .select(
                "id, file_path, module_name, module_type, language, summary, raw_content"
              )
              .in("id", moduleIds)
              .then((r) => r.data)
          : Promise.resolve(null),
      ]);

      // Enrich artifacts
      if (artifactData) {
        const map = new Map(artifactData.map((a) => [a.id, a]));
        for (const r of context.artifacts) {
          const meta = map.get(r.sourceId);
          if (meta) {
            r.metadata = {
              ...r.metadata,
              title: meta.title,
              type: meta.type,
            };
          }
        }
      }

      // Enrich evidence
      if (evidenceData) {
        const map = new Map(evidenceData.map((e) => [e.id, e]));
        for (const r of context.evidence) {
          const meta = map.get(r.sourceId);
          if (meta) {
            r.metadata = {
              ...r.metadata,
              title: meta.title,
              type: meta.type,
              source: meta.source,
              tags: meta.tags,
              full_content: meta.content,
            };
          }
        }
      }

      // Enrich codebase modules
      if (moduleData) {
        const map = new Map(moduleData.map((m) => [m.id, m]));
        for (const r of context.codebaseModules) {
          const meta = map.get(r.sourceId);
          if (meta) {
            r.metadata = {
              ...r.metadata,
              file_path: meta.file_path,
              module_name: meta.module_name,
              module_type: meta.module_type,
              language: meta.language,
              summary: meta.summary,
              raw_content: meta.raw_content,
            };
          }
        }
      }

      return NextResponse.json({ results: context });
    }

    const options: SearchOptions = {};
    if (sourceTypes) options.sourceTypes = sourceTypes;
    if (limit) options.limit = limit;

    const results = await similaritySearch(query, workspaceId, options);
    return NextResponse.json({ results });
  } catch (err) {
    console.error("[api/search] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
