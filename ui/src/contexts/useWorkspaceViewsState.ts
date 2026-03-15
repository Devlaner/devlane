import { useContext } from "react";
import { WorkspaceViewsStateContext } from "./workspaceViewsStateContextRef";
import type { WorkspaceViewsStateContextValue } from "./workspaceViewsStateContextRef";

export function useWorkspaceViewsState(): WorkspaceViewsStateContextValue {
  const ctx = useContext(WorkspaceViewsStateContext);
  if (!ctx) {
    throw new Error(
      "useWorkspaceViewsState must be used within WorkspaceViewsStateProvider",
    );
  }
  return ctx;
}

export function useWorkspaceViewsStateOrNull(): WorkspaceViewsStateContextValue | null {
  return useContext(WorkspaceViewsStateContext);
}
