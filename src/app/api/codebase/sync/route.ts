import { NextRequest, NextResponse, after } from "next/server";
import { resyncRepository } from "@/lib/codebase/index";
import { getAuthenticatedWorkspace } from "@/lib/api/get-workspace";

export async function POST(request: NextRequest) {
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

  // Accept optional connectionId to sync a specific repo
  let connectionId: string | null = null;
  try {
    const body = await request.json();
    connectionId = body.connectionId ?? null;
  } catch {
    // No body — sync all
  }

  if (connectionId) {
    // Sync a specific connection
    const { data: connection } = await supabase
      .from("codebase_connections")
      .select("*")
      .eq("id", connectionId)
      .eq("workspace_id", workspace.id)
      .single();

    if (!connection) {
      return NextResponse.json(
        { error: "Connection not found" },
        { status: 404 }
      );
    }

    if (connection.status === "syncing") {
      const updatedAt = new Date(connection.updated_at).getTime();
      const fiveMinutes = 5 * 60 * 1000;
      if (Date.now() - updatedAt < fiveMinutes) {
        return NextResponse.json(
          { error: "Sync already in progress" },
          { status: 409 }
        );
      }
    }

    after(async () => {
      try {
        await resyncRepository(connection.id, workspace.id, workspace.github_token!);
      } catch (err) {
        console.error("[codebase/sync] Background re-sync failed:", err);
      }
    });
  } else {
    // Sync all connections
    const { data: connections } = await supabase
      .from("codebase_connections")
      .select("*")
      .eq("workspace_id", workspace.id);

    if (!connections || connections.length === 0) {
      return NextResponse.json(
        { error: "No repositories connected" },
        { status: 404 }
      );
    }

    for (const connection of connections) {
      if (connection.status === "syncing") {
        const updatedAt = new Date(connection.updated_at).getTime();
        const fiveMinutes = 5 * 60 * 1000;
        if (Date.now() - updatedAt < fiveMinutes) {
          continue; // Skip connections that are actively syncing
        }
      }

      after(async () => {
        try {
          await resyncRepository(connection.id, workspace.id, workspace.github_token!);
        } catch (err) {
          console.error("[codebase/sync] Background re-sync failed:", err);
        }
      });
    }
  }

  return NextResponse.json({ status: "syncing" });
}
