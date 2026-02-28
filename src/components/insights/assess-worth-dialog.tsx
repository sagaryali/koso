"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { StreamedMarkdown } from "@/components/ui/streamed-markdown";
import { streamCompletion } from "@/lib/ai/stream";
import { createClient } from "@/lib/supabase/client";
import type { EvidenceCluster, ClusterVerdict } from "@/types";

interface AssessWorthDialogProps {
  open: boolean;
  onClose: () => void;
  cluster: EvidenceCluster;
  workspaceId: string;
  onVerdictSaved?: (clusterId: string, verdict: ClusterVerdict, reasoning: string) => void;
}

function parseVerdict(text: string): ClusterVerdict | null {
  const match = text.match(/## Verdict:\s*(BUILD|MAYBE|SKIP)/i);
  return match ? (match[1].toUpperCase() as ClusterVerdict) : null;
}

const VERDICT_COLORS: Record<ClusterVerdict, string> = {
  BUILD: "bg-green-100 text-green-800",
  MAYBE: "bg-yellow-100 text-yellow-800",
  SKIP: "bg-red-100 text-red-800",
};

const SYSTEM_PROMPT =
  "You are a senior product strategist deciding whether a feature theme is worth building. " +
  "For each theme, assign a verdict:\n" +
  "- BUILD: Strong customer demand, clear business value, evidence supports this decisively.\n" +
  "- MAYBE: Some signal but not enough evidence, or the value is unclear. Needs more validation.\n" +
  "- SKIP: Weak signal, low impact, or not aligned with core product direction.\n\n" +
  "Consider evidence volume, criticality, and whether the theme addresses a real customer pain point vs. a nice-to-have. " +
  "Be decisive — default to MAYBE only when genuinely uncertain.";

const ASSESSMENT_TEMPLATE =
  "Assess whether the following feature theme is worth building.\n\n" +
  "Respond in exactly this format:\n\n" +
  "## Verdict: [BUILD / MAYBE / SKIP]\n\n" +
  "One to two sentences explaining why. Ground it in the evidence provided. Be direct.";

export function AssessWorthDialog({
  open,
  onClose,
  cluster,
  workspaceId,
  onVerdictSaved,
}: AssessWorthDialogProps) {
  const [text, setText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const startedRef = useRef(false);

  const startAssessment = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setText("");
    setError(null);
    setStreaming(true);

    try {
      // Fetch evidence content for this cluster
      const supabase = createClient();
      const { data: evidenceItems } = await supabase
        .from("evidence")
        .select("title, content, type, source")
        .in("id", cluster.evidence_ids);

      const evidenceSection = (evidenceItems ?? [])
        .map(
          (e: { title: string; content: string; type: string; source: string | null }) =>
            `[${e.type}] ${e.title}: ${e.content}${e.source ? ` (Source: ${e.source})` : ""}`
        )
        .join("\n\n");

      const user =
        `${ASSESSMENT_TEMPLATE}\n\n` +
        `---\n\n` +
        `**Feature theme:** ${cluster.label}\n\n` +
        `**Summary:** ${cluster.summary}\n\n` +
        `**Evidence (${cluster.evidence_count} items):**\n\n${evidenceSection}`;

      await streamCompletion({
        system: SYSTEM_PROMPT,
        user,
        model: "sonnet",
        maxTokens: 2048,
        onChunk: (chunk) => {
          setText((prev) => prev + chunk);
        },
        onComplete: () => {
          setStreaming(false);
        },
        onError: (err) => {
          setError(err.message);
          setStreaming(false);
        },
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("[assess-worth-dialog] Error:", err);
      setError(err instanceof Error ? err.message : "Assessment failed");
      setStreaming(false);
    }
  }, [workspaceId, cluster]);

  const handleSaveVerdict = useCallback(async () => {
    const verdict = parseVerdict(text);
    if (!verdict) return;

    setSaving(true);
    try {
      const supabase = createClient();
      await supabase
        .from("evidence_clusters")
        .update({
          verdict,
          verdict_reasoning: text,
          verdict_at: new Date().toISOString(),
        })
        .eq("id", cluster.id);

      onVerdictSaved?.(cluster.id, verdict, text);
      // Reset to "existing verdict" view
      setText("");
      startedRef.current = false;
    } catch (err) {
      console.error("[assess-worth-dialog] Save verdict failed:", err);
    } finally {
      setSaving(false);
    }
  }, [text, cluster.id, onVerdictSaved]);

  const handleClose = useCallback(() => {
    setText("");
    setStreaming(false);
    setError(null);
    setSaving(false);
    startedRef.current = false;
    onClose();
  }, [onClose]);

  // If cluster already has a verdict and dialog opens without streaming, show existing
  const hasExistingVerdict = !!cluster.verdict && !startedRef.current && !text;

  // Start assessment when dialog opens (only if no existing verdict)
  if (open && !startedRef.current && !streaming && !text && !error && !cluster.verdict) {
    startAssessment();
  }

  return (
    <Dialog open={open} onClose={handleClose} className="max-w-xl">
      <h2 className="text-lg font-bold tracking-tight">
        Is &ldquo;{cluster.label}&rdquo; worth building?
      </h2>
      <p className="mt-1 text-xs text-text-tertiary">
        Based on {cluster.evidence_count} evidence items
      </p>

      {/* Existing verdict banner */}
      {hasExistingVerdict && cluster.verdict && (
        <div className="mt-4 flex items-center justify-between border border-border-default p-3">
          <div className="flex items-center gap-2">
            <span className={`px-1.5 py-0.5 text-[10px] font-bold ${VERDICT_COLORS[cluster.verdict]}`}>
              {cluster.verdict}
            </span>
            <span className="text-xs text-text-tertiary">
              Assessed {cluster.verdict_at ? new Date(cluster.verdict_at).toLocaleDateString() : ""}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              startedRef.current = false;
              startAssessment();
            }}
          >
            Re-assess
          </Button>
        </div>
      )}

      <div className="mt-4 max-h-[400px] overflow-y-auto">
        {error ? (
          <div className="space-y-3">
            <p className="text-sm text-state-error">{error}</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                startedRef.current = false;
                setError(null);
                startAssessment();
              }}
            >
              Retry
            </Button>
          </div>
        ) : text ? (
          <div className="text-sm text-text-secondary">
            <StreamedMarkdown text={text} />
            {streaming && (
              <span className="inline-block h-4 w-1 animate-pulse bg-text-primary" />
            )}
          </div>
        ) : streaming ? (
          <div className="flex items-center gap-2 py-4 text-xs text-text-tertiary">
            <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-text-tertiary" />
            Analyzing evidence...
          </div>
        ) : hasExistingVerdict && cluster.verdict_reasoning ? (
          <div className="text-sm text-text-secondary">
            <StreamedMarkdown text={cluster.verdict_reasoning} />
          </div>
        ) : null}
      </div>

      {!streaming && text && (
        <div className="mt-4 flex items-center justify-end gap-2">
          {parseVerdict(text) && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveVerdict}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save assessment"}
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={handleClose}>
            Done
          </Button>
        </div>
      )}
    </Dialog>
  );
}
