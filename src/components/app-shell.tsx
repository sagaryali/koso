"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { KeyboardShortcutsDialog } from "@/components/keyboard-shortcuts-dialog";
import { AddEvidenceDialog } from "@/components/evidence/add-evidence-dialog";
import { NewProductDialog } from "@/components/new-product-dialog";
import { CommandPalette } from "@/components/ui/command-palette";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { WorkspaceProvider } from "@/lib/workspace-context";
import { CoachMarkProvider } from "@/lib/coach-mark-context";
import { createClient } from "@/lib/supabase/client";
import {
  getActiveWorkspaceCookie,
  setActiveWorkspaceCookie,
} from "@/lib/workspace-cookie";
import type { Workspace } from "@/types";

interface AppShellProps {
  workspace: Workspace | null;
  allWorkspaces: Workspace[];
  children: React.ReactNode;
}

export function AppShell({ workspace, allWorkspaces, children }: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [newProductOpen, setNewProductOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const isEditorPage = pathname?.startsWith("/editor");

  // Ensure workspace cookie is set so server-side API routes can read it
  useEffect(() => {
    if (workspace && !getActiveWorkspaceCookie()) {
      setActiveWorkspaceCookie(workspace.id);
    }
  }, [workspace]);

  const handleNewArtifact = useCallback(async () => {
    if (!workspace) return;

    const { data } = await supabase
      .from("artifacts")
      .insert({
        workspace_id: workspace.id,
        type: "prd",
        title: "Untitled Spec",
        content: {},
        status: "draft",
      })
      .select()
      .single();

    if (data) {
      router.push(`/editor/${data.id}`);
    }
  }, [workspace, supabase, router]);

  useKeyboardShortcuts({
    onCommandPalette: isEditorPage ? undefined : () => setCommandPaletteOpen(true),
    onToggleSidebar: () => setSidebarCollapsed((prev) => !prev),
    onShowShortcuts: () => setShortcutsOpen(true),
    onNewArtifact: handleNewArtifact,
    onQuickEvidence: () => setEvidenceOpen(true),
  });

  return (
    <WorkspaceProvider workspace={workspace} allWorkspaces={allWorkspaces}>
      <CoachMarkProvider>
      <div className="flex h-screen">
        <AppSidebar
          workspace={workspace}
          allWorkspaces={allWorkspaces}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((prev) => !prev)}
          onCreateWorkspace={() => setNewProductOpen(true)}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        />
        <main className="flex-1 overflow-y-auto">{children}</main>

        <KeyboardShortcutsDialog
          open={shortcutsOpen}
          onClose={() => setShortcutsOpen(false)}
        />

        {workspace && (
          <AddEvidenceDialog
            open={evidenceOpen}
            onClose={() => setEvidenceOpen(false)}
            workspaceId={workspace.id}
          />
        )}

        <NewProductDialog
          open={newProductOpen}
          onClose={() => setNewProductOpen(false)}
        />

        {workspace && !isEditorPage && (
          <CommandPalette
            open={commandPaletteOpen}
            onClose={() => setCommandPaletteOpen(false)}
            context={{
              workspaceId: workspace.id,
              workspace: {
                name: workspace.name,
                productDescription: workspace.product_description,
                principles: workspace.principles,
              },
            }}
            onNewArtifact={handleNewArtifact}
            onAddEvidence={() => setEvidenceOpen(true)}
          />
        )}
      </div>
      </CoachMarkProvider>
    </WorkspaceProvider>
  );
}
