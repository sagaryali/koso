import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { indexRepository } from "@/lib/codebase/index";
import { getAuthenticatedWorkspace } from "@/lib/api/get-workspace";

export async function POST(request: NextRequest) {
  const result = await getAuthenticatedWorkspace<{ id: string; github_token: string | null }>(
    "id, github_token"
  );
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  const { workspace } = result;

  const body = await request.json();
  const { repoFullName, repoUrl, defaultBranch } = body;

  if (!repoFullName || !repoUrl) {
    return NextResponse.json(
      { error: "Missing repo information" },
      { status: 400 }
    );
  }

  if (!workspace.github_token) {
    return NextResponse.json(
      { error: "GitHub not connected" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Check if already connected
  const { data: existing } = await admin
    .from("codebase_connections")
    .select("id")
    .eq("workspace_id", workspace.id)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: "A repository is already connected. Disconnect first." },
      { status: 409 }
    );
  }

  // Create connection
  const { data: connection, error } = await admin
    .from("codebase_connections")
    .insert({
      workspace_id: workspace.id,
      repo_url: repoUrl,
      repo_name: repoFullName,
      default_branch: defaultBranch || "main",
      status: "pending",
    })
    .select()
    .single();

  if (error || !connection) {
    console.error("[codebase/connect] Failed to create connection:", error);
    return NextResponse.json(
      { error: "Failed to create connection" },
      { status: 500 }
    );
  }

  // Fire-and-forget indexing
  indexRepository(connection.id, workspace.id, workspace.github_token).catch(
    (err) => console.error("[codebase/connect] Background indexing failed:", err)
  );

  return NextResponse.json({ connection });
}
