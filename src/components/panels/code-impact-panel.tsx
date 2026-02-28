"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import { Badge, Button, Skeleton, Icon } from "@/components/ui";
import { cn } from "@/lib/utils";
import type {
  CodeImpactReport,
  CodeImpactModule,
  CodeImpactPhase,
  CodeImpactThemeMapping,
  EffortSize,
} from "@/types";

// --- Shared styling helpers (match context-panel patterns) ---

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-medium uppercase tracking-[0.05em] text-text-tertiary">
      {children}
    </div>
  );
}

function SectionDivider() {
  return <div className="mt-2 border-t border-border-subtle" />;
}

// --- Effort badge ---

const EFFORT_COLORS: Record<EffortSize, string> = {
  S: "bg-green-100 text-green-800",
  M: "bg-yellow-100 text-yellow-800",
  L: "bg-orange-100 text-orange-800",
  XL: "bg-red-100 text-red-800",
};

const EFFORT_LABELS: Record<EffortSize, string> = {
  S: "S — hours",
  M: "M — days",
  L: "L — 1-2 weeks",
  XL: "XL — 2+ weeks",
};

function EffortBadge({ size, short }: { size: EffortSize; short?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-medium",
        EFFORT_COLORS[size] || "bg-bg-tertiary text-text-primary"
      )}
    >
      {short ? size : EFFORT_LABELS[size] || size}
    </span>
  );
}

// --- Severity badge ---

function SeverityBadge({ severity }: { severity: string }) {
  const isHigh = severity === "high" || severity === "critical";
  return (
    <Badge variant={isHigh ? "inverse" : "default"}>
      {severity}
    </Badge>
  );
}

// --- Collapsible section ---

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full cursor-pointer items-center gap-1.5 text-left"
      >
        <Icon
          icon={open ? ChevronDown : ChevronRight}
          size={14}
          className="shrink-0 text-text-tertiary"
        />
        <SectionLabel>{title}</SectionLabel>
      </button>
      {open && (
        <>
          <SectionDivider />
          <div className="mt-3">{children}</div>
        </>
      )}
    </section>
  );
}

// --- Section renderers ---

function AffectedModulesSection({
  modules,
  newModules,
}: {
  modules: CodeImpactModule[];
  newModules: CodeImpactModule[];
}) {
  const allModules = [...modules, ...newModules];
  const grouped: Record<string, CodeImpactModule[]> = {};
  for (const mod of allModules) {
    const key = mod.changeType;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(mod);
  }

  const typeLabels: Record<string, string> = {
    modify: "Modify",
    create: "Create",
    schema: "Schema",
    config: "Config",
  };

  return (
    <div className="space-y-3">
      {Object.entries(grouped).map(([changeType, mods]) => (
        <div key={changeType}>
          <div className="text-[11px] font-medium text-text-tertiary">
            {typeLabels[changeType] || changeType}
          </div>
          <div className="mt-1.5 space-y-1">
            {mods.map((mod) => (
              <div
                key={mod.filePath}
                className="flex items-center justify-between gap-2"
              >
                <span className="min-w-0 truncate font-mono text-[11px] text-text-primary">
                  {mod.filePath}
                </span>
                <EffortBadge size={mod.effort} short />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EffortEstimateSection({
  report,
}: {
  report: CodeImpactReport;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-text-primary">Overall:</span>
        <EffortBadge size={report.overallEffort} />
      </div>
      {report.effortReasoning && (
        <p className="text-xs text-text-secondary">{report.effortReasoning}</p>
      )}
      {report.effortBreakdown.length > 0 && (
        <div className="space-y-1.5">
          {report.effortBreakdown.map((item) => (
            <div key={item.area} className="flex items-start gap-2">
              <EffortBadge size={item.effort} short />
              <div className="min-w-0">
                <span className="text-xs font-medium text-text-primary">
                  {item.area}
                </span>
                <p className="text-[11px] text-text-tertiary">{item.reason}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReusableCodeSection({ report }: { report: CodeImpactReport }) {
  return (
    <div className="space-y-3">
      {report.reusableCode.length > 0 && (
        <div>
          <div className="text-[11px] font-medium text-text-tertiary">
            Can Reuse
          </div>
          <div className="mt-1.5 space-y-1.5">
            {report.reusableCode.map((item) => (
              <div key={item.filePath}>
                <span className="font-mono text-[11px] text-text-primary">
                  {item.filePath}
                </span>
                <p className="text-[11px] text-text-tertiary">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
      {report.netNewAreas.length > 0 && (
        <div>
          <div className="text-[11px] font-medium text-text-tertiary">
            Net-New Areas
          </div>
          <ul className="mt-1.5 space-y-1">
            {report.netNewAreas.map((area) => (
              <li
                key={area}
                className="flex items-start gap-1.5 text-xs text-text-secondary"
              >
                <span className="mt-1 inline-block h-1 w-1 shrink-0 bg-text-tertiary" />
                {area}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SchemaApiSection({ report }: { report: CodeImpactReport }) {
  return (
    <div className="space-y-3">
      {report.schemaChanges.length > 0 && (
        <div>
          <div className="text-[11px] font-medium text-text-tertiary">
            Schema Changes
          </div>
          <div className="mt-1.5 space-y-1.5">
            {report.schemaChanges.map((change, i) => (
              <div key={i} className="flex items-start gap-2">
                <Badge>{change.type}</Badge>
                <span className="text-xs text-text-secondary">
                  {change.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {report.apiChanges.length > 0 && (
        <div>
          <div className="text-[11px] font-medium text-text-tertiary">
            API Changes
          </div>
          <div className="mt-1.5 space-y-1.5">
            {report.apiChanges.map((change, i) => (
              <div key={i} className="flex items-start gap-2">
                <Badge>{change.type}</Badge>
                <span className="text-xs text-text-secondary">
                  {change.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RisksSection({
  risks,
}: {
  risks: CodeImpactReport["risks"];
}) {
  return (
    <div className="space-y-2">
      {risks.map((risk, i) => (
        <div key={i} className="space-y-1">
          <div className="flex items-center gap-2">
            <SeverityBadge severity={risk.severity} />
            <span className="text-xs text-text-primary">{risk.description}</span>
          </div>
          {risk.mitigation && (
            <p className="pl-[calc(theme(spacing.2)+theme(spacing.1))] text-[11px] text-text-tertiary">
              Mitigation: {risk.mitigation}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function BuildOrderSection({ phases }: { phases: CodeImpactPhase[] }) {
  return (
    <div className="space-y-3">
      {phases.map((phase, i) => (
        <div key={phase.name} className="relative pl-5">
          {/* Vertical connector line */}
          {i < phases.length - 1 && (
            <div className="absolute top-4 left-[7px] h-[calc(100%+0.75rem)] w-px bg-border-default" />
          )}
          {/* Dot */}
          <div className="absolute top-1 left-0 h-[14px] w-[14px] border border-border-strong bg-bg-primary" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-primary">
              {phase.name}
            </span>
            <EffortBadge size={phase.effort} short />
          </div>
          <p className="mt-0.5 text-[11px] text-text-secondary">
            {phase.description}
          </p>
          {phase.modules.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {phase.modules.map((mod) => (
                <span
                  key={mod}
                  className="font-mono text-[10px] text-text-tertiary"
                >
                  {mod}
                </span>
              ))}
            </div>
          )}
          {phase.dependencies.length > 0 && (
            <div className="mt-1 text-[10px] text-text-tertiary">
              Depends on: {phase.dependencies.join(", ")}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ThemeMappingsSection({
  mappings,
}: {
  mappings: CodeImpactThemeMapping[];
}) {
  return (
    <div className="space-y-3">
      {mappings.map((theme) => (
        <div
          key={theme.clusterLabel}
          className="border border-border-default p-3"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-primary">
              {theme.clusterLabel}
            </span>
            <EffortBadge size={theme.effort} short />
            <Badge>{theme.criticalityLevel}</Badge>
          </div>
          <p className="mt-1 text-[11px] text-text-secondary">
            {theme.clusterSummary}
          </p>
          <div className="mt-2 flex items-center gap-3 text-[10px] text-text-tertiary">
            <span>{theme.evidenceCount} evidence items</span>
            <span>{theme.affectedModules.length} modules</span>
          </div>
          {theme.affectedModules.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {theme.affectedModules.map((mod) => (
                <span
                  key={mod}
                  className="font-mono text-[10px] text-text-tertiary"
                >
                  {mod}
                </span>
              ))}
            </div>
          )}
          {theme.dropImpact && (
            <div className="mt-2 border-l-2 border-border-strong pl-2 text-[11px] text-text-secondary italic">
              If dropped: {theme.dropImpact}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// --- Skeleton placeholder ---

function SectionSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton variant="text" width="40%" />
      <Skeleton variant="text" width="100%" />
      <Skeleton variant="text" width="80%" />
    </div>
  );
}

// --- Main panel component ---

interface CodeImpactPanelProps {
  report: CodeImpactReport | null;
  loading: boolean;
  streaming: boolean;
  error: string | null;
  sourceType: "manual" | "evidence_flow";
  isStale: boolean;
  hasReport: boolean;
  onGenerate: () => void;
  onRegenerate: () => void;
  onCancel: () => void;
  onClose: () => void;
  clusterCount?: number;
  evidenceCount?: number;
}

export function CodeImpactPanel({
  report,
  loading,
  streaming,
  error,
  sourceType,
  isStale,
  hasReport,
  onGenerate,
  onRegenerate,
  onCancel,
  onClose,
  clusterCount,
  evidenceCount,
}: CodeImpactPanelProps) {
  const autoGeneratedRef = useRef(false);

  // Auto-generate when panel opens with no report
  useEffect(() => {
    if (!hasReport && !loading && !streaming && !error && !autoGeneratedRef.current) {
      autoGeneratedRef.current = true;
      onGenerate();
    }
  }, [hasReport, loading, streaming, error, onGenerate]);

  const showGenerate = !hasReport && !loading && !streaming;
  const showRegenerate = hasReport && isStale && !streaming;

  const subtitle =
    sourceType === "evidence_flow" && clusterCount
      ? `Based on ${evidenceCount ?? "?"} evidence items across ${clusterCount} themes`
      : "Based on full spec analysis";

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight text-text-primary">
            Code Impact Report
          </h2>
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center text-text-tertiary hover:text-text-primary"
          >
            <Icon icon={X} size={14} />
          </button>
        </div>
        <p className="mt-1 text-xs text-text-tertiary">{subtitle}</p>

        {/* Action buttons */}
        <div className="mt-3 flex items-center gap-2">
          {showGenerate && (
            <Button variant="primary" size="sm" onClick={onGenerate}>
              Generate
            </Button>
          )}
          {showRegenerate && (
            <Button variant="secondary" size="sm" onClick={onRegenerate}>
              Regenerate
            </Button>
          )}
          {streaming && (
            <div className="flex items-center gap-2 text-xs text-text-tertiary">
              <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-text-tertiary" />
              Generating report...
              <Button variant="ghost" size="sm" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="space-y-3">
          <p className="text-sm text-state-error">{error}</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={onGenerate}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="space-y-4">
          <SectionSkeleton />
          <SectionSkeleton />
          <SectionSkeleton />
        </div>
      )}

      {/* Report sections */}
      {report && (
        <div className="space-y-4">
          {/* 1. Affected Modules */}
          {(report.affectedModules?.length > 0 ||
            report.newModules?.length > 0) ? (
            <CollapsibleSection title="Affected Modules" defaultOpen>
              <AffectedModulesSection
                modules={report.affectedModules}
                newModules={report.newModules}
              />
            </CollapsibleSection>
          ) : streaming ? (
            <SectionSkeleton />
          ) : null}

          {/* 2. Effort Estimate */}
          {report.overallEffort ? (
            <CollapsibleSection title="Effort Estimate" defaultOpen>
              <EffortEstimateSection report={report} />
            </CollapsibleSection>
          ) : streaming ? (
            <SectionSkeleton />
          ) : null}

          {/* 3. What We Can Reuse */}
          {(report.reusableCode?.length > 0 ||
            report.netNewAreas?.length > 0) ? (
            <CollapsibleSection title="What We Can Reuse">
              <ReusableCodeSection report={report} />
            </CollapsibleSection>
          ) : streaming ? (
            <SectionSkeleton />
          ) : null}

          {/* 4. Schema & API Changes */}
          {(report.schemaChanges?.length > 0 ||
            report.apiChanges?.length > 0) ? (
            <CollapsibleSection title="Schema & API Changes">
              <SchemaApiSection report={report} />
            </CollapsibleSection>
          ) : streaming ? (
            <SectionSkeleton />
          ) : null}

          {/* 5. Risks */}
          {report.risks?.length > 0 ? (
            <CollapsibleSection title="Risks">
              <RisksSection risks={report.risks} />
            </CollapsibleSection>
          ) : streaming ? (
            <SectionSkeleton />
          ) : null}

          {/* 6. Build Order */}
          {report.phases?.length > 0 ? (
            <CollapsibleSection title="Build Order">
              <BuildOrderSection phases={report.phases} />
            </CollapsibleSection>
          ) : streaming ? (
            <SectionSkeleton />
          ) : null}

          {/* 7. Theme Trade-offs (evidence_flow only) */}
          {sourceType === "evidence_flow" &&
            report.themeMappings &&
            report.themeMappings.length > 0 && (
              <CollapsibleSection title="Theme Trade-offs">
                <ThemeMappingsSection mappings={report.themeMappings} />
              </CollapsibleSection>
            )}
        </div>
      )}

      {/* Empty state — no report, not loading, not streaming, no error */}
      {!report && !loading && !streaming && !error && (
        <div className="py-8 text-center text-sm text-text-tertiary">
          Generate a report to see how this spec impacts the codebase.
        </div>
      )}
    </div>
  );
}
