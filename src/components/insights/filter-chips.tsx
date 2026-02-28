"use client";

import { cn } from "@/lib/utils";
import type { CriticalityLevel, ClusterVerdict } from "@/types";

export interface InsightFilters {
  criticality: Set<CriticalityLevel>;
  verdict: Set<ClusterVerdict | "unassessed">;
  coverage: "all" | "has_spec" | "no_spec";
}

export const EMPTY_FILTERS: InsightFilters = {
  criticality: new Set(),
  verdict: new Set(),
  coverage: "all",
};

export function hasActiveFilters(filters: InsightFilters): boolean {
  return (
    filters.criticality.size > 0 ||
    filters.verdict.size > 0 ||
    filters.coverage !== "all"
  );
}

interface FilterChipsProps {
  activeFilters: InsightFilters;
  onFiltersChange: (filters: InsightFilters) => void;
  clusterToSpecs: Record<string, { artifactId: string; title: string }[]>;
  hasCriticalityData: boolean;
}

const CRITICALITY_OPTIONS: { value: CriticalityLevel; label: string }[] = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const VERDICT_OPTIONS: { value: ClusterVerdict | "unassessed"; label: string }[] = [
  { value: "BUILD", label: "Build" },
  { value: "MAYBE", label: "Maybe" },
  { value: "SKIP", label: "Skip" },
  { value: "unassessed", label: "Unassessed" },
];

const COVERAGE_OPTIONS: { value: "has_spec" | "no_spec"; label: string }[] = [
  { value: "has_spec", label: "Has spec" },
  { value: "no_spec", label: "No spec" },
];

function ToggleChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "cursor-pointer px-2 py-0.5 text-xs transition-none",
        active
          ? "bg-bg-inverse text-text-inverse"
          : "border border-border-default text-text-secondary hover:text-text-primary"
      )}
    >
      {label}
    </button>
  );
}

export function FilterChips({
  activeFilters,
  onFiltersChange,
  hasCriticalityData,
}: FilterChipsProps) {
  function toggleCriticality(level: CriticalityLevel) {
    const next = new Set(activeFilters.criticality);
    if (next.has(level)) next.delete(level);
    else next.add(level);
    onFiltersChange({ ...activeFilters, criticality: next });
  }

  function toggleVerdict(v: ClusterVerdict | "unassessed") {
    const next = new Set(activeFilters.verdict);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onFiltersChange({ ...activeFilters, verdict: next });
  }

  function toggleCoverage(v: "has_spec" | "no_spec") {
    onFiltersChange({
      ...activeFilters,
      coverage: activeFilters.coverage === v ? "all" : v,
    });
  }

  function clearAll() {
    onFiltersChange({ ...EMPTY_FILTERS });
  }

  const isActive = hasActiveFilters(activeFilters);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {hasCriticalityData && (
        <>
          <span className="text-[10px] font-medium uppercase tracking-wide text-text-tertiary">Urgency</span>
          {CRITICALITY_OPTIONS.map((opt) => (
            <ToggleChip
              key={opt.value}
              label={opt.label}
              active={activeFilters.criticality.has(opt.value)}
              onClick={() => toggleCriticality(opt.value)}
            />
          ))}
        </>
      )}

      {hasCriticalityData && VERDICT_OPTIONS.length > 0 && (
        <span className="mx-1 h-4 w-px bg-border-default" />
      )}

      <span className="text-[10px] font-medium uppercase tracking-wide text-text-tertiary">Verdict</span>
      {VERDICT_OPTIONS.map((opt) => (
        <ToggleChip
          key={opt.value}
          label={opt.label}
          active={activeFilters.verdict.has(opt.value)}
          onClick={() => toggleVerdict(opt.value)}
        />
      ))}

      <span className="mx-1 h-4 w-px bg-border-default" />

      <span className="text-[10px] font-medium uppercase tracking-wide text-text-tertiary">Coverage</span>
      {COVERAGE_OPTIONS.map((opt) => (
        <ToggleChip
          key={opt.value}
          label={opt.label}
          active={activeFilters.coverage === opt.value}
          onClick={() => toggleCoverage(opt.value)}
        />
      ))}

      {isActive && (
        <button
          onClick={clearAll}
          className="cursor-pointer ml-2 text-xs text-text-tertiary hover:text-text-primary underline"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
