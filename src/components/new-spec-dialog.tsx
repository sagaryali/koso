"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { SPEC_TEMPLATES } from "@/lib/spec-templates";
import type { CustomTemplate, ArtifactType } from "@/types";

interface NewSpecDialogProps {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  evidenceCount?: number;
  onCreated?: (spec: { id: string }) => void;
  onStartFromEvidence?: () => void;
}

export function NewSpecDialog({
  open,
  onClose,
  workspaceId,
  evidenceCount,
  onCreated,
  onStartFromEvidence,
}: NewSpecDialogProps) {
  const [creating, setCreating] = useState(false);
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([]);
  const router = useRouter();
  const supabase = createClient();

  // Fetch custom templates when dialog opens
  useEffect(() => {
    if (!open || !workspaceId) return;

    async function fetchCustomTemplates() {
      const { data } = await supabase
        .from("custom_templates")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });

      setCustomTemplates(data ?? []);
    }

    fetchCustomTemplates();
  }, [open, workspaceId]);

  async function handleSelect(templateId: string) {
    if (creating) return;
    setCreating(true);

    const template = SPEC_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;

    const { data } = await supabase
      .from("artifacts")
      .insert({
        workspace_id: workspaceId,
        type: template.type,
        title: template.id === "blank" ? "Untitled Spec" : `Untitled ${template.label}`,
        content: template.content,
        status: "draft",
      })
      .select()
      .single();

    if (data) {
      onCreated?.(data);
      onClose();
      router.push(`/editor/${data.id}`);
    }

    setCreating(false);
  }

  async function handleSelectCustom(template: CustomTemplate) {
    if (creating) return;
    setCreating(true);

    const { data } = await supabase
      .from("artifacts")
      .insert({
        workspace_id: workspaceId,
        type: template.type as ArtifactType,
        title: `Untitled ${template.label}`,
        content: template.content,
        status: "draft",
      })
      .select()
      .single();

    if (data) {
      onCreated?.(data);
      onClose();
      router.push(`/editor/${data.id}`);
    }

    setCreating(false);
  }

  const hasEvidence = (evidenceCount ?? 0) > 0;

  return (
    <Dialog open={open} onClose={onClose} className="max-w-md">
      <h2 className="text-lg font-bold tracking-tight">New Spec</h2>
      <p className="mt-1 text-sm text-text-secondary">
        Pick a starting point.
      </p>

      <div className="mt-5 space-y-1">
        {/* Start from evidence — prominent when evidence exists */}
        {hasEvidence && onStartFromEvidence && (
          <>
            <button
              onClick={() => {
                onClose();
                onStartFromEvidence();
              }}
              disabled={creating}
              className={cn(
                "flex w-full cursor-pointer items-center gap-3 border border-border-strong px-3 py-3 text-left transition-none hover:bg-bg-hover",
                creating && "opacity-50"
              )}
            >
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium text-text-primary">
                  Start from evidence
                </span>
                <p className="text-xs text-text-tertiary">
                  Cluster {evidenceCount} evidence items, then draft a spec
                </p>
              </div>
            </button>
            <div className="py-2">
              <div className="text-[11px] font-medium uppercase tracking-caps text-text-tertiary">
                Or pick a template
              </div>
            </div>
          </>
        )}

        {/* Built-in templates */}
        {SPEC_TEMPLATES.map((template) => (
          <button
            key={template.id}
            onClick={() => handleSelect(template.id)}
            disabled={creating}
            className={cn(
              "flex w-full cursor-pointer items-center gap-3 px-3 py-3 text-left transition-none hover:bg-bg-hover",
              creating && "opacity-50"
            )}
          >
            <div className="min-w-0 flex-1">
              <span className="text-sm font-medium text-text-primary">
                {template.label}
              </span>
              <p className="text-xs text-text-tertiary">
                {template.description}
              </p>
            </div>
          </button>
        ))}

        {/* Custom templates */}
        {customTemplates.length > 0 && (
          <>
            <div className="pt-2 pb-1">
              <div className="text-[11px] font-medium uppercase tracking-caps text-text-tertiary">
                Custom
              </div>
            </div>
            {customTemplates.map((template) => (
              <button
                key={template.id}
                onClick={() => handleSelectCustom(template)}
                disabled={creating}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-3 px-3 py-3 text-left transition-none hover:bg-bg-hover",
                  creating && "opacity-50"
                )}
              >
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-text-primary">
                    {template.label}
                  </span>
                  {template.description && (
                    <p className="text-xs text-text-tertiary">
                      {template.description}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </>
        )}
      </div>
    </Dialog>
  );
}
