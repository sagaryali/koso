"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export interface SectionBriefing {
  suggestedTopics: string[];
  summary: string;
  inconsistencies: string[];
}

const EMPTY_BRIEFING: SectionBriefing = {
  suggestedTopics: [],
  summary: "",
  inconsistencies: [],
};

export function useSectionBriefing(
  workspaceId: string,
  sectionName: string | null,
  sectionGuidance: string | null,
  priorSectionsText: { heading: string; text: string }[],
  productDescription: string | null
) {
  const [briefing, setBriefing] = useState<SectionBriefing>(EMPTY_BRIEFING);
  const [loading, setLoading] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cacheRef = useRef<Map<string, SectionBriefing>>(new Map());
  const lastSectionRef = useRef<string | null>(null);

  const fetchBriefing = useCallback(async () => {
    if (!sectionName || !workspaceId) {
      setBriefing(EMPTY_BRIEFING);
      return;
    }

    // Don't refetch for the same section
    if (sectionName === lastSectionRef.current) return;
    lastSectionRef.current = sectionName;

    // Check cache
    const cached = cacheRef.current.get(sectionName);
    if (cached) {
      setBriefing(cached);
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);

    try {
      const res = await fetch("/api/ai/section-briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionName,
          priorSections: priorSectionsText,
          sectionGuidance,
          productDescription,
        }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error("Briefing fetch failed");

      const data: SectionBriefing = await res.json();
      cacheRef.current.set(sectionName, data);
      setBriefing(data);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("[section-briefing] Error:", err);
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
  }, [sectionName, workspaceId, priorSectionsText, sectionGuidance, productDescription]);

  // Debounce briefing fetch on section change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchBriefing, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchBriefing]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return { briefing, loading };
}
