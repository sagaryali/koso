"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "./scroll-reveal";

export function CTA() {
  return (
    <section className="py-20 md:py-28 px-6 md:px-12">
      <ScrollReveal className="max-w-[640px] mx-auto text-center">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">
          Start the conversation
        </h2>
        <p className="text-base text-text-secondary mb-8">
          Connect your customer feedback and GitHub. Ask what to build,
          what&apos;s feasible, and what needs to change.
        </p>
        <div className="flex justify-center gap-3">
          <Link href="/signup">
            <Button>Get started</Button>
          </Link>
          <Link href="/login">
            <Button variant="secondary">Log in</Button>
          </Link>
        </div>
      </ScrollReveal>
    </section>
  );
}
