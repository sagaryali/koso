"use client";

import { useState, useEffect } from "react";
import { Lock, Globe } from "lucide-react";
import { Dialog, Input, Icon } from "@/components/ui";
import type { GitHubRepo } from "@/types";

interface RepoPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (repo: GitHubRepo) => void;
  connectedRepoNames?: string[];
}

export function RepoPicker({ open, onClose, onSelect, connectedRepoNames = [] }: RepoPickerProps) {
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    async function fetchRepos() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/codebase/repos");
        if (!res.ok) throw new Error("Failed to fetch repos");
        const data = await res.json();
        setRepos(data.repos || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load repos");
      } finally {
        setLoading(false);
      }
    }

    fetchRepos();
  }, [open]);

  const connectedSet = new Set(connectedRepoNames);

  const filtered = repos.filter((repo) => {
    if (connectedSet.has(repo.full_name)) return false;
    const q = search.toLowerCase();
    return (
      repo.full_name.toLowerCase().includes(q) ||
      repo.description?.toLowerCase().includes(q)
    );
  });

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "today";
    if (diffDays === 1) return "yesterday";
    if (diffDays < 30) return `${diffDays}d ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
  }

  return (
    <Dialog open={open} onClose={onClose} className="max-w-xl">
      <h2 className="text-lg font-medium tracking-tight">
        Select a repository
      </h2>
      <p className="mt-1 text-sm text-text-secondary">
        Choose a GitHub repository to connect to your workspace.
      </p>

      <div className="mt-4">
        <Input
          placeholder="Search repositories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="mt-4 max-h-[400px] overflow-y-auto border border-border-default">
        {loading && (
          <div className="p-6 text-center text-sm text-text-tertiary">
            Loading repositories...
          </div>
        )}

        {error && (
          <div className="p-6 text-center text-sm text-state-error">
            {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="p-6 text-center text-sm text-text-tertiary">
            {search ? "No matching repositories" : "No repositories found"}
          </div>
        )}

        {filtered.map((repo) => (
          <button
            key={repo.id}
            onClick={() => onSelect(repo)}
            className="flex w-full cursor-pointer items-start gap-3 border-b border-border-subtle px-4 py-3 text-left hover:bg-bg-hover last:border-b-0"
          >
            <Icon
              icon={repo.private ? Lock : Globe}
              className="mt-0.5 shrink-0 text-text-tertiary"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">
                  {repo.full_name}
                </span>
              </div>
              {repo.description && (
                <p className="mt-0.5 truncate text-sm text-text-secondary">
                  {repo.description}
                </p>
              )}
              <div className="mt-1 flex items-center gap-3 text-xs text-text-tertiary">
                {repo.language && <span>{repo.language}</span>}
                <span>Updated {formatDate(repo.updated_at)}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </Dialog>
  );
}
