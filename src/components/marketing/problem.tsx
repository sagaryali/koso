"use client";

import { ScrollReveal } from "./scroll-reveal";

export function Problem() {
  return (
    <section className="bg-bg-secondary py-20 md:py-28 px-6 md:px-12">
      <div className="max-w-[640px] mx-auto text-center">
        <ScrollReveal>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
            Your feedback and your code
            <br />
            have never met
          </h2>
          <p className="mt-4 text-base text-text-secondary">
            Customer feedback lives in spreadsheets and Slack. Your codebase
            lives in GitHub. You make decisions by switching between them and
            hoping you have the full picture.
          </p>
          <p className="mt-3 text-base text-text-secondary">
            Koso connects them into one conversation — so every question is
            answered with real feedback and real technical context.
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}
