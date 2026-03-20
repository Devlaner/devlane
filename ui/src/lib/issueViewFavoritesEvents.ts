/** Dispatched after the user favorites/unfavorites a saved issue view (project or workspace scope). */
export const ISSUE_VIEW_FAVORITES_CHANGED_EVENT = "issue-view-favorites-changed";

export type IssueViewFavoritesChangedDetail = {
  workspaceSlug: string;
};
