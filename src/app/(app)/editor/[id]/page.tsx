"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Editor } from "@tiptap/core";
import {
  PanelRightClose,
  PanelRightOpen,
  Sparkles,
  ChevronDown,
  Trash2,
} from "lucide-react";
import {
  Button,
  Badge,
  Dialog,
  ResizablePanel,
  CommandPalette,
  Icon,
  Skeleton,
} from "@/components/ui";
import type { CommandPaletteContext } from "@/components/ui";
import { DropdownMenu } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { TiptapEditor } from "@/components/editor/tiptap-editor";
import { ContextPanel } from "@/components/panels/context-panel";
import { FeasibilityPanel } from "@/components/panels/FeasibilityPanel";
import { AddEvidenceDialog } from "@/components/evidence/add-evidence-dialog";
import { SaveAsTemplateDialog } from "@/components/save-as-template-dialog";
import { useContextPanel } from "@/hooks/use-context-panel";
import { useCodebaseStatus } from "@/hooks/use-codebase-status";
import { useFeasibility } from "@/hooks/use-feasibility";
import { useMarketSignals } from "@/hooks/use-market-signals";
import { useSeededContext } from "@/hooks/use-seeded-context";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useTourTrigger } from "@/hooks/use-tour-trigger";
import { EDITOR_TOUR } from "@/lib/tours";
import { getSectionConfig, type SectionConfig } from "@/lib/section-config";
import { extractPriorSections } from "@/lib/editor-utils";
import { getActionsForSection } from "@/lib/ai/actions";
import { useSectionBriefing } from "@/hooks/use-section-briefing";
import type { Artifact, ArtifactStatus, Workspace } from "@/types";

const STATUS_OPTIONS: { label: string; value: ArtifactStatus }[] = [
  { label: "Draft", value: "draft" },
  { label: "Active", value: "active" },
  { label: "Archived", value: "archived" },
];

const TYPE_LABELS: Record<string, string> = {
  prd: "PRD",
  user_story: "User Story",
  principle: "Principle",
  decision_log: "Decision Log",
  roadmap_item: "Roadmap",
  architecture_summary: "Architecture",
};

function extractTextFromTiptapJSON(doc: Record<string, unknown>): string {
  function walk(node: Record<string, unknown>): string {
    if (typeof node.text === "string") return node.text;
    const children = node.content as Record<string, unknown>[] | undefined;
    if (!children) return "";
    return children.map(walk).join(
      ["paragraph", "heading", "bulletList", "orderedList", "taskList", "blockquote", "codeBlock", "listItem", "taskItem"].includes(node.type as string)
        ? "\n"
        : ""
    );
  }
  return walk(doc);
}

export default function EditorPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const supabase = createClient();

  useTourTrigger("editor", EDITOR_TOUR, 1000);

  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [panelOpen, setPanelOpen] = useState(true);
  const [commandOpen, setCommandOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [evidenceDialogOpen, setEvidenceDialogOpen] = useState(false);
  const [evidencePrefill, setEvidencePrefill] = useState("");
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saving" | "saved" | "idle">(
    "idle"
  );
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const editorTextRef = useRef<string>("");
  const [isEmpty, setIsEmpty] = useState(true);
  const [currentSectionName, setCurrentSectionName] = useState<string | null>(null);
  const [panelJustOpened, setPanelJustOpened] = useState(false);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const panelHighlightRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Codebase status
  const { connection: codebaseConnection } = useCodebaseStatus(true);
  const hasCodebase = codebaseConnection?.status === "ready";

  // Context panel
  const {
    results: contextResults,
    loading: contextLoading,
    triggerSearch,
    searchImmediate,
  } = useContextPanel(artifact?.workspace_id ?? "", id);

  // Feasibility assessment
  const {
    assessment: feasibilityAssessment,
    loading: feasibilityLoading,
    error: feasibilityError,
    triggerAssessment,
  } = useFeasibility(artifact?.workspace_id ?? "", hasCodebase);

  // Market signals
  const {
    results: marketSignals,
    loading: marketSignalsLoading,
    cached: marketSignalsCached,
    error: marketSignalsError,
    triggerSearch: triggerMarketSearch,
  } = useMarketSignals(
    artifact?.workspace_id ?? "",
    workspace?.product_description ?? null
  );

  // Seeded context for empty specs
  const seededContext = useSeededContext(
    artifact?.workspace_id ?? "",
    id,
    isEmpty,
    codebaseConnection?.status ?? null,
    workspace?.product_description ?? null
  );

  // Derive section config from current section name and artifact type
  const currentSectionConfig: SectionConfig | null =
    currentSectionName
      ? getSectionConfig(currentSectionName, artifact?.type ?? undefined)
      : null;

  // Section briefing for proactive guidance
  const priorSectionsForBriefing =
    editorRef.current && currentSectionName
      ? extractPriorSections(editorRef.current).map((s) => ({
          heading: s.heading,
          text: s.text,
        }))
      : [];

  const { briefing: sectionBriefing } = useSectionBriefing(
    artifact?.workspace_id ?? "",
    currentSectionName,
    currentSectionConfig?.guidance ?? null,
    priorSectionsForBriefing,
    workspace?.product_description ?? null
  );

  // Derived insight count for the section hint
  const insightCount =
    contextResults.customerEvidence.length +
    contextResults.codeContext.length +
    contextResults.relatedSpecs.length;

  const handleTextChange = useCallback(
    (cumulativeText: string, sectionName: string | null) => {
      const fullText = editorRef.current?.getText() ?? "";
      setIsEmpty(fullText.length < 50);
      const config = sectionName
        ? getSectionConfig(sectionName, artifact?.type ?? undefined)
        : undefined;
      triggerSearch(cumulativeText, config);
      triggerMarketSearch(cumulativeText);
      if (hasCodebase && artifact) {
        triggerAssessment(cumulativeText, title || artifact.title, artifact.type);
      }
    },
    [triggerSearch, triggerMarketSearch, triggerAssessment, hasCodebase, artifact, title]
  );

  const handleSectionChange = useCallback(
    (cumulativeText: string, sectionName: string | null) => {
      // Context panel search is already debounced; trigger immediate on section nav
      const config = sectionName
        ? getSectionConfig(sectionName, artifact?.type ?? undefined)
        : undefined;
      triggerSearch(cumulativeText, config);
    },
    [triggerSearch, artifact]
  );

  const handleDraftSection = useCallback(() => {
    setPendingActionId("draft_section");
    setCommandOpen(true);
  }, []);

  const handleOpenPanel = useCallback(() => {
    setPanelOpen(true);
    setPanelJustOpened(true);
    if (panelHighlightRef.current) clearTimeout(panelHighlightRef.current);
    panelHighlightRef.current = setTimeout(() => setPanelJustOpened(false), 1500);
  }, []);

  const handleInsertCitation = useCallback(
    (text: string, source: string) => {
      const editor = editorRef.current;
      if (!editor) return;

      const { from } = editor.state.selection;
      const $pos = editor.state.doc.resolve(from);
      const endOfBlock = $pos.end();

      editor
        .chain()
        .focus()
        .insertContentAt(endOfBlock + 1, [
          {
            type: "blockquote",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text }],
              },
            ],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                marks: [{ type: "italic" }],
                text: `— ${source}`,
              },
            ],
          },
        ])
        .run();
    },
    []
  );

  const handleEditorReady = useCallback(
    (fullText: string) => {
      editorTextRef.current = fullText;
      setIsEmpty(fullText.length < 50);
      searchImmediate(fullText);
    },
    [searchImmediate]
  );

  const handleEditorInstance = useCallback((editor: Editor) => {
    editorRef.current = editor;
  }, []);

  // Fetch artifact + workspace on mount
  useEffect(() => {
    async function fetchData() {
      const { data: artifactData } = await supabase
        .from("artifacts")
        .select("*")
        .eq("id", id)
        .single();

      if (artifactData) {
        setArtifact(artifactData);
        setTitle(artifactData.title);

        // Fetch workspace
        const { data: ws } = await supabase
          .from("workspaces")
          .select("*")
          .eq("id", artifactData.workspace_id)
          .single();
        if (ws) setWorkspace(ws);
      }
      setLoading(false);
    }

    fetchData();
  }, [id]);

  // Save content to Supabase
  const handleContentSave = useCallback(
    async (content: Record<string, unknown>) => {
      setSaveStatus("saving");
      await supabase
        .from("artifacts")
        .update({ content, updated_at: new Date().toISOString() })
        .eq("id", id);

      // Keep editor text ref up to date
      editorTextRef.current = extractTextFromTiptapJSON(content);
      setIsEmpty(editorTextRef.current.length < 50);

      setSaveStatus("saved");
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);

      // Fire-and-forget: re-embed this artifact then auto-link
      fetch("/api/embeddings/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: id, sourceType: "artifact" }),
      })
        .then(() =>
          fetch("/api/links/auto", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sourceId: id,
              sourceType: "artifact",
              workspaceId: artifact?.workspace_id,
            }),
          })
        )
        .catch(() => {
          toast({ message: "Embeddings failed to update. Will retry on next save." });
        });
    },
    [id]
  );

  // Save title on blur
  const handleTitleBlur = useCallback(async () => {
    if (!artifact || title === artifact.title) return;

    await supabase
      .from("artifacts")
      .update({ title, updated_at: new Date().toISOString() })
      .eq("id", id);

    setArtifact((prev) => (prev ? { ...prev, title } : null));
  }, [artifact, title, id]);

  // Save status
  const handleStatusChange = useCallback(
    async (status: ArtifactStatus) => {
      await supabase
        .from("artifacts")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);

      setArtifact((prev) => (prev ? { ...prev, status } : null));
    },
    [id]
  );

  // Delete artifact
  const handleDelete = useCallback(async () => {
    await supabase.from("artifacts").delete().eq("id", id);
    router.push("/");
  }, [id, router]);

  // Insert text below current cursor position in editor
  const handleInsertBelow = useCallback(
    (text: string) => {
      const editor = editorRef.current;
      if (!editor) return;

      // Move to end of document and insert markdown as plain text paragraphs
      const endPos = editor.state.doc.content.size;
      editor
        .chain()
        .focus()
        .insertContentAt(endPos, [
          { type: "horizontalRule" },
          ...text.split("\n\n").filter(Boolean).map((para) => ({
            type: "paragraph" as const,
            content: [{ type: "text" as const, text: para }],
          })),
        ])
        .run();
    },
    []
  );

  // Create child artifacts from AI-generated user stories
  const handleCreateArtifacts = useCallback(
    async (stories: { title: string; content: string }[]) => {
      if (!artifact) return;

      for (const story of stories) {
        await supabase.from("artifacts").insert({
          workspace_id: artifact.workspace_id,
          type: "user_story",
          title: story.title,
          content: {
            type: "doc",
            content: story.content.split("\n\n").filter(Boolean).map((para) => {
              // Simple heuristic: headings start with #
              if (para.startsWith("# ")) {
                return {
                  type: "heading",
                  attrs: { level: 1 },
                  content: [{ type: "text", text: para.slice(2) }],
                };
              }
              if (para.startsWith("## ")) {
                return {
                  type: "heading",
                  attrs: { level: 2 },
                  content: [{ type: "text", text: para.slice(3) }],
                };
              }
              if (para.startsWith("### ")) {
                return {
                  type: "heading",
                  attrs: { level: 3 },
                  content: [{ type: "text", text: para.slice(4) }],
                };
              }
              return {
                type: "paragraph",
                content: [{ type: "text", text: para }],
              };
            }),
          },
          status: "draft",
          parent_id: artifact.id,
        });
      }
    },
    [artifact]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K: command palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandOpen(true);
      }
      // Cmd+.: toggle panel
      if ((e.metaKey || e.ctrlKey) && e.key === ".") {
        e.preventDefault();
        setPanelOpen((prev) => !prev);
      }
      // Cmd+Shift+E: save selection as evidence
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "E") {
        e.preventDefault();
        const editor = editorRef.current;
        if (!editor) return;

        const { from, to, empty } = editor.state.selection;
        let selectedText: string;

        if (empty) {
          // No selection — grab the current paragraph/block
          const $pos = editor.state.doc.resolve(from);
          const parent = $pos.parent;
          selectedText = parent.textContent;
        } else {
          selectedText = editor.state.doc.textBetween(from, to, "\n", " ");
        }

        if (selectedText.trim()) {
          setEvidencePrefill(selectedText.trim());
          setEvidenceDialogOpen(true);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Set page title
  useEffect(() => {
    document.title = title ? `Koso — ${title}` : "Koso — Editor";
  }, [title]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      if (panelHighlightRef.current) clearTimeout(panelHighlightRef.current);
    };
  }, []);

  // Build command palette context
  const paletteContext: CommandPaletteContext | null =
    artifact && workspace
      ? {
          workspaceId: workspace.id,
          workspace: {
            name: workspace.name,
            productDescription: workspace.product_description,
            principles: workspace.principles,
          },
          artifact: {
            id: artifact.id,
            workspaceId: artifact.workspace_id,
            title: title || artifact.title,
            type: artifact.type,
            content:
              editorRef.current?.getText() ||
              editorTextRef.current ||
              extractTextFromTiptapJSON(artifact.content),
          },
          currentSection:
            currentSectionName && editorRef.current
              ? {
                  name: currentSectionName,
                  contextStrategy:
                    currentSectionConfig?.contextStrategy ?? "balanced",
                  priorSections: extractPriorSections(editorRef.current).map(
                    (s) => ({ heading: s.heading, text: s.text })
                  ),
                }
              : undefined,
        }
      : null;

  if (loading) {
    return (
      <div className="flex h-full">
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[720px] px-12 pt-10 pb-24 page-transition">
            <div className="flex items-center gap-2">
              <Skeleton variant="text" width={60} />
              <Skeleton variant="text" width={50} />
            </div>
            <div className="mt-4">
              <Skeleton variant="text" width="60%" height={36} />
            </div>
            <div className="mt-6 border-t border-border-default" />
            <div className="mt-6 space-y-4">
              <Skeleton variant="text" width="100%" />
              <Skeleton variant="text" width="85%" />
              <Skeleton variant="text" width="90%" />
              <Skeleton variant="text" width="40%" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!artifact) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-text-tertiary">Artifact not found</div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Editor area */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[720px] px-12 pt-10 pb-24">
          {/* Row 1: Type badge + Status dropdown */}
          <div className="flex items-center gap-2">
            <Badge>{TYPE_LABELS[artifact.type] || artifact.type}</Badge>
            <DropdownMenu
              trigger={
                <Badge className="cursor-pointer">
                  {artifact.status}
                  <Icon
                    icon={ChevronDown}
                    size={12}
                    className="ml-1 text-text-tertiary"
                  />
                </Badge>
              }
              items={STATUS_OPTIONS.map((opt) => ({
                label: opt.label,
                onClick: () => handleStatusChange(opt.value),
              }))}
            />

            {/* Save status */}
            <span
              className={cn(
                "ml-auto text-xs text-text-tertiary transition-opacity duration-200",
                saveStatus === "idle" && "opacity-0",
                saveStatus !== "idle" && "opacity-100"
              )}
            >
              {saveStatus === "saving" ? "Saving..." : "Saved"}
            </span>
          </div>

          {/* Row 2: Title */}
          <input
            ref={titleInputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                titleInputRef.current?.blur();
              }
            }}
            placeholder="Untitled"
            className="mt-4 w-full bg-transparent text-2xl font-bold tracking-tight text-text-primary placeholder:text-text-tertiary focus:outline-none"
          />

          {/* Toolbar row */}
          <div className="mt-4 flex items-center gap-2" data-tour="editor-toolbar">
            <Button
              variant="secondary"
              size="sm"
              icon={panelOpen ? PanelRightClose : PanelRightOpen}
              onClick={() => setPanelOpen(!panelOpen)}
            >
              {panelOpen ? "Hide Panel" : "Show Panel"}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setCommandOpen(true)}
            >
              <span className="text-xs opacity-70">&#8984;K</span>
            </Button>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTemplateDialogOpen(true)}
            >
              Save as template
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={Trash2}
              onClick={() => setDeleteDialogOpen(true)}
            >
              Delete
            </Button>
          </div>

          {/* Section action toolbar */}
          {currentSectionConfig && currentSectionName && (
            <div className="mt-3 flex items-center gap-1.5" data-tour="editor-section-actions">
              {getActionsForSection(currentSectionConfig.contextStrategy, 4).map(
                (action) => (
                  <button
                    key={action.id}
                    onClick={() => {
                      setPendingActionId(action.id);
                      setCommandOpen(true);
                    }}
                    className="cursor-pointer border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-secondary hover:border-border-strong hover:text-text-primary"
                  >
                    {action.label}
                  </button>
                )
              )}
            </div>
          )}

          {/* Divider */}
          <div className="mt-6 border-t border-border-default" />

          {/* Editor */}
          <div className="mt-6" data-tour="editor-content">
            <TiptapEditor
              content={artifact.content}
              onSave={handleContentSave}
              onSaveStatusChange={setSaveStatus}
              onTextChange={handleTextChange}
              onSectionChange={handleSectionChange}
              onReady={handleEditorReady}
              onEditorInstance={handleEditorInstance}
              onSectionNameChange={setCurrentSectionName}
              insightCount={insightCount}
              onOpenPanel={handleOpenPanel}
              briefing={sectionBriefing}
              onDraftSection={handleDraftSection}
            />
          </div>

          {/* AI hint box */}
          <div className="mt-12 flex items-center gap-3 border border-dashed border-border-default p-4">
            <Icon icon={Sparkles} className="shrink-0 text-text-tertiary" />
            <span className="text-sm text-text-tertiary">
              Press{" "}
              <kbd className="inline-flex items-center gap-0.5 bg-bg-tertiary px-1.5 py-0.5 text-xs font-medium">
                &#8984;K
              </kbd>{" "}
              to generate user stories, check conflicts, or ask the AI anything
            </span>
          </div>
        </div>
      </div>

      {/* Context Panel */}
      <div data-tour="editor-panel">
      <ResizablePanel width={320} collapsed={!panelOpen}>
        <div className="h-full overflow-y-auto">
          <ContextPanel
            relatedSpecs={contextResults.relatedSpecs}
            customerEvidence={contextResults.customerEvidence}
            codeContext={contextResults.codeContext}
            marketSignals={marketSignals}
            marketSignalsLoading={marketSignalsLoading}
            marketSignalsCached={marketSignalsCached}
            marketSignalsError={marketSignalsError}
            loading={contextLoading}
            artifactId={id}
            workspaceId={artifact.workspace_id}
            hasCodebase={hasCodebase}
            isEmpty={isEmpty}
            seededContext={seededContext}
            codebaseStatus={codebaseConnection?.status ?? null}
            productName={workspace?.name ?? null}
            currentSectionName={currentSectionName}
            sectionConfig={currentSectionConfig}
            panelJustOpened={panelJustOpened}
            onInsertCitation={handleInsertCitation}
          />

          {/* Feasibility section — below code context */}
          <div className="px-6 pb-6">
            <FeasibilityPanel
              assessment={feasibilityAssessment}
              loading={feasibilityLoading}
              error={feasibilityError}
              hasCodebase={hasCodebase}
            />
          </div>
        </div>
      </ResizablePanel>
      </div>

      {/* Command Palette */}
      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        context={paletteContext}
        onInsertBelow={handleInsertBelow}
        onCreateArtifacts={handleCreateArtifacts}
        pendingActionId={pendingActionId}
        onActionConsumed={() => setPendingActionId(null)}
      />

      {/* Save as Evidence Dialog */}
      {artifact && (
        <AddEvidenceDialog
          open={evidenceDialogOpen}
          onClose={() => setEvidenceDialogOpen(false)}
          workspaceId={artifact.workspace_id}
          prefillContent={evidencePrefill}
          prefillSource={title || artifact.title}
          mini
        />
      )}

      {/* Save as Template */}
      {artifact && (
        <SaveAsTemplateDialog
          open={templateDialogOpen}
          onClose={() => setTemplateDialogOpen(false)}
          workspaceId={artifact.workspace_id}
          content={artifact.content}
          artifactType={artifact.type}
          defaultLabel={title || artifact.title}
        />
      )}

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <div className="space-y-4">
          <h3 className="text-lg font-medium tracking-tight">Delete spec</h3>
          <p className="text-sm text-text-secondary">
            Are you sure you want to delete &ldquo;{title || "Untitled"}&rdquo;? This cannot be undone.
          </p>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleDelete}
            >
              Delete
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
