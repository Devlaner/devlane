import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  ListChecks,
  Code2,
  Quote,
  Globe,
  Lock,
  ArrowUp,
} from 'lucide-react';
import { createMentionExtension, type MentionMember } from './editorMention';

export interface CommentEditorProps {
  onSubmit: (contentHtml: string, access: 'INTERNAL' | 'EXTERNAL') => void | Promise<void>;
  isSubmitting?: boolean;
  initialHtml?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onCancel?: () => void;
  showShortcutHint?: boolean;
  /** Members available for @-mention. When empty, mentions are not enabled. */
  mentionMembers?: MentionMember[];
  /** Show the INTERNAL/EXTERNAL access toggle. Defaults to false (only the
   *  bottom-of-page composer needs it; inline edit doesn't change access). */
  showAccessToggle?: boolean;
  /** Initial access value when showAccessToggle is true. */
  initialAccess?: 'INTERNAL' | 'EXTERNAL';
  /** Label for the primary submit button. Defaults to "Send". */
  submitLabel?: string;
}

export function CommentEditor({
  onSubmit,
  isSubmitting = false,
  initialHtml,
  placeholder,
  autoFocus = false,
  onCancel,
  showShortcutHint = false,
  showAccessToggle = false,
  initialAccess = 'INTERNAL',
  mentionMembers,
  submitLabel,
}: CommentEditorProps) {
  const [access, setAccess] = useState<'INTERNAL' | 'EXTERNAL'>(initialAccess);
  const [isEmpty, setIsEmpty] = useState(true);
  const membersRef = useRef<MentionMember[]>(mentionMembers ?? []);
  useEffect(() => {
    membersRef.current = mentionMembers ?? [];
  }, [mentionMembers]);
  // The getter is only called inside TipTap's suggestion lifecycle (event-driven,
  // not during render). The lint rule below can't see that, so we silence it.
  const getMembers = useCallback(() => membersRef.current, []);
  // eslint-disable-next-line react-hooks/refs -- ref read happens inside async editor callbacks
  const mentionExt = useMemo(() => createMentionExtension(getMembers), [getMembers]);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true, keepAttributes: true },
        orderedList: { keepMarks: true, keepAttributes: true },
        codeBlock: {},
      }),
      Underline,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({
        placeholder: placeholder ?? 'Add comment',
      }),
      mentionExt,
    ],
    content: initialHtml || '',
    autofocus: autoFocus ? 'end' : false,
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML().trim();
      setIsEmpty(html === '<p></p>' || html === '');
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (initialHtml !== undefined) {
      editor.commands.setContent(initialHtml || '');
      const html = editor.getHTML().trim();
      setIsEmpty(html === '<p></p>' || html === '');
    }
    return () => {
      editor.destroy();
    };
  }, [editor, initialHtml]);

  if (!editor) return null;

  const handleSubmit = () => {
    if (isSubmitting) return;
    const html = editor.getHTML().trim();
    if (html === '<p></p>' || html === '') return;
    void onSubmit(html, access);
    editor.commands.clearContent();
    setIsEmpty(true);
  };

  const submitDisabled = isSubmitting || isEmpty;

  return (
    <div className="rounded-md border border-(--border-subtle) bg-(--bg-surface-1) transition-colors focus-within:border-(--bg-accent-primary)/40 focus-within:shadow-[0_0_0_3px_rgba(79,70,229,0.12)]">
      <div className="prose prose-sm max-w-none px-3 py-2 text-sm text-(--txt-primary) [&_.ProseMirror]:min-h-[2.5rem] [&_.ProseMirror]:outline-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-(--txt-tertiary) [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_a]:text-(--txt-accent-primary) [&_a]:underline [&_code]:rounded [&_code]:bg-(--bg-layer-1) [&_code]:px-1 [&_code]:py-0.5 [&_blockquote]:border-l-2 [&_blockquote]:border-(--border-subtle) [&_blockquote]:pl-3 [&_blockquote]:text-(--txt-secondary) [&_ul[data-type=taskList]]:list-none [&_ul[data-type=taskList]]:pl-0 [&_ul[data-type=taskList]_li]:flex [&_ul[data-type=taskList]_li]:gap-2">
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
      <div className="flex h-9 items-center gap-1 overflow-x-auto border-t border-(--border-subtle) px-1.5">
        {showAccessToggle && (
          <>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[11px] text-(--txt-secondary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)"
              onClick={() => setAccess((a) => (a === 'INTERNAL' ? 'EXTERNAL' : 'INTERNAL'))}
              title={
                access === 'INTERNAL'
                  ? 'Internal — only workspace members'
                  : 'External — visible to guests / public boards'
              }
              aria-label="Toggle comment visibility"
            >
              {access === 'INTERNAL' ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
              <span>{access === 'INTERNAL' ? 'Internal' : 'External'}</span>
            </button>
            <Divider />
          </>
        )}

        <ToolbarButton
          editor={editor}
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          label="Bold"
          shortcut="Ctrl+B"
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          label="Italic"
          shortcut="Ctrl+I"
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive('underline')}
          label="Underline"
          shortcut="Ctrl+U"
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          label="Strikethrough"
          shortcut="Ctrl+Shift+X"
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          editor={editor}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          label="Bullet list"
          shortcut="Ctrl+Shift+8"
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          label="Numbered list"
          shortcut="Ctrl+Shift+7"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          isActive={editor.isActive('taskList')}
          label="To-do list"
          shortcut="Ctrl+Shift+9"
        >
          <ListChecks className="h-3.5 w-3.5" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          editor={editor}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive('blockquote')}
          label="Quote"
          shortcut="Ctrl+Shift+B"
        >
          <Quote className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          isActive={editor.isActive('codeBlock')}
          label="Code block"
          shortcut="Ctrl+Alt+C"
        >
          <Code2 className="h-3.5 w-3.5" />
        </ToolbarButton>

        <div className="ml-auto flex items-center gap-2 pl-2">
          {showShortcutHint && (
            <span className="hidden text-[11px] text-(--txt-tertiary) sm:inline">
              Ctrl + Enter to send
            </span>
          )}
          {onCancel && (
            <button
              type="button"
              className="rounded px-2 py-1 text-xs text-(--txt-secondary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            className="inline-flex h-7 items-center justify-center gap-1 rounded-md bg-(--bg-accent-primary) px-2.5 text-xs font-medium text-(--txt-on-color) transition-colors hover:bg-(--bg-accent-primary-hover) disabled:cursor-not-allowed disabled:opacity-40"
            disabled={submitDisabled}
            onClick={handleSubmit}
            title="Send (Ctrl + Enter)"
            aria-label="Send comment"
          >
            {isSubmitting ? (
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-(--txt-on-color) border-t-transparent" />
            ) : (
              <ArrowUp className="h-3.5 w-3.5" />
            )}
            <span>{submitLabel ?? 'Send'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function Divider() {
  return <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-(--border-subtle)" />;
}

interface ToolbarButtonProps {
  editor: Editor;
  onClick: () => void;
  isActive: boolean;
  label: string;
  shortcut?: string;
  children: React.ReactNode;
}

function ToolbarButton({ onClick, isActive, label, shortcut, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      className={
        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded transition-colors ' +
        (isActive
          ? 'bg-(--bg-layer-1) text-(--txt-primary)'
          : 'text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)')
      }
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-label={label}
      aria-pressed={isActive}
    >
      {children}
    </button>
  );
}
