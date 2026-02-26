"use client";

import { useState, useEffect, useRef } from "react";
import { StreamedMarkdown } from "@/components/ui/streamed-markdown";

const SECTION_NAMES = [
  "Problem",
  "Goals & Success Metrics",
  "User Stories",
  "Requirements",
  "Open Questions",
];

interface SpecGenerationOverlayProps {
  artifactId: string;
  onComplete: (sections: { section: string; text: string }[]) => void;
  onError: (error: string) => void;
}

export function SpecGenerationOverlay({
  artifactId,
  onComplete,
  onError,
}: SpecGenerationOverlayProps) {
  const [completedSections, setCompletedSections] = useState<
    { section: string; text: string }[]
  >([]);
  const [streaming, setStreaming] = useState(true);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const contextKey = `koso_draft_spec_context_${artifactId}`;
    const progressKey = `koso_draft_spec_progress_${artifactId}`;

    const contextRaw = sessionStorage.getItem(contextKey);
    if (!contextRaw) {
      onError("Generation context not found. You can write your spec manually.");
      return;
    }

    let context: Record<string, unknown>;
    try {
      context = JSON.parse(contextRaw);
    } catch {
      onError("Invalid generation context.");
      return;
    }

    // Restore any previously completed sections
    let cached: { section: string; text: string }[] = [];
    try {
      const progressRaw = sessionStorage.getItem(progressKey);
      if (progressRaw) {
        cached = JSON.parse(progressRaw);
        if (Array.isArray(cached) && cached.length > 0) {
          setCompletedSections(cached);
        }
      }
    } catch {
      cached = [];
    }

    // If all sections already cached, we're done
    if (cached.length >= SECTION_NAMES.length) {
      sessionStorage.removeItem(contextKey);
      sessionStorage.removeItem(progressKey);
      setStreaming(false);
      onComplete(cached);
      return;
    }

    const controller = new AbortController();

    async function stream() {
      try {
        const res = await fetch("/api/ai/draft-structured-spec", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...context,
            // Pass cached sections so the API skips them but uses them as context
            completedSections: cached.length > 0 ? cached : undefined,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          onError("Spec generation request failed.");
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          onError("No response body from generation API.");
          return;
        }

        const decoder = new TextDecoder();
        // Start from cached sections
        const sections = [...cached];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                if (parsed.section && parsed.text) {
                  sections.push({
                    section: parsed.section,
                    text: parsed.text,
                  });
                  setCompletedSections([...sections]);
                  // Persist progress so navigation away doesn't lose it
                  sessionStorage.setItem(progressKey, JSON.stringify(sections));
                }
                if (parsed.error) {
                  onError(parsed.error);
                  return;
                }
              } catch (e) {
                if (e instanceof SyntaxError) continue;
                throw e;
              }
            }
          }
        }

        // All done — clean up storage
        sessionStorage.removeItem(contextKey);
        sessionStorage.removeItem(progressKey);
        setStreaming(false);
        onComplete(sections);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("[spec-generation-overlay] Error:", err);
        onError("Spec generation failed. You can write your spec manually.");
      }
    }

    stream();

    return () => {
      controller.abort();
    };
  }, [artifactId, onComplete, onError]);

  const completedNames = new Set(completedSections.map((s) => s.section));

  // The first section not yet completed is the one currently being generated
  const generatingSection = streaming
    ? SECTION_NAMES.find((name) => !completedNames.has(name)) ?? null
    : null;

  return (
    <div className="mt-6 space-y-6">
      {SECTION_NAMES.map((name) => {
        const completed = completedSections.find((s) => s.section === name);
        const isGenerating = name === generatingSection;
        const isPending = !completed && !isGenerating && streaming;

        return (
          <div key={name}>
            <h2
              className={`text-lg font-semibold tracking-tight ${
                isPending ? "text-text-tertiary" : "text-text-primary"
              }`}
            >
              {name}
            </h2>

            {completed && (
              <div className="mt-2 text-sm text-text-secondary">
                <StreamedMarkdown text={completed.text} />
              </div>
            )}

            {isGenerating && (
              <div className="mt-2 flex items-center gap-2 text-sm text-text-tertiary">
                <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-text-tertiary" />
                Generating {name}...
              </div>
            )}

            {isPending && <div className="mt-2 h-4" />}

            {streaming && (
              <div className="mt-4 border-b border-border-default" />
            )}
          </div>
        );
      })}
    </div>
  );
}
