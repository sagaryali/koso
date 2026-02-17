"use client";

import { Badge, Skeleton } from "@/components/ui";
import type { FeasibilityAssessment } from "@/types";

interface FeasibilityPanelProps {
  assessment: FeasibilityAssessment | null;
  loading: boolean;
  error: string | null;
  hasCodebase: boolean;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-medium uppercase tracking-[0.05em] text-text-tertiary">
      {children}
    </div>
  );
}

function ComplexityBadge({ level }: { level: "Low" | "Medium" | "High" }) {
  return (
    <Badge variant={level === "High" ? "inverse" : "default"}>
      {level}
    </Badge>
  );
}

export function FeasibilityPanel({
  assessment,
  loading,
  error,
  hasCodebase,
}: FeasibilityPanelProps) {
  if (!hasCodebase) return null;

  return (
    <div className="space-y-5">
      <div className="text-[11px] font-medium uppercase tracking-[0.05em] text-text-tertiary">
        Feasibility
      </div>
      <div className="border-t border-border-subtle" />

      {loading ? (
        <div className="space-y-4">
          <div>
            <SectionLabel>Affected Modules</SectionLabel>
            <div className="mt-2">
              <Skeleton variant="list" lines={2} />
            </div>
          </div>
          <div>
            <SectionLabel>Complexity</SectionLabel>
            <div className="mt-2">
              <Skeleton variant="text" width="40%" />
            </div>
          </div>
          <div>
            <SectionLabel>Building Blocks</SectionLabel>
            <div className="mt-2">
              <Skeleton variant="list" lines={2} />
            </div>
          </div>
          <div>
            <SectionLabel>Risks</SectionLabel>
            <div className="mt-2">
              <Skeleton variant="list" lines={2} />
            </div>
          </div>
        </div>
      ) : error ? (
        <p className="text-xs text-state-error">{error}</p>
      ) : assessment ? (
        <div className="space-y-4">
          {/* Affected Modules */}
          {assessment.affectedModules.length > 0 && (
            <div>
              <SectionLabel>Affected Modules</SectionLabel>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {assessment.affectedModules.map((mod) => (
                  <div
                    key={mod}
                    className="border border-border-default bg-bg-secondary px-2 py-1 font-mono text-[11px] text-text-primary"
                  >
                    {mod}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Complexity */}
          <div>
            <SectionLabel>Complexity</SectionLabel>
            <div className="mt-2 flex items-center gap-2">
              <ComplexityBadge level={assessment.complexity.level} />
              {assessment.complexity.reason && (
                <span className="text-xs text-text-secondary">
                  {assessment.complexity.reason}
                </span>
              )}
            </div>
          </div>

          {/* Building Blocks */}
          {assessment.buildingBlocks.length > 0 && (
            <div>
              <SectionLabel>Building Blocks</SectionLabel>
              <ul className="mt-2 space-y-1">
                {assessment.buildingBlocks.map((block, i) => (
                  <li key={i} className="text-xs text-text-secondary">
                    {block}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Risks */}
          {assessment.risks.length > 0 && (
            <div>
              <SectionLabel>Risks</SectionLabel>
              <ul className="mt-2 space-y-1">
                {assessment.risks.map((risk, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-1.5 text-xs text-text-secondary"
                  >
                    <span className="mt-1 inline-block h-1 w-1 shrink-0 bg-text-tertiary" />
                    {risk}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-text-tertiary">
          Start writing to see a feasibility assessment
        </p>
      )}
    </div>
  );
}
