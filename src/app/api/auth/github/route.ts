import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "GitHub OAuth not configured" },
      { status: 500 }
    );
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/github/callback`;
  const scope = "repo read:user";

  // Pass return_to as OAuth state so callback knows where to redirect
  const returnTo = request.nextUrl.searchParams.get("return_to") || "";
  const state = returnTo ? encodeURIComponent(returnTo) : "";

  let url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`;
  if (state) {
    url += `&state=${state}`;
  }

  return NextResponse.redirect(url);
}
