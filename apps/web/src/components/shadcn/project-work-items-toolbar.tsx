import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Filter, Plus, Search, X } from 'lucide-react';
import { Badge } from '@/components/shadcn/ui/badge';
import { Button } from '@/components/shadcn/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/shadcn/ui/dropdown-menu';
import { Input } from '@/components/shadcn/ui/input';
import { stateService } from '../../services/stateService';
import { PRIORITIES, PRIORITY_LABELS } from '../../lib/projectV2';
import type { StateApiResponse } from '../../api/types';

/**
 * Search, filters and the create button for the v2 project work item list.
 *
 * State lives in the query string rather than a context: the toolbar sits in
 * the shell's header while the page renders below it, and a shareable URL is
 * worth more here than the extra provider would be. The create button follows
 * the same rule — it sets `?create=1`, and the page owns the composer, since
 * the page already holds the project and state data the dialog needs.
 */
export function ProjectWorkItemsToolbar({
  workspaceSlug,
  projectId,
}: {
  workspaceSlug: string;
  projectId: string;
}) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [states, setStates] = useState<StateApiResponse[]>([]);

  useEffect(() => {
    let cancelled = false;
    stateService
      .list(workspaceSlug, projectId)
      .then((list) => {
        if (!cancelled) setStates(list ?? []);
      })
      .catch(() => {
        /* The state filter just stays empty. */
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId]);

  const query = searchParams.get('q') ?? '';
  const selectedStates = (searchParams.get('state') ?? '').split(',').filter(Boolean);
  const selectedPriorities = (searchParams.get('priority') ?? '').split(',').filter(Boolean);
  const activeFilterCount = selectedStates.length + selectedPriorities.length;

  /** Writes one key, dropping it entirely when the value empties. */
  const setParam = (key: string, value: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  };

  const toggleInParam = (key: string, value: string, current: string[]) => {
    const next = current.includes(value)
      ? current.filter((entry) => entry !== value)
      : [...current, value];
    setParam(key, next.join(','));
  };

  return (
    <div className="ml-auto flex items-center gap-1 pr-4">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => setParam('q', e.target.value)}
          placeholder={t('common.search', 'Search')}
          aria-label={t('common.search', 'Search')}
          className="h-8 w-48 pl-8"
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="sm" variant="ghost">
            <Filter />
            {t('common.filters', 'Filters')}
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-[70vh] w-56 overflow-y-auto">
          <DropdownMenuLabel>{t('views.state', 'State')}</DropdownMenuLabel>
          {states.length === 0 ? (
            <DropdownMenuItem disabled>{t('common.none', 'None')}</DropdownMenuItem>
          ) : (
            states.map((state) => (
              <DropdownMenuCheckboxItem
                key={state.id}
                checked={selectedStates.includes(state.id)}
                onCheckedChange={() => toggleInParam('state', state.id, selectedStates)}
              >
                {state.name}
              </DropdownMenuCheckboxItem>
            ))
          )}

          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t('views.priority', 'Priority')}</DropdownMenuLabel>
          {PRIORITIES.map((priority) => (
            <DropdownMenuCheckboxItem
              key={priority}
              checked={selectedPriorities.includes(priority)}
              onCheckedChange={() => toggleInParam('priority', priority, selectedPriorities)}
            >
              {PRIORITY_LABELS[priority]}
            </DropdownMenuCheckboxItem>
          ))}

          {activeFilterCount > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  setParam('state', '');
                  setParam('priority', '');
                }}
              >
                <X />
                {t('common.clearFilters', 'Clear filters')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button type="button" size="sm" onClick={() => setParam('create', '1')}>
        <Plus />
        {t('issues.create', 'New work item')}
      </Button>
    </div>
  );
}
