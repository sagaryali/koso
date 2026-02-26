"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { ContextSearchResult } from "@/types";
import type { SectionConfig } from "@/lib/section-config";
import { getResultAllocations } from "@/lib/section-config";

export interface ContextPanelResults {
  relatedSpecs: ContextSearchResult[];
  customerEvidence: ContextSearchResult[];
  codeContext: ContextSearchResult[];
}

const EMPTY_RESULTS: ContextPanelResults = {
  relatedSpecs: [],
  customerEvidence: [],
  codeContext: [],
};

function simpleHash(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return hash;
}

function deduplicateBySource(
  results: ContextSearchResult[]
): ContextSearchResult[] {
  const seen = new Map<string, ContextSearchResult>();
  for (const r of results) {
    const existing = seen.get(r.sourceId);
    if (!existing || r.similarity > existing.similarity) {
      seen.set(r.sourceId, r);
    }
  }
  return [...seen.values()].sort((a, b) => b.similarity - a.similarity);
}

export function useContextPanel(workspaceId: string, artifactId: string) {
  const [results, setResults] = useState<ContextPanelResults>(EMPTY_RESULTS);
  const [loading, setLoading] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHashRef = useRef<number>(0);
  const cacheRef = useRef<Map<number, ContextPanelResults>>(new Map());

  const executeSearch = useCallback(
    async (text: string, sectionConfig?: SectionConfig) => {
      if (!text.trim() || !workspaceId) return;

      const hash = simpleHash(text);
      if (hash === lastHashRef.current) return;
      lastHashRef.current = hash;

      const cached = cacheRef.current.get(hash);
      if (cached) {
        setResults(cached);
        return;
      }

      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);

      try {
        const body: Record<string, unknown> = {
          query: text,
          workspaceId,
          grouped: true,
        };

        // Pass sourceTypes when section config is available
        if (sectionConfig?.sourceTypes) {
          body.sourceTypes = sectionConfig.sourceTypes;
        }

        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error("Search failed");

        const data = await res.json();
        const ctx = data.results;

        // Get allocations based on section config
        const allocations = sectionConfig
          ? getResultAllocations(sectionConfig.codeWeight)
          : { evidence: 8, code: 8, specs: 3 };

        const newResults: ContextPanelResults = {
          relatedSpecs: deduplicateBySource(
            (ctx.artifacts ?? []).filter(
              (r: ContextSearchResult) => r.sourceId !== artifactId
            )
          ).slice(0, allocations.specs),
          customerEvidence: deduplicateBySource(ctx.evidence ?? []).slice(
            0,
            allocations.evidence
          ),
          codeContext: deduplicateBySource(ctx.codebaseModules ?? []).slice(
            0,
            allocations.code
          ),
        };

        cacheRef.current.set(hash, newResults);
        setResults(newResults);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("[context-panel] Search error:", err);
      } finally {
        if (abortRef.current === controller) setLoading(false);
      }
    },
    [workspaceId, artifactId]
  );

  const triggerSearch = useCallback(
    (text: string, sectionConfig?: SectionConfig) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(
        () => executeSearch(text, sectionConfig),
        1000
      );
    },
    [executeSearch]
  );

  const searchImmediate = useCallback(
    (text: string, sectionConfig?: SectionConfig) => {
      executeSearch(text, sectionConfig);
    },
    [executeSearch]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  return { results, loading, triggerSearch, searchImmediate };
}
