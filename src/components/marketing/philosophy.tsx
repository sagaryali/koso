"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ScrollReveal } from "./scroll-reveal";

const PRINCIPLES = [
  {
    label: "No accent colors",
    detail: "Black, white, and grays. Emphasis through weight and space, not color.",
  },
  {
    label: "No rounded corners",
    detail: "Sharp edges everywhere. Precision over friendliness.",
  },
  {
    label: "No shadows",
    detail: "Separation through borders and whitespace. Flat and honest.",
  },
  {
    label: "No bouncy animations",
    detail: "150ms transitions. Ease-out. Respect your attention.",
  },
];

export function Philosophy() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="bg-bg-inverse text-text-inverse py-20 md:py-28 px-6 md:px-12">
      <div className="max-w-[1080px] mx-auto">
        <ScrollReveal>
          <p className="text-xs font-medium text-[#666] uppercase tracking-caps mb-4">
            Design Philosophy
          </p>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">
            Premium through restraint
          </h2>
          <p className="text-base text-[#999] max-w-[560px] mb-12 md:mb-16">
            Every pixel earns its place. Koso feels like a beautifully typeset book
            meets a precision instrument. White space is the primary design element.
          </p>
        </ScrollReveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
          {PRINCIPLES.map((principle, i) => (
            <motion.div
              key={principle.label}
              className="border border-[#333] p-6"
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
              whileInView={{
                opacity: 1,
                y: 0,
                transition: {
                  delay: i * 0.1,
                  duration: 0.3,
                  ease: "easeOut",
                },
              }}
              viewport={{ once: true, margin: "-64px" }}
            >
              <p className="text-sm font-bold mb-1">{principle.label}</p>
              <p className="text-xs text-[#999] leading-relaxed">
                {principle.detail}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
