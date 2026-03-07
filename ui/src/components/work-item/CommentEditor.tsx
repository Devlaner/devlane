import { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';

export interface CommentEditorProps {
  onSubmit: (contentHtml: string) => void | Promise<void>;
  isSubmitting?: boolean;
  initialHtml?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onCancel?: () => void;
  showShortcutHint?: boolean;
}

export function CommentEditor({
  onSubmit,
  isSubmitting = false,
  initialHtml,
  placeholder,
  autoFocus = false,
  onCancel,
  showShortcutHint = false,
}: CommentEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true, keepAttributes: true },
        orderedList: { keepMarks: true, keepAttributes: true },
        codeBlock: true,
      }),
      Underline,
      Placeholder.configure({
        placeholder: placeholder ?? 'Add comment',
      }),
    ],
    content: initialHtml || '',
    autofocus: autoFocus ? 'end' : false,
  });

  useEffect(() => {
    if (!editor) return;
    if (initialHtml !== undefined) {
      editor.commands.setContent(initialHtml || '');
    }
    return () => {
      editor.destroy();
    };
  }, [editor, initialHtml]);

  if (!editor) return null;

  const handleSubmit = () => {
    if (isSubmitting) return;
    const html = editor.getHTML().trim();
    const isEmpty = html === '<p></p>' || html === '';
    if (isEmpty) return;
    void onSubmit(html);
    editor.commands.clearContent();
  };

  const buttonBase =
    'inline-flex h-8 w-8 items-center justify-center rounded border border-transparent text-[var(--txt-icon-tertiary)] hover:bg-[var(--bg-layer-1-hover)] hover:text-[var(--txt-icon-secondary)] disabled:opacity-40';

  return (
    <div
      className="rounded-md bg-[var(--bg-surface-1)]"
    >
      <div className="flex items-center gap-1 border-b border-[var(--border-subtle)] px-2 py-1">
        <button
          type="button"
          className={buttonBase}
          onClick={() => editor.chain().focus().toggleBold().run()}
          aria-label="Bold"
        >
          <span className="font-semibold">B</span>
        </button>
        <button
          type="button"
          className={buttonBase}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          aria-label="Italic"
        >
          <span className="italic">I</span>
        </button>
        <button
          type="button"
          className={buttonBase}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          aria-label="Underline"
        >
          <span className="underline">U</span>
        </button>
        <button
          type="button"
          className={buttonBase}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          aria-label="Bullet list"
        >
          ••
        </button>
        <button
          type="button"
          className={buttonBase}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          aria-label="Numbered list"
        >
          1.
        </button>
        <button
          type="button"
          className={buttonBase}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          aria-label="Code block"
        >
          {'</>'}
        </button>
        <div className="ml-auto flex items-center gap-2 text-[11px] text-[var(--txt-tertiary)]">
          {showShortcutHint && (
            <span className="hidden sm:inline">Ctrl / Cmd + Enter to comment</span>
          )}
          {onCancel && (
            <button
              type="button"
              className="rounded px-2 py-1 text-xs hover:bg-[var(--bg-layer-1-hover)]"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md bg-[var(--bg-accent-primary)] px-3 py-1 text-xs font-medium text-[var(--txt-on-color)] hover:bg-[var(--bg-accent-primary-hover)] disabled:opacity-50"
            disabled={isSubmitting}
            onClick={handleSubmit}
          >
            Comment
          </button>
        </div>
      </div>
      <div className="px-3 py-2 text-sm">
        <EditorContent
          editor={editor}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault();
              handleSubmit();
            }
          }}
        />
      </div>
    </div>
  );
}

