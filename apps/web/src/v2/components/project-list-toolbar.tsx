import { useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { Button } from '@/v2/components/ui/button';
import { Input } from '@/v2/components/ui/input';

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
 * The chrome is the work items toolbar's, to the pixel — same padding, gap,
 * control heights and growing search field — so moving between work items,
 * epics, cycles, modules, views, pages and intake never resizes the bar. It
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
    /* One wrapping row of controls, matching the work items toolbar exactly:
       same padding, same 8px gap, same search field that grows into whatever
       space the controls leave. Every v2 list then measures the same. */
    <div
      className="bg-card/50 flex flex-wrap items-center gap-2 rounded-xl border p-3 shadow-xs sm:p-4"
      role="region"
      aria-label={regionLabel}
    >
      {/* Last on a phone, where a full-width field under the controls beats a
          squeezed one beside them; first again from `sm` up. */}
      <div className="relative order-last w-full min-w-0 sm:order-none sm:w-64 sm:flex-1">
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

      {/* The scope switch sits where the work items layout toggle does — after
          the search, before the menus. */}
      {scopeControl}
      {filters}
      {actions}

      {/* `empty:hidden` so a chips row that renders nothing — no filter is set —
          does not leave the row's 8px gap behind it. */}
      {chips && <div className="order-last w-full empty:hidden">{chips}</div>}
    </div>
  );
}
