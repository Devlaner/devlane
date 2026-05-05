import { useEffect } from 'react';
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
}

/**
 * Page editor singleton. Built on TipTap with the same extension surface
 * as Plane's document editor — typography, color, alignment, lists,
 * to-do lists, images, and tables — minus collaboration (we use REST autosave
 * instead of Yjs so the data layer stays simple).
 *
 * The hook only constructs the editor; rendering is split into separate
 * `<PageEditorToolbar editor>` and `<PageEditorContent editor>` components so
 * a sticky toolbar can live above the scrollable page body.
 */
export function usePageEditor(opts: UsePageEditorOptions): Editor | null {
  const { initialHtml, placeholder, readOnly, onUpdate, onSaveShortcut } = opts;

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

  // Sync incoming initialHtml when the page changes (e.g. version restore or
  // route param swap). We avoid forcing a reset on every render to preserve
  // selection state during autosave round-trips.
  useEffect(() => {
    if (!editor || initialHtml === undefined) return;
    const current = editor.getHTML();
    if (current === initialHtml) return;
    editor.commands.setContent(initialHtml || '', { emitUpdate: false });
  }, [editor, initialHtml]);

  // Toggle editability when the readOnly prop flips (e.g. archive/unlock).
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  return editor;
}
