import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { ArchiveRestore } from 'lucide-react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { issueService } from '../services/issueService';
import { projectService } from '../services/projectService';
import type { IssueApiResponse, ProjectApiResponse } from '../api/types';

const ARCHIVES_PAGE_SIZE = 50;

function formatArchivedAt(iso: string | null | undefined): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  return new Date(t).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function ArchivesPage() {
  const { t } = useTranslation();
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  useDocumentTitle(t('archives.documentTitle', 'Archives'));

  const [issues, setIssues] = useState<IssueApiResponse[]>([]);
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);
  const [archivedProjects, setArchivedProjects] = useState<ProjectApiResponse[]>([]);
  const [restoringProjectId, setRestoringProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  // Server-side fetch position; tracked separately from issues.length so that
  // restoring an item (which removes it from the list) doesn't skew the next
  // page's offset.
  const [fetchedCount, setFetchedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceSlug) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      // Fetch one extra to detect whether more pages exist.
      issueService.listWorkspaceArchived(workspaceSlug, { limit: ARCHIVES_PAGE_SIZE + 1 }),
      projectService.list(workspaceSlug).catch(() => [] as ProjectApiResponse[]),
      projectService.listArchived(workspaceSlug).catch(() => [] as ProjectApiResponse[]),
    ])
      .then(([archived, projs, archProjs]) => {
        if (cancelled) return;
        const page = archived.slice(0, ARCHIVES_PAGE_SIZE);
        setHasMore(archived.length > ARCHIVES_PAGE_SIZE);
        setIssues(page);
        setFetchedCount(page.length);
        setProjects(projs ?? []);
        setArchivedProjects(archProjs ?? []);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError(t('archives.loadError', 'Could not load archived work items.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, t]);

  const loadMore = async () => {
    if (!workspaceSlug || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await issueService.listWorkspaceArchived(workspaceSlug, {
        limit: ARCHIVES_PAGE_SIZE + 1,
        offset: fetchedCount,
      });
      const page = next.slice(0, ARCHIVES_PAGE_SIZE);
      setHasMore(next.length > ARCHIVES_PAGE_SIZE);
      setFetchedCount((c) => c + page.length);
      // De-dup by id in case a restore shifted the server-side window.
      setIssues((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...page.filter((i) => !seen.has(i.id))];
      });
    } catch {
      setError(t('archives.loadMoreError', 'Could not load more archived work items.'));
    } finally {
      setLoadingMore(false);
    }
  };

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const restore = async (issue: IssueApiResponse) => {
    if (!workspaceSlug || restoringId) return;
    setRestoringId(issue.id);
    try {
      await issueService.restore(workspaceSlug, issue.project_id, issue.id);
      setIssues((prev) => prev.filter((i) => i.id !== issue.id));
    } catch {
      setError(t('archives.restoreItemError', 'Could not restore that work item.'));
    } finally {
      setRestoringId(null);
    }
  };

  const restoreProject = async (project: ProjectApiResponse) => {
    if (!workspaceSlug || restoringProjectId) return;
    setRestoringProjectId(project.id);
    try {
      await projectService.restore(workspaceSlug, project.id);
      setArchivedProjects((prev) => prev.filter((p) => p.id !== project.id));
    } catch {
      setError(t('archives.restoreProjectError', 'Could not restore that project.'));
    } finally {
      setRestoringProjectId(null);
    }
  };

  const displayId = (issue: IssueApiResponse) => {
    const p = projectById.get(issue.project_id);
    const prefix = p?.identifier ?? p?.id.slice(0, 8) ?? issue.project_id.slice(0, 8);
    return `${prefix}-${issue.sequence_id ?? issue.id.slice(-4)}`;
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-semibold text-(--txt-primary)">
          {t('archives.title', 'Archives')}
        </h1>
        <p className="mt-0.5 text-sm text-(--txt-secondary)">
          {t(
            'archives.subtitle',
            'Archived work items across this workspace. Restore one to bring it back to its project.',
          )}
        </p>
      </div>

      {error && (
        <p className="rounded-(--radius-md) bg-(--bg-danger-subtle) px-3 py-2 text-sm text-(--txt-danger-primary)">
          {error}
        </p>
      )}

      {!loading && archivedProjects.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-(--txt-secondary)">
            {t('archives.archivedProjects', 'Archived projects')}
          </h2>
          <ul className="divide-y divide-(--border-subtle) overflow-hidden rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1)">
            {archivedProjects.map((project) => (
              <li
                key={project.id}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-(--bg-layer-1-hover)"
              >
                <span className="min-w-0 flex-1 truncate font-medium text-(--txt-primary)">
                  {project.name}
                </span>
                <span className="shrink-0 text-xs text-(--txt-tertiary)">
                  {t('archives.archivedOn', 'Archived {{date}}', {
                    date: formatArchivedAt(project.archived_at),
                  })}
                </span>
                <button
                  type="button"
                  onClick={() => void restoreProject(project)}
                  disabled={restoringProjectId === project.id}
                  className="inline-flex shrink-0 items-center gap-1 rounded-(--radius-md) border border-(--border-subtle) px-2 py-1 text-xs text-(--txt-secondary) transition-colors hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary) disabled:opacity-50"
                >
                  <ArchiveRestore className="size-3.5" />
                  {restoringProjectId === project.id
                    ? t('archives.restoring', 'Restoring…')
                    : t('common.restore', 'Restore')}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading ? (
        <p className="px-1 py-10 text-center text-sm text-(--txt-tertiary)">
          {t('archives.loading', 'Loading archives…')}
        </p>
      ) : issues.length === 0 ? (
        <div className="rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-4 py-16 text-center">
          <p className="text-sm font-medium text-(--txt-secondary)">
            {t('archives.empty', 'No archived work items')}
          </p>
          <p className="mt-1 text-xs text-(--txt-tertiary)">
            {t('archives.emptyHint', 'Archive a work item from its menu and it will show up here.')}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-(--border-subtle) overflow-hidden rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1)">
          {issues.map((issue) => (
            <li
              key={issue.id}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-(--bg-layer-1-hover)"
            >
              <Link
                to={`/${workspaceSlug}/projects/${issue.project_id}/issues/${issue.id}`}
                className="flex min-w-0 flex-1 items-center gap-2 text-(--txt-primary) no-underline hover:text-(--txt-accent-primary)"
              >
                <span className="shrink-0 text-[11px] font-medium text-(--txt-accent-primary)">
                  {displayId(issue)}
                </span>
                <span className="truncate font-medium">{issue.name}</span>
              </Link>
              <span className="shrink-0 text-xs text-(--txt-tertiary)">
                {t('archives.archivedOn', 'Archived {{date}}', {
                  date: formatArchivedAt(issue.archived_at),
                })}
              </span>
              <button
                type="button"
                onClick={() => void restore(issue)}
                disabled={restoringId === issue.id}
                className="inline-flex shrink-0 items-center gap-1 rounded-(--radius-md) border border-(--border-subtle) px-2 py-1 text-xs text-(--txt-secondary) transition-colors hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary) disabled:opacity-50"
              >
                <ArchiveRestore className="size-3.5" />
                {restoringId === issue.id
                  ? t('archives.restoring', 'Restoring…')
                  : t('common.restore', 'Restore')}
              </button>
            </li>
          ))}
        </ul>
      )}

      {!loading && hasMore && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="rounded-(--radius-md) border border-(--border-subtle) px-3 py-1.5 text-sm text-(--txt-secondary) transition-colors hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary) disabled:opacity-50"
          >
            {loadingMore ? t('common.loading', 'Loading…') : t('common.loadMore', 'Load more')}
          </button>
        </div>
      )}
    </div>
  );
}
