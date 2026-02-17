"use client";

import { useState, useEffect, useCallback } from "react";
import type { CodebaseConnection } from "@/types";

interface CodebaseStatus {
  connection: CodebaseConnection | null;
  githubUsername: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useCodebaseStatus(pollWhileSyncing = true): CodebaseStatus {
  const [connection, setConnection] = useState<CodebaseConnection | null>(null);
  const [githubUsername, setGithubUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/codebase/status");
      if (!res.ok) throw new Error("Failed to fetch status");
      const data = await res.json();
      setConnection(data.connection);
      setGithubUsername(data.githubUsername);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Poll while syncing
  useEffect(() => {
    if (!pollWhileSyncing) return;
    if (connection?.status !== "syncing" && connection?.status !== "pending")
      return;

    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [connection?.status, pollWhileSyncing, fetchStatus]);

  return {
    connection,
    githubUsername,
    loading,
    error,
    refresh: fetchStatus,
  };
}
