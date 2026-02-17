"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { BrowserFrame } from "./browser-frame";
import { Typewriter } from "./typewriter";
import { cn } from "@/lib/utils";

// ─── Stage timing (ms) ───

const STAGE_DURATIONS = [3700, 3000, 5000]; // feedback, code, cmd-k
const INITIAL_DELAY = 800;

// ─── Stage labels ───

const STAGES = [
  { number: 1, label: "Add feedback" },
  { number: 2, label: "Connect code" },
  { number: 3, label: "Ask anything" },
];

// ─── Fade helpers ───

function fadeUp(delay: number) {
  return {
    initial: { opacity: 0, y: 20 },
    animate: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" as const, delay },
    },
  };
}

const sceneFade = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.3, ease: "easeOut" as const } },
  exit: { opacity: 0, transition: { duration: 0.2, ease: "easeOut" as const } },
};

// ─── Stage 1: Adding Evidence ───

const MOCK_FEEDBACK = [
  "Users are confused by the onboarding flow — 3 people mentioned not knowing where to start",
  "Enterprise customers need SSO before they can adopt",
  "The mobile experience is broken on Android — multiple crash reports",
  "Feature request: bulk import from CSV",
];

function EvidenceScene() {
  return (
    <div className="p-5 md:p-6">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border border-border-default flex items-center justify-center">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </div>
          <span className="text-sm font-medium">Add Evidence</span>
        </div>
        <span className="bg-bg-tertiary text-[11px] font-medium px-2 py-0.5 rounded-sm">
          Feedback
        </span>
      </div>

      {/* Paste area with typewriter */}
      <div className="border border-border-strong bg-bg-primary p-4 mb-4 min-h-[60px]">
        <p className="text-xs text-text-secondary leading-relaxed">
          <Typewriter
            text="Users are confused by the onboarding flow — 3 people mentioned not knowing where to start. Enterprise customers need SSO. Mobile is broken on Android."
            speed={18}
            delay={400}
            showCursor={true}
          />
        </p>
      </div>

      {/* Evidence cards appearing */}
      <div className="space-y-2">
        {MOCK_FEEDBACK.map((text, i) => (
          <motion.div
            key={i}
            className="border border-border-default p-3 flex items-center gap-2"
            initial={{ opacity: 0, y: 6 }}
            animate={{
              opacity: 1,
              y: 0,
              transition: {
                delay: 2.0 + i * 0.4,
                duration: 0.3,
                ease: "easeOut" as const,
              },
            }}
          >
            <span className="bg-bg-tertiary text-[10px] font-medium px-1.5 py-0.5 rounded-sm shrink-0">
              Feedback
            </span>
            <p className="text-xs text-text-secondary leading-relaxed">
              {text}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Stage 2: Connecting Code ───

const MOCK_MODULES = [
  { path: "src/app/onboarding/page.tsx", type: "Page", summary: "4-step onboarding wizard" },
  { path: "src/hooks/useOnboarding.ts", type: "Hook", summary: "Onboarding state management" },
  { path: "src/components/evidence/", type: "Components", summary: "Evidence list, add dialog" },
  { path: "src/middleware.ts", type: "Middleware", summary: "Route protection, auth checks" },
];

function CodeScene() {
  return (
    <div className="p-5 md:p-6">
      {/* Connection header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-6 h-6 bg-bg-inverse flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium">Connected to GitHub</p>
          <p className="text-xs text-text-tertiary">streamline-io/web-client</p>
        </div>
        <motion.div
          className="ml-auto flex items-center gap-1.5"
          initial={{ opacity: 0 }}
          animate={{
            opacity: 1,
            transition: { delay: 0.6, duration: 0.3 },
          }}
        >
          <div className="w-1.5 h-1.5 bg-text-primary rounded-full" />
          <span className="text-[11px] font-medium text-text-secondary">
            Indexed
          </span>
        </motion.div>
      </div>

      {/* Architecture summary */}
      <motion.div
        className="border border-border-default p-4 mb-4 bg-bg-secondary"
        initial={{ opacity: 0 }}
        animate={{
          opacity: 1,
          transition: { delay: 0.8, duration: 0.3, ease: "easeOut" as const },
        }}
      >
        <p className="text-[11px] font-medium text-text-tertiary uppercase tracking-caps mb-1.5">
          Architecture Summary
        </p>
        <p className="text-xs text-text-secondary leading-relaxed">
          Next.js app with Supabase backend. 42 components, 12 API routes,
          8 hooks. Auth via middleware + SSR client.
        </p>
      </motion.div>

      {/* Indexed modules */}
      <p className="text-[11px] font-medium text-text-tertiary uppercase tracking-caps mb-2">
        Indexed Modules
      </p>
      <div className="space-y-2">
        {MOCK_MODULES.map((mod, i) => (
          <motion.div
            key={mod.path}
            className="border border-border-default p-3"
            initial={{ opacity: 0, y: 6 }}
            animate={{
              opacity: 1,
              y: 0,
              transition: {
                delay: 1.4 + i * 0.25,
                duration: 0.3,
                ease: "easeOut" as const,
              },
            }}
          >
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-mono text-[11px] font-medium">
                {mod.path}
              </span>
              <span className="bg-bg-tertiary text-[10px] font-medium px-1.5 py-0.5 rounded-sm">
                {mod.type}
              </span>
            </div>
            <p className="text-[11px] text-text-tertiary">{mod.summary}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Stage 3: Ask Anything ───

const QUESTION = "What should we prioritize for Q2?";

const ANSWER_PARTS = [
  {
    type: "text" as const,
    content:
      "Based on your customer feedback and codebase, I'd prioritize three areas:",
  },
  {
    type: "text" as const,
    content:
      "1. Onboarding redesign — 3 separate feedback items mention confusion during setup, and your activation rate dropped to 31%. The current onboarding page is a single-file wizard that could be broken into guided steps with minimal refactoring.",
  },
  {
    type: "evidence" as const,
    label: "3 evidence items",
    items: [
      "\"I didn't know where to click first\"",
      "\"Setup took 20 minutes\"",
      "Activation rate: 42% → 31%",
    ],
  },
  {
    type: "text" as const,
    content:
      "2. Mobile stability — Android crash reports are tied to the WebView bridge. This is a contained fix in a single module but affects all mobile users.",
  },
  {
    type: "code" as const,
    label: "Related code",
    items: [
      "src/app/onboarding/page.tsx — 4-step wizard",
      "src/mobile/webview-bridge.ts — WebView bridge",
    ],
  },
  {
    type: "text" as const,
    content:
      "3. SSO support — enterprise customers have explicitly blocked on this. Your auth middleware already handles route protection, so adding SAML would extend the existing pattern.",
  },
];

function AskScene() {
  const [phase, setPhase] = useState<"typing" | "thinking" | "answering">("typing");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("thinking"), 1800);
    const t2 = setTimeout(() => setPhase("answering"), 2600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div className="p-5 md:p-6">
      {/* Cmd+K bar */}
      <motion.div
        className="border border-border-strong bg-bg-primary shadow-modal"
        initial={{ opacity: 0, y: 8 }}
        animate={{
          opacity: 1,
          y: 0,
          transition: { delay: 0.4, duration: 0.3, ease: "easeOut" as const },
        }}
      >
        <div className="px-3 py-2.5 flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-tertiary shrink-0">
            <path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.636 5.636l2.121 2.121m8.486 8.486l2.121 2.121M5.636 18.364l2.121-2.121m8.486-8.486l2.121-2.121" />
          </svg>
          <span className="text-xs text-text-primary">
            <Typewriter text={QUESTION} speed={30} delay={500} showCursor={phase === "typing"} />
          </span>
          <kbd className="ml-auto border border-border-default px-1.5 py-0.5 text-[10px] text-text-tertiary font-medium shrink-0">
            ⌘K
          </kbd>
        </div>
      </motion.div>

      {/* Thinking indicator */}
      {phase === "thinking" && (
        <motion.div
          className="mt-4 flex items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.2 } }}
        >
          <div className="ai-thinking">
            <div className="ai-thinking-dot" />
            <div className="ai-thinking-dot" />
            <div className="ai-thinking-dot" />
          </div>
          <span className="text-xs text-text-tertiary">
            Searching evidence &amp; codebase...
          </span>
        </motion.div>
      )}

      {/* Answer stream */}
      {phase === "answering" && (
        <div className="mt-4 space-y-3">
          {ANSWER_PARTS.map((part, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 4 }}
              animate={{
                opacity: 1,
                y: 0,
                transition: {
                  delay: i * 0.3,
                  duration: 0.25,
                  ease: "easeOut" as const,
                },
              }}
            >
              {part.type === "text" && (
                <p className="text-xs text-text-secondary leading-relaxed">
                  {part.content}
                </p>
              )}
              {part.type === "evidence" && (
                <div className="border border-border-default bg-bg-secondary p-3">
                  <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-caps mb-1.5">
                    {part.label}
                  </p>
                  {part.items.map((item) => (
                    <p key={item} className="text-[11px] text-text-secondary leading-relaxed">
                      {item}
                    </p>
                  ))}
                </div>
              )}
              {part.type === "code" && (
                <div className="border border-border-default bg-bg-secondary p-3">
                  <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-caps mb-1.5">
                    {part.label}
                  </p>
                  {part.items.map((item) => (
                    <p key={item} className="text-[11px] text-text-secondary font-mono leading-relaxed">
                      {item}
                    </p>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
          <motion.span
            className="typewriter-cursor"
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              transition: { delay: ANSWER_PARTS.length * 0.3, duration: 0.1 },
            }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Stage Indicator ───

function StageIndicator({ active, onSelect }: { active: number; onSelect: (stage: number) => void }) {
  return (
    <div className="flex items-center gap-1 mb-1">
      {STAGES.map((stage, i) => {
        const isActive = active === stage.number;
        const totalDuration =
          (STAGE_DURATIONS[stage.number - 1] + (stage.number === 1 ? INITIAL_DELAY : 0)) / 1000;

        return (
          <div key={stage.number} className="flex items-center gap-1">
            {i > 0 && <span className="text-text-tertiary mx-1.5">→</span>}
            <button
              className="relative pb-1 cursor-pointer"
              onClick={() => onSelect(stage.number)}
            >
              <span
                className={cn(
                  "text-xs font-medium transition-none",
                  isActive ? "text-text-primary" : "text-text-tertiary"
                )}
              >
                {stage.label}
              </span>
              <div className="absolute -bottom-0 left-0 right-0 h-[2px] bg-border-default" />
              {isActive && (
                <motion.div
                  key={`progress-${active}`}
                  className="absolute -bottom-0 left-0 right-0 h-[2px] bg-bg-inverse origin-left"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: totalDuration, ease: "linear" }}
                />
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Hero ───

const SCENE_COMPONENTS = [EvidenceScene, CodeScene, AskScene];
const SCENE_URLS = [
  "app.koso.ai/evidence",
  "app.koso.ai/codebase",
  "app.koso.ai/editor",
];

export function Hero() {
  const prefersReducedMotion = useReducedMotion();
  const [stage, setStage] = useState(1);

  const advanceStage = useCallback(() => {
    setStage((prev) => (prev >= 3 ? 1 : prev + 1));
  }, []);

  useEffect(() => {
    const startDelay = stage === 1 ? INITIAL_DELAY : 0;
    const duration = STAGE_DURATIONS[stage - 1];
    const timer = setTimeout(advanceStage, startDelay + duration);
    return () => clearTimeout(timer);
  }, [stage, advanceStage]);

  const anim = prefersReducedMotion
    ? { initial: { opacity: 1 }, animate: { opacity: 1 } }
    : null;

  const SceneComponent = SCENE_COMPONENTS[stage - 1];

  return (
    <section className="min-h-[calc(100vh-64px)] pt-32 pb-16 md:pb-24 px-6 md:px-12">
      <div className="max-w-[1080px] mx-auto">
        {/* Text content */}
        <div className="max-w-[840px]">
          <motion.h1
            className="text-3xl md:text-[48px] md:leading-[56px] font-bold tracking-tight"
            {...(anim || fadeUp(0))}
          >
            Customer feedback and codebase,
            <br />
            in one conversation
          </motion.h1>

          <motion.p
            className="mt-6 text-lg text-text-secondary max-w-[560px]"
            {...(anim || fadeUp(0.15))}
          >
            The AI-native IDE for product managers. Connect customer feedback
            and GitHub, then write specs that know what's worth building,
            what's feasible, and what needs to change.
          </motion.p>

          <motion.div
            className="mt-8 flex gap-3"
            {...(anim || fadeUp(0.3))}
          >
            <Link href="/signup">
              <Button>Get started</Button>
            </Link>
            <a href="#workflow">
              <Button variant="secondary">See how it works</Button>
            </a>
          </motion.div>
        </div>

        {/* Animated browser mockup */}
        <motion.div
          className="mt-16"
          {...(anim || {
            initial: { opacity: 0, y: 40 },
            animate: {
              opacity: 1,
              y: 0,
              transition: { duration: 0.8, ease: "easeOut" as const, delay: 0.5 },
            },
          })}
        >
          {/* Stage indicator */}
          <div className="mb-4">
            <StageIndicator active={stage} onSelect={setStage} />
          </div>

          <BrowserFrame url={SCENE_URLS[stage - 1]}>
            <div className="h-[500px] md:h-[540px] overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div key={stage} {...sceneFade}>
                  <SceneComponent />
                </motion.div>
              </AnimatePresence>
            </div>
          </BrowserFrame>
        </motion.div>
      </div>
    </section>
  );
}
