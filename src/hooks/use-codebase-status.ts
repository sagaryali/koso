"use client";

import { useState, useEffect, useCallback } from "react";
import type { CodebaseConnection } from "@/types";

interface CodebaseStatus {
  connection: CodebaseConnection | null;
  connections: CodebaseConnection[];
  githubUsername: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useCodebaseStatus(pollWhileSyncing = true): CodebaseStatus {
  const [connection, setConnection] = useState<CodebaseConnection | null>(null);
  const [connections, setConnections] = useState<CodebaseConnection[]>([]);
  const [githubUsername, setGithubUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/codebase/status");
      if (!res.ok) throw new Error("Failed to fetch status");
      const data = await res.json();
      setConnection(data.connection);
      setConnections(data.connections ?? []);
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

  // Poll while any connection is syncing
  useEffect(() => {
    if (!pollWhileSyncing) return;
    const anySyncing = connections.some(
      (c) => c.status === "syncing" || c.status === "pending"
    );
    if (!anySyncing) return;

    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [connections, pollWhileSyncing, fetchStatus]);

  return {
    connection,
    connections,
    githubUsername,
    loading,
    error,
    refresh: fetchStatus,
  };
}
