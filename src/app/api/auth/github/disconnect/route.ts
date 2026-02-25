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

  // Delete all codebase connections, modules, and embeddings
  const { data: connections } = await admin
    .from("codebase_connections")
    .select("id")
    .eq("workspace_id", workspace.id);

  if (connections) {
    for (const conn of connections) {
      const { data: modules } = await admin
        .from("codebase_modules")
        .select("id")
        .eq("connection_id", conn.id);

      if (modules && modules.length > 0) {
        await admin
          .from("embeddings")
          .delete()
          .in("source_id", modules.map((m) => m.id))
          .eq("source_type", "codebase_module");
      }

      await admin
        .from("codebase_modules")
        .delete()
        .eq("connection_id", conn.id);

      await admin
        .from("codebase_connections")
        .delete()
        .eq("id", conn.id);
    }
  }

  // Delete architecture summary
  await admin
    .from("artifacts")
    .delete()
    .eq("workspace_id", workspace.id)
    .eq("type", "architecture_summary");

  // Clear GitHub token and username from workspace
  await admin
    .from("workspaces")
    .update({ github_token: null, github_username: null })
    .eq("id", workspace.id);

  return NextResponse.json({ success: true });
}
