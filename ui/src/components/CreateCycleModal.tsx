import { useEffect, useMemo, useState } from 'react';
import { Modal, Button, Input } from './ui';
import { Dropdown } from './work-item';
import { DateRangeModal } from './workspace-views/DateRangeModal';
import { ProjectIconDisplay } from './ProjectIconModal';
import { projectService } from '../services/projectService';
import { cycleService } from '../services/cycleService';
import type { CycleApiResponse, ProjectApiResponse } from '../api/types';
import { formatISODateDisplay } from '../lib/dateOnly';

const IconCalendar = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const IconSearch = () => (
  <svg
    width="14"
    height="14"
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

const IconCheck = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="m20 6-11 11-5-5" />
  </svg>
);

function formatDateRangeDisplay(start: string | null, end: string | null): string {
  if (!start && !end) return 'Start date → End date';
  if (start && end) return `${formatISODateDisplay(start)} → ${formatISODateDisplay(end)}`;
  return start
    ? formatISODateDisplay(start)
    : end
      ? formatISODateDisplay(end)
      : 'Start date → End date';
}

export interface CreateCycleModalProps {
  open: boolean;
  onClose: () => void;
  workspaceSlug: string;
  projectId: string;
  onCreated?: (cycle: CycleApiResponse, projectId: string) => void;
}

export function CreateCycleModal({
  open,
  onClose,
  workspaceSlug,
  projectId,
  onCreated,
}: CreateCycleModalProps) {
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState<string | null>(null);
  const [projectSearch, setProjectSearch] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState(projectId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    projectService
      .list(workspaceSlug)
      .then((list) => setProjects(list ?? []))
      .catch(() => setProjects([]));
  }, [open, workspaceSlug]);

  useEffect(() => {
    if (!open) {
      setProjectDropdownOpen(null);
      setProjectSearch('');
      setSelectedProjectId(projectId);
      setTitle('');
      setDescription('');
      setStartDate(null);
      setEndDate(null);
      setDateModalOpen(false);
      setSubmitting(false);
      setError(null);
    }
  }, [open, projectId]);

  const selectedProject =
    projects.find((p) => p.id === selectedProjectId) ??
    projects.find((p) => p.id === projectId) ??
    null;

  const filteredProjects = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => p.name.toLowerCase().includes(q));
  }, [projects, projectSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceSlug || !selectedProjectId || !title.trim()) {
      setError('Title is required.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const created = await cycleService.create(workspaceSlug, selectedProjectId, {
        name: title.trim(),
        description: description.trim() || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      onClose();
      onCreated?.(created, selectedProjectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create cycle.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Create cycle"
        className="max-w-[680px]"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" form="create-cycle-form" disabled={submitting || !title.trim()}>
              Create cycle
            </Button>
          </>
        }
      >
        <form id="create-cycle-form" onSubmit={handleSubmit} className="space-y-4">
          <Dropdown
            id="create-cycle-project"
            openId={projectDropdownOpen}
            onOpen={setProjectDropdownOpen}
            label="Project"
            icon={null}
            displayValue=""
            triggerClassName="inline-flex items-center gap-2 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 py-1.5 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)"
            triggerContent={
              <span className="inline-flex items-center gap-2">
                <span className="flex size-4 shrink-0 items-center justify-center">
                  <ProjectIconDisplay
                    emoji={selectedProject?.emoji}
                    icon_prop={selectedProject?.icon_prop}
                    size={12}
                    className="leading-none"
                  />
                </span>
                <span className="max-w-[220px] truncate">
                  {selectedProject?.name ?? 'Select project'}
                </span>
              </span>
            }
            panelClassName="flex w-[280px] max-h-[min(70vh,28rem)] flex-col rounded-md border border-(--border-subtle) bg-(--bg-surface-1) shadow-(--shadow-raised) overflow-hidden"
            align="left"
          >
            <div className="sticky top-0 shrink-0 border-b border-(--border-subtle) bg-(--bg-surface-1) p-2">
              <div className="flex items-center gap-2 rounded border border-(--border-subtle) bg-(--bg-layer-1) px-2 py-1.5">
                <span className="shrink-0 text-(--txt-icon-tertiary)">
                  <IconSearch />
                </span>
                <input
                  type="text"
                  placeholder="Search"
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto py-1">
              {filteredProjects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSelectedProjectId(p.id);
                    setProjectDropdownOpen(null);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-1-hover)"
                >
                  <span className="flex size-4 shrink-0 items-center justify-center">
                    <ProjectIconDisplay
                      emoji={p.emoji}
                      icon_prop={p.icon_prop}
                      size={12}
                      className="leading-none"
                    />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  {selectedProjectId === p.id && (
                    <span className="shrink-0 text-(--txt-primary)">
                      <IconCheck />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </Dropdown>

          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            autoFocus
          />

          <div>
            <label className="mb-1 block text-sm font-medium text-(--txt-secondary)">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description"
              rows={4}
              className="w-full rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => setDateModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 py-1.5 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)"
          >
            <span className="text-(--txt-icon-tertiary)" aria-hidden>
              <IconCalendar />
            </span>
            {formatDateRangeDisplay(startDate, endDate)}
          </button>

          {error && <p className="text-sm text-(--txt-danger-primary)">{error}</p>}
        </form>
      </Modal>

      <DateRangeModal
        open={dateModalOpen}
        onClose={() => setDateModalOpen(false)}
        title="Cycle date range"
        after={startDate}
        before={endDate}
        onApply={(after, before) => {
          setStartDate(after);
          setEndDate(before);
        }}
      />
    </>
  );
}
