import { NextResponse } from "next/server";
import { fetchUserRepos } from "@/lib/codebase/github";
import { getAuthenticatedWorkspace } from "@/lib/api/get-workspace";

function isDemoMode() {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

const MOCK_REPOS = [
  {
    id: 1,
    full_name: "taskflow/taskflow-app",
    name: "taskflow-app",
    description: "TaskFlow main application — Next.js + Supabase",
    language: "TypeScript",
    default_branch: "main",
    html_url: "https://github.com/taskflow/taskflow-app",
    updated_at: new Date().toISOString(),
    private: false,
  },
  {
    id: 2,
    full_name: "taskflow/taskflow-mobile",
    name: "taskflow-mobile",
    description: "TaskFlow mobile app (React Native)",
    language: "TypeScript",
    default_branch: "main",
    html_url: "https://github.com/taskflow/taskflow-mobile",
    updated_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    private: true,
  },
  {
    id: 3,
    full_name: "taskflow/taskflow-docs",
    name: "taskflow-docs",
    description: "Public documentation and API reference",
    language: "MDX",
    default_branch: "main",
    html_url: "https://github.com/taskflow/taskflow-docs",
    updated_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    private: false,
  },
];

export async function GET() {
  // Demo mode: return canned repo list
  if (isDemoMode()) {
    return NextResponse.json({ repos: MOCK_REPOS });
  }

  const result = await getAuthenticatedWorkspace<{ github_token: string | null }>(
    "github_token"
  );
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  const { workspace } = result;

  if (!workspace.github_token) {
    return NextResponse.json(
      { error: "GitHub not connected" },
      { status: 400 }
    );
  }

  try {
    const repos = await fetchUserRepos(workspace.github_token);
    return NextResponse.json({ repos });
  } catch (err) {
    console.error("[codebase/repos] Failed to fetch repos:", err);
    return NextResponse.json(
      { error: "Failed to fetch repositories" },
      { status: 500 }
    );
  }
}
