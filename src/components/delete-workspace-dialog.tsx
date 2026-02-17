"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Button, Input } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import {
  setActiveWorkspaceCookie,
  clearActiveWorkspaceCookie,
} from "@/lib/workspace-cookie";
import type { Workspace } from "@/types";

interface DeleteWorkspaceDialogProps {
  open: boolean;
  onClose: () => void;
  workspace: Workspace;
  allWorkspaces: Workspace[];
}

export function DeleteWorkspaceDialog({
  open,
  onClose,
  workspace,
  allWorkspaces,
}: DeleteWorkspaceDialogProps) {
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const canDelete = confirmation === workspace.name;

  async function handleDelete() {
    if (!canDelete || deleting) return;
    setDeleting(true);

    const { error } = await supabase
      .from("workspaces")
      .delete()
      .eq("id", workspace.id);

    if (error) {
      toast({ message: "Failed to delete product. Please try again." });
      setDeleting(false);
      return;
    }

    const remaining = allWorkspaces.filter((w) => w.id !== workspace.id);

    if (remaining.length > 0) {
      setActiveWorkspaceCookie(remaining[0].id);
      handleClose();
      router.refresh();
    } else {
      clearActiveWorkspaceCookie();
      router.push("/onboarding");
    }
  }

  function handleClose() {
    if (!deleting) {
      setConfirmation("");
      onClose();
    }
  }

  return (
    <Dialog open={open} onClose={handleClose}>
      <h2 className="text-lg font-bold tracking-tight">Delete Product</h2>
      <p className="mt-3 text-sm text-text-secondary">
        This will permanently delete{" "}
        <strong className="text-text-primary">{workspace.name}</strong> and all
        its specs, evidence, codebase connections, and embeddings. This action
        cannot be undone.
      </p>
      <div className="mt-6">
        <Input
          label={`Type "${workspace.name}" to confirm`}
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder={workspace.name}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canDelete) handleDelete();
          }}
        />
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={handleClose} disabled={deleting}>
          Cancel
        </Button>
        <Button
          onClick={handleDelete}
          disabled={!canDelete || deleting}
          className="border-state-error bg-state-error text-white hover:opacity-90"
        >
          {deleting ? "Deleting..." : "Delete Product"}
        </Button>
      </div>
    </Dialog>
  );
}
