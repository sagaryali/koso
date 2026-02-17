"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Trash2,
  Plus,
  Github,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { Button, Input, TextArea, Icon, Skeleton } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { RepoPicker } from "@/components/codebase/repo-picker";
import { DeleteWorkspaceDialog } from "@/components/delete-workspace-dialog";
import { useCodebaseStatus } from "@/hooks/use-codebase-status";
import { useWorkspace } from "@/lib/workspace-context";
import { createClient } from "@/lib/supabase/client";
import type { GitHubRepo } from "@/types";

export default function SettingsPage() {
  const { workspace, allWorkspaces } = useWorkspace();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [principles, setPrinciples] = useState<string[]>([]);
  const [newPrinciple, setNewPrinciple] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [artifactCount, setArtifactCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [repoPickerOpen, setRepoPickerOpen] = useState(false);
  const [archExpanded, setArchExpanded] = useState(false);
  const [archSummary, setArchSummary] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const supabase = createClient();

  const { connection, githubUsername, refresh: refreshStatus } =
    useCodebaseStatus(true);

  useEffect(() => {
    document.title = "Koso — Settings";
  }, []);

  useEffect(() => {
    if (!workspace) return;

    setName(workspace.name);
    setDescription(workspace.product_description || "");
    setPrinciples(workspace.principles || []);

    async function loadCounts() {
      const { count } = await supabase
        .from("artifacts")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspace!.id);

      setArtifactCount(count || 0);
      setLoading(false);
    }

    loadCounts();
  }, [workspace?.id]);

  // Fetch architecture summary when connection is ready
  useEffect(() => {
    if (!workspace || !connection || connection.status !== "ready") return;

    async function fetchArch() {
      const { data } = await supabase
        .from("artifacts")
        .select("content")
        .eq("workspace_id", workspace!.id)
        .eq("type", "architecture_summary")
        .single();

      if (data?.content) {
        // Extract text from tiptap content
        const text = extractTextFromContent(data.content);
        setArchSummary(text);
      }
    }

    fetchArch();
  }, [workspace, connection?.status]);

  function extractTextFromContent(content: Record<string, unknown>): string {
    if (!content || typeof content !== "object") return "";
    const doc = content as { content?: Array<{ content?: Array<{ text?: string }> }> };
    if (!doc.content) return "";
    const raw = doc.content
      .map((node) =>
        node.content?.map((child) => child.text || "").join("") || ""
      )
      .join("\n");
    return stripMarkdown(raw);
  }

  function stripMarkdown(text: string): string {
    return text
      .replace(/^#{1,6}\s+/gm, "")       // heading markers
      .replace(/\*\*\*(.+?)\*\*\*/g, "$1") // bold-italic
      .replace(/\*\*(.+?)\*\*/g, "$1")     // bold
      .replace(/\*(.+?)\*/g, "$1")         // italic
      .replace(/`(.+?)`/g, "$1")           // inline code
      .replace(/\*/g, "")                  // stray asterisks
      .replace(/`/g, "");                  // stray backticks
  }

  const saveField = useCallback(
    async (field: string, value: unknown) => {
      if (!workspace) return;
      await supabase
        .from("workspaces")
        .update({ [field]: value })
        .eq("id", workspace.id);
    },
    [workspace, supabase]
  );

  async function addPrinciple() {
    if (!newPrinciple.trim()) return;
    const updated = [...principles, newPrinciple.trim()];
    setPrinciples(updated);
    setNewPrinciple("");
    await saveField("principles", updated);
  }

  async function removePrinciple(index: number) {
    const updated = principles.filter((_, i) => i !== index);
    setPrinciples(updated);
    await saveField("principles", updated);
  }

  async function savePrincipleEdit(index: number) {
    if (!editValue.trim()) return;
    const updated = [...principles];
    updated[index] = editValue.trim();
    setPrinciples(updated);
    setEditingIndex(null);
    setEditValue("");
    await saveField("principles", updated);
  }

  async function handleConnectGitHub() {
    window.location.href = "/api/auth/github";
  }

  async function handleSelectRepo(repo: GitHubRepo) {
    setRepoPickerOpen(false);

    try {
      const res = await fetch("/api/codebase/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoFullName: repo.full_name,
          repoUrl: repo.html_url,
          defaultBranch: repo.default_branch,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Unknown error" }));
        toast({ message: `Failed to connect: ${data.error || "Unknown error"}. Retry?` });
        return;
      }

      refreshStatus();
    } catch {
      toast({ message: "Failed to connect repository. Check your connection and try again." });
    }
  }

  async function handleResync() {
    try {
      const res = await fetch("/api/codebase/sync", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Unknown error" }));
        toast({ message: `Failed to sync: ${data.error || "Unknown error"}. Retry?` });
        return;
      }
      refreshStatus();
    } catch {
      toast({ message: "Failed to sync. Check your connection and try again." });
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/codebase/disconnect", { method: "POST" });
      if (!res.ok) {
        toast({ message: "Failed to disconnect repository." });
        return;
      }
      setArchSummary(null);
      refreshStatus();
    } catch {
      toast({ message: "Failed to disconnect. Check your connection and try again." });
    } finally {
      setDisconnecting(false);
    }
  }

  const productContext = workspace
    ? [
        `Product: ${name}`,
        description ? `Description: ${description}` : null,
        principles.length > 0
          ? `Principles:\n${principles.map((p) => `- ${p}`).join("\n")}`
          : null,
        `Artifacts: ${artifactCount} total`,
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  if (loading) {
    return (
      <div className="max-w-[720px] px-12 py-10 page-transition">
        <Skeleton variant="text" width={120} height={36} />
        <div className="mt-16 space-y-5">
          <Skeleton variant="text" width={80} height={26} />
          <Skeleton variant="block" height={40} />
          <Skeleton variant="block" height={80} />
        </div>
        <div className="mt-16 space-y-5">
          <Skeleton variant="text" width={100} height={26} />
          <Skeleton variant="block" height={120} />
        </div>
      </div>
    );
  }

  const isSyncing =
    connection?.status === "syncing" || connection?.status === "pending";

  return (
    <div className="max-w-[720px] px-12 py-10 page-transition">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      {/* Product */}
      <section className="mt-16">
        <h2 className="text-lg font-medium tracking-tight">Product</h2>
        <div className="mt-6 space-y-5">
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => saveField("name", name)}
          />
          <TextArea
            label="Description"
            placeholder="Describe your product..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => saveField("product_description", description)}
          />
        </div>
      </section>

      {/* Principles */}
      <section className="mt-16">
        <h2 className="text-lg font-medium tracking-tight">Principles</h2>
        <div className="mt-6 space-y-2">
          {principles.length === 0 && (
            <p className="text-sm text-text-tertiary">
              No principles defined yet.
            </p>
          )}
          {principles.map((principle, i) => (
            <div
              key={i}
              className="flex items-center gap-2 border border-border-default px-3 py-2"
            >
              {editingIndex === i ? (
                <input
                  className="flex-1 bg-transparent text-sm focus:outline-none"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => savePrincipleEdit(i)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") savePrincipleEdit(i);
                    if (e.key === "Escape") {
                      setEditingIndex(null);
                      setEditValue("");
                    }
                  }}
                  autoFocus
                />
              ) : (
                <>
                  <span
                    className="flex-1 cursor-pointer text-sm"
                    onClick={() => {
                      setEditingIndex(i);
                      setEditValue(principle);
                    }}
                  >
                    {principle}
                  </span>
                  <button
                    onClick={() => removePrinciple(i)}
                    className="cursor-pointer text-text-tertiary hover:text-text-primary"
                  >
                    <Icon icon={Trash2} />
                  </button>
                </>
              )}
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <div className="flex-1">
              <Input
                placeholder="Add a principle..."
                value={newPrinciple}
                onChange={(e) => setNewPrinciple(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addPrinciple();
                }}
              />
            </div>
            <Button
              variant="secondary"
              icon={Plus}
              onClick={addPrinciple}
              disabled={!newPrinciple.trim()}
            >
              Add
            </Button>
          </div>
        </div>
      </section>

      {/* Connected Codebase */}
      <section className="mt-16">
        <h2 className="text-lg font-medium tracking-tight">
          Connected Codebase
        </h2>
        <div className="mt-6 border border-border-default p-6">
          {!workspace?.github_token && !githubUsername ? (
            <>
              <p className="text-sm text-text-tertiary">
                No repository connected
              </p>
              <Button
                variant="secondary"
                icon={Github}
                className="mt-4"
                onClick={handleConnectGitHub}
              >
                Connect GitHub
              </Button>
            </>
          ) : !connection ? (
            <>
              <div className="flex items-center gap-2">
                <Icon icon={Github} className="text-text-secondary" />
                <span className="text-sm font-medium">
                  Connected as {githubUsername}
                </span>
              </div>
              <Button
                variant="secondary"
                className="mt-4"
                onClick={() => setRepoPickerOpen(true)}
              >
                Select Repository
              </Button>
            </>
          ) : (
            <div className="space-y-4">
              {/* Repo info */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Icon icon={Github} className="text-text-secondary" />
                    <span className="text-sm font-medium">
                      {connection.repo_name}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-text-tertiary">
                    <span>{connection.default_branch}</span>
                    {connection.last_synced_at && (
                      <span>
                        Synced{" "}
                        {new Date(connection.last_synced_at).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          }
                        )}
                      </span>
                    )}
                    {connection.status === "ready" && (
                      <>
                        <span>{connection.file_count} files</span>
                        <span>{connection.module_count} modules</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Sync status */}
              {isSyncing && (
                <div className="flex items-center gap-2 bg-bg-secondary px-3 py-2">
                  <div className="h-2 w-2 animate-pulse bg-text-primary" />
                  <span className="text-sm text-text-secondary">
                    Indexing...{" "}
                    {connection.module_count > 0 &&
                      `${connection.module_count}/${connection.file_count} files`}
                  </span>
                </div>
              )}

              {/* Error state */}
              {connection.status === "error" && (
                <div className="flex items-start gap-2 border border-state-error bg-bg-secondary px-3 py-2">
                  <Icon
                    icon={AlertCircle}
                    className="mt-0.5 shrink-0 text-state-error"
                  />
                  <div>
                    <p className="text-sm text-state-error">
                      {connection.error_message || "Indexing failed"}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-1 text-xs"
                      onClick={handleResync}
                    >
                      Retry
                    </Button>
                  </div>
                </div>
              )}

              {/* Architecture summary */}
              {archSummary && connection.status === "ready" && (
                <div className="border-t border-border-subtle pt-4">
                  <button
                    onClick={() => setArchExpanded(!archExpanded)}
                    className="flex w-full cursor-pointer items-center gap-1 text-sm font-medium text-text-primary"
                  >
                    <Icon
                      icon={archExpanded ? ChevronDown : ChevronRight}
                      className="text-text-tertiary"
                    />
                    Architecture Summary
                  </button>
                  {archExpanded && (
                    <div className="mt-3 max-h-[400px] overflow-y-auto bg-bg-secondary p-4 text-sm whitespace-pre-wrap text-text-secondary">
                      {archSummary}
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 border-t border-border-subtle pt-4">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={RefreshCw}
                  onClick={handleResync}
                  disabled={isSyncing}
                >
                  Re-sync
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={isSyncing || disconnecting}
                >
                  Disconnect
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Product Context */}
      <section className="mt-16">
        <h2 className="text-lg font-medium tracking-tight">
          Product Context
        </h2>
        <p className="mt-2 text-sm text-text-secondary">
          This is the base context used for all AI calls.
        </p>
        <div className="mt-4">
          <textarea
            className="w-full resize-none border border-border-default bg-bg-secondary px-3 py-2.5 text-sm text-text-secondary focus:outline-none"
            value={productContext}
            readOnly
            rows={Math.max(4, productContext.split("\n").length + 1)}
          />
        </div>
      </section>

      {/* Danger Zone */}
      <section className="mt-16 border border-state-error p-6">
        <h2 className="text-lg font-medium tracking-tight">Danger Zone</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Permanently delete this product and all its data.
        </p>
        <Button
          variant="danger"
          size="sm"
          className="mt-4"
          onClick={() => setDeleteOpen(true)}
        >
          Delete Product
        </Button>
      </section>

      {/* Repo Picker */}
      <RepoPicker
        open={repoPickerOpen}
        onClose={() => setRepoPickerOpen(false)}
        onSelect={handleSelectRepo}
      />

      {/* Delete Workspace Dialog */}
      {workspace && (
        <DeleteWorkspaceDialog
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          workspace={workspace}
          allWorkspaces={allWorkspaces}
        />
      )}
    </div>
  );
}
