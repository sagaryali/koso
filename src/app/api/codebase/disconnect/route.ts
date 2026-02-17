import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedWorkspace } from "@/lib/api/get-workspace";

export async function POST() {
  const result = await getAuthenticatedWorkspace("id");
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  const { workspace } = result;

  const admin = createAdminClient();

  // Get connection to clean up embeddings
  const { data: connection } = await admin
    .from("codebase_connections")
    .select("id")
    .eq("workspace_id", workspace.id)
    .single();

  if (connection) {
    // Delete embeddings for codebase modules
    const { data: modules } = await admin
      .from("codebase_modules")
      .select("id")
      .eq("connection_id", connection.id);

    if (modules && modules.length > 0) {
      await admin
        .from("embeddings")
        .delete()
        .in(
          "source_id",
          modules.map((m) => m.id)
        )
        .eq("source_type", "codebase_module");
    }

    // Delete modules (cascade from connection delete handles this, but be explicit)
    await admin
      .from("codebase_modules")
      .delete()
      .eq("connection_id", connection.id);

    // Delete connection
    await admin
      .from("codebase_connections")
      .delete()
      .eq("id", connection.id);
  }

  // Delete architecture summary artifact
  await admin
    .from("artifacts")
    .delete()
    .eq("workspace_id", workspace.id)
    .eq("type", "architecture_summary");

  return NextResponse.json({ success: true });
}
