"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  Evidence,
  ArtifactType,
  CodebaseModuleType,
} from "@/types";

export interface SeededSpec {
  id: string;
  title: string;
  type: ArtifactType;
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
  loading: boolean;
}

const EMPTY_SEEDED: SeededContextData = {
  evidence: [],
  specs: [],
  codeModules: [],
  loading: false,
};

export function useSeededContext(
  workspaceId: string,
  currentArtifactId: string,
  isEmpty: boolean,
  codebaseStatus: string | null
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
        .select("id, title, type, updated_at")
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

      setData({
        evidence: (evidenceResult.data as Evidence[]) ?? [],
        specs: (specsResult.data as SeededSpec[]) ?? [],
        codeModules: (codeResult?.data as SeededCodeModule[]) ?? [],
        loading: false,
      });
    } catch (err) {
      console.error("[seeded-context] Fetch error:", err);
      setData((prev) => ({ ...prev, loading: false }));
    }
  }, [workspaceId, currentArtifactId, codebaseStatus]);

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
