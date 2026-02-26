"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Input, TextArea, KosoWordmark } from "@/components/ui";
import { FeedbackList } from "@/components/evidence/feedback-list";
import { RepoPicker } from "@/components/codebase/repo-picker";
import { toast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { setActiveWorkspaceCookie } from "@/lib/workspace-cookie";
import { parseFeedback, type FeedbackItem } from "@/lib/parse-feedback";
import { SAMPLE_FEEDBACK_ITEMS, SAMPLE_EVIDENCE_TAG } from "@/lib/sample-feedback";
import { placeholderSpecDoc, sectionsToTiptapDoc } from "@/lib/sections-to-tiptap";
import { useCodebaseStatus } from "@/hooks/use-codebase-status";
import type { GitHubRepo, CodebaseConnection } from "@/types";

type Step = 1 | 2;
type Step2Phase = "github" | "feedback";

function ProgressDots({ current }: { current: Step }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {[1, 2].map((step) => (
        <div
          key={step}
          className={`h-2 w-2 ${
            step === current ? "bg-text-primary" : "bg-border-default"
          }`}
        />
      ))}
    </div>
  );
}

function IndexingProgress({
  repoName,
  connection,
  onContinue,
  onRefresh,
}: {
  repoName: string;
  connection: CodebaseConnection | null;
  onContinue: () => void;
  onRefresh: () => void;
}) {
  const status = connection?.status;
  const fileCount = connection?.file_count ?? 0;
  const moduleCount = connection?.module_count ?? 0;
  const isIndexing = !status || status === "syncing" || status === "pending";
  const isDone = status === "ready";

  // Poll at 1.5 s while indexing so the progress bar updates smoothly.
  // The shared hook polls at 3 s — this supplements it during onboarding.
  useEffect(() => {
    if (!isIndexing) return;
    const id = setInterval(onRefresh, 1500);
    return () => clearInterval(id);
  }, [isIndexing, onRefresh]);

  // Track whether we ever saw an in-progress state.
  // If the first real data is already "ready" we play a brief fill animation
  // instead of jumping straight to 100%.
  const [everSawSyncing, setEverSawSyncing] = useState(false);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (status === "syncing" || status === "pending") {
      setEverSawSyncing(true);
    }
  }, [status]);

  useEffect(() => {
    if (!isDone) return;
    if (everSawSyncing) {
      setSettled(true);
      return;
    }
    // Animate from 0 → 100 on next frame via CSS transition
    const id = setTimeout(() => setSettled(true), 50);
    return () => clearTimeout(id);
  }, [isDone, everSawSyncing]);

  const showDone = isDone && settled;
  const realPct = fileCount > 0 ? Math.round((moduleCount / fileCount) * 100) : 0;

  let barWidth: number;
  if (showDone) {
    barWidth = 100;
  } else if (!connection || (!everSawSyncing && isDone)) {
    barWidth = 0;
  } else {
    barWidth = realPct;
  }

  let label: string;
  if (showDone) {
    label = `Indexed ${moduleCount} modules`;
  } else if (fileCount > 0 && everSawSyncing) {
    label = `Indexing \u2014 ${moduleCount} of ${fileCount} files`;
  } else {
    label = "Starting indexing\u2026";
  }

  return (
    <div className="mt-8">
      <div className="border border-border-default bg-bg-secondary p-5">
        <p className="text-center text-sm font-medium text-text-primary">
          Connected to {repoName}
        </p>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-text-secondary">
            <span className="flex items-center gap-2">
              {!showDone && (
                <span className="inline-block h-2 w-2 animate-pulse bg-text-primary" />
              )}
              {label}
            </span>
            {(fileCount > 0 || showDone) && (
              <span>{showDone ? "100" : realPct}%</span>
            )}
          </div>
          <div className="mt-2 h-1.5 w-full bg-border-default">
            <div
              className="h-full bg-text-primary transition-all duration-700 ease-out"
              style={{ width: `${barWidth}%` }}
            />
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-text-tertiary">
          {showDone
            ? "All set \u2014 code context is ready."
            : "This keeps running in the background. Feel free to continue."}
        </p>
      </div>
      <div className="mt-6">
        <Button className="w-full" onClick={onContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}

import type { SpecSection } from "@/lib/sections-to-tiptap";

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>(1);
  const [step2Phase, setStep2Phase] = useState<Step2Phase>("github");
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [creating, setCreating] = useState(false);

  // Step 2A: Codebase
  const [codebaseConnected, setCodebaseConnected] = useState(false);
  const [githubAuthed, setGithubAuthed] = useState(false);
  const [repoPickerOpen, setRepoPickerOpen] = useState(false);
  const [connectingRepo, setConnectingRepo] = useState(false);
  const [connectedRepoName, setConnectedRepoName] = useState<string | null>(null);

  // Step 2B: Feedback
  const [rawFeedback, setRawFeedback] = useState("");
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [feedbackParsed, setFeedbackParsed] = useState(false);
  const [usingSampleData, setUsingSampleData] = useState(false);
  const [synthesis, setSynthesis] = useState<
    { theme: string; detail: string }[] | null
  >(null);
  const [showSynthesis, setShowSynthesis] = useState(false);
  const [synthesizing, setSynthesizing] = useState(false);

  // Spec sections (drafted inline before redirect)
  const [specSections, setSpecSections] = useState<SpecSection[]>([]);

  // Restore product name/description from sessionStorage (survives GitHub OAuth redirect)
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const savedName = sessionStorage.getItem("koso_onboarding_product_name");
    const savedDesc = sessionStorage.getItem("koso_onboarding_product_desc");
    if (savedName) setProductName(savedName);
    if (savedDesc) setProductDescription(savedDesc);
    setHydrated(true);
  }, []);

  // Persist to sessionStorage whenever values change (skip the initial restore)
  useEffect(() => {
    if (!hydrated) return;
    sessionStorage.setItem("koso_onboarding_product_name", productName);
  }, [productName, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    sessionStorage.setItem("koso_onboarding_product_desc", productDescription);
  }, [productDescription, hydrated]);

  const searchParams = useSearchParams();
  const supabase = createClient();
  const { connection: indexingConnection, refresh: refreshCodebaseStatus } = useCodebaseStatus(codebaseConnected);

  // Resume at step 2 with repo picker if returning from GitHub OAuth
  useEffect(() => {
    if (searchParams.get("github") === "connected") {
      setGithubAuthed(true);
      setStep(2);
      setStep2Phase("github");
      setRepoPickerOpen(true);
    }
  }, [searchParams]);

  function handleLoadSampleData() {
    setFeedbackItems(SAMPLE_FEEDBACK_ITEMS);
    setFeedbackParsed(true);
    setUsingSampleData(true);
  }

  function handleParseFeedback() {
    const items = parseFeedback(rawFeedback);
    setFeedbackItems(items);
    setFeedbackParsed(true);

    // Fire-and-forget: generate AI titles for each item
    items.forEach((item) => {
      fetch("/api/ai/title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: item.content }),
      })
        .then((res) => res.json())
        .then(({ title }) => {
          if (title) {
            setFeedbackItems((prev) =>
              prev.map((fi) => (fi.id === item.id ? { ...fi, title } : fi))
            );
          }
        })
        .catch(() => {});
    });
  }

  function handleUpdateFeedbackItem(id: string, content: string) {
    setFeedbackItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, content } : item))
    );
  }

  function handleRemoveFeedbackItem(id: string) {
    setFeedbackItems((prev) => prev.filter((item) => item.id !== id));
  }

  async function handleSynthesizeFeedback() {
    if (feedbackItems.length === 0) {
      handleFinish();
      return;
    }

    setSynthesizing(true);
    try {
      const res = await fetch("/api/ai/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback: feedbackItems.map((item) => item.content),
        }),
      });

      if (res.ok) {
        const { synthesis: result } = await res.json();
        setSynthesis(result);
        setShowSynthesis(true);
      }
    } catch {
      // Continue without synthesis
    } finally {
      setSynthesizing(false);
    }
  }

  async function handleDraftSpecAndFinish() {
    if (!synthesis || synthesis.length === 0) return;
    setCreating(true);

    const themes = synthesis.map((t) => ({
      label: t.theme,
      summary: t.detail,
      feedback: feedbackItems.map((f) => f.content),
    }));

    // Generation context will be stored in sessionStorage after we know the artifact ID
    const generationContext = {
      themes,
      product: {
        name: productName,
        description: productDescription,
      },
    };

    // Create workspace + evidence + placeholder artifact immediately
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: existing } = await supabase
      .from("workspaces")
      .select("id")
      .eq("user_id", user.id)
      .limit(1);

    let workspaceId: string;

    if (existing && existing.length > 0) {
      await supabase
        .from("workspaces")
        .update({
          name: productName.trim() || "My Product",
          product_description: productDescription.trim() || null,
        })
        .eq("id", existing[0].id);
      workspaceId = existing[0].id;
    } else {
      const { data: ws } = await supabase
        .from("workspaces")
        .insert({
          user_id: user.id,
          name: productName.trim() || "My Product",
          product_description: productDescription.trim() || null,
          principles: [],
        })
        .select("id")
        .single();

      if (!ws) return;
      workspaceId = ws.id;
    }

    // Insert feedback items
    if (feedbackItems.length > 0) {
      for (const item of feedbackItems) {
        const evidenceTitle = item.title || item.content.slice(0, 60);
        const tags = usingSampleData ? [SAMPLE_EVIDENCE_TAG] : [];
        const { data: evidenceData } = await supabase
          .from("evidence")
          .insert({
            workspace_id: workspaceId,
            type: "feedback" as const,
            title: evidenceTitle,
            content: item.content,
            source: null,
            tags,
          })
          .select("id")
          .single();

        if (evidenceData?.id) {
          fetch("/api/embeddings/index", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sourceId: evidenceData.id,
              sourceType: "evidence",
            }),
          }).catch(() => {});
        }
      }
    }

    // Create artifact with placeholder section headings
    const { data: artifact } = await supabase
      .from("artifacts")
      .insert({
        workspace_id: workspaceId,
        type: "prd",
        title: `${productName.trim() || "Product"} Spec`,
        content: placeholderSpecDoc(),
        status: "draft",
      })
      .select("id")
      .single();

    if (artifact) {
      sessionStorage.setItem(
        `koso_draft_spec_context_${artifact.id}`,
        JSON.stringify(generationContext)
      );
      // Clean up onboarding state
      sessionStorage.removeItem("koso_onboarding_product_name");
      sessionStorage.removeItem("koso_onboarding_product_desc");
      setActiveWorkspaceCookie(workspaceId);
      // Hard navigation to ensure the (app) layout re-fetches fresh workspace data
      window.location.href = `/editor/${artifact.id}?generating=true`;
      return;
    }

    // Fallback: redirect to home if artifact creation failed
    sessionStorage.removeItem("koso_onboarding_product_name");
    sessionStorage.removeItem("koso_onboarding_product_desc");
    setActiveWorkspaceCookie(workspaceId);
    window.location.href = "/home";
  }

  function handleSaveEvidenceAndContinue() {
    setShowSynthesis(false);
    handleFinish();
  }

  function handleConnectGitHub() {
    sessionStorage.setItem("koso_onboarding", "true");
    window.location.href = "/api/auth/github?return_to=/onboarding";
  }

  async function handleSelectRepo(repo: GitHubRepo) {
    setRepoPickerOpen(false);
    setConnectingRepo(true);

    try {
      const res = await fetch("/api/codebase/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoFullName: repo.full_name,
          repoUrl: repo.html_url,
          defaultBranch: repo.default_branch,
        }),
      });

      if (!res.ok && res.status !== 409) {
        const data = await res.json().catch(() => ({ error: "Unknown error" }));
        toast({ message: `Failed to connect: ${data.error || "Unknown error"}` });
        setConnectingRepo(false);
        return;
      }

      setCodebaseConnected(true);
      setConnectingRepo(false);
      setConnectedRepoName(repo.full_name);

      // codebaseConnected flipping to true will trigger a refetch in the hook
    } catch {
      toast({ message: "Failed to connect repository. Try again." });
      setConnectingRepo(false);
    }
  }

  async function handleFinish(draftSections?: SpecSection[]) {
    setCreating(true);
    const sections = draftSections ?? specSections;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Check if workspace already exists (from signup)
    const { data: existing } = await supabase
      .from("workspaces")
      .select("id")
      .eq("user_id", user.id)
      .limit(1);

    let workspaceId: string;

    if (existing && existing.length > 0) {
      await supabase
        .from("workspaces")
        .update({
          name: productName.trim() || "My Product",
          product_description: productDescription.trim() || null,
        })
        .eq("id", existing[0].id);
      workspaceId = existing[0].id;
    } else {
      const { data: ws } = await supabase
        .from("workspaces")
        .insert({
          user_id: user.id,
          name: productName.trim() || "My Product",
          product_description: productDescription.trim() || null,
          principles: [],
        })
        .select("id")
        .single();

      if (!ws) return;
      workspaceId = ws.id;
    }

    // Insert feedback items into evidence table
    if (feedbackItems.length > 0) {
      for (const item of feedbackItems) {
        const evidenceTitle = item.title || item.content.slice(0, 60);
        const tags = usingSampleData ? [SAMPLE_EVIDENCE_TAG] : [];
        const { data: evidenceData } = await supabase
          .from("evidence")
          .insert({
            workspace_id: workspaceId,
            type: "feedback" as const,
            title: evidenceTitle,
            content: item.content,
            source: null,
            tags,
          })
          .select("id")
          .single();

        if (evidenceData?.id) {
          fetch("/api/embeddings/index", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sourceId: evidenceData.id,
              sourceType: "evidence",
            }),
          }).catch(() => {});
        }
      }
    }

    // Create spec artifact from structured sections (if drafted)
    if (sections.length > 0) {
      const content = sectionsToTiptapDoc(sections);

      const { data: artifact } = await supabase
        .from("artifacts")
        .insert({
          workspace_id: workspaceId,
          type: "prd",
          title: `${productName.trim() || "Product"} Spec`,
          content,
          status: "draft",
        })
        .select("id")
        .single();

      if (artifact) {
        fetch("/api/embeddings/index", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceId: artifact.id,
            sourceType: "artifact",
          }),
        }).catch(() => {});

        // Redirect to the editor with the new spec
        sessionStorage.removeItem("koso_onboarding_product_name");
        sessionStorage.removeItem("koso_onboarding_product_desc");
        setActiveWorkspaceCookie(workspaceId);
        window.location.href = `/editor/${artifact.id}`;
        return;
      }
    }

    sessionStorage.removeItem("koso_onboarding_product_name");
    sessionStorage.removeItem("koso_onboarding_product_desc");
    setActiveWorkspaceCookie(workspaceId);
    window.location.href = "/home";
  }

  return (
    <div className="flex min-h-screen items-center justify-center page-transition">
      <div className="w-full max-w-[480px] px-6">
        <div className="mb-8 flex justify-center">
          <KosoWordmark size={24} />
        </div>
        <ProgressDots current={step} />

        {/* Step 1: What's your product? */}
        {step === 1 && (
          <div className="mt-10">
            <h1 className="text-center text-2xl font-bold tracking-tight">
              What are you building?
            </h1>
            <div className="mt-8 space-y-5">
              <Input
                label="Product name"
                placeholder="e.g. Stripe, Notion, Figma"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
              />
              <TextArea
                label="Description"
                placeholder="Describe your product in a couple sentences — what it does and who it's for."
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
              />
            </div>
            <div className="mt-8">
              <Button
                className="w-full"
                onClick={() => setStep(2)}
                disabled={!productName.trim()}
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Connect & import */}
        {step === 2 && step2Phase === "github" && (
          <div className="mt-10">
            <h1 className="text-center text-2xl font-bold tracking-tight">
              Connect your codebase
            </h1>
            <p className="mt-2 text-center text-sm text-text-secondary">
              Link a GitHub repo so we can assess what&apos;s easy vs hard to build.
              Code context makes your specs more grounded.
            </p>
            <p className="mt-1 text-center text-xs text-text-tertiary">
              We&apos;ll index your codebase in the background. You can always do
              this later in Settings.
            </p>

            {connectedRepoName ? (
              <IndexingProgress
                repoName={connectedRepoName}
                connection={indexingConnection}
                onContinue={() => setStep2Phase("feedback")}
                onRefresh={refreshCodebaseStatus}
              />
            ) : connectingRepo ? (
              <div className="mt-8 flex items-center justify-center gap-2 text-sm text-text-secondary">
                <span className="inline-block h-2 w-2 animate-pulse bg-text-primary" />
                Connecting repository...
              </div>
            ) : githubAuthed ? (
              <div className="mt-8 flex flex-col gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setRepoPickerOpen(true)}
                >
                  Pick a repository
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setStep2Phase("feedback")}
                >
                  Skip for now
                </Button>
              </div>
            ) : (
              <div className="mt-8 flex flex-col gap-3">
                <Button variant="secondary" onClick={handleConnectGitHub}>
                  Connect GitHub
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setStep2Phase("feedback")}
                >
                  Skip for now
                </Button>
              </div>
            )}
          </div>
        )}

        {step === 2 && step2Phase === "feedback" && (
          <div className="mt-10">
            <h1 className="text-center text-2xl font-bold tracking-tight">
              Got customer feedback?
            </h1>
            <p className="mt-2 text-center text-sm text-text-secondary">
              Paste feedback from users — emails, Slack messages, survey
              responses. We&apos;ll help you spot patterns.
            </p>

            {/* Sub-state: Synthesis display — stays visible until user acts */}
            {showSynthesis && synthesis && (
              <div className="mt-8">
                <div className="border border-border-default bg-bg-secondary p-6">
                  <p className="text-sm font-medium">What we&apos;re hearing</p>
                  <div className="mt-3 max-h-[280px] space-y-3 overflow-y-auto">
                    {synthesis.map((t, i) => (
                      <div
                        key={i}
                        className="border border-border-default bg-bg-primary p-3"
                      >
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{t.theme}</p>
                        </div>
                        <p className="mt-1 text-xs text-text-secondary">
                          {t.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="mt-4 text-center text-xs text-text-tertiary">
                  The AI can draft a product spec from these themes, or you can save
                  the evidence and write one later.
                </p>
                <div className="mt-3 flex gap-3">
                  <Button
                    className="flex-1"
                    onClick={handleDraftSpecAndFinish}
                    disabled={creating}
                  >
                    {creating ? "Drafting spec..." : "Draft a spec from this"}
                  </Button>
                  <Button
                    variant="ghost"
                    className="flex-1"
                    onClick={handleSaveEvidenceAndContinue}
                    disabled={creating}
                  >
                    Save &amp; go to dashboard
                  </Button>
                </div>
              </div>
            )}

            {/* Sub-state: Parsed feedback list */}
            {!showSynthesis && feedbackParsed && (
              <div className="mt-8">
                <FeedbackList
                  items={feedbackItems}
                  onUpdateItem={handleUpdateFeedbackItem}
                  onRemoveItem={handleRemoveFeedbackItem}
                />
                <div className="mt-8 flex gap-3">
                  <Button
                    variant="ghost"
                    className="flex-1"
                    onClick={() => {
                      setFeedbackParsed(false);
                      setFeedbackItems([]);
                      setRawFeedback("");
                      setUsingSampleData(false);
                    }}
                  >
                    Back
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleSynthesizeFeedback}
                    disabled={feedbackItems.length === 0 || synthesizing}
                  >
                    {synthesizing ? "Analyzing..." : "Continue"}
                  </Button>
                </div>
              </div>
            )}

            {/* Sub-state: Raw textarea input */}
            {!showSynthesis && !feedbackParsed && (
              <div className="mt-8">
                <TextArea
                  placeholder="Paste customer feedback here — emails, survey responses, support tickets..."
                  value={rawFeedback}
                  onChange={(e) => setRawFeedback(e.target.value)}
                  onBlur={() => {
                    if (rawFeedback.trim() && !feedbackParsed) {
                      handleParseFeedback();
                    }
                  }}
                  className="min-h-[200px] max-h-[320px]"
                />
                <div className="mt-8 flex flex-col gap-3">
                  {!rawFeedback.trim() && (
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={handleLoadSampleData}
                    >
                      Try with example feedback
                    </Button>
                  )}
                  <div className="flex gap-3">
                    <Button
                      variant="ghost"
                      className="flex-1"
                      onClick={() => handleFinish()}
                    >
                      Skip
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handleParseFeedback}
                      disabled={!rawFeedback.trim()}
                    >
                      Process
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      <RepoPicker
        open={repoPickerOpen}
        onClose={() => setRepoPickerOpen(false)}
        onSelect={handleSelectRepo}
      />
    </div>
  );
}
