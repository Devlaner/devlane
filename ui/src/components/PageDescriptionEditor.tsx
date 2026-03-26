import { forwardRef, useEffect, useImperativeHandle } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { cn } from '../lib/utils';

export type PageDescriptionEditorHandle = {
  getHtml: () => string;
  isEmpty: () => boolean;
  focus: () => void;
  setHtml: (html: string) => void;
};

export type PageDescriptionEditorProps = {
  initialHtml?: string;
  placeholder?: string;
  autoFocus?: boolean;
  readOnly?: boolean;
  className?: string;
  /**
   * Optional keyboard shortcut handler.
   * If provided, pressing `Ctrl/Cmd + S` triggers it (default: prevent browser save dialog).
   */
  onSaveShortcut?: () => void;
};

export const PageDescriptionEditor = forwardRef<
  PageDescriptionEditorHandle,
  PageDescriptionEditorProps
>(
  (
    {
      initialHtml,
      placeholder,
      autoFocus,
      readOnly,
      className,
      onSaveShortcut,
    }: PageDescriptionEditorProps,
    ref,
  ) => {
    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          bulletList: { keepMarks: true, keepAttributes: true },
          orderedList: { keepMarks: true, keepAttributes: true },
          codeBlock: {},
        }),
        Underline,
        Placeholder.configure({
          placeholder: placeholder ?? 'Write something…',
        }),
      ],
      content: initialHtml ?? '',
      editable: !readOnly,
      autofocus: autoFocus ? 'end' : false,
    });

    useEffect(() => {
      if (!editor) return;
      // keep editor content in sync when parent loads data
      if (initialHtml !== undefined) {
        editor.commands.setContent(initialHtml || '');
      }
    }, [editor, initialHtml]);

    useImperativeHandle(
      ref,
      () => ({
        getHtml: () => editor?.getHTML() ?? '',
        isEmpty: () => {
          const html = (editor?.getHTML() ?? '').trim();
          return html === '' || html === '<p></p>';
        },
        focus: () => editor?.commands.focus(),
        setHtml: (html: string) => editor?.commands.setContent(html ?? ''),
      }),
      [editor],
    );

    if (!editor) return null;

    const buttonBase =
      'inline-flex h-8 w-8 items-center justify-center rounded border border-transparent text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary) disabled:opacity-40';

    return (
      <div
        className={cn('rounded-md border border-(--border-subtle) bg-(--bg-surface-1)', className)}
      >
        <div className="flex items-center gap-1 border-b border-(--border-subtle) px-2 py-1">
          <button
            type="button"
            className={buttonBase}
            onClick={() => editor.chain().focus().toggleBold().run()}
            aria-label="Bold"
            disabled={readOnly}
          >
            <span className="font-semibold">B</span>
          </button>
          <button
            type="button"
            className={buttonBase}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            aria-label="Italic"
            disabled={readOnly}
          >
            <span className="italic">I</span>
          </button>
          <button
            type="button"
            className={buttonBase}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            aria-label="Underline"
            disabled={readOnly}
          >
            <span className="underline">U</span>
          </button>
          <button
            type="button"
            className={buttonBase}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            aria-label="Bullet list"
            disabled={readOnly}
          >
            ••
          </button>
          <button
            type="button"
            className={buttonBase}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            aria-label="Numbered list"
            disabled={readOnly}
          >
            1.
          </button>
          <button
            type="button"
            className={buttonBase}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            aria-label="Code block"
            disabled={readOnly}
          >
            {'</>'}
          </button>
          {onSaveShortcut && (
            <span className="ml-auto hidden text-xs text-(--txt-tertiary) sm:inline">
              Ctrl/Cmd + S to save
            </span>
          )}
        </div>
        <div className="px-3 py-2">
          <EditorContent
            editor={editor}
            className="min-h-70 prose prose-sm max-w-none text-(--txt-primary) focus:outline-none"
            onKeyDown={(event) => {
              if (!onSaveShortcut) return;
              const key = event.key?.toLowerCase?.() ?? '';
              if ((event.metaKey || event.ctrlKey) && key === 's') {
                event.preventDefault();
                onSaveShortcut();
              }
            }}
          />
        </div>
      </div>
    );
  },
);

PageDescriptionEditor.displayName = 'PageDescriptionEditor';
