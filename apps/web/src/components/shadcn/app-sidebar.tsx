'use client';

import * as React from 'react';
import { useParams } from 'react-router-dom';
import { Archive, BarChart3, Layers, LayoutGrid, Settings2, SquareTerminal } from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import { NavMain } from '@/components/shadcn/nav-main';
import { NavProjects } from '@/components/shadcn/nav-projects';
import { NavSecondary } from '@/components/shadcn/nav-secondary';
import { NavUser } from '@/components/shadcn/nav-user';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
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
    navMain: [
      {
        /* Inside the preview shell, so navigating here keeps this sidebar. */
        title: 'Home',
        url: base ? `${base}/app-v2` : '/',
        icon: SquareTerminal,
        isActive: true,
        items: [
          /* Inside the preview shell, so navigating here keeps this sidebar. */
          { title: 'Inbox', url: `${base}/app-v2/notifications` },
          {
            title: 'Your work',
            url: user ? `${base}/app-v2/profile/${user.id}` : `${base}/app-v2`,
          },
          /* Inside the preview shell, so navigating here keeps this sidebar. */
          { title: 'Drafts', url: `${base}/app-v2/drafts` },
        ],
      },
      {
        /* Inside the preview shell, so navigating here keeps this sidebar. */
        title: 'Projects',
        url: `${base}/app-v2/projects`,
        icon: LayoutGrid,
        items: [
          { title: 'All projects', url: `${base}/app-v2/projects` },
          { title: 'Project settings', url: `${base}/settings/projects` },
        ],
      },
      {
        /* Inside the preview shell, so navigating here keeps this sidebar. */
        title: 'Analytics',
        url: `${base}/app-v2/analytics/overview`,
        icon: BarChart3,
        items: [
          { title: 'Overview', url: `${base}/app-v2/analytics/overview` },
          { title: 'Work items', url: `${base}/app-v2/analytics/work-items` },
        ],
      },
      {
        title: 'Settings',
        url: `${base}/settings`,
        icon: Settings2,
        items: [
          { title: 'Account', url: `${base}/settings/account` },
          { title: 'Projects', url: `${base}/settings/projects` },
        ],
      },
    ],
    navSecondary: [
      /* Inside the preview shell, so navigating here keeps this sidebar. */
      { title: 'Views', url: `${base}/app-v2/views/all-issues`, icon: Layers },
      { title: 'Archives', url: `${base}/app-v2/archives`, icon: Archive },
    ],
  };
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
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
        <NavMain items={data.navMain} />
        <NavProjects />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  );
}
