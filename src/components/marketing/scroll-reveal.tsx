"use client";

import { type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "left" | "right";
  once?: boolean;
}

export function ScrollReveal({
  children,
  className,
  delay = 0,
  direction = "up",
  once = true,
}: ScrollRevealProps) {
  const prefersReducedMotion = useReducedMotion();

  const initial = prefersReducedMotion
    ? { opacity: 1 }
    : {
        opacity: 0,
        y: direction === "up" ? 20 : 0,
        x: direction === "left" ? -20 : direction === "right" ? 20 : 0,
      };

  const animate = {
    opacity: 1,
    y: 0,
    x: 0,
    transition: {
      duration: 0.5,
      ease: "easeOut" as const,
      delay,
    },
  };

  return (
    <motion.div
      initial={initial}
      whileInView={animate}
      viewport={{ once, margin: "-64px" }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}
