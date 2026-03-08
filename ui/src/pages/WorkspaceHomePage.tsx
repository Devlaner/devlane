import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Card, CardContent, Button, Modal, Input } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { workspaceService } from "../services/workspaceService";
import { projectService } from "../services/projectService";
import { quickLinksService } from "../services/quickLinksService";
import { stickiesService } from "../services/stickiesService";
import { recentsService } from "../services/recentsService";
import type {
  WorkspaceApiResponse,
  ProjectApiResponse,
  QuickLinkApiResponse,
  StickyApiResponse,
  RecentVisitApiResponse,
} from "../api/types";

// ---------------------------------------------------------------------------
// Icons (Devlane-style)
// ---------------------------------------------------------------------------

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
const IconMoon = () => (
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
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </svg>
);
const IconTarget = () => (
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
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
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
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="M10 9H8" />
    <path d="M16 13H8" />
    <path d="M16 17H8" />
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
const IconClipboard = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
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
const IconPalette = () => (
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
    <circle cx="13.5" cy="6.5" r=".5" />
    <circle cx="17.5" cy="10.5" r=".5" />
    <circle cx="8.5" cy="7.5" r=".5" />
    <circle cx="6.5" cy="12.5" r=".5" />
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.75-.2 2.5-.5" />
  </svg>
);
const IconBold = () => (
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
    <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
    <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
  </svg>
);
const IconItalic = () => (
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
    <line x1="19" y1="4" x2="10" y2="4" />
    <line x1="14" y1="20" x2="5" y2="20" />
    <line x1="15" y1="4" x2="9" y2="20" />
  </svg>
);
const IconList = () => (
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
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);
const IconTrash = () => (
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
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatDateTime(date: Date): string {
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const d = date.getDate();
  const h = date.getHours();
  const m = date.getMinutes();
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${d} ${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60)
    return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  if (diffHours < 24)
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays === 1) return "1 day ago";
  return `${diffDays} days ago`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function WorkspaceHomePage() {
  const { user } = useAuth();
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);
  const [quicklinks, setQuicklinks] = useState<QuickLinkApiResponse[]>([]);
  const [stickies, setStickies] = useState<StickyApiResponse[]>([]);
  const [recents, setRecents] = useState<RecentVisitApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [addQuicklinkOpen, setAddQuicklinkOpen] = useState(false);
  const [addStickyOpen, setAddStickyOpen] = useState(false);
  const [quicklinkUrl, setQuicklinkUrl] = useState("");
  const [quicklinkTitle, setQuicklinkTitle] = useState("");
  const [stickyContent, setStickyContent] = useState("");
  const [quicklinkSubmitting, setQuicklinkSubmitting] = useState(false);
  const [stickySubmitting, setStickySubmitting] = useState(false);
  const [recentsFilterOpen, setRecentsFilterOpen] = useState(false);
  const [recentsFilterValue, setRecentsFilterValue] = useState<
    "All" | "Work Items" | "Pages" | "Projects"
  >("All");
  const [stickySearchOpen, setStickySearchOpen] = useState(false);
  const [stickySearchQuery, setStickySearchQuery] = useState("");
  const recentsFilterTriggerRef = useRef<HTMLButtonElement>(null);
  const recentsFilterDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!workspaceSlug) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      workspaceService.getBySlug(workspaceSlug),
      projectService.list(workspaceSlug),
      quickLinksService.list(workspaceSlug),
      stickiesService.list(workspaceSlug),
      recentsService.list(workspaceSlug),
    ])
      .then(([w, projectList, linkList, stickyList, recentList]) => {
        if (cancelled) return;
        setWorkspace(w);
        setProjects(projectList ?? []);
        setQuicklinks(linkList ?? []);
        setStickies(stickyList ?? []);
        setRecents(recentList ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setWorkspace(null);
          setProjects([]);
          setQuicklinks([]);
          setStickies([]);
          setRecents([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug]);

  const refetchQuicklinks = () => {
    if (workspaceSlug) {
      quickLinksService
        .list(workspaceSlug)
        .then(setQuicklinks)
        .catch(() => {});
    }
  };
  const refetchStickies = () => {
    if (workspaceSlug) {
      stickiesService
        .list(workspaceSlug)
        .then(setStickies)
        .catch(() => {});
    }
  };
  const refetchRecents = () => {
    if (workspaceSlug) {
      recentsService
        .list(workspaceSlug)
        .then(setRecents)
        .catch(() => {});
    }
  };

  const handleCloseQuicklink = () => {
    setAddQuicklinkOpen(false);
    setQuicklinkUrl("");
    setQuicklinkTitle("");
  };
  const handleAddQuicklink = async () => {
    if (!workspaceSlug || !quicklinkUrl.trim()) return;
    setQuicklinkSubmitting(true);
    try {
      await quickLinksService.create(workspaceSlug, {
        url: quicklinkUrl.trim(),
        title: quicklinkTitle.trim() || undefined,
      });
      refetchQuicklinks();
      handleCloseQuicklink();
    } finally {
      setQuicklinkSubmitting(false);
    }
  };
  const handleDeleteQuicklink = async (id: string) => {
    if (!workspaceSlug) return;
    try {
      await quickLinksService.delete(workspaceSlug, id);
      refetchQuicklinks();
    } catch {
      // already handled by interceptor
    }
  };
  const handleCloseSticky = () => {
    setAddStickyOpen(false);
    setStickyContent("");
  };
  const handleAddSticky = async () => {
    if (!workspaceSlug) return;
    setStickySubmitting(true);
    try {
      await stickiesService.create(workspaceSlug, {
        name: stickyContent.trim().slice(0, 255) || "Untitled",
        description: stickyContent.trim() || "",
      });
      refetchStickies();
      handleCloseSticky();
    } finally {
      setStickySubmitting(false);
    }
  };
  const handleDeleteSticky = async (id: string) => {
    if (!workspaceSlug) return;
    try {
      await stickiesService.delete(workspaceSlug, id);
      refetchStickies();
    } catch {
      // already handled by interceptor
    }
  };

  useEffect(() => {
    if (!recentsFilterOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        recentsFilterTriggerRef.current?.contains(target) ||
        recentsFilterDropdownRef.current?.contains(target)
      )
        return;
      setRecentsFilterOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [recentsFilterOpen]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-[var(--txt-tertiary)]">
        Loading…
      </div>
    );
  }
  if (!workspace) {
    return (
      <div className="text-[var(--txt-secondary)]">Workspace not found.</div>
    );
  }

  const baseUrl = `/${workspace.slug}`;
  const recentsFilterOptions = [
    "All",
    "Work Items",
    "Pages",
    "Projects",
  ] as const;
  const filteredRecents =
    recentsFilterValue === "All"
      ? recents
      : recentsFilterValue === "Work Items"
        ? recents.filter((r) => r.entity_name === "issue")
        : recentsFilterValue === "Pages"
          ? recents.filter((r) => r.entity_name === "page")
          : recents.filter((r) => r.entity_name === "project");

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-8">
      {/* Welcome */}
      <section className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--txt-primary)]">
          {getGreeting()}, {user?.name ?? "User"}
        </h1>
        <p className="mt-1 flex items-center justify-center gap-2 text-sm text-[var(--txt-tertiary)]">
          <span className="text-[var(--txt-icon-tertiary)]">
            <IconMoon />
          </span>
          {formatDateTime(new Date())}
        </p>
      </section>

      {/* Quicklinks */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--txt-primary)]">
            Quicklinks
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-[13px] font-medium text-[var(--txt-accent-primary)]"
            onClick={() => setAddQuicklinkOpen(true)}
          >
            <IconPlus />
            Add quick Link
          </Button>
        </div>
        <Modal
          open={addQuicklinkOpen}
          onClose={handleCloseQuicklink}
          title="Add Quicklink"
          footer={
            <>
              <Button variant="secondary" onClick={handleCloseQuicklink}>
                Cancel
              </Button>
              <Button
                onClick={handleAddQuicklink}
                disabled={!quicklinkUrl.trim() || quicklinkSubmitting}
              >
                {quicklinkSubmitting ? "Adding…" : "Add Quicklink"}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--txt-secondary)]">
                URL <span className="text-[var(--txt-tertiary)]">Required</span>
              </label>
              <Input
                value={quicklinkUrl}
                onChange={(e) => setQuicklinkUrl(e.target.value)}
                placeholder="Type or paste a URL"
                className="mt-1"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--txt-secondary)]">
                Display title{" "}
                <span className="text-[var(--txt-tertiary)]">Optional</span>
              </label>
              <Input
                value={quicklinkTitle}
                onChange={(e) => setQuicklinkTitle(e.target.value)}
                placeholder="What you'd like to see this link as"
                className="mt-1"
              />
            </div>
          </div>
        </Modal>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quicklinks.map((ql) => {
            const label = ql.title?.trim() || ql.url;
            const isInternal = !!ql.project_id;
            const href = ql.project_id
              ? `${baseUrl}/projects/${ql.project_id}`
              : ql.url;
            const content = (
              <Card
                variant="outlined"
                className="transition-colors hover:bg-[var(--bg-layer-transparent-hover)]"
              >
                <CardContent className="flex items-center gap-3 p-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--bg-layer-1)] text-[var(--txt-icon-tertiary)]">
                    <IconTarget />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-[var(--txt-primary)]">
                      {label}
                    </p>
                    <p className="text-xs text-[var(--txt-tertiary)]">
                      {formatRelativeTime(ql.updated_at)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
            return isInternal ? (
              <Link key={ql.id} to={href} className="block no-underline">
                {content}
              </Link>
            ) : (
              <a
                key={ql.id}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="block no-underline"
              >
                {content}
              </a>
            );
          })}
        </div>
        {quicklinks.length === 0 && (
          <Card variant="outlined">
            <CardContent className="flex items-center gap-3 p-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--bg-layer-1)] text-[var(--txt-icon-tertiary)]">
                <IconTarget />
              </div>
              <p className="text-sm text-[var(--txt-tertiary)]">
                No quicklinks yet. Add one to jump back to a project.
              </p>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Recents */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--txt-primary)]">
            Recents
          </h2>
          <div className="relative">
            <button
              ref={recentsFilterTriggerRef}
              type="button"
              onClick={() => setRecentsFilterOpen((o) => !o)}
              className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-layer-2)] px-2.5 py-1.5 text-[13px] font-medium text-[var(--txt-primary)] hover:bg-[var(--bg-layer-2-hover)]"
              aria-expanded={recentsFilterOpen}
              aria-haspopup="listbox"
              aria-label="Filter recents"
            >
              {recentsFilterValue}
              <IconChevronDown />
            </button>
            {recentsFilterOpen && (
              <div
                ref={recentsFilterDropdownRef}
                className="absolute right-0 top-full z-10 mt-1 min-w-[10rem] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] py-1 shadow-[var(--shadow-overlay)]"
                role="listbox"
              >
                {recentsFilterOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="option"
                    aria-selected={recentsFilterValue === option}
                    onClick={() => {
                      setRecentsFilterValue(option);
                      setRecentsFilterOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-[13px] font-medium text-[var(--txt-primary)] hover:bg-[var(--bg-layer-transparent-hover)]"
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <Card variant="outlined">
          <CardContent className="divide-y divide-[var(--border-subtle)] p-0">
            {filteredRecents.map((r) => {
              const recentsLink =
                r.entity_name === "issue" && r.project_id && r.entity_identifier
                  ? `${baseUrl}/projects/${r.project_id}/issues/${r.entity_identifier}`
                  : r.entity_name === "project" && r.entity_identifier
                    ? `${baseUrl}/projects/${r.entity_identifier}`
                    : r.entity_name === "page" && r.entity_identifier
                      ? `${baseUrl}/pages/${r.entity_identifier}`
                      : null;
              const idLabel =
                r.display_identifier || r.entity_identifier || r.id;
              const titleLabel = r.display_title || r.entity_name;
              const inner = (
                <>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--bg-layer-1)] text-[var(--txt-icon-tertiary)]">
                    <IconFileText />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-baseline gap-2 text-[13px]">
                      <span className="font-medium text-[var(--txt-primary)]">
                        {idLabel}
                      </span>
                      <span className="truncate text-[var(--txt-secondary)]">
                        {titleLabel}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--txt-tertiary)]">
                      {formatRelativeTime(r.last_visited_at)}
                    </p>
                  </div>
                </>
              );
              return recentsLink ? (
                <Link
                  key={r.id}
                  to={recentsLink}
                  className="flex items-center gap-3 px-4 py-3 no-underline transition-colors hover:bg-[var(--bg-layer-transparent-hover)]"
                >
                  {inner}
                </Link>
              ) : (
                <div
                  key={r.id}
                  className="flex items-center gap-3 px-4 py-3 text-[var(--txt-secondary)]"
                >
                  {inner}
                </div>
              );
            })}
            {filteredRecents.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-[var(--txt-tertiary)]">
                No recent activity.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Your stickies */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-[var(--txt-primary)]">
            Your stickies
          </h2>
          <div className="flex flex-1 items-center justify-end gap-1 min-w-0">
            <div
              className={`overflow-hidden transition-[width] duration-200 ease-out ${stickySearchOpen ? "w-56" : "w-0"}`}
            >
              <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] px-2 py-1.5">
                <span className="shrink-0 text-[var(--txt-icon-tertiary)]">
                  <IconSearch />
                </span>
                <input
                  type="text"
                  value={stickySearchQuery}
                  onChange={(e) => setStickySearchQuery(e.target.value)}
                  placeholder="Search by title"
                  className="min-w-0 flex-1 bg-transparent text-sm text-[var(--txt-primary)] placeholder:text-[var(--txt-placeholder)] focus:outline-none"
                  aria-label="Search stickies by title"
                />
                <button
                  type="button"
                  onClick={() => {
                    setStickySearchQuery("");
                    setStickySearchOpen(false);
                  }}
                  className="shrink-0 rounded p-0.5 text-[var(--txt-icon-tertiary)] hover:bg-[var(--bg-layer-transparent-hover)] hover:text-[var(--txt-secondary)]"
                  aria-label="Clear search"
                >
                  <IconX />
                </button>
              </div>
            </div>
            {!stickySearchOpen && (
              <button
                type="button"
                onClick={() => setStickySearchOpen(true)}
                className="flex size-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--txt-icon-tertiary)] hover:bg-[var(--bg-layer-transparent-hover)]"
                aria-label="Search stickies"
              >
                <IconSearch />
              </button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-[13px] font-medium text-[var(--txt-accent-primary)]"
              onClick={() => setAddStickyOpen(true)}
            >
              <IconPlus />
              Add sticky
            </Button>
          </div>
        </div>
        <Modal
          open={addStickyOpen}
          onClose={handleCloseSticky}
          title="Add sticky"
          footer={
            <>
              <Button variant="secondary" onClick={handleCloseSticky}>
                Cancel
              </Button>
              <Button onClick={handleAddSticky} disabled={stickySubmitting}>
                {stickySubmitting ? "Adding…" : "Add sticky"}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--txt-secondary)]">
                Content{" "}
                <span className="text-[var(--txt-tertiary)]">Optional</span>
              </label>
              <textarea
                value={stickyContent}
                onChange={(e) => setStickyContent(e.target.value)}
                placeholder="Jot down an idea, capture an aha..."
                rows={4}
                className="w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] px-3 py-2 text-sm text-[var(--txt-primary)] placeholder:text-[var(--txt-placeholder)] focus:outline-none focus:border-[var(--border-strong)]"
              />
            </div>
          </div>
        </Modal>
        {(() => {
          const filteredStickies = stickies.filter((s) =>
            s.name
              .toLowerCase()
              .includes(stickySearchQuery.toLowerCase().trim()),
          );
          if (filteredStickies.length === 0) {
            return (
              <Card variant="outlined" className="border-dashed">
                <CardContent className="flex min-h-[180px] flex-col items-center justify-center gap-3 py-10">
                  <span className="text-[var(--txt-icon-tertiary)]">
                    <IconClipboard />
                  </span>
                  <p className="max-w-sm text-center text-sm italic text-[var(--txt-placeholder)]">
                    {stickySearchQuery.trim()
                      ? "No stickies match your search."
                      : "Jot down an idea, capture an aha, or record a brainwave. Add a sticky to get started."}
                  </p>
                </CardContent>
              </Card>
            );
          }
          return (
            <div className="grid grid-cols-3 gap-4">
              {filteredStickies.map((sticky) => {
                const isDefaultDark =
                  !sticky.color ||
                  sticky.color === "#0d0d0d" ||
                  sticky.color.toLowerCase() === "#0d0d0d";
                return (
                  <div
                    key={sticky.id}
                    className={`flex min-h-[120px] flex-col rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-3 shadow-sm ${isDefaultDark ? "bg-[var(--bg-layer-2)]" : ""}`}
                    style={
                      isDefaultDark
                        ? undefined
                        : { backgroundColor: sticky.color }
                    }
                  >
                    <div className="min-h-0 flex-1 text-sm text-[var(--txt-primary)]">
                      <p className="whitespace-pre-wrap break-words">
                        {sticky.name}
                      </p>
                      {sticky.description && (
                        <p className="mt-1 whitespace-pre-wrap break-words text-[var(--txt-secondary)]">
                          {sticky.description}
                        </p>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-1 border-t border-[var(--border-subtle)] pt-2">
                      <button
                        type="button"
                        className="rounded p-1 text-[var(--txt-icon-tertiary)] hover:bg-[var(--bg-layer-transparent-hover)]"
                        aria-label="Change color"
                      >
                        <IconPalette />
                      </button>
                      <button
                        type="button"
                        className="rounded p-1 text-[var(--txt-icon-tertiary)] hover:bg-[var(--bg-layer-transparent-hover)]"
                        aria-label="Bold"
                      >
                        <IconBold />
                      </button>
                      <button
                        type="button"
                        className="rounded p-1 text-[var(--txt-icon-tertiary)] hover:bg-[var(--bg-layer-transparent-hover)]"
                        aria-label="Italic"
                      >
                        <IconItalic />
                      </button>
                      <button
                        type="button"
                        className="rounded p-1 text-[var(--txt-icon-tertiary)] hover:bg-[var(--bg-layer-transparent-hover)]"
                        aria-label="List"
                      >
                        <IconList />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSticky(sticky.id)}
                        className="ml-auto rounded p-1 text-[var(--txt-icon-tertiary)] hover:bg-[var(--bg-layer-transparent-hover)] hover:text-[var(--txt-danger-primary)]"
                        aria-label="Delete"
                      >
                        <IconTrash />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </section>
    </div>
  );
}
