"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Code,
  FileText,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { Button, Input, Icon, Badge, Skeleton, Tooltip } from "@/components/ui";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { useCodebaseStatus } from "@/hooks/use-codebase-status";
import type { CodebaseModule } from "@/types";

// Group modules by parent directory to create "feature areas"
function groupModulesByArea(modules: CodebaseModule[]): Map<string, CodebaseModule[]> {
  const groups = new Map<string, CodebaseModule[]>();

  for (const mod of modules) {
    // Extract feature area from file path
    // e.g., "src/components/auth/login.tsx" → "Auth"
    // e.g., "src/app/api/users/route.ts" → "API / Users"
    const parts = mod.file_path.split("/").filter(Boolean);

    let area: string;
    if (parts.length <= 1) {
      area = "Root";
    } else if (parts[0] === "src" && parts.length >= 3) {
      // src/components/auth → "Auth"
      // src/app/api/users → "API / Users"
      // src/lib/utils → "Lib / Utils"
      const relevantParts = parts.slice(1);
      if (relevantParts[0] === "app" && relevantParts[1] === "api") {
        area = relevantParts.length > 2
          ? `API / ${capitalize(relevantParts[2])}`
          : "API";
      } else if (relevantParts[0] === "app") {
        area = relevantParts.length > 1
          ? capitalize(relevantParts[1].replace(/[()]/g, ""))
          : "App";
      } else {
        area = relevantParts.length > 1
          ? capitalize(relevantParts[1])
          : capitalize(relevantParts[0]);
      }
    } else {
      area = capitalize(parts[Math.min(1, parts.length - 1)]);
    }

    if (!groups.has(area)) {
      groups.set(area, []);
    }
    groups.get(area)!.push(mod);
  }

  return groups;
}

function capitalize(s: string): string {
  return s
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getLanguages(modules: CodebaseModule[]): string[] {
  const langs = new Set<string>();
  for (const m of modules) {
    if (m.language) langs.add(m.language);
  }
  return [...langs];
}

function hasTestFiles(modules: CodebaseModule[]): boolean {
  return modules.some(
    (m) =>
      m.file_path.includes(".test.") ||
      m.file_path.includes(".spec.") ||
      m.file_path.includes("__tests__") ||
      m.module_type === "test"
  );
}

export default function CodebasePage() {
  const router = useRouter();
  const { workspace } = useWorkspace();
  const supabase = createClient();
  const { connection, connections, loading } = useCodebaseStatus(true);

  const [modules, setModules] = useState<CodebaseModule[]>([]);
  const [search, setSearch] = useState("");
  const [modulesLoading, setModulesLoading] = useState(false);
  const [archSummary, setArchSummary] = useState<string | null>(null);
  const [archExpanded, setArchExpanded] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [resyncing, setResyncing] = useState(false);

  useEffect(() => {
    document.title = "Koso — Codebase";
  }, []);

  const anyReady = connections.some((c) => c.status === "ready");

  useEffect(() => {
    if (!anyReady || !workspace) return;

    async function fetchData() {
      setModulesLoading(true);
      try {
        const [modulesRes, { data: archArtifacts }] = await Promise.all([
          fetch("/api/codebase"),
          supabase
            .from("artifacts")
            .select("content")
            .eq("workspace_id", workspace!.id)
            .eq("type", "architecture_summary")
            .limit(1),
        ]);

        if (modulesRes.ok) {
          const data = await modulesRes.json();
          setModules(data.modules || []);
        }

        if (archArtifacts && archArtifacts.length > 0) {
          const content = archArtifacts[0].content;
          if (typeof content === "string") {
            setArchSummary(content);
          } else if (content && typeof content === "object") {
            // Extract text from TipTap JSON
            const parts: string[] = [];
            function walk(node: Record<string, unknown>) {
              if (node.text && typeof node.text === "string") {
                parts.push(node.text);
              }
              if (Array.isArray(node.content)) {
                for (const child of node.content) {
                  walk(child as Record<string, unknown>);
                }
              }
            }
            walk(content as Record<string, unknown>);
            setArchSummary(parts.join("\n"));
          }
        }
      } catch (err) {
        console.error("Failed to fetch codebase data:", err);
      } finally {
        setModulesLoading(false);
      }
    }

    fetchData();
  }, [anyReady, workspace?.id]);

  // Group modules by feature area
  const grouped = useMemo(() => groupModulesByArea(modules), [modules]);

  // Filter groups by search
  const filteredGroups = useMemo(() => {
    if (!search.trim()) return grouped;

    const filtered = new Map<string, CodebaseModule[]>();
    const q = search.toLowerCase();

    for (const [area, mods] of grouped) {
      if (area.toLowerCase().includes(q)) {
        filtered.set(area, mods);
        continue;
      }
      const matchingMods = mods.filter(
        (m) =>
          m.file_path.toLowerCase().includes(q) ||
          m.module_name?.toLowerCase().includes(q) ||
          m.summary?.toLowerCase().includes(q)
      );
      if (matchingMods.length > 0) {
        filtered.set(area, matchingMods);
      }
    }

    return filtered;
  }, [grouped, search]);

  // Sort groups by module count descending
  const sortedGroups = useMemo(
    () =>
      [...filteredGroups.entries()].sort(
        ([, a], [, b]) => b.length - a.length
      ),
    [filteredGroups]
  );

  function toggleGroup(area: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(area)) next.delete(area);
      else next.add(area);
      return next;
    });
  }

  async function handleResync() {
    if (!connection || resyncing) return;
    setResyncing(true);
    try {
      await fetch("/api/codebase/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: connection.id }),
      });
      router.refresh();
    } catch {
      // ignore
    } finally {
      setResyncing(false);
    }
  }

  if (loading) {
    return (
      <div className="px-12 py-10 page-transition">
        <Skeleton variant="text" width={140} height={36} />
        <div className="mt-6">
          <Skeleton variant="block" height={40} />
        </div>
        <div className="mt-6 space-y-3">
          <Skeleton variant="list" lines={5} />
        </div>
      </div>
    );
  }

  if (connections.length === 0) {
    return (
      <div className="px-12 py-10 page-transition">
        <h1 className="text-2xl font-bold tracking-tight">Codebase</h1>
        <div className="mt-8 flex flex-col items-center border border-border-default py-12">
          <Icon icon={Code} size={24} className="text-text-tertiary" />
          <p className="mt-3 text-sm text-text-tertiary">
            Connect a GitHub repo to get technical feasibility insights as you
            write
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={() => router.push("/settings")}
          >
            Go to Settings
          </Button>
        </div>
      </div>
    );
  }

  const syncing = connections.filter(
    (c) => c.status === "syncing" || c.status === "pending"
  );

  if (!anyReady && syncing.length > 0) {
    return (
      <div className="px-12 py-10">
        <h1 className="text-2xl font-bold tracking-tight">Codebase</h1>
        {syncing.map((c) => (
          <div key={c.id} className="mt-6 flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse bg-text-primary" />
            <span className="text-sm text-text-secondary">
              Indexing {c.repo_name}...{" "}
              {c.module_count > 0 &&
                `${c.module_count}/${c.file_count} files`}
            </span>
          </div>
        ))}
      </div>
    );
  }

  const readyConnections = connections.filter((c) => c.status === "ready");
  const lastSynced = readyConnections[0]?.last_synced_at;

  return (
    <div className="px-12 py-10 page-transition">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Codebase</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Your connected repositories, indexed for context-aware specs.
          </p>
          <p className="mt-1 text-xs text-text-tertiary">
            {modules.length} modules across{" "}
            {readyConnections.map((c) => c.repo_name).join(", ")}
          </p>
        </div>
        {lastSynced && (
          <div className="flex items-center gap-2 text-xs text-text-tertiary">
            <span>
              Last synced:{" "}
              {new Date(lastSynced).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <button
              onClick={handleResync}
              disabled={resyncing}
              className={cn(
                "cursor-pointer p-1 hover:text-text-secondary",
                resyncing && "animate-spin"
              )}
              title="Re-sync"
            >
              <Icon icon={RefreshCw} size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Section 1: Architecture Overview */}
      {archSummary && (
        <section className="mt-8">
          <button
            onClick={() => setArchExpanded(!archExpanded)}
            className="flex w-full cursor-pointer items-center gap-1.5 text-left"
          >
            <Icon
              icon={archExpanded ? ChevronDown : ChevronRight}
              size={14}
              className="text-text-tertiary"
            />
            <span className="text-[11px] font-medium uppercase tracking-caps text-text-tertiary">
              Architecture Overview
            </span>
          </button>
          {archExpanded && (
            <div className="mt-3 border border-border-default bg-bg-secondary p-5 text-sm leading-relaxed whitespace-pre-wrap text-text-secondary">
              {archSummary}
            </div>
          )}
        </section>
      )}

      {/* Section 2: Product Capabilities (grouped modules) */}
      <section className="mt-10">
        <div className="text-[11px] font-medium uppercase tracking-caps text-text-tertiary">
          Product Capabilities
        </div>

        <div className="mt-3">
          <Input
            placeholder="Search by feature area, file, or summary..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="mt-4 space-y-2">
          {modulesLoading ? (
            <div className="space-y-3">
              <Skeleton variant="list" lines={6} />
            </div>
          ) : sortedGroups.length === 0 ? (
            <div className="flex flex-col items-center border border-border-default py-12">
              <p className="text-sm text-text-tertiary">
                {search
                  ? "No matching capabilities. Try different search terms."
                  : "No modules indexed yet."}
              </p>
            </div>
          ) : (
            sortedGroups.map(([area, mods]) => {
              const isExpanded = expandedGroups.has(area);
              const languages = getLanguages(mods);
              const hasTests = hasTestFiles(mods);

              return (
                <div
                  key={area}
                  className="border border-border-default"
                >
                  <button
                    onClick={() => toggleGroup(area)}
                    className="flex w-full cursor-pointer items-center gap-3 p-4 text-left hover:bg-bg-hover"
                  >
                    <Icon
                      icon={isExpanded ? ChevronDown : ChevronRight}
                      size={14}
                      className="shrink-0 text-text-tertiary"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text-primary">
                          {area}
                        </span>
                        <span className="text-xs text-text-tertiary">
                          {mods.length} module{mods.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        {languages.slice(0, 3).map((lang) => (
                          <span
                            key={lang}
                            className="bg-bg-tertiary px-1.5 py-0.5 text-[10px] text-text-tertiary"
                          >
                            {lang}
                          </span>
                        ))}
                        {hasTests && (
                          <Tooltip
                            content="Contains test or spec files (.test., .spec., __tests__)"
                            position="bottom"
                          >
                            <span className="bg-bg-tertiary px-1.5 py-0.5 text-[10px] text-text-tertiary">
                              Tested
                            </span>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border-default bg-bg-secondary">
                      {mods.map((mod) => (
                        <div
                          key={mod.id}
                          className="border-b border-border-subtle px-4 py-3 last:border-0"
                        >
                          <div className="flex items-start gap-2">
                            <Icon
                              icon={
                                mod.module_type === "component"
                                  ? Code
                                  : FileText
                              }
                              className="mt-0.5 shrink-0 text-text-tertiary"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-xs font-medium">
                                  {mod.file_path}
                                </span>
                                {mod.module_type && (
                                  <Badge>{mod.module_type}</Badge>
                                )}
                              </div>
                              {mod.summary && (
                                <p className="mt-1 text-xs text-text-secondary">
                                  {mod.summary}
                                </p>
                              )}
                              {mod.exports && mod.exports.length > 0 && (
                                <p className="mt-1 truncate text-[11px] text-text-tertiary">
                                  Exports: {mod.exports.join(", ")}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Section 3: Connected Repositories */}
      <section className="mt-10">
        <div className="text-[11px] font-medium uppercase tracking-caps text-text-tertiary">
          Connected Repositories
        </div>
        <div className="mt-3 space-y-2">
          {connections.map((conn) => (
            <div
              key={conn.id}
              className="flex items-center justify-between border border-border-default px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "h-2 w-2",
                    conn.status === "ready"
                      ? "bg-text-primary"
                      : conn.status === "syncing" || conn.status === "pending"
                        ? "animate-pulse bg-text-primary"
                        : conn.status === "error"
                          ? "bg-state-error"
                          : "bg-text-tertiary"
                  )}
                />
                <span className="text-sm font-medium">{conn.repo_name}</span>
                <span className="text-xs text-text-tertiary">
                  {conn.module_count} modules
                </span>
              </div>
              <span className="text-xs text-text-tertiary">
                {conn.status === "ready"
                  ? "Ready"
                  : conn.status === "syncing"
                    ? "Syncing..."
                    : conn.status === "pending"
                      ? "Pending..."
                      : conn.status === "error"
                        ? "Error"
                        : conn.status}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/settings")}
          >
            Manage in Settings
          </Button>
        </div>
      </section>
    </div>
  );
}
