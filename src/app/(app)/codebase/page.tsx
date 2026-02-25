"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Code, FileText } from "lucide-react";
import { Button, Input, Icon, Badge, Skeleton } from "@/components/ui";
import { useCodebaseStatus } from "@/hooks/use-codebase-status";
import type { CodebaseModule } from "@/types";

export default function CodebasePage() {
  const router = useRouter();
  const { connection, connections, loading } = useCodebaseStatus(true);
  const [modules, setModules] = useState<CodebaseModule[]>([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string | null>(null);
  const [modulesLoading, setModulesLoading] = useState(false);

  useEffect(() => {
    document.title = "Koso — Codebase";
  }, []);

  const anyReady = connections.some((c) => c.status === "ready");

  useEffect(() => {
    if (!anyReady) return;

    async function fetchModules() {
      setModulesLoading(true);
      try {
        const res = await fetch("/api/codebase");
        if (!res.ok) return;
        const data = await res.json();
        setModules(data.modules || []);
      } catch (err) {
        console.error("Failed to fetch modules:", err);
      } finally {
        setModulesLoading(false);
      }
    }

    fetchModules();
  }, [anyReady]);

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
            Connect a GitHub repo to get technical feasibility insights as you write
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

  const moduleTypes = [
    ...new Set(modules.map((m) => m.module_type).filter(Boolean)),
  ] as string[];

  const filtered = modules.filter((mod) => {
    const matchesSearch =
      !search ||
      mod.file_path.toLowerCase().includes(search.toLowerCase()) ||
      mod.module_name?.toLowerCase().includes(search.toLowerCase()) ||
      mod.summary?.toLowerCase().includes(search.toLowerCase());

    const matchesType = !filterType || mod.module_type === filterType;

    return matchesSearch && matchesType;
  });

  return (
    <div className="px-12 py-10 page-transition">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Codebase</h1>
          <p className="mt-1 text-sm text-text-tertiary">
            {connections.filter((c) => c.status === "ready").map((c) => c.repo_name).join(", ")} &middot; {modules.length} modules
          </p>
        </div>
      </div>

      {/* Search and filter */}
      <div className="mt-6 flex items-center gap-3">
        <div className="flex-1">
          <Input
            placeholder="Search files, modules, or summaries..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Type filters */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => setFilterType(null)}
          className={`cursor-pointer px-2 py-1 text-xs font-medium ${
            filterType === null
              ? "bg-bg-inverse text-text-inverse"
              : "bg-bg-tertiary text-text-secondary hover:bg-bg-hover"
          }`}
        >
          All
        </button>
        {moduleTypes.map((type) => (
          <button
            key={type}
            onClick={() =>
              setFilterType(filterType === type ? null : type)
            }
            className={`cursor-pointer px-2 py-1 text-xs font-medium ${
              filterType === type
                ? "bg-bg-inverse text-text-inverse"
                : "bg-bg-tertiary text-text-secondary hover:bg-bg-hover"
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Module list */}
      <div className="mt-6 space-y-px">
        {modulesLoading ? (
          <div className="space-y-3">
            <Skeleton variant="list" lines={6} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center border border-border-default py-12">
            <p className="text-sm text-text-tertiary">
              {search || filterType
                ? "No matching modules. Try different search terms."
                : "No modules indexed yet"}
            </p>
          </div>
        ) : (
          filtered.map((mod) => (
            <div
              key={mod.id}
              className="border-b border-border-subtle px-0 py-3"
            >
              <div className="flex items-start gap-2">
                <Icon
                  icon={mod.module_type === "component" ? Code : FileText}
                  className="mt-0.5 shrink-0 text-text-tertiary"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {mod.file_path}
                    </span>
                    {mod.module_type && (
                      <Badge>{mod.module_type}</Badge>
                    )}
                    {mod.language && (
                      <span className="text-xs text-text-tertiary">
                        {mod.language}
                      </span>
                    )}
                  </div>
                  {mod.summary && (
                    <p className="mt-1 text-sm text-text-secondary">
                      {mod.summary}
                    </p>
                  )}
                  {mod.exports && mod.exports.length > 0 && (
                    <p className="mt-1 truncate text-xs text-text-tertiary">
                      Exports: {mod.exports.join(", ")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
