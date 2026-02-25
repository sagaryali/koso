import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedWorkspace } from "@/lib/api/get-workspace";

export async function POST(request: NextRequest) {
  const result = await getAuthenticatedWorkspace("id");
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  const { workspace } = result;

  const admin = createAdminClient();

  // Accept optional connectionId to disconnect a specific repo
  let connectionId: string | null = null;
  try {
    const body = await request.json();
    connectionId = body.connectionId ?? null;
  } catch {
    // No body — disconnect the first/only connection (backward compat)
  }

  let connection;
  if (connectionId) {
    // Disconnect specific connection
    const { data } = await admin
      .from("codebase_connections")
      .select("id")
      .eq("id", connectionId)
      .eq("workspace_id", workspace.id)
      .single();
    connection = data;
  } else {
    // Legacy: disconnect the first connection
    const { data } = await admin
      .from("codebase_connections")
      .select("id")
      .eq("workspace_id", workspace.id)
      .limit(1)
      .single();
    connection = data;
  }

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

    // Delete modules
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

  // Check if any connections remain
  const { count } = await admin
    .from("codebase_connections")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspace.id);

  // Only delete architecture summary if no connections remain
  if (!count || count === 0) {
    await admin
      .from("artifacts")
      .delete()
      .eq("workspace_id", workspace.id)
      .eq("type", "architecture_summary");
  }

  return NextResponse.json({ success: true });
}
