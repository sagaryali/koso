"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Code, Quote } from "lucide-react";
import { Badge, Dialog, Skeleton, Icon } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { ContextSearchResult, Evidence, FeasibilityAssessment } from "@/types";
import type { SeededSpec, SeededCodeModule, SeededContextData } from "@/hooks/use-seeded-context";
import type { SectionConfig } from "@/lib/section-config";
import { useSourceEvidence } from "@/hooks/use-source-evidence";

interface ContextPanelProps {
  relatedSpecs: ContextSearchResult[];
  customerEvidence: ContextSearchResult[];
  codeContext: ContextSearchResult[];
  loading: boolean;
  artifactId: string;
  workspaceId: string;
  hasCodebase: boolean;
  isEmpty: boolean;
  seededContext: SeededContextData;
  codebaseStatus: string | null;
  productName: string | null;
  currentSectionName?: string | null;
  sectionConfig?: SectionConfig | null;
  panelJustOpened?: boolean;
  onInsertCitation?: (text: string, source: string) => void;
  feasibilityAssessment?: FeasibilityAssessment | null;
  feasibilityLoading?: boolean;
  sourceClusterIds?: string[];
}

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

function StaggeredList({ children }: { children: React.ReactNode }) {
  return <div className="space-y-2">{children}</div>;
}

function StaggerItem({ children, index }: { children: React.ReactNode; index: number }) {
  return (
    <div
      className="stagger-item"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {children}
    </div>
  );
}

// --- Related Specs (search-driven) ---

function RelatedSpecCard({
  result,
}: {
  result: ContextSearchResult;
}) {
  const router = useRouter();
  const title = (result.metadata?.title as string) || "Untitled";

  return (
    <div
      className="cursor-pointer border border-border-default p-3 hover:border-border-strong"
      onClick={() => router.push(`/editor/${result.sourceId}`)}
    >
      <span className="line-clamp-1 text-[13px] font-medium text-text-primary">
        {title}
      </span>
      <p className="mt-1 line-clamp-2 text-xs text-text-secondary">
        {result.chunkText}
      </p>
    </div>
  );
}

// --- Customer Evidence (search-driven) ---

function EvidenceCard({
  result,
  onInsertCitation,
}: {
  result: ContextSearchResult;
  onInsertCitation?: (text: string, source: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const source = (result.metadata?.source as string) || "Unknown source";
  const type = (result.metadata?.type as string) || "feedback";
  const tags = (result.metadata?.tags as string[]) || [];
  const title = (result.metadata?.title as string) || "";
  const fullContent =
    (result.metadata?.full_content as string) || result.chunkText;

  return (
    <>
      <div className="cursor-pointer space-y-1.5" onClick={() => setOpen(true)}>
        <span className="text-[11px] font-medium text-text-tertiary">
          {source}
        </span>
        <p
          className={cn(
            "line-clamp-2 text-xs text-text-secondary",
            type === "feedback" && "italic"
          )}
        >
          {result.chunkText}
        </p>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <Badge key={tag}>{tag}</Badge>
            ))}
          </div>
        )}
        {onInsertCitation && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onInsertCitation(result.chunkText, source);
            }}
            className="inline-flex cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-[11px] text-text-tertiary hover:text-text-primary"
          >
            <Icon icon={Quote} size={12} />
            Insert quote
          </button>
        )}
      </div>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <div className="space-y-4">
          {title && <h3 className="text-lg font-medium">{title}</h3>}
          <div className="text-[11px] font-medium text-text-tertiary">
            {source}
          </div>
          <p
            className={cn(
              "text-sm text-text-secondary",
              type === "feedback" && "italic"
            )}
          >
            {fullContent}
          </p>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <Badge key={tag}>{tag}</Badge>
              ))}
            </div>
          )}
        </div>
      </Dialog>
    </>
  );
}

// --- Code Context (search-driven) ---

const CODE_PREVIEW_LINES = 20;

function CodeModuleCard({ result }: { result: ContextSearchResult }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const filePath = (result.metadata?.file_path as string) || "unknown";
  const moduleType = (result.metadata?.module_type as string) || null;
  const summary = (result.metadata?.summary as string) || "";
  const rawContent = (result.metadata?.raw_content as string) || null;

  const fullCode = rawContent || result.chunkText;
  const lines = fullCode.split("\n");
  const isLong = lines.length > CODE_PREVIEW_LINES;
  const displayedCode = expanded ? fullCode : lines.slice(0, CODE_PREVIEW_LINES).join("\n");

  const handleClose = () => {
    setOpen(false);
    setExpanded(false);
  };

  return (
    <>
      <div
        className="cursor-pointer border border-border-default p-3 hover:border-border-strong"
        onClick={() => setOpen(true)}
      >
        <span className="line-clamp-1 font-mono text-xs font-medium text-text-primary">
          {filePath}
        </span>
        {moduleType && (
          <div className="mt-1.5">
            <Badge>{moduleType}</Badge>
          </div>
        )}
        {summary && (
          <p className="mt-1.5 line-clamp-2 text-xs text-text-secondary">
            {summary}
          </p>
        )}
      </div>

      <Dialog
        open={open}
        onClose={handleClose}
        className="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[13px] font-medium text-text-primary">
              {filePath}
            </span>
            {moduleType && <Badge>{moduleType}</Badge>}
          </div>
          {summary && (
            <p className="text-sm text-text-secondary">{summary}</p>
          )}
          <div className="relative max-h-[60vh] overflow-y-auto overflow-x-auto border border-border-default bg-[#FAFAFA] p-4">
            <pre className="font-mono text-[13px] leading-relaxed text-text-primary">
              <code>{displayedCode}</code>
            </pre>
            {isLong && !expanded && (
              <div className="sticky inset-x-0 bottom-0 -mb-4 flex items-end justify-center bg-gradient-to-t from-[#FAFAFA] pt-12 pb-3">
                <button
                  onClick={() => setExpanded(true)}
                  className="cursor-pointer border border-border-default bg-bg-primary px-3 py-1.5 text-[13px] font-medium text-text-primary hover:bg-bg-hover"
                >
                  Show all {lines.length} lines
                </button>
              </div>
            )}
          </div>
        </div>
      </Dialog>
    </>
  );
}

// --- Code Notes Section (lightweight feasibility) ---

function CodeNotesSection({
  assessment,
  loading: feasibilityLoading,
  hasCodebase,
  hasContent,
}: {
  assessment: FeasibilityAssessment | null | undefined;
  loading: boolean;
  hasCodebase: boolean;
  hasContent: boolean;
}) {
  if (!hasCodebase || !hasContent) return null;

  return (
    <section>
      <SectionLabel>Code notes</SectionLabel>
      <SectionDivider />
      <div className="mt-3">
        {feasibilityLoading ? (
          <div className="space-y-3">
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="list" lines={2} />
          </div>
        ) : assessment ? (
          <div className="space-y-3">
            {/* Modules this section touches */}
            {assessment.affectedModules.length > 0 && (
              <div>
                <div className="text-[11px] font-medium text-text-tertiary">Modules touched</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
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

            {/* Reusable patterns */}
            {assessment.buildingBlocks.length > 0 && (
              <div>
                <div className="text-[11px] font-medium text-text-tertiary">Reusable patterns</div>
                <ul className="mt-1.5 space-y-1">
                  {assessment.buildingBlocks.map((block, i) => (
                    <li key={i} className="text-xs text-text-secondary">
                      {block}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-text-tertiary">
            Start writing to see which modules this section touches
          </p>
        )}
      </div>
    </section>
  );
}

// --- Seeded Cards (for empty specs) ---

const SEEDED_TYPE_LABELS: Record<string, string> = {
  prd: "PRD",
  user_story: "User Story",
  principle: "Principle",
  decision_log: "Decision Log",
  roadmap_item: "Roadmap",
};

function SeededSpecCard({ spec }: { spec: SeededSpec }) {
  const router = useRouter();

  return (
    <div
      className="cursor-pointer border border-border-default p-3 hover:border-border-strong"
      onClick={() => router.push(`/editor/${spec.id}`)}
    >
      <span className="line-clamp-1 text-[13px] font-medium text-text-primary">
        {spec.title || "Untitled"}
      </span>
      <div className="mt-1.5 flex items-center gap-1.5">
        <Badge>{SEEDED_TYPE_LABELS[spec.type] || spec.type}</Badge>
      </div>
    </div>
  );
}

function SeededEvidenceCard({ evidence }: { evidence: Evidence }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="cursor-pointer space-y-1.5" onClick={() => setOpen(true)}>
        <span className="text-[11px] font-medium text-text-tertiary">
          {evidence.source || "Unknown source"}
        </span>
        <p
          className={cn(
            "line-clamp-2 text-xs text-text-secondary",
            evidence.type === "feedback" && "italic"
          )}
        >
          {evidence.content}
        </p>
        {evidence.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {evidence.tags.map((tag) => (
              <Badge key={tag}>{tag}</Badge>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <div className="space-y-4">
          {evidence.title && (
            <h3 className="text-lg font-medium">{evidence.title}</h3>
          )}
          <div className="text-[11px] font-medium text-text-tertiary">
            {evidence.source || "Unknown source"}
          </div>
          <p
            className={cn(
              "text-sm text-text-secondary",
              evidence.type === "feedback" && "italic"
            )}
          >
            {evidence.content}
          </p>
          {evidence.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {evidence.tags.map((tag) => (
                <Badge key={tag}>{tag}</Badge>
              ))}
            </div>
          )}
        </div>
      </Dialog>
    </>
  );
}

function SeededCodeCard({ module }: { module: SeededCodeModule }) {
  return (
    <div className="border border-border-default p-3">
      <span className="line-clamp-1 font-mono text-xs font-medium text-text-primary">
        {module.file_path}
      </span>
      {module.module_type && (
        <div className="mt-1.5">
          <Badge>{module.module_type}</Badge>
        </div>
      )}
      {module.summary && (
        <p className="mt-1.5 line-clamp-2 text-xs text-text-secondary">
          {module.summary}
        </p>
      )}
    </div>
  );
}

// --- Main Component ---

export function ContextPanel({
  relatedSpecs,
  customerEvidence,
  codeContext,
  loading,
  artifactId,
  workspaceId,
  hasCodebase,
  isEmpty,
  seededContext,
  codebaseStatus,
  productName,
  currentSectionName,
  sectionConfig,
  panelJustOpened,
  onInsertCitation,
  feasibilityAssessment,
  feasibilityLoading,
  sourceClusterIds,
}: ContextPanelProps) {
  // Review mode: spec was AI-drafted from evidence clusters
  const isReviewMode = (sourceClusterIds?.length ?? 0) > 0;

  // Fetch source evidence for review mode
  const {
    sourceEvidence,
    sourceEvidenceIds,
    loading: sourceEvidenceLoading,
  } = useSourceEvidence(isReviewMode ? sourceClusterIds : undefined);

  // Seeded view for empty specs
  if (isEmpty) {
    const showCodeSection =
      seededContext.codeModules.length > 0 || codebaseStatus === "syncing";

    return (
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="text-[11px] font-medium uppercase tracking-[0.05em] text-text-tertiary">
          Context
        </div>

        {/* Recent Evidence */}
        <section>
          <SectionLabel>Recent evidence</SectionLabel>
          <SectionDivider />
          <div className="mt-3 space-y-3">
            {seededContext.loading ? (
              <Skeleton variant="list" lines={3} />
            ) : seededContext.evidence.length > 0 ? (
              <StaggeredList>
                {seededContext.evidence.map((e, i) => (
                  <StaggerItem key={e.id} index={i}>
                    <SeededEvidenceCard evidence={e} />
                  </StaggerItem>
                ))}
              </StaggeredList>
            ) : (
              <p className="text-xs text-text-tertiary">
                No evidence yet — add feedback from the home page or press &#8984;K → Add evidence.
              </p>
            )}
          </div>
        </section>

        {/* Recent Specs */}
        <section>
          <SectionLabel>Recent specs</SectionLabel>
          <SectionDivider />
          <div className="mt-3 space-y-2">
            {seededContext.loading ? (
              <Skeleton variant="list" lines={2} />
            ) : seededContext.specs.length > 0 ? (
              <StaggeredList>
                {seededContext.specs.map((s, i) => (
                  <StaggerItem key={s.id} index={i}>
                    <SeededSpecCard spec={s} />
                  </StaggerItem>
                ))}
              </StaggeredList>
            ) : (
              <p className="text-xs text-text-tertiary">
                No other specs yet
              </p>
            )}
          </div>
        </section>

        {/* Recently Changed Code */}
        {showCodeSection && (
          <section>
            <SectionLabel>Recently changed code</SectionLabel>
            <SectionDivider />
            <div className="mt-3 space-y-2">
              {codebaseStatus === "syncing" && seededContext.codeModules.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-text-tertiary">
                  <div className="h-[2px] w-4 animate-pulse bg-text-primary" />
                  <span>Indexing codebase...</span>
                </div>
              ) : (
                <StaggeredList>
                  {seededContext.codeModules.map((m, i) => (
                    <StaggerItem key={m.id} index={i}>
                      <SeededCodeCard module={m} />
                    </StaggerItem>
                  ))}
                </StaggeredList>
              )}
            </div>
          </section>
        )}
      </div>
    );
  }

  // Determine section ordering based on codeWeight
  const codeWeight = sectionConfig?.codeWeight ?? 0.4;
  const isCodeFirst = codeWeight > 0.6;
  const isEvidenceFirst = codeWeight < 0.3;

  // Section header reflects mode and context strategy
  const headerLabel = currentSectionName
    ? isReviewMode
      ? `Review: ${currentSectionName}`
      : isEvidenceFirst
        ? `Evidence for: ${currentSectionName}`
        : isCodeFirst
          ? `Code context for: ${currentSectionName}`
          : `Context for: ${currentSectionName}`
    : isReviewMode
      ? "Review"
      : "Context";

  // Section guidance adapts to mode
  const guidanceText = isReviewMode
    ? "Verify the evidence behind this section"
    : sectionConfig?.guidance ?? null;

  // Search-driven view (existing behavior)
  const hasCodeResults = codeContext.length > 0;

  // --- Review mode: evidence gaps = search results minus source evidence ---
  const evidenceGaps = isReviewMode
    ? customerEvidence.filter((r) => !sourceEvidenceIds.has(r.sourceId))
    : [];

  // --- Writing mode sections ---

  const evidenceSection = (
    <section key="evidence">
      <SectionLabel>Customer Evidence</SectionLabel>
      <SectionDivider />
      <div className="mt-3 space-y-3">
        {loading ? (
          <Skeleton variant="list" lines={3} />
        ) : customerEvidence.length > 0 ? (
          <StaggeredList>
            {customerEvidence.map((r, i) => (
              <StaggerItem key={r.id} index={i}>
                <EvidenceCard result={r} onInsertCitation={onInsertCitation} />
              </StaggerItem>
            ))}
          </StaggeredList>
        ) : (
          <p className="text-sm text-text-tertiary">
            Add customer feedback, metrics, or research notes to build your product knowledge base
          </p>
        )}
      </div>
    </section>
  );

  const codeSection = (
    <section key="code">
      <SectionLabel>Code Context</SectionLabel>
      <SectionDivider />
      <div className="mt-3 space-y-2">
        {loading ? (
          <Skeleton variant="list" lines={2} />
        ) : hasCodeResults ? (
          <StaggeredList>
            {codeContext.map((r, i) => (
              <StaggerItem key={r.id} index={i}>
                <CodeModuleCard result={r} />
              </StaggerItem>
            ))}
          </StaggeredList>
        ) : !hasCodebase ? (
          <div className="flex items-start gap-2 text-xs text-text-tertiary">
            <Icon icon={Code} size={14} className="mt-0.5 shrink-0" />
            <span>
              Connect a GitHub repo in{" "}
              <a
                href="/settings"
                className="text-text-primary underline underline-offset-2"
              >
                Settings
              </a>{" "}
              to see relevant code here
            </span>
          </div>
        ) : (
          <p className="text-sm text-text-tertiary">
            Start writing and related context will appear here
          </p>
        )}
      </div>
    </section>
  );

  const specsSection = (
    <section key="specs">
      <SectionLabel>Related Specs</SectionLabel>
      <SectionDivider />
      <div className="mt-3 space-y-2">
        {loading ? (
          <Skeleton variant="list" lines={3} />
        ) : relatedSpecs.length > 0 ? (
          <StaggeredList>
            {relatedSpecs.map((r, i) => (
              <StaggerItem key={r.id} index={i}>
                <RelatedSpecCard result={r} />
              </StaggerItem>
            ))}
          </StaggeredList>
        ) : (
          <p className="text-sm text-text-tertiary">
            Start writing and related specs will appear here
          </p>
        )}
      </div>
    </section>
  );

  // --- Review mode sections ---

  const sourceEvidenceSection = (
    <section key="source-evidence">
      <SectionLabel>Source evidence</SectionLabel>
      <SectionDivider />
      <div className="mt-3 space-y-3">
        {sourceEvidenceLoading ? (
          <Skeleton variant="list" lines={3} />
        ) : sourceEvidence.length > 0 ? (
          <StaggeredList>
            {sourceEvidence.map((e, i) => (
              <StaggerItem key={e.id} index={i}>
                <SeededEvidenceCard evidence={e} />
              </StaggerItem>
            ))}
          </StaggeredList>
        ) : (
          <p className="text-xs text-text-tertiary">
            No source evidence found for this spec
          </p>
        )}
      </div>
    </section>
  );

  const evidenceGapsSection = (
    <section key="evidence-gaps">
      <SectionLabel>Evidence gaps</SectionLabel>
      <SectionDivider />
      <div className="mt-3 space-y-3">
        {loading ? (
          <Skeleton variant="list" lines={2} />
        ) : evidenceGaps.length > 0 ? (
          <StaggeredList>
            {evidenceGaps.map((r, i) => (
              <StaggerItem key={r.id} index={i}>
                <EvidenceCard result={r} onInsertCitation={onInsertCitation} />
              </StaggerItem>
            ))}
          </StaggeredList>
        ) : (
          <p className="text-xs text-text-tertiary">
            No additional evidence found beyond what was used
          </p>
        )}
      </div>
    </section>
  );

  const potentialConflictsSection = (
    <section key="conflicts">
      <SectionLabel>Potential conflicts</SectionLabel>
      <SectionDivider />
      <div className="mt-3 space-y-2">
        {loading ? (
          <Skeleton variant="list" lines={2} />
        ) : relatedSpecs.length > 0 ? (
          <StaggeredList>
            {relatedSpecs.map((r, i) => (
              <StaggerItem key={r.id} index={i}>
                <RelatedSpecCard result={r} />
              </StaggerItem>
            ))}
          </StaggeredList>
        ) : (
          <p className="text-xs text-text-tertiary">
            No conflicting specs detected
          </p>
        )}
      </div>
    </section>
  );

  // --- Section ordering ---

  const contentSections = isReviewMode
    ? [sourceEvidenceSection, evidenceGapsSection, potentialConflictsSection]
    : isCodeFirst
      ? [codeSection, evidenceSection, specsSection]
      : isEvidenceFirst
        ? [evidenceSection, specsSection, codeSection]
        : [specsSection, evidenceSection, codeSection];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "text-[11px] font-medium uppercase tracking-[0.05em] transition-colors duration-300",
            panelJustOpened ? "text-text-primary" : "text-text-tertiary"
          )}
        >
          {headerLabel}
        </div>
        {hasCodeResults && (
          <Icon icon={Code} size={12} className="text-text-tertiary" />
        )}
      </div>

      {/* Section guidance hint */}
      {guidanceText && (
        <div className="text-xs text-text-tertiary italic">
          {guidanceText}
        </div>
      )}

      {/* Ordered content sections */}
      {contentSections}

      {/* Code notes (both modes) */}
      <CodeNotesSection
        assessment={feasibilityAssessment}
        loading={feasibilityLoading ?? false}
        hasCodebase={hasCodebase}
        hasContent={!isEmpty}
      />
    </div>
  );
}
