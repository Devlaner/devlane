import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './ui';
import { issueService } from '../services/issueService';
import { moduleService } from '../services/moduleService';
import type { IssueApiResponse } from '../api/types';

const IconSearch = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
);

function displayId(issue: IssueApiResponse, projectIdentifier: string): string {
  return `${projectIdentifier}-${issue.sequence_id ?? issue.id.slice(-4)}`;
}

export interface AddExistingWorkItemModalProps {
  open: boolean;
  onClose: () => void;
  workspaceSlug: string;
  projectId: string;
  moduleId: string;
  projectIdentifier: string;
  onAdded?: () => void;
}

export function AddExistingWorkItemModal({
  open,
  onClose,
  workspaceSlug,
  projectId,
  moduleId,
  projectIdentifier,
  onAdded,
}: AddExistingWorkItemModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [projectIssues, setProjectIssues] = useState<IssueApiResponse[]>([]);
  const [moduleIssueIds, setModuleIssueIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !workspaceSlug || !projectId || !moduleId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      issueService.list(workspaceSlug, projectId, { limit: 2000 }),
      moduleService.listIssueIds(workspaceSlug, projectId, moduleId),
    ])
      .then(([issues, ids]) => {
        if (cancelled) return;
        setProjectIssues(issues ?? []);
        setModuleIssueIds(new Set(ids ?? []));
        setSelectedIds(new Set());
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load work items');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, workspaceSlug, projectId, moduleId]);

  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setSelectedIds(new Set());
    }
  }, [open]);

  const availableIssues = useMemo(() => {
    return projectIssues.filter((i) => !moduleIssueIds.has(i.id));
  }, [projectIssues, moduleIssueIds]);

  const filteredIssues = useMemo(() => {
    if (!searchQuery.trim()) return availableIssues;
    const q = searchQuery.trim().toLowerCase();
    return availableIssues.filter((issue) => {
      const id = displayId(issue, projectIdentifier);
      const name = (issue.name ?? '').toLowerCase();
      return id.toLowerCase().includes(q) || name.includes(q);
    });
  }, [availableIssues, searchQuery, projectIdentifier]);

  const selectAll = () => {
    if (filteredIssues.length === 0) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredIssues.forEach((i) => next.add(i.id));
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = async () => {
    if (selectedIds.size === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const ids = Array.from(selectedIds);
      const BATCH = 5;
      for (let i = 0; i < ids.length; i += BATCH) {
        await Promise.all(
          ids
            .slice(i, i + BATCH)
            .map((issueId) => moduleService.addIssue(workspaceSlug, projectId, moduleId, issueId)),
        );
      }
      onAdded?.();
      onClose();
    } catch {
      setError('Failed to add work items');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCount = selectedIds.size;
  const selectionLabel =
    selectedCount === 0
      ? 'No work items selected'
      : `${selectedCount} work item${selectedCount === 1 ? '' : 's'} selected`;

  const footer = (
    <div className="flex w-full items-center justify-between">
      <button
        type="button"
        onClick={selectAll}
        className="text-sm font-medium text-(--brand-default) hover:underline"
      >
        Select all
      </button>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          onClick={handleAdd}
          disabled={selectedCount === 0 || submitting}
          className="gap-1.5"
        >
          Add selected work items
        </Button>
      </div>
    </div>
  );

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-existing-work-item-title"
    >
      <div className="absolute inset-0 bg-(--bg-backdrop)" onClick={onClose} aria-hidden />
      <div
        className="relative z-10 flex w-full max-w-md flex-col rounded-lg border border-(--border-subtle) bg-(--bg-surface-1) shadow-(--shadow-overlay)"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-3 border-b border-(--border-subtle) px-5 py-4">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-(--txt-icon-tertiary)">
              <IconSearch />
            </span>
            <input
              type="text"
              placeholder="Type to search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-2 pl-9 pr-3 text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none"
              aria-label="Search work items"
            />
          </div>
          <span
            id="add-existing-work-item-title"
            className="inline-flex w-fit rounded-full bg-(--bg-layer-2) px-3 py-1 text-sm text-(--txt-secondary)"
          >
            {selectionLabel}
          </span>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 py-4">
          {error && <p className="mb-2 text-sm text-(--txt-danger-primary)">{error}</p>}
          {loading ? (
            <p className="py-8 text-center text-sm text-(--txt-tertiary)">Loading work items…</p>
          ) : filteredIssues.length === 0 ? (
            <p className="py-8 text-center text-sm text-(--txt-tertiary)">
              {availableIssues.length === 0
                ? 'No other work items in this project.'
                : 'No matching work items.'}
            </p>
          ) : (
            <ul className="max-h-64 overflow-y-auto divide-y divide-(--border-subtle)">
              {filteredIssues.map((issue) => {
                const id = displayId(issue, projectIdentifier);
                const checked = selectedIds.has(issue.id);
                return (
                  <li key={issue.id}>
                    <label className="flex cursor-pointer items-center gap-3 py-2.5 hover:bg-(--bg-layer-1-hover)">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOne(issue.id)}
                        className="size-4 shrink-0 rounded border-(--border-subtle)"
                      />
                      <span
                        className="size-2 shrink-0 rounded-full bg-(--txt-primary)"
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        <span className="font-medium text-(--txt-primary)">{id}</span>
                        <span className="ml-2 text-(--txt-secondary)">{issue.name || '—'}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex w-full border-t border-(--border-subtle) px-5 py-4">{footer}</div>
      </div>
    </div>,
    document.body,
  );
}
