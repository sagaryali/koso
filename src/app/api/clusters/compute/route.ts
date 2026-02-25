import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedWorkspace } from "@/lib/api/get-workspace";
import { shouldRecompute, computeClusters } from "@/lib/clusters/compute";

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedWorkspace();
    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const { workspaceId } = await request.json();
    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspaceId is required" },
        { status: 400 }
      );
    }

    const needsRecompute = await shouldRecompute(workspaceId);
    if (!needsRecompute) {
      return NextResponse.json({ skipped: true });
    }

    // Fire-and-forget
    computeClusters(workspaceId).catch((err) =>
      console.error("[api/clusters/compute] Background error:", err)
    );

    return NextResponse.json({ started: true });
  } catch (err) {
    console.error("[api/clusters/compute] Error:", err);
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
