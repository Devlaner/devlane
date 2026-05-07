import { useEffect, useRef, useState } from 'react';
import {
  CaseSensitive,
  ChevronDown,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  type LucideIcon,
} from 'lucide-react';
import type { Editor } from '@tiptap/react';
import { cn } from '../../lib/utils';

interface TypographyOption {
  key: 'paragraph' | 1 | 2 | 3 | 4 | 5 | 6;
  label: string;
  icon: LucideIcon;
}

const OPTIONS: TypographyOption[] = [
  { key: 'paragraph', label: 'Text', icon: CaseSensitive },
  { key: 1, label: 'Heading 1', icon: Heading1 },
  { key: 2, label: 'Heading 2', icon: Heading2 },
  { key: 3, label: 'Heading 3', icon: Heading3 },
  { key: 4, label: 'Heading 4', icon: Heading4 },
  { key: 5, label: 'Heading 5', icon: Heading5 },
  { key: 6, label: 'Heading 6', icon: Heading6 },
];

interface Props {
  editor: Editor;
  /** Bumped by the parent on every editor state change so we re-evaluate active state. */
  stateTick: number;
}

/**
 * "Text / Heading 1 / …" typography menu, equivalent to Plane's TYPOGRAPHY_ITEMS
 * dropdown. Clicking a heading sets the block; clicking "Text" reverts to a paragraph.
 */
export function TypographyDropdown({ editor, stateTick }: Props) {
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

  // Recompute active option whenever the editor state changes.
  void stateTick;
  const activeKey: TypographyOption['key'] =
    ([1, 2, 3, 4, 5, 6] as const).find((lvl) => editor.isActive('heading', { level: lvl })) ??
    'paragraph';
  const activeOption = OPTIONS.find((o) => o.key === activeKey) ?? OPTIONS[0];

  const apply = (key: TypographyOption['key']) => {
    setOpen(false);
    if (key === 'paragraph') {
      editor.chain().focus().setParagraph().run();
    } else {
      editor.chain().focus().toggleHeading({ level: key }).run();
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-7 w-24 items-center justify-between gap-2 rounded border border-(--border-subtle) px-2 text-[13px] whitespace-nowrap transition-colors',
          open
            ? 'bg-(--bg-layer-1) text-(--txt-primary)'
            : 'text-(--txt-secondary) hover:bg-(--bg-layer-1-hover)',
        )}
        aria-label="Text style"
      >
        <span className="truncate">{activeOption.label}</span>
        <ChevronDown size={12} className="shrink-0" />
      </button>
      {open ? (
        <div className="absolute top-full left-0 z-20 mt-1 w-44 rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-1 shadow-(--shadow-raised)">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isActive = opt.key === activeKey;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => apply(opt.key)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors',
                  isActive
                    ? 'bg-(--bg-layer-1) text-(--txt-primary)'
                    : 'text-(--txt-secondary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)',
                )}
              >
                <Icon size={14} className="shrink-0" />
                <span className="flex-1 truncate">{opt.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
