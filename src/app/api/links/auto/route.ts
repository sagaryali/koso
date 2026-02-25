import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { autoLinkEvidence, autoLinkArtifact } from "@/lib/auto-link";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceId, sourceType, workspaceId } = body;

    if (!sourceId || !sourceType || !workspaceId) {
      return NextResponse.json(
        { error: "sourceId, sourceType, and workspaceId are required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    let linksCreated = 0;

    if (sourceType === "evidence") {
      linksCreated = await autoLinkEvidence(sourceId, workspaceId, supabase);
    } else if (sourceType === "artifact") {
      linksCreated = await autoLinkArtifact(sourceId, workspaceId, supabase);
    } else {
      return NextResponse.json(
        { error: "sourceType must be evidence or artifact" },
        { status: 400 }
      );
    }

    return NextResponse.json({ linksCreated });
  } catch (err) {
    console.error("[api/links/auto] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
