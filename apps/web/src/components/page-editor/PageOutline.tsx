import { useTranslation } from 'react-i18next';
import { useEditorState, type Editor } from '@tiptap/react';

interface Props {
  editor: Editor | null;
}

interface Heading {
  level: number;
  text: string;
  pos: number;
}

function readHeadings(editor: Editor | null): Heading[] {
  if (!editor) return [];
  const out: Heading[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      out.push({ level: node.attrs.level as number, text: node.textContent, pos });
    }
    return true;
  });
  return out;
}

function sameHeadings(a: Heading[], b: Heading[] | null): boolean {
  if (!b || a.length !== b.length) return false;
  return a.every((h, i) => h.level === b[i].level && h.text === b[i].text && h.pos === b[i].pos);
}

/**
 * Table of contents derived from the editor's headings. Clicking an entry moves
 * the caret to that heading and scrolls it into view.
 */
export function PageOutline({ editor }: Props) {
  const { t } = useTranslation();
  const headings =
    useEditorState({
      editor,
      selector: (snapshot) => readHeadings(snapshot.editor),
      equalityFn: sameHeadings,
    }) ?? [];

  if (headings.length === 0) {
    return (
      <p className="px-2 py-3 text-xs text-(--txt-tertiary)">
        {t('editor.outline.empty', 'Headings you add to the page show up here.')}
      </p>
    );
  }

  const minLevel = Math.min(...headings.map((h) => h.level));

  const goTo = (pos: number) => {
    editor
      ?.chain()
      .focus()
      .setTextSelection(pos + 1)
      .scrollIntoView()
      .run();
  };

  return (
    <nav aria-label="Page outline" className="p-1">
      <ul className="space-y-0.5">
        {headings.map((h, i) => {
          const label = h.text.trim() || 'Untitled heading';
          return (
            <li key={`${h.pos}-${i}`}>
              <button
                type="button"
                onClick={() => goTo(h.pos)}
                style={{ paddingLeft: `${(h.level - minLevel) * 12 + 8}px` }}
                className="block w-full truncate rounded py-1 pr-2 text-left text-xs text-(--txt-secondary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)"
                title={label}
              >
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
