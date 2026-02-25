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

  console.log("[codebase/status] workspace_id:", workspace.id, "connections:", connections?.length ?? 0, "error:", connError?.message ?? "none");

  const allConnections = connections ?? [];

  return NextResponse.json({
    connection: allConnections.length > 0 ? allConnections[0] : null,
    connections: allConnections,
    githubUsername: workspace.github_username,
  });
}
