"use client";

import { useState } from "react";
import { Button, Input, Dialog } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import type { ArtifactType } from "@/types";

interface SaveAsTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  content: Record<string, unknown>;
  artifactType: ArtifactType;
  defaultLabel?: string;
}

export function SaveAsTemplateDialog({
  open,
  onClose,
  workspaceId,
  content,
  artifactType,
  defaultLabel,
}: SaveAsTemplateDialogProps) {
  const [label, setLabel] = useState(defaultLabel ?? "");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  async function handleSave() {
    if (!label.trim()) return;
    setSaving(true);

    const { error } = await supabase.from("custom_templates").insert({
      workspace_id: workspaceId,
      label: label.trim(),
      description: description.trim(),
      type: artifactType,
      content,
    });

    setSaving(false);

    if (error) {
      toast({ message: "Failed to save template" });
      return;
    }

    toast({ message: "Template saved" });
    setLabel("");
    setDescription("");
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} className="max-w-sm">
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight">
            Save as Template
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Save the current spec structure as a reusable template.
          </p>
        </div>

        <Input
          label="Template Name"
          placeholder="e.g., Feature RFC"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <Input
          label="Description (optional)"
          placeholder="Brief description of when to use this"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!label.trim() || saving}>
            {saving ? "Saving..." : "Save Template"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
