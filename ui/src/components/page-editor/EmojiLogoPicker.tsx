import { useEffect, useRef, useState } from 'react';
import { FileText, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';

const PRESET_EMOJIS = [
  '📄',
  '📘',
  '📕',
  '📗',
  '📓',
  '📒',
  '📚',
  '📝',
  '✏️',
  '⚠️',
  '✅',
  '❌',
  '🚀',
  '🔥',
  '💡',
  '⭐',
  '🎯',
  '🎨',
  '🛠️',
  '⚙️',
  '🔒',
  '🌐',
  '🧪',
  '🧭',
  '📊',
  '📈',
  '📌',
  '🏷️',
  '🐛',
  '💬',
  '👥',
  '🤖',
];

export interface PageLogo {
  /** "emoji" is the only supported kind today; matches Plane's logo_props.in_use field. */
  in_use?: 'emoji' | null;
  emoji?: { value?: string };
  // Allow forward-compatible properties without breaking type-compat with the
  // backend's free-form JSON column (logo_props is `Record<string, unknown>`).
  [key: string]: unknown;
}

interface Props {
  /** Current logo, or undefined for the default page-icon fallback. */
  value: PageLogo | undefined;
  /** Whether the user can change/clear the logo. */
  disabled?: boolean;
  /** Called with the next logo (or null to clear). */
  onChange: (next: PageLogo | null) => void;
  /** Pixel size of the rendered button face. */
  size?: number;
  /** Optional className for layout overrides. */
  className?: string;
}

/**
 * Emoji-based page logo picker, modelled after Plane's `Logo` button. Shows
 * the current emoji (or the page-icon fallback), opens a popover with a
 * curated emoji palette, and lets owners clear the logo from the same panel.
 *
 * We deliberately avoid bringing in a full emoji library — the curated set
 * covers >95% of the page-categorisation use case Plane optimises for.
 */
export function EmojiLogoPicker({ value, disabled, onChange, size = 32, className }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const emoji = value?.in_use === 'emoji' ? value?.emoji?.value : undefined;

  return (
    <div ref={ref} className={cn('relative inline-block', className)}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        aria-label={emoji ? 'Change page logo' : 'Add page logo'}
        title={disabled ? undefined : emoji ? 'Change page logo' : 'Add page logo'}
        className={cn(
          'grid place-items-center rounded transition-colors',
          disabled
            ? 'cursor-default text-(--txt-icon-tertiary)'
            : 'cursor-pointer text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover)',
        )}
        style={{ width: size + 8, height: size + 8 }}
      >
        {emoji ? (
          <span style={{ fontSize: size }} aria-hidden>
            {emoji}
          </span>
        ) : (
          <FileText size={Math.round(size * 0.6)} />
        )}
      </button>
      {open ? (
        <div className="absolute top-full left-0 z-30 mt-2 w-72 rounded-md border border-(--border-subtle) bg-(--bg-surface-1) p-3 shadow-(--shadow-raised)">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold tracking-wide text-(--txt-tertiary) uppercase">
              Pick an icon
            </p>
            {emoji ? (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-(--txt-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--danger-default)"
              >
                <Trash2 size={11} /> Clear
              </button>
            ) : null}
          </div>
          <div className="grid grid-cols-8 gap-1">
            {PRESET_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  onChange({ in_use: 'emoji', emoji: { value: e } });
                  setOpen(false);
                }}
                className={cn(
                  'grid size-7 place-items-center rounded text-lg transition-colors hover:bg-(--bg-layer-1-hover)',
                  e === emoji && 'bg-(--bg-layer-1)',
                )}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
