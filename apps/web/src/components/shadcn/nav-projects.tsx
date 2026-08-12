'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  ChevronRight,
  FileText,
  Folder,
  Inbox,
  Layers,
  LayoutGrid,
  RefreshCw,
  SquareKanban,
  type LucideIcon,
} from 'lucide-react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/shadcn/ui/collapsible';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/shadcn/ui/sidebar';
import { Skeleton } from '@/components/shadcn/ui/skeleton';
import { projectService } from '../../services/projectService';
import type { ProjectApiResponse } from '../../api/types';

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

        {projects.map((project) => {
          const projectBase = `${base}/app-v2/projects/${project.id}`;
          const pages = PROJECT_PAGES.filter((page) => !page.flag || project[page.flag] !== false);
          /* Expanded for the project being viewed, so its pages are reachable
             without a click after navigating in. */
          const isActive = activeProjectId === project.id;

          return (
            <Collapsible
              key={project.id}
              asChild
              defaultOpen={isActive}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip={project.name} isActive={isActive}>
                    <span
                      aria-hidden
                      className="bg-sidebar-accent text-sidebar-accent-foreground flex size-4 shrink-0 items-center justify-center rounded text-[10px] font-medium"
                    >
                      {projectInitial(project)}
                    </span>
                    <span className="truncate">{project.name}</span>
                    <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>

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
      </SidebarMenu>
    </SidebarGroup>
  );
}
