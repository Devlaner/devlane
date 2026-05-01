/* eslint-disable @typescript-eslint/no-explicit-any -- TipTap suggestion lifecycle uses untyped hooks */
import Mention from '@tiptap/extension-mention';
import type { Editor } from '@tiptap/core';

export interface MentionMember {
  id: string;
  label: string;
}

/**
 * TipTap @-mention extension with a minimal vanilla-DOM suggestion popup.
 *
 * Why vanilla DOM and not a React portal: the TipTap Suggestion plugin's
 * `render()` returns lifecycle callbacks driven by the editor's transaction
 * loop. A React-portal-based popup would need a separate root re-mount on
 * every transaction; the DOM popup is simpler and keeps the component file
 * focused. Keyboard nav (↑↓ + Enter) wired below; Escape closes.
 *
 * Inserts a styled `<span class="mention">@Name</span>` node — read by
 * editor.getHTML() and rendered as text in the comment thread.
 */
export function createMentionExtension(getMembers: () => MentionMember[]) {
  return Mention.configure({
    HTMLAttributes: {
      class: 'rounded bg-(--bg-accent-subtle) px-1 py-0.5 text-(--txt-accent-primary) font-medium',
    },
    suggestion: {
      char: '@',
      items: ({ query }) => {
        const q = query.toLowerCase().trim();
        const members = getMembers();
        if (!q) return members.slice(0, 8);
        return members.filter((m) => m.label.toLowerCase().includes(q)).slice(0, 8);
      },
      render: () => {
        let popup: HTMLDivElement | null = null;
        let cleanupClick: (() => void) | null = null;
        let selectedIndex = 0;
        let currentItems: MentionMember[] = [];
        let currentCommand: ((item: { id: string; label: string }) => void) | null = null;

        const renderPopup = () => {
          if (!popup) return;
          popup.innerHTML = '';
          if (currentItems.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'No members';
            empty.className = 'px-3 py-2 text-xs text-(--txt-tertiary)';
            popup.appendChild(empty);
            return;
          }
          currentItems.forEach((item, i) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = item.label;
            btn.className = `block w-full px-3 py-1.5 text-left text-sm ${
              i === selectedIndex
                ? 'bg-(--bg-accent-subtle) text-(--txt-accent-primary)'
                : 'text-(--txt-primary) hover:bg-(--bg-layer-1-hover)'
            }`;
            btn.addEventListener('mousedown', (e) => {
              e.preventDefault();
              currentCommand?.({ id: item.id, label: item.label });
            });
            popup!.appendChild(btn);
          });
        };

        const positionPopup = (clientRect: () => DOMRect | null) => {
          if (!popup) return;
          const rect = clientRect();
          if (!rect) return;
          const margin = 4;
          popup.style.left = `${Math.round(rect.left)}px`;
          popup.style.top = `${Math.round(rect.bottom + margin)}px`;
        };

        return {
          onStart: (props: any) => {
            currentItems = props.items;
            currentCommand = props.command;
            selectedIndex = 0;

            popup = document.createElement('div');
            popup.className =
              'fixed z-(--z-modal) min-w-[180px] max-h-72 overflow-auto rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-1 shadow-(--shadow-raised)';
            popup.style.position = 'fixed';
            popup.style.zIndex = '9999';
            document.body.appendChild(popup);
            renderPopup();
            positionPopup(props.clientRect);

            const onClick = (e: MouseEvent) => {
              if (popup && !popup.contains(e.target as Node)) {
                cleanup();
              }
            };
            document.addEventListener('mousedown', onClick);
            cleanupClick = () => document.removeEventListener('mousedown', onClick);
          },
          onUpdate: (props: any) => {
            currentItems = props.items;
            currentCommand = props.command;
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
                currentCommand?.({ id: item.id, label: item.label });
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
    },
  });
}

/** Convenience: insert a mention programmatically (used by the toolbar shortcut). */
export function insertMention(editor: Editor, member: MentionMember) {
  editor
    .chain()
    .focus()
    .insertContent({
      type: 'mention',
      attrs: { id: member.id, label: member.label },
    })
    .insertContent(' ')
    .run();
}
/* eslint-enable @typescript-eslint/no-explicit-any */
