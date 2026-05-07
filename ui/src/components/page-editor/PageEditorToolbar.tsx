import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Code2,
  Image as ImageIcon,
  Italic,
  List,
  ListOrdered,
  ListTodo,
  Strikethrough,
  Table as TableIcon,
  TextQuote,
  Underline,
  type LucideIcon,
} from 'lucide-react';
import type { Editor } from '@tiptap/react';
import { Tooltip } from '../ui/Tooltip';
import { cn } from '../../lib/utils';
import { TypographyDropdown } from './TypographyDropdown';
import { ColorDropdown } from './ColorDropdown';

interface ToolbarItem {
  key: string;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
  isActive: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
  disabled?: (editor: Editor) => boolean;
}

const BASIC_MARKS: ToolbarItem[] = [
  {
    key: 'bold',
    label: 'Bold',
    icon: Bold,
    shortcut: 'Cmd+B',
    isActive: (e) => e.isActive('bold'),
    run: (e) => e.chain().focus().toggleBold().run(),
  },
  {
    key: 'italic',
    label: 'Italic',
    icon: Italic,
    shortcut: 'Cmd+I',
    isActive: (e) => e.isActive('italic'),
    run: (e) => e.chain().focus().toggleItalic().run(),
  },
  {
    key: 'underline',
    label: 'Underline',
    icon: Underline,
    shortcut: 'Cmd+U',
    isActive: (e) => e.isActive('underline'),
    run: (e) => e.chain().focus().toggleUnderline().run(),
  },
  {
    key: 'strike',
    label: 'Strikethrough',
    icon: Strikethrough,
    shortcut: 'Cmd+Shift+S',
    isActive: (e) => e.isActive('strike'),
    run: (e) => e.chain().focus().toggleStrike().run(),
  },
];

const ALIGNMENT: ToolbarItem[] = [
  {
    key: 'align-left',
    label: 'Left align',
    icon: AlignLeft,
    isActive: (e) => e.isActive({ textAlign: 'left' }),
    run: (e) => e.chain().focus().setTextAlign('left').run(),
  },
  {
    key: 'align-center',
    label: 'Center align',
    icon: AlignCenter,
    isActive: (e) => e.isActive({ textAlign: 'center' }),
    run: (e) => e.chain().focus().setTextAlign('center').run(),
  },
  {
    key: 'align-right',
    label: 'Right align',
    icon: AlignRight,
    isActive: (e) => e.isActive({ textAlign: 'right' }),
    run: (e) => e.chain().focus().setTextAlign('right').run(),
  },
];

const LIST_ITEMS: ToolbarItem[] = [
  {
    key: 'numbered-list',
    label: 'Numbered list',
    icon: ListOrdered,
    shortcut: 'Cmd+Shift+7',
    isActive: (e) => e.isActive('orderedList'),
    run: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    key: 'bulleted-list',
    label: 'Bulleted list',
    icon: List,
    shortcut: 'Cmd+Shift+8',
    isActive: (e) => e.isActive('bulletList'),
    run: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    key: 'todo-list',
    label: 'To-do list',
    icon: ListTodo,
    shortcut: 'Cmd+Shift+9',
    isActive: (e) => e.isActive('taskList'),
    run: (e) => e.chain().focus().toggleTaskList().run(),
  },
];

const TEXT_BLOCKS: ToolbarItem[] = [
  {
    key: 'quote',
    label: 'Quote',
    icon: TextQuote,
    isActive: (e) => e.isActive('blockquote'),
    run: (e) => e.chain().focus().toggleBlockquote().run(),
  },
  {
    key: 'code-inline',
    label: 'Inline code',
    icon: Code,
    isActive: (e) => e.isActive('code'),
    run: (e) => e.chain().focus().toggleCode().run(),
  },
  {
    key: 'code-block',
    label: 'Code block',
    icon: Code2,
    isActive: (e) => e.isActive('codeBlock'),
    run: (e) => e.chain().focus().toggleCodeBlock().run(),
  },
];

const COMPLEX: ToolbarItem[] = [
  {
    key: 'table',
    label: 'Insert table',
    icon: TableIcon,
    isActive: (e) => e.isActive('table'),
    run: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    key: 'image',
    label: 'Insert image',
    icon: ImageIcon,
    isActive: () => false,
    run: (e) => {
      const url = window.prompt('Image URL');
      if (!url) return;
      e.chain().focus().setImage({ src: url }).run();
    },
  },
];

const GROUPS: ToolbarItem[][] = [BASIC_MARKS, ALIGNMENT, LIST_ITEMS, TEXT_BLOCKS, COMPLEX];

interface ToolbarButtonProps {
  item: ToolbarItem;
  editor: Editor;
}

function ToolbarButton({ item, editor }: ToolbarButtonProps) {
  const Icon = item.icon;
  const active = item.isActive(editor);
  const disabled = item.disabled?.(editor) ?? false;
  return (
    <Tooltip
      content={
        <span className="flex flex-col gap-0.5 text-center">
          <span className="font-medium">{item.label}</span>
          {item.shortcut ? <kbd className="text-(--txt-tertiary)">{item.shortcut}</kbd> : null}
        </span>
      }
    >
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => item.run(editor)}
        disabled={disabled}
        aria-label={item.label}
        aria-pressed={active}
        className={cn(
          'grid size-7 shrink-0 place-items-center rounded transition-colors disabled:opacity-40',
          active
            ? 'bg-(--bg-layer-1) text-(--txt-primary)'
            : 'text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)',
        )}
      >
        <Icon size={15} />
      </button>
    </Tooltip>
  );
}

interface Props {
  editor: Editor | null;
  className?: string;
  /**
   * Optional content rendered at the far right of the toolbar row (e.g. a
   * side-panel toggle). It is anchored to the right while the toolbar items
   * stay centered. Plane's page-editor lays out the panel toggle this way.
   */
  endSlot?: ReactNode;
}

/**
 * Plane-style page toolbar. Mounts above the page content and stays in sync
 * with the editor's selection so active marks/blocks render highlighted.
 */
export function PageEditorToolbar({ editor, className, endSlot }: Props) {
  // Subscribe to selection / transaction events so each button can re-render its
  // active state. We don't extract individual flags here — re-rendering the row
  // on every transaction is cheap, and child buttons use editor.isActive directly.
  const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!editor) return undefined;
    editor.on('transaction', bump);
    editor.on('selectionUpdate', bump);
    return () => {
      editor.off('transaction', bump);
      editor.off('selectionUpdate', bump);
    };
  }, [editor, bump]);

  if (!editor) return null;

  return (
    <div
      // Full-width row so the bottom border spans the page; an inner three-
      // column layout keeps the toolbar items centered while reserving room
      // for an optional `endSlot` (the side-panel toggle in Plane's design).
      // overflow stays visible (no overflow-x-auto) so dropdown panels aren't
      // clipped by the toolbar's stacking context.
      className={cn(
        'relative w-full border-b border-(--border-subtle) bg-(--bg-canvas) px-(--padding-page) py-2',
        className,
      )}
    >
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-1 gap-y-1">
        <TypographyDropdown editor={editor} stateTick={tick} />
        <Divider />
        <ColorDropdown editor={editor} stateTick={tick} />
        {GROUPS.map((group, idx) => (
          <div key={idx} className="flex items-center gap-0.5">
            <Divider />
            {group.map((item) => (
              <ToolbarButton key={item.key} item={item} editor={editor} />
            ))}
          </div>
        ))}
      </div>
      {endSlot ? (
        <div className="absolute inset-y-0 right-(--padding-page) flex items-center">{endSlot}</div>
      ) : null}
    </div>
  );
}

/** Vertical 1px divider between toolbar groups. */
function Divider() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-(--border-subtle)" />;
}
