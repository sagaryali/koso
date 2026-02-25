"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { SPEC_TEMPLATES } from "@/lib/spec-templates";

interface NewSpecDialogProps {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  onCreated?: (spec: { id: string }) => void;
}

export function NewSpecDialog({
  open,
  onClose,
  workspaceId,
  onCreated,
}: NewSpecDialogProps) {
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const supabase = createClient();

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
        title: template.id === "blank" ? "Untitled Spec" : "",
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

  return (
    <Dialog open={open} onClose={onClose} className="max-w-md">
      <h2 className="text-lg font-bold tracking-tight">New Spec</h2>
      <p className="mt-1 text-sm text-text-secondary">
        Pick a template to get started.
      </p>

      <div className="mt-5 space-y-1">
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
      </div>
    </Dialog>
  );
}
