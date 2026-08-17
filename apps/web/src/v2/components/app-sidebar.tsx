'use client';

import * as React from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useLocation, useParams } from 'react-router-dom';
import {
  Archive,
  BarChart3,
  House,
  Inbox,
  Layers,
  LayoutGrid,
  Pencil,
  Settings,
  UserRound,
} from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import { WorkspaceFavoritesTree } from '@/components/layout/WorkspaceFavoritesTree';
import { NavMain } from '@/v2/components/nav-main';
import { NavProjects } from '@/v2/components/nav-projects';
import { NavUser } from '@/v2/components/nav-user';
import { DitheredLogo } from '@/v2/components/ui/dithered-logo';
import { readLastWorkspaceView } from '../lib/lastWorkspaceView';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/v2/components/ui/sidebar';

/* The block's sample data, replaced with Devlane's own pages. Every url is a
   real route. The projects group is not built here — NavProjects loads the
   workspace's real projects itself. */
function buildData(
  base: string,
  user: { name: string; email: string; avatar: string; id: string } | null,
  t: TFunction,
  lastViewId: string,
) {
  return {
    user: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      avatar: user?.avatar ?? '',
    },
    primaryNav: [
      {
        /* Inside the v2 shell, so navigating here keeps this sidebar. */
        title: t('nav.home', 'Home'),
        url: base ? `${base}` : '/',
        icon: House,
      },
      {
        /* Inside the v2 shell, so navigating here keeps this sidebar. */
        title: t('nav.inbox', 'Inbox'),
        url: `${base}/notifications`,
        icon: Inbox,
      },
      {
        title: t('nav.yourWork', 'Your work'),
        url: user ? `${base}/profile/${user.id}` : `${base}`,
        icon: UserRound,
      },
    ],
    workspaceNav: [
      {
        /* Inside the v2 shell, so navigating here keeps this sidebar. */
        title: t('nav.projects', 'Projects'),
        url: `${base}/projects`,
        icon: LayoutGrid,
      },
      {
        /* Inside the v2 shell, so navigating here keeps this sidebar. */
        /* Leads back to the view last opened in this workspace, whose table and
           filters are remembered with it. */
        title: t('nav.views', 'Views'),
        url: `${base}/views/${lastViewId}`,
        icon: Layers,
      },
      {
        /* Inside the v2 shell, so navigating here keeps this sidebar. */
        title: t('nav.analytics', 'Analytics'),
        url: `${base}/analytics/overview`,
        icon: BarChart3,
      },
      {
        /* Inside the v2 shell, so navigating here keeps this sidebar. */
        title: t('nav.drafts', 'Drafts'),
        url: `${base}/drafts`,
        icon: Pencil,
      },
      {
        /* Inside the v2 shell, so navigating here keeps this sidebar. */
        title: t('nav.archives', 'Archives'),
        url: `${base}/archives`,
        icon: Archive,
      },
      {
        /* Inside the v2 shell, so navigating here keeps this sidebar. */
        title: t('nav.settings', 'Settings'),
        url: `${base}/settings`,
        icon: Settings,
      },
    ],
  };
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { t } = useTranslation();
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const { pathname } = useLocation();
  const { user } = useAuth();

  const base = workspaceSlug ? `/${workspaceSlug}` : '';
  /* Re-read on every navigation: the views page writes this as the reader moves
     between views, and the entry should point at the latest one. */
  const lastViewId = React.useMemo(
    () => readLastWorkspaceView(workspaceSlug),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the path is what changes the stored value, not an input to reading it
    [workspaceSlug, pathname],
  );
  const data = buildData(
    base,
    user ? { id: user.id, name: user.name, email: user.email, avatar: user.avatarUrl ?? '' } : null,
    t,
    lastViewId,
  );

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href={base || '/'}>
                {/* No tile behind the mark: bg-sidebar-primary resolves to blue
                    in dark mode, which would tint the logo's surround. The
                    white-on-transparent file is used as a mask only — the
                    dither samples its alpha and paints particles in
                    currentColor, so one file covers both themes. */}
                <div className="flex aspect-square size-8 items-center justify-center">
                  <DitheredLogo
                    imageSrc="/devlane-2-dark-no-bg.png"
                    className="size-8 text-sidebar-foreground"
                    gridSize={96}
                    scale={0.95}
                    blur={1.6}
                    threshold={128}
                    invert={false}
                  />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Devlane</span>
                  <span className="truncate text-xs">{workspaceSlug ?? ''}</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.primaryNav} />
        <NavMain items={data.workspaceNav} label={t('nav.section.workspace', 'Workspace')} />
        {workspaceSlug ? (
          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <SidebarGroupLabel>{t('nav.section.favorites', 'Favorites')}</SidebarGroupLabel>
            <SidebarGroupContent>
              <WorkspaceFavoritesTree workspaceSlug={workspaceSlug} baseUrl={`${base}`} />
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
        <NavProjects />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  );
}
