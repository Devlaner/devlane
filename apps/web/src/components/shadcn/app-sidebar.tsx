'use client';

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
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
import { NavMain } from '@/components/shadcn/nav-main';
import { NavProjects } from '@/components/shadcn/nav-projects';
import { NavUser } from '@/components/shadcn/nav-user';
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
} from '@/components/shadcn/ui/sidebar';

/* The block's sample data, replaced with Devlane's own pages. Every url is a
   real route. The projects group is not built here — NavProjects loads the
   workspace's real projects itself. */
function buildData(
  base: string,
  user: { name: string; email: string; avatar: string; id: string } | null,
) {
  return {
    user: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      avatar: user?.avatar ?? '',
    },
    primaryNav: [
      {
        /* Inside the preview shell, so navigating here keeps this sidebar. */
        title: 'Home',
        url: base ? `${base}/app-v2` : '/',
        icon: House,
      },
      {
        /* Inside the preview shell, so navigating here keeps this sidebar. */
        title: 'Inbox',
        url: `${base}/app-v2/notifications`,
        icon: Inbox,
      },
      {
        title: 'Your work',
        url: user ? `${base}/app-v2/profile/${user.id}` : `${base}/app-v2`,
        icon: UserRound,
      },
    ],
    workspaceNav: [
      {
        /* Inside the preview shell, so navigating here keeps this sidebar. */
        title: 'Projects',
        url: `${base}/app-v2/projects`,
        icon: LayoutGrid,
      },
      {
        /* Inside the preview shell, so navigating here keeps this sidebar. */
        title: 'Views',
        url: `${base}/app-v2/views/all-issues`,
        icon: Layers,
      },
      {
        /* Inside the preview shell, so navigating here keeps this sidebar. */
        title: 'Analytics',
        url: `${base}/app-v2/analytics/overview`,
        icon: BarChart3,
      },
      {
        /* Inside the preview shell, so navigating here keeps this sidebar. */
        title: 'Drafts',
        url: `${base}/app-v2/drafts`,
        icon: Pencil,
      },
      {
        /* Inside the preview shell, so navigating here keeps this sidebar. */
        title: 'Archives',
        url: `${base}/app-v2/archives`,
        icon: Archive,
      },
      {
        /* Inside the preview shell, so navigating here keeps this sidebar. */
        title: 'Settings',
        url: `${base}/app-v2/settings`,
        icon: Settings,
      },
    ],
  };
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { t } = useTranslation();
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const { user } = useAuth();

  const base = workspaceSlug ? `/${workspaceSlug}` : '';
  const data = buildData(
    base,
    user ? { id: user.id, name: user.name, email: user.email, avatar: user.avatarUrl ?? '' } : null,
  );

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href={base || '/'}>
                {/* No tile behind the mark: bg-sidebar-primary resolves to blue
                    in dark mode, which would tint the logo's surround. Two
                    files rather than one, because each is a flat silhouette
                    that only reads against the opposite background. */}
                <div className="flex aspect-square size-8 items-center justify-center">
                  <img
                    src="/devlane-2-light-no-bg.png"
                    alt=""
                    className="size-6 object-contain dark:hidden"
                  />
                  <img
                    src="/devlane-2-dark-no-bg.png"
                    alt=""
                    className="hidden size-6 object-contain dark:block"
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
              <WorkspaceFavoritesTree workspaceSlug={workspaceSlug} baseUrl={`${base}/app-v2`} />
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
