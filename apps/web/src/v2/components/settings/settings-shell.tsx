import type { ComponentType, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { LucideProps } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageHeading } from '@/v2/components/page-heading';
import { Separator } from '@/v2/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/v2/components/ui/select';

export interface SettingsTab {
  id: string;
  label: string;
  to: string;
}

export interface SettingsSectionItem<T extends string = string> {
  id: T;
  label: string;
  icon: ComponentType<LucideProps>;
}

export interface SettingsSectionGroup<T extends string = string> {
  /** Group heading; omitted for a single ungrouped list. */
  label?: string;
  items: SettingsSectionItem<T>[];
}

interface SettingsShellProps<T extends string> {
  title: ReactNode;
  description: ReactNode;
  /** Scope switcher (Account / Workspace / Projects). Omitted inside a project. */
  tabs?: SettingsTab[];
  activeTabId?: string;
  groups: SettingsSectionGroup<T>[];
  activeSection: T;
  onSectionChange: (section: T) => void;
  /** Rendered above the section nav — the projects scope puts its picker here. */
  aside?: ReactNode;
  children: ReactNode;
}

/**
 * Shared chrome for every v2 settings screen: the scope tabs, the section nav,
 * and the panel column. The three scopes differ only in what they pass in, so
 * the nav behaviour (sticky column on desktop, a select on small screens) is
 * written once here rather than per page.
 */
export function SettingsShell<T extends string>({
  title,
  description,
  tabs,
  activeTabId,
  groups,
  activeSection,
  onSectionChange,
  aside,
  children,
}: SettingsShellProps<T>) {
  const { t } = useTranslation();
  const allItems = groups.flatMap((g) => g.items);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6">
      <PageHeading title={title} description={description} />

      {tabs && tabs.length > 0 && (
        <nav
          aria-label={t('settings.scopeNavLabel', 'Settings scope')}
          className="border-border -mb-px flex gap-1 border-b"
        >
          {tabs.map((tab) => {
            const active = tab.id === activeTabId;
            return (
              <Link
                key={tab.id}
                to={tab.to}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'focus-visible:ring-ring rounded-t-sm border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none',
                  active
                    ? 'border-primary text-foreground'
                    : 'text-muted-foreground hover:text-foreground border-transparent',
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      )}

      <div className="flex min-w-0 flex-col gap-6 lg:flex-row lg:gap-8">
        <div className="lg:w-56 lg:shrink-0">
          <div className="flex flex-col gap-4 lg:sticky lg:top-4">
            {aside}

            {/* Small screens get a select: a 8-item vertical nav would push the
                panel below the fold on a phone. */}
            <div className="lg:hidden">
              <Select value={activeSection} onValueChange={(value) => onSectionChange(value as T)}>
                <SelectTrigger className="w-full" aria-label={t('settings.section', 'Section')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <nav
              aria-label={t('settings.sectionNavLabel', 'Settings sections')}
              className="hidden flex-col gap-4 lg:flex"
            >
              {groups.map((group, index) => (
                <div key={group.label ?? index} className="flex flex-col gap-1">
                  {group.label && (
                    <p className="text-muted-foreground px-2 text-xs font-medium tracking-wide uppercase">
                      {group.label}
                    </p>
                  )}
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = item.id === activeSection;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSectionChange(item.id)}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'focus-visible:ring-ring flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none',
                          active
                            ? 'bg-accent text-accent-foreground font-medium'
                            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                        )}
                      >
                        <Icon className="size-4 shrink-0" aria-hidden />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </nav>
          </div>
        </div>

        <Separator orientation="vertical" className="hidden lg:block" />

        <main className="min-w-0 flex-1 pb-10">{children}</main>
      </div>
    </div>
  );
}
