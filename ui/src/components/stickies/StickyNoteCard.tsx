import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { findParentNode } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import { TaskItem } from '@tiptap/extension-task-item';
import { TaskList } from '@tiptap/extension-task-list';
import StarterKit from '@tiptap/starter-kit';
import type { StickyApiResponse } from '../../api/types';
import { Tooltip } from '../ui/Tooltip';
import { stickiesService } from '../../services/stickiesService';
import {
  STICKY_BACKGROUND_COLORS_DARK,
  STICKY_BACKGROUND_COLORS_LIGHT,
  paletteLightHexForStored,
  resolveStickyBackgroundForDisplay,
} from './stickyPalette';

const StickyTaskList = TaskList.extend({
  addCommands() {
    return {
      toggleTaskList:
        () =>
        ({ state, chain, commands }) => {
          const taskListType = state.schema.nodes.taskList;
          const taskItemType = state.schema.nodes.taskItem;
          const listFound = findParentNode((n) => n.type === taskListType)(state.selection);
          if (listFound) {
            const itemFound = findParentNode((n) => n.type === taskItemType)(state.selection);
            if (itemFound) {
              return chain()
                .focus()
                .setNodeSelection(itemFound.pos)
                .toggleList('taskList', 'taskItem')
                .run();
            }
          }
          return commands.toggleList('taskList', 'taskItem');
        },
    };
  },
});

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

function looksLikeEditorOutputHtml(description: string): boolean {
  const t = description.trimStart().toLowerCase();
  return t.startsWith('<p') || t.startsWith('<ul') || t.startsWith('<ol') || t.startsWith('<h');
}

function normalizeStickyDescriptionToHtml(description: string): string {
  if (!description.trim()) return '';
  if (looksLikeEditorOutputHtml(description)) return description;
  const normalized = description.replace(/\r\n/g, '\n').trim();
  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((block) => block.split('\n').map(escapeHtml).join('<br />'))
    .filter(Boolean);
  return paragraphs.map((p) => `<p>${p}</p>`).join('');
}

function getInitialStickyHtml(sticky: StickyApiResponse): string {
  return getInitialStickyHtmlFromValues(sticky.description || '', sticky.name || '');
}

function getInitialStickyHtmlFromValues(descriptionValue: string, nameValue: string): string {
  const description = normalizeStickyDescriptionToHtml(descriptionValue);
  const title = nameValue.trim();
  if (description) return description;
  if (title && title !== 'Untitled') return `<p>${escapeHtml(title)}</p>`;
  return '';
}

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
  isDarkTheme: boolean;
  onUpdate: (next: StickyApiResponse) => void;
  onDelete: (id: string) => void;
};

export function StickyNoteCard({
  workspaceSlug,
  sticky,
  isDarkTheme,
  onUpdate,
  onDelete,
}: StickyNoteCardProps) {
  const safeSlug = workspaceSlug.trim();
  const initialHtml = getInitialStickyHtml(sticky);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedHtmlRef = useRef(initialHtml);
  const contentRequestIdRef = useRef(0);
  const colorRequestIdRef = useRef(0);
  const colorListboxId = useId();
  const [colorOpen, setColorOpen] = useState(false);
  const [contentSaveError, setContentSaveError] = useState(false);
  const colorPanelRef = useRef<HTMLDivElement | null>(null);

  const persistSticky = useCallback(
    (html: string) => {
      if (!safeSlug) return;
      const plain = htmlToPlainText(html).slice(0, 255);
      const requestId = ++contentRequestIdRef.current;
      stickiesService
        .update(safeSlug, sticky.id, {
          description: html,
          name: plain || 'Untitled',
        })
        .then((data) => {
          if (requestId !== contentRequestIdRef.current) return;
          setContentSaveError(false);
          onUpdate(data);
        })
        .catch((err) => {
          if (requestId !== contentRequestIdRef.current) return;
          // apiClient rejects with Error; no global toast — surface failure here
          console.error('Sticky autosave failed', err);
          setContentSaveError(true);
        });
    },
    [safeSlug, sticky.id, onUpdate],
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true, keepAttributes: true },
        orderedList: { keepMarks: true, keepAttributes: true },
      }),
      StickyTaskList.configure({
        HTMLAttributes: {
          class: 'not-prose list-none space-y-2 pl-2',
        },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'flex items-start gap-2',
        },
        a11y: {
          checkboxLabel: (node, checked) => {
            const text = node.textContent.replace(/\s+/g, ' ').trim() || 'empty task item';
            return checked ? `Completed task: ${text}` : `Task: ${text}`;
          },
        },
      }),
    ],
    content: initialHtml,
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

  useEffect(() => {
    if (!editor) return;
    const nextHtml = getInitialStickyHtmlFromValues(sticky.description || '', sticky.name || '');
    if (nextHtml === lastSyncedHtmlRef.current) return;
    if (editor.isFocused) return;
    if (editor.getHTML() === nextHtml) {
      lastSyncedHtmlRef.current = nextHtml;
      return;
    }
    editor.commands.setContent(nextHtml, { emitUpdate: false });
    lastSyncedHtmlRef.current = nextHtml;
  }, [editor, sticky.description, sticky.name]);

  const stickyBackground = resolveStickyBackgroundForDisplay(sticky.color, isDarkTheme);
  const storedLightHex = paletteLightHexForStored(sticky.color);

  const cycleColor = () => {
    setColorOpen((open) => !open);
  };

  const setStickyColor = (next: string) => {
    if (!safeSlug) return;
    const requestId = ++colorRequestIdRef.current;
    stickiesService
      .update(safeSlug, sticky.id, { color: next })
      .then((data) => {
        if (requestId !== colorRequestIdRef.current) return;
        onUpdate(data);
        setColorOpen(false);
      })
      .catch((err) => {
        if (requestId !== colorRequestIdRef.current) return;
        console.error('Sticky color update failed', err);
      });
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
  const isMac = typeof navigator !== 'undefined' && /mac|iphone|ipad|ipod/i.test(navigator.platform);
  const modKey = isMac ? 'Cmd' : 'Ctrl';
  const boldShortcut = `${modKey} + B`;
  const italicShortcut = `${modKey} + I`;
  const todoShortcut = `${modKey} + Shift + 9`;

  if (!editor) return null;
  if (!safeSlug) return null;

  return (
    <div
      className="mb-4 inline-block w-full break-inside-avoid rounded-(--radius-md) border border-(--border-subtle) p-3 text-(--txt-primary) shadow-sm"
      style={{ backgroundColor: stickyBackground }}
    >
      <div className="min-h-0 text-sm">
        <EditorContent
          editor={editor}
          className="sticky-note-editor-content min-h-[4.5rem] min-w-0 max-w-full overflow-hidden text-sm text-(--txt-primary) focus:outline-none [&_p]:my-0.5 [&_p]:break-words [&_ul]:my-1 [&_ol]:my-1 [&_ul[data-type=taskList]]:m-0 [&_ul[data-type=taskList]]:p-0 [&_li[data-type=taskItem]>label]:mt-0.5 [&_li[data-type=taskItem]>label>input]:h-3.5 [&_li[data-type=taskItem]>label>input]:w-3.5"
          style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
        />
        {contentSaveError ? (
          <p className="mt-1 text-xs text-(--txt-danger-primary)" role="alert">
            Could not save. Edit again to retry.
          </p>
        ) : null}
      </div>
      <div className="mt-2 flex shrink-0 items-center gap-1 pt-2">
        <div className="relative" ref={colorPanelRef}>
          <Tooltip content="Background color">
            <button
              type="button"
              className={tb}
              aria-label="Change color"
              aria-expanded={colorOpen}
              aria-haspopup="listbox"
              aria-controls={colorOpen ? colorListboxId : undefined}
              onClick={cycleColor}
            >
              <IconPalette />
            </button>
          </Tooltip>
          {colorOpen && (
            <div
              id={colorListboxId}
              role="listbox"
              aria-label="Background color"
              className="absolute left-0 top-8 z-20 w-44 rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) p-2 shadow-(--shadow-overlay)"
            >
              <p className="mb-2 text-xs font-medium text-(--txt-secondary)">Background color</p>
              <div className="grid grid-cols-6 gap-1.5">
                {STICKY_BACKGROUND_COLORS_LIGHT.map((lightHex, i) => {
                  const swatch = isDarkTheme ? STICKY_BACKGROUND_COLORS_DARK[i] : lightHex;
                  const active = storedLightHex !== null && storedLightHex === lightHex;
                  return (
                    <button
                      key={lightHex}
                      type="button"
                      role="option"
                      aria-selected={active}
                      aria-label={`Set sticky background slot ${i}`}
                      className={`h-5 w-5 rounded border ${active ? 'border-(--border-strong)' : 'border-(--border-subtle)'}`}
                      style={{ backgroundColor: swatch }}
                      onClick={() => setStickyColor(lightHex)}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <Tooltip
          content={
            <div className="text-center">
              <p>Bold</p>
              <p className="text-(--txt-tertiary)">{boldShortcut}</p>
            </div>
          }
        >
          <button
            type="button"
            className={tb}
            aria-label="Bold"
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <IconBold />
          </button>
        </Tooltip>
        <Tooltip
          content={
            <div className="text-center">
              <p>Italic</p>
              <p className="text-(--txt-tertiary)">{italicShortcut}</p>
            </div>
          }
        >
          <button
            type="button"
            className={tb}
            aria-label="Italic"
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <IconItalic />
          </button>
        </Tooltip>
        <Tooltip
          content={
            <div className="text-center">
              <p>To-do list</p>
              <p className="text-(--txt-tertiary)">{todoShortcut}</p>
            </div>
          }
        >
          <button
            type="button"
            className={tb}
            aria-label="Todo list"
            onClick={() => editor.chain().focus().toggleTaskList().run()}
          >
            <IconTodo />
          </button>
        </Tooltip>
        <Tooltip content="Delete sticky note">
          <button
            type="button"
            onClick={() => onDelete(sticky.id)}
            className={`${tb} ml-auto hover:text-(--txt-danger-primary)`}
            aria-label="Delete"
          >
            <IconTrash />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
