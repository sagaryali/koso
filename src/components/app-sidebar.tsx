"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Home,
  Search,
  FileText,
  Code,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Plus,
  File,
  LogOut,
  MoreVertical,
} from "lucide-react";
import { Button, Icon, KosoMark } from "@/components/ui";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { NewSpecDialog } from "@/components/new-spec-dialog";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  setActiveWorkspaceCookie,
  clearActiveWorkspaceCookie,
} from "@/lib/workspace-cookie";
import { useCodebaseStatus } from "@/hooks/use-codebase-status";
import type { Workspace, Artifact } from "@/types";

interface AppSidebarProps {
  workspace: Workspace | null;
  allWorkspaces: Workspace[];
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onCreateWorkspace?: () => void;
  onOpenCommandPalette?: () => void;
}

const navItems = [
  { label: "Home", icon: Home, href: "/home" },
  { label: "Investigate", icon: Search, href: "/investigate" },
  { label: "Evidence", icon: FileText, href: "/evidence" },
  { label: "Codebase", icon: Code, href: "/codebase" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

export function AppSidebar({
  workspace,
  allWorkspaces,
  collapsed: controlledCollapsed,
  onToggleCollapsed,
  onCreateWorkspace,
  onOpenCommandPalette,
}: AppSidebarProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = controlledCollapsed ?? internalCollapsed;
  const toggleCollapsed = onToggleCollapsed ?? (() => setInternalCollapsed((prev) => !prev));
  const [specs, setSpecs] = useState<Artifact[]>([]);
  const [newSpecOpen, setNewSpecOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const { connection } = useCodebaseStatus(true);

  useEffect(() => {
    if (!workspace) return;

    async function fetchSpecs() {
      const { data } = await supabase
        .from("artifacts")
        .select("*")
        .eq("workspace_id", workspace!.id)
        .in("type", ["prd", "user_story"])
        .order("updated_at", { ascending: false });

      if (data) setSpecs(data);
    }

    fetchSpecs();
  }, [workspace, pathname]);

  async function handleLogout() {
    clearActiveWorkspaceCookie();
    await supabase.auth.signOut();
    router.push("/login");
  }

  function handleNewSpec() {
    if (!workspace) return;
    setNewSpecOpen(true);
  }

  async function handleDeleteSpec(specId: string) {
    const spec = specs.find((s) => s.id === specId);
    await supabase.from("artifacts").delete().eq("id", specId);
    setSpecs((prev) => prev.filter((s) => s.id !== specId));

    if (pathname === `/editor/${specId}`) {
      router.push("/home");
    }

    toast({
      message: `Deleted "${spec?.title || "Untitled"}"`,
    });
  }

  function handleSwitchWorkspace(workspaceId: string) {
    setActiveWorkspaceCookie(workspaceId);
    router.refresh();
  }

  const workspaceSwitcherItems = [
    ...allWorkspaces.map((ws) => ({
      label: ws.name,
      onClick: () => handleSwitchWorkspace(ws.id),
      active: ws.id === workspace?.id,
      separator: false,
    })),
    {
      label: "+ New Product",
      onClick: () => onCreateWorkspace?.(),
      active: false,
      separator: true,
    },
  ];

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-border-default bg-bg-secondary transition-[width] duration-200 ease-out",
        collapsed ? "w-14" : "w-[240px]"
      )}
    >
      {/* Header: workspace switcher + collapse toggle */}
      <div className="flex items-center justify-between border-b border-border-default p-4">
        {collapsed ? (
          <button
            onClick={toggleCollapsed}
            className="mx-auto flex cursor-pointer items-center justify-center hover:opacity-70"
            title="Expand sidebar"
          >
            <KosoMark size={20} />
          </button>
        ) : (
          <DropdownMenu
            trigger={
              <div className="flex cursor-pointer items-center gap-1.5 hover:opacity-70">
                <KosoMark size={18} className="shrink-0" />
                <span className="truncate text-base font-bold tracking-tight">
                  {workspace?.name || "Koso"}
                </span>
                <Icon
                  icon={ChevronsUpDown}
                  size={14}
                  className="shrink-0 text-text-tertiary"
                />
              </div>
            }
            items={workspaceSwitcherItems}
          />
        )}
        {!collapsed && (
          <button
            onClick={toggleCollapsed}
            className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center hover:bg-bg-hover"
          >
            <Icon
              icon={ChevronLeft}
              className="text-text-tertiary"
            />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3">
        <div className="space-y-0.5 px-2" data-tour="sidebar-nav">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              pathname.startsWith(item.href + "/");
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={cn(
                  "flex w-full items-center gap-2.5 px-2 py-2 text-sm font-medium transition-none cursor-pointer",
                  isActive
                    ? "bg-bg-inverse text-text-inverse"
                    : "text-text-primary hover:bg-bg-hover",
                  collapsed && "justify-center"
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon
                  icon={item.icon}
                  className={
                    isActive ? "text-text-inverse" : "text-text-tertiary"
                  }
                />
                {!collapsed && (
                  <span className="flex flex-1 items-center justify-between">
                    <span>{item.label}</span>
                    {item.label === "Codebase" && connection && (
                      <span
                        className={cn(
                          "inline-block h-1.5 w-1.5",
                          connection.status === "syncing" ||
                            connection.status === "pending"
                            ? "animate-pulse bg-text-primary"
                            : connection.status === "ready"
                              ? "bg-text-primary"
                              : connection.status === "error"
                                ? "bg-state-error"
                                : ""
                        )}
                      />
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Specs section */}
        {!collapsed && (
          <div className="mt-6" data-tour="sidebar-specs">
            <div className="px-4 pb-2 text-[11px] font-medium uppercase tracking-caps text-text-tertiary">
              Specs
            </div>
            <div className="space-y-0.5 px-2">
              {specs.length === 0 && (
                <div className="px-2 py-3 text-sm text-text-tertiary">
                  No specs yet. Click + to start.
                </div>
              )}
              {specs.map((spec) => {
                const isActive = pathname === `/editor/${spec.id}`;
                return (
                  <div
                    key={spec.id}
                    className={cn(
                      "group flex w-full items-center gap-2 px-2 py-1.5 text-sm font-normal transition-none",
                      isActive ? "bg-bg-hover" : "hover:bg-bg-hover"
                    )}
                  >
                    <button
                      onClick={() => router.push(`/editor/${spec.id}`)}
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-2"
                    >
                      <Icon icon={File} className="shrink-0 text-text-tertiary" />
                      <span className="truncate">{spec.title}</span>
                    </button>
                    <DropdownMenu
                      align="right"
                      trigger={
                        <div className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center opacity-0 transition-none group-hover:opacity-100">
                          <Icon icon={MoreVertical} size={14} className="text-text-tertiary" />
                        </div>
                      }
                      items={[
                        {
                          label: "Delete",
                          onClick: () => handleDeleteSpec(spec.id),
                        },
                      ]}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Command palette hint */}
      <div className="px-3 pb-2">
        {collapsed ? (
          <button
            onClick={onOpenCommandPalette}
            className="flex h-9 w-full cursor-pointer items-center justify-center border border-border-default bg-bg-tertiary text-text-tertiary hover:border-border-strong hover:text-text-secondary"
            title="Ask anything (⌘K)"
          >
            <Icon icon={Search} size={14} />
          </button>
        ) : (
          <button
            onClick={onOpenCommandPalette}
            className="flex w-full cursor-pointer items-center gap-2 border border-border-default bg-bg-tertiary px-2.5 py-2 text-sm text-text-tertiary hover:border-border-strong hover:text-text-secondary"
          >
            <Icon icon={Search} size={14} className="shrink-0" />
            <span className="flex-1 text-left">Ask anything...</span>
            <kbd className="text-[11px] font-medium tracking-wide text-text-tertiary">⌘K</kbd>
          </button>
        )}
      </div>

      {/* Footer: New Spec + Logout */}
      <div className="border-t border-border-default p-3">
        {collapsed ? (
          <div className="space-y-1">
            <button
              onClick={handleNewSpec}
              className="flex h-9 w-full cursor-pointer items-center justify-center hover:bg-bg-hover"
              title="New Spec"
            >
              <Icon icon={Plus} />
            </button>
            <button
              onClick={handleLogout}
              className="flex h-9 w-full cursor-pointer items-center justify-center hover:bg-bg-hover"
              title="Log out"
            >
              <Icon icon={LogOut} className="text-text-tertiary" />
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={handleNewSpec}
              className="w-full"
              data-tour="sidebar-new-spec"
            >
              New Spec
            </Button>
            <button
              onClick={handleLogout}
              className="flex w-full cursor-pointer items-center gap-2 px-2 py-1.5 text-sm text-text-tertiary hover:text-text-primary"
            >
              <Icon icon={LogOut} size={14} />
              Log out
            </button>
          </div>
        )}
      </div>
      {workspace && (
        <NewSpecDialog
          open={newSpecOpen}
          onClose={() => setNewSpecOpen(false)}
          workspaceId={workspace.id}
          onCreated={(spec) => {
            setSpecs((prev) => [spec as Artifact, ...prev]);
          }}
        />
      )}
    </aside>
  );
}
