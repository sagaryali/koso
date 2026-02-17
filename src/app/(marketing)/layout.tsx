import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Koso — AI-Native IDE for Product Managers",
  description:
    "Customer feedback and codebase, in one conversation. The AI-native IDE for product managers.",
  openGraph: {
    title: "Koso — AI-Native IDE for Product Managers",
    description:
      "Customer feedback and codebase, in one conversation.",
    type: "website",
    siteName: "Koso",
  },
  twitter: {
    card: "summary_large_image",
    title: "Koso — AI-Native IDE for Product Managers",
    description:
      "Customer feedback and codebase, in one conversation.",
  },
};

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/home");
  }

  return <>{children}</>;
}
