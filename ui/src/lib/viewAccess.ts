import type { IssueViewApiResponse } from "../api/types";

export type ViewAccessTone = "public" | "private" | "restricted";

export type ViewAccessMeta = {
  label: "Public" | "Private" | "Restricted";
  tone: ViewAccessTone;
};

// Normalize different backend representations (string enums or ints).
export function getViewAccessMeta(view: IssueViewApiResponse): ViewAccessMeta | null {
  if (typeof view.access === "string") {
    const normalized = view.access.toLowerCase();
    if (normalized === "public") return { label: "Public", tone: "public" };
    if (normalized === "private") return { label: "Private", tone: "private" };
    if (normalized === "restricted")
      return { label: "Restricted", tone: "restricted" };
  }

  if (typeof view.access === "number") {
    // Common mappings:
    // 0 => private, 1 => public, 2 => restricted (if available)
    if (view.access === 1) return { label: "Public", tone: "public" };
    if (view.access === 0) return { label: "Private", tone: "private" };
    if (view.access === 2) return { label: "Restricted", tone: "restricted" };
  }

  return null;
}
