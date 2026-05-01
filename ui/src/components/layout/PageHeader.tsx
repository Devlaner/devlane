import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button, Tooltip } from '../ui';
import { Dropdown } from '../work-item';
import { useModulesFilter } from '../../contexts/ModulesFilterContext';
import { useWorkspaceViewsState } from '../../contexts/WorkspaceViewsStateContext';
import {
  WorkspaceViewsFiltersDropdown,
  WorkspaceViewsDisplayDropdown,
  WorkspaceViewsEllipsisMenu,
  CreateViewModal,
  ModuleFiltersPanel,
} from '../workspace-views';
import { ProjectSavedViewDisplayDropdown } from '../project-saved-view/ProjectSavedViewDisplayDropdown';
import { ProjectSavedViewMoreMenu } from '../project-saved-view/ProjectSavedViewMoreMenu';
import { DateRangeModal } from '../workspace-views/DateRangeModal';
import { CreateModuleModal } from '../CreateModuleModal';
import { CreateCycleModal } from '../CreateCycleModal';
import { ProjectIssuesFiltersPanel } from '../project-issues/ProjectIssuesFiltersPanel';
import { ProjectIssuesDisplayPanel } from '../project-issues/ProjectIssuesDisplayPanel';
import { useAuth } from '../../contexts/AuthContext';
import { workspaceService } from '../../services/workspaceService';
import { projectService } from '../../services/projectService';
import { cycleService } from '../../services/cycleService';
import { labelService } from '../../services/labelService';
import { issueService } from '../../services/issueService';
import { viewService } from '../../services/viewService';
import { moduleService } from '../../services/moduleService';
import { ProjectIconDisplay } from '../ProjectIconModal';
import type {
  WorkspaceApiResponse,
  ProjectApiResponse,
  IssueViewApiResponse,
  ModuleApiResponse,
  WorkspaceMemberApiResponse,
  CycleApiResponse,
  LabelApiResponse,
} from '../../api/types';
import {
  PROJECT_CYCLES_FILTER_EVENT,
  PROJECT_CYCLES_REFRESH_EVENT,
} from '../../lib/projectCyclesEvents';
import { dispatchOpenHomeWidgets } from '../../lib/homeWidgetsEvents';
import {
  DEFAULT_PROJECT_ISSUES_FILTERS,
  PROJECT_ISSUES_DISPLAY_EVENT,
  PROJECT_ISSUES_FILTER_EVENT,
  type ProjectIssuesFiltersState,
} from '../../lib/projectIssuesEvents';
import {
  cloneDefaultProjectIssuesDisplay,
  parseProjectIssuesDisplay,
  projectIssuesDisplayStorageKey,
  serializeProjectIssuesDisplay,
  toDisplayPayload,
  type ProjectIssuesDisplayState,
} from '../../lib/projectIssuesDisplay';
import { PROJECT_VIEWS_FILTER_EVENT } from '../../lib/projectViewsEvents';
import { slugify } from '../../lib/slug';
import { MODULE_WORK_ITEMS_COUNT_EVENT } from '../../lib/moduleWorkItemsPrefs';
import { ModuleDetailHeader } from './ModuleDetailHeader';

export type ProjectSection = 'issues' | 'cycles' | 'modules' | 'views' | 'pages';

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
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden>
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

const IconPencil = () => (
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
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  </svg>
);

const IconChevronUp = () => (
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
    <path d="m18 15-6-6-6 6" />
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
const IconSpreadsheet = () => (
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
const IconGantt = () => (
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
    <path d="M3 6v12" />
    <path d="M3 12h6" />
    <path d="M3 18h4" />
    <path d="M13 8h8" />
    <path d="M13 12h5" />
    <path d="M13 16h6" />
  </svg>
);
const IconArrowUpDown = () => (
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
    <path d="m21 16-4 4-4-4" />
    <path d="M17 20V4" />
    <path d="m3 8 4-4 4 4" />
    <path d="M7 4v16" />
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
const IconSliders = () => (
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
    <line x1="4" y1="21" x2="4" y2="14" />
    <line x1="4" y1="10" x2="4" y2="3" />
    <line x1="12" y1="21" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12" y2="3" />
    <line x1="20" y1="21" x2="20" y2="16" />
    <line x1="20" y1="12" x2="20" y2="3" />
    <line x1="1" y1="14" x2="7" y2="14" />
    <line x1="9" y1="8" x2="15" y2="8" />
    <line x1="17" y1="16" x2="23" y2="16" />
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
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
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
const IconProjectViews = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
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
const IconStack = () => (
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
    <rect width="16" height="12" x="4" y="2" rx="1" />
    <rect width="16" height="12" x="6" y="6" rx="1" />
    <rect width="16" height="12" x="8" y="10" rx="1" />
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
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const sections: ProjectSection[] = ['issues', 'cycles', 'modules', 'views', 'pages'];
  const currentLabel = SECTION_LABELS[currentSection];
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
                {SECTION_LABELS[section]}
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

function YourWorkHeader() {
  return (
    <div className="flex items-center gap-2 text-sm font-medium text-(--txt-secondary)">
      <span className="flex size-5 items-center justify-center text-(--txt-icon-tertiary)">
        <IconUser />
      </span>
      Your work
    </div>
  );
}

function InboxHeader() {
  return (
    <>
      <div className="flex items-center gap-2 text-sm font-medium text-(--txt-secondary)">
        <span className="flex size-5 items-center justify-center text-(--txt-icon-tertiary)">
          <IconInbox />
        </span>
        Inbox
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-md text-(--txt-icon-tertiary) hover:bg-(--bg-layer-2) hover:text-(--txt-icon-secondary)"
          aria-label="Mark as read"
        >
          <IconCheck />
        </button>
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-md text-(--txt-icon-tertiary) hover:bg-(--bg-layer-2) hover:text-(--txt-icon-secondary)"
          aria-label="Archive"
        >
          <IconArchive />
        </button>
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-md text-(--txt-icon-tertiary) hover:bg-(--bg-layer-2) hover:text-(--txt-icon-secondary)"
          aria-label="Filters"
        >
          <IconFilter />
        </button>
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-md text-(--txt-icon-tertiary) hover:bg-(--bg-layer-2) hover:text-(--txt-icon-secondary)"
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
      <div className="flex items-center gap-2 text-sm font-medium text-(--txt-secondary)">
        <span className="flex size-5 items-center justify-center text-(--txt-icon-tertiary)">
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
      <div className="flex items-center gap-2 text-sm font-medium text-(--txt-secondary)">
        <span className="flex size-5 items-center justify-center text-(--txt-icon-tertiary)">
          <IconHome />
        </span>
        Home
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-[13px] font-medium text-(--txt-secondary)"
          onClick={() => dispatchOpenHomeWidgets()}
        >
          <IconGrid />
          Manage widgets
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-[13px] font-medium text-(--txt-secondary)"
        >
          <IconGitHub />
          Star us on GitHub
        </Button>
      </div>
    </>
  );
}

function DraftsHeader() {
  return (
    <>
      <div className="flex items-center gap-2 text-sm font-medium text-(--txt-secondary)">
        <span className="flex size-5 items-center justify-center text-(--txt-icon-tertiary)">
          <IconPencil />
        </span>
        Drafts
      </div>
      <div className="flex items-center gap-2">
        <Link to="?create=1" className="no-underline">
          <Button size="sm" className="gap-1.5 text-[13px] font-medium">
            Draft a work item
          </Button>
        </Link>
      </div>
    </>
  );
}

function ProjectsHeader({ workspaceSlug }: { workspaceSlug: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') ?? '';
  const [searchOpen, setSearchOpen] = useState(!!searchQuery);

  const baseUrl = `/${workspaceSlug}`;

  return (
    <>
      <div className="flex items-center gap-2 text-sm font-medium text-(--txt-secondary)">
        <span className="flex size-5 items-center justify-center text-(--txt-icon-tertiary)">
          <IconBriefcase />
        </span>
        Projects
      </div>
      <div className="flex flex-1 items-center justify-end gap-2 min-w-0">
        <div
          className={`overflow-hidden transition-[width] duration-200 ease-out ${searchOpen ? 'w-56' : 'w-0'}`}
        >
          <div className="flex items-center gap-2 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2 py-1.5">
            <span className="shrink-0 text-(--txt-icon-tertiary)">
              <IconSearch />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchParams({ q: e.target.value }, { replace: true })}
              placeholder="Search projects"
              className="min-w-0 flex-1 bg-transparent text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none"
              aria-label="Search projects"
            />
            <button
              type="button"
              onClick={() => {
                setSearchParams({}, { replace: true });
                setSearchOpen(false);
              }}
              className="shrink-0 rounded p-0.5 text-(--txt-icon-tertiary) hover:bg-(--bg-layer-transparent-hover) hover:text-(--txt-secondary)"
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
            className="flex size-8 shrink-0 items-center justify-center rounded-md border border-(--border-subtle) bg-(--bg-layer-2) text-(--txt-icon-tertiary) hover:bg-(--bg-layer-2-hover)"
            aria-label="Search projects"
          >
            <IconSearch />
          </button>
        )}
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 py-1.5 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)"
        >
          <IconCalendar />
          Created date
          <IconChevronDown />
        </button>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 py-1.5 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)"
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
  project,
  title,
}: {
  workspaceSlug: string;
  projectId: string;
  project: ProjectApiResponse;
  title: string;
}) {
  return (
    <>
      <div className="flex items-center gap-2 text-sm font-semibold text-(--txt-primary)">
        <span className="flex size-5 shrink-0 items-center justify-center">
          <ProjectIconDisplay
            emoji={project.emoji}
            icon_prop={project.icon_prop}
            size={16}
            className="leading-none"
          />
        </span>
        {title}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-md text-(--txt-icon-tertiary) hover:bg-(--bg-layer-transparent-hover) hover:text-(--txt-icon-secondary)"
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
  project,
  projectName,
  section,
  issueCount,
}: {
  workspaceSlug: string;
  projectId: string;
  project: ProjectApiResponse;
  projectName: string;
  section: ProjectSection;
  issueCount: number;
}) {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const modulesFilter = useModulesFilter();
  const { display: viewsDisplay, setDisplay } = useWorkspaceViewsState();
  const [searchParams, setSearchParams] = useSearchParams();
  const baseUrl = `/${workspaceSlug}/projects/${projectId}`;
  const issuesUrl = `${baseUrl}/issues`;
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);
  const [createModuleOpen, setCreateModuleOpen] = useState(false);
  const [modulesSearchExpanded, setModulesSearchExpanded] = useState(false);
  const [modulesFiltersOpen, setModulesFiltersOpen] = useState<string | null>(null);
  const [modulesSortOpen, setModulesSortOpen] = useState<string | null>(null);
  const [viewsSortOpen, setViewsSortOpen] = useState<string | null>(null);
  const [viewsFiltersOpen, setViewsFiltersOpen] = useState<string | null>(null);
  const [viewsSearchOpen, setViewsSearchOpen] = useState(false);
  const [viewsSearchQuery, setViewsSearchQuery] = useState('');
  const [viewsFavOnly, setViewsFavOnly] = useState(false);
  const [viewsCreatedDate, setViewsCreatedDate] = useState<
    '1_week' | '2_weeks' | '1_month' | 'custom' | null
  >(null);
  const [viewsCreatedAfter, setViewsCreatedAfter] = useState<string | null>(null);
  const [viewsCreatedBefore, setViewsCreatedBefore] = useState<string | null>(null);
  const [viewsCreatedBy, setViewsCreatedBy] = useState<string[]>([]);
  const [viewsMembers, setViewsMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [modulesDateRangeModal, setModulesDateRangeModal] = useState<'start' | 'due' | null>(null);
  const [createCycleOpen, setCreateCycleOpen] = useState(false);
  const [cyclesFiltersDropdownOpen, setCyclesFiltersDropdownOpen] = useState<string | null>(null);
  const [cyclesStatusSectionOpen, setCyclesStatusSectionOpen] = useState(true);
  const [cyclesStartSectionOpen, setCyclesStartSectionOpen] = useState(true);
  const [cyclesDueSectionOpen, setCyclesDueSectionOpen] = useState(true);
  const [cyclesFiltersSearch, setCyclesFiltersSearch] = useState('');
  const [cyclesSearchExpanded, setCyclesSearchExpanded] = useState(false);
  const [cyclesSearch, setCyclesSearch] = useState('');
  const [cyclesDateRangeModal, setCyclesDateRangeModal] = useState<'start' | 'due' | null>(null);
  const [cyclesSelectedStatusKeys, setCyclesSelectedStatusKeys] = useState<string[]>([]);
  const [cyclesSelectedStartDatePresets, setCyclesSelectedStartDatePresets] = useState<string[]>(
    [],
  );
  const [cyclesSelectedDueDatePresets, setCyclesSelectedDueDatePresets] = useState<string[]>([]);
  const [cyclesStartAfter, setCyclesStartAfter] = useState<string | null>(null);
  const [cyclesStartBefore, setCyclesStartBefore] = useState<string | null>(null);
  const [cyclesDueAfter, setCyclesDueAfter] = useState<string | null>(null);
  const [cyclesDueBefore, setCyclesDueBefore] = useState<string | null>(null);
  const [issuesFiltersOpen, setIssuesFiltersOpen] = useState<string | null>(null);
  const [issuesFiltersSearch, setIssuesFiltersSearch] = useState('');
  const [issuesMembers, setIssuesMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [issuesCycles, setIssuesCycles] = useState<CycleApiResponse[]>([]);
  const [issuesLabels, setIssuesLabels] = useState<LabelApiResponse[]>([]);
  const [issuesFilters, setIssuesFilters] = useState<ProjectIssuesFiltersState>(() => ({
    ...DEFAULT_PROJECT_ISSUES_FILTERS,
  }));
  const [issuesDateRangeModal, setIssuesDateRangeModal] = useState<'start' | 'due' | null>(null);
  const [issuesDisplayOpen, setIssuesDisplayOpen] = useState<string | null>(null);
  const [issuesDisplay, setIssuesDisplay] = useState<ProjectIssuesDisplayState>(() =>
    cloneDefaultProjectIssuesDisplay(),
  );
  const projectDropdownRef = useRef<HTMLDivElement | null>(null);
  const modulesSearchInputRef = useRef<HTMLInputElement | null>(null);
  const cyclesSearchInputRef = useRef<HTMLInputElement | null>(null);

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

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(e.target as Node)) {
        setProjectDropdownOpen(false);
      }
    };
    if (projectDropdownOpen) {
      document.addEventListener('mousedown', handler);
    }
    return () => {
      document.removeEventListener('mousedown', handler);
    };
  }, [projectDropdownOpen]);

  useEffect(() => {
    if (modulesSearchExpanded) {
      modulesSearchInputRef.current?.focus();
    }
  }, [modulesSearchExpanded]);

  useEffect(() => {
    if (cyclesSearchExpanded) {
      cyclesSearchInputRef.current?.focus();
    }
  }, [cyclesSearchExpanded]);

  useEffect(() => {
    if (section !== 'views') return;
    let cancelled = false;
    workspaceService
      .listMembers(workspaceSlug)
      .then((mem) => {
        if (!cancelled) setViewsMembers(mem ?? []);
      })
      .catch(() => {
        if (!cancelled) setViewsMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [section, workspaceSlug]);

  useEffect(() => {
    if (section !== 'issues') return;
    let cancelled = false;
    workspaceService
      .listMembers(workspaceSlug)
      .then((mem) => {
        if (!cancelled) setIssuesMembers(mem ?? []);
      })
      .catch(() => {
        if (!cancelled) setIssuesMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [section, workspaceSlug]);

  useEffect(() => {
    if (section !== 'issues' || !workspaceSlug || !projectId) return;
    let cancelled = false;
    Promise.all([
      cycleService.list(workspaceSlug, projectId),
      labelService.list(workspaceSlug, projectId),
    ])
      .then(([cyc, lab]) => {
        if (!cancelled) {
          setIssuesCycles(Array.isArray(cyc) ? cyc : []);
          setIssuesLabels(Array.isArray(lab) ? lab : []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIssuesCycles([]);
          setIssuesLabels([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [section, workspaceSlug, projectId]);

  useEffect(() => {
    if (section !== 'issues' || !workspaceSlug || !projectId) return;
    window.dispatchEvent(
      new CustomEvent(PROJECT_ISSUES_FILTER_EVENT, {
        detail: { workspaceSlug, projectId, filters: issuesFilters },
      }),
    );
  }, [section, workspaceSlug, projectId, issuesFilters]);

  useEffect(() => {
    if (section !== 'issues') return;
    if (!workspaceSlug || !projectId) return;
    const key = projectIssuesDisplayStorageKey(workspaceSlug, projectId);
    try {
      const raw = localStorage.getItem(key);
      const parsed = parseProjectIssuesDisplay(raw);
      queueMicrotask(() => setIssuesDisplay(parsed ?? cloneDefaultProjectIssuesDisplay()));
    } catch {
      queueMicrotask(() => setIssuesDisplay(cloneDefaultProjectIssuesDisplay()));
    }
  }, [section, workspaceSlug, projectId]);

  useEffect(() => {
    if (section !== 'issues' || !workspaceSlug || !projectId) return;
    try {
      localStorage.setItem(
        projectIssuesDisplayStorageKey(workspaceSlug, projectId),
        serializeProjectIssuesDisplay(issuesDisplay),
      );
    } catch {
      // ignore quota / private mode
    }
  }, [section, workspaceSlug, projectId, issuesDisplay]);

  useEffect(() => {
    if (section !== 'issues' || !workspaceSlug || !projectId) return;
    window.dispatchEvent(
      new CustomEvent(PROJECT_ISSUES_DISPLAY_EVENT, {
        detail: {
          workspaceSlug,
          projectId,
          display: toDisplayPayload(issuesDisplay),
        },
      }),
    );
  }, [section, workspaceSlug, projectId, issuesDisplay]);

  const dispatchViewsFilters = (
    next: Partial<{
      query: string;
      favoritesOnly: boolean;
      createdDatePreset: '1_week' | '2_weeks' | '1_month' | 'custom' | null;
      createdAfter: string | null;
      createdBefore: string | null;
      createdByIds: string[];
    }>,
  ) => {
    window.dispatchEvent(
      new CustomEvent(PROJECT_VIEWS_FILTER_EVENT, {
        detail: {
          query: viewsSearchQuery,
          favoritesOnly: viewsFavOnly,
          createdDatePreset: viewsCreatedDate,
          createdAfter: viewsCreatedAfter,
          createdBefore: viewsCreatedBefore,
          createdByIds: viewsCreatedBy,
          ...next,
        },
      }),
    );
  };

  useEffect(() => {
    if (section !== 'cycles') return;
    if (!workspaceSlug || !projectId) return;

    window.dispatchEvent(
      new CustomEvent(PROJECT_CYCLES_FILTER_EVENT, {
        detail: {
          workspaceSlug,
          projectId,
          filters: {
            searchQuery: cyclesSearch,
            statusKeys: cyclesSelectedStatusKeys,
            startDatePresets: cyclesSelectedStartDatePresets,
            dueDatePresets: cyclesSelectedDueDatePresets,
            startAfter: cyclesStartAfter,
            startBefore: cyclesStartBefore,
            dueAfter: cyclesDueAfter,
            dueBefore: cyclesDueBefore,
          },
        },
      }),
    );
  }, [
    section,
    workspaceSlug,
    projectId,
    cyclesSearch,
    cyclesSelectedStatusKeys,
    cyclesSelectedStartDatePresets,
    cyclesSelectedDueDatePresets,
    cyclesStartAfter,
    cyclesStartBefore,
    cyclesDueAfter,
    cyclesDueBefore,
  ]);

  const q = (s: string) => s.trim().toLowerCase();
  const filteredProjects = projects.filter((p) => q(p.name).includes(q(projectSearch)));

  const handleSelectProject = (targetProjectId: string) => {
    const targetBase = `/${workspaceSlug}/projects/${targetProjectId}`;
    const targetPath =
      section === 'issues'
        ? `${targetBase}/issues`
        : section === 'cycles'
          ? `${targetBase}/cycles`
          : section === 'modules'
            ? `${targetBase}/modules`
            : section === 'views'
              ? `${targetBase}/views`
              : `${targetBase}/pages`;
    setProjectDropdownOpen(false);
    navigate(targetPath);
  };

  const currentLayout = modulesFilter.layout;

  const rightActions = () => {
    if (section === 'issues') {
      return (
        <>
          {(() => {
            const layouts: { key: string; label: string; icon: React.ReactNode }[] = [
              { key: 'list', label: 'List', icon: <IconList /> },
              { key: 'board', label: 'Board', icon: <IconColumns /> },
              { key: 'calendar', label: 'Calendar', icon: <IconCalendar /> },
              { key: 'spreadsheet', label: 'Spreadsheet', icon: <IconSpreadsheet /> },
              { key: 'gantt', label: 'Timeline', icon: <IconGantt /> },
            ];
            const activeLayout = (() => {
              const v = searchParams.get('layout') ?? '';
              return layouts.some((l) => l.key === v) ? v : 'list';
            })();
            const setLayout = (k: string) => {
              const next = new URLSearchParams(searchParams);
              if (k === 'list') next.delete('layout');
              else next.set('layout', k);
              setSearchParams(next, { replace: true });
            };
            return (
              <div className="flex h-8 overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-layer-1) p-0.5">
                {layouts.map((l) => {
                  const active = activeLayout === l.key;
                  return (
                    <button
                      key={l.key}
                      type="button"
                      title={l.label}
                      aria-label={l.label}
                      aria-pressed={active}
                      onClick={() => setLayout(l.key)}
                      className={
                        active
                          ? 'flex size-7 items-center justify-center rounded-md bg-(--bg-layer-2) text-(--txt-primary) shadow-sm'
                          : 'flex size-7 items-center justify-center rounded-md text-(--txt-icon-tertiary) hover:bg-(--bg-layer-2-hover) hover:text-(--txt-secondary)'
                      }
                    >
                      {l.icon}
                    </button>
                  );
                })}
              </div>
            );
          })()}
          <div className="mx-1 w-px self-stretch bg-(--border-subtle)" />
          <div className="relative shrink-0">
            <Dropdown
              id="project-issues-filters"
              openId={issuesFiltersOpen}
              onOpen={setIssuesFiltersOpen}
              label="Filters"
              icon={<IconFilter />}
              displayValue="Filters"
              panelClassName="flex w-[min(400px,calc(100vw-24px))] max-h-[min(calc(100dvh-96px),36rem)] flex-col overflow-hidden rounded-md border border-(--border-subtle) bg-(--bg-surface-1) shadow-(--shadow-raised)"
              align="right"
              triggerClassName="flex items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 py-1.5 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)"
              triggerContent={
                <>
                  <span className="shrink-0 text-(--txt-icon-tertiary)">
                    <IconFilter />
                  </span>
                  <span className="truncate">Filters</span>
                  <span className="shrink-0 text-(--txt-icon-tertiary)">
                    {issuesFiltersOpen === 'project-issues-filters' ? (
                      <IconChevronUp />
                    ) : (
                      <IconChevronDown />
                    )}
                  </span>
                </>
              }
            >
              <ProjectIssuesFiltersPanel
                search={issuesFiltersSearch}
                onSearchChange={setIssuesFiltersSearch}
                filters={issuesFilters}
                setFilters={setIssuesFilters}
                members={issuesMembers}
                cycles={issuesCycles}
                labels={issuesLabels}
                currentUserId={authUser?.id}
                currentUserName={authUser?.name ?? 'You'}
                currentUserAvatarUrl={authUser?.avatarUrl}
                onOpenCustomStart={() => {
                  setIssuesFiltersOpen(null);
                  setIssuesDateRangeModal('start');
                }}
                onOpenCustomDue={() => {
                  setIssuesFiltersOpen(null);
                  setIssuesDateRangeModal('due');
                }}
              />
            </Dropdown>
            {[
              issuesFilters.priorities.length,
              issuesFilters.stateGroups.length,
              issuesFilters.assigneeIds.length,
              issuesFilters.cycleIds.length,
              issuesFilters.mentionedUserIds.length,
              issuesFilters.createdByIds.length,
              issuesFilters.labelIds.length,
              issuesFilters.workItemGrouping === 'all' ? 0 : 1,
              issuesFilters.startDate.length,
              issuesFilters.dueDate.length,
            ].some((n) => n > 0) && (
              <span
                className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-(--brand-default)"
                aria-hidden
              />
            )}
          </div>
          <Dropdown
            id="project-issues-display"
            openId={issuesDisplayOpen}
            onOpen={setIssuesDisplayOpen}
            label="Display"
            icon={<IconSliders />}
            displayValue="Display"
            panelClassName="w-[min(400px,calc(100vw-24px))] max-h-[min(calc(100dvh-96px),50rem)] overflow-hidden rounded-md border border-(--border-subtle) bg-(--bg-surface-1) shadow-(--shadow-raised)"
            align="right"
            triggerClassName="flex items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 py-1.5 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)"
            triggerContent={
              <>
                <span className="shrink-0 text-(--txt-icon-tertiary)">
                  <IconSliders />
                </span>
                <span className="truncate">Display</span>
                <span className="shrink-0 text-(--txt-icon-tertiary)">
                  {issuesDisplayOpen === 'project-issues-display' ? (
                    <IconChevronUp />
                  ) : (
                    <IconChevronDown />
                  )}
                </span>
              </>
            }
          >
            <ProjectIssuesDisplayPanel display={issuesDisplay} setDisplay={setIssuesDisplay} />
          </Dropdown>
          <Link
            to={`/${workspaceSlug}/analytics/work-items`}
            className="flex items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 py-1.5 text-[13px] font-medium text-(--txt-secondary) no-underline hover:bg-(--bg-layer-2-hover)"
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
    if (section === 'cycles') {
      const showCyclesSearchInput = cyclesSearchExpanded || cyclesSearch.length > 0;
      return (
        <>
          {showCyclesSearchInput ? (
            <div className="flex h-8 min-w-35 max-w-50 items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2">
              <span className="shrink-0 text-(--txt-icon-tertiary)" aria-hidden>
                <IconSearch />
              </span>
              <input
                ref={cyclesSearchInputRef}
                type="text"
                value={cyclesSearch}
                onChange={(e) => setCyclesSearch(e.target.value)}
                onBlur={() => {
                  if (cyclesSearch.length === 0) setCyclesSearchExpanded(false);
                }}
                placeholder="Search"
                className="min-w-0 flex-1 bg-transparent text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none"
                aria-label="Search cycles"
              />
              {cyclesSearch.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCyclesSearch('')}
                  className="shrink-0 rounded p-0.5 text-(--txt-icon-tertiary) hover:bg-(--bg-layer-2-hover) hover:text-(--txt-icon-secondary)"
                  aria-label="Clear search"
                >
                  <IconX />
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCyclesSearchExpanded(true)}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-(--border-subtle) bg-(--bg-layer-2) text-(--txt-icon-tertiary) hover:bg-(--bg-layer-2-hover) hover:text-(--txt-icon-secondary)"
              aria-label="Search cycles"
            >
              <IconSearch />
            </button>
          )}
          <Dropdown
            id="cycles-filters"
            openId={cyclesFiltersDropdownOpen}
            onOpen={setCyclesFiltersDropdownOpen}
            label="Filters"
            icon={<IconFilter />}
            displayValue="Filters"
            triggerClassName="flex items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 py-1.5 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)"
            triggerContent={
              <span className="flex items-center gap-1.5">
                <IconFilter /> Filters <IconChevronDown />
              </span>
            }
            panelClassName="flex w-[280px] max-h-[min(70vh,28rem)] flex-col rounded-md border border-(--border-subtle) bg-(--bg-surface-1) shadow-(--shadow-raised) overflow-hidden"
            align="right"
          >
            <div className="sticky top-0 shrink-0 border-b border-(--border-subtle) bg-(--bg-surface-1) p-2">
              <div className="flex items-center gap-2 rounded border border-(--border-subtle) bg-(--bg-layer-1) px-2 py-1.5">
                <span className="shrink-0 text-(--txt-icon-tertiary)" aria-hidden>
                  <IconSearch />
                </span>
                <input
                  type="text"
                  placeholder="Search"
                  value={cyclesFiltersSearch}
                  onChange={(e) => setCyclesFiltersSearch(e.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto py-1">
              <div className="border-b border-(--border-subtle) last:border-b-0">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-semibold text-(--txt-primary) hover:bg-(--bg-layer-2-hover)"
                  onClick={() => setCyclesStatusSectionOpen((o) => !o)}
                >
                  <span>Status of the cycle</span>
                  <span className="text-(--txt-icon-tertiary)">
                    {cyclesStatusSectionOpen ? <IconChevronUp /> : <IconChevronDown />}
                  </span>
                </button>
                {cyclesStatusSectionOpen && (
                  <div className="pb-1">
                    {[
                      { key: 'in_progress', label: 'In progress' },
                      { key: 'yet_to_start', label: 'Yet to start' },
                      { key: 'completed', label: 'Completed' },
                      { key: 'draft', label: 'Draft' },
                    ]
                      .filter(
                        (s) =>
                          !cyclesFiltersSearch.trim() ||
                          s.label.toLowerCase().includes(cyclesFiltersSearch.trim().toLowerCase()),
                      )
                      .map((s) => (
                        <label
                          key={s.key}
                          className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-(--txt-primary) hover:bg-(--bg-layer-2-hover)"
                        >
                          <input
                            type="checkbox"
                            checked={cyclesSelectedStatusKeys.includes(s.key)}
                            onChange={() => {
                              setCyclesSelectedStatusKeys((prev) =>
                                prev.includes(s.key)
                                  ? prev.filter((k) => k !== s.key)
                                  : [...prev, s.key],
                              );
                            }}
                            className="rounded border-(--border-subtle)"
                          />
                          <span>{s.label}</span>
                        </label>
                      ))}
                  </div>
                )}
              </div>

              <div className="border-b border-(--border-subtle) last:border-b-0">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-semibold text-(--txt-primary) hover:bg-(--bg-layer-2-hover)"
                  onClick={() => setCyclesStartSectionOpen((o) => !o)}
                >
                  <span>Start date</span>
                  <span className="text-(--txt-icon-tertiary)">
                    {cyclesStartSectionOpen ? <IconChevronUp /> : <IconChevronDown />}
                  </span>
                </button>
                {cyclesStartSectionOpen && (
                  <div className="pb-1">
                    {[
                      { key: '1_week', label: '1 week from now' },
                      { key: '2_weeks', label: '2 weeks from now' },
                      { key: '1_month', label: '1 month from now' },
                      { key: '2_months', label: '2 months from now' },
                      { key: 'custom', label: 'Custom' },
                    ].map((p) => {
                      const checked = cyclesSelectedStartDatePresets.includes(p.key);
                      return (
                        <label
                          key={p.key}
                          className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-(--txt-primary) hover:bg-(--bg-layer-2-hover)"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              if (p.key === 'custom') {
                                if (checked) {
                                  setCyclesSelectedStartDatePresets((prev) =>
                                    prev.filter((k) => k !== 'custom'),
                                  );
                                  setCyclesStartAfter(null);
                                  setCyclesStartBefore(null);
                                } else {
                                  setCyclesSelectedStartDatePresets((prev) => [...prev, 'custom']);
                                  setCyclesFiltersDropdownOpen(null);
                                  setCyclesDateRangeModal('start');
                                }
                                return;
                              }

                              setCyclesSelectedStartDatePresets((prev) =>
                                prev.includes(p.key)
                                  ? prev.filter((k) => k !== p.key)
                                  : [...prev, p.key],
                              );
                            }}
                            className="rounded border-(--border-subtle)"
                          />
                          <span>{p.label}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="border-b border-(--border-subtle) last:border-b-0">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-semibold text-(--txt-primary) hover:bg-(--bg-layer-2-hover)"
                  onClick={() => setCyclesDueSectionOpen((o) => !o)}
                >
                  <span>Due date</span>
                  <span className="text-(--txt-icon-tertiary)">
                    {cyclesDueSectionOpen ? <IconChevronUp /> : <IconChevronDown />}
                  </span>
                </button>
                {cyclesDueSectionOpen && (
                  <div className="pb-1">
                    {[
                      { key: '1_week', label: '1 week from now' },
                      { key: '2_weeks', label: '2 weeks from now' },
                      { key: '1_month', label: '1 month from now' },
                      { key: '2_months', label: '2 months from now' },
                      { key: 'custom', label: 'Custom' },
                    ].map((p) => {
                      const checked = cyclesSelectedDueDatePresets.includes(p.key);
                      return (
                        <label
                          key={p.key}
                          className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-(--txt-primary) hover:bg-(--bg-layer-2-hover)"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              if (p.key === 'custom') {
                                if (checked) {
                                  setCyclesSelectedDueDatePresets((prev) =>
                                    prev.filter((k) => k !== 'custom'),
                                  );
                                  setCyclesDueAfter(null);
                                  setCyclesDueBefore(null);
                                } else {
                                  setCyclesSelectedDueDatePresets((prev) => [...prev, 'custom']);
                                  setCyclesFiltersDropdownOpen(null);
                                  setCyclesDateRangeModal('due');
                                }
                                return;
                              }

                              setCyclesSelectedDueDatePresets((prev) =>
                                prev.includes(p.key)
                                  ? prev.filter((k) => k !== p.key)
                                  : [...prev, p.key],
                              );
                            }}
                            className="rounded border-(--border-subtle)"
                          />
                          <span>{p.label}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </Dropdown>
          <Button
            size="sm"
            className="gap-1.5 text-[13px] font-medium"
            onClick={() => setCreateCycleOpen(true)}
          >
            <IconPlus /> Add cycle
          </Button>
        </>
      );
    }
    if (section === 'modules') {
      const listActive = currentLayout === 'list';
      const galleryActive = currentLayout === 'gallery';
      const timelineActive = currentLayout === 'timeline';
      const modulesSearch = modulesFilter.search ?? '';
      const showSearchInput = modulesSearchExpanded || modulesSearch.length > 0;
      return (
        <>
          {showSearchInput ? (
            <div className="flex h-8 min-w-35 max-w-50 items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2">
              <span className="shrink-0 text-(--txt-icon-tertiary)" aria-hidden>
                <IconSearch />
              </span>
              <input
                ref={modulesSearchInputRef}
                type="text"
                value={modulesSearch}
                onChange={(e) => {
                  const v = e.target.value;
                  modulesFilter.setSearch(v);
                }}
                onBlur={() => {
                  if (modulesSearch.length === 0) setModulesSearchExpanded(false);
                }}
                placeholder="Search"
                className="min-w-0 flex-1 bg-transparent text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none"
                aria-label="Search modules"
              />
              {modulesSearch.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    modulesFilter.setSearch('');
                  }}
                  className="shrink-0 rounded p-0.5 text-(--txt-icon-tertiary) hover:bg-(--bg-layer-2-hover) hover:text-(--txt-icon-secondary)"
                  aria-label="Clear search"
                >
                  <IconX />
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setModulesSearchExpanded(true)}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-(--border-subtle) bg-(--bg-layer-2) text-(--txt-icon-tertiary) hover:bg-(--bg-layer-2-hover) hover:text-(--txt-icon-secondary)"
              aria-label="Search modules"
            >
              <IconSearch />
            </button>
          )}
          <Dropdown
            id="modules-sort"
            openId={modulesSortOpen}
            onOpen={setModulesSortOpen}
            label="Sort by"
            icon={<IconArrowUpDown />}
            displayValue={(() => {
              const sort = modulesFilter.sort || 'progress';
              const labels: Record<string, string> = {
                name: 'Name',
                progress: 'Progress',
                work_items: 'Number of work items',
                due_date: 'Due date',
                created_date: 'Created date',
                manual: 'Manual',
              };
              return labels[sort] ?? 'Progress';
            })()}
            panelClassName="min-w-[200px] rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-1 shadow-(--shadow-raised)"
            align="left"
            triggerContent={
              <>
                <span className="shrink-0 text-(--txt-icon-tertiary)">
                  <IconArrowUpDown />
                </span>
                <span className="truncate">
                  {(() => {
                    const sort = modulesFilter.sort || 'progress';
                    const labels: Record<string, string> = {
                      name: 'Name',
                      progress: 'Progress',
                      work_items: 'Number of work items',
                      due_date: 'Due date',
                      created_date: 'Created date',
                      manual: 'Manual',
                    };
                    return labels[sort] ?? 'Progress';
                  })()}
                </span>
                <span className="shrink-0 text-(--txt-icon-tertiary)">
                  <IconChevronDown />
                </span>
              </>
            }
            triggerClassName="flex h-8 items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)"
          >
            {[
              { value: 'name', label: 'Name' },
              { value: 'progress', label: 'Progress' },
              { value: 'work_items', label: 'Number of work items' },
              { value: 'due_date', label: 'Due date' },
              { value: 'created_date', label: 'Created date' },
              { value: 'manual', label: 'Manual' },
            ].map((opt) => {
              const current = modulesFilter.sort || 'progress';
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    modulesFilter.setSort(opt.value);
                    if (!modulesFilter.order) modulesFilter.setOrder('asc');
                    setModulesSortOpen(null);
                  }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-2-hover)"
                >
                  {opt.label}
                  {current === opt.value && (
                    <span className="shrink-0 text-(--txt-primary)">
                      <IconCheck />
                    </span>
                  )}
                </button>
              );
            })}
            <div className="my-1 border-t border-(--border-subtle)" />
            {['asc', 'desc'].map((orderValue) => {
              const currentOrder = modulesFilter.order || 'asc';
              const label = orderValue === 'asc' ? 'Ascending' : 'Descending';
              return (
                <button
                  key={orderValue}
                  type="button"
                  onClick={() => {
                    modulesFilter.setOrder(orderValue as 'asc' | 'desc');
                    setModulesSortOpen(null);
                  }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-2-hover)"
                >
                  {label}
                  {currentOrder === orderValue && (
                    <span className="shrink-0 text-(--txt-primary)">
                      <IconCheck />
                    </span>
                  )}
                </button>
              );
            })}
          </Dropdown>
          <div className="relative shrink-0">
            <Dropdown
              id="modules-filters"
              openId={modulesFiltersOpen}
              onOpen={setModulesFiltersOpen}
              label="Filters"
              icon={<IconFilter />}
              displayValue="Filters"
              panelClassName="flex w-[280px] max-h-[min(70vh,28rem)] flex-col rounded-md border border-(--border-subtle) bg-(--bg-surface-1) shadow-(--shadow-raised) overflow-hidden"
              align="right"
              triggerContent={
                <>
                  <span className="shrink-0 text-(--txt-icon-tertiary)">
                    <IconFilter />
                  </span>
                  <span className="truncate">Filters</span>
                  <span className="shrink-0 text-(--txt-icon-tertiary)">
                    <IconChevronDown />
                  </span>
                </>
              }
              triggerClassName="flex h-8 items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)"
            >
              <ModuleFiltersPanel
                workspaceSlug={workspaceSlug}
                onOpenDateModal={(which) => {
                  setModulesFiltersOpen(null);
                  setModulesDateRangeModal(which);
                }}
              />
            </Dropdown>
            {[
              modulesFilter.search.trim(),
              modulesFilter.favorites ? '1' : '',
              modulesFilter.status.join(','),
              modulesFilter.lead.join(','),
              modulesFilter.members.join(','),
              modulesFilter.startDateList.join(','),
              modulesFilter.dueDateList.join(','),
            ].some(Boolean) && (
              <span
                className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-(--brand-default)"
                aria-hidden
              />
            )}
          </div>
          <div className="flex h-8 overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-layer-1) p-0.5">
            <Tooltip content="List layout">
              <button
                type="button"
                onClick={() => modulesFilter.setLayout('list')}
                className={`flex size-7 items-center justify-center rounded-l-md text-(--txt-icon-secondary) transition-colors ${
                  listActive
                    ? 'bg-(--bg-layer-2) shadow-sm text-(--txt-primary)'
                    : 'bg-transparent text-(--txt-icon-tertiary) hover:bg-(--bg-layer-2-hover)'
                }`}
                aria-pressed={listActive}
              >
                <IconList />
              </button>
            </Tooltip>
            <Tooltip content="Gallery layout">
              <button
                type="button"
                onClick={() => modulesFilter.setLayout('gallery')}
                className={`flex size-7 items-center justify-center text-(--txt-icon-secondary) transition-colors ${
                  galleryActive
                    ? 'bg-(--bg-layer-2) shadow-sm text-(--txt-primary)'
                    : 'bg-transparent text-(--txt-icon-tertiary) hover:bg-(--bg-layer-2-hover)'
                }`}
                aria-pressed={galleryActive}
              >
                <IconLayoutGrid />
              </button>
            </Tooltip>
            <Tooltip content="Timeline layout">
              <button
                type="button"
                onClick={() => modulesFilter.setLayout('timeline')}
                className={`flex size-7 items-center justify-center rounded-r-md text-(--txt-icon-secondary) transition-colors ${
                  timelineActive
                    ? 'bg-(--bg-layer-2) shadow-sm text-(--txt-primary)'
                    : 'bg-transparent text-(--txt-icon-tertiary) hover:bg-(--bg-layer-2-hover)'
                }`}
                aria-pressed={timelineActive}
              >
                <IconStack />
              </button>
            </Tooltip>
          </div>
          <Button
            size="sm"
            className="ml-1 gap-1.5 h-8 text-[13px] font-medium"
            type="button"
            onClick={() => setCreateModuleOpen(true)}
          >
            <IconPlus /> Add Module
          </Button>
        </>
      );
    }
    if (section === 'pages') {
      return (
        <Link to={`${baseUrl}/pages/new`}>
          <Button size="sm" className="gap-1.5 text-[13px] font-medium">
            <IconPlus /> Add page
          </Button>
        </Link>
      );
    }
    if (section === 'views') {
      const activeFilters =
        viewsFavOnly ||
        !!viewsCreatedDate ||
        !!viewsCreatedAfter ||
        !!viewsCreatedBefore ||
        viewsCreatedBy.length > 0;
      const sortLabel =
        viewsDisplay.sortBy === 'name'
          ? 'Name'
          : viewsDisplay.sortBy === 'created_at'
            ? 'Created at'
            : 'Updated at';
      return (
        <>
          <div className="flex items-center">
            {!viewsSearchOpen && (
              <button
                type="button"
                className="flex size-8 items-center justify-center rounded-md border border-(--border-subtle) bg-(--bg-layer-2) text-(--txt-icon-tertiary) hover:bg-(--bg-layer-2-hover) hover:text-(--txt-icon-secondary)"
                aria-label="Search views"
                onClick={() => setViewsSearchOpen(true)}
              >
                <IconSearch />
              </button>
            )}
            <div
              className={`ml-2 overflow-hidden transition-[width] duration-200 ease-out ${
                viewsSearchOpen ? 'w-64' : 'w-0'
              }`}
            >
              <div className="flex items-center gap-2 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2 py-1.5">
                <span className="shrink-0 text-(--txt-icon-tertiary)">
                  <IconSearch />
                </span>
                <input
                  type="text"
                  value={viewsSearchQuery}
                  onChange={(e) => {
                    const v = e.target.value;
                    setViewsSearchQuery(v);
                    dispatchViewsFilters({ query: v });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      if (viewsSearchQuery.trim()) {
                        setViewsSearchQuery('');
                        dispatchViewsFilters({ query: '' });
                      } else {
                        setViewsSearchOpen(false);
                      }
                    }
                  }}
                  placeholder="Search"
                  className="min-w-0 flex-1 bg-transparent text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none"
                  aria-label="Search"
                />
                {viewsSearchOpen && (
                  <button
                    type="button"
                    onClick={() => {
                      setViewsSearchQuery('');
                      dispatchViewsFilters({ query: '' });
                      setViewsSearchOpen(false);
                    }}
                    className="shrink-0 rounded p-0.5 text-(--txt-icon-tertiary) hover:bg-(--bg-layer-2-hover) hover:text-(--txt-icon-secondary)"
                    aria-label="Clear search"
                  >
                    <IconX />
                  </button>
                )}
              </div>
            </div>
          </div>
          <Dropdown
            id="project-views-sort"
            openId={viewsSortOpen}
            onOpen={setViewsSortOpen}
            label="Sort by"
            icon={<IconArrowUpDown />}
            displayValue={sortLabel}
            align="right"
            panelClassName="min-w-[180px] rounded-md border border-(--border-subtle) bg-(--bg-surface-1) py-1 shadow-(--shadow-raised)"
            triggerContent={
              <>
                <span className="shrink-0 text-(--txt-icon-tertiary)">
                  <IconArrowUpDown />
                </span>
                <span className="truncate">{sortLabel}</span>
                <span className="shrink-0 text-(--txt-icon-tertiary)">
                  <IconChevronDown />
                </span>
              </>
            }
            triggerClassName="flex h-8 items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)"
          >
            {[
              { value: 'updated_at', label: 'Updated at' },
              { value: 'created_at', label: 'Created at' },
              { value: 'name', label: 'Name' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setDisplay((prev) => ({
                    ...prev,
                    sortBy: opt.value as typeof prev.sortBy,
                  }));
                  setViewsSortOpen(null);
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-2-hover)"
              >
                {opt.label}
                {viewsDisplay.sortBy === opt.value && (
                  <span className="shrink-0 text-(--txt-primary)">
                    <IconCheck />
                  </span>
                )}
              </button>
            ))}
            <div className="my-1 border-t border-(--border-subtle)" />
            {(['desc', 'asc'] as const).map((orderValue) => (
              <button
                key={orderValue}
                type="button"
                onClick={() => {
                  setDisplay((prev) => ({ ...prev, sortOrder: orderValue }));
                  setViewsSortOpen(null);
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-2-hover)"
              >
                {orderValue === 'desc' ? 'Descending' : 'Ascending'}
                {viewsDisplay.sortOrder === orderValue && (
                  <span className="shrink-0 text-(--txt-primary)">
                    <IconCheck />
                  </span>
                )}
              </button>
            ))}
          </Dropdown>
          <div className="relative shrink-0">
            <Dropdown
              id="project-views-filters"
              openId={viewsFiltersOpen}
              onOpen={setViewsFiltersOpen}
              label="Filters"
              icon={<IconFilter />}
              displayValue="Filters"
              align="right"
              panelClassName="flex w-[300px] max-h-[min(70vh,28rem)] flex-col overflow-hidden rounded-md border border-(--border-subtle) bg-(--bg-surface-1) shadow-(--shadow-raised)"
              triggerContent={
                <>
                  <span className="shrink-0 text-(--txt-icon-tertiary)">
                    <IconFilter />
                  </span>
                  <span className="truncate">Filters</span>
                  <span className="shrink-0 text-(--txt-icon-tertiary)">
                    <IconChevronDown />
                  </span>
                </>
              }
              triggerClassName="flex h-8 items-center gap-1.5 rounded-md border border-(--border-subtle) bg-(--bg-layer-2) px-2.5 text-[13px] font-medium text-(--txt-secondary) hover:bg-(--bg-layer-2-hover)"
            >
              <div className="sticky top-0 shrink-0 border-b border-(--border-subtle) bg-(--bg-surface-1) p-2">
                <div className="flex items-center gap-2 rounded border border-(--border-subtle) bg-(--bg-layer-1) px-2 py-1.5">
                  <span className="shrink-0 text-(--txt-icon-tertiary)">
                    <IconSearch />
                  </span>
                  <input
                    type="text"
                    value={viewsSearchQuery}
                    onChange={(e) => {
                      const v = e.target.value;
                      setViewsSearchQuery(v);
                      dispatchViewsFilters({ query: v });
                    }}
                    placeholder="Search"
                    className="min-w-0 flex-1 bg-transparent text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none"
                  />
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto py-2">
                <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-(--txt-primary) hover:bg-(--bg-layer-2-hover)">
                  <input
                    type="checkbox"
                    checked={viewsFavOnly}
                    onChange={() => {
                      setViewsFavOnly((prev) => {
                        const next = !prev;
                        dispatchViewsFilters({ favoritesOnly: next });
                        return next;
                      });
                    }}
                    className="rounded border-(--border-subtle)"
                  />
                  <span>Favorites</span>
                </label>

                <div className="mt-2">
                  <div className="flex items-center justify-between px-3 py-2 text-xs font-medium text-(--txt-tertiary)">
                    <span>Created date</span>
                  </div>
                  {[
                    { id: '1_week', label: '1 week ago' },
                    { id: '2_weeks', label: '2 weeks ago' },
                    { id: '1_month', label: '1 month ago' },
                    { id: 'custom', label: 'Custom range' },
                  ].map((opt) => (
                    <label
                      key={opt.id}
                      className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-(--txt-primary) hover:bg-(--bg-layer-2-hover)"
                    >
                      <input
                        type="radio"
                        name="views-created-date"
                        checked={viewsCreatedDate === opt.id}
                        onChange={() => {
                          const nextPreset = opt.id as '1_week' | '2_weeks' | '1_month' | 'custom';
                          setViewsCreatedDate(nextPreset);
                          if (nextPreset !== 'custom') {
                            setViewsCreatedAfter(null);
                            setViewsCreatedBefore(null);
                          }
                          dispatchViewsFilters({
                            createdDatePreset: nextPreset,
                            createdAfter: nextPreset === 'custom' ? viewsCreatedAfter : null,
                            createdBefore: nextPreset === 'custom' ? viewsCreatedBefore : null,
                          });
                        }}
                        className="border-(--border-subtle)"
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                  <button
                    type="button"
                    className="w-full px-3 py-1.5 text-left text-sm text-(--txt-tertiary) hover:bg-(--bg-layer-2-hover)"
                    onClick={() => {
                      setViewsCreatedDate(null);
                      setViewsCreatedAfter(null);
                      setViewsCreatedBefore(null);
                      dispatchViewsFilters({
                        createdDatePreset: null,
                        createdAfter: null,
                        createdBefore: null,
                      });
                    }}
                  >
                    Clear created date
                  </button>
                  {viewsCreatedDate === 'custom' && (
                    <div className="px-3 pb-2 pt-1">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="min-w-0">
                          <label className="mb-1 block text-xs text-(--txt-tertiary)">After</label>
                          <input
                            type="date"
                            value={viewsCreatedAfter ?? ''}
                            onChange={(e) => {
                              const nextValue = e.target.value || null;
                              setViewsCreatedAfter(nextValue);
                              dispatchViewsFilters({
                                createdDatePreset: 'custom',
                                createdAfter: nextValue,
                                createdBefore: viewsCreatedBefore,
                              });
                            }}
                            className="w-full rounded border border-(--border-subtle) bg-(--bg-layer-1) px-2 py-1 text-sm text-(--txt-primary) focus:outline-none"
                          />
                        </div>
                        <div className="min-w-0">
                          <label className="mb-1 block text-xs text-(--txt-tertiary)">Before</label>
                          <input
                            type="date"
                            value={viewsCreatedBefore ?? ''}
                            onChange={(e) => {
                              const nextValue = e.target.value || null;
                              setViewsCreatedBefore(nextValue);
                              dispatchViewsFilters({
                                createdDatePreset: 'custom',
                                createdAfter: viewsCreatedAfter,
                                createdBefore: nextValue,
                              });
                            }}
                            className="w-full rounded border border-(--border-subtle) bg-(--bg-layer-1) px-2 py-1 text-sm text-(--txt-primary) focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-2">
                  <div className="flex items-center justify-between px-3 py-2 text-xs font-medium text-(--txt-tertiary)">
                    <span>Created by</span>
                  </div>
                  {viewsMembers.map((m) => {
                    const checked = viewsCreatedBy.includes(m.member_id);
                    const label = m.member_display_name ?? m.member_email ?? m.member_id;
                    return (
                      <label
                        key={m.id}
                        className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-(--txt-primary) hover:bg-(--bg-layer-2-hover)"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setViewsCreatedBy((prev) => {
                              const next = checked
                                ? prev.filter((id) => id !== m.member_id)
                                : [...prev, m.member_id];
                              dispatchViewsFilters({ createdByIds: next });
                              return next;
                            });
                          }}
                          className="rounded border-(--border-subtle)"
                        />
                        {m.member_avatar ? (
                          <img
                            src={m.member_avatar}
                            alt=""
                            className="size-5 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-(--bg-layer-2) text-[10px] text-(--txt-secondary)">
                            {label.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span className="truncate">{label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </Dropdown>
            {activeFilters && (
              <span
                className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-(--brand-default)"
                aria-hidden
              />
            )}
          </div>
          <Button
            size="sm"
            className="gap-1.5 text-[13px] font-medium"
            type="button"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('project-views-create-open'));
            }}
          >
            <IconPlus /> Add view
          </Button>
        </>
      );
    }
    return null;
  };

  return (
    <>
      <div className="relative flex items-center gap-1 text-sm" ref={projectDropdownRef}>
        <Link
          to={issuesUrl}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium text-(--txt-secondary) no-underline hover:bg-(--bg-layer-transparent-hover) hover:text-(--txt-primary)"
        >
          <span className="flex size-5 shrink-0 items-center justify-center">
            <ProjectIconDisplay
              emoji={project.emoji}
              icon_prop={project.icon_prop}
              size={16}
              className="leading-none"
            />
          </span>
          {projectName}
        </Link>
        <button
          type="button"
          onClick={() => setProjectDropdownOpen((o) => !o)}
          className="flex size-8 items-center justify-center rounded-md text-(--txt-icon-tertiary) hover:bg-(--bg-layer-transparent-hover) hover:text-(--txt-icon-secondary)"
          aria-label="Select project"
        >
          <IconChevronDown />
        </button>
        {projectDropdownOpen && (
          <div className="absolute left-0 top-full z-20 mt-1.5 w-64 rounded-md border border-(--border-subtle) bg-(--bg-surface-1) p-1.5 shadow-(--shadow-raised)">
            <div className="mb-1.5 flex items-center gap-2 rounded border border-(--border-subtle) bg-(--bg-layer-1) px-2 py-1.5">
              <span className="shrink-0 text-(--txt-icon-tertiary)">
                <IconSearch />
              </span>
              <input
                type="text"
                placeholder="Search"
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none"
              />
            </div>
            <div className="max-h-64 overflow-y-auto py-0.5">
              {filteredProjects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectProject(p.id)}
                  className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-2-hover)"
                >
                  <span className="truncate">{p.name}</span>
                  {p.id === projectId && (
                    <span className="shrink-0 text-(--txt-primary)">
                      <IconCheck />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
        <span className="shrink-0 text-(--txt-placeholder)" aria-hidden>
          /
        </span>
        <ProjectSectionDropdown
          baseUrl={baseUrl}
          currentSection={section}
          issueCount={issueCount}
        />
      </div>
      <div className="flex items-center gap-1">{rightActions()}</div>
      {section === 'modules' && (
        <>
          <CreateModuleModal
            open={createModuleOpen}
            onClose={() => setCreateModuleOpen(false)}
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            projectName={projectName}
            onCreated={() => {
              setCreateModuleOpen(false);
              window.dispatchEvent(new CustomEvent('modules-refresh'));
            }}
          />
          <DateRangeModal
            open={modulesDateRangeModal !== null}
            onClose={() => setModulesDateRangeModal(null)}
            title={modulesDateRangeModal === 'start' ? 'Start date range' : 'Due date range'}
            after={
              modulesDateRangeModal === 'start'
                ? (modulesFilter.startAfter ?? null)
                : (modulesFilter.dueAfter ?? null)
            }
            before={
              modulesDateRangeModal === 'start'
                ? (modulesFilter.startBefore ?? null)
                : (modulesFilter.dueBefore ?? null)
            }
            onApply={(after, before) => {
              if (modulesDateRangeModal === 'start') {
                modulesFilter.setStartDateList(['custom']);
                modulesFilter.setStartAfter(after);
                modulesFilter.setStartBefore(before);
              } else {
                modulesFilter.setDueDateList(['custom']);
                modulesFilter.setDueAfter(after);
                modulesFilter.setDueBefore(before);
              }
              setModulesDateRangeModal(null);
            }}
          />
        </>
      )}
      {section === 'issues' && (
        <DateRangeModal
          open={issuesDateRangeModal !== null}
          onClose={() => setIssuesDateRangeModal(null)}
          title={issuesDateRangeModal === 'start' ? 'Start date range' : 'Due date range'}
          after={
            issuesDateRangeModal === 'start' ? issuesFilters.startAfter : issuesFilters.dueAfter
          }
          before={
            issuesDateRangeModal === 'start' ? issuesFilters.startBefore : issuesFilters.dueBefore
          }
          onApply={(after, before) => {
            if (issuesDateRangeModal === 'start') {
              setIssuesFilters((prev) => ({
                ...prev,
                startDate: prev.startDate.includes('custom')
                  ? prev.startDate
                  : [...prev.startDate, 'custom'],
                startAfter: after,
                startBefore: before,
              }));
            } else {
              setIssuesFilters((prev) => ({
                ...prev,
                dueDate: prev.dueDate.includes('custom')
                  ? prev.dueDate
                  : [...prev.dueDate, 'custom'],
                dueAfter: after,
                dueBefore: before,
              }));
            }
            setIssuesDateRangeModal(null);
          }}
        />
      )}
      {section === 'cycles' && (
        <>
          <DateRangeModal
            open={cyclesDateRangeModal !== null}
            onClose={() => setCyclesDateRangeModal(null)}
            title={cyclesDateRangeModal === 'start' ? 'Start date range' : 'Due date range'}
            after={cyclesDateRangeModal === 'start' ? cyclesStartAfter : cyclesDueAfter}
            before={cyclesDateRangeModal === 'start' ? cyclesStartBefore : cyclesDueBefore}
            onApply={(after, before) => {
              if (cyclesDateRangeModal === 'start') {
                setCyclesStartAfter(after);
                setCyclesStartBefore(before);
              } else {
                setCyclesDueAfter(after);
                setCyclesDueBefore(before);
              }
              setCyclesDateRangeModal(null);
            }}
          />
          <CreateCycleModal
            open={createCycleOpen}
            onClose={() => setCreateCycleOpen(false)}
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            onCreated={(_created, targetProjectId) => {
              setCreateCycleOpen(false);
              if (targetProjectId !== projectId) {
                navigate(`/${workspaceSlug}/projects/${targetProjectId}/cycles`);
              }
              window.dispatchEvent(
                new CustomEvent(PROJECT_CYCLES_REFRESH_EVENT, {
                  detail: { workspaceSlug, projectId: targetProjectId },
                }),
              );
            }}
          />
        </>
      )}
    </>
  );
}

/** Default workspace view options: all-issues, assigned, created, subscribed. */
const DEFAULT_WORKSPACE_VIEWS = [
  { id: 'all-issues', name: 'All work items' },
  { id: 'assigned', name: 'Assigned' },
  { id: 'created', name: 'Created' },
  { id: 'subscribed', name: 'Subscribed' },
] as const;

const LONG_LIST_PANEL_STYLE = { maxHeight: 'min(70vh, 28rem)' };

function WorkspaceViewsHeader() {
  const { workspaceSlug, viewId: urlViewId } = useParams<{
    workspaceSlug?: string;
    viewId?: string;
  }>();
  const navigate = useNavigate();
  const [viewDropdownOpen, setViewDropdownOpen] = useState<string | null>(null);
  const [filtersDropdownOpen, setFiltersDropdownOpen] = useState<string | null>(null);
  const [displayDropdownOpen, setDisplayDropdownOpen] = useState<string | null>(null);
  const [createViewModalOpen, setCreateViewModalOpen] = useState(false);
  const [viewSearch, setViewSearch] = useState('');
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
      queueMicrotask(() => setViewSearch(''));
    }
  }, [viewDropdownOpen]);

  const selectedViewId = urlViewId ?? 'all-issues';
  const allOptions = [
    ...DEFAULT_WORKSPACE_VIEWS,
    ...customViews.map((v) => ({ id: v.id, name: v.name })),
  ];
  const selectedView =
    DEFAULT_WORKSPACE_VIEWS.find((v) => v.id === selectedViewId) ??
    customViews.find((v) => v.id === selectedViewId) ??
    DEFAULT_WORKSPACE_VIEWS[0];
  const displayName = selectedView?.name ?? 'All work items';
  const q = (s: string) => s.trim().toLowerCase();
  const filteredViews = allOptions.filter((v) => q(v.name).includes(q(viewSearch)));

  const handleSelectView = (id: string) => {
    setViewDropdownOpen(null);
    if (!workspaceSlug) return;
    navigate(`/${workspaceSlug}/views/${id}`);
  };

  return (
    <>
      <div className="flex items-center gap-2 text-sm font-medium text-(--txt-secondary)">
        <Link
          to={workspaceSlug ? `/${workspaceSlug}/views/all-issues` : '/'}
          className="flex items-center gap-1.5 text-(--txt-secondary) hover:text-(--txt-primary)"
        >
          <span className="flex size-5 items-center justify-center text-(--txt-icon-tertiary)">
            <IconProjectViews />
          </span>
          <span>Views</span>
        </Link>
        <span className="text-(--txt-icon-tertiary)" aria-hidden>
          &gt;
        </span>
        <Dropdown
          id="workspace-view-select"
          openId={viewDropdownOpen}
          onOpen={setViewDropdownOpen}
          label="All work items"
          icon={<IconProjectViews />}
          displayValue={displayName}
          panelClassName="flex min-w-[220px] max-h-[min(70vh,28rem)] flex-col rounded-md border border-(--border-subtle) bg-(--bg-surface-1) shadow-(--shadow-raised) overflow-hidden"
          align="left"
        >
          <div className="sticky top-0 shrink-0 border-b border-(--border-subtle) bg-(--bg-surface-1) p-2">
            <div className="flex items-center gap-2 rounded border border-(--border-subtle) bg-(--bg-layer-1) px-2 py-1.5">
              <span className="shrink-0 text-(--txt-icon-tertiary)">
                <IconSearch />
              </span>
              <input
                type="text"
                placeholder="Search"
                value={viewSearch}
                onChange={(e) => setViewSearch(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto py-1" style={LONG_LIST_PANEL_STYLE}>
            {filteredViews.map((view) => (
              <button
                key={view.id}
                type="button"
                onClick={() => handleSelectView(view.id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-2-hover)"
              >
                <span className="shrink-0 text-(--txt-icon-tertiary)">
                  <IconLayers />
                </span>
                <span className="min-w-0 flex-1 truncate">{view.name}</span>
                {selectedViewId === view.id && (
                  <span className="shrink-0 text-(--txt-primary)">
                    <IconCheck />
                  </span>
                )}
              </button>
            ))}
          </div>
        </Dropdown>
      </div>
      <div className="flex items-center gap-1">
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
          onCreated={() => {
            setCreateViewModalOpen(false);
            if (workspaceSlug) {
              viewService
                .list(workspaceSlug)
                .then((list) => setCustomViews(list ?? []))
                .catch(() => {});
            }
          }}
        />
        <WorkspaceViewsEllipsisMenu />
      </div>
    </>
  );
}

function AnalyticsHeader({ workspaceSlug }: { workspaceSlug: string }) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [projectSearch, setProjectSearch] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
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
  const filteredProjects = projects.filter((p) => q(p.name).includes(q(projectSearch)));

  useEffect(() => {
    if (!openDropdown) {
      // Intentional: clear search when dropdown closes (kept for future use)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProjectSearch('');
    }
  }, [openDropdown]);

  return (
    <>
      <div className="flex items-center gap-2 text-sm font-medium text-(--txt-secondary)">
        <span className="flex size-5 items-center justify-center text-(--txt-icon-tertiary)">
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
          displayValue={selectedProject?.name ?? 'All projects'}
          panelClassName="flex min-w-[200px] max-h-52 flex-col rounded border border-(--border-subtle) bg-(--bg-surface-1) shadow-(--shadow-raised)"
          align="right"
        >
          <div className="sticky top-0 border-b border-(--border-subtle) bg-(--bg-surface-1) p-1.5">
            <input
              type="text"
              placeholder="Search..."
              value={projectSearch}
              onChange={(e) => setProjectSearch(e.target.value)}
              className="w-full rounded border border-(--border-subtle) bg-(--bg-surface-1) px-2 py-1 text-xs placeholder:text-(--txt-placeholder) focus:outline-none focus:border-(--border-strong)"
            />
          </div>
          <div className="overflow-auto py-0.5 [&_button]:px-2 [&_button]:py-1 [&_button]:text-xs">
            <button
              type="button"
              onClick={() => {
                setSelectedProjectId(null);
                setOpenDropdown(null);
              }}
              className="w-full text-left text-(--txt-primary) hover:bg-(--bg-layer-2-hover)"
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
                className="w-full text-left text-(--txt-primary) hover:bg-(--bg-layer-2-hover)"
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
// Project saved view detail: work items + issues toolbar + breadcrumb
// ---------------------------------------------------------------------------

function ProjectSavedViewDetailHeader({
  workspaceSlug,
  projectId,
  project,
  projectName,
  viewId,
  issueCount: _issueCount,
}: {
  workspaceSlug: string;
  projectId: string;
  project: ProjectApiResponse;
  projectName: string;
  viewId: string;
  issueCount: number;
}) {
  void _issueCount;
  const navigate = useNavigate();
  const { filters: workspaceViewFilters } = useWorkspaceViewsState();
  const baseUrl = `/${workspaceSlug}/projects/${projectId}`;
  const issuesUrl = `${baseUrl}/issues`;
  const [viewTitle, setViewTitle] = useState<string>('…');
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);
  const [filtersDropdownOpen, setFiltersDropdownOpen] = useState<string | null>(null);
  const projectDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const v = await viewService.get(workspaceSlug, viewId);
        if (!cancelled) setViewTitle(v?.name?.trim() ? v.name : 'View');
      } catch {
        if (!cancelled) setViewTitle('View');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, viewId]);

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

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(e.target as Node)) {
        setProjectDropdownOpen(false);
      }
    };
    if (projectDropdownOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [projectDropdownOpen]);

  const handleSelectProject = (targetProjectId: string) => {
    setProjectDropdownOpen(false);
    if (targetProjectId === projectId) return;
    const targetBase = `/${workspaceSlug}/projects/${targetProjectId}`;
    navigate(`${targetBase}/views`);
  };

  const q = (s: string) => s.trim().toLowerCase();
  const filteredProjects = projects.filter((p) => q(p.name).includes(q(projectSearch)));

  const startDateEffective =
    workspaceViewFilters.startDate.length &&
    !(
      workspaceViewFilters.startDate.includes('custom') &&
      (!workspaceViewFilters.startAfter || !workspaceViewFilters.startBefore)
    );
  const dueDateEffective =
    workspaceViewFilters.dueDate.length &&
    !(
      workspaceViewFilters.dueDate.includes('custom') &&
      (!workspaceViewFilters.dueAfter || !workspaceViewFilters.dueBefore)
    );
  const activeFilters =
    workspaceViewFilters.priority.length > 0 ||
    workspaceViewFilters.stateGroup.length > 0 ||
    workspaceViewFilters.assigneeIds.length > 0 ||
    workspaceViewFilters.createdByIds.length > 0 ||
    workspaceViewFilters.labelIds.length > 0 ||
    workspaceViewFilters.projectIds.length > 0 ||
    workspaceViewFilters.grouping !== 'all' ||
    Boolean(startDateEffective) ||
    Boolean(dueDateEffective);

  return (
    <>
      <div
        className="relative flex min-w-0 flex-1 flex-wrap items-center gap-1 text-sm"
        ref={projectDropdownRef}
      >
        <Link
          to={issuesUrl}
          className="flex max-w-[40vw] items-center gap-1.5 truncate rounded-md px-3 py-1.5 font-medium text-(--txt-secondary) no-underline hover:bg-(--bg-layer-transparent-hover) hover:text-(--txt-primary)"
        >
          <span className="flex size-5 shrink-0 items-center justify-center">
            <ProjectIconDisplay
              emoji={project.emoji}
              icon_prop={project.icon_prop}
              size={16}
              className="leading-none"
            />
          </span>
          {projectName}
        </Link>
        <button
          type="button"
          onClick={() => setProjectDropdownOpen((o) => !o)}
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-(--txt-icon-tertiary) hover:bg-(--bg-layer-transparent-hover) hover:text-(--txt-icon-secondary)"
          aria-label="Select project"
        >
          <IconChevronDown />
        </button>
        {projectDropdownOpen && (
          <div className="absolute left-0 top-full z-20 mt-1.5 w-64 rounded-md border border-(--border-subtle) bg-(--bg-surface-1) p-1.5 shadow-(--shadow-raised)">
            <div className="mb-1.5 flex items-center gap-2 rounded border border-(--border-subtle) bg-(--bg-layer-1) px-2 py-1.5">
              <span className="shrink-0 text-(--txt-icon-tertiary)">
                <IconSearch />
              </span>
              <input
                type="text"
                placeholder="Search"
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none"
              />
            </div>
            <div className="max-h-64 overflow-y-auto py-0.5">
              {filteredProjects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectProject(p.id)}
                  className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm text-(--txt-primary) hover:bg-(--bg-layer-2-hover)"
                >
                  <span className="truncate">{p.name}</span>
                  {p.id === projectId && (
                    <span className="shrink-0 text-(--txt-primary)">
                      <IconCheck />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
        <span className="shrink-0 px-0.5 text-(--txt-icon-tertiary)" aria-hidden>
          &gt;
        </span>
        <Link
          to={`${baseUrl}/views`}
          className="flex max-w-[28vw] shrink-0 items-center gap-1.5 truncate rounded-md px-2.5 py-1.5 font-medium text-(--txt-secondary) no-underline hover:bg-(--bg-layer-transparent-hover) hover:text-(--txt-primary)"
        >
          <span className="flex size-5 shrink-0 items-center justify-center text-(--txt-icon-secondary)">
            <IconProjectViews />
          </span>
          Views
        </Link>
        <span className="shrink-0 px-0.5 text-(--txt-icon-tertiary)" aria-hidden>
          &gt;
        </span>
        <div className="flex min-w-0 max-w-[36vw] items-center gap-1.5 truncate rounded-md px-2.5 py-1.5 font-medium text-(--txt-primary)">
          <span className="flex size-5 shrink-0 items-center justify-center text-(--txt-icon-secondary)">
            <IconProjectViews />
          </span>
          <span className="truncate">{viewTitle}</span>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1">
        <div className="flex h-8 overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-layer-1) p-0.5">
          <button
            type="button"
            title="List view"
            aria-pressed
            className="flex size-7 items-center justify-center rounded-md bg-(--bg-layer-2) text-(--txt-primary) shadow-sm"
          >
            <IconList />
          </button>
          <Link
            to={`${baseUrl}/board`}
            title="Board"
            aria-label="Board"
            className="flex size-7 items-center justify-center rounded-md text-(--txt-icon-tertiary) hover:bg-(--bg-layer-2-hover) hover:text-(--txt-secondary)"
          >
            <IconColumns />
          </Link>
          <button
            type="button"
            title="Calendar (coming soon)"
            disabled
            className="flex size-7 cursor-not-allowed items-center justify-center rounded-md opacity-40"
          >
            <IconCalendar />
          </button>
          <button
            type="button"
            title="Spreadsheet (coming soon)"
            disabled
            className="flex size-7 cursor-not-allowed items-center justify-center rounded-md opacity-40"
          >
            <IconSpreadsheet />
          </button>
          <button
            type="button"
            title="Timeline (coming soon)"
            disabled
            className="flex size-7 cursor-not-allowed items-center justify-center rounded-md opacity-40"
          >
            <IconGantt />
          </button>
        </div>
        <div className="mx-1 w-px self-stretch bg-(--border-subtle)" />
        <div className="relative shrink-0">
          <WorkspaceViewsFiltersDropdown
            openId={filtersDropdownOpen}
            onOpen={setFiltersDropdownOpen}
          />
          {activeFilters && (
            <span
              className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-(--brand-default)"
              aria-hidden
            />
          )}
        </div>
        <ProjectSavedViewDisplayDropdown />
        <Link to={`${baseUrl}/views/${viewId}?create=1`}>
          <Button size="sm" className="gap-1.5 text-[13px] font-medium">
            <IconPlus /> Add work item
          </Button>
        </Link>
        <ProjectSavedViewMoreMenu
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          viewId={viewId}
        />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// PageHeader
// ---------------------------------------------------------------------------

export function PageHeader() {
  const location = useLocation();
  const { workspaceSlug, projectId, moduleId, viewId } = useParams<{
    workspaceSlug?: string;
    projectId?: string;
    moduleId?: string;
    viewId?: string;
  }>();
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);
  void workspace;
  void projects; // reserved for future use (e.g. breadcrumb, project list)
  const [project, setProject] = useState<ProjectApiResponse | null>(null);
  const [projectIssueCount, setProjectIssueCount] = useState(0);
  const [module, setModule] = useState<ModuleApiResponse | null>(null);
  const [moduleWorkItemCount, setModuleWorkItemCount] = useState<number | null>(null);

  useEffect(() => {
    const onCount = (e: Event) => {
      const d = (e as CustomEvent<{ count: number }>).detail;
      if (d && typeof d.count === 'number') setModuleWorkItemCount(d.count);
    };
    window.addEventListener(MODULE_WORK_ITEMS_COUNT_EVENT, onCount);
    return () => window.removeEventListener(MODULE_WORK_ITEMS_COUNT_EVENT, onCount);
  }, []);

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
        return p ? issueService.list(workspaceSlug, projectId, { limit: 1000 }) : [];
      })
      .then((issues) => {
        if (!cancelled && Array.isArray(issues)) setProjectIssueCount(issues.length);
      })
      .catch(() => {
        if (!cancelled) setProject(null);
        setProjectIssueCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId]);

  useEffect(() => {
    if (!workspaceSlug || !projectId || !moduleId) {
      queueMicrotask(() => setModule(null));
      return;
    }
    let cancelled = false;
    const key = moduleId.trim().toLowerCase();
    moduleService
      .list(workspaceSlug, projectId)
      .then((mods) => {
        if (cancelled) return;
        const found =
          (mods ?? []).find((x) => x.id === moduleId) ??
          (mods ?? []).find((x) => slugify(x.name) === key) ??
          null;
        setModule(found);
      })
      .catch(() => {
        if (!cancelled) setModule(null);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId, moduleId]);

  const pathname = location.pathname;

  useEffect(() => {
    const base = workspaceSlug && projectId ? `/${workspaceSlug}/projects/${projectId}` : '';
    const norm = pathname.replace(/\/+$/, '') || pathname;
    const onModuleDetail = Boolean(base && moduleId && norm === `${base}/modules/${moduleId}`);
    if (!onModuleDetail) queueMicrotask(() => setModuleWorkItemCount(null));
  }, [pathname, workspaceSlug, projectId, moduleId]);

  // Match route patterns to pick header
  const isWorkspaceHome = workspaceSlug && pathname === `/${workspaceSlug}`;
  const isSettings =
    workspaceSlug &&
    (pathname === `/${workspaceSlug}/settings` ||
      pathname.startsWith(`/${workspaceSlug}/settings/`));
  const isProjectsList = workspaceSlug && pathname === `/${workspaceSlug}/projects`;
  const projectBase = workspaceSlug && projectId ? `/${workspaceSlug}/projects/${projectId}` : '';
  const pathNoTrailingSlash = pathname.replace(/\/+$/, '') || pathname;
  const isIssuesPage = projectBase && pathname === `${projectBase}/issues`;
  const isCyclesPage = projectBase && pathname === `${projectBase}/cycles`;
  const isModulesPage = projectBase && pathname === `${projectBase}/modules`;
  const isModuleDetailPage =
    projectBase && moduleId && pathNoTrailingSlash === `${projectBase}/modules/${moduleId}`;
  const isViewsListPage = projectBase && pathNoTrailingSlash === `${projectBase}/views`;
  const isProjectSavedViewDetailPage =
    projectBase && !!viewId && pathNoTrailingSlash === `${projectBase}/views/${viewId}`;
  const isPagesPage = projectBase && pathname === `${projectBase}/pages`;
  const isProjectSection =
    isIssuesPage || isCyclesPage || isModulesPage || isViewsListPage || isPagesPage;
  const isProjectDetail =
    workspaceSlug && projectId && pathname.startsWith(`/${workspaceSlug}/projects/${projectId}`);
  const isInbox = workspaceSlug && pathname === `/${workspaceSlug}/notifications`;
  const isProfilePage = workspaceSlug && /^\/[^/]+\/profile\/[^/]+$/.test(pathname);
  const isAnalyticsPage =
    workspaceSlug &&
    (pathname === `/${workspaceSlug}/analytics` ||
      pathname.startsWith(`/${workspaceSlug}/analytics/`));
  const isWorkspaceViewsPage =
    workspaceSlug &&
    (pathname === `/${workspaceSlug}/views` || pathname.startsWith(`/${workspaceSlug}/views/`));
  const isDraftsPage = workspaceSlug && pathname === `/${workspaceSlug}/drafts`;

  const projectSection: ProjectSection | null = isIssuesPage
    ? 'issues'
    : isCyclesPage
      ? 'cycles'
      : isModulesPage
        ? 'modules'
        : isViewsListPage
          ? 'views'
          : isPagesPage
            ? 'pages'
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
  } else if (isDraftsPage) {
    content = <DraftsHeader />;
  } else if (isModuleDetailPage && workspaceSlug && projectId && project && module && moduleId) {
    content = (
      <ModuleDetailHeader
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        project={project}
        projectName={project.name}
        moduleId={module.id}
        moduleName={module.name}
        moduleRouteParam={moduleId}
        issueCountBadge={moduleWorkItemCount ?? module.issue_count ?? 0}
      />
    );
  } else if (isProjectSavedViewDetailPage && workspaceSlug && projectId && viewId && project) {
    content = (
      <ProjectSavedViewDetailHeader
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        project={project}
        projectName={project.name}
        viewId={viewId}
        issueCount={projectIssueCount}
      />
    );
  } else if (isProjectSection && workspaceSlug && projectId && project && projectSection) {
    content = (
      <ProjectSectionHeader
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        project={project}
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
        project={project}
        title={project.name}
      />
    );
  } else if (workspaceSlug && projectId && project) {
    content = (
      <ProjectDetailHeader
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        project={project}
        title={project.name}
      />
    );
  } else if (workspaceSlug) {
    content = <HomeHeader />;
  }

  if (content == null) return null;

  return (
    <header
      className="flex min-h-13 shrink-0 items-center justify-between border-b border-(--border-subtle) bg-(--bg-canvas) px-(--padding-page) py-3"
      role="banner"
    >
      {content}
    </header>
  );
}
