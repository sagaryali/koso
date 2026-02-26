"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Input, TextArea, KosoWordmark, Skeleton } from "@/components/ui";
import { StreamedMarkdown } from "@/components/ui/streamed-markdown";
import { FeedbackList } from "@/components/evidence/feedback-list";
import { RepoPicker } from "@/components/codebase/repo-picker";
import { toast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { setActiveWorkspaceCookie } from "@/lib/workspace-cookie";
import { parseFeedback, type FeedbackItem } from "@/lib/parse-feedback";
import { cn } from "@/lib/utils";
import type { GitHubRepo } from "@/types";

type Step = 1 | 2 | 3 | 4 | 5;

function ProgressDots({ current }: { current: Step }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {[1, 2, 3, 4, 5].map((step) => (
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

interface SpecSection {
  section: string;
  text: string;
}

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>(1);
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [creating, setCreating] = useState(false);

  // Step 2: Codebase
  const [codebaseConnected, setCodebaseConnected] = useState(false);
  const [githubAuthed, setGithubAuthed] = useState(false);
  const [repoPickerOpen, setRepoPickerOpen] = useState(false);
  const [connectingRepo, setConnectingRepo] = useState(false);
  const [connectedRepoName, setConnectedRepoName] = useState<string | null>(null);

  // Step 3: Feedback
  const [rawFeedback, setRawFeedback] = useState("");
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [feedbackParsed, setFeedbackParsed] = useState(false);
  const [synthesis, setSynthesis] = useState<
    { theme: string; detail: string }[] | null
  >(null);
  const [showSynthesis, setShowSynthesis] = useState(false);
  const [synthesizing, setSynthesizing] = useState(false);

  // Step 4: First Spec
  const [specSections, setSpecSections] = useState<SpecSection[]>([]);
  const [specStreaming, setSpecStreaming] = useState(false);
  const [currentStreamingSection, setCurrentStreamingSection] = useState<string | null>(null);
  const [specCreated, setSpecCreated] = useState(false);

  // Summary stats
  const [moduleCount, setModuleCount] = useState(0);

  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  // Resume at step 2 with repo picker if returning from GitHub OAuth
  useEffect(() => {
    if (searchParams.get("github") === "connected") {
      setGithubAuthed(true);
      setStep(2);
      setRepoPickerOpen(true);
    }
  }, [searchParams]);

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
      setStep(5);
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

  async function handleTurnIntoSpec() {
    if (!synthesis || synthesis.length === 0) return;

    setStep(4);
    setSpecSections([]);
    setSpecStreaming(true);
    setCurrentStreamingSection(null);

    const themes = synthesis.map((t) => ({
      label: t.theme,
      summary: t.detail,
      feedback: feedbackItems.map((f) => f.content),
    }));

    try {
      const res = await fetch("/api/ai/draft-structured-spec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          themes,
          product: {
            name: productName,
            description: productDescription,
          },
        }),
      });

      if (!res.ok) throw new Error("Draft failed");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      const sections: SpecSection[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.section && parsed.text) {
                sections.push({ section: parsed.section, text: parsed.text });
                setSpecSections([...sections]);
                setCurrentStreamingSection(parsed.section);
              }
              if (parsed.error) throw new Error(parsed.error);
            } catch (e) {
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }
      }
    } catch (err) {
      console.error("[onboarding] Spec draft error:", err);
    } finally {
      setSpecStreaming(false);
      setCurrentStreamingSection(null);
    }
  }

  function handleSaveEvidenceAndContinue() {
    setShowSynthesis(false);
    setStep(5);
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

      // Show success state briefly, then advance
      setTimeout(() => setStep(3), 2000);
    } catch {
      toast({ message: "Failed to connect repository. Try again." });
      setConnectingRepo(false);
    }
  }

  async function handleFinish() {
    setCreating(true);

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
        const { data: evidenceData } = await supabase
          .from("evidence")
          .insert({
            workspace_id: workspaceId,
            type: "feedback" as const,
            title: evidenceTitle,
            content: item.content,
            source: null,
            tags: [],
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
    if (specSections.length > 0) {
      const nodes: { type: string; attrs?: Record<string, unknown>; content?: { type: string; text: string }[] }[] = [];
      for (const section of specSections) {
        nodes.push({
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: section.section }],
        });
        const paragraphs = section.text.trim().split("\n\n").filter(Boolean);
        for (const para of paragraphs) {
          if (para.startsWith("### ")) {
            nodes.push({
              type: "heading",
              attrs: { level: 3 },
              content: [{ type: "text", text: para.slice(4) }],
            });
          } else {
            nodes.push({
              type: "paragraph",
              content: [{ type: "text", text: para }],
            });
          }
        }
      }

      const { data: artifact } = await supabase
        .from("artifacts")
        .insert({
          workspace_id: workspaceId,
          type: "prd",
          title: `${productName.trim() || "Product"} Spec`,
          content: { type: "doc", content: nodes },
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
        setSpecCreated(true);
      }
    }

    setActiveWorkspaceCookie(workspaceId);
    router.push("/home");
    router.refresh();
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

        {/* Step 2: Connect codebase */}
        {step === 2 && (
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
              <div className="mt-8">
                <div className="border border-border-default bg-bg-secondary p-5 text-center">
                  <p className="text-sm font-medium text-text-primary">
                    Connected to {connectedRepoName}
                  </p>
                  <div className="mt-2 flex items-center justify-center gap-2 text-xs text-text-secondary">
                    <span className="inline-block h-2 w-2 animate-pulse bg-text-primary" />
                    Indexing started — code context will appear as you write specs
                  </div>
                </div>
              </div>
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
                  onClick={() => setStep(3)}
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
                  onClick={() => setStep(3)}
                >
                  Skip for now
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Customer feedback */}
        {step === 3 && (
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
                  <div className="mt-3 space-y-3">
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
                <div className="mt-6 flex gap-3">
                  <Button
                    className="flex-1"
                    onClick={handleTurnIntoSpec}
                  >
                    Turn this into a spec
                  </Button>
                  <Button
                    variant="ghost"
                    className="flex-1"
                    onClick={handleSaveEvidenceAndContinue}
                  >
                    Save evidence & continue
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
                    onClick={() => setStep(5)}
                  >
                    Skip
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
                  className="min-h-[200px]"
                />
                <div className="mt-8 flex gap-3">
                  <Button
                    variant="ghost"
                    className="flex-1"
                    onClick={() => setStep(5)}
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
            )}
          </div>
        )}

        {/* Step 4: First Spec (structured draft) */}
        {step === 4 && (
          <div className="mt-10">
            <h1 className="text-center text-2xl font-bold tracking-tight">
              Your first spec
            </h1>
            <p className="mt-2 text-center text-sm text-text-secondary">
              We&apos;re drafting a spec from your evidence, section by section.
            </p>

            <div className="mt-6 max-h-[400px] space-y-4 overflow-y-auto border border-border-default bg-bg-secondary p-4">
              {specSections.map((section) => {
                const isStreaming =
                  specStreaming && currentStreamingSection === section.section;
                return (
                  <div
                    key={section.section}
                    className="border-b border-border-default pb-3 last:border-0"
                  >
                    <h3 className="text-xs font-semibold text-text-primary">
                      {section.section}
                    </h3>
                    <div className="mt-1 text-xs text-text-secondary">
                      <StreamedMarkdown text={section.text} />
                      {isStreaming && (
                        <span className="inline-block h-3 w-0.5 animate-pulse bg-text-primary" />
                      )}
                    </div>
                  </div>
                );
              })}
              {specStreaming && (
                <div className="flex items-center gap-2 py-2 text-xs text-text-tertiary">
                  <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-text-tertiary" />
                  {currentStreamingSection
                    ? `Writing ${currentStreamingSection}...`
                    : "Preparing draft..."}
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              {!specStreaming && specSections.length > 0 ? (
                <>
                  <Button className="flex-1" onClick={() => setStep(5)}>
                    Create spec & finish
                  </Button>
                  <Button
                    variant="ghost"
                    className="flex-1"
                    onClick={() => {
                      setSpecSections([]);
                      setStep(5);
                    }}
                  >
                    Skip
                  </Button>
                </>
              ) : specStreaming ? null : (
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => setStep(5)}
                >
                  Skip
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Step 5: Done */}
        {step === 5 && (
          <div className="mt-10">
            <h1 className="text-center text-2xl font-bold tracking-tight">
              You&apos;re all set
            </h1>
            <p className="mt-2 text-center text-sm text-text-secondary">
              {productName.trim() || "Your product"} is set up
              {feedbackItems.length > 0 &&
                ` with ${feedbackItems.length} evidence item${feedbackItems.length !== 1 ? "s" : ""}`}
              {codebaseConnected && ` and a connected codebase`}
              {specSections.length > 0 && ` and a draft spec`}.
            </p>
            <div className="mt-8">
              <Button
                className="w-full"
                onClick={handleFinish}
                disabled={creating}
              >
                {creating ? "Setting up..." : "Go to dashboard"}
              </Button>
            </div>
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
