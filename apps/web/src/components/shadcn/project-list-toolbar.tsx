import { useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/shadcn/ui/button';
import { Input } from '@/components/shadcn/ui/input';

interface ProjectListToolbarProps {
  /** Names the search field and its clear button. */
  searchPlaceholder: string;
  /** Names the toolbar region for assistive technology. */
  regionLabel: string;
  /** Tabs or a segmented control naming which list is shown. */
  scopeControl?: ReactNode;
  /** Filter menus, rendered next to the search field. */
  filters?: ReactNode;
  /** Primary actions — creating the thing the list holds. */
  actions?: ReactNode;
  /** Active filter chips, shown on their own row under the controls. */
  chips?: ReactNode;
  /** Controlled search value. Omit to read and write the URL's `?q=`. */
  value?: string;
  onValueChange?: (value: string) => void;
}

/**
 * The discovery controls the v2 project list pages share — epics, cycles,
 * modules, views, pages and intake all narrow one list by a single string, and
 * some of them add a scope control or a filter menu on top.
 *
 * The chrome deliberately mirrors ViewsToolbar and ArchivesToolbar: scope comes
 * first, search and filters wrap below it on narrow screens, and the toolbar
 * lives in the page body rather than the 64px shell header, where the controls
 * would compete with the breadcrumb.
 *
 * Search is URL-backed by default (`?q=`), so a narrowed list survives a reload
 * and can be shared. Pages whose search already lives in a controller pass
 * `value`/`onValueChange` instead.
 */
export function ProjectListToolbar({
  searchPlaceholder,
  regionLabel,
  scopeControl,
  filters,
  actions,
  chips,
  value,
  onValueChange,
}: ProjectListToolbarProps) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const controlled = value !== undefined;
  const query = controlled ? value : (searchParams.get('q') ?? '');

  const setQuery = (next: string) => {
    if (controlled) {
      onValueChange?.(next);
      return;
    }
    const params = new URLSearchParams(searchParams);
    if (next) params.set('q', next);
    else params.delete('q');
    setSearchParams(params, { replace: true });
  };

  return (
    <div
      className="bg-card/50 space-y-3 rounded-xl border p-3 shadow-xs sm:p-4"
      role="region"
      aria-label={regionLabel}
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        {scopeControl}

        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex sm:flex-wrap sm:items-center xl:ml-auto">
          <div className="relative min-w-0 sm:w-72">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <Input
              ref={searchInputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="h-11 pr-12 pl-10 sm:h-9"
            />
            {query && (
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={() => {
                  setQuery('');
                  requestAnimationFrame(() => searchInputRef.current?.focus());
                }}
                aria-label={t('common.clearSearch', 'Clear search')}
                className="absolute top-1/2 right-1 size-10 -translate-y-1/2 sm:size-8"
              >
                <X aria-hidden="true" />
              </Button>
            )}
          </div>

          {filters}
          {actions}
        </div>
      </div>

      {chips}
    </div>
  );
}
