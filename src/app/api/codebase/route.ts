import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedWorkspace } from "@/lib/api/get-workspace";

export async function GET() {
  const result = await getAuthenticatedWorkspace("id");
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  const { workspace } = result;

  const admin = createAdminClient();

  // Get all connections for workspace
  const { data: connections } = await admin
    .from("codebase_connections")
    .select("*")
    .eq("workspace_id", workspace.id);

  if (!connections || connections.length === 0) {
    return NextResponse.json({ connection: null, modules: [] });
  }

  // Fetch modules across all connections
  const connectionIds = connections.map((c) => c.id);
  const { data: modules } = await admin
    .from("codebase_modules")
    .select(
      "id, file_path, module_name, module_type, language, summary, exports, dependencies, connection_id"
    )
    .in("connection_id", connectionIds)
    .order("file_path");

  return NextResponse.json({
    connection: connections[0],
    connections,
    modules: modules || [],
  });
}
