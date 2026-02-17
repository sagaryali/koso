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

  const { data: connection } = await supabase
    .from("codebase_connections")
    .select("*")
    .eq("workspace_id", workspace.id)
    .single();

  if (!connection) {
    return NextResponse.json({ connection: null, githubUsername: workspace.github_username });
  }

  return NextResponse.json({
    connection,
    githubUsername: workspace.github_username,
  });
}
