import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedWorkspace } from "@/lib/api/get-workspace";

export async function POST() {
  try {
    const result = await getAuthenticatedWorkspace("id");
    if ("error" in result) {
      console.error("[github/disconnect] Auth error:", result.error);
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    const { workspace } = result;

    const admin = createAdminClient();

    // Delete all codebase connections, modules, and embeddings
    const { data: connections, error: connError } = await admin
      .from("codebase_connections")
      .select("id")
      .eq("workspace_id", workspace.id);

    if (connError) {
      console.error("[github/disconnect] Failed to fetch connections:", connError);
    }

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

    // Delete evidence clusters
    await admin
      .from("evidence_clusters")
      .delete()
      .eq("workspace_id", workspace.id);

    // Clear GitHub token and username from workspace
    const { error: updateError } = await admin
      .from("workspaces")
      .update({ github_token: null, github_username: null })
      .eq("id", workspace.id);

    if (updateError) {
      console.error("[github/disconnect] Failed to clear workspace tokens:", updateError);
      return NextResponse.json({ error: "Failed to update workspace" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[github/disconnect] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
