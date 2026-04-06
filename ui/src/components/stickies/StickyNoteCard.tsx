import { useCallback, useEffect, useRef, useState } from 'react';
import { Node as TiptapNode, mergeAttributes } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { StickyApiResponse } from '../../api/types';
import { stickiesService } from '../../services/stickiesService';

const STICKY_COLORS = [
  '#fff7cc',
  '#ffe4e6',
  '#e8f7d4',
  '#dff4ff',
  '#ede9ff',
  '#ffe8cc',
  '#f5f5f5',
  '#2a2a2a',
];

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function htmlToPlainText(html: string): string {
  if (!html) return '';
  if (typeof document === 'undefined') {
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  const root = document.createElement('div');
  root.innerHTML = html;
  return (root.textContent || '').replace(/\s+/g, ' ').trim();
}

function getInitialStickyHtml(sticky: StickyApiResponse): string {
  const description = (sticky.description || '').trim();
  const title = (sticky.name || '').trim();
  if (description) return description;
  if (title && title !== 'Untitled') return `<p>${escapeHtml(title)}</p>`;
  return '';
}

function getContrastTextColor(bgHex: string): string {
  const normalized = bgHex.replace('#', '');
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.55 ? '#1f2937' : '#f9fafb';
}

const TaskList = TiptapNode.create({
  name: 'taskList',
  group: 'block',
  content: 'taskItem+',
  parseHTML() {
    return [{ tag: 'ul[data-type="taskList"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['ul', mergeAttributes(HTMLAttributes, { 'data-type': 'taskList' }), 0];
  },
  addCommands() {
    return {
      toggleTaskList:
        () =>
        ({ commands }) =>
          commands.toggleList('taskList', 'taskItem'),
    };
  },
});

const TaskItem = TiptapNode.create({
  name: 'taskItem',
  content: 'paragraph block*',
  defining: true,
  addAttributes() {
    return {
      checked: {
        default: false,
        parseHTML: (el) => el.getAttribute('data-checked') === 'true',
        renderHTML: (attrs) => ({ 'data-checked': attrs.checked ? 'true' : 'false' }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'li[data-type="taskItem"]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'li',
      mergeAttributes(HTMLAttributes, { 'data-type': 'taskItem' }),
      [
        'label',
        [
          'input',
          {
            type: 'checkbox',
            checked: node.attrs.checked ? 'checked' : null,
          },
        ],
        ['span'],
      ],
      ['div', 0],
    ];
  },
});

const IconPalette = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <circle cx="13.5" cy="6.5" r=".5" />
    <circle cx="17.5" cy="10.5" r=".5" />
    <circle cx="8.5" cy="7.5" r=".5" />
    <circle cx="6.5" cy="12.5" r=".5" />
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.75-.2 2.5-.5" />
  </svg>
);
const IconBold = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
    <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
  </svg>
);
const IconItalic = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <line x1="19" y1="4" x2="10" y2="4" />
    <line x1="14" y1="20" x2="5" y2="20" />
    <line x1="15" y1="4" x2="9" y2="20" />
  </svg>
);
const IconTodo = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);
const IconTrash = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

type StickyNoteCardProps = {
  workspaceSlug: string;
  sticky: StickyApiResponse;
  onUpdate: (next: StickyApiResponse) => void;
  onDelete: (id: string) => void;
};

export function StickyNoteCard({ workspaceSlug, sticky, onUpdate, onDelete }: StickyNoteCardProps) {
  const initialHtml = getInitialStickyHtml(sticky);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [colorOpen, setColorOpen] = useState(false);
  const colorPanelRef = useRef<HTMLDivElement | null>(null);

  const persistSticky = useCallback(
    (html: string) => {
      const plain = htmlToPlainText(html).slice(0, 255);
      stickiesService
        .update(workspaceSlug, sticky.id, {
          description: html,
          name: plain || 'Untitled',
        })
        .then(onUpdate)
        .catch(() => {});
    },
    [workspaceSlug, sticky.id, onUpdate],
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true, keepAttributes: true },
        orderedList: { keepMarks: true, keepAttributes: true },
      }),
      TaskList,
      TaskItem,
    ],
    content: initialHtml,
    editorProps: {
      handleClickOn: (_view, _pos, node, nodePos, event) => {
        const target = event.target as HTMLElement | null;
        if (!target || target.tagName !== 'INPUT' || node.type.name !== 'taskItem') return false;
        const checked = !(node.attrs.checked as boolean);
        editor
          ?.chain()
          .focus()
          .command(({ tr, dispatch }) => {
            tr.setNodeMarkup(nodePos, undefined, { ...node.attrs, checked });
            if (dispatch) dispatch(tr);
            return true;
          })
          .run();
        return true;
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => persistSticky(html), 400);
    },
  });

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  const isDefaultDark =
    !sticky.color || sticky.color === '#0d0d0d' || sticky.color.toLowerCase() === '#0d0d0d';
  const textColor = getContrastTextColor(sticky.color || '#2a2a2a');

  const cycleColor = () => {
    setColorOpen((open) => !open);
  };

  const setStickyColor = (next: string) => {
    stickiesService
      .update(workspaceSlug, sticky.id, { color: next })
      .then(onUpdate)
      .catch(() => {});
    setColorOpen(false);
  };

  useEffect(() => {
    if (!colorOpen) return;
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (colorPanelRef.current?.contains(target)) return;
      setColorOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [colorOpen]);

  const tb =
    'rounded p-1 text-(--txt-icon-tertiary) hover:bg-(--bg-layer-transparent-hover) disabled:opacity-40';

  if (!editor) return null;

  return (
    <div
      className={`mb-4 inline-block w-full break-inside-avoid rounded-(--radius-md) border border-(--border-subtle) p-3 shadow-sm ${isDefaultDark ? 'bg-(--bg-layer-2)' : ''}`}
      style={
        isDefaultDark
          ? { backgroundColor: '#2a2a2a', color: '#f9fafb' }
          : { backgroundColor: sticky.color, color: textColor }
      }
    >
      <div className="min-h-0 text-sm">
        <EditorContent
          editor={editor}
          className="min-h-[4.5rem] max-w-none text-sm focus:outline-none [&_p]:my-0.5 [&_ul]:my-1 [&_ol]:my-1 [&_ul[data-type=taskList]]:list-none [&_ul[data-type=taskList]]:p-0 [&_ul[data-type=taskList]]:m-0 [&_li[data-type=taskItem]]:flex [&_li[data-type=taskItem]]:items-start [&_li[data-type=taskItem]]:gap-2 [&_li[data-type=taskItem]>label]:mt-1 [&_li[data-type=taskItem]>label>input]:h-3.5 [&_li[data-type=taskItem]>label>input]:w-3.5 [&_li[data-type=taskItem][data-checked=true]>div]:line-through [&_li[data-type=taskItem][data-checked=true]>div]:opacity-70"
        />
      </div>
      <div className="mt-2 flex shrink-0 items-center gap-1 border-t border-(--border-subtle) pt-2">
        <div className="relative" ref={colorPanelRef}>
          <button type="button" className={tb} aria-label="Change color" onClick={cycleColor}>
            <IconPalette />
          </button>
          {colorOpen && (
            <div className="absolute left-0 top-8 z-20 w-44 rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) p-2 shadow-(--shadow-overlay)">
              <p className="mb-2 text-xs font-medium text-(--txt-secondary)">Background color</p>
              <div className="grid grid-cols-6 gap-1.5">
                {STICKY_COLORS.map((color) => {
                  const active = (sticky.color || '#0d0d0d').toLowerCase() === color.toLowerCase();
                  return (
                    <button
                      key={color}
                      type="button"
                      aria-label={`Set color ${color}`}
                      className={`h-5 w-5 rounded border ${active ? 'border-(--border-strong)' : 'border-(--border-subtle)'}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setStickyColor(color)}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          className={tb}
          aria-label="Bold"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <IconBold />
        </button>
        <button
          type="button"
          className={tb}
          aria-label="Italic"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <IconItalic />
        </button>
        <button
          type="button"
          className={tb}
          aria-label="Todo list"
          onClick={() =>
            editor
              .chain()
              .focus()
              .toggleTaskList()
              .command(({ editor: e, tr, dispatch }) => {
                const { $from } = e.state.selection;
                const parent = $from.parent;
                const inTaskItem = parent.type.name === 'taskItem';
                if (!inTaskItem) {
                  return true;
                }
                const checked = !(parent.attrs.checked as boolean);
                const pos = $from.before();
                tr.setNodeMarkup(pos, undefined, { ...parent.attrs, checked });
                if (dispatch) dispatch(tr);
                return true;
              })
              .run()
          }
        >
          <IconTodo />
        </button>
        <button
          type="button"
          onClick={() => onDelete(sticky.id)}
          className={`${tb} ml-auto hover:text-(--txt-danger-primary)`}
          aria-label="Delete"
        >
          <IconTrash />
        </button>
      </div>
    </div>
  );
}
