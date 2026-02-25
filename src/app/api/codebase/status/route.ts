import { NextResponse } from "next/server";
import { getAuthenticatedWorkspace } from "@/lib/api/get-workspace";

export async function GET() {
  const result = await getAuthenticatedWorkspace<{ id: string; github_username: string | null }>(
    "id, github_username"
  );
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  const { workspace, supabase } = result;

  const { data: connections } = await supabase
    .from("codebase_connections")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: true });

  const allConnections = connections ?? [];

  return NextResponse.json({
    // Backward compat: first connection as `connection`
    connection: allConnections.length > 0 ? allConnections[0] : null,
    connections: allConnections,
    githubUsername: workspace.github_username,
  });
}
