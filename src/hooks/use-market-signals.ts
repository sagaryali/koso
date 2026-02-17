"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { MarketSearchResult } from "@/types";

export interface MarketSignalsState {
  results: MarketSearchResult[];
  loading: boolean;
  cached: boolean;
  error: string | null;
}

const EMPTY_STATE: MarketSignalsState = {
  results: [],
  loading: false,
  cached: false,
  error: null,
};

function simpleHash(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return hash;
}

/**
 * Extract a feature topic from section text.
 * Uses the first heading if present, otherwise the first ~80 chars.
 */
function extractTopic(text: string): string {
  const lines = text.split("\n").filter((l) => l.trim());
  for (const line of lines) {
    // Match markdown headings
    const heading = line.match(/^#+\s+(.+)/);
    if (heading) return heading[1].trim();
  }
  // Fallback: first meaningful line, truncated
  const first = lines[0] || "";
  return first.slice(0, 80).trim();
}

export function useMarketSignals(
  workspaceId: string,
  productDomain: string | null
) {
  const [state, setState] = useState<MarketSignalsState>(EMPTY_STATE);

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHashRef = useRef<number>(0);
  const cacheRef = useRef<
    Map<number, { results: MarketSearchResult[]; cached: boolean }>
  >(new Map());

  const executeSearch = useCallback(
    async (sectionText: string) => {
      if (!sectionText.trim() || !workspaceId) return;

      const topic = extractTopic(sectionText);
      if (!topic) return;

      const searchQuery = productDomain
        ? `${productDomain} ${topic}`
        : topic;

      const hash = simpleHash(searchQuery);
      if (hash === lastHashRef.current) return;
      lastHashRef.current = hash;

      // Check in-memory cache
      const cached = cacheRef.current.get(hash);
      if (cached) {
        setState({
          results: cached.results,
          loading: false,
          cached: cached.cached,
          error: null,
        });
        return;
      }

      // Abort any in-flight request
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const res = await fetch("/api/market/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: searchQuery,
            workspaceId,
            maxResults: 5,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Search failed" }));
          throw new Error(err.error || "Market search failed");
        }

        const data = await res.json();
        const entry = {
          results: data.results || [],
          cached: data.cached || false,
        };

        cacheRef.current.set(hash, entry);

        setState({
          results: entry.results,
          loading: false,
          cached: entry.cached,
          error: null,
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : "Search failed",
        }));
      }
    },
    [workspaceId, productDomain]
  );

  const triggerSearch = useCallback(
    (sectionText: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(
        () => executeSearch(sectionText),
        3000
      );
    },
    [executeSearch]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  return { ...state, triggerSearch };
}
