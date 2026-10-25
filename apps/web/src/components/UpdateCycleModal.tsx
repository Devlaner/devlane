import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Modal, Button, Input } from './ui';
import { DateRangeModal } from './workspace-views/DateRangeModal';
import { cycleService } from '../services/cycleService';
import type { CycleApiResponse } from '../api/types';
import { formatISODateDisplay } from '../lib/dateOnly';
import { apiErrorMessage } from '../lib/apiError';
import { overlappingCycles } from '../lib/cycleOverlap';

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

function formatDateRangeDisplay(start: string | null, end: string | null, t: TFunction): string {
  if (!start && !end) return t('common.dateRangePlaceholder', 'Start date → End date');
  if (start && end) return `${formatISODateDisplay(start)} → ${formatISODateDisplay(end)}`;
  return start
    ? formatISODateDisplay(start)
    : end
      ? formatISODateDisplay(end)
      : t('common.dateRangePlaceholder', 'Start date → End date');
}

export interface UpdateCycleModalProps {
  open: boolean;
  onClose: () => void;
  workspaceSlug: string;
  projectId: string;
  cycle: CycleApiResponse | null;
  onUpdated?: (cycle: CycleApiResponse) => void;
}

export function UpdateCycleModal({
  open,
  onClose,
  workspaceSlug,
  projectId,
  cycle,
  onUpdated,
}: UpdateCycleModalProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [siblingCycles, setSiblingCycles] = useState<CycleApiResponse[]>([]);

  useEffect(() => {
    if (!open || !cycle) return;
    setTitle(cycle.name ?? '');
    setDescription(cycle.description ?? '');
    setStartDate(cycle.start_date ?? null);
    setEndDate(cycle.end_date ?? null);
    setDateModalOpen(false);
    setError(null);
  }, [open, cycle]);

  // Other cycles in the project, to warn (not block) on overlap.
  useEffect(() => {
    if (!open || !projectId) {
      setSiblingCycles([]);
      return;
    }
    let cancelled = false;
    cycleService
      .list(workspaceSlug, projectId)
      .then((list) => {
        if (!cancelled) setSiblingCycles(list ?? []);
      })
      .catch(() => {
        if (!cancelled) setSiblingCycles([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, workspaceSlug, projectId]);

  const overlapNames = useMemo(
    () => overlappingCycles(siblingCycles, startDate, endDate, cycle?.id).map((c) => c.name),
    [siblingCycles, startDate, endDate, cycle?.id],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceSlug || !projectId || !cycle || !title.trim()) {
      setError(t('common.titleRequired', 'Title is required.'));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const updated = await cycleService.update(workspaceSlug, projectId, cycle.id, {
        name: title.trim(),
        description: description.trim() || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      onClose();
      onUpdated?.(updated);
    } catch (err) {
      setError(apiErrorMessage(err, t('cycle.update.error', 'Failed to update cycle.')));
    } finally {
      setSubmitting(false);
    }
  };

  if (!cycle) return null;

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={t('cycle.update.title', 'Edit cycle')}
        className="max-w-[680px]"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={onClose}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="submit" form="update-cycle-form" disabled={submitting || !title.trim()}>
              {t('common.save', 'Save')}
            </Button>
          </>
        }
      >
        <form id="update-cycle-form" onSubmit={handleSubmit} className="space-y-4">
          <Input
            label={t('common.title', 'Title')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('common.title', 'Title')}
            autoFocus
          />

          <div>
            <label className="mb-1 block text-sm font-medium text-(--txt-secondary)">
              {t('common.description', 'Description')}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('common.description', 'Description')}
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
            {formatDateRangeDisplay(startDate, endDate, t)}
          </button>

          {overlapNames.length > 0 && (
            <p className="text-sm text-(--txt-warning-primary)">
              {overlapNames.length === 1
                ? t('cycle.overlapWarningOne', 'These dates overlap the cycle {{names}}.', {
                    names: overlapNames.join(', '),
                  })
                : t('cycle.overlapWarningOther', 'These dates overlap cycles {{names}}.', {
                    names: overlapNames.join(', '),
                  })}
            </p>
          )}

          {error && <p className="text-sm text-(--txt-danger-primary)">{error}</p>}
        </form>
      </Modal>

      <DateRangeModal
        open={dateModalOpen}
        onClose={() => setDateModalOpen(false)}
        title={t('cycle.dateRangeTitle', 'Cycle date range')}
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
