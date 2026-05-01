import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { createMentionExtension, type MentionMember } from './editorMention';
import { createSlashCommands } from './editorSlashCommands';

const SAVE_DEBOUNCE_MS = 1500;

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface DescriptionEditorProps {
  /**
   * Initial HTML to seed the editor with. We snapshot this on first mount and
   * subsequent changes update only via `editor.setContent` when the prop
   * actually differs from the editor's current state.
   */
  initialHtml: string;
  /** Debounced auto-save callback. Receives HTML. */
  onSave: (html: string) => Promise<void> | void;
  /** Placeholder shown when empty. */
  placeholder?: string;
  /** Disable editing (e.g. while loading). */
  disabled?: boolean;
  /** Members available for @-mention. */
  mentionMembers?: MentionMember[];
}

/**
 * Rich-text editor for the issue description. Auto-saves on debounced change
 * so users don't need to remember to hit a Save button.
 *
 * Pattern matches Plane's `DescriptionInput` (TipTap + 1.5s debounce + status
 * indicator). The toolbar is a simplified version of CommentEditor's.
 */
export function DescriptionEditor({
  initialHtml,
  onSave,
  placeholder = 'Add a description…',
  disabled = false,
  mentionMembers,
}: DescriptionEditorProps) {
  const membersRef = useRef<MentionMember[]>(mentionMembers ?? []);
  useEffect(() => {
    membersRef.current = mentionMembers ?? [];
  }, [mentionMembers]);
  // The getter is only called inside TipTap's suggestion lifecycle (event-driven,
  // not during render). The lint rule below can't see that, so we silence it.
  const getMembers = useCallback(() => membersRef.current, []);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const lastSavedRef = useRef(normalize(initialHtml));
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushSave = useCallback(
    async (html: string) => {
      const normalized = normalize(html);
      if (normalized === lastSavedRef.current) return;
      setSaveState('saving');
      try {
        await onSave(html);
        lastSavedRef.current = normalized;
        setSaveState('saved');
      } catch {
        setSaveState('error');
      }
    },
    [onSave],
  );

  const mentionExt = useMemo(() => createMentionExtension(getMembers), [getMembers]);
  const slashExt = useMemo(() => createSlashCommands(), []);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true, keepAttributes: true },
        orderedList: { keepMarks: true, keepAttributes: true },
        codeBlock: {},
      }),
      Underline,
      Placeholder.configure({ placeholder }),
      mentionExt,
      slashExt,
    ],
    content: initialHtml || '',
    editable: !disabled,
    onUpdate: ({ editor: e }) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      const html = e.getHTML();
      debounceTimer.current = setTimeout(() => {
        void flushSave(html);
      }, SAVE_DEBOUNCE_MS);
    },
    onBlur: ({ editor: e }) => {
      // Flush on blur so the user sees "Saved" before navigating away.
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      void flushSave(e.getHTML());
    },
  });

  // Sync external changes (e.g. parent refetches description from the API).
  useEffect(() => {
    if (!editor) return;
    const incoming = normalize(initialHtml);
    if (incoming !== normalize(editor.getHTML()) && incoming !== lastSavedRef.current) {
      editor.commands.setContent(initialHtml || '');
      lastSavedRef.current = incoming;
    }
  }, [editor, initialHtml]);

  // Tear down the editor on unmount.
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      editor?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- editor identity is stable
  }, []);

  // Keep editable in sync with disabled prop.
  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  if (!editor) return null;

  const buttonBase =
    'inline-flex h-7 w-7 items-center justify-center rounded border border-transparent text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary) disabled:opacity-40';

  return (
    <div className="rounded-md">
      <div className="flex items-center gap-1 border-b border-(--border-subtle) pb-1 mb-2">
        <button
          type="button"
          className={buttonBase}
          onClick={() => editor.chain().focus().toggleBold().run()}
          aria-label="Bold"
          disabled={disabled}
        >
          <span className="text-xs font-semibold">B</span>
        </button>
        <button
          type="button"
          className={buttonBase}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          aria-label="Italic"
          disabled={disabled}
        >
          <span className="text-xs italic">I</span>
        </button>
        <button
          type="button"
          className={buttonBase}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          aria-label="Underline"
          disabled={disabled}
        >
          <span className="text-xs underline">U</span>
        </button>
        <button
          type="button"
          className={buttonBase}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          aria-label="Bullet list"
          disabled={disabled}
        >
          <span className="text-xs">••</span>
        </button>
        <button
          type="button"
          className={buttonBase}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          aria-label="Numbered list"
          disabled={disabled}
        >
          <span className="text-xs">1.</span>
        </button>
        <button
          type="button"
          className={buttonBase}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          aria-label="Code block"
          disabled={disabled}
        >
          <span className="text-xs">{'</>'}</span>
        </button>
        <div className="ml-auto text-[11px] text-(--txt-tertiary)">
          {saveState === 'saving' && 'Saving…'}
          {saveState === 'saved' && 'Saved'}
          {saveState === 'error' && (
            <span className="text-(--txt-danger-primary)">Failed to save</span>
          )}
        </div>
      </div>
      <div className="prose prose-sm min-h-24 max-w-none text-sm text-(--txt-primary) [&_a]:text-(--txt-accent-primary) [&_a]:underline [&_code]:rounded [&_code]:bg-(--bg-layer-1) [&_code]:px-1 [&_code]:py-0.5 [&_.ProseMirror]:outline-none">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

/**
 * Normalize a description HTML so empty-equivalent forms compare equal.
 * TipTap's empty doc serializes as `<p></p>`; we treat that, blank, and pure
 * whitespace as the same value to avoid spurious save calls on focus.
 */
function normalize(html: string | undefined | null): string {
  const s = (html ?? '').trim();
  if (s === '' || s === '<p></p>' || s === '<p><br></p>') return '';
  return s;
}
