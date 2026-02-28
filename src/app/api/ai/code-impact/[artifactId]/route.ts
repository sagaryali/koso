import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedWorkspace } from "@/lib/api/get-workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeContentHash } from "@/lib/utils";
import type { CodeImpactReport } from "@/types";

function extractTextContent(content: Record<string, unknown>): string {
  // Extract plain text from TipTap JSON document for hashing
  if (!content || typeof content !== "object") return "";

  try {
    return JSON.stringify(content);
  } catch {
    return "";
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ artifactId: string }> }
) {
  try {
    const auth = await getAuthenticatedWorkspace();
    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const { workspace } = auth;
    const { artifactId } = await params;
    const workspaceId = (workspace as { id: string }).id;

    const admin = createAdminClient();

    // Fetch stored report and current artifact content in parallel
    const [impactResult, artifactResult] = await Promise.all([
      admin
        .from("artifact_code_impact")
        .select("report, generated_at, source_type, spec_content_hash")
        .eq("artifact_id", artifactId)
        .eq("workspace_id", workspaceId)
        .single(),
      admin
        .from("artifacts")
        .select("content")
        .eq("id", artifactId)
        .eq("workspace_id", workspaceId)
        .single(),
    ]);

    if (!impactResult.data) {
      return NextResponse.json({
        report: null,
        generatedAt: null,
        sourceType: null,
        isStale: false,
      });
    }

    const storedHash = impactResult.data.spec_content_hash as number;
    const currentContent = artifactResult.data?.content;
    const currentHash = currentContent
      ? computeContentHash(extractTextContent(currentContent as Record<string, unknown>))
      : 0;

    return NextResponse.json({
      report: impactResult.data.report as CodeImpactReport,
      generatedAt: impactResult.data.generated_at,
      sourceType: impactResult.data.source_type,
      isStale: storedHash !== currentHash,
    });
  } catch (err) {
    console.error("[api/ai/code-impact/GET] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
