"use client";

import { useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
  AnimatePresence,
  useReducedMotion,
} from "framer-motion";
import { useState } from "react";
import { BrowserFrame } from "./browser-frame";
import { cn } from "@/lib/utils";

// ─── Step definitions ───

const STEPS = [
  {
    number: 1,
    label: "Collect",
    heading: "Gather feedback from anywhere",
    description:
      "Paste raw customer feedback, pull from your evidence pool, or import from tools. Koso parses it into structured items automatically.",
  },
  {
    number: 2,
    label: "Cluster",
    heading: "AI finds patterns, checked against your code",
    description:
      "Koso clusters feedback into themes and cross-references each one with your codebase — showing what's already built, what's feasible, and what architecture changes would be needed.",
  },
  {
    number: 3,
    label: "Draft",
    heading: "A spec grounded in reality",
    description:
      "A complete product spec streams into existence — every recommendation backed by real customer feedback and checked against your actual codebase. Not assumptions.",
  },
];

// ─── Mock data ───

const MOCK_FEEDBACK = [
  "Users are confused by the onboarding flow — 3 people mentioned not knowing where to start",
  "Enterprise customers need SSO integration before they can adopt",
  "The mobile experience is broken on Android — multiple crash reports this week",
  "Feature request: bulk import from CSV for evidence items",
  "Love the AI suggestions but wish they were faster",
];

const MOCK_CLUSTERS = [
  {
    label: "Onboarding Experience",
    badge: "UX",
    items: [
      "Users confused by onboarding flow",
      "\"Setup took 20 minutes\"",
      "Feature request: guided walkthrough",
    ],
  },
  {
    label: "Enterprise Readiness",
    badge: "Platform",
    items: [
      "SSO integration needed",
      "Permissions model too simple",
    ],
  },
  {
    label: "Mobile Stability",
    badge: "Bug",
    items: ["Android crash reports — WebView issue"],
    codeNote: "src/mobile/webview-bridge.ts",
  },
];

const MOCK_SPEC_LINES = [
  { type: "h1" as const, text: "Mobile Onboarding Redesign" },
  { type: "h2" as const, text: "Problem" },
  {
    type: "p" as const,
    text: "New users drop off during onboarding at 34%. Feedback consistently mentions confusion about the initial setup experience.",
  },
  { type: "h2" as const, text: "Proposed Solution" },
  {
    type: "p" as const,
    text: "A guided 3-step onboarding flow that walks users through workspace creation, evidence import, and first investigation.",
  },
  { type: "h2" as const, text: "Requirements" },
  { type: "li" as const, text: "Step 1: Product setup (name, description)" },
  { type: "li" as const, text: "Step 2: First evidence import" },
  { type: "li" as const, text: "Step 3: Guided investigation with sample data" },
];

// ─── Step Indicator ───

function StepIndicator({ activeStep, onSelect }: { activeStep: number; onSelect: (step: number) => void }) {
  return (
    <div className="flex items-center gap-1 mb-6">
      {STEPS.map((step, i) => (
        <div key={step.number} className="flex items-center gap-1">
          {i > 0 && <span className="text-text-tertiary mx-1">→</span>}
          <button
            className="relative cursor-pointer"
            onClick={() => onSelect(step.number)}
          >
            <span
              className={cn(
                "text-sm font-medium transition-none",
                activeStep === step.number
                  ? "text-text-primary"
                  : "text-text-tertiary"
              )}
            >
              {step.number}. {step.label}
            </span>
            {activeStep === step.number && (
              <motion.div
                className="absolute -bottom-1 left-0 right-0 h-[2px] bg-bg-inverse"
                layoutId="step-underline"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Step 1: Feedback Cards ───

function CollectMockup() {
  return (
    <div className="p-4 md:p-6 space-y-3">
      <div className="text-xs font-medium text-text-tertiary uppercase tracking-caps mb-3">
        Pasted feedback
      </div>
      {MOCK_FEEDBACK.map((text, i) => (
        <motion.div
          key={i}
          className="border border-border-default p-3 text-xs text-text-secondary leading-relaxed"
          initial={{ opacity: 0, y: 8 }}
          animate={{
            opacity: 1,
            y: 0,
            transition: { delay: i * 0.15, duration: 0.3, ease: "easeOut" },
          }}
        >
          {text}
        </motion.div>
      ))}
    </div>
  );
}

// ─── Step 2: Cluster View ───

function ClusterMockup() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="text-xs font-medium text-text-tertiary uppercase tracking-caps mb-3">
        AI-identified themes
      </div>
      {MOCK_CLUSTERS.map((cluster, i) => (
        <motion.div
          key={cluster.label}
          className="border border-border-default p-4"
          initial={{ opacity: 0, y: 8 }}
          animate={{
            opacity: 1,
            y: 0,
            transition: { delay: i * 0.2, duration: 0.3, ease: "easeOut" },
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-bold">{cluster.label}</span>
            <span className="bg-bg-tertiary text-[11px] font-medium px-1.5 py-0.5 rounded-sm">
              {cluster.badge}
            </span>
          </div>
          <div className="space-y-1">
            {cluster.items.map((item) => (
              <p key={item} className="text-xs text-text-secondary">
                {item}
              </p>
            ))}
          </div>
          {cluster.codeNote && (
            <motion.div
              className="mt-2 text-[11px] text-text-tertiary font-mono bg-bg-tertiary px-2 py-1 inline-block"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{
                opacity: 1,
                scale: 1,
                transition: { delay: 0.6 + i * 0.2, duration: 0.2 },
              }}
            >
              {cluster.codeNote}
            </motion.div>
          )}
        </motion.div>
      ))}
    </div>
  );
}

// ─── Step 3: Spec Output ───

function DraftMockup() {
  return (
    <div className="p-4 md:p-6">
      {MOCK_SPEC_LINES.map((line, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{
            opacity: 1,
            transition: { delay: i * 0.15, duration: 0.25, ease: "easeOut" },
          }}
        >
          {line.type === "h1" && (
            <h3 className="text-lg font-bold tracking-tight mb-3">
              {line.text}
            </h3>
          )}
          {line.type === "h2" && (
            <h4 className="text-sm font-bold mt-4 mb-1">{line.text}</h4>
          )}
          {line.type === "p" && (
            <p className="text-xs text-text-secondary leading-relaxed mb-2">
              {line.text}
            </p>
          )}
          {line.type === "li" && (
            <div className="flex items-start gap-2 ml-2 mb-1">
              <div className="w-1 h-1 bg-text-primary mt-1.5 shrink-0" />
              <p className="text-xs text-text-secondary">{line.text}</p>
            </div>
          )}
        </motion.div>
      ))}

      {/* Create button appears after spec */}
      <motion.div
        className="mt-6"
        initial={{ opacity: 0 }}
        animate={{
          opacity: 1,
          transition: { delay: MOCK_SPEC_LINES.length * 0.15 + 0.3, duration: 0.3 },
        }}
      >
        <div className="inline-flex items-center bg-bg-inverse text-text-inverse text-xs font-medium px-3 py-1.5">
          Create as spec
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Workflow Section ───

const STEP_MOCKUPS = [CollectMockup, ClusterMockup, DraftMockup];

export function Workflow() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState(1);
  const prefersReducedMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const stepValue = useTransform(
    scrollYProgress,
    [0, 0.28, 0.35, 0.62, 0.7, 1],
    [1, 1, 2, 2, 3, 3]
  );

  useMotionValueEvent(stepValue, "change", (latest) => {
    const step = Math.round(latest);
    if (step !== activeStep) {
      setActiveStep(step);
    }
  });

  const currentStep = STEPS[activeStep - 1];
  const MockupComponent = STEP_MOCKUPS[activeStep - 1];

  return (
    <section id="workflow" ref={containerRef} className="relative h-[300vh]">
      <div className="sticky top-0 h-screen flex items-center">
        <div className="max-w-[1080px] mx-auto w-full px-6 md:px-12">
          {/* Section label */}
          <div className="mb-8">
            <p className="text-xs font-medium text-text-tertiary uppercase tracking-caps mb-2">
              How it works
            </p>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              From feedback to spec — grounded in your code
            </h2>
          </div>

          <div className="flex flex-col md:flex-row gap-8 md:gap-12">
            {/* Left: Step info */}
            <div className="md:w-[40%] flex flex-col justify-center">
              <StepIndicator activeStep={activeStep} onSelect={setActiveStep} />

              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStep}
                  initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } }}
                  exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -10, transition: { duration: 0.2 } }}
                >
                  <h3 className="text-xl font-bold tracking-tight mb-3">
                    {currentStep.heading}
                  </h3>
                  <p className="text-base text-text-secondary leading-relaxed">
                    {currentStep.description}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Right: Browser mockup */}
            <div className="md:w-[60%]">
              <BrowserFrame url="app.koso.ai/investigate">
                <div className="min-h-[300px] md:min-h-[380px] max-h-[420px] overflow-hidden">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeStep}
                      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
                      animate={{ opacity: 1, transition: { duration: 0.3 } }}
                      exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, transition: { duration: 0.2 } }}
                    >
                      <MockupComponent />
                    </motion.div>
                  </AnimatePresence>
                </div>
              </BrowserFrame>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
