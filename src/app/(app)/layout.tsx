import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { WORKSPACE_COOKIE_NAME } from "@/lib/workspace-cookie";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: allWorkspaces } = await supabase
    .from("workspaces")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (!allWorkspaces || allWorkspaces.length === 0) {
    redirect("/onboarding");
  }

  const cookieStore = await cookies();
  const savedId = cookieStore.get(WORKSPACE_COOKIE_NAME)?.value;
  const workspace = allWorkspaces.find((w) => w.id === savedId) ?? allWorkspaces[0];

  return (
    <AppShell workspace={workspace} allWorkspaces={allWorkspaces}>
      {children}
    </AppShell>
  );
}
