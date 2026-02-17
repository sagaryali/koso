"use client";

import { createContext, useContext } from "react";
import type { Workspace } from "@/types";

interface WorkspaceContextValue {
  workspace: Workspace | null;
  allWorkspaces: Workspace[];
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  workspace: null,
  allWorkspaces: [],
});

export function WorkspaceProvider({
  workspace,
  allWorkspaces,
  children,
}: WorkspaceContextValue & { children: React.ReactNode }) {
  return (
    <WorkspaceContext.Provider value={{ workspace, allWorkspaces }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
