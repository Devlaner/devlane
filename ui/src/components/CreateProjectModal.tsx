import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Input } from './ui';
import { projectService } from '../services/projectService';
import type { ProjectApiResponse } from '../api/types';

export interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
  workspaceSlug: string;
  onSuccess?: (project: ProjectApiResponse) => void;
}

const COVER_GRADIENTS = [
  'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%)',
  'linear-gradient(135deg, #0ea5e9 0%, #38bdf8 50%, #7dd3fc 100%)',
  'linear-gradient(135deg, #10b981 0%, #34d399 50%, #6ee7b7 100%)',
  'linear-gradient(135deg, #f59e0b 0%, #fbbf24 50%, #fcd34d 100%)',
  'linear-gradient(135deg, #ec4899 0%, #f472b6 50%, #f9a8d4 100%)',
];

const IconGlobe = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const IconUsers = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const IconInfo = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </svg>
);

const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

export function CreateProjectModal({
  open,
  onClose,
  workspaceSlug,
  onSuccess,
}: CreateProjectModalProps) {
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [coverIndex, setCoverIndex] = useState(0);

  const handleClose = () => {
    setName('');
    setIdentifier('');
    setDescription('');
    setError('');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Project name is required.');
      return;
    }
    setSubmitting(true);
    try {
      const project = await projectService.create(workspaceSlug, {
        name: name.trim(),
        identifier: identifier.trim() || undefined,
      });
      onSuccess?.(project);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project.');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const coverStyle = { background: COVER_GRADIENTS[coverIndex % COVER_GRADIENTS.length] };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-project-modal-title"
    >
      <h2 id="create-project-modal-title" className="sr-only">Create project</h2>
      <div
        className="absolute inset-0 bg-[var(--bg-backdrop)]"
        onClick={handleClose}
        aria-hidden
      />
      <div
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] shadow-[var(--shadow-overlay)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cover + Close */}
        <div className="relative h-28 w-full shrink-0" style={coverStyle}>
          <button
            type="button"
            onClick={handleClose}
            className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-black/20 text-white hover:bg-black/30 focus:outline-none focus:ring-2 focus:ring-white/50"
            aria-label="Close"
          >
            <IconX />
          </button>
          <button
            type="button"
            onClick={() => setCoverIndex((i) => i + 1)}
            className="absolute bottom-3 right-3 rounded-md bg-white/20 px-2.5 py-1.5 text-xs font-medium text-white backdrop-blur-sm hover:bg-white/30"
          >
            Change cover
          </button>
        </div>

        {/* Icon placeholder overlapping cover */}
        <div className="px-5 -mt-6 relative z-10">
          <div className="flex size-12 items-center justify-center rounded-lg border-2 border-[var(--bg-surface-1)] bg-[var(--bg-layer-2)] text-2xl shadow-sm">
            📁
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 pb-5 pt-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 sm:grid-cols-1">
              <Input
                label="Project name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Project name"
                required
                autoFocus
                disabled={submitting}
                className="w-full"
              />
            </div>
            <div className="relative sm:col-span-2">
              <Input
                label="Project ID"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                placeholder="e.g. PROJ"
                disabled={submitting}
                className="w-full pr-9"
              />
              <span
                className="absolute right-3 top-9 text-[var(--txt-icon-tertiary)]"
                title="Short identifier used in issue IDs (e.g. PROJ-123)"
              >
                <IconInfo />
              </span>
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-[var(--txt-secondary)]">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description"
              rows={3}
              disabled={submitting}
              className="min-h-[72px] w-full resize-y rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] px-3 py-2 text-sm text-[var(--txt-primary)] placeholder:text-[var(--txt-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--border-strong)]"
            />
          </div>

          {/* Visibility / type tags (Plane-style) */}
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-layer-2)] px-2.5 py-1.5 text-xs font-medium text-[var(--txt-secondary)]">
              <IconGlobe />
              Public
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-layer-2)] px-2.5 py-1.5 text-xs font-medium text-[var(--txt-secondary)]">
              <IconUsers />
              Lead
            </span>
          </div>

          {error && (
            <p className="mt-3 text-sm text-[var(--txt-danger-primary)]">{error}</p>
          )}

          {/* Actions */}
          <div className="mt-6 flex justify-end gap-2 border-t border-[var(--border-subtle)] pt-4">
            <Button type="button" variant="secondary" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting ? 'Creating…' : 'Create project'}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
