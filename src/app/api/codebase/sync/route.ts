import { NextResponse } from "next/server";
import { resyncRepository } from "@/lib/codebase/index";
import { getAuthenticatedWorkspace } from "@/lib/api/get-workspace";

export async function POST() {
  const result = await getAuthenticatedWorkspace<{ id: string; github_token: string | null }>(
    "id, github_token"
  );
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  const { workspace, supabase } = result;

  if (!workspace.github_token) {
    return NextResponse.json(
      { error: "GitHub not connected" },
      { status: 400 }
    );
  }

  const { data: connection } = await supabase
    .from("codebase_connections")
    .select("*")
    .eq("workspace_id", workspace.id)
    .single();

  if (!connection) {
    return NextResponse.json(
      { error: "No repository connected" },
      { status: 404 }
    );
  }

  if (connection.status === "syncing") {
    return NextResponse.json(
      { error: "Sync already in progress" },
      { status: 409 }
    );
  }

  // Fire-and-forget re-sync
  resyncRepository(connection.id, workspace.id, workspace.github_token).catch(
    (err) => console.error("[codebase/sync] Background re-sync failed:", err)
  );

  return NextResponse.json({ status: "syncing" });
}
