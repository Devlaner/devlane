import { useEffect, useRef } from 'react';
import { useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import { SlashCommand } from './slashCommands';
import { createMention } from './mentions';
import type { MentionItem } from './mentionTypes';

/** Treat empty variants and surrounding whitespace as the same value, so an
 *  autosave round-trip that echoes back semantically-identical HTML doesn't
 *  count as an external change. */
function normalize(html: string | undefined | null): string {
  const s = (html ?? '').trim();
  if (s === '' || s === '<p></p>' || s === '<p><br></p>') return '';
  return s;
}

export interface UsePageEditorOptions {
  /** Initial HTML to seed the editor with on mount. */
  initialHtml?: string;
  /** Placeholder text shown when the editor is empty. */
  placeholder?: string;
  /** Disable editing (e.g. while loading or when read-only). */
  readOnly?: boolean;
  /** Called on every content change with the latest HTML. */
  onUpdate?: (html: string) => void;
  /** Optional Ctrl/Cmd+S handler — also prevents the browser save dialog. */
  onSaveShortcut?: () => void;
  /** Workspace members offered by the @-mention menu. */
  mentionItems?: MentionItem[];
}

/**
 * Page editor singleton. Built on TipTap with a rich extension surface —
 * typography, color, alignment, lists, to-do lists, images, and tables — minus
 * collaboration (we use REST autosave instead of Yjs so the data layer stays
 * simple).
 *
 * The hook only constructs the editor; rendering is split into separate
 * `<PageEditorToolbar editor>` and `<PageEditorContent editor>` components so
 * a sticky toolbar can live above the scrollable page body.
 */
export function usePageEditor(opts: UsePageEditorOptions): Editor | null {
  const { initialHtml, placeholder, readOnly, onUpdate, onSaveShortcut, mentionItems } = opts;

  // The mention suggestion reads members through this ref so members that load
  // after the editor mounts still appear in the menu. Seeded from the initial
  // prop so already-cached members work on the very first "@". The getter is
  // only invoked by the ProseMirror suggestion plugin on input, never in render.
  const mentionItemsRef = useRef<MentionItem[]>(mentionItems ?? []);
  const getMentionItems = () => mentionItemsRef.current;

  // The last HTML we synced from `initialHtml`. Used to recognise an autosave
  // round-trip (the server echoing our own content back) so we don't reseed the
  // document and jump the caret mid-edit.
  const lastSyncedRef = useRef<string>(normalize(initialHtml));

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true, keepAttributes: true },
        orderedList: { keepMarks: true, keepAttributes: true },
        codeBlock: { HTMLAttributes: { class: 'page-code-block' } },
        heading: { levels: [1, 2, 3, 4, 5, 6] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Image.configure({ inline: false, allowBase64: true }),
      Table.configure({ resizable: true, HTMLAttributes: { class: 'page-table' } }),
      TableRow,
      TableHeader,
      TableCell,
      SlashCommand,
      // eslint-disable-next-line react-hooks/refs -- getter is invoked by the suggestion plugin on input, not during render
      createMention(getMentionItems),
      Placeholder.configure({
        placeholder: placeholder ?? 'Start writing… or press “/” for commands',
      }),
    ],
    content: initialHtml ?? '',
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: 'page-editor-content focus:outline-none',
      },
      handleKeyDown: (_view, event) => {
        if (!onSaveShortcut) return false;
        const key = event.key?.toLowerCase?.() ?? '';
        if ((event.metaKey || event.ctrlKey) && key === 's') {
          event.preventDefault();
          onSaveShortcut();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      onUpdate?.(ed.getHTML());
    },
  });

  // Keep the mention getter's data current without recreating the editor.
  useEffect(() => {
    mentionItemsRef.current = mentionItems ?? [];
  }, [mentionItems]);

  // Sync incoming initialHtml when the page changes (e.g. version restore or
  // route param swap). We avoid forcing a reset on every render to preserve
  // selection state during autosave round-trips.
  useEffect(() => {
    if (!editor || initialHtml === undefined) return;
    const incoming = normalize(initialHtml);
    // Skip when the incoming HTML already matches what's shown, or matches what
    // we last synced — e.g. an autosave echoing our own content back — so we
    // only reseed on a genuine external change (load, route swap, restore).
    if (incoming === normalize(editor.getHTML()) || incoming === lastSyncedRef.current) return;
    editor.commands.setContent(initialHtml || '', { emitUpdate: false });
    lastSyncedRef.current = incoming;
  }, [editor, initialHtml]);

  // Toggle editability when the readOnly prop flips (e.g. archive/unlock).
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  return editor;
}
