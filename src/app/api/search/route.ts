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
      const context = await assembleContext(query, workspaceId);
      const supabase = createAdminClient();

      // Enrich artifacts with title and type metadata
      const artifactIds = [
        ...new Set(context.artifacts.map((a) => a.sourceId)),
      ];
      if (artifactIds.length > 0) {
        const { data } = await supabase
          .from("artifacts")
          .select("id, title, type, status")
          .in("id", artifactIds);

        const map = new Map(data?.map((a) => [a.id, a]) ?? []);
        for (const r of context.artifacts) {
          const meta = map.get(r.sourceId);
          if (meta) {
            r.metadata = {
              ...r.metadata,
              title: meta.title,
              type: meta.type,
              status: meta.status,
            };
          }
        }
      }

      // Enrich evidence with source, tags, and full content
      const evidenceIds = [
        ...new Set(context.evidence.map((e) => e.sourceId)),
      ];
      if (evidenceIds.length > 0) {
        const { data } = await supabase
          .from("evidence")
          .select("id, title, type, source, tags, content")
          .in("id", evidenceIds);

        const map = new Map(data?.map((e) => [e.id, e]) ?? []);
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

      // Enrich codebase modules with module metadata and raw_content
      const moduleIds = [
        ...new Set(context.codebaseModules.map((m) => m.sourceId)),
      ];
      if (moduleIds.length > 0) {
        const { data } = await supabase
          .from("codebase_modules")
          .select(
            "id, file_path, module_name, module_type, language, summary, raw_content"
          )
          .in("id", moduleIds);

        const map = new Map(data?.map((m) => [m.id, m]) ?? []);
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
