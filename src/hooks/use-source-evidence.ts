"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Evidence } from "@/types";

interface SourceEvidenceState {
  sourceEvidence: Evidence[];
  sourceEvidenceIds: Set<string>;
  loading: boolean;
}

const EMPTY: SourceEvidenceState = {
  sourceEvidence: [],
  sourceEvidenceIds: new Set(),
  loading: false,
};

export function useSourceEvidence(sourceClusterIds: string[] | undefined) {
  const [state, setState] = useState<SourceEvidenceState>(EMPTY);
  const prevIdsRef = useRef<string>("");

  useEffect(() => {
    if (!sourceClusterIds || sourceClusterIds.length === 0) {
      setState(EMPTY);
      prevIdsRef.current = "";
      return;
    }

    const key = sourceClusterIds.sort().join(",");
    if (key === prevIdsRef.current) return;
    prevIdsRef.current = key;

    let cancelled = false;

    async function fetchSourceEvidence() {
      setState((prev) => ({ ...prev, loading: true }));

      const supabase = createClient();

      // 1. Fetch clusters to get evidence_ids
      const { data: clusters } = await supabase
        .from("evidence_clusters")
        .select("evidence_ids")
        .in("id", sourceClusterIds!);

      if (cancelled) return;

      if (!clusters || clusters.length === 0) {
        setState({ sourceEvidence: [], sourceEvidenceIds: new Set(), loading: false });
        return;
      }

      // 2. Collect all unique evidence IDs
      const allEvidenceIds = new Set<string>();
      for (const cluster of clusters) {
        for (const eid of cluster.evidence_ids ?? []) {
          allEvidenceIds.add(eid);
        }
      }

      if (allEvidenceIds.size === 0) {
        setState({ sourceEvidence: [], sourceEvidenceIds: new Set(), loading: false });
        return;
      }

      // 3. Fetch evidence items
      const { data: evidence } = await supabase
        .from("evidence")
        .select("*")
        .in("id", Array.from(allEvidenceIds));

      if (cancelled) return;

      setState({
        sourceEvidence: evidence ?? [],
        sourceEvidenceIds: allEvidenceIds,
        loading: false,
      });
    }

    fetchSourceEvidence();
    return () => { cancelled = true; };
  }, [sourceClusterIds]);

  return state;
}
