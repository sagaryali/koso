"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  Evidence,
  ArtifactType,
  ArtifactStatus,
  CodebaseModuleType,
  MarketSearchResult,
} from "@/types";

export interface SeededSpec {
  id: string;
  title: string;
  type: ArtifactType;
  status: ArtifactStatus;
  updated_at: string;
}

export interface SeededCodeModule {
  id: string;
  file_path: string;
  module_type: CodebaseModuleType | null;
  summary: string | null;
}

export interface SeededContextData {
  evidence: Evidence[];
  specs: SeededSpec[];
  codeModules: SeededCodeModule[];
  marketSignals: MarketSearchResult[];
  loading: boolean;
}

const EMPTY_SEEDED: SeededContextData = {
  evidence: [],
  specs: [],
  codeModules: [],
  marketSignals: [],
  loading: false,
};

export function useSeededContext(
  workspaceId: string,
  currentArtifactId: string,
  isEmpty: boolean,
  codebaseStatus: string | null,
  productDescription: string | null
): SeededContextData {
  const [data, setData] = useState<SeededContextData>(EMPTY_SEEDED);
  const fetchedRef = useRef(false);
  const prevCodebaseStatusRef = useRef(codebaseStatus);

  const fetchSeededData = useCallback(async () => {
    if (!workspaceId) return;

    const supabase = createClient();
    setData((prev) => ({ ...prev, loading: true }));

    try {
      const includeCode = codebaseStatus === "ready";

      // Parallel fetches
      const evidenceQuery = supabase
        .from("evidence")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(5);

      const specsQuery = supabase
        .from("artifacts")
        .select("id, title, type, status, updated_at")
        .eq("workspace_id", workspaceId)
        .neq("id", currentArtifactId)
        .neq("type", "architecture_summary")
        .order("updated_at", { ascending: false })
        .limit(3);

      const codeQuery = includeCode
        ? supabase
            .from("codebase_modules")
            .select("id, file_path, module_type, summary")
            .eq("workspace_id", workspaceId)
            .order("updated_at", { ascending: false })
            .limit(5)
        : null;

      const [evidenceResult, specsResult, codeResult] = await Promise.all([
        evidenceQuery,
        specsQuery,
        codeQuery,
      ]);

      // 4. Market signals (if product_description exists)
      let marketSignals: MarketSearchResult[] = [];
      if (productDescription) {
        try {
          let marketQuery = productDescription;

          // If codebase is ready, enrich query with architecture summary
          if (includeCode) {
            const { data: archArtifacts } = await supabase
              .from("artifacts")
              .select("title")
              .eq("workspace_id", workspaceId)
              .eq("type", "architecture_summary")
              .limit(1);

            if (archArtifacts && archArtifacts.length > 0) {
              marketQuery = `${productDescription} ${archArtifacts[0].title}`;
            }
          }

          const marketRes = await fetch("/api/market/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: marketQuery,
              workspaceId,
              maxResults: 5,
            }),
          });

          if (marketRes.ok) {
            const marketData = await marketRes.json();
            marketSignals = marketData.results || [];
          }
        } catch {
          // Market search failure is non-fatal
        }
      }

      setData({
        evidence: (evidenceResult.data as Evidence[]) ?? [],
        specs: (specsResult.data as SeededSpec[]) ?? [],
        codeModules: (codeResult?.data as SeededCodeModule[]) ?? [],
        marketSignals,
        loading: false,
      });
    } catch (err) {
      console.error("[seeded-context] Fetch error:", err);
      setData((prev) => ({ ...prev, loading: false }));
    }
  }, [workspaceId, currentArtifactId, codebaseStatus, productDescription]);

  // Initial fetch when isEmpty and data not yet loaded
  useEffect(() => {
    if (isEmpty && !fetchedRef.current && workspaceId) {
      fetchedRef.current = true;
      fetchSeededData();
    }
  }, [isEmpty, workspaceId, fetchSeededData]);

  // Re-fetch when codebase transitions to "ready" while isEmpty
  useEffect(() => {
    if (
      prevCodebaseStatusRef.current !== "ready" &&
      codebaseStatus === "ready" &&
      isEmpty
    ) {
      fetchSeededData();
    }
    prevCodebaseStatusRef.current = codebaseStatus;
  }, [codebaseStatus, isEmpty, fetchSeededData]);

  return data;
}
