import { Extension, type Range } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import i18n from 'i18next';
import { useTranslation } from 'react-i18next';
import type { Editor } from '@tiptap/react';
import {
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Table as TableIcon,
  TextQuote,
  Type,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { safeUrl } from '../../lib/sanitize';
import {
  createSuggestionRenderer,
  useActiveItemScroll,
  type SuggestionMenuProps,
} from './suggestionPopup';

interface SlashItem {
  key: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  keywords: string[];
  run: (editor: Editor, range: Range) => void;
}

const ITEMS: SlashItem[] = [
  {
    key: 'text',
    title: 'Text',
    subtitle: 'Plain paragraph',
    icon: Type,
    keywords: ['paragraph', 'body'],
    run: (editor, range) => editor.chain().focus().deleteRange(range).setParagraph().run(),
  },
  {
    key: 'heading1',
    title: 'Heading 1',
    subtitle: 'Large section heading',
    icon: Heading1,
    keywords: ['h1', 'title'],
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run(),
  },
  {
    key: 'heading2',
    title: 'Heading 2',
    subtitle: 'Medium section heading',
    icon: Heading2,
    keywords: ['h2', 'subtitle'],
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run(),
  },
  {
    key: 'heading3',
    title: 'Heading 3',
    subtitle: 'Small section heading',
    icon: Heading3,
    keywords: ['h3'],
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run(),
  },
  {
    key: 'bulletList',
    title: 'Bulleted list',
    subtitle: 'Unordered list',
    icon: List,
    keywords: ['ul', 'unordered', 'bullet'],
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    key: 'numberedList',
    title: 'Numbered list',
    subtitle: 'Ordered list',
    icon: ListOrdered,
    keywords: ['ol', 'ordered', 'number'],
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    key: 'todoList',
    title: 'To-do list',
    subtitle: 'Checklist',
    icon: ListTodo,
    keywords: ['task', 'checkbox', 'todo'],
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    key: 'quote',
    title: 'Quote',
    subtitle: 'Block quote',
    icon: TextQuote,
    keywords: ['blockquote', 'citation'],
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    key: 'codeBlock',
    title: 'Code block',
    subtitle: 'Formatted code',
    icon: Code2,
    keywords: ['pre', 'snippet'],
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    key: 'table',
    title: 'Table',
    subtitle: '3x3 table',
    icon: TableIcon,
    keywords: ['grid'],
    run: (editor, range) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run(),
  },
  {
    key: 'image',
    title: 'Image',
    subtitle: 'Embed by URL',
    icon: ImageIcon,
    keywords: ['picture', 'photo', 'embed'],
    run: (editor, range) => {
      const input = window.prompt(i18n.t('editor.slash.imagePrompt', 'Image URL'))?.trim();
      const chain = editor.chain().focus().deleteRange(range);
      // Only allow http(s) or site-relative URLs so an image can't smuggle a
      // javascript: / data: payload into an <img src>.
      const src = input ? safeUrl(input) : '#';
      if (input && src !== '#' && !src.startsWith('mailto:')) chain.setImage({ src }).run();
      else chain.run();
    },
  },
  {
    key: 'divider',
    title: 'Divider',
    subtitle: 'Horizontal rule',
    icon: Minus,
    keywords: ['hr', 'separator', 'line'],
    run: (editor, range) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
];

function filterItems(query: string): SlashItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return ITEMS;
  return ITEMS.filter(
    (i) => i.title.toLowerCase().includes(q) || i.keywords.some((k) => k.includes(q)),
  );
}

function SlashMenu({ items, selectedIndex, onSelect }: SuggestionMenuProps<SlashItem>) {
  const { t } = useTranslation();
  const listRef = useActiveItemScroll(selectedIndex);
  if (items.length === 0) {
    return (
      <div className="w-64 rounded-md border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-sm text-(--txt-tertiary) shadow-(--shadow-overlay)">
        {t('editor.slash.noMatch', 'No matching blocks')}
      </div>
    );
  }
  return (
    <div
      ref={listRef}
      className="max-h-72 w-64 overflow-y-auto rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-1 shadow-(--shadow-overlay)"
    >
      {items.map((item, i) => (
        <button
          key={item.title}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(i);
          }}
          className={cn(
            'flex w-full items-center gap-2 px-2 py-1.5 text-left',
            i === selectedIndex ? 'bg-(--bg-layer-1-hover)' : 'hover:bg-(--bg-layer-1-hover)',
          )}
        >
          <span className="grid size-7 shrink-0 place-items-center rounded border border-(--border-subtle) text-(--txt-secondary)">
            <item.icon size={15} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm text-(--txt-primary)">
              {t(`editor.slash.${item.key}.title`, item.title)}
            </span>
            <span className="block truncate text-xs text-(--txt-tertiary)">
              {t(`editor.slash.${item.key}.subtitle`, item.subtitle)}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * Slash-command menu: type "/" to insert headings, lists, quotes, code, tables,
 * images, and dividers.
 */
export const SlashCommand = Extension.create({
  name: 'slashCommand',
  addProseMirrorPlugins() {
    return [
      Suggestion<SlashItem>({
        editor: this.editor,
        char: '/',
        allowSpaces: false,
        startOfLine: false,
        items: ({ query }) => filterItems(query),
        command: ({ editor, range, props }) => props.run(editor, range),
        render: createSuggestionRenderer(SlashMenu),
      }),
    ];
  },
});
