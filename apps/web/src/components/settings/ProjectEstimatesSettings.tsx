import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Pencil, Trash2, X, GripVertical } from 'lucide-react';
import { Button, Card, Input, Modal } from '../ui';
import { estimateService } from '../../services/estimateService';
import type { EstimateApiResponse } from '../../api/types';

interface ProjectEstimatesSettingsProps {
  workspaceSlug: string;
  projectId: string;
}

const ESTIMATE_TYPES: { value: string; label: string }[] = [
  { value: 'points', label: 'Points' },
  { value: 'categories', label: 'Categories' },
];

interface EstimateModalProps {
  open: boolean;
  onClose: () => void;
  initial?: EstimateApiResponse | null;
  onSubmit: (payload: {
    name: string;
    type: string;
    last_used: boolean;
    points: { key: number; value: string }[];
  }) => Promise<void>;
}

/** Create / edit an estimate system: name, type, and an ordered list of points. */
function EstimateModal({ open, onClose, initial, onSubmit }: EstimateModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState('points');
  const [active, setActive] = useState(false);
  const [points, setPoints] = useState<string[]>(['', '', '']);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setType(initial?.type ?? 'points');
    setActive(initial?.last_used ?? false);
    setPoints(
      initial && initial.points.length > 0 ? initial.points.map((p) => p.value) : ['', '', ''],
    );
    setError(null);
  }, [open, initial]);

  const setPointAt = (i: number, value: string) =>
    setPoints((prev) => prev.map((p, idx) => (idx === i ? value : p)));
  const addPoint = () => setPoints((prev) => [...prev, '']);
  const removePoint = (i: number) => setPoints((prev) => prev.filter((_, idx) => idx !== i));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const values = points.map((p) => p.trim()).filter(Boolean);
    if (!trimmedName || submitting) return;
    if (values.length === 0) {
      setError('Add at least one estimate point.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        name: trimmedName,
        type,
        last_used: active,
        points: values.map((value, key) => ({ key, value })),
      });
      onClose();
    } catch {
      setError('Could not save the estimate system.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit estimate system' : 'New estimate system'}
    >
      <form onSubmit={submit} className="space-y-4">
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. T-Shirt sizes"
          autoFocus
        />
        <div>
          <label className="mb-1 block text-sm font-medium text-(--txt-secondary)">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-sm text-(--txt-primary) focus:border-(--border-strong) focus:outline-none"
          >
            {ESTIMATE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-(--txt-secondary)">Points</label>
          <div className="space-y-2">
            {points.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <GripVertical className="size-4 shrink-0 text-(--txt-icon-tertiary)" aria-hidden />
                <input
                  type="text"
                  value={p}
                  onChange={(e) => setPointAt(i, e.target.value)}
                  placeholder={`Point ${i + 1}`}
                  className="min-w-0 flex-1 rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-1.5 text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:border-(--border-strong) focus:outline-none"
                />
                <button
                  type="button"
                  aria-label={`Remove point ${i + 1}`}
                  onClick={() => removePoint(i)}
                  disabled={points.length <= 1}
                  className="grid size-7 place-items-center rounded-(--radius-md) text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-danger-primary) disabled:opacity-40"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addPoint}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-(--txt-accent-primary) hover:underline"
          >
            <Plus className="size-3.5" /> Add point
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm text-(--txt-secondary)">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="rounded border-(--border-subtle)"
          />
          Set as the active estimate system
        </label>
        {error && <p className="text-sm text-(--txt-danger-primary)">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!name.trim() || submitting}>
            {initial ? 'Save changes' : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Project settings → Estimates. Lists the project's estimate systems and lets
 * members create, edit, delete, and pick the active one.
 */
export function ProjectEstimatesSettings({
  workspaceSlug,
  projectId,
}: ProjectEstimatesSettingsProps) {
  const [estimates, setEstimates] = useState<EstimateApiResponse[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EstimateApiResponse | null>(null);

  const load = () => {
    estimateService
      .list(workspaceSlug, projectId)
      .then(setEstimates)
      .catch(() => setEstimates([]));
  };

  useEffect(() => {
    let cancelled = false;
    estimateService
      .list(workspaceSlug, projectId)
      .then((list) => {
        if (!cancelled) setEstimates(list);
      })
      .catch(() => {
        if (!cancelled) setEstimates([]);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId]);

  const submit = async (payload: {
    name: string;
    type: string;
    last_used: boolean;
    points: { key: number; value: string }[];
  }) => {
    if (editing) {
      await estimateService.update(workspaceSlug, projectId, editing.id, payload);
    } else {
      await estimateService.create(workspaceSlug, projectId, payload);
    }
    load();
  };

  const remove = async (id: string) => {
    try {
      await estimateService.remove(workspaceSlug, projectId, id);
      load();
    } catch {
      // best-effort
    }
  };

  const makeActive = async (e: EstimateApiResponse) => {
    if (e.last_used) return;
    try {
      await estimateService.update(workspaceSlug, projectId, e.id, { last_used: true });
      load();
    } catch {
      // best-effort
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-(--txt-primary)">Estimates</h2>
          <p className="mt-0.5 text-sm text-(--txt-secondary)">
            Set up estimation systems to track and communicate the effort required for each work
            item.
          </p>
        </div>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <Plus className="size-4" /> Add estimate
        </Button>
      </div>

      {estimates.length === 0 ? (
        <Card variant="outlined" className="p-6 text-center">
          <p className="text-sm text-(--txt-secondary)">No estimate systems yet.</p>
          <p className="mt-1 text-xs text-(--txt-tertiary)">
            Create one to assign effort estimates to work items.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {estimates.map((e) => (
            <Card key={e.id} variant="outlined" className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-(--txt-primary)">
                      {e.name}
                    </span>
                    {e.last_used && (
                      <span className="rounded-full bg-(--bg-accent-subtle) px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-(--txt-accent-primary)">
                        Active
                      </span>
                    )}
                    <span className="text-[11px] capitalize text-(--txt-tertiary)">{e.type}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {e.points.map((p) => (
                      <span
                        key={p.id}
                        className="rounded-(--radius-md) bg-(--bg-layer-2) px-2 py-0.5 text-xs text-(--txt-secondary)"
                      >
                        {p.value}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {!e.last_used && (
                    <Button variant="ghost" size="sm" onClick={() => void makeActive(e)}>
                      Set active
                    </Button>
                  )}
                  <button
                    type="button"
                    aria-label="Edit estimate"
                    onClick={() => {
                      setEditing(e);
                      setModalOpen(true);
                    }}
                    className="grid size-7 place-items-center rounded-(--radius-md) text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Delete estimate"
                    onClick={() => void remove(e.id)}
                    className="grid size-7 place-items-center rounded-(--radius-md) text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-danger-primary)"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <EstimateModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initial={editing}
        onSubmit={submit}
      />
    </div>
  );
}
