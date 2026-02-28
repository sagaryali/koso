"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { StreamedMarkdown } from "@/components/ui/streamed-markdown";
import { streamCompletion } from "@/lib/ai/stream";
import { buildPrompt } from "@/lib/ai/prompt-builder";
import { fetchWorkspaceOverview } from "@/lib/workspace-overview";
import { createClient } from "@/lib/supabase/client";
import type { AIAction } from "@/lib/ai/actions";

interface InsightsActionDialogProps {
  open: boolean;
  onClose: () => void;
  action: AIAction;
  workspaceId: string;
  workspace: { name: string; productDescription: string | null; principles: string[] };
}

export function InsightsActionDialog({
  open,
  onClose,
  action,
  workspaceId,
  workspace,
}: InsightsActionDialogProps) {
  const [text, setText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  const startStream = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setText("");
    setError(null);
    setStreaming(true);

    try {
      const supabase = createClient();
      const overview = await fetchWorkspaceOverview(workspaceId, supabase);

      const { system, user } = buildPrompt(
        action,
        { title: "Workspace Overview", type: "overview", content: "" },
        {
          artifacts: [],
          evidence: [],
          codebaseModules: [],
          workspaceOverview: overview,
        },
        {
          name: workspace.name,
          productDescription: workspace.productDescription,
          principles: workspace.principles,
        },
        action.promptTemplate,
      );

      await streamCompletion({
        system,
        user,
        model: "sonnet",
        maxTokens: 3000,
        onChunk: (chunk) => setText((prev) => prev + chunk),
        onComplete: () => setStreaming(false),
        onError: (err) => {
          setError(err.message);
          setStreaming(false);
        },
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("[insights-action-dialog] Error:", err);
      setError(err instanceof Error ? err.message : "Request failed");
      setStreaming(false);
    }
  }, [action, workspaceId, workspace]);

  const handleClose = useCallback(() => {
    setText("");
    setStreaming(false);
    setError(null);
    startedRef.current = false;
    onClose();
  }, [onClose]);

  // Auto-start when dialog opens
  if (open && !startedRef.current && !streaming && !text && !error) {
    startStream();
  }

  return (
    <Dialog open={open} onClose={handleClose} className="max-w-xl">
      <h2 className="text-lg font-bold tracking-tight">{action.label}</h2>
      <p className="mt-1 text-xs text-text-tertiary">{action.description}</p>

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
                startStream();
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
            Analyzing workspace...
          </div>
        ) : null}
      </div>

      {!streaming && text && (
        <div className="mt-4 flex justify-end">
          <Button variant="secondary" size="sm" onClick={handleClose}>
            Done
          </Button>
        </div>
      )}
    </Dialog>
  );
}
