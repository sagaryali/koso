import { NextResponse } from "next/server";
import { getAuthenticatedWorkspace } from "@/lib/api/get-workspace";

export async function GET() {
  const result = await getAuthenticatedWorkspace("id");
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  const { workspace, supabase } = result;

  // Get connection and modules
  const { data: connection } = await supabase
    .from("codebase_connections")
    .select("*")
    .eq("workspace_id", workspace.id)
    .single();

  if (!connection) {
    return NextResponse.json({ connection: null, modules: [] });
  }

  const { data: modules } = await supabase
    .from("codebase_modules")
    .select(
      "id, file_path, module_name, module_type, language, summary, exports, dependencies"
    )
    .eq("connection_id", connection.id)
    .order("file_path");

  return NextResponse.json({
    connection,
    modules: modules || [],
  });
}
