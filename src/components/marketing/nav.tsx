"use client";

import { useScroll, useMotionValueEvent } from "framer-motion";
import { useState } from "react";
import Link from "next/link";
import { KosoWordmark } from "@/components/ui/koso-logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 64);
  });

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 h-16 transition-colors duration-200 ease",
        scrolled
          ? "bg-bg-primary border-b border-border-default"
          : "bg-transparent"
      )}
    >
      <nav className="max-w-[1200px] mx-auto h-full flex items-center justify-between px-6 md:px-12">
        <Link href="/">
          <KosoWordmark size={22} />
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm font-medium text-text-secondary hover:text-text-primary transition-none"
          >
            Log in
          </Link>
          <Link href="/signup">
            <Button size="sm">Get started</Button>
          </Link>
        </div>
      </nav>
    </header>
  );
}
