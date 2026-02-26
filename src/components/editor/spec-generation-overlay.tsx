"use client";

import { useState, useEffect, useRef } from "react";
import { StreamedMarkdown } from "@/components/ui/streamed-markdown";
import {
  startGeneration,
  subscribe,
  unsubscribe,
  getProgress,
  isGenerating,
} from "@/lib/spec-generation-manager";

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
  const [streamingSection, setStreamingSection] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState("");

  // Use refs to avoid stale closures in the subscriber callback
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  onCompleteRef.current = onComplete;
  onErrorRef.current = onError;

  useEffect(() => {
    const contextKey = `koso_draft_spec_context_${artifactId}`;
    const progressKey = `koso_draft_spec_progress_${artifactId}`;

    // Check if generation is already running (user navigated away and back)
    if (isGenerating(artifactId)) {
      const progress = getProgress(artifactId);
      if (progress) {
        setCompletedSections(progress.sections);
        setStreamingSection(progress.currentSection);
        setStreamingText(progress.currentText);
      }
    } else {
      // Not running — need to start
      const contextRaw = sessionStorage.getItem(contextKey);
      if (!contextRaw) {
        onErrorRef.current("Generation context not found. You can write your spec manually.");
        return;
      }

      let context: Record<string, unknown>;
      try {
        context = JSON.parse(contextRaw);
      } catch {
        onErrorRef.current("Invalid generation context.");
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
        onCompleteRef.current(cached);
        return;
      }

      startGeneration(artifactId, context, cached);
    }

    // Subscribe for live events
    const handler = (event: {
      type: string;
      section?: string;
      text?: string;
      sections?: { section: string; text: string }[];
      message?: string;
    }) => {
      switch (event.type) {
        case "section_start":
          setStreamingSection(event.section ?? null);
          setStreamingText("");
          break;
        case "delta":
          setStreamingText((prev) => prev + (event.text ?? ""));
          break;
        case "section_complete":
          setCompletedSections((prev) => [
            ...prev,
            { section: event.section!, text: event.text! },
          ]);
          setStreamingSection(null);
          setStreamingText("");
          break;
        case "done":
          setStreaming(false);
          setStreamingSection(null);
          setStreamingText("");
          onCompleteRef.current(event.sections ?? []);
          break;
        case "error":
          setStreaming(false);
          onErrorRef.current(event.message ?? "Spec generation failed.");
          break;
      }
    };

    subscribe(artifactId, handler);

    return () => {
      unsubscribe(artifactId, handler);
      // No abort — generation continues in background
    };
  }, [artifactId]);

  return (
    <div className="mt-6 space-y-6">
      {SECTION_NAMES.map((name) => {
        const completed = completedSections.find((s) => s.section === name);
        const isActive = name === streamingSection;
        const isPending = !completed && !isActive && streaming;

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

            {isActive && (
              <div className="mt-2 text-sm text-text-secondary">
                {streamingText ? (
                  <>
                    <StreamedMarkdown text={streamingText} />
                    <span className="inline-block h-4 w-1 animate-pulse bg-text-primary" />
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-text-tertiary">
                    <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-text-tertiary" />
                    Generating {name}...
                  </div>
                )}
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
