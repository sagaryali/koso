"use client";

import { Nav } from "@/components/marketing/nav";
import { Hero } from "@/components/marketing/hero";
import { Problem } from "@/components/marketing/problem";
import { Workflow } from "@/components/marketing/workflow";
import { Features } from "@/components/marketing/features";
import { CTA } from "@/components/marketing/cta";
import { Footer } from "@/components/marketing/footer";

export default function MarketingPage() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Problem />
        <Workflow />
        <Features />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
