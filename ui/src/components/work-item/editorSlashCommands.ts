/* eslint-disable @typescript-eslint/no-explicit-any -- TipTap suggestion lifecycle uses untyped hooks */
import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import type { Editor, Range } from '@tiptap/core';

interface SlashCommand {
  title: string;
  description: string;
  icon: string;
  command: (props: { editor: Editor; range: Range }) => void;
}

const COMMANDS: SlashCommand[] = [
  {
    title: 'Heading 1',
    description: 'Big section heading',
    icon: 'H1',
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run(),
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: 'H2',
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run(),
  },
  {
    title: 'Heading 3',
    description: 'Small section heading',
    icon: 'H3',
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 3 }).run(),
  },
  {
    title: 'Bullet list',
    description: 'A simple bullet list',
    icon: '••',
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: 'Numbered list',
    description: 'An ordered list',
    icon: '1.',
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: 'Quote',
    description: 'Block quote',
    icon: '❝',
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    title: 'Code block',
    description: 'Fenced code',
    icon: '</>',
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    title: 'Divider',
    description: 'Horizontal rule',
    icon: '—',
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
];

/**
 * TipTap extension that opens a slash-command palette when the user types `/`.
 * Like the @-mention popup it uses a vanilla DOM list — keyboard nav (↑↓ + Enter)
 * is wired so users never have to reach for the mouse.
 */
export function createSlashCommands() {
  return Extension.create({
    name: 'slashCommands',
    addOptions() {
      return {
        suggestion: {
          char: '/',
          command: ({ editor, range, props }: any) => {
            (props as SlashCommand).command({ editor, range });
          },
        },
      };
    },
    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          ...this.options.suggestion,
          items: ({ query }) => {
            const q = query.toLowerCase().trim();
            if (!q) return COMMANDS;
            return COMMANDS.filter(
              (c) => c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q),
            );
          },
          render: () => {
            let popup: HTMLDivElement | null = null;
            let cleanupClick: (() => void) | null = null;
            let selectedIndex = 0;
            let currentItems: SlashCommand[] = [];
            let currentCommand: ((item: SlashCommand) => void) | null = null;

            const renderPopup = () => {
              if (!popup) return;
              popup.innerHTML = '';
              if (currentItems.length === 0) {
                const empty = document.createElement('div');
                empty.textContent = 'No matches';
                empty.className = 'px-3 py-2 text-xs text-(--txt-tertiary)';
                popup.appendChild(empty);
                return;
              }
              currentItems.forEach((cmd, i) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = `flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${
                  i === selectedIndex
                    ? 'bg-(--bg-accent-subtle) text-(--txt-accent-primary)'
                    : 'text-(--txt-primary) hover:bg-(--bg-layer-1-hover)'
                }`;
                const icon = document.createElement('span');
                icon.className =
                  'inline-flex h-5 w-5 items-center justify-center rounded border border-(--border-subtle) text-[10px] font-semibold text-(--txt-icon-secondary)';
                icon.textContent = cmd.icon;
                btn.appendChild(icon);
                const body = document.createElement('span');
                body.className = 'min-w-0 flex-1';
                const t = document.createElement('span');
                t.className = 'block truncate';
                t.textContent = cmd.title;
                const d = document.createElement('span');
                d.className = 'block truncate text-[11px] text-(--txt-tertiary)';
                d.textContent = cmd.description;
                body.appendChild(t);
                body.appendChild(d);
                btn.appendChild(body);
                btn.addEventListener('mousedown', (e) => {
                  e.preventDefault();
                  currentCommand?.(cmd);
                });
                popup!.appendChild(btn);
              });
            };

            const positionPopup = (clientRect: () => DOMRect | null) => {
              if (!popup) return;
              const rect = clientRect();
              if (!rect) return;
              popup.style.left = `${Math.round(rect.left)}px`;
              popup.style.top = `${Math.round(rect.bottom + 4)}px`;
            };

            return {
              onStart: (props: any) => {
                currentItems = props.items as SlashCommand[];
                currentCommand = props.command as (item: SlashCommand) => void;
                selectedIndex = 0;
                popup = document.createElement('div');
                popup.className =
                  'fixed min-w-[260px] max-h-72 overflow-auto rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-1 shadow-(--shadow-raised)';
                popup.style.position = 'fixed';
                popup.style.zIndex = '9999';
                document.body.appendChild(popup);
                renderPopup();
                positionPopup(props.clientRect);

                const onClick = (e: MouseEvent) => {
                  if (popup && !popup.contains(e.target as Node)) cleanup();
                };
                document.addEventListener('mousedown', onClick);
                cleanupClick = () => document.removeEventListener('mousedown', onClick);
              },
              onUpdate: (props: any) => {
                currentItems = props.items as SlashCommand[];
                currentCommand = props.command as (item: SlashCommand) => void;
                if (selectedIndex >= currentItems.length) selectedIndex = 0;
                renderPopup();
                positionPopup(props.clientRect);
              },
              onKeyDown: (props: any) => {
                const e = props.event as KeyboardEvent;
                if (currentItems.length === 0) return false;
                if (e.key === 'ArrowDown') {
                  selectedIndex = (selectedIndex + 1) % currentItems.length;
                  renderPopup();
                  return true;
                }
                if (e.key === 'ArrowUp') {
                  selectedIndex = (selectedIndex - 1 + currentItems.length) % currentItems.length;
                  renderPopup();
                  return true;
                }
                if (e.key === 'Enter') {
                  const item = currentItems[selectedIndex];
                  if (item) {
                    currentCommand?.(item);
                    return true;
                  }
                }
                if (e.key === 'Escape') {
                  cleanup();
                  return true;
                }
                return false;
              },
              onExit: () => cleanup(),
            };

            function cleanup() {
              if (cleanupClick) {
                cleanupClick();
                cleanupClick = null;
              }
              if (popup) {
                popup.remove();
                popup = null;
              }
            }
          },
        }),
      ];
    },
  });
}
/* eslint-enable @typescript-eslint/no-explicit-any */
