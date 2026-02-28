"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { computeContentHash } from "@/lib/utils";
import type { CodeImpactReport } from "@/types";

interface CodeImpactState {
  report: CodeImpactReport | null;
  loading: boolean;
  streaming: boolean;
  error: string | null;
  sourceType: "manual" | "evidence_flow";
  isStale: boolean;
}

export function useCodeImpact(
  workspaceId: string,
  artifactId: string,
  hasCodebase: boolean,
  specContent: string,
  sourceClusterIds?: string[]
) {
  const sourceType: "manual" | "evidence_flow" =
    sourceClusterIds && sourceClusterIds.length > 0 ? "evidence_flow" : "manual";

  const [state, setState] = useState<CodeImpactState>({
    report: null,
    loading: true,
    streaming: false,
    error: null,
    sourceType,
    isStale: false,
  });

  const abortRef = useRef<AbortController | null>(null);
  const fetchedRef = useRef(false);
  const generatedHashRef = useRef<number | null>(null);

  // Fetch stored report on mount
  useEffect(() => {
    if (!artifactId || fetchedRef.current) return;
    fetchedRef.current = true;

    let cancelled = false;

    async function fetchReport() {
      try {
        const res = await fetch(`/api/ai/code-impact/${artifactId}`);
        if (!res.ok) throw new Error("Failed to fetch report");

        const data = await res.json();

        if (cancelled) return;

        if (data.report) {
          generatedHashRef.current = computeContentHash(specContent);
          setState((prev) => ({
            ...prev,
            report: data.report,
            loading: false,
            sourceType: data.sourceType || prev.sourceType,
            isStale: data.isStale ?? false,
          }));
        } else {
          setState((prev) => ({ ...prev, loading: false }));
        }
      } catch {
        if (!cancelled) {
          setState((prev) => ({ ...prev, loading: false }));
        }
      }
    }

    fetchReport();

    return () => {
      cancelled = true;
    };
  }, [artifactId]); // eslint-disable-line react-hooks/exhaustive-deps — specContent read from closure at mount; staleness useEffect handles changes

  // Update staleness when spec content changes
  useEffect(() => {
    if (!state.report || !specContent || generatedHashRef.current === null) return;
    const currentHash = computeContentHash(specContent);
    const stale = currentHash !== generatedHashRef.current;
    if (stale !== state.isStale) {
      setState((prev) => ({ ...prev, isStale: stale }));
    }
  }, [specContent, state.report, state.isStale]);

  const generate = useCallback(
    async (isRegenerate = false) => {
      if (!artifactId || !specContent || !hasCodebase) return;

      // Abort previous stream
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setState((prev) => ({
        ...prev,
        streaming: true,
        error: null,
        isStale: false,
        ...(isRegenerate ? {} : { report: null }),
      }));

      try {
        const res = await fetch("/api/ai/code-impact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            artifactId,
            specContent,
            sourceClusterIds,
          }),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error("Code impact request failed");

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let fullText = "";

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
                if (parsed.text) {
                  fullText += parsed.text;

                  // Try progressive JSON parsing for partial updates
                  try {
                    let jsonStr = fullText.trim();
                    if (jsonStr.startsWith("```")) {
                      jsonStr = jsonStr
                        .replace(/^```(?:json)?\n?/, "")
                        .replace(/\n?```$/, "");
                    }
                    const partial = JSON.parse(jsonStr);
                    setState((prev) => ({
                      ...prev,
                      report: partial,
                    }));
                  } catch {
                    // JSON not yet complete — continue accumulating
                  }
                }
                if (parsed.done) {
                  // Server confirmed persistence
                }
                if (parsed.error) {
                  throw new Error(parsed.error);
                }
              } catch (e) {
                if (e instanceof SyntaxError) continue;
                throw e;
              }
            }
          }
        }

        // Final parse
        try {
          let jsonStr = fullText.trim();
          if (jsonStr.startsWith("```")) {
            jsonStr = jsonStr
              .replace(/^```(?:json)?\n?/, "")
              .replace(/\n?```$/, "");
          }
          const report: CodeImpactReport = JSON.parse(jsonStr);
          generatedHashRef.current = computeContentHash(specContent);
          setState((prev) => ({
            ...prev,
            report,
            streaming: false,
          }));
        } catch {
          setState((prev) => ({
            ...prev,
            streaming: false,
            error: "Failed to parse report",
          }));
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("[useCodeImpact] Error:", err);
        setState((prev) => ({
          ...prev,
          streaming: false,
          error: "Failed to generate report",
        }));
      }
    },
    [workspaceId, artifactId, specContent, hasCodebase, sourceClusterIds]
  );

  const generateReport = useCallback(() => generate(false), [generate]);
  const regenerateReport = useCallback(() => generate(true), [generate]);

  const abort = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setState((prev) => ({ ...prev, streaming: false }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  return {
    report: state.report,
    loading: state.loading,
    streaming: state.streaming,
    error: state.error,
    sourceType: state.sourceType,
    isStale: state.isStale,
    hasReport: state.report !== null,
    generateReport,
    regenerateReport,
    abort,
  };
}
