import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui';
import { CreateWorkItemModal } from '../components/CreateWorkItemModal';
import { ImportCSVModal } from '../components/work-item/ImportCSVModal';
import { issueService } from '../services/issueService';
import { IssueLayoutList } from '../components/work-item/layouts/IssueLayoutList';
import { IssueLayoutBoard } from '../components/work-item/layouts/IssueLayoutBoard';
import { IssueLayoutSpreadsheet } from '../components/work-item/layouts/IssueLayoutSpreadsheet';
import { IssueLayoutCalendar } from '../components/work-item/layouts/IssueLayoutCalendar';
import { IssueLayoutGantt } from '../components/work-item/layouts/IssueLayoutGantt';
import { parseIssueLayout } from '../components/work-item/layouts/IssueLayoutTypes';
import { useProjectIssuesController } from '../hooks/useProjectIssuesController';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const IconPlus = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </svg>
);

export function IssueListPage() {
  const { t } = useTranslation();
  const { workspaceSlug, projectId } = useParams<{
    workspaceSlug: string;
    projectId: string;
  }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [importOpen, setImportOpen] = useState(false);
  useDocumentTitle(t('workItem.list.documentTitle', 'Work items'));

  /* Loading, filtering, grouping, selection and persistence all live in the
     shared controller, so this page and the v2 preview show the same work item
     list under two designs rather than two implementations. */
  const {
    workspace,
    project,
    projects,
    issues,
    states,
    labels,
    members,
    prSummary,
    loading,
    listDisplay,
    filteredIssues,
    groupedIssues,
    subGroupedIssues,
    orderedVisibleIssues,
    subWorkCountByParentId,
    hasCol,
    cycleName,
    moduleName,
    now,
    selectedIds,
    visibleSelectedIds,
    toggleSelect,
    clearSelection,
    runBulk,
    bulkError,
    refetchIssues,
    handleReorder,
    reorderEnabled,
    handleCardMove,
    handleInlineUpdate,
    createOpen,
    createError,
    handleCloseCreate,
    handleCreateSave,
  } = useProjectIssuesController(workspaceSlug, projectId);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-(--txt-tertiary)">
        {t('common.loading', 'Loading…')}
      </div>
    );
  }
  if (!workspace || !project) {
    return (
      <div className="text-(--txt-secondary)">
        {t('common.projectNotFound', 'Project not found.')}
      </div>
    );
  }

  const baseUrl = `/${workspace.slug}/projects/${project.id}`;
  const layout = parseIssueLayout(searchParams.get('layout'));
  const issueHref = (id: string) => `${baseUrl}/issues/${id}`;
  const layoutProps = {
    workspaceSlug: workspace.slug,
    project,
    issues: orderedVisibleIssues,
    states,
    labels,
    members,
    prSummary,
    baseUrl,
    issueHref,
    now,
  };
  const groupedLayoutProps = {
    groupedIssues,
    hasCol,
    showEmptyGroups: listDisplay.showEmptyGroups,
    subWorkCountByParentId,
    cycleName,
    moduleName,
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-4 border-b border-(--border-subtle) px-4 py-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-(--txt-primary)">
          <span
            className="flex size-4 shrink-0 items-center justify-center rounded border border-(--border-subtle) border-dashed text-(--txt-icon-tertiary)"
            aria-hidden
          >
            <span className="size-2 rounded-full border border-current border-dashed" />
          </span>
          {t('workItem.list.allWorkItems', 'All work items {{count}}', {
            count: filteredIssues.length,
          })}
          <button
            type="button"
            className="flex size-7 items-center justify-center rounded-md text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
            aria-label={t('workItem.list.addWorkItem', 'Add work item')}
            onClick={() => setSearchParams({ create: '1' })}
          >
            <IconPlus />
          </button>
        </h2>
        <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)}>
          {t('workItem.list.importCsv', 'Import CSV')}
        </Button>
      </div>

      {issues.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 px-4 py-12">
          <p className="text-sm text-(--txt-tertiary)">
            {t('workItem.list.emptyNoItems', 'No work items yet.')}
          </p>
          <Button size="sm" className="gap-1.5" onClick={() => setSearchParams({ create: '1' })}>
            <IconPlus />
            {t('workItem.list.newWorkItem', 'New work item')}
          </Button>
        </div>
      ) : filteredIssues.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 px-4 py-12">
          <p className="text-sm text-(--txt-tertiary)">
            {t('workItem.list.emptyNoMatch', 'No work items match your filters.')}
          </p>
        </div>
      ) : (
        <>
          {layout === 'list' && visibleSelectedIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-(--border-subtle) bg-(--bg-surface-1) px-4 py-2 text-sm">
              <span className="font-medium text-(--txt-secondary)">
                {t('workItem.list.selectedCount', '{{count}} selected', {
                  count: visibleSelectedIds.size,
                })}
              </span>
              <select
                aria-label={t('workItem.list.setPriorityForSelected', 'Set priority for selected')}
                className="rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-2 py-1 text-xs text-(--txt-secondary)"
                value=""
                onChange={(e) => {
                  const v = e.target.value;
                  e.currentTarget.value = '';
                  if (v)
                    void runBulk((s, p, ids) =>
                      issueService.bulkUpdate(s, p, ids, { priority: v }),
                    );
                }}
              >
                <option value="">
                  {t('workItem.list.setPriorityPlaceholder', 'Set priority…')}
                </option>
                {['urgent', 'high', 'medium', 'low', 'none'].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <select
                aria-label={t('workItem.list.setStateForSelected', 'Set state for selected')}
                className="rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-2 py-1 text-xs text-(--txt-secondary)"
                value=""
                onChange={(e) => {
                  const v = e.target.value;
                  e.currentTarget.value = '';
                  if (v)
                    void runBulk((s, p, ids) =>
                      issueService.bulkUpdate(s, p, ids, { state_id: v }),
                    );
                }}
              >
                <option value="">{t('workItem.list.setStatePlaceholder', 'Set state…')}</option>
                {states.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="rounded-(--radius-md) border border-(--border-subtle) px-2 py-1 text-xs text-(--txt-secondary) hover:bg-(--bg-layer-1-hover)"
                onClick={() => void runBulk((s, p, ids) => issueService.bulkArchive(s, p, ids))}
              >
                {t('common.archive', 'Archive')}
              </button>
              <button
                type="button"
                className="rounded-(--radius-md) border border-(--border-subtle) px-2 py-1 text-xs text-(--txt-danger-primary) hover:bg-(--bg-layer-1-hover)"
                onClick={() => {
                  if (
                    window.confirm(
                      t('workItem.list.deleteConfirm', 'Delete {{count}} work item(s)?', {
                        count: visibleSelectedIds.size,
                      }),
                    )
                  )
                    void runBulk((s, p, ids) => issueService.bulkDelete(s, p, ids));
                }}
              >
                {t('common.delete', 'Delete')}
              </button>
              <button
                type="button"
                className="ml-auto rounded-(--radius-md) px-2 py-1 text-xs text-(--txt-tertiary) hover:text-(--txt-secondary)"
                onClick={clearSelection}
              >
                {t('common.clear', 'Clear')}
              </button>
              {bulkError && (
                <span className="w-full text-xs text-(--txt-danger-primary)">{bulkError}</span>
              )}
            </div>
          )}
          {layout === 'list' && (
            <IssueLayoutList
              {...layoutProps}
              groupedIssues={groupedIssues}
              subGroupedIssues={subGroupedIssues}
              hasCol={hasCol}
              showEmptyGroups={listDisplay.showEmptyGroups}
              subWorkCountByParentId={subWorkCountByParentId}
              cycleName={cycleName}
              moduleName={moduleName}
              selection={{ selectedIds, onToggle: toggleSelect }}
              onReorder={reorderEnabled ? handleReorder : undefined}
              onUpdateIssue={handleInlineUpdate}
            />
          )}
          {layout === 'board' && (
            <IssueLayoutBoard
              {...layoutProps}
              {...groupedLayoutProps}
              subGroupedIssues={subGroupedIssues}
              groupBy={listDisplay.groupBy}
              onCardMove={handleCardMove}
              onUpdateIssue={handleInlineUpdate}
            />
          )}
          {layout === 'spreadsheet' && (
            <IssueLayoutSpreadsheet
              {...layoutProps}
              {...groupedLayoutProps}
              onUpdateIssue={handleInlineUpdate}
            />
          )}
          {layout === 'calendar' && (
            <IssueLayoutCalendar {...layoutProps} onUpdateIssue={handleInlineUpdate} />
          )}
          {layout === 'gantt' && (
            <IssueLayoutGantt {...layoutProps} onUpdateIssue={handleInlineUpdate} />
          )}
          {layout === 'list' && (
            <div className="border-t border-(--border-subtle) px-4 py-2.5">
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-md border border-dashed border-(--border-subtle) bg-transparent px-3 py-2 text-sm font-medium text-(--txt-secondary) hover:border-(--border-strong) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)"
                onClick={() => setSearchParams({ create: '1' })}
              >
                <IconPlus />
                {t('workItem.list.newWorkItem', 'New work item')}
              </button>
            </div>
          )}
        </>
      )}

      <CreateWorkItemModal
        open={createOpen}
        onClose={handleCloseCreate}
        workspaceSlug={workspace.slug}
        projects={projects}
        defaultProjectId={project.id}
        onSave={handleCreateSave}
        createError={createError}
      />
      <ImportCSVModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        workspaceSlug={workspace.slug}
        projectId={project.id}
        onImported={refetchIssues}
      />
    </div>
  );
}
