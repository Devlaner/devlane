import { Switch } from '@headlessui/react';
import {
  Archive,
  BarChart3,
  Box,
  Boxes,
  CircleDot,
  CirclePlus,
  FileEdit,
  FileText,
  FolderKanban,
  HelpCircle,
  Home,
  Inbox,
  IterationCw,
  Layers,
  LayoutGrid,
  LogOut,
  Search,
  Settings,
  User,
} from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import type { ProjectApiResponse } from '../../api/types';
import { searchService, type SearchHit, type SearchResults } from '../../services/searchService';
import { cn } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';

const WORKSPACE_LEVEL_STORAGE_KEY = 'devlane-command-palette-workspace-level';

type CommandEntry = {
  id: string;
  category: string;
  label: string;
  /** Extra text used for filtering only */
  matchText?: string;
  shortcut?: string;
  icon: ReactNode;
  /** When true, hidden while “Workspace level” is on */
  projectScoped?: boolean;
  run: () => void;
};

export type GlobalCommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceSlug: string | undefined;
  baseUrl: string;
  projectId: string | undefined;
  projects: ProjectApiResponse[];
  onRequestCreateWorkItem: () => void;
};

function useIsMac() {
  return useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    if (/Mac|iPhone|iPad|iPod/i.test(navigator.userAgent)) return true;
    const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } })
      .userAgentData;
    const p = uaData?.platform;
    return !!p && /Mac|iPhone|iPad/i.test(p);
  }, []);
}

function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex min-h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded px-1 py-px font-sans text-[10px] font-medium text-(--txt-tertiary)',
        'border border-(--border-subtle) bg-(--bg-surface-1) shadow-[0_1px_0_0_color-mix(in_oklch,var(--neutral-black)_6%,transparent)]',
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export function GlobalCommandPalette({
  open,
  onOpenChange,
  workspaceSlug,
  baseUrl,
  projectId,
  projects,
  onRequestCreateWorkItem,
}: GlobalCommandPaletteProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const isMac = useIsMac();
  const titleId = useId();
  const listId = useId();
  const workspaceLevelLabelId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const [query, setQuery] = useState('');
  const [workspaceLevel, setWorkspaceLevel] = useState(() => {
    try {
      return sessionStorage.getItem(WORKSPACE_LEVEL_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [entered, setEntered] = useState(false);
  // Results are stored together with the query they belong to, so stale results
  // from a previous query are ignored during render (see entityEntries) without
  // needing a synchronous reset inside the search effect.
  const [searchState, setSearchState] = useState<{ q: string; results: SearchResults } | null>(
    null,
  );
  const [searching, setSearching] = useState(false);

  const persistWorkspaceLevel = useCallback((next: boolean) => {
    setWorkspaceLevel(next);
    try {
      sessionStorage.setItem(WORKSPACE_LEVEL_STORAGE_KEY, next ? '1' : '0');
    } catch {
      /* ignore quota / private mode */
    }
  }, []);

  const close = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const runAndClose = useCallback(
    (fn: () => void) => {
      fn();
      close();
      setQuery('');
    },
    [close],
  );

  const commands = useMemo((): CommandEntry[] => {
    if (!baseUrl) return [];

    const list: CommandEntry[] = [
      {
        id: 'create-issue',
        category: t('commandPalette.category.workItem', 'Work item'),
        label: t('commandPalette.createIssue', 'Create new work item'),
        matchText: t('commandPalette.createIssue.match', 'new issue task'),
        icon: <CirclePlus className="size-[15px] shrink-0" strokeWidth={2} />,
        run: () => runAndClose(onRequestCreateWorkItem),
      },
      {
        id: 'drafts',
        category: t('commandPalette.category.workItem', 'Work item'),
        label: t('commandPalette.drafts', 'Open drafts'),
        matchText: t('commandPalette.drafts.match', 'draft'),
        icon: <FileEdit className="size-[15px] shrink-0 opacity-90" strokeWidth={2} />,
        run: () => runAndClose(() => navigate(`${baseUrl}/drafts`)),
      },
      {
        id: 'views-all',
        category: t('commandPalette.category.workItem', 'Work item'),
        label: t('commandPalette.viewsAll', 'Open workspace views'),
        matchText: t('commandPalette.viewsAll.match', 'views all issues'),
        icon: <Layers className="size-[15px] shrink-0 opacity-90" strokeWidth={2} />,
        run: () => runAndClose(() => navigate(`${baseUrl}/views/all-issues`)),
      },
      {
        id: 'create-project',
        category: t('commandPalette.category.project', 'Project'),
        label: t('commandPalette.createProject', 'Go to projects'),
        matchText: t('commandPalette.createProject.match', 'create new project list'),
        icon: <FolderKanban className="size-[15px] shrink-0 opacity-90" strokeWidth={2} />,
        run: () => runAndClose(() => navigate(`${baseUrl}/projects`)),
      },
      {
        id: 'settings-workspace',
        category: t('commandPalette.category.workspaceSettings', 'Workspace Settings'),
        label: t('commandPalette.settingsWorkspace', 'Workspace settings'),
        matchText: t('commandPalette.settingsWorkspace.match', 'general members integrations'),
        icon: <Settings className="size-[15px] shrink-0 opacity-90" strokeWidth={2} />,
        run: () => runAndClose(() => navigate(`${baseUrl}/settings`)),
      },
      {
        id: 'settings-members',
        category: t('commandPalette.category.workspaceSettings', 'Workspace Settings'),
        label: t('commandPalette.settingsMembers', 'Members & invites'),
        matchText: t('commandPalette.settingsMembers.match', 'invite team'),
        icon: <User className="size-[15px] shrink-0 opacity-90" strokeWidth={2} />,
        run: () => runAndClose(() => navigate(`${baseUrl}/settings?section=members`)),
      },
      {
        id: 'account-settings',
        category: t('commandPalette.category.account', 'Account'),
        label: t('commandPalette.accountSettings', 'Account settings'),
        matchText: t('commandPalette.accountSettings.match', 'profile preferences notifications'),
        icon: <User className="size-[15px] shrink-0 opacity-90" strokeWidth={2} />,
        run: () => runAndClose(() => navigate('/settings')),
      },
      {
        id: 'sign-out',
        category: t('commandPalette.category.account', 'Account'),
        label: t('commandPalette.signOut', 'Sign out'),
        matchText: t('commandPalette.signOut.match', 'logout log out'),
        icon: <LogOut className="size-[15px] shrink-0 opacity-90" strokeWidth={2} />,
        run: () =>
          runAndClose(() => {
            void logout().catch((err: unknown) => {
              console.error('Sign out failed', err);
            });
          }),
      },
      {
        id: 'home',
        category: t('commandPalette.category.navigate', 'Navigate'),
        label: t('commandPalette.home', 'Home'),
        icon: <Home className="size-[15px] shrink-0 opacity-90" strokeWidth={2} />,
        run: () => runAndClose(() => navigate(baseUrl)),
      },
      {
        id: 'inbox',
        category: t('commandPalette.category.navigate', 'Navigate'),
        label: t('commandPalette.inbox', 'Inbox'),
        icon: <Inbox className="size-[15px] shrink-0 opacity-90" strokeWidth={2} />,
        run: () => runAndClose(() => navigate(`${baseUrl}/notifications`)),
      },
      {
        id: 'analytics',
        category: t('commandPalette.category.navigate', 'Navigate'),
        label: t('commandPalette.analytics', 'Analytics'),
        icon: <BarChart3 className="size-[15px] shrink-0 opacity-90" strokeWidth={2} />,
        run: () => runAndClose(() => navigate(`${baseUrl}/analytics`)),
      },
      {
        id: 'archives',
        category: t('commandPalette.category.navigate', 'Navigate'),
        label: t('commandPalette.archives', 'Archives'),
        icon: <Archive className="size-[15px] shrink-0 opacity-90" strokeWidth={2} />,
        run: () => runAndClose(() => navigate(`${baseUrl}/archives`)),
      },
      {
        id: 'pages',
        category: t('commandPalette.category.navigate', 'Navigate'),
        label: t('commandPalette.pages', 'Pages'),
        matchText: t('commandPalette.pages.match', 'documents wiki'),
        icon: <FileText className="size-[15px] shrink-0 opacity-90" strokeWidth={2} />,
        run: () => runAndClose(() => navigate(`${baseUrl}/pages`)),
      },
    ];

    if (projectId && workspaceSlug) {
      list.push(
        {
          id: 'proj-issues',
          category: t('commandPalette.category.thisProject', 'This project'),
          label: t('commandPalette.projIssues', 'Work items in current project'),
          projectScoped: true,
          matchText: t('commandPalette.projIssues.match', 'issues list'),
          icon: <LayoutGrid className="size-[15px] shrink-0 opacity-90" strokeWidth={2} />,
          run: () => runAndClose(() => navigate(`${baseUrl}/projects/${projectId}/issues`)),
        },
        {
          id: 'proj-cycles',
          category: t('commandPalette.category.thisProject', 'This project'),
          label: t('commandPalette.projCycles', 'Cycles in current project'),
          projectScoped: true,
          icon: <IterationCw className="size-[15px] shrink-0 opacity-90" strokeWidth={2} />,
          run: () => runAndClose(() => navigate(`${baseUrl}/projects/${projectId}/cycles`)),
        },
        {
          id: 'proj-modules',
          category: t('commandPalette.category.thisProject', 'This project'),
          label: t('commandPalette.projModules', 'Modules in current project'),
          projectScoped: true,
          icon: <Boxes className="size-[15px] shrink-0 opacity-90" strokeWidth={2} />,
          run: () => runAndClose(() => navigate(`${baseUrl}/projects/${projectId}/modules`)),
        },
      );
    }

    const sortedProjects = [...projects].sort((a, b) => a.name.localeCompare(b.name));
    for (const p of sortedProjects) {
      list.push({
        id: `open-project-${p.id}`,
        category: t('commandPalette.category.project', 'Project'),
        label: t('commandPalette.openProject', 'Open “{{name}}”', { name: p.name }),
        matchText: t('commandPalette.openProject.match', '{{name}} project issues', {
          name: p.name,
        }),
        projectScoped: true,
        icon: <FolderKanban className="size-[15px] shrink-0 opacity-90" strokeWidth={2} />,
        run: () => runAndClose(() => navigate(`${baseUrl}/projects/${p.id}/issues`)),
      });
    }

    list.push({
      id: 'help',
      category: t('commandPalette.category.help', 'Help'),
      label: t('commandPalette.help', 'Account & preferences'),
      matchText: t('commandPalette.help.match', 'help shortcuts documentation support'),
      icon: <HelpCircle className="size-[15px] shrink-0 opacity-90" strokeWidth={2} />,
      run: () => runAndClose(() => navigate('/settings')),
    });

    return list;
  }, [
    baseUrl,
    logout,
    navigate,
    onRequestCreateWorkItem,
    projectId,
    projects,
    runAndClose,
    workspaceSlug,
    t,
  ]);

  const entityEntries = useMemo((): CommandEntry[] => {
    const q = query.trim();
    // Ignore results that belong to a previous query (cleared on query change).
    if (!q || !baseUrl || !searchState || searchState.q !== q) return [];
    const results = searchState.results;
    const out: CommandEntry[] = [];
    const push = (
      hits: SearchHit[],
      key: string,
      category: string,
      icon: ReactNode,
      to: (h: SearchHit) => string,
      opts?: { withSeq?: boolean; needsProject?: boolean },
    ) => {
      for (const h of hits) {
        // Skip project-owned hits without a project so we never build /projects//…
        if (opts?.needsProject && !h.project_id) continue;
        const prefix =
          opts?.withSeq && h.project_identifier && h.sequence_id != null
            ? `${h.project_identifier}-${h.sequence_id} `
            : '';
        out.push({
          id: `search-${key}-${h.id}`,
          category,
          label: `${prefix}${h.name || t('common.untitled', 'Untitled')}`,
          icon,
          run: () => runAndClose(() => navigate(to(h))),
        });
      }
    };
    const ic = (Icon: typeof CircleDot) => (
      <Icon className="size-[15px] shrink-0" strokeWidth={2} />
    );
    const projectBase = (pid?: string) => `${baseUrl}/projects/${pid}`;
    push(
      results.issue,
      'issue',
      t('commandPalette.category.workItems', 'Work items'),
      ic(CircleDot),
      (h) => `${projectBase(h.project_id)}/issues/${h.id}`,
      { withSeq: true, needsProject: true },
    );
    push(
      results.epic,
      'epic',
      t('commandPalette.category.epics', 'Epics'),
      ic(Boxes),
      (h) => `${projectBase(h.project_id)}/epics/${h.id}`,
      { withSeq: true, needsProject: true },
    );
    push(
      results.cycle,
      'cycle',
      t('commandPalette.category.cycles', 'Cycles'),
      ic(IterationCw),
      (h) => `${projectBase(h.project_id)}/cycles/${h.id}`,
      { needsProject: true },
    );
    push(
      results.module,
      'module',
      t('commandPalette.category.modules', 'Modules'),
      ic(Box),
      (h) => `${projectBase(h.project_id)}/modules/${h.id}`,
      { needsProject: true },
    );
    push(
      results.view,
      'view',
      t('commandPalette.category.views', 'Views'),
      ic(Layers),
      (h) => `${projectBase(h.project_id)}/views/${h.id}`,
      { needsProject: true },
    );
    push(
      results.page,
      'page',
      t('commandPalette.category.pages', 'Pages'),
      ic(FileText),
      (h) => `${projectBase(h.project_id)}/pages/${h.id}`,
      { needsProject: true },
    );
    push(
      results.project,
      'project',
      t('commandPalette.category.projects', 'Projects'),
      ic(FolderKanban),
      (h) => `${baseUrl}/projects/${h.id}/issues`,
    );
    return out;
  }, [query, searchState, baseUrl, navigate, runAndClose, t]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = workspaceLevel ? commands.filter((c) => !c.projectScoped) : commands;
    if (!q) return base;
    const matchingCommands = base.filter((c) => {
      const hay = `${c.label} ${c.category} ${c.matchText ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
    // Entity results first so what the user is searching for is most prominent.
    return [...entityEntries, ...matchingCommands];
  }, [commands, query, workspaceLevel, entityEntries]);

  const grouped = useMemo(() => {
    const map = new Map<string, CommandEntry[]>();
    for (const c of filtered) {
      const arr = map.get(c.category) ?? [];
      arr.push(c);
      map.set(c.category, arr);
    }
    return map;
  }, [filtered]);

  const flatIds = useMemo(() => filtered.map((c) => c.id), [filtered]);

  useEffect(() => {
    if (!open) {
      queueMicrotask(() => {
        setEntered(false);
        setQuery('');
        setSelectedId(null);
        setSearchState(null);
        setSearching(false);
      });
      return;
    }
    let canceled = false;
    const id = window.requestAnimationFrame(() => {
      if (canceled) return;
      setEntered(false);
      inputRef.current?.focus();
      window.requestAnimationFrame(() => {
        if (!canceled) setEntered(true);
      });
    });
    return () => {
      canceled = true;
      window.cancelAnimationFrame(id);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const first = flatIds[0] ?? null;
    queueMicrotask(() => {
      setSelectedId((prev) => (prev && flatIds.includes(prev) ? prev : first));
    });
  }, [flatIds, open]);

  useEffect(() => {
    if (!open || !selectedId) return;
    const el = itemRefs.current.get(selectedId);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [open, selectedId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close, open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Debounced entity search against the backend while the user types. All
  // state updates happen in async callbacks; an empty query is handled by
  // deriving empty entity entries below (see entityEntries) rather than
  // synchronously resetting state here.
  useEffect(() => {
    const q = query.trim();
    if (!open || !q || !workspaceSlug) return;
    const controller = new AbortController();
    const handle = window.setTimeout(() => {
      setSearching(true);
      searchService
        .search(workspaceSlug, q, {
          projectId: workspaceLevel ? undefined : projectId,
          signal: controller.signal,
        })
        .then((res) => {
          if (!controller.signal.aborted) setSearchState({ q, results: res });
        })
        .catch(() => {
          if (!controller.signal.aborted) setSearchState(null);
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(handle);
    };
  }, [open, query, workspaceSlug, projectId, workspaceLevel]);

  const moveSelection = (delta: number) => {
    if (!flatIds.length) return;
    const i = Math.max(0, selectedId ? flatIds.indexOf(selectedId) : 0);
    const next = (i + delta + flatIds.length) % flatIds.length;
    setSelectedId(flatIds[next]!);
  };

  const activateSelected = () => {
    const cmd = filtered.find((c) => c.id === selectedId);
    if (cmd) cmd.run();
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveSelection(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveSelection(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      activateSelected();
    }
  };

  if (!open || typeof document === 'undefined') return null;

  const modKey = isMac ? '⌘' : 'Ctrl';
  // True while a search is in flight OR results for the current query haven't
  // arrived yet (covers the debounce gap after the query changes).
  const trimmedQuery = query.trim();
  const pendingSearch =
    trimmedQuery.length > 0 && (searching || !searchState || searchState.q !== trimmedQuery);

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[200] flex items-start justify-center pt-[10vh] sm:pt-[12vh]',
        'transition-opacity duration-150 ease-out',
        entered ? 'opacity-100' : 'opacity-0',
      )}
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default border-0 bg-(--bg-backdrop) backdrop-blur-[3px] transition-opacity duration-150"
        aria-label={t('commandPalette.close', 'Close command palette')}
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'relative z-[1] mx-3 flex w-full max-w-[min(40rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-lg',
          'border border-(--border-subtle) bg-(--bg-surface-1) shadow-(--shadow-overlay)',
          'transition-opacity duration-150 ease-out motion-reduce:transition-none',
          entered ? 'opacity-100' : 'opacity-0',
        )}
        style={{ maxHeight: 'min(36rem, calc(100vh - 3.5rem))' }}
      >
        <h2 id={titleId} className="sr-only">
          {t('commandPalette.title', 'Command palette')}
        </h2>
        <div
          data-command-palette-root
          className="flex items-center gap-2.5 border-b border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2.5 sm:px-3.5"
        >
          <Search
            className="size-4 shrink-0 text-(--txt-icon-tertiary)"
            strokeWidth={2}
            aria-hidden
          />
          <input
            ref={inputRef}
            type="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder={t('commandPalette.placeholder', 'Type a command or search...')}
            aria-controls={listId}
            aria-activedescendant={selectedId ? `cmd-palette-opt-${selectedId}` : undefined}
            aria-autocomplete="list"
            className="min-w-0 flex-1 border-0 bg-transparent text-[13px] leading-normal text-(--txt-primary) outline-none placeholder:text-(--txt-placeholder)"
          />
        </div>

        <div
          id={listId}
          ref={listRef}
          role="listbox"
          aria-label={t('commandPalette.listLabel', 'Commands')}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-(--bg-surface-1) px-1 py-1.5"
        >
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 px-4 py-10 text-center">
              {pendingSearch ? (
                <p className="text-sm font-medium text-(--txt-secondary)">
                  {t('commandPalette.searching', 'Searching…')}
                </p>
              ) : (
                <>
                  <p className="text-sm font-medium text-(--txt-secondary)">
                    {query.trim()
                      ? t('commandPalette.noResults', 'No results')
                      : t('commandPalette.noActions', 'No matching actions')}
                  </p>
                  <p className="max-w-xs text-xs text-(--txt-tertiary)">
                    {t(
                      'commandPalette.emptyHint',
                      'Try another keyword, or turn off workspace level to see project shortcuts.',
                    )}
                  </p>
                </>
              )}
            </div>
          ) : (
            <>
              {[...grouped.entries()].map(([category, items]) => (
                <div key={category} className="mb-2 last:mb-0">
                  <div className="px-2 pb-1 pt-1 text-[10px] font-medium uppercase tracking-wide text-(--txt-placeholder)">
                    {category}
                  </div>
                  <div className="flex flex-col gap-px">
                    {items.map((cmd) => {
                      const active = cmd.id === selectedId;
                      const optId = `cmd-palette-opt-${cmd.id}`;
                      return (
                        <button
                          key={cmd.id}
                          id={optId}
                          type="button"
                          role="option"
                          aria-selected={active}
                          // Keep keyboard focus on the input so its arrow/Enter
                          // handlers and the aria-activedescendant model stay in
                          // control; Tab must not land on the options.
                          tabIndex={-1}
                          ref={(el) => {
                            if (el) itemRefs.current.set(cmd.id, el);
                            else itemRefs.current.delete(cmd.id);
                          }}
                          className={cn(
                            'group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left outline-none',
                            'transition-colors duration-100 ease-out motion-reduce:transition-none',
                            active
                              ? 'bg-(--bg-layer-1-hover) text-(--txt-primary)'
                              : 'text-(--txt-secondary) hover:bg-(--bg-layer-transparent-hover) hover:text-(--txt-primary)',
                          )}
                          onMouseEnter={() => setSelectedId(cmd.id)}
                          onClick={() => cmd.run()}
                        >
                          <span
                            className={cn(
                              'flex w-5 shrink-0 justify-center text-(--txt-icon-tertiary) transition-colors duration-100',
                              active && 'text-(--txt-primary)',
                            )}
                          >
                            {cmd.icon}
                          </span>
                          <span
                            className={cn(
                              'min-w-0 flex-1 truncate text-[13px] leading-snug',
                              active ? 'font-medium text-(--txt-primary)' : 'font-normal',
                            )}
                          >
                            {cmd.label}
                          </span>
                          {cmd.shortcut ? (
                            <Kbd className="text-(--txt-tertiary)">{cmd.shortcut}</Kbd>
                          ) : (
                            <span className="w-5 shrink-0" aria-hidden />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-(--border-subtle) bg-(--bg-canvas) px-3 py-2 sm:px-3.5">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-(--txt-tertiary)">
            <span className="font-medium text-(--txt-secondary)">
              {t('commandPalette.actions', 'Actions')}
            </span>
            <span className="text-(--txt-placeholder)">·</span>
            <span className="inline-flex items-center gap-0.5">
              <Kbd>{modKey}</Kbd>
              {}
              <Kbd>K</Kbd>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span id={workspaceLevelLabelId} className="text-[11px] text-(--txt-secondary)">
              {t('commandPalette.workspaceLevel', 'Workspace level')}
            </span>
            <Switch
              checked={workspaceLevel}
              onChange={persistWorkspaceLevel}
              aria-labelledby={workspaceLevelLabelId}
              className={cn(
                'group relative inline-flex h-[22px] w-9 shrink-0 cursor-pointer rounded-full border border-(--border-subtle) bg-(--bg-layer-1)',
                'transition-colors duration-150 ease-out',
                'data-checked:border-transparent data-checked:bg-(--bg-accent-primary)',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-(--brand-400) focus-visible:ring-offset-1 focus-visible:ring-offset-(--bg-canvas)',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'pointer-events-none inline-block size-[18px] translate-x-0.5 rounded-full bg-(--neutral-white) shadow-sm ring-1 ring-black/5 transition duration-150 ease-out motion-reduce:transition-none',
                  'group-data-checked:translate-x-[14px]',
                )}
              />
            </Switch>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
