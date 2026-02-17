import { NextRequest, NextResponse } from "next/server";
import { embedAndStore } from "@/lib/embeddings/generate";
import { createAdminClient } from "@/lib/supabase/admin";

function isDemoMode() {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceId, sourceType } = body;

    if (!sourceId || !sourceType) {
      return NextResponse.json(
        { error: "sourceId and sourceType are required" },
        { status: 400 }
      );
    }

    // Demo mode: skip embedding generation (seed data has pre-computed embeddings)
    if (isDemoMode()) {
      return NextResponse.json({ success: true });
    }

    if (!["artifact", "evidence", "codebase_module"].includes(sourceType)) {
      return NextResponse.json(
        { error: "sourceType must be artifact, evidence, or codebase_module" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    let content: string | Record<string, unknown>;
    let workspaceId: string;

    if (sourceType === "artifact") {
      const { data, error } = await supabase
        .from("artifacts")
        .select("content, workspace_id")
        .eq("id", sourceId)
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: "Artifact not found" },
          { status: 404 }
        );
      }
      content = data.content;
      workspaceId = data.workspace_id;
    } else if (sourceType === "evidence") {
      const { data, error } = await supabase
        .from("evidence")
        .select("content, workspace_id")
        .eq("id", sourceId)
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: "Evidence not found" },
          { status: 404 }
        );
      }
      content = data.content;
      workspaceId = data.workspace_id;
    } else {
      const { data, error } = await supabase
        .from("codebase_modules")
        .select("raw_content, summary, workspace_id")
        .eq("id", sourceId)
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: "Codebase module not found" },
          { status: 404 }
        );
      }
      content = data.summary || data.raw_content || "";
      workspaceId = data.workspace_id;
    }

    await embedAndStore(sourceId, sourceType, workspaceId, content);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/embeddings/index] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
