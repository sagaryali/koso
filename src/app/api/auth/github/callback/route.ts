import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchGitHubUser } from "@/lib/codebase/github";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(
      new URL("/settings?error=github_no_code", request.url)
    );
  }

  // Exchange code for token
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const tokenData = await tokenRes.json();

  if (tokenData.error || !tokenData.access_token) {
    console.error("[github-oauth] Token exchange failed:", tokenData.error);
    return NextResponse.redirect(
      new URL("/settings?error=github_token_failed", request.url)
    );
  }

  const accessToken = tokenData.access_token;

  // Get GitHub username
  let githubUsername: string;
  try {
    const user = await fetchGitHubUser(accessToken);
    githubUsername = user.login;
  } catch {
    return NextResponse.redirect(
      new URL("/settings?error=github_user_failed", request.url)
    );
  }

  // Get current Supabase user
  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Store token in workspace using admin client (bypasses RLS)
  const admin = createAdminClient();
  const { error } = await admin
    .from("workspaces")
    .update({
      github_token: accessToken,
      github_username: githubUsername,
    })
    .eq("user_id", user.id);

  if (error) {
    console.error("[github-oauth] Failed to store token:", error);
    return NextResponse.redirect(
      new URL("/settings?error=github_store_failed", request.url)
    );
  }

  // Redirect back to the page that initiated the OAuth flow
  const state = request.nextUrl.searchParams.get("state");
  const returnTo = state ? decodeURIComponent(state) : "/settings";
  const redirectUrl = new URL(
    returnTo.startsWith("/") ? `${returnTo}${returnTo.includes("?") ? "&" : "?"}github=connected` : "/settings?github=connected",
    request.url
  );

  return NextResponse.redirect(redirectUrl);
}
