"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, TextArea, KosoWordmark } from "@/components/ui";
import { FeedbackList } from "@/components/evidence/feedback-list";
import { createClient } from "@/lib/supabase/client";
import { setActiveWorkspaceCookie } from "@/lib/workspace-cookie";
import { parseFeedback, type FeedbackItem } from "@/lib/parse-feedback";

type Step = 1 | 2 | 3 | 4;

function ProgressDots({ current }: { current: Step }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {[1, 2, 3, 4].map((step) => (
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

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>(1);
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [existingSpec, setExistingSpec] = useState("");
  const [creating, setCreating] = useState(false);

  // Feedback step state
  const [rawFeedback, setRawFeedback] = useState("");
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [feedbackParsed, setFeedbackParsed] = useState(false);
  const [synthesis, setSynthesis] = useState<
    { theme: string; detail: string }[] | null
  >(null);
  const [showSynthesis, setShowSynthesis] = useState(false);
  const [synthesizing, setSynthesizing] = useState(false);

  const synthTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const supabase = createClient();

  // Clean up synthesis auto-advance timer
  useEffect(() => {
    return () => {
      if (synthTimerRef.current) {
        clearTimeout(synthTimerRef.current);
      }
    };
  }, []);

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
      setStep(3);
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

        // Auto-advance after 3.5 seconds
        synthTimerRef.current = setTimeout(() => {
          setStep(3);
          setShowSynthesis(false);
        }, 3500);
      } else {
        setStep(3);
      }
    } catch {
      setStep(3);
    } finally {
      setSynthesizing(false);
    }
  }

  function handleAdvanceFromSynthesis() {
    if (synthTimerRef.current) {
      clearTimeout(synthTimerRef.current);
      synthTimerRef.current = null;
    }
    setShowSynthesis(false);
    setStep(3);
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
      // Update existing workspace
      await supabase
        .from("workspaces")
        .update({
          name: productName.trim() || "My Product",
          product_description: productDescription.trim() || null,
        })
        .eq("id", existing[0].id);
      workspaceId = existing[0].id;
    } else {
      // Create new workspace
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

    // If they pasted a spec, create an artifact from it
    if (existingSpec.trim()) {
      const { data: artifact } = await supabase
        .from("artifacts")
        .insert({
          workspace_id: workspaceId,
          type: "prd",
          title: `${productName.trim() || "Product"} Spec`,
          content: {
            type: "doc",
            content: existingSpec
              .trim()
              .split("\n\n")
              .filter(Boolean)
              .map((para) => {
                if (para.startsWith("# ")) {
                  return {
                    type: "heading",
                    attrs: { level: 1 },
                    content: [{ type: "text", text: para.slice(2) }],
                  };
                }
                if (para.startsWith("## ")) {
                  return {
                    type: "heading",
                    attrs: { level: 2 },
                    content: [{ type: "text", text: para.slice(3) }],
                  };
                }
                if (para.startsWith("### ")) {
                  return {
                    type: "heading",
                    attrs: { level: 3 },
                    content: [{ type: "text", text: para.slice(4) }],
                  };
                }
                return {
                  type: "paragraph",
                  content: [{ type: "text", text: para }],
                };
              }),
          },
          status: "draft",
        })
        .select("id")
        .single();

      // Fire-and-forget: embed the artifact
      if (artifact) {
        fetch("/api/embeddings/index", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceId: artifact.id,
            sourceType: "artifact",
          }),
        }).catch(() => {});
      }
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
          // Fire-and-forget: embed this evidence
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

    setActiveWorkspaceCookie(workspaceId);
    router.push("/home");
    router.refresh();
  }

  function handleConnectGitHub() {
    // Store onboarding state in sessionStorage so we can resume after OAuth
    sessionStorage.setItem("koso_onboarding", "true");
    window.location.href = "/api/auth/github";
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
                placeholder="Acme"
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

        {/* Step 2: Customer feedback */}
        {step === 2 && (
          <div className="mt-10">
            <h1 className="text-center text-2xl font-bold tracking-tight">
              Got customer feedback?
            </h1>
            <p className="mt-2 text-center text-sm text-text-secondary">
              Paste feedback from users — emails, Slack messages, survey
              responses. We&apos;ll help you spot patterns.
            </p>

            {/* Sub-state: Synthesis display */}
            {showSynthesis && synthesis && (
              <div className="mt-8">
                <div className="border border-border-default bg-bg-secondary p-6">
                  <p className="text-sm font-medium">What we&apos;re hearing</p>
                  <div className="mt-2 space-y-3">
                    {synthesis.map((t, i) => (
                      <div key={i}>
                        <p className="text-base font-medium">{t.theme}</p>
                        <p className="text-sm text-text-secondary">
                          {t.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-8">
                  <Button
                    className="w-full"
                    onClick={handleAdvanceFromSynthesis}
                  >
                    Continue
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
                    onClick={() => setStep(3)}
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
                    onClick={() => setStep(3)}
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

        {/* Step 3: Paste a spec */}
        {step === 3 && (
          <div className="mt-10">
            <h1 className="text-center text-2xl font-bold tracking-tight">
              Got an existing spec?
            </h1>
            <p className="mt-2 text-center text-sm text-text-secondary">
              Paste your most recent PRD or product doc. This helps the AI
              understand your product faster.
            </p>
            <div className="mt-8">
              <TextArea
                placeholder="Paste your spec here..."
                value={existingSpec}
                onChange={(e) => setExistingSpec(e.target.value)}
                className="min-h-[200px]"
              />
            </div>
            <div className="mt-8 flex gap-3">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => setStep(4)}
              >
                Skip
              </Button>
              <Button
                className="flex-1"
                onClick={() => setStep(4)}
                disabled={!existingSpec.trim()}
              >
                Add & Continue
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Connect your code */}
        {step === 4 && (
          <div className="mt-10">
            <h1 className="text-center text-2xl font-bold tracking-tight">
              Connect your codebase
            </h1>
            <p className="mt-2 text-center text-sm text-text-secondary">
              Link a GitHub repo so the AI can assess technical feasibility as
              you write specs.
            </p>
            <p className="mt-1 text-center text-xs text-text-tertiary">
              We&apos;ll index your codebase in the background. You&apos;ll see
              code context once it&apos;s ready.
            </p>
            <div className="mt-8 flex flex-col gap-3">
              <Button variant="secondary" onClick={handleConnectGitHub}>
                Connect GitHub
              </Button>
              <Button
                variant="ghost"
                onClick={handleFinish}
                disabled={creating}
              >
                {creating ? "Setting up..." : "Skip for now"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
