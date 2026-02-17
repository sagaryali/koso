"use client";

import { type ReactNode, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ScrollReveal } from "./scroll-reveal";
import { BrowserFrame } from "./browser-frame";
import { cn } from "@/lib/utils";

// ─── Feature Block Layout ───

function FeatureBlock({
  heading,
  label,
  description,
  reverse,
  children,
}: {
  heading: string;
  label: string;
  description: string;
  reverse?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-8 md:gap-12 items-center",
        reverse ? "md:flex-row-reverse" : "md:flex-row"
      )}
    >
      <ScrollReveal className="md:w-[40%]" direction={reverse ? "right" : "left"}>
        <p className="text-xs font-medium text-text-tertiary uppercase tracking-caps mb-2">
          {label}
        </p>
        <h3 className="text-xl md:text-2xl font-bold tracking-tight mb-3">
          {heading}
        </h3>
        <p className="text-base text-text-secondary leading-relaxed">
          {description}
        </p>
      </ScrollReveal>

      <ScrollReveal
        className="md:w-[60%]"
        direction={reverse ? "left" : "right"}
        delay={0.1}
      >
        {children}
      </ScrollReveal>
    </div>
  );
}

// ─── Animation Hooks ───

/** Cycles through phases with variable durations. */
function usePhases(durations: readonly number[]) {
  const [phase, setPhase] = useState(0);
  const reduced = useReducedMotion();
  const durRef = useRef(durations);

  useEffect(() => {
    if (reduced) return;
    const id = setTimeout(
      () => setPhase((p) => (p + 1) % durRef.current.length),
      durRef.current[phase]
    );
    return () => clearTimeout(id);
  }, [phase, reduced]);

  return phase;
}

/** Character-by-character typing. Resets each time `active` flips to true. */
function useTypewriter(text: string, active: boolean, speed = 60) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!active) return;
    setCount(0);
    let i = 0;
    const id = setInterval(() => {
      i++;
      setCount(i);
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [active, text, speed]);

  return text.slice(0, Math.min(count, text.length));
}

// ─── Shared ───

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-tertiary shrink-0">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function SimilarityDots({ count }: { count: number }) {
  return (
    <span className="flex gap-0.5 shrink-0">
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={cn("w-1.5 h-1.5 rounded-full", i < count ? "bg-text-primary" : "bg-border-default")}
        />
      ))}
    </span>
  );
}

function LinkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-tertiary shrink-0">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-tertiary shrink-0 mt-0.5">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

const fade = { duration: 0.25, ease: "easeOut" as const };

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Feature 1: Evidence Pool
// Story: Semantic search → ranked results with similarity → link to spec
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const EVIDENCE_DURATIONS = [1500, 1000, 300, 2000, 1200, 1200, 300] as const;

const ALL_EVIDENCE = [
  { type: "Feedback", text: "\"Onboarding is confusing — I didn't know where to click\"" },
  { type: "Metrics", text: "Activation rate dropped from 42% to 31% after redesign" },
  { type: "Research", text: "Competitor X uses a 3-step wizard with 67% completion rate" },
  { type: "Meeting", text: "PM sync: prioritize onboarding before Q2 launch" },
];

const SEARCH_RESULTS = [
  { type: "Feedback", text: "\"Onboarding is confusing — I didn't know where to click\"", similarity: 5 },
  { type: "Metrics", text: "Activation rate dropped from 42% to 31% after redesign", similarity: 4 },
  { type: "Research", text: "Competitor X uses a 3-step wizard with 67% completion rate", similarity: 3 },
];

function EvidencePoolMockup() {
  // 0: idle  1: typing  2: loading  3: results  4: linked  5: hold  6: reset
  const phase = usePhases(EVIDENCE_DURATIONS);
  const reduced = useReducedMotion();
  const typed = useTypewriter("onboarding drop-off", phase === 1, 50);

  const hasSearch = reduced || (phase >= 1 && phase <= 5);
  const showResults = reduced || (phase >= 3 && phase <= 5);
  const showLinked = reduced || (phase >= 4 && phase <= 5);
  const searchText = phase === 1 ? typed : "onboarding drop-off";
  const items = showResults ? SEARCH_RESULTS : ALL_EVIDENCE;

  return (
    <BrowserFrame url="app.koso.ai/evidence">
      <div className="p-4 md:p-6 h-[380px] overflow-hidden">
        {/* Search bar */}
        <div className={cn(
          "border px-3 py-2 mb-4 flex items-center gap-2 transition-colors duration-150",
          hasSearch ? "border-border-strong" : "border-border-default"
        )}>
          <SearchIcon />
          {hasSearch ? (
            <span className="text-xs text-text-primary">
              {searchText}
              {phase === 1 && !reduced && <span className="animate-pulse ml-0.5 text-text-tertiary">|</span>}
            </span>
          ) : (
            <span className="text-xs text-text-tertiary">Search evidence semantically...</span>
          )}
        </div>

        {/* Loading bar */}
        {phase === 2 && !reduced && <div className="h-px bg-text-primary mb-3 animate-pulse" />}

        {/* Results label */}
        {showResults && (
          <p className="text-[11px] text-text-tertiary mb-2">
            {SEARCH_RESULTS.length} results — ranked by relevance
          </p>
        )}

        {/* Filter chips (idle only) */}
        {!showResults && (
          <div className="flex gap-2 mb-4">
            {["All", "Feedback", "Metrics", "Research"].map((f, i) => (
              <span key={f} className={cn(
                "text-[11px] font-medium px-2 py-0.5",
                i === 0 ? "bg-bg-inverse text-text-inverse" : "bg-bg-tertiary text-text-secondary"
              )}>
                {f}
              </span>
            ))}
          </div>
        )}

        {/* Cards */}
        <div className="space-y-2">
          <AnimatePresence mode="popLayout" initial={false}>
            {items.map((item, i) => (
              <motion.div
                key={item.text}
                layout
                className={cn(
                  "border p-3",
                  showLinked && i === 0 ? "border-border-strong" : "border-border-default"
                )}
                initial={reduced ? undefined : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ ...fade, delay: showResults && !reduced ? i * 0.1 : 0 }}
              >
                <div className="flex items-center gap-2">
                  <span className="bg-bg-tertiary text-[10px] font-medium px-1.5 py-0.5 rounded-sm shrink-0">
                    {item.type}
                  </span>
                  <p className="text-xs text-text-secondary leading-relaxed flex-1 line-clamp-1">
                    {item.text}
                  </p>
                  {"similarity" in item && <SimilarityDots count={(item as { similarity: number }).similarity} />}
                </div>
                {showLinked && i === 0 && (
                  <motion.div
                    className="mt-2 pt-2 border-t border-border-subtle flex items-center gap-1.5"
                    initial={reduced ? undefined : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <LinkIcon />
                    <span className="text-[11px] text-text-tertiary">
                      Linked to Onboarding Redesign PRD
                    </span>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </BrowserFrame>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Feature 2: AI Spec Editor
// Story: Cmd+K → type query → select action → AI streams response → insert
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const EDITOR_DURATIONS = [
  1200, // 0: static editor
  300,  // 1: cmd+k appears
  1000, // 2: typing query
  350,  // 3: command selected
  250, 250, 250, 250, 200, 200, // 4–9: streaming lines appear
  1200, // 10: insert button + hold
  1200, // 11: hold
  400,  // 12: reset
] as const;

const STREAMING_LINES = [
  { style: "heading" as const, text: "User Story 1: SSO Login" },
  { style: "body" as const, text: "As an enterprise admin, I want to configure SAML SSO" },
  { style: "body" as const, text: "so employees authenticate with corporate credentials." },
  { style: "label" as const, text: "Acceptance Criteria:" },
  { style: "check" as const, text: "Admin can upload IdP metadata XML" },
  { style: "check" as const, text: "Users redirected to corporate login page" },
];

function EditorMockup() {
  const phase = usePhases(EDITOR_DURATIONS);
  const reduced = useReducedMotion();
  const queryTyped = useTypewriter("generate user stories", phase === 2, 35);

  const showOverlay = !reduced && phase >= 1 && phase <= 3;
  const showStreaming = reduced || (phase >= 4 && phase <= 11);
  const visibleLines = reduced
    ? STREAMING_LINES.length
    : phase >= 4 ? Math.min(phase - 3, STREAMING_LINES.length) : 0;
  const isStillStreaming = !reduced && visibleLines < STREAMING_LINES.length;
  const showInsert = reduced || (phase >= 10 && phase <= 11);
  const queryText = phase === 2 ? queryTyped : phase === 3 ? "generate user stories" : "";

  return (
    <BrowserFrame url="app.koso.ai/editor">
      <div className="p-4 md:p-6 h-[370px] overflow-hidden relative">
        {/* Editor content */}
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-sm font-bold tracking-tight">Authentication Overhaul</h3>
          <span className="bg-bg-tertiary text-[10px] font-medium px-1.5 py-0.5 rounded-sm">PRD</span>
        </div>
        <p className="text-xs text-text-secondary leading-relaxed mb-1.5">
          Current auth relies on session cookies with 24h expiry.
          Enterprise customers need persistent sessions and SSO.
        </p>
        <p className="text-xs text-text-secondary leading-relaxed">
          We propose JWT-based auth with refresh token rotation
          and SAML 2.0 SSO as an enterprise tier feature.
        </p>

        {/* AI streaming content */}
        <AnimatePresence>
          {showStreaming && (
            <motion.div
              className="mt-3 border-l-2 border-border-strong pl-3"
              initial={reduced ? undefined : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-caps mb-1.5">
                {isStillStreaming ? "Generating..." : "Generated"}
              </p>
              {STREAMING_LINES.slice(0, visibleLines).map((line, i) => (
                <motion.div
                  key={i}
                  initial={reduced ? undefined : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15 }}
                  className={cn(
                    line.style === "heading" && "text-xs font-medium text-text-primary mb-1",
                    line.style === "body" && "text-xs text-text-secondary leading-relaxed",
                    line.style === "label" && "text-[11px] font-medium text-text-primary mt-2 mb-1",
                    line.style === "check" && "text-xs text-text-secondary flex items-center gap-1.5",
                  )}
                >
                  {line.style === "check" && (
                    <span className="w-3 h-3 border border-border-default inline-block shrink-0" />
                  )}
                  {line.text}
                </motion.div>
              ))}
              {isStillStreaming && (
                <span className="inline-block w-1.5 h-3 bg-text-primary animate-pulse mt-1" />
              )}
              {showInsert && (
                <motion.div
                  className="mt-3 pt-2 border-t border-border-default"
                  initial={reduced ? undefined : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <span className="bg-bg-inverse text-text-inverse text-[11px] font-medium px-2.5 py-1">
                    Insert below
                  </span>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cmd+K overlay */}
        <AnimatePresence>
          {showOverlay && (
            <motion.div
              className="absolute inset-x-4 md:inset-x-6 bottom-4 md:bottom-6 border border-border-strong bg-bg-primary shadow-modal"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <div className="px-3 py-2 border-b border-border-default flex items-center gap-2">
                <SearchIcon />
                {queryText ? (
                  <span className="text-xs text-text-primary">
                    {queryText}
                    {phase === 2 && <span className="animate-pulse ml-0.5 text-text-tertiary">|</span>}
                  </span>
                ) : (
                  <span className="text-xs text-text-tertiary">Ask AI anything...</span>
                )}
                <kbd className="ml-auto border border-border-default px-1 py-0.5 text-[10px] text-text-tertiary font-medium">
                  ⌘K
                </kbd>
              </div>
              {phase === 3 && (
                <motion.div className="py-1" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="px-3 py-1.5 text-xs bg-bg-tertiary text-text-primary font-medium pl-4">
                    Generate user stories from this PRD
                  </div>
                  <div className="px-3 py-1.5 text-xs text-text-secondary">
                    Check for conflicts with existing specs
                  </div>
                  <div className="px-3 py-1.5 text-xs text-text-secondary">
                    Assess feasibility against codebase
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </BrowserFrame>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Feature 3: Codebase Awareness
// Story: Connect repo → scan files → architecture summary → feasibility assessment
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const CODEBASE_DURATIONS = [
  900,  // 0: connected header only
  350,  // 1: file 1
  350,  // 2: file 2
  350,  // 3: file 3
  350,  // 4: file 4
  500,  // 5: analyzing...
  500,  // 6: architecture summary
  500,  // 7: feasibility
  1800, // 8: hold
  300,  // 9: reset
] as const;

const SCANNED_FILES = [
  { path: "src/auth/session.ts", type: "Service" },
  { path: "src/middleware/auth.ts", type: "Middleware" },
  { path: "src/api/auth/login.ts", type: "Route" },
  { path: "src/models/user.ts", type: "Model" },
];

function CodebaseMockup() {
  const phase = usePhases(CODEBASE_DURATIONS);
  const reduced = useReducedMotion();

  const fileCount = reduced
    ? SCANNED_FILES.length
    : phase >= 1 && phase <= 8 ? Math.min(phase, SCANNED_FILES.length) : 0;
  const isScanning = !reduced && phase >= 1 && phase <= 4;
  const showAnalyzing = !reduced && phase === 5;
  const showArch = reduced || (phase >= 6 && phase <= 8);
  const showFeasibility = reduced || (phase >= 7 && phase <= 8);
  const isDone = reduced || phase >= 6;

  return (
    <BrowserFrame url="app.koso.ai/codebase">
      <div className="p-4 md:p-6 h-[420px] overflow-hidden">
        {/* Repo header */}
        <div className="flex items-center gap-2 mb-4">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-primary shrink-0">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          <span className="text-xs font-medium">acme/web-app</span>
          <span className={cn(
            "text-[10px] font-medium px-1.5 py-0.5 ml-auto",
            isDone ? "bg-bg-inverse text-text-inverse" : "bg-bg-tertiary text-text-secondary"
          )}>
            {isDone ? "Indexed" : isScanning ? "Scanning..." : "Connected"}
          </span>
        </div>

        {/* Scanned files */}
        <div className="space-y-1.5 mb-3">
          <AnimatePresence initial={false}>
            {SCANNED_FILES.slice(0, fileCount).map((file, i) => (
              <motion.div
                key={file.path}
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 border transition-colors duration-150",
                  !reduced && i === fileCount - 1 && isScanning
                    ? "border-border-strong"
                    : "border-border-default"
                )}
                initial={reduced ? undefined : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={fade}
              >
                <span className="font-mono text-[11px] text-text-primary flex-1 truncate">
                  {file.path}
                </span>
                <span className="bg-bg-tertiary text-[10px] font-medium px-1.5 py-0.5 rounded-sm shrink-0">
                  {file.type}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Analyzing spinner */}
        {showAnalyzing && (
          <motion.div
            className="flex items-center gap-2 mb-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="w-3 h-3 border-2 border-text-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-text-tertiary">Analyzing architecture...</span>
          </motion.div>
        )}

        {/* Architecture summary */}
        <AnimatePresence initial={false}>
          {showArch && (
            <motion.div
              className="border border-border-default p-3 mb-2"
              initial={reduced ? undefined : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={fade}
            >
              <p className="text-[11px] font-medium text-text-tertiary uppercase tracking-caps mb-1">
                Architecture
              </p>
              <p className="text-xs text-text-secondary leading-relaxed">
                Next.js monolith with Supabase. Auth via middleware + session cookies.
                42 components, 12 API routes, 8 hooks.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Feasibility assessment */}
        <AnimatePresence initial={false}>
          {showFeasibility && (
            <motion.div
              className="border border-border-strong p-3 bg-bg-secondary"
              initial={reduced ? undefined : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={fade}
            >
              <div className="flex items-center gap-2 mb-2">
                <p className="text-[11px] font-medium text-text-tertiary uppercase tracking-caps">
                  Feasibility
                </p>
                <span className="bg-bg-inverse text-text-inverse text-[10px] font-medium px-1.5 py-0.5">
                  Medium
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex items-start gap-2">
                  <span className="text-[10px] text-text-tertiary w-14 shrink-0">Affected</span>
                  <span className="font-mono text-[11px] text-text-secondary">session.ts, auth.ts, login.ts</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[10px] text-text-tertiary w-14 shrink-0">Reuse</span>
                  <span className="text-[11px] text-text-secondary">Supabase auth client, middleware chain</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[10px] text-text-tertiary w-14 shrink-0">Risk</span>
                  <span className="text-[11px] text-text-secondary">Token rotation requires DB migration</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </BrowserFrame>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Feature 4: Market Intelligence
// Story: Write about a feature → market signals appear in real-time in context panel
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const MARKET_DURATIONS = [
  1200, // 0: static editor, empty panel
  1200, // 1: typing in editor
  500,  // 2: loading skeleton
  400,  // 3: signal 1
  400,  // 4: signal 2
  400,  // 5: signal 3
  1800, // 6: hold
  400,  // 7: reset
] as const;

const MARKET_SIGNALS = [
  { source: "linear.app", title: "How Linear Built Enterprise SSO", snippet: "Linear's approach to SAML integration for enterprise customers..." },
  { source: "forrester.com", title: "78% of B2B Buyers Require SSO", snippet: "Annual enterprise software requirements report shows SSO is table stakes..." },
  { source: "auth0.com", title: "SAML 2.0 Implementation Guide", snippet: "Best practices for implementing SAML SSO in B2B SaaS products..." },
];

function MarketMockup() {
  const phase = usePhases(MARKET_DURATIONS);
  const reduced = useReducedMotion();
  const typedText = useTypewriter("SAML 2.0 SSO for enterprise customers", phase === 1, 40);

  const showTyped = reduced || phase >= 1;
  const isLoading = !reduced && phase === 2;
  const signalCount = reduced
    ? MARKET_SIGNALS.length
    : phase >= 3 && phase <= 6 ? Math.min(phase - 2, MARKET_SIGNALS.length) : 0;
  const editorText = phase === 1 && !reduced ? typedText : "SAML 2.0 SSO for enterprise customers";

  return (
    <BrowserFrame url="app.koso.ai/editor">
      <div className="flex h-[360px] overflow-hidden">
        {/* Editor pane (left) */}
        <div className="flex-1 p-3 md:p-4 border-r border-border-default overflow-hidden">
          <div className="flex items-center gap-2 mb-1.5">
            <h3 className="text-sm font-bold tracking-tight">Auth Overhaul</h3>
            <span className="bg-bg-tertiary text-[10px] font-medium px-1.5 py-0.5 rounded-sm">PRD</span>
          </div>
          <p className="text-[11px] text-text-secondary leading-relaxed mb-2">
            Enterprise customers need persistent sessions and SSO support.
          </p>
          {showTyped && (
            <motion.p
              className="text-[11px] text-text-primary leading-relaxed"
              initial={reduced ? undefined : { opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {editorText}
              {phase === 1 && !reduced && <span className="animate-pulse text-text-tertiary">|</span>}
            </motion.p>
          )}
        </div>

        {/* Market signals panel (right) */}
        <div className="w-[170px] md:w-[200px] p-3 bg-bg-secondary overflow-hidden">
          <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-caps mb-2">
            Market Signals
          </p>

          {/* Empty state */}
          {phase === 0 && !reduced && (
            <p className="text-[10px] text-text-tertiary leading-relaxed italic">
              Signals appear as you describe features...
            </p>
          )}

          {/* Loading skeleton */}
          {isLoading && (
            <div className="space-y-2">
              {[80, 65, 70].map((w, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-2.5 bg-bg-tertiary animate-pulse" style={{ width: `${w}%` }} />
                  <div className="h-2 bg-bg-tertiary animate-pulse" style={{ width: `${w - 15}%` }} />
                </div>
              ))}
            </div>
          )}

          {/* Signal cards */}
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {MARKET_SIGNALS.slice(0, signalCount).map((signal) => (
                <motion.div
                  key={signal.source}
                  className="border border-border-default bg-bg-primary p-2 space-y-1"
                  initial={reduced ? undefined : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={fade}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-[11px] font-medium text-text-primary leading-tight line-clamp-2">
                      {signal.title}
                    </span>
                    <ExternalLinkIcon />
                  </div>
                  <p className="text-[10px] text-text-tertiary leading-snug line-clamp-1">
                    {signal.snippet}
                  </p>
                  <span className="inline-block bg-bg-tertiary text-[9px] font-medium px-1 py-0.5 rounded-sm">
                    {signal.source}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}

// ─── Main Features Section ───

const FEATURES = [
  {
    label: "Evidence Pool",
    heading: "Your product's source of truth",
    description:
      "Capture customer feedback, metrics, research notes, and meeting insights in one searchable pool. Every piece of evidence is linked to the specs it informed — so you always know why you built what you built.",
    mockup: <EvidencePoolMockup />,
  },
  {
    label: "AI Spec Editor",
    heading: "Write with full context",
    description:
      "A spec editor that knows everything. Hit ⌘K to generate user stories, check for conflicts with your principles, assess feasibility against your codebase, or ask anything. Context panels keep related evidence, code, and market signals at your fingertips.",
    mockup: <EditorMockup />,
    reverse: true,
  },
  {
    label: "Codebase",
    heading: "Specs that know your code",
    description:
      "Connect your GitHub repo and Koso indexes your architecture — components, services, routes, models. Every spec is checked for feasibility against your actual codebase, not assumptions.",
    mockup: <CodebaseMockup />,
  },
  {
    label: "Market Intelligence",
    heading: "Always know the landscape",
    description:
      "Market signals surface automatically as you write. See what competitors are shipping, what industry trends are emerging, and how your spec fits the bigger picture.",
    mockup: <MarketMockup />,
    reverse: true,
  },
];

export function Features() {
  return (
    <section className="py-20 md:py-28 px-6 md:px-12">
      <div className="max-w-[1080px] mx-auto space-y-20 md:space-y-28">
        {FEATURES.map((feature) => (
          <FeatureBlock
            key={feature.label}
            label={feature.label}
            heading={feature.heading}
            description={feature.description}
            reverse={feature.reverse}
          >
            {feature.mockup}
          </FeatureBlock>
        ))}
      </div>
    </section>
  );
}
