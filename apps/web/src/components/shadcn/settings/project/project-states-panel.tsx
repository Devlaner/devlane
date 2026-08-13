import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownIcon, ArrowUpIcon, PlusIcon } from 'lucide-react';
import { Badge } from '@/components/shadcn/ui/badge';
import { Button } from '@/components/shadcn/ui/button';
import { Skeleton } from '@/components/shadcn/ui/skeleton';
import { SettingsPanel } from '@/components/shadcn/settings/settings-panel';
import {
  ProjectItemDialog,
  type ProjectItemValues,
} from '@/components/shadcn/settings/project/project-item-dialog';
import { stateService } from '../../../../services/stateService';
import type { StateApiResponse } from '../../../../api/types';

interface ProjectStatesPanelProps {
  workspaceSlug: string;
  projectId: string;
}

const GROUP_ORDER = ['backlog', 'unstarted', 'started', 'completed', 'cancelled'];
const DEFAULT_STATE_COLOR = '#94a3b8';

/** Workflow states grouped by their state group, ordered within each group. */
export function ProjectStatesPanel({ workspaceSlug, projectId }: ProjectStatesPanelProps) {
  const { t } = useTranslation();
  const [states, setStates] = useState<StateApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StateApiResponse | null>(null);
  const [initial, setInitial] = useState<ProjectItemValues>({
    name: '',
    color: DEFAULT_STATE_COLOR,
    group: 'backlog',
  });

  const refresh = useCallback(async () => {
    setStates((await stateService.list(workspaceSlug, projectId)) ?? []);
  }, [workspaceSlug, projectId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    stateService
      .list(workspaceSlug, projectId)
      .then((list) => {
        if (!cancelled) setStates(list ?? []);
      })
      .catch(() => {
        if (!cancelled) setStates([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId]);

  const grouped = useMemo(() => {
    const byGroup = states.reduce<Record<string, StateApiResponse[]>>((acc, state) => {
      const key = (state.group ?? 'backlog').toLowerCase();
      (acc[key] ??= []).push(state);
      return acc;
    }, {});
    for (const list of Object.values(byGroup)) {
      list.sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
    }
    return [...new Set([...GROUP_ORDER, ...Object.keys(byGroup)])].map((group) => ({
      group,
      states: byGroup[group] ?? [],
    }));
  }, [states]);

  /* Reordering rewrites the whole group's sequences in one call, so the order is
     well-defined even when states share the default sequence value. */
  const move = async (state: StateApiResponse, direction: -1 | 1) => {
    const key = (state.group ?? 'backlog').toLowerCase();
    const inGroup = grouped.find((g) => g.group === key)?.states ?? [];
    const from = inGroup.findIndex((s) => s.id === state.id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= inGroup.length) return;
    const reordered = [...inGroup];
    [reordered[from], reordered[to]] = [reordered[to], reordered[from]];
    try {
      await stateService.reorder(
        workspaceSlug,
        projectId,
        reordered.map((s, index) => ({ id: s.id, sequence: index })),
      );
      await refresh();
    } catch {
      /* The list stays as-is on failure. */
    }
  };

  const openAdd = () => {
    setEditing(null);
    setInitial({ name: '', color: DEFAULT_STATE_COLOR, group: 'backlog' });
    setDialogOpen(true);
  };

  const openEdit = (state: StateApiResponse) => {
    setEditing(state);
    setInitial({
      name: state.name,
      color: state.color ?? DEFAULT_STATE_COLOR,
      group: (state.group ?? 'backlog').toLowerCase(),
    });
    setDialogOpen(true);
  };

  return (
    <SettingsPanel
      title={t('settings.states.title', 'States')}
      description={t(
        'settings.states.subtitle',
        'Define and customize workflow states to track the progress of your work items.',
      )}
      actions={
        <Button size="sm" onClick={openAdd}>
          <PlusIcon />
          {t('settings.states.add', 'Add state')}
        </Button>
      }
    >
      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        grouped.map(({ group, states: groupStates }) => (
          <div key={group} className="flex flex-col gap-2">
            <h3 className="text-muted-foreground text-sm font-medium capitalize">{group}</h3>
            {groupStates.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {t('settings.states.emptyGroup', 'No states in this group.')}
              </p>
            ) : (
              groupStates.map((state, index) => (
                <div
                  key={state.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: state.color ?? DEFAULT_STATE_COLOR }}
                      aria-hidden
                    />
                    <span className="truncate text-sm font-medium">{state.name}</span>
                    {state.default && (
                      <Badge variant="secondary">{t('settings.states.default', 'Default')}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={index === 0}
                      onClick={() => void move(state, -1)}
                      aria-label={t('settings.states.moveUp', 'Move {{name}} up', {
                        name: state.name,
                      })}
                    >
                      <ArrowUpIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={index === groupStates.length - 1}
                      onClick={() => void move(state, 1)}
                      aria-label={t('settings.states.moveDown', 'Move {{name}} down', {
                        name: state.name,
                      })}
                    >
                      <ArrowDownIcon />
                    </Button>
                    {!state.default && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {
                            await stateService.update(workspaceSlug, projectId, state.id, {
                              default: true,
                            });
                            await refresh();
                          } catch {
                            /* The list stays as-is on failure. */
                          }
                        }}
                      >
                        {t('settings.states.setDefault', 'Set default')}
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => openEdit(state)}>
                      {t('common.edit', 'Edit')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={async () => {
                        try {
                          await stateService.delete(workspaceSlug, projectId, state.id);
                          await refresh();
                        } catch {
                          /* The list stays as-is on failure. */
                        }
                      }}
                    >
                      {t('common.delete', 'Delete')}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        ))
      )}

      <ProjectItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        withGroup
        editing={editing !== null}
        initial={initial}
        title={
          editing
            ? t('settings.states.editTitle', 'Edit state')
            : t('settings.states.addTitle', 'Add state')
        }
        namePlaceholder={t('settings.states.namePlaceholder', 'e.g. In Progress')}
        onSubmit={async (values) => {
          if (editing) {
            await stateService.update(workspaceSlug, projectId, editing.id, values);
          } else {
            await stateService.create(workspaceSlug, projectId, values);
          }
          await refresh();
        }}
      />
    </SettingsPanel>
  );
}
