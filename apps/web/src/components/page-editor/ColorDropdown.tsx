import { useEffect, useRef, useState } from 'react';
import { ALargeSmall, Ban, ChevronDown } from 'lucide-react';
import type { Editor } from '@tiptap/react';
import { cn } from '../../lib/utils';

/**
 * Curated color palette — soft enough for body text and pastel-ish for
 * highlights so dark and light themes look coherent.
 */
const COLORS = [
  { key: 'gray', text: '#6b7280', bg: '#f3f4f6' },
  { key: 'brown', text: '#92400e', bg: '#fef3c7' },
  { key: 'orange', text: '#c2410c', bg: '#ffedd5' },
  { key: 'yellow', text: '#a16207', bg: '#fef9c3' },
  { key: 'green', text: '#15803d', bg: '#dcfce7' },
  { key: 'blue', text: '#1d4ed8', bg: '#dbeafe' },
  { key: 'purple', text: '#7e22ce', bg: '#f3e8ff' },
  { key: 'red', text: '#b91c1c', bg: '#fee2e2' },
] as const;

interface Props {
  editor: Editor;
  /** Bumped by the parent on every editor state change so we re-evaluate active state. */
  stateTick: number;
}

/**
 * Text color + background highlight picker: a row of swatches for foreground,
 * a row of swatches for background, plus a "clear" affordance for each.
 */
export function ColorDropdown({ editor, stateTick }: Props) {
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

  void stateTick;
  const activeText = COLORS.find((c) => editor.isActive('textStyle', { color: c.text }));
  const activeBg = COLORS.find((c) => editor.isActive('highlight', { color: c.bg }));

  const setText = (color: string | null) => {
    const chain = editor.chain().focus();
    if (color === null) chain.unsetColor().run();
    else chain.setColor(color).run();
  };
  const setBg = (color: string | null) => {
    const chain = editor.chain().focus();
    if (color === null) chain.unsetHighlight().run();
    else chain.setHighlight({ color }).run();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-7 items-center gap-1.5 rounded px-2 text-[13px] transition-colors',
          open
            ? 'bg-(--bg-layer-1) text-(--txt-primary)'
            : 'text-(--txt-secondary) hover:bg-(--bg-layer-1-hover)',
        )}
        aria-label="Color"
      >
        Color
        <span
          className="grid size-5 place-items-center rounded border border-(--border-subtle)"
          style={{ backgroundColor: activeBg?.bg ?? 'transparent' }}
        >
          <ALargeSmall size={12} style={{ color: activeText?.text ?? 'currentColor' }} />
        </span>
        <ChevronDown size={12} />
      </button>
      {open ? (
        <div className="absolute top-full left-0 z-20 mt-1 w-72 space-y-3 rounded-md border border-(--border-subtle) bg-(--bg-surface-1) p-3 shadow-(--shadow-raised)">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-(--txt-tertiary) uppercase">
              Text color
            </p>
            <div className="flex items-center gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setText(c.text)}
                  title={c.key}
                  className={cn(
                    'size-6 rounded border border-(--border-subtle) transition-opacity hover:opacity-70',
                    activeText?.key === c.key && 'ring-2 ring-(--brand-default)',
                  )}
                  style={{ backgroundColor: c.text }}
                />
              ))}
              <button
                type="button"
                onClick={() => setText(null)}
                title="Clear text color"
                className="grid size-6 place-items-center rounded border border-(--border-subtle) text-(--txt-tertiary) hover:bg-(--bg-layer-1-hover)"
              >
                <Ban size={12} />
              </button>
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-(--txt-tertiary) uppercase">
              Background
            </p>
            <div className="flex items-center gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setBg(c.bg)}
                  title={c.key}
                  className={cn(
                    'size-6 rounded border border-(--border-subtle) transition-opacity hover:opacity-70',
                    activeBg?.key === c.key && 'ring-2 ring-(--brand-default)',
                  )}
                  style={{ backgroundColor: c.bg }}
                />
              ))}
              <button
                type="button"
                onClick={() => setBg(null)}
                title="Clear background"
                className="grid size-6 place-items-center rounded border border-(--border-subtle) text-(--txt-tertiary) hover:bg-(--bg-layer-1-hover)"
              >
                <Ban size={12} />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
