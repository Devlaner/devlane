import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Input } from '@/components/shadcn/ui/input';

/**
 * The search field the simpler v2 project pages share — epics, cycles, modules,
 * views, pages and intake all filter on one string and nothing else.
 *
 * It writes `?q=`, which those pages read, so the toolbar can live in the
 * shell's header without a context linking it to the page below.
 */
export function ProjectSearchToolbar({ placeholder }: { placeholder?: string }) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';

  return (
    <div className="ml-auto flex items-center gap-1 pr-4">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => {
            const value = e.target.value;
            setSearchParams(
              (prev) => {
                const next = new URLSearchParams(prev);
                if (value) next.set('q', value);
                else next.delete('q');
                return next;
              },
              { replace: true },
            );
          }}
          placeholder={placeholder ?? t('common.search', 'Search')}
          aria-label={t('common.search', 'Search')}
          className="h-8 w-56 pl-8"
        />
      </div>
    </div>
  );
}
