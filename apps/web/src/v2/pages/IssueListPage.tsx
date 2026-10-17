import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router-dom';
import { CircleAlert, RefreshCw } from 'lucide-react';
import { ProjectWorkItemsSection } from '@/v2/components/project-work-items-section';
import { Button } from '@/v2/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/v2/components/ui/empty';
import { Skeleton } from '@/v2/components/ui/skeleton';
import { parseIssueLayout } from '@/components/work-item/layouts/IssueLayoutTypes';
import { usePersistedSearchParams } from '../hooks/usePersistedSearchParams';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useProjectIssuesController } from '../hooks/useProjectIssuesController';

/* Only the layout is remembered here; grouping and visible properties already
   persist through the controller's display settings. */
const ISSUE_LAYOUT_PARAM_KEYS = ['layout'] as const;

/**
 * The v2 design of a project's work item list. Loading, filtering, grouping,
 * ordering, selection and persistence all come from useProjectIssuesController —
 * the same controller the shipped list uses — so this page is a redesign of that
 * list rather than a second implementation of it.
 *
 * The list itself is ProjectWorkItemsSection, shared with the cycle page.
 */
export function IssueListPage() {
  const { t } = useTranslation();
  const { workspaceSlug, projectId } = useParams<{ workspaceSlug: string; projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  useDocumentTitle(t('views.workItems', 'Work items'));
  /* The layout lives in the URL so it can be linked, and in storage so it is
     still there when the project is opened again from the sidebar. */
  usePersistedSearchParams(
    workspaceSlug && projectId
      ? `devlane-v2-project-issues-layout:${workspaceSlug}:${projectId}`
      : null,
    ISSUE_LAYOUT_PARAM_KEYS,
  );

  const controller = useProjectIssuesController(workspaceSlug, projectId);
  const { workspace, project, issues, filteredIssues, loading, refetchIssues } = controller;

  const layout = parseIssueLayout(searchParams.get('layout'));
  const setLayout = (next: string) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'list') params.delete('layout');
    else params.set('layout', next);
    setSearchParams(params, { replace: true });
  };

  if (loading) {
    return (
      <div
        className="space-y-6 pb-8"
        aria-busy="true"
        aria-label={t('issues.loading', 'Loading work items')}
      >
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-16 w-full rounded-xl" />
        <div className="overflow-hidden rounded-xl border">
          <Skeleton className="h-10 w-full rounded-none" />
          {Array.from({ length: 9 }).map((_, index) => (
            <div key={index} className="flex h-12 items-center gap-3 border-t px-4">
              <Skeleton className="size-4" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 max-w-80 flex-1" />
              <Skeleton className="hidden h-5 w-20 sm:block" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!workspace || !project) {
    return (
      <Empty className="min-h-80 rounded-xl border border-dashed" role="alert">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
            <CircleAlert aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{t('issues.loadErrorTitle', 'Work items could not be loaded')}</EmptyTitle>
          <EmptyDescription>
            {t(
              'issues.loadErrorDescription',
              'Check your connection and try again. Your work item data has not been changed.',
            )}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button type="button" variant="outline" onClick={() => refetchIssues()}>
            <RefreshCw aria-hidden="true" />
            {t('common.retry', 'Try again')}
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('views.workItems', 'Work items')}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t('issues.pageDescription', 'Plan, prioritize, and track work for {{project}}.', {
              project: project.name,
            })}
          </p>
        </div>
        <p className="text-muted-foreground text-sm tabular-nums" aria-live="polite">
          {t('issues.pageSummary', '{{visible}} of {{loaded}} on page {{page}}', {
            visible: filteredIssues.length,
            loaded: issues.length,
            page: 1,
          })}
        </p>
      </header>

      <ProjectWorkItemsSection
        workspaceSlug={workspaceSlug ?? ''}
        projectId={projectId ?? ''}
        workspace={workspace}
        project={project}
        controller={controller}
        layout={layout}
        onLayoutChange={setLayout}
        showImportCsv
      />
    </div>
  );
}
