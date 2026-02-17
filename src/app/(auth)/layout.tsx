import { cookies } from "next/headers";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Reading cookies forces dynamic rendering, preventing build-time prerendering
  // that would fail without Supabase env vars
  await cookies();
  return <>{children}</>;
}
