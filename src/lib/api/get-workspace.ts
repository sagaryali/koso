import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { WORKSPACE_COOKIE_NAME } from "@/lib/workspace-cookie";

type SuccessResult<T> = {
  user: { id: string; email?: string };
  workspace: T;
  supabase: ReturnType<typeof createServerClient>;
};

type ErrorResult = {
  error: string;
  status: number;
};

export async function getAuthenticatedWorkspace<
  T extends Record<string, unknown> = { id: string },
>(
  selectFields = "id"
): Promise<SuccessResult<T> | ErrorResult> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Unauthorized", status: 401 };
  }

  const workspaceId = cookieStore.get(WORKSPACE_COOKIE_NAME)?.value;
  if (!workspaceId) {
    return { error: "No workspace selected", status: 400 };
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select(selectFields)
    .eq("id", workspaceId)
    .eq("user_id", user.id)
    .single();

  if (!workspace) {
    return { error: "Workspace not found", status: 404 };
  }

  return { user, workspace: workspace as unknown as T, supabase };
}
