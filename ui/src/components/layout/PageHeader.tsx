import { useState, useRef, useEffect } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { Button } from "../ui";
import { Dropdown } from "../work-item";
import {
  WorkspaceViewsFiltersDropdown,
  WorkspaceViewsDisplayDropdown,
  WorkspaceViewsEllipsisMenu,
  WorkspaceViewsLayoutSelector,
  CreateViewModal,
} from "../workspace-views";
import { workspaceService } from "../../services/workspaceService";
import { projectService } from "../../services/projectService";
import { issueService } from "../../services/issueService";
import { viewService } from "../../services/viewService";
import type {
  WorkspaceApiResponse,
  ProjectApiResponse,
  IssueViewApiResponse,
} from "../../api/types";

export type ProjectSection =
  | "issues"
  | "cycles"
  | "modules"
  | "views"
  | "pages";

const IconHome = () => (
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
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
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
const IconGitHub = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="none"
    aria-hidden
  >
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
);
const IconBriefcase = () => (
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
    <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);
const IconSearch = () => (
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
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);
const IconX = () => (
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
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);
const IconChevronDown = () => (
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
    <path d="m6 9 6 6 6-6" />
  </svg>
);
const IconCalendar = () => (
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
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const IconFilter = () => (
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
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);
const IconPlus = () => (
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
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </svg>
);
const IconSettings = () => (
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
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const IconInbox = () => (
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
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
);
const IconCheck = () => (
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
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const IconArchive = () => (
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
    <rect width="20" height="5" x="2" y="3" rx="1" />
    <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
    <path d="M10 12h4" />
  </svg>
);
const IconMoreVertical = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden
  >
    <circle cx="12" cy="5" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="12" cy="19" r="1.5" />
  </svg>
);
const IconUser = () => (
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
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
const IconList = () => (
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
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);
const IconLayers = () => (
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
    <path d="m12 2 7 4 7 4-7 4-7-4 7-4-7-4z" />
    <path d="M5 10l7 4 7-4" />
    <path d="M5 14l7 4 7-4" />
  </svg>
);
const IconViewsPlane = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden
  >
    <path d="M14.3926 10.7735C14.7013 10.6192 15.0771 10.7451 15.2314 11.0538C15.3854 11.3623 15.2604 11.7373 14.9521 11.8917L8.52344 15.1056C8.46846 15.1331 8.33457 15.2069 8.18262 15.2355H8.18164C8.06516 15.2572 7.94558 15.2573 7.8291 15.2355C7.67698 15.2069 7.54234 15.1331 7.4873 15.1056L1.05957 11.8917C0.750903 11.7374 0.626065 11.3625 0.780273 11.0538C0.934594 10.7452 1.30948 10.6194 1.61816 10.7735L8.00488 13.9669L14.3926 10.7735ZM14.3926 7.44054C14.7013 7.28618 15.0771 7.41114 15.2314 7.71983C15.3858 8.02847 15.2607 8.40424 14.9521 8.5587L8.52344 11.7726C8.46839 11.8001 8.33451 11.8739 8.18262 11.9025H8.18164C8.06519 11.9242 7.94554 11.9242 7.8291 11.9025C7.67698 11.8739 7.54234 11.8001 7.4873 11.7726L1.05957 8.5587C0.750834 8.40433 0.625905 8.02857 0.780273 7.71983C0.934713 7.41138 1.30956 7.28634 1.61816 7.44054L8.00488 10.6339L14.3926 7.44054ZM7.91699 0.751084C8.00545 0.742877 8.09504 0.747328 8.18262 0.763779C8.33432 0.79232 8.46833 0.865118 8.52344 0.892686L14.9521 4.10753C15.1636 4.21348 15.2969 4.42959 15.2969 4.66612C15.2969 4.90266 15.1636 5.11875 14.9521 5.22472L8.52344 8.43956C8.46831 8.46714 8.33434 8.53992 8.18262 8.56847H8.18164C8.06513 8.59024 7.94561 8.59028 7.8291 8.56847C7.67698 8.53994 7.54235 8.46708 7.4873 8.43956L1.05957 5.22472C0.84784 5.11884 0.713867 4.90285 0.713867 4.66612C0.713883 4.42941 0.847843 4.21339 1.05957 4.10753L7.4873 0.892686C7.54232 0.865181 7.67699 0.7923 7.8291 0.763779L7.91699 0.751084ZM2.73535 4.66612L8.00488 7.30089L13.2754 4.66612L8.00488 2.03038L2.73535 4.66612Z" />
  </svg>
);
const IconLayoutGrid = () => (
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
const IconColumns = () => (
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
    <rect width="7" height="18" x="3" y="3" rx="1" />
    <rect width="7" height="18" x="14" y="3" rx="1" />
  </svg>
);
const IconBarChart = () => (
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
    <line x1="12" y1="20" x2="12" y2="10" />
    <line x1="18" y1="20" x2="18" y2="4" />
    <line x1="6" y1="20" x2="6" y2="16" />
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

const SECTION_LABELS: Record<ProjectSection, string> = {
  issues: "Work items",
  cycles: "Cycles",
  modules: "Modules",
  views: "Views",
  pages: "Pages",
};

const SECTION_ICONS: Record<ProjectSection, React.ReactNode> = {
  issues: <IconClipboard />,
  cycles: <IconCycle />,
  modules: <IconGrid />,
  views: <IconViewsPlane />,
  pages: <IconFileText />,
};

function ProjectSectionDropdown({
  baseUrl,
  currentSection,
  issueCount,
}: {
  baseUrl: string;
  currentSection: ProjectSection;
  issueCount: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const sections: ProjectSection[] = [
    "issues",
    "cycles",
    "modules",
    "views",
    "pages",
  ];
  const currentLabel = SECTION_LABELS[currentSection];
  const currentIcon = SECTION_ICONS[currentSection];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-layer-2)] px-2.5 py-1.5 text-sm font-medium text-[var(--txt-primary)] hover:bg-[var(--bg-layer-2-hover)]"
      >
        <span className="flex size-5 items-center justify-center text-[var(--txt-icon-secondary)]">
          {currentIcon}
        </span>
        {currentLabel}
        {currentSection === "issues" && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--brand-200)] px-1.5 text-xs font-medium text-[var(--brand-default)]">
            {issueCount}
          </span>
        )}
        <span className="ml-0.5 flex size-4 items-center justify-center text-[var(--txt-icon-tertiary)]">
          <IconChevronDown />
        </span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] py-1 shadow-[var(--shadow-raised)]">
          {sections.map((section) => {
            const href =
              section === "issues"
                ? `${baseUrl}/issues`
                : `${baseUrl}/${section}`;
            const isActive = section === currentSection;
            return (
              <Link
                key={section}
                to={href}
                onClick={() => setOpen(false)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm no-underline ${
                  isActive
                    ? "bg-[var(--brand-200)] text-[var(--txt-primary)]"
                    : "text-[var(--txt-secondary)] hover:bg-[var(--bg-layer-1-hover)] hover:text-[var(--txt-primary)]"
                }`}
              >
                <span className="flex size-5 items-center justify-center text-[var(--txt-icon-secondary)]">
                  {SECTION_ICONS[section]}
                </span>
                {SECTION_LABELS[section]}
                {isActive && (
                  <span className="ml-auto text-[var(--brand-default)]">
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

function YourWorkHeader() {
  return (
    <div className="flex items-center gap-2 text-sm font-medium text-[var(--txt-secondary)]">
      <span className="flex size-5 items-center justify-center text-[var(--txt-icon-tertiary)]">
        <IconUser />
      </span>
      Your work
    </div>
  );
}

function InboxHeader() {
  return (
    <>
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--txt-secondary)]">
        <span className="flex size-5 items-center justify-center text-[var(--txt-icon-tertiary)]">
          <IconInbox />
        </span>
        Inbox
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--txt-icon-tertiary)] hover:bg-[var(--bg-layer-2)] hover:text-[var(--txt-icon-secondary)]"
          aria-label="Mark as read"
        >
          <IconCheck />
        </button>
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--txt-icon-tertiary)] hover:bg-[var(--bg-layer-2)] hover:text-[var(--txt-icon-secondary)]"
          aria-label="Archive"
        >
          <IconArchive />
        </button>
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--txt-icon-tertiary)] hover:bg-[var(--bg-layer-2)] hover:text-[var(--txt-icon-secondary)]"
          aria-label="Filters"
        >
          <IconFilter />
        </button>
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--txt-icon-tertiary)] hover:bg-[var(--bg-layer-2)] hover:text-[var(--txt-icon-secondary)]"
          aria-label="More options"
        >
          <IconMoreVertical />
        </button>
      </div>
    </>
  );
}

function SettingsHeader() {
  return (
    <>
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--txt-secondary)]">
        <span className="flex size-5 items-center justify-center text-[var(--txt-icon-tertiary)]">
          <IconSettings />
        </span>
        Settings
      </div>
      <div className="flex items-center gap-2" />
    </>
  );
}

function HomeHeader() {
  return (
    <>
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--txt-secondary)]">
        <span className="flex size-5 items-center justify-center text-[var(--txt-icon-tertiary)]">
          <IconHome />
        </span>
        Home
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-[13px] font-medium text-[var(--txt-secondary)]"
        >
          <IconGrid />
          Manage widgets
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-[13px] font-medium text-[var(--txt-secondary)]"
        >
          <IconGitHub />
          Star us on GitHub
        </Button>
      </div>
    </>
  );
}

function ProjectsHeader({ workspaceSlug }: { workspaceSlug: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get("q") ?? "";
  const [searchOpen, setSearchOpen] = useState(!!searchQuery);

  const baseUrl = `/${workspaceSlug}`;

  return (
    <>
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--txt-secondary)]">
        <span className="flex size-5 items-center justify-center text-[var(--txt-icon-tertiary)]">
          <IconBriefcase />
        </span>
        Projects
      </div>
      <div className="flex flex-1 items-center justify-end gap-2 min-w-0">
        <div
          className={`overflow-hidden transition-[width] duration-200 ease-out ${searchOpen ? "w-56" : "w-0"}`}
        >
          <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-layer-2)] px-2 py-1.5">
            <span className="shrink-0 text-[var(--txt-icon-tertiary)]">
              <IconSearch />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) =>
                setSearchParams({ q: e.target.value }, { replace: true })
              }
              placeholder="Search projects"
              className="min-w-0 flex-1 bg-transparent text-sm text-[var(--txt-primary)] placeholder:text-[var(--txt-placeholder)] focus:outline-none"
              aria-label="Search projects"
            />
            <button
              type="button"
              onClick={() => {
                setSearchParams({}, { replace: true });
                setSearchOpen(false);
              }}
              className="shrink-0 rounded p-0.5 text-[var(--txt-icon-tertiary)] hover:bg-[var(--bg-layer-transparent-hover)] hover:text-[var(--txt-secondary)]"
              aria-label="Clear search"
            >
              <IconX />
            </button>
          </div>
        </div>
        {!searchOpen && (
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-layer-2)] text-[var(--txt-icon-tertiary)] hover:bg-[var(--bg-layer-2-hover)]"
            aria-label="Search projects"
          >
            <IconSearch />
          </button>
        )}
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-layer-2)] px-2.5 py-1.5 text-[13px] font-medium text-[var(--txt-secondary)] hover:bg-[var(--bg-layer-2-hover)]"
        >
          <IconCalendar />
          Created date
          <IconChevronDown />
        </button>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-layer-2)] px-2.5 py-1.5 text-[13px] font-medium text-[var(--txt-secondary)] hover:bg-[var(--bg-layer-2-hover)]"
        >
          <IconFilter />
          Filters
          <IconChevronDown />
        </button>
        <Link to={`${baseUrl}/projects?createProject=1`}>
          <Button size="sm" className="gap-1.5 text-[13px] font-medium">
            <IconPlus />
            Add Project
          </Button>
        </Link>
      </div>
    </>
  );
}

function ProjectDetailHeader({
  title,
}: {
  workspaceSlug: string;
  projectId: string;
  title: string;
}) {
  return (
    <>
      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--txt-primary)]">
        <span className="flex size-5 items-center justify-center text-[var(--txt-icon-tertiary)]">
          <IconBriefcase />
        </span>
        {title}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-layer-2)] text-[var(--txt-icon-tertiary)] hover:bg-[var(--bg-layer-2-hover)]"
          aria-label="Search"
        >
          <IconSearch />
        </button>
      </div>
    </>
  );
}

function ProjectSectionHeader({
  workspaceSlug,
  projectId,
  projectName,
  section,
  issueCount,
}: {
  workspaceSlug: string;
  projectId: string;
  projectName: string;
  section: ProjectSection;
  issueCount: number;
}) {
  const baseUrl = `/${workspaceSlug}/projects/${projectId}`;
  const issuesUrl = `${baseUrl}/issues`;

  const rightActions = () => {
    if (section === "issues") {
      return (
        <>
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-layer-2)] text-[var(--brand-default)] hover:bg-[var(--bg-layer-2-hover)]"
            aria-label="List view"
            title="List view"
          >
            <IconList />
          </button>
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-md border border-transparent text-[var(--txt-icon-tertiary)] hover:bg-[var(--bg-layer-2)] hover:text-[var(--txt-icon-secondary)]"
            aria-label="Kanban"
            title="Kanban"
          >
            <IconColumns />
          </button>
          <Link
            to={`${baseUrl}/board`}
            className="flex size-8 items-center justify-center rounded-md border border-transparent text-[var(--txt-icon-tertiary)] hover:bg-[var(--bg-layer-2)] hover:text-[var(--txt-icon-secondary)]"
            aria-label="Board"
            title="Board"
          >
            <IconLayoutGrid />
          </Link>
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-md border border-transparent text-[var(--txt-icon-tertiary)] hover:bg-[var(--bg-layer-2)] hover:text-[var(--txt-icon-secondary)]"
            aria-label="Calendar"
            title="Calendar"
          >
            <IconCalendar />
          </button>
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-md border border-transparent text-[var(--txt-icon-tertiary)] hover:bg-[var(--bg-layer-2)] hover:text-[var(--txt-icon-secondary)]"
            aria-label="Gallery"
            title="Gallery"
          >
            <IconGrid />
          </button>
          <div className="mx-1 w-px self-stretch bg-[var(--border-subtle)]" />
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-layer-2)] px-2.5 py-1.5 text-[13px] font-medium text-[var(--txt-secondary)] hover:bg-[var(--bg-layer-2-hover)]"
          >
            <IconFilter /> Filters <IconChevronDown />
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-layer-2)] px-2.5 py-1.5 text-[13px] font-medium text-[var(--txt-secondary)] hover:bg-[var(--bg-layer-2-hover)]"
          >
            Display <IconChevronDown />
          </button>
          <Link
            to={`/${workspaceSlug}/analytics/work-items`}
            className="flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-layer-2)] px-2.5 py-1.5 text-[13px] font-medium text-[var(--txt-secondary)] no-underline hover:bg-[var(--bg-layer-2-hover)]"
          >
            <IconBarChart /> Analytics
          </Link>
          <Link to={`${issuesUrl}?create=1`}>
            <Button size="sm" className="gap-1.5 text-[13px] font-medium">
              <IconPlus /> Add work item
            </Button>
          </Link>
        </>
      );
    }
    if (section === "cycles") {
      return (
        <>
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-layer-2)] text-[var(--txt-icon-tertiary)] hover:bg-[var(--bg-layer-2-hover)]"
            aria-label="Search"
          >
            <IconSearch />
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-layer-2)] px-2.5 py-1.5 text-[13px] font-medium text-[var(--txt-secondary)] hover:bg-[var(--bg-layer-2-hover)]"
          >
            <IconFilter /> Filters <IconChevronDown />
          </button>
          <Button size="sm" className="gap-1.5 text-[13px] font-medium">
            <IconPlus /> Add cycle
          </Button>
        </>
      );
    }
    if (section === "modules") {
      return (
        <>
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-layer-2)] text-[var(--txt-icon-tertiary)] hover:bg-[var(--bg-layer-2-hover)]"
            aria-label="Search"
          >
            <IconSearch />
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-layer-2)] px-2.5 py-1.5 text-[13px] font-medium text-[var(--txt-secondary)] hover:bg-[var(--bg-layer-2-hover)]"
          >
            ↑ Name <IconChevronDown />
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-layer-2)] px-2.5 py-1.5 text-[13px] font-medium text-[var(--txt-secondary)] hover:bg-[var(--bg-layer-2-hover)]"
          >
            <IconFilter /> Filters <IconChevronDown />
          </button>
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-layer-2)] text-[var(--brand-default)] hover:bg-[var(--bg-layer-2-hover)]"
            aria-label="List view"
          >
            <IconList />
          </button>
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-md border border-transparent text-[var(--txt-icon-tertiary)] hover:bg-[var(--bg-layer-2)] hover:text-[var(--txt-icon-secondary)]"
            aria-label="Grid view"
          >
            <IconLayoutGrid />
          </button>
          <Button size="sm" className="gap-1.5 text-[13px] font-medium">
            <IconPlus /> Add Module
          </Button>
        </>
      );
    }
    if (section === "pages") {
      return (
        <Link to={`${baseUrl}/pages/new`}>
          <Button size="sm" className="gap-1.5 text-[13px] font-medium">
            <IconPlus /> Add page
          </Button>
        </Link>
      );
    }
    if (section === "views") {
      return (
        <>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-layer-2)] px-2.5 py-1.5 text-[13px] font-medium text-[var(--txt-secondary)] hover:bg-[var(--bg-layer-2-hover)]"
          >
            <IconFilter /> Filters <IconChevronDown />
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-layer-2)] px-2.5 py-1.5 text-[13px] font-medium text-[var(--txt-secondary)] hover:bg-[var(--bg-layer-2-hover)]"
          >
            Display <IconChevronDown />
          </button>
          <Button size="sm" className="gap-1.5 text-[13px] font-medium">
            <IconPlus /> Add view
          </Button>
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-md border border-transparent text-[var(--txt-icon-tertiary)] hover:bg-[var(--bg-layer-2)] hover:text-[var(--txt-icon-secondary)]"
            aria-label="More options"
          >
            <IconMoreVertical />
          </button>
        </>
      );
    }
    return null;
  };

  return (
    <>
      <div className="flex items-center gap-2 text-sm">
        <Link
          to={baseUrl}
          className="font-medium text-[var(--txt-secondary)] no-underline hover:text-[var(--txt-primary)]"
        >
          {projectName}
        </Link>
        <span className="text-[var(--txt-icon-tertiary)]" aria-hidden>
          &gt;
        </span>
        <ProjectSectionDropdown
          baseUrl={baseUrl}
          currentSection={section}
          issueCount={issueCount}
        />
      </div>
      <div className="flex items-center gap-1">{rightActions()}</div>
    </>
  );
}

/** Default workspace view options (Plane-style: all-issues, assigned, created, subscribed). */
const DEFAULT_WORKSPACE_VIEWS = [
  { id: "all-issues", name: "All work items" },
  { id: "assigned", name: "Assigned" },
  { id: "created", name: "Created" },
  { id: "subscribed", name: "Subscribed" },
] as const;

const LONG_LIST_PANEL_STYLE = { maxHeight: "min(70vh, 28rem)" };

function WorkspaceViewsHeader() {
  const { workspaceSlug, viewId: urlViewId } = useParams<{
    workspaceSlug?: string;
    viewId?: string;
  }>();
  const navigate = useNavigate();
  const [viewDropdownOpen, setViewDropdownOpen] = useState<string | null>(null);
  const [filtersDropdownOpen, setFiltersDropdownOpen] = useState<string | null>(
    null,
  );
  const [displayDropdownOpen, setDisplayDropdownOpen] = useState<string | null>(
    null,
  );
  const [createViewModalOpen, setCreateViewModalOpen] = useState(false);
  const [viewSearch, setViewSearch] = useState("");
  const [customViews, setCustomViews] = useState<IssueViewApiResponse[]>([]);

  useEffect(() => {
    if (!workspaceSlug) {
      queueMicrotask(() => setCustomViews([]));
      return;
    }
    viewService
      .list(workspaceSlug)
      .then((list) => setCustomViews(list ?? []))
      .catch(() => setCustomViews([]));
  }, [workspaceSlug]);

  useEffect(() => {
    if (!viewDropdownOpen) {
      queueMicrotask(() => setViewSearch(""));
    }
  }, [viewDropdownOpen]);

  const selectedViewId = urlViewId ?? "all-issues";
  const allOptions = [
    ...DEFAULT_WORKSPACE_VIEWS,
    ...customViews.map((v) => ({ id: v.id, name: v.name })),
  ];
  const selectedView =
    DEFAULT_WORKSPACE_VIEWS.find((v) => v.id === selectedViewId) ??
    customViews.find((v) => v.id === selectedViewId) ??
    DEFAULT_WORKSPACE_VIEWS[0];
  const displayName = selectedView?.name ?? "All work items";
  const q = (s: string) => s.trim().toLowerCase();
  const filteredViews = allOptions.filter((v) =>
    q(v.name).includes(q(viewSearch)),
  );

  const handleSelectView = (id: string) => {
    setViewDropdownOpen(null);
    if (!workspaceSlug) return;
    navigate(`/${workspaceSlug}/views/${id}`);
  };

  return (
    <>
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--txt-secondary)]">
        <Link
          to={workspaceSlug ? `/${workspaceSlug}/views/all-issues` : "/"}
          className="flex items-center gap-1.5 text-[var(--txt-secondary)] hover:text-[var(--txt-primary)]"
        >
          <span className="flex size-5 items-center justify-center text-[var(--txt-icon-tertiary)]">
            <IconViewsPlane />
          </span>
          <span>Views</span>
        </Link>
        <span className="text-[var(--txt-icon-tertiary)]" aria-hidden>
          &gt;
        </span>
        <Dropdown
          id="workspace-view-select"
          openId={viewDropdownOpen}
          onOpen={setViewDropdownOpen}
          label="All work items"
          icon={<IconViewsPlane />}
          displayValue={displayName}
          panelClassName="flex min-w-[220px] max-h-[min(70vh,28rem)] flex-col rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] shadow-[var(--shadow-raised)] overflow-hidden"
          align="left"
        >
          <div className="sticky top-0 shrink-0 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-1)] p-2">
            <div className="flex items-center gap-2 rounded border border-[var(--border-subtle)] bg-[var(--bg-layer-1)] px-2 py-1.5">
              <span className="shrink-0 text-[var(--txt-icon-tertiary)]">
                <IconSearch />
              </span>
              <input
                type="text"
                placeholder="Search"
                value={viewSearch}
                onChange={(e) => setViewSearch(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm text-[var(--txt-primary)] placeholder:text-[var(--txt-placeholder)] focus:outline-none"
              />
            </div>
          </div>
          <div
            className="min-h-0 flex-1 overflow-y-auto py-1"
            style={LONG_LIST_PANEL_STYLE}
          >
            {filteredViews.map((view) => (
              <button
                key={view.id}
                type="button"
                onClick={() => handleSelectView(view.id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--txt-primary)] hover:bg-[var(--bg-layer-1-hover)]"
              >
                <span className="shrink-0 text-[var(--txt-icon-tertiary)]">
                  <IconLayers />
                </span>
                <span className="min-w-0 flex-1 truncate">{view.name}</span>
                {selectedViewId === view.id && (
                  <span className="shrink-0 text-[var(--txt-primary)]">
                    <IconCheck />
                  </span>
                )}
              </button>
            ))}
          </div>
        </Dropdown>
      </div>
      <div className="flex items-center gap-1">
        <WorkspaceViewsLayoutSelector />
        <WorkspaceViewsFiltersDropdown
          openId={filtersDropdownOpen}
          onOpen={setFiltersDropdownOpen}
        />
        <WorkspaceViewsDisplayDropdown
          openId={displayDropdownOpen}
          onOpen={setDisplayDropdownOpen}
        />
        <Button
          size="sm"
          className="gap-1.5 text-[13px] font-medium"
          onClick={() => setCreateViewModalOpen(true)}
        >
          <IconPlus /> Add view
        </Button>
        <CreateViewModal
          open={createViewModalOpen}
          onClose={() => setCreateViewModalOpen(false)}
          onCreated={() => setCreateViewModalOpen(false)}
        />
        <WorkspaceViewsEllipsisMenu />
      </div>
    </>
  );
}

function AnalyticsHeader({ workspaceSlug }: { workspaceSlug: string }) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [projectSearch, setProjectSearch] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);

  useEffect(() => {
    let cancelled = false;
    projectService
      .list(workspaceSlug)
      .then((list) => {
        if (!cancelled) setProjects(list ?? []);
      })
      .catch(() => {
        if (!cancelled) setProjects([]);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug]);

  const selectedProject = selectedProjectId
    ? projects.find((p) => p.id === selectedProjectId)
    : null;

  const q = (s: string) => s.trim().toLowerCase();
  const filteredProjects = projects.filter((p) =>
    q(p.name).includes(q(projectSearch)),
  );

  useEffect(() => {
    if (!openDropdown) {
      // Intentional: clear search when dropdown closes (kept for future use)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProjectSearch("");
    }
  }, [openDropdown]);

  return (
    <>
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--txt-secondary)]">
        <span className="flex size-5 items-center justify-center text-[var(--txt-icon-tertiary)]">
          <IconBarChart />
        </span>
        Analytics
      </div>
      <div className="flex items-center gap-2">
        <Dropdown
          id="analytics-projects"
          openId={openDropdown}
          onOpen={setOpenDropdown}
          label="All projects"
          icon={<IconBriefcase />}
          displayValue={selectedProject?.name ?? "All projects"}
          panelClassName="flex min-w-[200px] max-h-52 flex-col rounded border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] shadow-[var(--shadow-raised)]"
          align="right"
        >
          <div className="sticky top-0 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-1)] p-1.5">
            <input
              type="text"
              placeholder="Search..."
              value={projectSearch}
              onChange={(e) => setProjectSearch(e.target.value)}
              className="w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] px-2 py-1 text-xs placeholder:text-[var(--txt-placeholder)] focus:outline-none focus:border-[var(--border-strong)]"
            />
          </div>
          <div className="overflow-auto py-0.5 [&_button]:px-2 [&_button]:py-1 [&_button]:text-xs">
            <button
              type="button"
              onClick={() => {
                setSelectedProjectId(null);
                setOpenDropdown(null);
              }}
              className="w-full text-left text-[var(--txt-primary)] hover:bg-[var(--bg-layer-1-hover)]"
            >
              All projects
            </button>
            {filteredProjects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSelectedProjectId(p.id);
                  setOpenDropdown(null);
                }}
                className="w-full text-left text-[var(--txt-primary)] hover:bg-[var(--bg-layer-1-hover)]"
              >
                {p.name}
              </button>
            ))}
          </div>
        </Dropdown>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// PageHeader
// ---------------------------------------------------------------------------

export function PageHeader() {
  const location = useLocation();
  const { workspaceSlug, projectId } = useParams<{
    workspaceSlug?: string;
    projectId?: string;
  }>();
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);
  void workspace;
  void projects; // reserved for future use (e.g. breadcrumb, project list)
  const [project, setProject] = useState<ProjectApiResponse | null>(null);
  const [projectIssueCount, setProjectIssueCount] = useState(0);

  useEffect(() => {
    if (!workspaceSlug) {
      // Intentional: clear when route unmounts (kept for future use)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWorkspace(null);
      setProjects([]);
      setProject(null);
      setProjectIssueCount(0);
      return;
    }
    let cancelled = false;
    workspaceService
      .getBySlug(workspaceSlug)
      .then((w) => {
        if (!cancelled) setWorkspace(w);
        return projectService.list(workspaceSlug);
      })
      .then((list) => {
        if (!cancelled && list) setProjects(list);
      })
      .catch(() => {
        if (!cancelled) setWorkspace(null);
        setProjects([]);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug]);

  useEffect(() => {
    if (!workspaceSlug || !projectId) {
      // Intentional: clear when route unmounts (kept for future use)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProject(null);
      setProjectIssueCount(0);
      return;
    }
    let cancelled = false;
    projectService
      .get(workspaceSlug, projectId)
      .then((p) => {
        if (!cancelled) setProject(p ?? null);
        return p
          ? issueService.list(workspaceSlug, projectId, { limit: 1000 })
          : [];
      })
      .then((issues) => {
        if (!cancelled && Array.isArray(issues))
          setProjectIssueCount(issues.length);
      })
      .catch(() => {
        if (!cancelled) setProject(null);
        setProjectIssueCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId]);

  const pathname = location.pathname;

  // Match route patterns to pick header
  const isWorkspaceHome = workspaceSlug && pathname === `/${workspaceSlug}`;
  const isSettings =
    workspaceSlug &&
    (pathname === `/${workspaceSlug}/settings` ||
      pathname.startsWith(`/${workspaceSlug}/settings/`));
  const isProjectsList =
    workspaceSlug && pathname === `/${workspaceSlug}/projects`;
  const projectBase =
    workspaceSlug && projectId ? `/${workspaceSlug}/projects/${projectId}` : "";
  const isIssuesPage = projectBase && pathname === `${projectBase}/issues`;
  const isCyclesPage = projectBase && pathname === `${projectBase}/cycles`;
  const isModulesPage = projectBase && pathname === `${projectBase}/modules`;
  const isViewsPage = projectBase && pathname === `${projectBase}/views`;
  const isPagesPage = projectBase && pathname === `${projectBase}/pages`;
  const isProjectSection =
    isIssuesPage || isCyclesPage || isModulesPage || isViewsPage || isPagesPage;
  const isProjectDetail =
    workspaceSlug &&
    projectId &&
    pathname.startsWith(`/${workspaceSlug}/projects/${projectId}`);
  const isInbox =
    workspaceSlug && pathname === `/${workspaceSlug}/notifications`;
  const isProfilePage =
    workspaceSlug && /^\/[^/]+\/profile\/[^/]+$/.test(pathname);
  const isAnalyticsPage =
    workspaceSlug &&
    (pathname === `/${workspaceSlug}/analytics` ||
      pathname.startsWith(`/${workspaceSlug}/analytics/`));
  const isWorkspaceViewsPage =
    workspaceSlug &&
    (pathname === `/${workspaceSlug}/views` ||
      pathname.startsWith(`/${workspaceSlug}/views/`));

  const projectSection: ProjectSection | null = isIssuesPage
    ? "issues"
    : isCyclesPage
      ? "cycles"
      : isModulesPage
        ? "modules"
        : isViewsPage
          ? "views"
          : isPagesPage
            ? "pages"
            : null;

  let content: React.ReactNode = null;
  if (isWorkspaceHome) {
    content = <HomeHeader />;
  } else if (isProfilePage) {
    content = <YourWorkHeader />;
  } else if (isInbox) {
    content = <InboxHeader />;
  } else if (isSettings) {
    content = <SettingsHeader />;
  } else if (isProjectsList && workspaceSlug) {
    content = <ProjectsHeader workspaceSlug={workspaceSlug} />;
  } else if (isAnalyticsPage && workspaceSlug) {
    content = <AnalyticsHeader workspaceSlug={workspaceSlug} />;
  } else if (isWorkspaceViewsPage && workspaceSlug) {
    content = <WorkspaceViewsHeader />;
  } else if (
    isProjectSection &&
    workspaceSlug &&
    projectId &&
    project &&
    projectSection
  ) {
    content = (
      <ProjectSectionHeader
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        projectName={project.name}
        section={projectSection}
        issueCount={projectIssueCount}
      />
    );
  } else if (isProjectDetail && workspaceSlug && projectId && project) {
    content = (
      <ProjectDetailHeader
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        title={project.name}
      />
    );
  } else if (workspaceSlug && projectId && project) {
    content = (
      <ProjectDetailHeader
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        title={project.name}
      />
    );
  } else if (workspaceSlug) {
    content = <HomeHeader />;
  }

  if (content == null) return null;

  return (
    <header
      className="flex min-h-[52px] shrink-0 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-[var(--padding-page)] py-3"
      role="banner"
    >
      {content}
    </header>
  );
}
