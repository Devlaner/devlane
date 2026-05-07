import { EditorContent, type Editor } from '@tiptap/react';
import { cn } from '../../lib/utils';

interface Props {
  editor: Editor | null;
  className?: string;
}

/**
 * Renders the TipTap content area for a page. Uses Tailwind's `prose` plugin
 * for typographic defaults and adds page-specific tweaks for tables, code
 * blocks, todo lists, and image alignment so the rendered output matches the
 * editing experience.
 */
export function PageEditorContent({ editor, className }: Props) {
  if (!editor) return null;
  return (
    <EditorContent
      editor={editor}
      className={cn(
        'page-editor-prose prose prose-sm max-w-none text-(--txt-primary) focus:outline-none',
        className,
      )}
    />
  );
}
