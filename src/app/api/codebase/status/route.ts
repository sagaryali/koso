import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedWorkspace } from "@/lib/api/get-workspace";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await getAuthenticatedWorkspace<{ id: string; github_username: string | null }>(
    "id, github_username"
  );
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  const { workspace } = result;

  // Use admin client to bypass RLS — connections are created via admin
  const admin = createAdminClient();
  const { data: connections, error: connError } = await admin
    .from("codebase_connections")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: true });

  // Also check if there are connections on ANY workspace (debug workspace mismatch)
  const { data: allConns } = await admin
    .from("codebase_connections")
    .select("id, workspace_id, repo_name, status");

  console.log("[codebase/status] active_workspace:", workspace.id, "found:", connections?.length ?? 0, "error:", connError?.message ?? "none", "all_connections:", JSON.stringify(allConns?.map(c => ({ ws: c.workspace_id, repo: c.repo_name })) ?? []));

  const allConnections = connections ?? [];

  return NextResponse.json({
    connection: allConnections.length > 0 ? allConnections[0] : null,
    connections: allConnections,
    githubUsername: workspace.github_username,
    _debug: {
      workspaceId: workspace.id,
      totalConnectionsAcrossAllWorkspaces: allConns?.length ?? 0,
      connectionsForThisWorkspace: connections?.length ?? 0,
      allConnectionWorkspaces: allConns?.map(c => ({ ws: c.workspace_id, repo: c.repo_name })) ?? [],
    },
  });
}
