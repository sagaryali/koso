"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export interface EvidenceNudge {
  id: string;
  label: string;
  summary: string;
  evidenceCount: number;
  evidenceIds: string[];
  combinedScore: number;
}

function simpleHash(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return hash;
}

export function useEvidenceNudges(workspaceId: string) {
  const [nudges, setNudges] = useState<EvidenceNudge[]>([]);
  const [loading, setLoading] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHashRef = useRef<number>(0);
  const cacheRef = useRef<Map<number, EvidenceNudge[]>>(new Map());

  const executeSearch = useCallback(
    async (sectionText: string, sectionName: string | null) => {
      if (!sectionText.trim() || !workspaceId) return;

      const hash = simpleHash(sectionText + (sectionName ?? ""));
      if (hash === lastHashRef.current) return;
      lastHashRef.current = hash;

      const cached = cacheRef.current.get(hash);
      if (cached) {
        setNudges(cached);
        return;
      }

      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);

      try {
        const res = await fetch("/api/clusters/nudges", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId, sectionText, sectionName }),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error("Nudges fetch failed");

        const data = await res.json();
        const results = (data.nudges ?? []) as EvidenceNudge[];

        cacheRef.current.set(hash, results);
        setNudges(results);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("[evidence-nudges] Error:", err);
      } finally {
        if (abortRef.current === controller) setLoading(false);
      }
    },
    [workspaceId]
  );

  const triggerNudges = useCallback(
    (sectionText: string, sectionName: string | null) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(
        () => executeSearch(sectionText, sectionName),
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

  return { nudges, loading, triggerNudges };
}
