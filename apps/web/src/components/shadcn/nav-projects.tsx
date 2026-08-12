'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  ChevronRight,
  FileText,
  Folder,
  Inbox,
  Layers,
  LayoutGrid,
  MoreHorizontal,
  RefreshCw,
  Settings,
  SquareKanban,
  type LucideIcon,
} from 'lucide-react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/shadcn/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/shadcn/ui/dropdown-menu';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/shadcn/ui/sidebar';
import { Skeleton } from '@/components/shadcn/ui/skeleton';
import { projectService } from '../../services/projectService';
import type { ProjectApiResponse } from '../../api/types';

/** How many projects to list before the group needs a "More" link. */
const MAX_PROJECTS_LISTED = 6;

/**
 * The per-project pages, in the order the shipped project sidebar lists them.
 *
 * `flag` names the project setting that hides a page; work items and epics have
 * none, so they are always listed. A project that has never been saved leaves
 * these fields undefined, which reads as enabled — matching the API's defaults.
 */
const PROJECT_PAGES: {
  segment: string;
  labelKey: string;
  fallback: string;
  icon: LucideIcon;
  flag?: keyof ProjectApiResponse;
}[] = [
  {
    segment: 'work-items',
    labelKey: 'views.workItems',
    fallback: 'Work items',
    icon: SquareKanban,
  },
  { segment: 'epics', labelKey: 'common.epics', fallback: 'Epics', icon: LayoutGrid },
  {
    segment: 'cycles',
    labelKey: 'common.cycles',
    fallback: 'Cycles',
    icon: RefreshCw,
    flag: 'cycle_view',
  },
  {
    segment: 'modules',
    labelKey: 'common.modules',
    fallback: 'Modules',
    icon: LayoutGrid,
    flag: 'module_view',
  },
  {
    segment: 'views',
    labelKey: 'common.views',
    fallback: 'Views',
    icon: Layers,
    flag: 'issue_views_view',
  },
  {
    segment: 'pages',
    labelKey: 'common.pages',
    fallback: 'Pages',
    icon: FileText,
    flag: 'page_view',
  },
  {
    segment: 'intake',
    labelKey: 'common.intake',
    fallback: 'Intake',
    icon: Inbox,
    flag: 'intake_view',
  },
];

/** A project's first letter, standing in for the icon the shipped app renders. */
function projectInitial(project: ProjectApiResponse): string {
  return (project.identifier || project.name || '?').trim().charAt(0).toUpperCase();
}

/**
 * The v2 shell's project group: the workspace's real projects, each expanding
 * to its own pages, mirroring the shipped sidebar's project tree.
 *
 * Links point at the v2 routes under `/app-v2/projects/:projectId/…` so
 * navigating keeps this preview shell; the project settings item is the one
 * exception, since there is no v2 settings page to land on.
 */
export function NavProjects() {
  const { t } = useTranslation();
  const { isMobile } = useSidebar();
  const { workspaceSlug, projectId: activeProjectId } = useParams<{
    workspaceSlug: string;
    projectId?: string;
  }>();
  const { pathname } = useLocation();

  const [projects, setProjects] = useState<ProjectApiResponse[]>([]);
  /* Only loading when there is a workspace to load for; without a slug the
     group renders its empty state immediately rather than a skeleton that
     never resolves. */
  const [loading, setLoading] = useState(Boolean(workspaceSlug));
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!workspaceSlug) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the skeleton belongs to this fetch
    setLoading(true);
    projectService
      .list(workspaceSlug)
      .then((list) => {
        if (!cancelled) setProjects(list ?? []);
      })
      .catch(() => {
        /* The group renders empty; the rest of the sidebar still works. */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug]);

  const base = workspaceSlug ? `/${workspaceSlug}` : '';
  const visible = useMemo(
    () => (showAll ? projects : projects.slice(0, MAX_PROJECTS_LISTED)),
    [projects, showAll],
  );

  if (loading) {
    return (
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupLabel>{t('common.projects', 'Projects')}</SidebarGroupLabel>
        <SidebarMenu>
          {Array.from({ length: 3 }).map((_, index) => (
            <SidebarMenuItem key={index}>
              <Skeleton className="h-8 w-full" />
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroup>
    );
  }

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>{t('common.projects', 'Projects')}</SidebarGroupLabel>
      <SidebarMenu>
        {projects.length === 0 && (
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link to={`${base}/app-v2/projects`}>
                <Folder />
                <span>{t('projects.empty', 'No projects yet')}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}

        {visible.map((project) => {
          const projectBase = `${base}/app-v2/projects/${project.id}`;
          const pages = PROJECT_PAGES.filter((page) => !page.flag || project[page.flag] !== false);
          /* Expanded for the project being viewed, so its pages are reachable
             without a click after navigating in. */
          const isActive = activeProjectId === project.id;

          return (
            <Collapsible key={project.id} asChild defaultOpen={isActive}>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip={project.name} isActive={isActive}>
                  <Link to={`${projectBase}/work-items`}>
                    <span
                      aria-hidden
                      className="bg-sidebar-accent text-sidebar-accent-foreground flex size-4 shrink-0 items-center justify-center rounded text-[10px] font-medium"
                    >
                      {projectInitial(project)}
                    </span>
                    <span className="truncate">{project.name}</span>
                  </Link>
                </SidebarMenuButton>

                <CollapsibleTrigger asChild>
                  <SidebarMenuAction className="right-7 data-[state=open]:rotate-90">
                    <ChevronRight />
                    <span className="sr-only">{t('common.toggle', 'Toggle')}</span>
                  </SidebarMenuAction>
                </CollapsibleTrigger>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuAction showOnHover>
                      <MoreHorizontal />
                      <span className="sr-only">{t('common.more', 'More')}</span>
                    </SidebarMenuAction>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="w-48"
                    side={isMobile ? 'bottom' : 'right'}
                    align={isMobile ? 'end' : 'start'}
                  >
                    <DropdownMenuItem asChild>
                      <Link to={`${projectBase}/work-items`}>
                        <Folder className="text-muted-foreground" />
                        <span>{t('projects.open', 'Open project')}</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {/* No v2 settings page exists, so this leaves the preview. */}
                    <DropdownMenuItem asChild>
                      <Link to={`${base}/projects/${project.id}/settings`}>
                        <Settings className="text-muted-foreground" />
                        <span>{t('projects.settings', 'Project settings')}</span>
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <CollapsibleContent>
                  <SidebarMenuSub>
                    {pages.map((page) => {
                      const url = `${projectBase}/${page.segment}`;
                      const Icon = page.icon;
                      return (
                        <SidebarMenuSubItem key={page.segment}>
                          <SidebarMenuSubButton asChild isActive={pathname.startsWith(url)}>
                            <Link to={url}>
                              <Icon />
                              <span>{t(page.labelKey, page.fallback)}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      );
                    })}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          );
        })}

        {projects.length > MAX_PROJECTS_LISTED && !showAll && (
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => setShowAll(true)}>
              <MoreHorizontal />
              <span>{t('common.more', 'More')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}
      </SidebarMenu>
    </SidebarGroup>
  );
}
