"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Code, Check, Circle, X, ArrowRight } from "lucide-react";
import { Button, Input, TextArea, Badge, Icon, Skeleton } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { useCodebaseStatus } from "@/hooks/use-codebase-status";
import { useCoachMarks } from "@/lib/coach-mark-context";
import { getHomeTour } from "@/lib/tours";
import { NewSpecDialog } from "@/components/new-spec-dialog";
import { EvidenceFlow } from "@/components/spec-creation/evidence-flow";
import { Dialog } from "@/components/ui";
import type { Artifact, Evidence, EvidenceType } from "@/types";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatTimestamp(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function formatType(type: string) {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function extractTextFromTiptap(content: Record<string, unknown>): string {
  if (!content) return "";
  const parts: string[] = [];

  function walk(node: Record<string, unknown>) {
    if (node.text && typeof node.text === "string") {
      parts.push(node.text);
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content) {
        walk(child as Record<string, unknown>);
      }
    }
  }

  walk(content);
  return parts.join(" ");
}

const EVIDENCE_TYPES: { label: string; value: EvidenceType }[] = [
  { label: "Feedback", value: "feedback" },
  { label: "Metric", value: "metric" },
  { label: "Research", value: "research" },
  { label: "Meeting Note", value: "meeting_note" },
];

interface InsightTheme {
  theme: string;
  detail: string;
}

interface InsightsCache {
  synthesis: InsightTheme[];
  evidenceCount: number;
  hadCodeContext: boolean;
  timestamp: number;
}

type TimelineItem = {
  id: string;
  type: string;
  title: string;
  date: string;
  kind: "artifact" | "evidence";
};

export default function HomePage() {
  const { workspace } = useWorkspace();
  const router = useRouter();
  const supabase = createClient();
  const { connection, connections } = useCodebaseStatus(true);
  const { startTour } = useCoachMarks();
  const tourTriggered = useRef(false);

  const [recentArtifacts, setRecentArtifacts] = useState<Artifact[]>([]);
  const [recentEvidence, setRecentEvidence] = useState<Evidence[]>([]);
  const [evidenceCount, setEvidenceCount] = useState(0);
  const [draftCount, setDraftCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [evidenceInput, setEvidenceInput] = useState("");
  const [evidenceType, setEvidenceType] = useState<EvidenceType>("feedback");
  const [addingEvidence, setAddingEvidence] = useState(false);

  const [synthesis, setSynthesis] = useState<InsightTheme[] | null>(null);
  const [synthesisLoading, setSynthesisLoading] = useState(false);

  const prevCodebaseStatus = useRef<string | null>(null);
  const [codebaseJustReady, setCodebaseJustReady] = useState(false);

  const [checklistDismissed, setChecklistDismissed] = useState(true); // default true to avoid flash
  const [newSpecOpen, setNewSpecOpen] = useState(false);
  const [evidenceFlowOpen, setEvidenceFlowOpen] = useState(false);

  useEffect(() => {
    document.title = "Koso — Home";
  }, []);

  // ── Checklist dismissal persistence ─────────────────────────────
  useEffect(() => {
    if (!workspace) return;
    const dismissed = localStorage.getItem(
      `koso_checklist_dismissed_${workspace.id}`
    );
    setChecklistDismissed(dismissed === "true");
  }, [workspace?.id]);

  function dismissChecklist() {
    if (!workspace) return;
    localStorage.setItem(
      `koso_checklist_dismissed_${workspace.id}`,
      "true"
    );
    setChecklistDismissed(true);
  }

  // ── Data fetching ──────────────────────────────────────────────
  useEffect(() => {
    if (!workspace) return;
    const wsId = workspace.id;

    async function load() {
      const [
        { data: artifacts },
        { data: evidence },
        { count: evCount },
        { count: drafts },
      ] = await Promise.all([
        supabase
          .from("artifacts")
          .select("*")
          .eq("workspace_id", wsId)
          .order("updated_at", { ascending: false })
          .limit(10),
        supabase
          .from("evidence")
          .select("*")
          .eq("workspace_id", wsId)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("evidence")
          .select("id", { count: "exact" })
          .eq("workspace_id", wsId),
        supabase
          .from("artifacts")
          .select("id", { count: "exact" })
          .eq("workspace_id", wsId)
          .eq("status", "draft"),
      ]);

      if (artifacts) setRecentArtifacts(artifacts);
      if (evidence) setRecentEvidence(evidence);
      setEvidenceCount(evCount ?? 0);
      setDraftCount(drafts ?? 0);

      setLoading(false);
    }

    load();
  }, [workspace?.id]);

  // ── Insights fetch helper ──────────────────────────────────────
  async function fetchInsights(wsId: string, withCodeContext: boolean) {
    setSynthesisLoading(true);

    try {
      const { data: allEvidence } = await supabase
        .from("evidence")
        .select("content")
        .eq("workspace_id", wsId);

      if (!allEvidence || allEvidence.length === 0) {
        setSynthesisLoading(false);
        return;
      }

      const feedbackStrings = allEvidence.map(
        (e: { content: string }) => e.content
      );

      let codeContext:
        | {
            architectureSummary: string;
            modules: {
              filePath: string;
              moduleType: string;
              summary: string;
            }[];
          }
        | undefined;

      if (withCodeContext) {
        const [{ data: modules }, { data: archArtifacts }] = await Promise.all([
          supabase
            .from("codebase_modules")
            .select("file_path, module_type, summary")
            .eq("workspace_id", wsId)
            .order("updated_at", { ascending: false })
            .limit(10),
          supabase
            .from("artifacts")
            .select("content")
            .eq("workspace_id", wsId)
            .eq("type", "architecture_summary")
            .limit(1),
        ]);

        const archSummary =
          archArtifacts && archArtifacts.length > 0
            ? extractTextFromTiptap(
                archArtifacts[0].content as Record<string, unknown>
              )
            : "";

        codeContext = {
          architectureSummary: archSummary,
          modules: (modules || []).map(
            (m: {
              file_path: string;
              module_type: string;
              summary: string;
            }) => ({
              filePath: m.file_path,
              moduleType: m.module_type,
              summary: m.summary,
            })
          ),
        };
      }

      const res = await fetch("/api/ai/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback: feedbackStrings,
          ...(codeContext ? { codeContext } : {}),
        }),
      });

      if (res.ok) {
        const { synthesis: themes } = await res.json();
        const clean = Array.isArray(themes)
          ? themes.filter(
              (t: unknown): t is { theme: string; detail: string } =>
                typeof t === "object" &&
                t !== null &&
                typeof (t as Record<string, unknown>).theme === "string" &&
                typeof (t as Record<string, unknown>).detail === "string" &&
                (t as Record<string, unknown>).theme !== "" &&
                (t as Record<string, unknown>).detail !== ""
            )
          : [];
        setSynthesis(clean);

        const cache: InsightsCache = {
          synthesis: clean,
          evidenceCount,
          hadCodeContext: withCodeContext,
          timestamp: Date.now(),
        };
        localStorage.setItem(
          `koso_insights_${wsId}`,
          JSON.stringify(cache)
        );
      }
    } catch (err) {
      console.error("[insights] Failed to fetch:", err);
    } finally {
      setSynthesisLoading(false);
    }
  }

  // ── Insights: check cache or fetch ─────────────────────────────
  useEffect(() => {
    if (!workspace || evidenceCount === 0 || loading) return;
    const wsId = workspace.id;
    const cacheKey = `koso_insights_${wsId}`;
    const codebaseReady = connection?.status === "ready";

    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed: InsightsCache = JSON.parse(cached);
        const oneHour = 60 * 60 * 1000;
        const validItems = Array.isArray(parsed.synthesis)
          ? parsed.synthesis.filter(
              (t: unknown): t is { theme: string; detail: string } =>
                typeof t === "object" &&
                t !== null &&
                typeof (t as Record<string, unknown>).theme === "string" &&
                typeof (t as Record<string, unknown>).detail === "string" &&
                !/[\[{]/.test(String((t as Record<string, unknown>).theme)) &&
                !/[\[{]/.test(String((t as Record<string, unknown>).detail))
            )
          : [];
        if (
          validItems.length > 0 &&
          parsed.evidenceCount === evidenceCount &&
          parsed.hadCodeContext === codebaseReady &&
          Date.now() - parsed.timestamp < oneHour
        ) {
          setSynthesis(validItems);
          return;
        }
      }
    } catch {
      // Invalid cache — fetch fresh
    }

    fetchInsights(wsId, codebaseReady ?? false);
  }, [workspace?.id, evidenceCount, loading, connection?.status]);

  // ── Watch codebase status transition → "ready" ─────────────────
  useEffect(() => {
    if (!connection?.status) return;

    if (
      prevCodebaseStatus.current &&
      prevCodebaseStatus.current !== "ready" &&
      connection.status === "ready"
    ) {
      setCodebaseJustReady(true);

      if (workspace) {
        localStorage.removeItem(`koso_insights_${workspace.id}`);
      }
    }

    prevCodebaseStatus.current = connection.status;
  }, [connection?.status, workspace?.id]);

  // ── Conditional tour trigger ────────────────────────────────────
  useEffect(() => {
    if (loading || !workspace || tourTriggered.current) return;
    tourTriggered.current = true;
    const steps = getHomeTour(evidenceCount > 0);
    setTimeout(() => startTour("home", steps, workspace.id), 800);
  }, [loading, workspace?.id]);

  // ── Add evidence ───────────────────────────────────────────────
  async function handleAddEvidence() {
    if (!evidenceInput.trim() || !workspace || addingEvidence) return;
    setAddingEvidence(true);

    const text = evidenceInput.trim();
    setEvidenceInput("");

    let title = text.slice(0, 60);
    try {
      const titleRes = await fetch("/api/ai/title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (titleRes.ok) {
        const { title: aiTitle } = await titleRes.json();
        if (aiTitle) title = aiTitle;
      }
    } catch {
      // Use fallback title
    }

    const { data } = await supabase
      .from("evidence")
      .insert({
        workspace_id: workspace.id,
        type: evidenceType,
        title,
        content: text,
        source: null,
        tags: [],
      })
      .select("id")
      .single();

    setAddingEvidence(false);

    if (data?.id) {
      const newCount = evidenceCount + 1;
      setEvidenceCount(newCount);

      fetch("/api/embeddings/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: data.id, sourceType: "evidence" }),
      }).catch((err) =>
        console.log("[embeddings] Background indexing failed:", err)
      );

      const evidenceId = data.id;

      if (newCount >= 3 && evidenceCount < 3) {
        toast({ message: "Themes unlocked! Analyzing your evidence..." });
        if (workspace) {
          fetchInsights(workspace.id, connection?.status === "ready");
        }
      } else if (newCount < 3) {
        const remaining = 3 - newCount;
        toast({
          message: `Added to evidence pool — ${remaining} more to unlock themes`,
          action: {
            label: "Undo",
            onClick: async () => {
              await supabase.from("evidence").delete().eq("id", evidenceId);
              setEvidenceCount((prev) => prev - 1);
              toast({ message: "Evidence removed" });
            },
          },
        });
      } else {
        toast({
          message: "Added to evidence pool",
          action: {
            label: "Undo",
            onClick: async () => {
              await supabase.from("evidence").delete().eq("id", evidenceId);
              setEvidenceCount((prev) => prev - 1);
              toast({ message: "Evidence removed" });
            },
          },
        });
      }
    }
  }

  // ── Create spec (from checklist) ──────────────────────────────
  function handleCreateSpec() {
    if (!workspace) return;
    setNewSpecOpen(true);
  }

  // ── Derived: subtitle ──────────────────────────────────────────
  function getSubtitle(): { text: string; clickable: boolean } {
    if (connection?.status === "syncing" || connection?.status === "pending") {
      return { text: "Indexing your codebase \u2014 code context will appear shortly", clickable: false };
    }
    if (draftCount > 0) {
      return { text: `${draftCount} spec${draftCount !== 1 ? "s are" : " is"} still in draft`, clickable: false };
    }
    if (evidenceCount === 0) {
      return { text: "Paste some customer feedback to get started", clickable: true };
    }
    return { text: "All caught up", clickable: false };
  }

  function scrollToEvidenceHero() {
    const el = document.getElementById("evidence-hero-input");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus();
    }
  }

  // ── Derived: unified timeline ──────────────────────────────────
  function getTimeline(): TimelineItem[] {
    const items: TimelineItem[] = [];

    for (const a of recentArtifacts) {
      items.push({
        id: a.id,
        type: a.type,
        title: a.title,
        date: a.updated_at,
        kind: "artifact",
      });
    }

    for (const e of recentEvidence) {
      items.push({
        id: e.id,
        type: e.type,
        title: e.title,
        date: e.created_at,
        kind: "evidence",
      });
    }

    items.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    return items.slice(0, 15);
  }

  // ── Loading skeleton ───────────────────────────────────────────
  if (loading) {
    return (
      <div className="px-12 py-10 page-transition">
        <Skeleton variant="text" width={260} height={36} />
        <div className="mt-1">
          <Skeleton variant="text" width={180} />
        </div>
        <div className="mt-10">
          <Skeleton variant="block" height={120} />
        </div>
        <div className="mt-10">
          <Skeleton variant="block" height={40} />
        </div>
        <div className="mt-16">
          <Skeleton variant="block" height={72} />
        </div>
      </div>
    );
  }

  const timeline = getTimeline();

  // ── Checklist completion ──────────────────────────────────────
  const hasEvidence = evidenceCount > 0;
  const hasSpec = recentArtifacts.length > 0;
  const hasCodebase = connections.some((c) => c.status === "ready");
  const completedCount = [hasEvidence, hasSpec, hasCodebase].filter(Boolean).length;
  const allComplete = completedCount === 3;
  const showChecklist = !allComplete && !checklistDismissed;

  const checklistSteps = [
    {
      done: hasEvidence,
      label: "Add evidence",
      description: "Paste customer feedback, a metric, or a research note",
      onClick: () => {
        const el = document.getElementById("evidence-quick-add");
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.focus();
        }
      },
    },
    {
      done: hasSpec,
      label: "Write your first spec",
      description: "Describe what you\u2019re building \u2014 the AI will help",
      onClick: handleCreateSpec,
    },
    {
      done: hasCodebase,
      label: "Connect your codebase",
      description: "Link GitHub for technical feasibility insights",
      onClick: () => router.push("/settings"),
    },
  ];

  return (
    <div className="px-12 py-10 page-transition">
      {/* 1. Greeting + contextual subtitle */}
      <h1 className="text-2xl font-bold tracking-tight">{getGreeting()}</h1>
      {(() => {
        const subtitle = getSubtitle();
        if (subtitle.clickable) {
          return (
            <button
              onClick={scrollToEvidenceHero}
              className="mt-1 cursor-pointer text-sm text-text-secondary hover:text-text-primary"
            >
              {subtitle.text}
            </button>
          );
        }
        return <p className="mt-1 text-sm text-text-secondary">{subtitle.text}</p>;
      })()}

      {/* Getting started checklist */}
      {showChecklist && (
        <div className="mt-8 border border-border-default p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-text-primary">
              Get started
            </p>
            <button
              onClick={dismissChecklist}
              className="cursor-pointer text-text-tertiary hover:text-text-primary transition-none"
              aria-label="Dismiss checklist"
            >
              <X size={14} />
            </button>
          </div>
          <div className="mt-4 space-y-1">
            {checklistSteps.map((step) => (
              <button
                key={step.label}
                onClick={step.done ? undefined : step.onClick}
                className={cn(
                  "flex w-full items-center gap-3 px-2 py-2.5 text-left transition-none",
                  step.done
                    ? "opacity-50"
                    : "cursor-pointer hover:bg-bg-hover"
                )}
                disabled={step.done}
              >
                {step.done ? (
                  <Icon
                    icon={Check}
                    size={16}
                    className="shrink-0 text-text-tertiary"
                  />
                ) : (
                  <Icon
                    icon={Circle}
                    size={16}
                    className="shrink-0 text-text-tertiary"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      step.done && "line-through"
                    )}
                  >
                    {step.label}
                  </span>
                  <p className="text-xs text-text-tertiary">
                    {step.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-text-tertiary">
            {completedCount} of 3 complete
          </p>
        </div>
      )}

      {/* 2. Evidence hero (when no evidence) or Insights summary */}
      {evidenceCount === 0 ? (
        <div
          className="mt-10 border border-border-default bg-bg-secondary p-6"
          data-tour="home-evidence-hero"
        >
          <h2 className="text-sm font-medium text-text-primary">
            Unlock AI-powered theme analysis
          </h2>
          <p className="mt-1 text-xs text-text-secondary">
            Add 3+ pieces of evidence to see patterns
          </p>

          {/* Progress indicators */}
          <div className="mt-4 flex items-center gap-2">
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-1.5 w-16 bg-border-default"
                />
              ))}
            </div>
            <span className="text-xs text-text-tertiary">0 of 3</span>
          </div>

          {/* Greyed mock pills */}
          <div className="mt-3 flex gap-2">
            <span className="bg-bg-tertiary/50 px-2 py-1 text-xs text-text-tertiary">
              Customer pain point
            </span>
            <span className="bg-bg-tertiary/50 px-2 py-1 text-xs text-text-tertiary">
              Feature request
            </span>
          </div>

          {/* Evidence input */}
          <div className="mt-4">
            <TextArea
              id="evidence-hero-input"
              placeholder="Paste feedback, a metric, or a research note..."
              value={evidenceInput}
              onChange={(e) => setEvidenceInput(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex gap-1.5">
              {EVIDENCE_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setEvidenceType(t.value)}
                  className={cn(
                    "cursor-pointer rounded-sm px-2 py-1 text-xs font-medium transition-none",
                    evidenceType === t.value
                      ? "bg-bg-inverse text-text-inverse"
                      : "bg-bg-tertiary text-text-primary"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="ml-auto">
              <Button
                variant="secondary"
                onClick={handleAddEvidence}
                disabled={!evidenceInput.trim() || addingEvidence}
              >
                {addingEvidence ? "Adding..." : "Add"}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Insights summary (compact) */}
          <div className="mt-10 border border-border-default bg-bg-secondary p-5" data-tour="home-insights">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-text-primary">
                Themes from your evidence
              </h2>
              <button
                onClick={() => router.push("/insights")}
                className="flex cursor-pointer items-center gap-1 text-xs text-text-secondary hover:text-text-primary"
              >
                View all insights
                <Icon icon={ArrowRight} size={12} />
              </button>
            </div>

            {synthesisLoading ? (
              <div className="mt-3">
                <Skeleton variant="text" width="60%" />
              </div>
            ) : synthesis && synthesis.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {synthesis.slice(0, 4).map((t, i) => (
                  <span
                    key={i}
                    className="bg-bg-tertiary px-2 py-1 text-xs text-text-secondary"
                  >
                    {t.theme}
                  </span>
                ))}
                {synthesis.length > 4 && (
                  <span className="px-2 py-1 text-xs text-text-tertiary">
                    +{synthesis.length - 4} more
                  </span>
                )}
              </div>
            ) : null}
          </div>

          {/* Quick-add evidence */}
          <div className="mt-10" data-tour="home-quick-add">
            <div className="mb-3 flex gap-2">
              {EVIDENCE_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setEvidenceType(t.value)}
                  className={cn(
                    "cursor-pointer rounded-sm px-2 py-1 text-xs font-medium transition-none",
                    evidenceType === t.value
                      ? "bg-bg-inverse text-text-inverse"
                      : "bg-bg-tertiary text-text-primary"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  id="evidence-quick-add"
                  placeholder="Paste feedback, a metric, or a quick note..."
                  value={evidenceInput}
                  onChange={(e) => setEvidenceInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddEvidence();
                  }}
                />
              </div>
              <Button
                variant="secondary"
                onClick={handleAddEvidence}
                disabled={!evidenceInput.trim() || addingEvidence}
              >
                {addingEvidence ? "Adding..." : "Add to Evidence"}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Scenario-specific nudge (only when checklist dismissed) */}
      {checklistDismissed && (() => {
        // Scenario A: Has evidence + codebase, no spec
        if (hasEvidence && hasCodebase && !hasSpec) {
          return (
            <div className="mt-6 border border-border-default bg-bg-secondary px-4 py-3">
              <p className="text-sm text-text-secondary">
                Evidence and codebase are ready.{" "}
                <button
                  onClick={handleCreateSpec}
                  className="cursor-pointer font-medium text-text-primary underline"
                >
                  Write your first spec
                </button>
                {" "}&mdash; the AI will pull in relevant context automatically.
              </p>
            </div>
          );
        }
        // Scenario B: Has codebase, no evidence
        if (hasCodebase && !hasEvidence) {
          return (
            <div className="mt-6 border border-border-default bg-bg-secondary px-4 py-3">
              <p className="text-sm text-text-secondary">
                Your codebase is connected.{" "}
                <button
                  onClick={scrollToEvidenceHero}
                  className="cursor-pointer font-medium text-text-primary underline"
                >
                  Add customer feedback
                </button>
                {" "}to see AI-powered insights grounded in your code.
              </p>
            </div>
          );
        }
        // Scenario C: Has evidence, no codebase
        if (hasEvidence && !hasCodebase) {
          return (
            <div className="mt-6 border border-border-default bg-bg-secondary px-4 py-3">
              <p className="text-sm text-text-secondary">
                <button
                  onClick={() => router.push("/settings")}
                  className="cursor-pointer font-medium text-text-primary underline"
                >
                  Connect your codebase
                </button>
                {" "}to unlock effort estimates, architecture detection, and technical feasibility checks.
              </p>
            </div>
          );
        }
        // Scenario D: Nothing done
        if (!hasEvidence && !hasCodebase && !hasSpec) {
          return (
            <div className="mt-6 border border-border-default bg-bg-secondary px-4 py-3">
              <p className="mb-3 text-sm text-text-secondary">
                Pick up where you left off
              </p>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={scrollToEvidenceHero}
                >
                  Add feedback
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => router.push("/settings")}
                >
                  Connect codebase
                </Button>
              </div>
            </div>
          );
        }
        return null;
      })()}

      {/* 4. Recent activity */}
      <div className="mt-16" data-tour="home-timeline">
        <div className="text-[11px] font-medium uppercase tracking-caps text-text-tertiary">
          Recent Activity
        </div>

        {timeline.length === 0 && !codebaseJustReady ? (
          <div className="mt-4 flex flex-col items-center border border-border-default py-12">
            <p className="text-sm text-text-tertiary">No recent activity yet</p>
          </div>
        ) : (
          <div className="mt-3 border border-border-default">
            {codebaseJustReady && connection && (
              <div className="flex w-full items-center gap-3 px-4 py-3">
                <Icon icon={Code} className="text-text-tertiary" />
                <span className="flex-1 truncate text-sm font-medium">
                  Codebase indexed &mdash; {connection.module_count} modules
                  from {connection.repo_name}
                </span>
                <span className="text-xs text-text-tertiary">Just now</span>
              </div>
            )}
            {timeline.map((item, i) => (
              <button
                key={item.id}
                onClick={() =>
                  item.kind === "artifact"
                    ? router.push(`/editor/${item.id}`)
                    : router.push("/evidence")
                }
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-left transition-none hover:bg-bg-hover cursor-pointer",
                  (i > 0 || codebaseJustReady) &&
                    "border-t border-border-default"
                )}
              >
                <Badge>{formatType(item.type)}</Badge>
                <span className="flex-1 truncate text-sm font-medium">
                  {item.title}
                </span>
                <span className="text-xs text-text-tertiary">
                  {formatTimestamp(item.date)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {workspace && (
        <>
          <NewSpecDialog
            open={newSpecOpen}
            onClose={() => setNewSpecOpen(false)}
            workspaceId={workspace.id}
            evidenceCount={evidenceCount}
            onStartFromEvidence={() => setEvidenceFlowOpen(true)}
          />

          {/* Evidence Flow Dialog */}
          <Dialog
            open={evidenceFlowOpen}
            onClose={() => setEvidenceFlowOpen(false)}
            className="max-w-xl"
          >
            <h2 className="text-lg font-bold tracking-tight">
              New Spec from Evidence
            </h2>
            <p className="mt-1 mb-4 text-sm text-text-secondary">
              Select evidence, cluster themes, then draft a spec.
            </p>
            <EvidenceFlow
              workspaceId={workspace.id}
              workspace={workspace}
              hasCodebase={connection?.status === "ready"}
              codebaseRepoName={connection?.repo_name}
              onComplete={() => setEvidenceFlowOpen(false)}
              onCancel={() => setEvidenceFlowOpen(false)}
            />
          </Dialog>
        </>
      )}
    </div>
  );
}
