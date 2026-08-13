import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { BadgeCheck, Bell, ChevronsUpDown, LogOut, UserRound } from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/shadcn/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/shadcn/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/shadcn/ui/sidebar';

export function NavUser({
  user,
}: {
  user: {
    name: string;
    email: string;
    avatar: string;
  };
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const { isMobile } = useSidebar();
  const { user: currentUser, logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const base = workspaceSlug ? `/${workspaceSlug}` : '';
  /* All three have v2 pages, so every item stays inside this shell. */
  const profileHref = currentUser ? `${base}/app-v2/profile/${currentUser.id}` : null;
  const notificationsHref = `${base}/app-v2/notifications`;
  const accountHref = workspaceSlug ? `${base}/app-v2/settings/account` : null;

  /* The session is cleared either way — signOut failing server-side still drops
     the local user — so the redirect runs even on a rejected request. It goes to
     the v2 login rather than letting ProtectedRoute fall back to the shipped
     one, keeping the preview on its own surface. */
  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logout();
    } catch {
      toast.error(t('nav.signOutFailed', 'Signed out locally, but the server was not reached.'));
    } finally {
      setSigningOut(false);
      navigate('/login-v2', { replace: true });
    }
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-lg text-foreground">CN</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="rounded-lg text-foreground">CN</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {/* The block ships "Upgrade to Pro" and "Billing" as well; Devlane
                is self-hosted and has neither, so the menu carries only the
                entries that lead somewhere. */}
            <DropdownMenuGroup>
              {profileHref && (
                <DropdownMenuItem asChild>
                  <Link to={profileHref}>
                    <UserRound />
                    {t('nav.yourWork', 'Your work')}
                  </Link>
                </DropdownMenuItem>
              )}
              {accountHref && (
                <DropdownMenuItem asChild>
                  <Link to={accountHref}>
                    <BadgeCheck />
                    {t('nav.account', 'Account')}
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <Link to={notificationsHref}>
                  <Bell />
                  {t('nav.notifications', 'Notifications')}
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={signingOut}
              onSelect={(event) => {
                /* Kept open until the request settles, so the disabled item is
                   the feedback that something is happening. */
                event.preventDefault();
                void signOut();
              }}
            >
              <LogOut />
              {signingOut ? t('nav.signingOut', 'Signing out…') : t('nav.signOut', 'Sign out')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
