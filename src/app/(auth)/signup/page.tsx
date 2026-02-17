"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Input, KosoWordmark } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { setActiveWorkspaceCookie } from "@/lib/workspace-cookie";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Create default workspace for the new user
    if (data.user) {
      const { data: ws } = await supabase
        .from("workspaces")
        .insert({
          user_id: data.user.id,
          name: "My Product",
          product_description: null,
          principles: [],
        })
        .select("id")
        .single();

      if (ws) {
        setActiveWorkspaceCookie(ws.id);
      }
    }

    router.push("/onboarding");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-[360px] px-6">
        <div className="mb-10">
          <KosoWordmark size={28} />
          <p className="mt-3 text-sm text-text-tertiary">
            The IDE for product managers
          </p>
          <p className="mt-4 text-sm text-text-secondary">
            Create your account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="Email"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            helperText="At least 6 characters"
          />

          {error && <p className="text-xs text-state-error">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-text-secondary">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-text-primary underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
