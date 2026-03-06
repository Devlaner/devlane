import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const IconSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
);

export interface SelectParentModalProps {
  open: boolean;
  onClose: () => void;
  issues: Array<{ id: string; title: string }>;
  value: string | null;
  onChange: (issueId: string | null) => void;
}

export function SelectParentModal({
  open,
  onClose,
  issues,
  value: _value,
  onChange,
}: SelectParentModalProps) {
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  const q = (s: string) => s.toLowerCase().trim();
  const filteredIssues = issues.filter((i) => q(i.title).includes(q(search)));

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="select-parent-title"
    >
      <div
        className="absolute inset-0 bg-[var(--bg-backdrop)]"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="relative z-10 w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] shadow-[var(--shadow-overlay)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[var(--border-subtle)] px-4 py-3">
          <h2 id="select-parent-title" className="text-sm font-semibold text-[var(--txt-primary)]">
            Select parent
          </h2>
        </div>
        <div className="flex flex-col p-3">
          <div className="mb-3 flex items-center gap-2 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] px-3 py-2 text-[var(--txt-secondary)] focus-within:border-[var(--border-strong)] focus-within:outline-none">
            <span className="shrink-0 text-[var(--txt-icon-tertiary)]">
              <IconSearch />
            </span>
            <input
              type="text"
              placeholder="Type to search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-[var(--txt-placeholder)] focus:outline-none"
            />
          </div>
          <div className="max-h-64 overflow-auto rounded border border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={() => {
                onChange(null);
                onClose();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--txt-tertiary)] hover:bg-[var(--bg-layer-1-hover)]"
            >
              <span className="text-[var(--txt-icon-tertiary)]">•</span>
              No parent
            </button>
            {filteredIssues.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => {
                  onChange(i.id);
                  onClose();
                }}
                className="flex w-full items-center gap-2 truncate px-3 py-2 text-left text-sm text-[var(--txt-primary)] hover:bg-[var(--bg-layer-1-hover)]"
              >
                <span className="shrink-0 text-[var(--txt-icon-tertiary)]">•</span>
                <span className="truncate">{i.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
