import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { ExternalLink, Link2, Plus, StickyNote, Trash2 } from 'lucide-react';
import { Button } from '@/v2/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/v2/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/v2/components/ui/dialog';
import { Input } from '@/v2/components/ui/input';
import { Label } from '@/v2/components/ui/label';
import { Skeleton } from '@/v2/components/ui/skeleton';
import { Textarea } from '@/v2/components/ui/textarea';
import { StickyNoteCard } from '../../components/stickies/StickyNoteCard';
import { pickRandomStickyBackground } from '../../components/stickies/stickyPalette';
import { useAuth } from '../../contexts/AuthContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatTimeAgo } from '../lib/project';
import { safeUrl } from '../../lib/sanitize';
import { projectService } from '../../services/projectService';
import { quickLinksService } from '../../services/quickLinksService';
import { recentsService } from '../../services/recentsService';
import { stickiesService } from '../../services/stickiesService';
import { workspaceService } from '../../services/workspaceService';
import type {
  ProjectApiResponse,
  QuickLinkApiResponse,
  RecentVisitApiResponse,
  StickyApiResponse,
  WorkspaceApiResponse,
} from '../../api/types';

function greetingKey(): { key: string; fallback: string } {
  const hour = new Date().getHours();
  if (hour < 12) return { key: 'home.greeting.morning', fallback: 'Good morning' };
  if (hour < 17) return { key: 'home.greeting.afternoon', fallback: 'Good afternoon' };
  return { key: 'home.greeting.evening', fallback: 'Good evening' };
}

/**
 * The v2 view of the workspace home, built from shadcn primitives. It renders
 * at the same URL as WorkspaceHomePage; the stored interface preference picks
 * between them.
 *
 * One capability is deliberately absent: the shipped page lets you drag the
 * widgets into a different order, with the order persisted per user. That drag
 * handling is written inline in the page — there is no component to import —
 * and reordering is a stored preference rather than a design-language question,
 * so the preview renders the three widgets in a fixed order instead. Everything
 * the widgets *do* — adding, editing and deleting quicklinks and stickies, and
 * opening a recent item — is here.
 *
 * The sticky cards themselves are the shipped `StickyNoteCard`: they carry
 * their own debounced content sync and colour picker, which a preview has no
 * reason to re-derive.
 */
export function WorkspaceHomePage() {
  const { t } = useTranslation();
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const { user } = useAuth();
  useDocumentTitle(t('home.documentTitle', 'Home'));

  const [workspace, setWorkspace] = useState<WorkspaceApiResponse | null>(null);
  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);
  const [quicklinks, setQuicklinks] = useState<QuickLinkApiResponse[]>([]);
  const [stickies, setStickies] = useState<StickyApiResponse[]>([]);
  const [recents, setRecents] = useState<RecentVisitApiResponse[]>([]);
  const [loading, setLoading] = useState(Boolean(workspaceSlug));
  const [error, setError] = useState<string | null>(null);

  const [quicklinkOpen, setQuicklinkOpen] = useState(false);
  const [quicklinkUrl, setQuicklinkUrl] = useState('');
  const [quicklinkTitle, setQuicklinkTitle] = useState('');
  const [quicklinkSubmitting, setQuicklinkSubmitting] = useState(false);
  const [stickyOpen, setStickyOpen] = useState(false);
  const [stickyContent, setStickyContent] = useState('');
  const [stickySubmitting, setStickySubmitting] = useState(false);
  const [stickiesDarkTheme, setStickiesDarkTheme] = useState(
    () =>
      typeof document !== 'undefined' &&
      document.documentElement.getAttribute('data-theme') === 'dark',
  );

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setStickiesDarkTheme(root.getAttribute('data-theme') === 'dark');

    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!workspaceSlug) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      workspaceService.getBySlug(workspaceSlug),
      projectService.list(workspaceSlug).catch(() => [] as ProjectApiResponse[]),
      /* The three widgets are independent: one failing leaves the others. */
      quickLinksService.list(workspaceSlug).catch(() => [] as QuickLinkApiResponse[]),
      stickiesService.list(workspaceSlug).catch(() => [] as StickyApiResponse[]),
      recentsService.list(workspaceSlug).catch(() => [] as RecentVisitApiResponse[]),
    ])
      .then(([ws, projectList, links, notes, visits]) => {
        if (cancelled) return;
        setWorkspace(ws ?? null);
        setProjects(projectList ?? []);
        setQuicklinks(links ?? []);
        setStickies(notes ?? []);
        setRecents(visits ?? []);
        setError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setWorkspace(null);
        setError(t('home.loadError', 'Could not load your workspace home.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, t]);

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const addQuicklink = useCallback(async () => {
    if (!workspaceSlug || !quicklinkUrl.trim() || quicklinkSubmitting) return;
    setQuicklinkSubmitting(true);
    try {
      const created = await quickLinksService.create(workspaceSlug, {
        url: quicklinkUrl.trim(),
        title: quicklinkTitle.trim() || quicklinkUrl.trim(),
      });
      setQuicklinks((prev) => [...prev, created]);
      setQuicklinkOpen(false);
      setQuicklinkUrl('');
      setQuicklinkTitle('');
    } catch {
      setError(t('home.quicklinkFailed', 'Could not add the quicklink.'));
    } finally {
      setQuicklinkSubmitting(false);
    }
  }, [workspaceSlug, quicklinkUrl, quicklinkTitle, quicklinkSubmitting, t]);

  const deleteQuicklink = useCallback(
    async (id: string) => {
      if (!workspaceSlug) return;
      const previous = quicklinks;
      setQuicklinks((prev) => prev.filter((link) => link.id !== id));
      try {
        await quickLinksService.delete(workspaceSlug, id);
      } catch {
        setQuicklinks(previous);
      }
    },
    [workspaceSlug, quicklinks],
  );

  const addSticky = useCallback(async () => {
    if (!workspaceSlug || !stickyContent.trim() || stickySubmitting) return;
    setStickySubmitting(true);
    try {
      const created = await stickiesService.create(workspaceSlug, {
        description: stickyContent.trim(),
        color: pickRandomStickyBackground(),
      });
      setStickies((prev) => [created, ...prev]);
      setStickyOpen(false);
      setStickyContent('');
    } catch {
      setError(t('home.stickyFailed', 'Could not add the sticky note.'));
    } finally {
      setStickySubmitting(false);
    }
  }, [workspaceSlug, stickyContent, stickySubmitting, t]);

  const deleteSticky = useCallback(
    async (id: string) => {
      if (!workspaceSlug) return;
      const previous = stickies;
      setStickies((prev) => prev.filter((sticky) => sticky.id !== id));
      try {
        await stickiesService.delete(workspaceSlug, id);
      } catch {
        setStickies(previous);
      }
    },
    [workspaceSlug, stickies],
  );

  if (loading) {
    return (
      <div className="space-y-6 pb-8">
        <Skeleton className="h-16 w-80" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <p className="text-muted-foreground text-sm">
        {error ?? t('common.workspaceNotFound', 'Workspace not found.')}
      </p>
    );
  }

  const greeting = greetingKey();

  /* Recents point at the shipped work item route in the API's own terms; the
     preview keeps the reader inside its tree. */
  const recentHref = (visit: RecentVisitApiResponse): string | null => {
    if (!visit.entity_identifier) return null;
    if (visit.entity_name === 'issue' && visit.project_id) {
      return `/${workspaceSlug}/projects/${visit.project_id}/issues/${visit.entity_identifier}`;
    }
    if (visit.entity_name === 'project') {
      return `/${workspaceSlug}/projects/${visit.entity_identifier}/issues`;
    }
    if (visit.entity_name === 'page' && visit.project_id) {
      return `/${workspaceSlug}/projects/${visit.project_id}/pages/${visit.entity_identifier}`;
    }
    return null;
  };

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h2 className="text-2xl font-semibold">
          {t(greeting.key, greeting.fallback)}
          {user?.name ? `, ${user.name}` : ''}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {new Date().toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
          })}
        </p>
      </div>

      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-sm">{t('home.quicklinks', 'Quicklinks')}</CardTitle>
              <CardDescription>
                {t('home.quicklinksHint', 'Links you want one click away.')}
              </CardDescription>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              aria-label={t('home.addQuicklink', 'Add quicklink')}
              onClick={() => setQuicklinkOpen(true)}
            >
              <Plus />
            </Button>
          </CardHeader>
          <CardContent>
            {quicklinks.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-8 text-center">
                <Link2 className="text-muted-foreground size-5" aria-hidden />
                <p className="text-muted-foreground text-sm">
                  {t('home.noQuicklinks', 'No quicklinks yet.')}
                </p>
              </div>
            ) : (
              <ul className="divide-y">
                {quicklinks.map((link) => (
                  <li key={link.id} className="group flex items-center gap-2 py-2">
                    <a
                      href={safeUrl(link.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-w-0 flex-1 items-center gap-2 text-sm hover:underline"
                    >
                      <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                      <span className="truncate">{link.title || link.url}</span>
                    </a>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                      aria-label={t('common.delete', 'Delete')}
                      onClick={() => void deleteQuicklink(link.id)}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('home.recents', 'Recents')}</CardTitle>
            <CardDescription>{t('home.recentsHint', 'Where you left off.')}</CardDescription>
          </CardHeader>
          <CardContent>
            {recents.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                {t('home.noRecents', 'Nothing visited yet.')}
              </p>
            ) : (
              <ul className="divide-y">
                {recents.slice(0, 8).map((visit) => {
                  const href = recentHref(visit);
                  const title =
                    visit.display_title ||
                    (visit.project_id ? projectById.get(visit.project_id)?.name : null) ||
                    t('home.untitled', 'Untitled');
                  const row = (
                    <>
                      {visit.display_identifier && (
                        <span className="text-muted-foreground shrink-0 font-mono text-xs">
                          {visit.display_identifier}
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm">{title}</span>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {formatTimeAgo(visit.last_visited_at)}
                      </span>
                    </>
                  );
                  return (
                    <li key={visit.id}>
                      {href ? (
                        <Link
                          to={href}
                          className="hover:bg-muted/50 -mx-2 flex items-center gap-2 rounded-md px-2 py-2 transition-colors"
                        >
                          {row}
                        </Link>
                      ) : (
                        <div className="flex items-center gap-2 py-2">{row}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-sm">{t('home.stickies', 'Your stickies')}</CardTitle>
            <CardDescription>
              {t('home.stickiesHint', 'Short notes that live with your workspace.')}
            </CardDescription>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            aria-label={t('home.addSticky', 'Add sticky')}
            onClick={() => setStickyOpen(true)}
          >
            <Plus />
          </Button>
        </CardHeader>
        <CardContent>
          {stickies.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-10 text-center">
              <StickyNote className="text-muted-foreground size-5" aria-hidden />
              <p className="text-muted-foreground text-sm">
                {t('home.noStickies', 'No sticky notes yet.')}
              </p>
              <Button size="sm" onClick={() => setStickyOpen(true)}>
                <Plus />
                {t('home.addSticky', 'Add sticky')}
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {stickies.map((sticky) => (
                <StickyNoteCard
                  key={sticky.id}
                  workspaceSlug={workspaceSlug ?? ''}
                  sticky={sticky}
                  isDarkTheme={stickiesDarkTheme}
                  onUpdate={(updated) =>
                    setStickies((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
                  }
                  onDelete={() => void deleteSticky(sticky.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={quicklinkOpen} onOpenChange={setQuicklinkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('home.addQuicklink', 'Add quicklink')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="quicklink-url">{t('home.quicklinkUrl', 'URL')}</Label>
              <Input
                id="quicklink-url"
                type="url"
                placeholder="https://…"
                value={quicklinkUrl}
                onChange={(event) => setQuicklinkUrl(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quicklink-title">
                {t('home.quicklinkTitle', 'Title (optional)')}
              </Label>
              <Input
                id="quicklink-title"
                value={quicklinkTitle}
                onChange={(event) => setQuicklinkTitle(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuicklinkOpen(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              onClick={() => void addQuicklink()}
              disabled={quicklinkSubmitting || !quicklinkUrl.trim()}
            >
              {t('common.add', 'Add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={stickyOpen} onOpenChange={setStickyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('home.addSticky', 'Add sticky')}</DialogTitle>
          </DialogHeader>
          <Textarea
            rows={5}
            value={stickyContent}
            onChange={(event) => setStickyContent(event.target.value)}
            placeholder={t('home.stickyPlaceholder', 'Write a note…')}
            aria-label={t('home.stickyPlaceholder', 'Write a note…')}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setStickyOpen(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              onClick={() => void addSticky()}
              disabled={stickySubmitting || !stickyContent.trim()}
            >
              {t('common.add', 'Add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
