"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Check } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { CRITICALITY_BADGE_COLORS } from "./constants";
import type { EvidenceCluster } from "@/types";

interface LinkedSpec {
  artifactId: string;
  title: string;
}

interface BuildQueueProps {
  clusters: EvidenceCluster[];
  clusterToSpecs: Record<string, LinkedSpec[]>;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  onCreateSpec: (cluster: EvidenceCluster) => void;
  onScrollToCluster: (clusterId: string) => void;
}

export function BuildQueue({
  clusters,
  clusterToSpecs,
  expanded: expandedProp,
  onExpandedChange,
  onCreateSpec,
  onScrollToCluster,
}: BuildQueueProps) {
  const router = useRouter();
  const [expandedInternal, setExpandedInternal] = useState(true);

  const expanded = expandedProp ?? expandedInternal;
  function setExpanded(v: boolean) {
    setExpandedInternal(v);
    onExpandedChange?.(v);
  }

  if (clusters.length === 0) return null;

  return (
    <div className="border border-green-200 bg-green-50/30">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full cursor-pointer items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <Icon icon={expanded ? ChevronDown : ChevronRight} size={14} />
          <span className="text-sm font-medium text-text-primary">
            Build Queue
          </span>
          <span className="text-xs text-text-tertiary">
            {clusters.length} theme{clusters.length !== 1 ? "s" : ""}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-green-200">
          {clusters.map((cluster) => {
            const specs = clusterToSpecs[cluster.id] ?? [];
            const displayLabel = cluster.custom_label ?? cluster.label;

            return (
              <div
                key={cluster.id}
                className="flex cursor-pointer items-center justify-between border-b border-green-100 px-4 py-2 last:border-b-0 hover:bg-green-50/50"
                onClick={() => onScrollToCluster(cluster.id)}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="truncate text-sm text-text-primary">
                    {displayLabel}
                  </span>
                  <span className="text-xs text-text-tertiary">
                    {cluster.evidence_count} items
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {cluster.criticality_level && (
                    <span
                      className={cn(
                        "px-1.5 py-0.5 text-[10px] font-medium capitalize",
                        CRITICALITY_BADGE_COLORS[cluster.criticality_level]
                      )}
                    >
                      {cluster.criticality_level}
                    </span>
                  )}
                  {specs.length > 0 ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/editor/${specs[0].artifactId}`);
                      }}
                      className="flex cursor-pointer items-center gap-1 text-xs text-green-700 hover:underline"
                    >
                      <Icon icon={Check} size={12} />
                      Spec
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCreateSpec(cluster);
                      }}
                      className="cursor-pointer text-xs text-text-tertiary hover:text-text-primary"
                    >
                      Create spec
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
