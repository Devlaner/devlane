import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../ui';
import { Dropdown } from '../../work-item';
import {
  WorkspaceViewsFiltersDropdown,
  WorkspaceViewsDisplayDropdown,
  WorkspaceViewsLayoutSelector,
  WorkspaceViewsEllipsisMenu,
  CreateViewModal,
} from '../../workspace-views';
import { viewService } from '../../../services/viewService';
import type { IssueViewApiResponse } from '../../../api/types';
import { IconProjectViews, IconSearch, IconLayers, IconCheck, IconPlus } from './icons';

const LONG_LIST_PANEL_STYLE = { maxHeight: 'min(70vh, 28rem)' };

export function WorkspaceViewsHeader() {
  const { t } = useTranslation();
  const { workspaceSlug, viewId: urlViewId } = useParams<{
    workspaceSlug?: string;
    viewId?: string;
  }>();
  const navigate = useNavigate();
  /** Default workspace view options: all-issues, assigned, created, subscribed. */
  const DEFAULT_WORKSPACE_VIEWS = [
    { id: 'all-issues', name: t('header.views.default.allWorkItems', 'All work items') },
    { id: 'assigned', name: t('header.views.default.assigned', 'Assigned') },
    { id: 'created', name: t('header.views.default.created', 'Created') },
    { id: 'subscribed', name: t('header.views.default.subscribed', 'Subscribed') },
  ] as const;
  const [viewDropdownOpen, setViewDropdownOpen] = useState<string | null>(null);
  const [toolbarDropdownOpen, setToolbarDropdownOpen] = useState<string | null>(null);
  const [createViewModalOpen, setCreateViewModalOpen] = useState(false);
  const [viewSearch, setViewSearch] = useState('');
  const [customViews, setCustomViews] = useState<IssueViewApiResponse[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!workspaceSlug) {
      queueMicrotask(() => {
        if (!cancelled) setCustomViews([]);
      });
      return () => {
        cancelled = true;
      };
    }
    viewService
      .list(workspaceSlug)
      .then((list) => {
        if (!cancelled) setCustomViews(list ?? []);
      })
      .catch(() => {
        if (!cancelled) setCustomViews([]);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug]);

  useEffect(() => {
    if (!viewDropdownOpen) {
      queueMicrotask(() => setViewSearch(''));
    }
  }, [viewDropdownOpen]);

  const selectedViewId = urlViewId ?? 'all-issues';
  const allOptions = [
    ...DEFAULT_WORKSPACE_VIEWS,
    ...customViews.map((v) => ({ id: v.id, name: v.name })),
  ];
  const selectedView =
    DEFAULT_WORKSPACE_VIEWS.find((v) => v.id === selectedViewId) ??
    customViews.find((v) => v.id === selectedViewId) ??
    DEFAULT_WORKSPACE_VIEWS[0];
  const displayName =
    selectedView?.name ?? t('header.views.default.allWorkItems', 'All work items');
  const q = (s: string) => s.trim().toLowerCase();
  const filteredViews = allOptions.filter((v) => q(v.name).includes(q(viewSearch)));

  const handleSelectView = (id: string) => {
    setViewDropdownOpen(null);
    if (!workspaceSlug) return;
    navigate(`/${workspaceSlug}/views/${id}`);
  };

  return (
    <>
      <div className="flex items-center gap-2 text-sm font-medium text-(--txt-secondary)">
        <Link
          to={workspaceSlug ? `/${workspaceSlug}/views/all-issues` : '/'}
          className="flex items-center gap-1.5 text-(--txt-secondary) hover:text-(--txt-primary)"
        >
          <span className="flex size-5 items-center justify-center text-(--txt-icon-tertiary)">
            <IconProjectViews />
          </span>
          <span>{t('common.views', 'Views')}</span>
        </Link>
        <span className="text-(--txt-icon-tertiary)" aria-hidden>
          &gt;
        </span>
        <Dropdown
          id="workspace-view-select"
          openId={viewDropdownOpen}
          onOpen={setViewDropdownOpen}
          label={t('header.views.default.allWorkItems', 'All work items')}
          icon={<IconProjectViews />}
          displayValue={displayName}
          panelClassName="flex min-w-[220px] max-h-[min(70vh,28rem)] flex-col rounded-md border border-(--border-subtle) bg-(--bg-surface-1) shadow-(--shadow-raised) overflow-hidden"
          align="left"
        >
          <div className="sticky top-0 shrink-0 border-b border-(--border-subtle) bg-(--bg-surface-1) p-2">
            <div className="flex items-center gap-2 rounded border border-(--border-subtle) bg-(--bg-layer-1) px-2 py-1.5">
              <span className="shrink-0 text-(--txt-icon-tertiary)">
                <IconSearch />
              </span>
              <input
                type="text"
                placeholder={t('common.search', 'Search')}
                value={viewSearch}
                onChange={(e) => setViewSearch(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto py-1" style={LONG_LIST_PANEL_STYLE}>
            {filteredViews.map((view) => (
              <button
                key={view.id}
                type="button"
                onClick={() => handleSelectView(view.id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-2-hover)"
              >
                <span className="shrink-0 text-(--txt-icon-tertiary)">
                  <IconLayers />
                </span>
                <span className="min-w-0 flex-1 truncate">{view.name}</span>
                {selectedViewId === view.id && (
                  <span className="shrink-0 text-(--txt-primary)">
                    <IconCheck />
                  </span>
                )}
              </button>
            ))}
          </div>
        </Dropdown>
      </div>
      <div className="flex items-center gap-1">
        <WorkspaceViewsLayoutSelector />
        <WorkspaceViewsFiltersDropdown
          openId={toolbarDropdownOpen}
          onOpen={setToolbarDropdownOpen}
        />
        <WorkspaceViewsDisplayDropdown
          openId={toolbarDropdownOpen}
          onOpen={setToolbarDropdownOpen}
        />
        <Button
          size="sm"
          className="gap-1.5 text-[13px] font-medium"
          onClick={() => {
            setToolbarDropdownOpen(null);
            setCreateViewModalOpen(true);
          }}
        >
          <IconPlus /> {t('common.addView', 'Add view')}
        </Button>
        <CreateViewModal
          open={createViewModalOpen}
          onClose={() => setCreateViewModalOpen(false)}
          onCreated={() => {
            setCreateViewModalOpen(false);
            if (workspaceSlug) {
              viewService
                .list(workspaceSlug)
                .then((list) => setCustomViews(list ?? []))
                .catch(() => {});
            }
          }}
        />
        <WorkspaceViewsEllipsisMenu />
      </div>
    </>
  );
}
