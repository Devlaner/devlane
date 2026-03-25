import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

export type ProjectSectionNav = 'issues' | 'cycles' | 'modules' | 'views' | 'pages';

const IconCheck = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const IconChevronRight = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="m9 6 6 6-6 6" />
  </svg>
);

const IconClipboard = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <path d="M12 11h4" />
    <path d="M12 16h4" />
    <path d="M8 11h.01" />
    <path d="M8 16h.01" />
  </svg>
);

const IconCycle = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
);

const IconGrid = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <rect width="7" height="7" x="3" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="14" rx="1" />
    <rect width="7" height="7" x="3" y="14" rx="1" />
  </svg>
);

const IconProjectViews = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
    <path d="M14.3926 10.7735C14.7013 10.6192 15.0771 10.7451 15.2314 11.0538C15.3854 11.3623 15.2604 11.7373 14.9521 11.8917L8.52344 15.1056C8.46846 15.1331 8.33457 15.2069 8.18262 15.2355H8.18164C8.06516 15.2572 7.94558 15.2573 7.8291 15.2355C7.67698 15.2069 7.54234 15.1331 7.4873 15.1056L1.05957 11.8917C0.750903 11.7374 0.626065 11.3625 0.780273 11.0538C0.934594 10.7452 1.30948 10.6194 1.61816 10.7735L8.00488 13.9669L14.3926 10.7735ZM14.3926 7.44054C14.7013 7.28618 15.0771 7.41114 15.2314 7.71983C15.3858 8.02847 15.2607 8.40424 14.9521 8.5587L8.52344 11.7726C8.46839 11.8001 8.33451 11.8739 8.18262 11.9025H8.18164C8.06519 11.9242 7.94554 11.9242 7.8291 11.9025C7.67698 11.8739 7.54234 11.8001 7.4873 11.7726L1.05957 8.5587C0.750834 8.40433 0.625905 8.02857 0.780273 7.71983C0.934713 7.41138 1.30956 7.28634 1.61816 7.44054L8.00488 10.6339L14.3926 7.44054ZM7.91699 0.751084C8.00545 0.742877 8.09504 0.747328 8.18262 0.763779C8.33432 0.79232 8.46833 0.865118 8.52344 0.892686L14.9521 4.10753C15.1636 4.21348 15.2969 4.42959 15.2969 4.66612C15.2969 4.90266 15.1636 5.11875 14.9521 5.22472L8.52344 8.43956C8.46831 8.46714 8.33434 8.53992 8.18262 8.56847H8.18164C8.06513 8.59024 7.94561 8.59028 7.8291 8.56847C7.67698 8.53994 7.54235 8.46708 7.4873 8.43956L1.05957 5.22472C0.84784 5.11884 0.713867 4.90285 0.713867 4.66612C0.713883 4.42941 0.847843 4.21339 1.05957 4.10753L7.4873 0.892686C7.54232 0.865181 7.67699 0.7923 7.8291 0.763779L7.91699 0.751084ZM2.73535 4.66612L8.00488 7.30089L13.2754 4.66612L8.00488 2.03038L2.73535 4.66612Z" />
  </svg>
);

const IconFileText = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <line x1="10" y1="9" x2="8" y2="9" />
  </svg>
);

const SECTION_LABELS: Record<ProjectSectionNav, string> = {
  issues: 'Work items',
  cycles: 'Cycles',
  modules: 'Modules',
  views: 'Views',
  pages: 'Pages',
};

const SECTION_ICONS: Record<ProjectSectionNav, ReactNode> = {
  issues: <IconClipboard />,
  cycles: <IconCycle />,
  modules: <IconGrid />,
  views: <IconProjectViews />,
  pages: <IconFileText />,
};

const SECTION_ORDER: ProjectSectionNav[] = ['issues', 'cycles', 'modules', 'views', 'pages'];

/**
 * Breadcrumb “&gt;” control (Plane-style): opens the project area switcher
 * (Work items, Cycles, Modules, …) on hover or click.
 */
export function ProjectSectionNavChevron({
  baseUrl,
  currentSection,
}: {
  baseUrl: string;
  currentSection: ProjectSectionNav;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0" onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        className={`
          group flex size-7 items-center justify-center rounded-sm text-(--txt-icon-tertiary)
          transition-colors hover:bg-(--bg-layer-1) hover:text-(--txt-secondary)
          ${open ? 'bg-(--bg-layer-1) text-(--txt-secondary)' : ''}
        `}
        aria-label="Switch project area"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
      >
        <span
          className={`inline-flex transition-transform duration-150 ${open ? 'rotate-90 text-(--txt-primary)' : 'group-hover:rotate-90'}`}
          aria-hidden
        >
          <IconChevronRight />
        </span>
      </button>
      {open ? (
        <div
          className="absolute left-0 top-full z-50 mt-1 min-w-52 rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-1 shadow-(--shadow-raised)"
          role="menu"
        >
          {SECTION_ORDER.map((section) => {
            const href = section === 'issues' ? `${baseUrl}/issues` : `${baseUrl}/${section}`;
            const isActive = section === currentSection;
            return (
              <Link
                key={section}
                to={href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm no-underline ${
                  isActive
                    ? 'bg-(--brand-200) text-(--txt-primary)'
                    : 'text-(--txt-secondary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)'
                }`}
              >
                <span className="flex size-5 items-center justify-center text-(--txt-icon-secondary)">
                  {SECTION_ICONS[section]}
                </span>
                <span className="min-w-0 flex-1">{SECTION_LABELS[section]}</span>
                {isActive ? (
                  <span className="shrink-0 text-(--brand-default)" aria-hidden>
                    <IconCheck />
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
