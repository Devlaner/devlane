import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { ProjectSection } from '../PageHeader';
import {
  IconClipboard,
  IconCycle,
  IconGrid,
  IconProjectViews,
  IconFileText,
  IconChevronDown,
  IconCheck,
} from './icons';

const SECTION_LABELS: Record<ProjectSection, string> = {
  issues: 'Work items',
  cycles: 'Cycles',
  modules: 'Modules',
  views: 'Views',
  pages: 'Pages',
};

const SECTION_ICONS: Record<ProjectSection, React.ReactNode> = {
  issues: <IconClipboard />,
  cycles: <IconCycle />,
  modules: <IconGrid />,
  views: <IconProjectViews />,
  pages: <IconFileText />,
};

export function ProjectSectionDropdown({
  baseUrl,
  currentSection,
  issueCount,
}: {
  baseUrl: string;
  currentSection: ProjectSection;
  issueCount: number;
}) {
  const { t } = useTranslation();
  const sectionLabel = (section: ProjectSection) =>
    t(`header.section.${section}`, SECTION_LABELS[section]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const sections: ProjectSection[] = ['issues', 'cycles', 'modules', 'views', 'pages'];
  const currentLabel = sectionLabel(currentSection);
  const currentIcon = SECTION_ICONS[currentSection];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-(--txt-primary) hover:bg-(--bg-layer-transparent-hover)"
      >
        <span className="flex size-5 items-center justify-center text-(--txt-icon-secondary)">
          {currentIcon}
        </span>
        {currentLabel}
        {currentSection === 'issues' && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-100 px-1.5 text-[11px] font-semibold text-sky-800 dark:bg-sky-950 dark:text-sky-200">
            {issueCount}
          </span>
        )}
        <span className="ml-0.5 flex size-4 items-center justify-center text-(--txt-icon-tertiary)">
          <IconChevronDown />
        </span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-45 rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-1 shadow-(--shadow-raised)">
          {sections.map((section) => {
            const href = section === 'issues' ? `${baseUrl}/issues` : `${baseUrl}/${section}`;
            const isActive = section === currentSection;
            return (
              <Link
                key={section}
                to={href}
                onClick={() => setOpen(false)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm no-underline ${
                  isActive
                    ? 'bg-(--brand-200) text-(--txt-primary)'
                    : 'text-(--txt-secondary) hover:bg-(--bg-layer-2-hover) hover:text-(--txt-primary)'
                }`}
              >
                <span className="flex size-5 items-center justify-center text-(--txt-icon-secondary)">
                  {SECTION_ICONS[section]}
                </span>
                {sectionLabel(section)}
                {isActive && (
                  <span className="ml-auto text-(--brand-default)">
                    <IconCheck />
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
