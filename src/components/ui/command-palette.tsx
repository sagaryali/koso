"use client";

import {
  type KeyboardEvent,
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  Sparkles,
  MessageSquare,
  Copy,
  Check,
  X,
  Plus,
  ArrowDownToLine,
  ListChecks,
  Loader2,
  Home,
  Archive,
  Search,
  Settings,
  FileText,
  Globe,
  Scale,
  Layers,
  Telescope,
  Users,
  ShieldQuestion,
  Briefcase,
  SearchX,
  Compass,
  HeartCrack,
  CircleAlert,
  SendHorizontal,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";
import { AI_ACTIONS, type AIAction } from "@/lib/ai/actions";
import { buildPrompt } from "@/lib/ai/prompt-builder";
import { streamCompletion } from "@/lib/ai/stream";
import { createClient } from "@/lib/supabase/client";
import { useCodebaseStatus } from "@/hooks/use-codebase-status";
import { StreamedMarkdown } from "@/components/ui/streamed-markdown";

const ACTION_ICONS: Record<string, LucideIcon> = {
  whos_asking: Users,
  challenge_spec: ShieldQuestion,
  build_the_case: Briefcase,
  whats_missing: SearchX,
  what_to_build_next: Compass,
  customer_struggles: HeartCrack,
  unaddressed_feedback: CircleAlert,
};

// --- Types ---

export interface CommandPaletteContext {
  workspaceId: string;
  workspace: {
    name: string;
    productDescription: string | null;
    principles: string[];
  };
  artifact?: {
    id: string;
    workspaceId: string;
    title: string;
    type: string;
    content: string; // Markdown serialized from editor
  };
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  context: CommandPaletteContext | null;
  onInsertBelow?: (text: string) => void;
  onCreateArtifacts?: (stories: { title: string; content: string }[]) => void;
  onNewArtifact?: () => void;
  onAddEvidence?: () => void;
}

type PaletteView = "actions" | "streaming" | "result";

interface DisplayItem {
  id: string;
  label: string;
  description: string;
  type: "action" | "freeform" | "navigate" | "quick_action" | "spec_result";
  action?: AIAction;
  icon?: LucideIcon;
  onSelect?: () => void;
}

interface DisplaySection {
  label: string;
  items: DisplayItem[];
}

interface SubView {
  actionId: string;
  placeholder: string;
}

interface CachedArtifact {
  id: string;
  title: string;
  type: string;
}

// --- Helpers ---

function parseUserStories(
  text: string
): { title: string; content: string }[] {
  const sections = text.split(/^---$/m).filter((s) => s.trim());
  return sections.map((section) => {
    const lines = section.trim().split("\n");
    // Try to extract title from first heading or "As a..." line
    let title = "User Story";
    for (const line of lines) {
      const heading = line.match(/^#+\s+(.+)/);
      if (heading) {
        title = heading[1];
        break;
      }
      const asA = line.match(/^(?:\*\*)?As an?\s+.+/i);
      if (asA) {
        title = line.replace(/\*\*/g, "").trim();
        break;
      }
    }
    return { title, content: section.trim() };
  });
}

interface MarketResult {
  title: string;
  snippet: string;
  url: string;
  source: string;
}

interface FetchedContext {
  artifacts: { title: string; type: string; chunkText: string }[];
  evidence: { title: string; source: string; chunkText: string; tags: string[] }[];
  codebaseModules: {
    filePath: string;
    summary: string;
    chunkText: string;
    moduleType?: string;
    rawContent?: string;
  }[];
  architectureSummary?: string;
  marketResearch?: {
    competitors: MarketResult[];
    trends: MarketResult[];
    bestPractices: MarketResult[];
  };
  workspaceOverview?: {
    clusters: { label: string; summary: string; count: number }[];
    allSpecs: { title: string; type: string; status: string }[];
    unlinkedEvidence: { title: string; content: string }[];
    totalEvidenceCount: number;
  };
}

async function fetchMarketResearch(
  workspaceId: string,
  query: string,
  strategy: string
): Promise<FetchedContext["marketResearch"]> {
  if (
    strategy !== "market_research" &&
    strategy !== "market_competitors" &&
    strategy !== "market_feasibility"
  ) {
    return undefined;
  }

  try {
    const res = await fetch("/api/market/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        featureDescription: query,
        productDomain: "",
        workspaceId,
      }),
    });
    if (!res.ok) return undefined;
    return res.json();
  } catch {
    return undefined;
  }
}

async function fetchContext(
  workspaceId: string,
  query: string,
  strategy: string
): Promise<FetchedContext> {
  const isMarketOnly = strategy === "market_research" || strategy === "market_competitors";

  const sourceTypes =
    strategy === "evidence_search"
      ? ["evidence"]
      : strategy === "doc_with_code"
        ? ["artifact", "codebase_module"]
        : strategy === "full_doc_with_specs"
          ? ["artifact"]
          : strategy === "evidence_with_specs"
            ? undefined // evidence + artifacts for cross-referencing
            : strategy === "market_feasibility"
              ? undefined // all sources for feasibility
              : undefined;

  // Run embedding search and market research in parallel
  const [embeddingResult, marketResult] = await Promise.allSettled([
    // Skip embedding search for market-only strategies
    isMarketOnly
      ? Promise.resolve(null)
      : fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query,
            workspaceId,
            grouped: true,
            sourceTypes,
            limit: 15,
          }),
        }).then(async (res) => {
          if (!res.ok) return null;
          return res.json();
        }),
    fetchMarketResearch(workspaceId, query, strategy),
  ]);

  const searchData = embeddingResult.status === "fulfilled" ? embeddingResult.value : null;
  const ctx = searchData?.results ?? {};

  // Extract architecture summary from artifact results
  let architectureSummary: string | undefined;
  const allArtifacts = ctx.artifacts ?? [];
  const archArtifact = allArtifacts.find(
    (a: Record<string, unknown>) =>
      (a.metadata as Record<string, unknown>)?.type === "architecture_summary"
  );
  if (archArtifact) {
    architectureSummary = archArtifact.chunkText as string;
  }

  return {
    artifacts: allArtifacts
      .filter(
        (a: Record<string, unknown>) =>
          (a.metadata as Record<string, unknown>)?.type !== "architecture_summary"
      )
      .map((a: Record<string, unknown>) => ({
        title: (a.metadata as Record<string, unknown>)?.title || "Untitled",
        type: (a.metadata as Record<string, unknown>)?.type || "artifact",
        chunkText: a.chunkText as string,
      })),
    evidence: (ctx.evidence ?? []).map(
      (e: Record<string, unknown>) => ({
        title: (e.metadata as Record<string, unknown>)?.title || "",
        source: (e.metadata as Record<string, unknown>)?.source || "Unknown",
        chunkText: e.chunkText as string,
        tags: ((e.metadata as Record<string, unknown>)?.tags as string[]) || [],
      })
    ),
    codebaseModules: (ctx.codebaseModules ?? []).map(
      (c: Record<string, unknown>) => ({
        filePath: (c.metadata as Record<string, unknown>)?.file_path || "unknown",
        summary: (c.metadata as Record<string, unknown>)?.summary || "",
        chunkText: c.chunkText as string,
        moduleType: (c.metadata as Record<string, unknown>)?.module_type || undefined,
        rawContent: (c.metadata as Record<string, unknown>)?.raw_content || undefined,
      })
    ),
    architectureSummary,
    marketResearch:
      marketResult.status === "fulfilled" ? marketResult.value ?? undefined : undefined,
  };
}

interface WorkspaceOverview {
  clusters: { label: string; summary: string; count: number }[];
  allSpecs: { title: string; type: string; status: string }[];
  unlinkedEvidence: { title: string; content: string }[];
  totalEvidenceCount: number;
}

async function fetchWorkspaceOverview(
  workspaceId: string,
  supabase: ReturnType<typeof createClient>
): Promise<WorkspaceOverview> {
  const [clustersResult, artifactsResult, evidenceResult, linksResult] =
    await Promise.allSettled([
      supabase
        .from("evidence_clusters")
        .select("label, summary, evidence_count")
        .eq("workspace_id", workspaceId)
        .order("evidence_count", { ascending: false }),
      supabase
        .from("artifacts")
        .select("id, title, type, status")
        .eq("workspace_id", workspaceId)
        .neq("type", "architecture_summary")
        .order("updated_at", { ascending: false }),
      supabase
        .from("evidence")
        .select("id, title, content")
        .eq("workspace_id", workspaceId),
      supabase
        .from("links")
        .select("evidence_id")
        .eq("workspace_id", workspaceId),
    ]);

  const clusters =
    clustersResult.status === "fulfilled" && clustersResult.value.data
      ? clustersResult.value.data.map(
          (c: { label: string; summary: string; evidence_count: number }) => ({
            label: c.label,
            summary: c.summary || "",
            count: c.evidence_count,
          })
        )
      : [];

  const allSpecs =
    artifactsResult.status === "fulfilled" && artifactsResult.value.data
      ? artifactsResult.value.data.map(
          (a: { title: string; type: string; status: string }) => ({
            title: a.title,
            type: a.type,
            status: a.status || "draft",
          })
        )
      : [];

  const allEvidence =
    evidenceResult.status === "fulfilled" && evidenceResult.value.data
      ? evidenceResult.value.data
      : [];

  const linkedIds = new Set(
    linksResult.status === "fulfilled" && linksResult.value.data
      ? linksResult.value.data.map(
          (l: { evidence_id: string }) => l.evidence_id
        )
      : []
  );

  const unlinkedEvidence = allEvidence
    .filter((e: { id: string }) => !linkedIds.has(e.id))
    .map((e: { title: string; content: string }) => ({
      title: e.title || "Untitled",
      content: e.content || "",
    }));

  return {
    clusters,
    allSpecs,
    unlinkedEvidence,
    totalEvidenceCount: allEvidence.length,
  };
}

// --- Component ---

export function CommandPalette({
  open,
  onClose,
  context,
  onInsertBelow,
  onCreateArtifacts,
  onNewArtifact,
  onAddEvidence,
}: CommandPaletteProps) {
  const router = useRouter();
  const supabase = createClient();
  const { connection: codebaseConnection } = useCodebaseStatus(false);

  const [query, setQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [view, setView] = useState<PaletteView>("actions");
  const [streamedText, setStreamedText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeAction, setActiveAction] = useState<AIAction | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subView, setSubView] = useState<SubView | null>(null);
  const [cachedArtifacts, setCachedArtifacts] = useState<CachedArtifact[]>([]);
  const [responseMode, setResponseMode] = useState<"concise" | "detailed">("concise");
  const [conversationHistory, setConversationHistory] = useState<
    { role: string; content: string }[]
  >([]);
  const [followUpQuery, setFollowUpQuery] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const followUpInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const responseRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamedTextRef = useRef("");
  const userHasScrolledUpRef = useRef(false);
  const cachedPromptsRef = useRef<{ system: string; user: string } | null>(null);

  const isGlobalMode = !context?.artifact;

  // --- Navigate items ---

  const navigateItems = useMemo((): DisplayItem[] => {
    const items: DisplayItem[] = [];

    if (onNewArtifact) {
      items.push({
        id: "nav-new-spec",
        label: "New spec",
        description: "Create a new specification",
        type: "navigate",
        icon: Plus,
        onSelect: onNewArtifact,
      });
    }

    if (onAddEvidence) {
      items.push({
        id: "nav-add-evidence",
        label: "Add evidence",
        description: "Add customer feedback or research",
        type: "navigate",
        icon: MessageSquare,
        onSelect: onAddEvidence,
      });
    }

    items.push(
      {
        id: "nav-home",
        label: "Go to Home",
        description: "Navigate to the home dashboard",
        type: "navigate",
        icon: Home,
        onSelect: () => router.push("/home"),
      },
      {
        id: "nav-evidence",
        label: "Go to Evidence",
        description: "Navigate to the evidence page",
        type: "navigate",
        icon: Archive,
        onSelect: () => router.push("/evidence"),
      },
      {
        id: "nav-investigate",
        label: "Go to Investigate",
        description: "Navigate to the investigate page",
        type: "navigate",
        icon: Search,
        onSelect: () => router.push("/investigate"),
      },
      {
        id: "nav-settings",
        label: "Go to Settings",
        description: "Navigate to settings",
        type: "navigate",
        icon: Settings,
        onSelect: () => router.push("/settings"),
      }
    );

    return items;
  }, [onNewArtifact, onAddEvidence, router]);

  // --- Quick Action items ---

  const quickActionItems = useMemo((): DisplayItem[] => [
    {
      id: "qa-build-next",
      label: "What should we build next?",
      description: "Portfolio-level prioritization using evidence themes and spec coverage",
      type: "quick_action",
      icon: Compass,
    },
    {
      id: "qa-customer-struggles",
      label: "What are customers struggling with?",
      description: "Synthesize all evidence into ranked pain points with severity",
      type: "quick_action",
      icon: HeartCrack,
    },
    {
      id: "qa-unaddressed-feedback",
      label: "What feedback haven't we addressed?",
      description: "Find unlinked evidence, group into themes, suggest new specs",
      type: "quick_action",
      icon: CircleAlert,
    },
    {
      id: "qa-research",
      label: "Research a feature",
      description: "Search the web for competitor implementations and best practices",
      type: "quick_action",
      icon: Globe,
    },
    {
      id: "qa-worth-building",
      label: "Is this worth building?",
      description: "Assess customer demand, market validation, and technical effort",
      type: "quick_action",
      icon: Scale,
    },
    {
      id: "qa-summarize-evidence",
      label: "Summarize all evidence",
      description: "Synthesize all customer feedback into themes",
      type: "quick_action",
      icon: Layers,
    },
  ], []);

  // --- Fetch artifacts on open for spec search ---

  useEffect(() => {
    if (!open || !context?.workspaceId) return;

    supabase
      .from("artifacts")
      .select("id, title, type")
      .eq("workspace_id", context.workspaceId)
      .order("updated_at", { ascending: false })
      .then(({ data }) => {
        if (data) setCachedArtifacts(data);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, context?.workspaceId]);

  // --- Build sectioned display items ---

  const { sections, flatItems } = useMemo(() => {
    const lower = query.toLowerCase().trim();
    const allSections: DisplaySection[] = [];

    const matchesQuery = (label: string, desc: string) =>
      !lower || label.toLowerCase().includes(lower) || desc.toLowerCase().includes(lower);

    if (!subView) {
      // --- Editor mode: AI Actions section ---
      if (!isGlobalMode) {
        const aiItems: DisplayItem[] = [];

        const filtered = AI_ACTIONS.filter(
          (a) =>
            a.contextStrategy !== "workspace_overview" &&
            matchesQuery(a.label, a.description)
        );
        for (const action of filtered) {
          aiItems.push({
            id: action.id,
            label: action.label,
            description: action.description,
            type: "action",
            action,
            icon: ACTION_ICONS[action.id] || Sparkles,
          });
        }

        // Freeform item
        if (lower && !AI_ACTIONS.some((a) => a.label.toLowerCase() === lower)) {
          aiItems.unshift({
            id: "freeform",
            label: `Ask: ${query}`,
            description: "Ask a freeform question using all available context",
            type: "freeform",
            icon: MessageSquare,
          });
        }

        if (aiItems.length > 0) {
          allSections.push({ label: "AI Actions", items: aiItems });
        }
      }

      // --- Global mode: freeform at top ---
      if (isGlobalMode && lower) {
        const freeformItems: DisplayItem[] = [{
          id: "freeform",
          label: `Ask: ${query}`,
          description: "Ask a freeform question using all available context",
          type: "freeform",
          icon: MessageSquare,
        }];
        allSections.push({ label: "Ask", items: freeformItems });
      }

      // --- Quick Actions section ---
      const filteredQuickActions = quickActionItems.filter((item) =>
        matchesQuery(item.label, item.description)
      );
      if (filteredQuickActions.length > 0) {
        allSections.push({ label: "Quick Actions", items: filteredQuickActions });
      }

      // --- Navigate section ---
      const filteredNavItems = navigateItems.filter((item) =>
        matchesQuery(item.label, item.description)
      );

      // Spec search results
      const specResults: DisplayItem[] = lower
        ? cachedArtifacts
            .filter((a) => a.title.toLowerCase().includes(lower))
            .map((a) => ({
              id: `spec-${a.id}`,
              label: a.title,
              description: a.type,
              type: "spec_result" as const,
              icon: FileText,
              onSelect: () => router.push(`/editor/${a.id}`),
            }))
        : [];

      const navAndSpecItems = [...filteredNavItems, ...specResults];
      if (navAndSpecItems.length > 0) {
        allSections.push({ label: "Navigate", items: navAndSpecItems });
      }
    }

    // Flatten for keyboard navigation
    const flat = allSections.flatMap((s) => s.items);

    return { sections: allSections, flatItems: flat };
  }, [query, isGlobalMode, navigateItems, quickActionItems, cachedArtifacts, router, subView]);

  const resetState = useCallback(() => {
    setQuery("");
    setFocusedIndex(0);
    setView("actions");
    setStreamedText("");
    streamedTextRef.current = "";
    setIsStreaming(false);
    setActiveAction(null);
    setCopied(false);
    setError(null);
    setSubView(null);
    setResponseMode("concise");
    setConversationHistory([]);
    setFollowUpQuery("");
    userHasScrolledUpRef.current = false;
    cachedPromptsRef.current = null;
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  const handleResponseScroll = useCallback(() => {
    const el = responseRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    userHasScrolledUpRef.current = distanceFromBottom > 50;
  }, []);

  // Execute an AI action (works for both global and editor mode)
  const executeAction = useCallback(
    async (action: AIAction | null, freeformQuery?: string) => {
      if (!context) return;

      setView("streaming");
      setStreamedText("");
      streamedTextRef.current = "";
      setIsStreaming(true);
      setActiveAction(action);
      setError(null);
      setResponseMode("concise");
      userHasScrolledUpRef.current = false;

      const abortController = new AbortController();
      abortRef.current = abortController;

      // Determine param for parameterized actions
      let param: string | undefined;
      if (action?.extractParam && freeformQuery) {
        param = action.extractParam(freeformQuery) ?? undefined;
      }

      // Fetch context based on strategy
      const workspaceId = context.artifact?.workspaceId || context.workspaceId;
      const searchQuery = param || freeformQuery || context.artifact?.content?.slice(0, 500) || "";
      const retrieved = await fetchContext(
        workspaceId,
        searchQuery,
        action?.contextStrategy || "all"
      );

      // Build document context (minimal in global mode)
      const currentDoc = context.artifact
        ? {
            title: context.artifact.title,
            type: context.artifact.type,
            content: context.artifact.content,
          }
        : {
            title: "Feature Query",
            type: "query",
            content: freeformQuery || "",
          };

      // Build concise prompt for fast initial Haiku pass
      const { system, user } = buildPrompt(
        action,
        currentDoc,
        retrieved,
        context.workspace,
        freeformQuery || "",
        param,
        true // concise
      );

      // Pre-build detailed prompts for potential "Go deeper"
      cachedPromptsRef.current = buildPrompt(
        action,
        currentDoc,
        retrieved,
        context.workspace,
        freeformQuery || "",
        param,
        false // detailed
      );

      // Initialize conversation history with the first user message
      setConversationHistory([{ role: "user", content: user }]);

      await streamCompletion({
        system,
        user,
        model: "haiku",
        maxTokens: 1024,
        onChunk: (text) => {
          streamedTextRef.current += text;
          setStreamedText(streamedTextRef.current);
        },
        onComplete: (fullText) => {
          setIsStreaming(false);
          setView("result");
          setConversationHistory((prev) => [
            ...prev,
            { role: "assistant", content: fullText },
          ]);
        },
        onError: (err) => {
          setIsStreaming(false);
          setError(err.message);
          setView("result");
        },
        signal: abortController.signal,
      });
    },
    [context]
  );

  // Execute a workspace-level action (uses fetchWorkspaceOverview instead of embedding search)
  const executeWorkspaceAction = useCallback(
    async (action: AIAction, freeformQuery: string) => {
      if (!context) return;

      setView("streaming");
      setStreamedText("");
      streamedTextRef.current = "";
      setIsStreaming(true);
      setActiveAction(action);
      setError(null);
      setResponseMode("concise");
      setConversationHistory([]);
      setFollowUpQuery("");
      userHasScrolledUpRef.current = false;

      const abortController = new AbortController();
      abortRef.current = abortController;

      const workspaceId = context.workspaceId;
      const overview = await fetchWorkspaceOverview(workspaceId, supabase);

      const currentDoc = {
        title: "Workspace Query",
        type: "query",
        content: freeformQuery,
      };

      const retrievedContext: FetchedContext = {
        artifacts: [],
        evidence: [],
        codebaseModules: [],
        workspaceOverview: overview,
      };

      const { system, user } = buildPrompt(
        action,
        currentDoc,
        retrievedContext,
        context.workspace,
        freeformQuery,
        undefined,
        true // concise
      );

      cachedPromptsRef.current = buildPrompt(
        action,
        currentDoc,
        retrievedContext,
        context.workspace,
        freeformQuery,
        undefined,
        false // detailed
      );

      setConversationHistory([{ role: "user", content: user }]);

      await streamCompletion({
        system,
        user,
        model: "haiku",
        maxTokens: 1024,
        onChunk: (text) => {
          streamedTextRef.current += text;
          setStreamedText(streamedTextRef.current);
        },
        onComplete: (fullText) => {
          setIsStreaming(false);
          setView("result");
          setConversationHistory((prev) => [
            ...prev,
            { role: "assistant", content: fullText },
          ]);
        },
        onError: (err) => {
          setIsStreaming(false);
          setError(err.message);
          setView("result");
        },
        signal: abortController.signal,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [context]
  );

  // Summarize all evidence (non-streaming, calls /api/ai/synthesize)
  const executeSummarizeEvidence = useCallback(async () => {
    if (!context) return;

    setView("streaming");
    setStreamedText("");
    streamedTextRef.current = "";
    setIsStreaming(true);
    setActiveAction(null);
    setError(null);
    setResponseMode("detailed");
    userHasScrolledUpRef.current = false;
    cachedPromptsRef.current = null;

    try {
      // Fetch all evidence
      const { data: evidenceData } = await supabase
        .from("evidence")
        .select("content")
        .eq("workspace_id", context.workspaceId);

      const feedback = (evidenceData || [])
        .map((e: { content: string }) => e.content)
        .filter(Boolean);

      if (feedback.length === 0) {
        setIsStreaming(false);
        setStreamedText("No evidence found in this workspace. Add some customer feedback or research first.");
        setView("result");
        return;
      }

      // Build codeContext if codebase is ready
      let codeContext: { architectureSummary?: string; modules?: { filePath: string; moduleType: string; summary: string }[] } | undefined;

      if (codebaseConnection?.status === "ready") {
        const [archResult, modulesResult] = await Promise.allSettled([
          supabase
            .from("artifacts")
            .select("content")
            .eq("workspace_id", context.workspaceId)
            .eq("type", "architecture_summary")
            .limit(1)
            .single(),
          supabase
            .from("codebase_modules")
            .select("file_path, module_type, summary")
            .eq("workspace_id", context.workspaceId)
            .order("created_at", { ascending: false })
            .limit(10),
        ]);

        codeContext = {};
        if (archResult.status === "fulfilled" && archResult.value.data) {
          const content = archResult.value.data.content;
          codeContext.architectureSummary = typeof content === "string" ? content : JSON.stringify(content);
        }
        if (modulesResult.status === "fulfilled" && modulesResult.value.data) {
          codeContext.modules = modulesResult.value.data.map((m: { file_path: string; module_type: string; summary: string }) => ({
            filePath: m.file_path,
            moduleType: m.module_type,
            summary: m.summary,
          }));
        }
      }

      // Call synthesize API
      const res = await fetch("/api/ai/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback, codeContext }),
      });

      if (!res.ok) throw new Error("Failed to synthesize evidence");

      const { synthesis } = await res.json();

      // Format themes as text for the result view
      const formatted = (synthesis as { theme: string; detail: string }[])
        .map((t) => `${t.theme}\n${t.detail}`)
        .join("\n\n---\n\n");

      setStreamedText(formatted);
      setIsStreaming(false);
      setView("result");
    } catch (err) {
      setIsStreaming(false);
      setError(err instanceof Error ? err.message : "Failed to synthesize evidence");
      setView("result");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, codebaseConnection?.status]);

  const handleItemSelect = useCallback(
    (item: DisplayItem) => {
      // Navigate items — execute callback and close
      if (item.type === "navigate" || item.type === "spec_result") {
        item.onSelect?.();
        handleClose();
        return;
      }

      // Quick actions — enter sub-view or execute directly
      if (item.type === "quick_action") {
        if (item.id === "qa-build-next") {
          setSubView({ actionId: "what_to_build_next", placeholder: "Describe your product briefly for context..." });
          setQuery("");
          requestAnimationFrame(() => inputRef.current?.focus());
          return;
        }
        if (item.id === "qa-customer-struggles") {
          setSubView({ actionId: "customer_struggles", placeholder: "Describe your product briefly for context..." });
          setQuery("");
          requestAnimationFrame(() => inputRef.current?.focus());
          return;
        }
        if (item.id === "qa-unaddressed-feedback") {
          setSubView({ actionId: "unaddressed_feedback", placeholder: "Describe your product briefly for context..." });
          setQuery("");
          requestAnimationFrame(() => inputRef.current?.focus());
          return;
        }
        if (item.id === "qa-research") {
          setSubView({ actionId: "research_feature", placeholder: "What feature do you want to research?" });
          setQuery("");
          requestAnimationFrame(() => inputRef.current?.focus());
          return;
        }
        if (item.id === "qa-worth-building") {
          setSubView({ actionId: "is_worth_building", placeholder: "What feature do you want to evaluate?" });
          setQuery("");
          requestAnimationFrame(() => inputRef.current?.focus());
          return;
        }
        if (item.id === "qa-summarize-evidence") {
          executeSummarizeEvidence();
          return;
        }
        return;
      }

      // Freeform
      if (item.type === "freeform") {
        executeAction(null, query);
        return;
      }

      // AI action
      if (item.action) {
        // Check if action needs a param and user hasn't provided it
        if (item.action.extractParam) {
          const param = item.action.extractParam(query);
          if (param) {
            executeAction(item.action, query);
          } else {
            // Pre-fill the input with the action label prefix so user can type the param
            setQuery(item.action.label.replace("...", " "));
            inputRef.current?.focus();
          }
        } else {
          executeAction(item.action);
        }
      }
    },
    [query, executeAction, executeWorkspaceAction, executeSummarizeEvidence, handleClose]
  );

  // --- Effects ---

  useEffect(() => {
    if (open) {
      resetState();
      document.body.style.overflow = "hidden";
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, resetState]);

  useEffect(() => {
    setFocusedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isStreaming && abortRef.current) {
          abortRef.current.abort();
          setIsStreaming(false);
          setView("result");
        } else if (subView) {
          // Exit sub-view back to main actions
          setSubView(null);
          setQuery("");
          requestAnimationFrame(() => inputRef.current?.focus());
        } else {
          handleClose();
        }
      }
    };
    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, [open, handleClose, isStreaming, subView]);

  // Scroll focused item
  useEffect(() => {
    if (!listRef.current || view !== "actions") return;
    const items = listRef.current.querySelectorAll("[data-command-item]");
    items[focusedIndex]?.scrollIntoView({ block: "nearest" });
  }, [focusedIndex, view]);

  // No auto-scroll during streaming — user controls scroll position

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (view !== "actions") return;

    // Sub-view mode: Enter executes the quick action
    if (subView && e.key === "Enter") {
      e.preventDefault();
      if (query.trim()) {
        const action = AI_ACTIONS.find((a) => a.id === subView.actionId) || null;
        const isWorkspaceAction =
          action?.contextStrategy === "workspace_overview";
        if (isWorkspaceAction && action) {
          executeWorkspaceAction(action, query);
        } else {
          executeAction(action, query);
        }
        setSubView(null);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex((prev) =>
          prev < flatItems.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex((prev) =>
          prev > 0 ? prev - 1 : flatItems.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (flatItems[focusedIndex]) {
          handleItemSelect(flatItems[focusedIndex]);
        } else if (query.trim()) {
          executeAction(null, query);
        }
        break;
    }
  };

  // --- Action button handlers ---

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(streamedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [streamedText]);

  const handleInsertBelow = useCallback(() => {
    onInsertBelow?.(streamedText);
    handleClose();
  }, [streamedText, onInsertBelow, handleClose]);

  const handleCreateArtifacts = useCallback(() => {
    const stories = parseUserStories(streamedText);
    if (stories.length > 0) {
      onCreateArtifacts?.(stories);
    }
    handleClose();
  }, [streamedText, onCreateArtifacts, handleClose]);

  const handleDiscard = useCallback(() => {
    setView("actions");
    setStreamedText("");
    streamedTextRef.current = "";
    setActiveAction(null);
    setError(null);
    setSubView(null);
    setResponseMode("concise");
    setConversationHistory([]);
    setFollowUpQuery("");
    cachedPromptsRef.current = null;
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const handleGoDeeper = useCallback(async () => {
    const cached = cachedPromptsRef.current;
    if (!cached) return;

    setView("streaming");
    setStreamedText("");
    streamedTextRef.current = "";
    setIsStreaming(true);
    setResponseMode("detailed");
    setError(null);
    userHasScrolledUpRef.current = false;

    // Reset conversation history for the detailed version
    setConversationHistory([{ role: "user", content: cached.user }]);

    const abortController = new AbortController();
    abortRef.current = abortController;

    await streamCompletion({
      system: cached.system,
      user: cached.user,
      model: "sonnet",
      maxTokens: 4096,
      onChunk: (text) => {
        streamedTextRef.current += text;
        setStreamedText(streamedTextRef.current);
      },
      onComplete: (fullText) => {
        setIsStreaming(false);
        setView("result");
        setConversationHistory((prev) => [
          ...prev,
          { role: "assistant", content: fullText },
        ]);
      },
      onError: (err) => {
        setIsStreaming(false);
        setError(err.message);
        setView("result");
      },
      signal: abortController.signal,
    });
  }, []);

  const handleFollowUp = useCallback(async () => {
    const text = followUpQuery.trim();
    if (!text || !cachedPromptsRef.current) return;

    const system = cachedPromptsRef.current.system;
    const newHistory = [
      ...conversationHistory,
      { role: "user", content: text },
    ];

    setConversationHistory(newHistory);
    setFollowUpQuery("");
    setView("streaming");
    setStreamedText("");
    streamedTextRef.current = "";
    setIsStreaming(true);
    setError(null);
    setResponseMode("detailed");
    userHasScrolledUpRef.current = false;

    const abortController = new AbortController();
    abortRef.current = abortController;

    await streamCompletion({
      system,
      user: "",
      messages: newHistory,
      model: "sonnet",
      maxTokens: 4096,
      onChunk: (chunk) => {
        streamedTextRef.current += chunk;
        setStreamedText(streamedTextRef.current);
      },
      onComplete: (fullText) => {
        setIsStreaming(false);
        setView("result");
        setConversationHistory((prev) => [
          ...prev,
          { role: "assistant", content: fullText },
        ]);
      },
      onError: (err) => {
        setIsStreaming(false);
        setError(err.message);
        setView("result");
      },
      signal: abortController.signal,
    });
  }, [followUpQuery, conversationHistory]);

  if (!open) return null;

  // --- Compute flat index offset per section for rendering ---
  let runningIndex = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-white/80 pt-[15vh] backdrop-blur-[8px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div className="flex w-full max-w-[580px] flex-col rounded-none border border-border-strong bg-bg-primary shadow-modal">
        {/* Input */}
        <div className="flex items-center gap-3 border-b border-border-default px-4">
          <Icon icon={Sparkles} className="shrink-0 text-text-tertiary" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (view !== "actions") {
                setView("actions");
                setStreamedText("");
                streamedTextRef.current = "";
                setSubView(null);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              subView
                ? subView.placeholder
                : view === "actions"
                  ? "Type a command or ask anything..."
                  : "Type to start a new query..."
            }
            className="h-12 flex-1 bg-transparent text-lg text-text-primary placeholder:text-text-tertiary focus:outline-none"
            role="combobox"
            aria-expanded={true}
            aria-controls="command-list"
          />
          {isStreaming && (
            <Icon
              icon={Loader2}
              size={16}
              className="shrink-0 animate-spin text-text-tertiary"
            />
          )}
        </div>

        {/* Actions list */}
        {view === "actions" && !subView && (
          <div
            ref={listRef}
            id="command-list"
            role="listbox"
            className="max-h-[320px] overflow-y-auto py-2"
          >
            {flatItems.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-text-tertiary">
                Type to search commands or ask a question
              </div>
            )}
            {sections.map((section) => {
              const sectionStartIndex = runningIndex;
              const sectionEl = (
                <div key={section.label}>
                  <div className="px-4 pt-3 pb-1.5 text-xs font-medium uppercase tracking-[0.05em] text-text-tertiary">
                    {section.label}
                  </div>
                  {section.items.map((item, idx) => {
                    const flatIdx = sectionStartIndex + idx;
                    return (
                      <div
                        key={item.id}
                        data-command-item
                        role="option"
                        aria-selected={focusedIndex === flatIdx}
                        className={cn(
                          "cursor-pointer px-4 py-2.5",
                          focusedIndex === flatIdx && "bg-bg-hover"
                        )}
                        onClick={() => handleItemSelect(item)}
                        onMouseEnter={() => setFocusedIndex(flatIdx)}
                      >
                        <div className="flex items-center gap-2">
                          <Icon
                            icon={item.icon || Sparkles}
                            size={14}
                            className="shrink-0 text-text-tertiary"
                          />
                          <span className="text-sm font-medium text-text-primary">
                            {item.label}
                          </span>
                        </div>
                        <div className="mt-0.5 pl-[22px] text-xs text-text-tertiary">
                          {item.description}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
              runningIndex += section.items.length;
              return sectionEl;
            })}
          </div>
        )}

        {/* Sub-view: prompt for quick action input */}
        {view === "actions" && subView && (
          <div className="px-4 py-6 text-center text-sm text-text-tertiary">
            Type your query and press Enter
          </div>
        )}

        {/* Streaming / Result area */}
        {(view === "streaming" || view === "result") && (
          <div className="flex flex-col">
            {/* Response content */}
            <div
              ref={responseRef}
              className="max-h-[400px] overflow-y-auto px-6 pt-5 pb-4"
              onScroll={handleResponseScroll}
            >
              {error ? (
                <div className="space-y-3">
                  <div className="text-sm text-state-error">
                    Something went wrong. Try again.
                  </div>
                  <button
                    onClick={() => {
                      setError(null);
                      if (activeAction) {
                        executeAction(activeAction, query || undefined);
                      } else if (query) {
                        executeAction(null, query);
                      }
                    }}
                    className="inline-flex cursor-pointer items-center gap-1.5 border border-border-default bg-bg-primary px-3 py-1.5 text-[13px] font-medium text-text-primary hover:bg-bg-hover"
                  >
                    Retry
                  </button>
                </div>
              ) : streamedText ? (
                <div className="ai-response prose-koso text-[15px] leading-relaxed text-text-primary">
                  <StreamedMarkdown text={streamedText} />
                  {isStreaming && <span className="typewriter-cursor" />}
                </div>
              ) : isStreaming ? (
                <div className="ai-thinking">
                  <span className="ai-thinking-dot" />
                  <span className="ai-thinking-dot" />
                  <span className="ai-thinking-dot" />
                </div>
              ) : null}
            </div>

            {/* Action buttons */}
            {view === "result" && !error && (
              <div className="flex items-center gap-2 border-t border-border-default px-4 py-3">
                {/* Contextual insert buttons */}
                {activeAction?.outputMode === "stream_with_artifacts" &&
                  onCreateArtifacts && (
                    <button
                      onClick={handleCreateArtifacts}
                      className="inline-flex cursor-pointer items-center gap-1.5 border border-border-strong bg-bg-inverse px-3 py-1.5 text-[13px] font-medium text-text-inverse hover:bg-[#222]"
                    >
                      <Icon icon={Plus} size={14} />
                      Create as artifacts
                    </button>
                  )}

                {(activeAction?.outputMode === "stream_with_insert" ||
                  activeAction?.outputMode === "stream_with_artifacts" ||
                  activeAction?.outputMode === "stream_with_checklist" ||
                  !activeAction) &&
                  onInsertBelow && (
                    <button
                      onClick={handleInsertBelow}
                      className="inline-flex cursor-pointer items-center gap-1.5 border border-border-default bg-bg-primary px-3 py-1.5 text-[13px] font-medium text-text-primary hover:bg-bg-hover"
                    >
                      <Icon
                        icon={
                          activeAction?.outputMode === "stream_with_checklist"
                            ? ListChecks
                            : ArrowDownToLine
                        }
                        size={14}
                      />
                      {activeAction?.outputMode === "stream_with_checklist"
                        ? "Insert as checklist"
                        : "Insert below"}
                    </button>
                  )}

                {responseMode === "concise" && (
                  <button
                    onClick={handleGoDeeper}
                    className="inline-flex cursor-pointer items-center gap-1.5 border border-border-default bg-bg-primary px-3 py-1.5 text-[13px] font-medium text-text-primary hover:bg-bg-hover"
                  >
                    <Icon icon={Telescope} size={14} />
                    Go deeper
                  </button>
                )}

                <button
                  onClick={handleCopy}
                  className="inline-flex cursor-pointer items-center gap-1.5 border border-border-default bg-bg-primary px-3 py-1.5 text-[13px] font-medium text-text-primary hover:bg-bg-hover"
                >
                  <Icon icon={copied ? Check : Copy} size={14} />
                  {copied ? "Copied" : "Copy"}
                </button>

                <div className="flex-1" />

                <button
                  onClick={handleDiscard}
                  className="inline-flex cursor-pointer items-center gap-1.5 border-none bg-transparent px-2 py-1.5 text-[13px] text-text-tertiary hover:text-text-primary"
                >
                  <Icon icon={X} size={14} />
                  Discard
                </button>
              </div>
            )}

            {/* Follow-up input */}
            {view === "result" && !error && conversationHistory.length > 0 && (
              <div className="flex items-center gap-2 border-t border-border-default px-4 py-2">
                <input
                  ref={followUpInputRef}
                  type="text"
                  value={followUpQuery}
                  onChange={(e) => setFollowUpQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && followUpQuery.trim()) {
                      e.preventDefault();
                      handleFollowUp();
                    }
                  }}
                  placeholder="Ask a follow-up..."
                  className="h-9 flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
                />
                <button
                  onClick={handleFollowUp}
                  disabled={!followUpQuery.trim()}
                  className="inline-flex shrink-0 cursor-pointer items-center gap-1 border-none bg-transparent px-2 py-1.5 text-[13px] text-text-tertiary hover:text-text-primary disabled:cursor-default disabled:opacity-30"
                >
                  <Icon icon={SendHorizontal} size={14} />
                </button>
              </div>
            )}

            {/* Streaming: stop button */}
            {view === "streaming" && (
              <div className="flex items-center border-t border-border-default px-4 py-3">
                <button
                  onClick={() => {
                    abortRef.current?.abort();
                    setIsStreaming(false);
                    setView("result");
                  }}
                  className="inline-flex cursor-pointer items-center gap-1.5 border border-border-default bg-bg-primary px-3 py-1.5 text-[13px] font-medium text-text-primary hover:bg-bg-hover"
                >
                  <Icon icon={X} size={14} />
                  Stop
                </button>
                <span className="ml-3 text-xs text-text-tertiary">
                  Press Esc to stop
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// StreamedMarkdown is imported from "@/components/ui/streamed-markdown"
