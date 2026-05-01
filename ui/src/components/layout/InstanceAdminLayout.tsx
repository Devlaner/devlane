import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';

const IconGlobe = () => (
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
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
    <path d="M2 12h20" />
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
const IconEnvelope = () => (
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
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);
const IconLock = () => (
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
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const IconCpu = () => (
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
    <rect width="16" height="16" x="4" y="4" rx="2" ry="2" />
    <rect width="6" height="6" x="9" y="9" rx="1" />
    <path d="M15 2v2" />
    <path d="M15 20v2" />
    <path d="M2 15h2" />
    <path d="M2 9h2" />
    <path d="M20 15h2" />
    <path d="M20 9h2" />
    <path d="M9 2v2" />
    <path d="M9 20v2" />
  </svg>
);
const IconImage = () => (
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
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
  </svg>
);
const IconPlug = () => (
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
    <path d="M9 2v6" />
    <path d="M15 2v6" />
    <path d="M6 8h12v4a6 6 0 1 1-12 0V8Z" />
    <path d="M12 18v4" />
  </svg>
);
const IconExternalLink = () => (
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
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);
const IconHelp = () => (
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
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <path d="M12 17h.01" />
  </svg>
);
const IconArrowLeft = () => (
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
    <path d="m12 19-7-7 7-7" />
    <path d="M19 12H5" />
  </svg>
);

const SECTIONS = [
  {
    path: 'general',
    label: 'General',
    desc: 'Identify your instances and get key details.',
    Icon: IconSettings,
  },
  {
    path: 'workspace',
    label: 'Workspaces',
    desc: 'Manage all workspaces on this instance.',
    Icon: IconBriefcase,
  },
  {
    path: 'email',
    label: 'Email',
    desc: 'Configure your SMTP controls.',
    Icon: IconEnvelope,
  },
  {
    path: 'authentication',
    label: 'Authentication',
    desc: 'Configure authentication modes.',
    Icon: IconLock,
  },
  {
    path: 'ai',
    label: 'Artificial intelligence',
    desc: 'Configure your OpenAI creds.',
    Icon: IconCpu,
  },
  {
    path: 'image',
    label: 'Images in Devlane',
    desc: 'Allow third-party image libraries.',
    Icon: IconImage,
  },
  {
    path: 'integrations',
    label: 'Integrations',
    desc: 'Configure GitHub and other integrations.',
    Icon: IconPlug,
  },
] as const;

const BREADCRUMB_LABEL: Record<string, string> = {
  general: 'General',
  workspace: 'Workspace',
  email: 'Email',
  authentication: 'Authentication',
  ai: 'Artificial Intelligence',
  image: 'Image',
  integrations: 'Integrations',
};

const AUTH_SUB_LABEL: Record<string, string> = {
  google: 'Google',
  github: 'GitHub',
  gitlab: 'GitLab',
};

const INTEGRATIONS_SUB_LABEL: Record<string, string> = {
  github: 'GitHub',
};

export function InstanceAdminLayout() {
  const location = useLocation();
  const pathname = location.pathname;
  const basePath = '/instance-admin';
  const segments = pathname.replace(basePath, '').replace(/^\//, '').split('/').filter(Boolean);
  const segment = segments[0] || 'general';
  const breadcrumbLabel = BREADCRUMB_LABEL[segment] ?? 'General';
  const subKey = segments[1] ?? '';
  let breadcrumbTail: string | null = null;
  if (subKey === 'create') {
    breadcrumbTail = 'Create';
  } else if (segment === 'integrations') {
    breadcrumbTail = INTEGRATIONS_SUB_LABEL[subKey] ?? null;
  } else if (segment === 'authentication') {
    breadcrumbTail = AUTH_SUB_LABEL[subKey] ?? null;
  } else {
    breadcrumbTail = AUTH_SUB_LABEL[subKey] ?? null;
  }

  return (
    <div className="flex h-screen flex-col bg-(--bg-canvas)">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="flex w-72 shrink-0 flex-col border-r border-(--border-subtle) bg-(--bg-surface-1)">
          <div className="shrink-0 border-b border-(--border-subtle) px-3 py-3">
            <div className="flex items-center gap-2 text-sm font-medium text-(--txt-primary)">
              <span className="flex size-7 items-center justify-center rounded-md bg-(--bg-layer-2) text-(--txt-icon-secondary)">
                <IconGlobe />
              </span>
              Instance admin
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto p-1.5">
            {SECTIONS.map(({ path, label, desc, Icon }) => {
              const to = `${basePath}/${path}`;
              return (
                <NavLink
                  key={path}
                  to={to}
                  className={({ isActive }) =>
                    `mb-0.5 flex gap-2 rounded-md px-2.5 py-2 text-left no-underline transition-colors ${
                      isActive
                        ? 'bg-(--bg-accent-subtle) text-(--txt-accent-primary)'
                        : 'text-(--txt-secondary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)'
                    }`
                  }
                >
                  <span className="mt-px shrink-0 text-(--txt-icon-secondary) [&_svg]:size-4">
                    <Icon />
                  </span>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <div className="text-sm font-medium">{label}</div>
                    <div className="truncate text-[10px] leading-tight text-(--txt-tertiary)">
                      {desc}
                    </div>
                  </div>
                </NavLink>
              );
            })}
          </nav>
          <div className="flex shrink-0 flex-col gap-0.5 border-t border-(--border-subtle) p-1.5">
            <a
              href="http://localhost:5173"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-(--txt-secondary) no-underline hover:bg-(--bg-layer-1-hover) hover:text-(--txt-primary)"
            >
              <IconExternalLink />
              Redirect to Devlane
            </a>
            <div className="flex gap-0.5">
              <button
                type="button"
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary) [&_svg]:size-4"
                aria-label="Help"
              >
                <IconHelp />
              </button>
              <Link
                to="/acme"
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary) [&_svg]:size-4"
                aria-label="Back"
              >
                <IconArrowLeft />
              </Link>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1 overflow-auto p-5">
          <div className="mb-4 flex items-center gap-1.5 text-xs text-(--txt-secondary) [&_svg]:size-3.5">
            <IconSettings />
            <span>Settings</span>
            <span className="text-(--txt-icon-tertiary)">&gt;</span>
            <span className="text-(--txt-primary)">{breadcrumbLabel}</span>
            {breadcrumbTail && (
              <>
                <span className="text-(--txt-icon-tertiary)">&gt;</span>
                <span className="text-(--txt-primary)">{breadcrumbTail}</span>
              </>
            )}
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
