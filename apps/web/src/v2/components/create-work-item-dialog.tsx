import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CalendarDays,
  Check,
  ChevronsUpDown,
  FolderKanban,
  Layers,
  Link2,
  LoaderCircle,
  Plus,
  Signal,
  Tag,
  User,
  X,
} from 'lucide-react';
import { Button } from '@/v2/components/ui/button';
import { Checkbox } from '@/v2/components/ui/checkbox';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/v2/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/v2/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/v2/components/ui/dropdown-menu';
import { Input } from '@/v2/components/ui/input';
import { Label } from '@/v2/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/v2/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/v2/components/ui/select';
import { Textarea } from '@/v2/components/ui/textarea';
import type {
  CycleApiResponse,
  IssueApiResponse,
  LabelApiResponse,
  ModuleApiResponse,
  ProjectApiResponse,
  StateApiResponse,
} from '../../api/types';
import { cycleService } from '../../services/cycleService';
import { issueService } from '../../services/issueService';
import { labelService } from '../../services/labelService';
import { moduleService } from '../../services/moduleService';
import { stateService } from '../../services/stateService';
import { workspaceService } from '../../services/workspaceService';
import type { Priority } from '../../types';
import type { WorkItemInitialValues } from '../../components/CreateWorkItemModal';

const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low', 'none'];
const EMPTY_VALUE = '__none__';

/** What a submitted form hands back — the same shape as the legacy composer. */
export interface CreateWorkItemDialogSubmit {
  title: string;
  description: string;
  projectId: string;
  stateId?: string;
  priority?: Priority;
  assigneeId?: string | null;
  assigneeIds?: string[];
  labelIds?: string[];
  startDate?: string;
  dueDate?: string;
  cycleId?: string | null;
  moduleId?: string | null;
  parentId?: string | null;
  isDraft?: boolean;
}

export interface CreateWorkItemDialogProps {
  open: boolean;
  onClose: () => void;
  workspaceSlug: string;
  projects: ProjectApiResponse[];
  defaultProjectId?: string;
  defaultModuleId?: string | null;
  createError?: string | null;
  /** Pre-fill the form (used by the edit and duplicate flows). */
  initialValues?: WorkItemInitialValues;
  /** Drafts flow: draft-specific copy, and `onSave` receives `isDraft: true`. */
  draftOnly?: boolean;
  onSave?: (data: CreateWorkItemDialogSubmit) => void | Promise<void>;
}

export function CreateWorkItemDialog({
  open,
  onClose,
  workspaceSlug,
  projects,
  defaultProjectId,
  defaultModuleId,
  createError,
  initialValues,
  draftOnly = false,
  onSave,
}: CreateWorkItemDialogProps) {
  const { t } = useTranslation();
  const titleInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState(defaultProjectId ?? projects[0]?.id ?? '');
  const [stateId, setStateId] = useState('');
  const [priority, setPriority] = useState<Priority>('none');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [cycleId, setCycleId] = useState<string | null>(null);
  const [moduleId, setModuleId] = useState<string | null>(defaultModuleId ?? null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [createMore, setCreateMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [states, setStates] = useState<StateApiResponse[]>([]);
  const [labels, setLabels] = useState<LabelApiResponse[]>([]);
  const [cycles, setCycles] = useState<CycleApiResponse[]>([]);
  const [modules, setModules] = useState<ModuleApiResponse[]>([]);
  const [issues, setIssues] = useState<IssueApiResponse[]>([]);
  const [members, setMembers] = useState<Array<{ id: string; name: string }>>([]);

  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [labelSearch, setLabelSearch] = useState('');
  const [labelMenuOpen, setLabelMenuOpen] = useState(false);
  const [parentPickerOpen, setParentPickerOpen] = useState(false);
  const [createLabelLoading, setCreateLabelLoading] = useState(false);
  const [createLabelError, setCreateLabelError] = useState<string | null>(null);

  const selectedProject = projects.find((project) => project.id === projectId);
  const showModules = selectedProject?.module_view ?? true;
  const showCycles = selectedProject?.cycle_view ?? true;

  /* Seed only when a composer flow opens (or switches from one edit target to
     another). Project-dependent fields must not be cleared as a side effect of
     this initial seed. */
  const seedRef = useRef({ defaultProjectId, defaultModuleId, projects });
  seedRef.current = { defaultProjectId, defaultModuleId, projects };
  useEffect(() => {
    if (!open) return;
    const seed = seedRef.current;
    const iv = initialValues;
    setProjectId(iv?.projectId ?? seed.defaultProjectId ?? seed.projects[0]?.id ?? '');
    setTitle(iv?.title ?? '');
    setDescription(iv?.description ?? '');
    setStateId(iv?.stateId ?? '');
    setPriority(iv?.priority ?? 'none');
    setAssigneeIds(iv?.assigneeIds ?? []);
    setLabelIds(iv?.labelIds ?? []);
    setStartDate(iv?.startDate ?? '');
    setDueDate(iv?.dueDate ?? '');
    setCycleId(iv?.cycleId ?? null);
    setModuleId(iv?.moduleId ?? seed.defaultModuleId ?? null);
    setParentId(iv?.parentId ?? null);
    setCreateMore(false);
    setAssigneeSearch('');
    setLabelSearch('');
    setCreateLabelError(null);
    setLabelMenuOpen(false);
    setParentPickerOpen(false);
  }, [open, initialValues]);

  /* Every option in this group belongs to the selected project, including the
     available parent work items. */
  useEffect(() => {
    if (!open || !workspaceSlug || !projectId) {
      setStates([]);
      setLabels([]);
      setCycles([]);
      setModules([]);
      setIssues([]);
      return;
    }

    let cancelled = false;
    setStates([]);
    setLabels([]);
    setCycles([]);
    setModules([]);
    setIssues([]);
    Promise.all([
      stateService.list(workspaceSlug, projectId),
      labelService.list(workspaceSlug, projectId),
      cycleService.list(workspaceSlug, projectId),
      moduleService.list(workspaceSlug, projectId),
      issueService.list(workspaceSlug, projectId, { limit: 100 }),
    ])
      .then(([nextStates, nextLabels, nextCycles, nextModules, nextIssues]) => {
        if (cancelled) return;
        setStates(nextStates ?? []);
        setLabels(nextLabels ?? []);
        setCycles(nextCycles ?? []);
        setModules(nextModules ?? []);
        setIssues(nextIssues ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setStates([]);
        setLabels([]);
        setCycles([]);
        setModules([]);
        setIssues([]);
      });

    return () => {
      cancelled = true;
    };
  }, [open, workspaceSlug, projectId]);

  useEffect(() => {
    if (!open || !workspaceSlug) return;
    let cancelled = false;
    workspaceService
      .listMembers(workspaceSlug)
      .then((list) => {
        if (cancelled) return;
        setMembers(
          (list ?? []).map((member) => ({
            id: member.member_id,
            name:
              member.member_display_name?.trim() ||
              member.member_email?.split('@')[0] ||
              t('common.member', 'Member'),
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, workspaceSlug, t]);

  const stateMap = useMemo(() => new Map(states.map((state) => [state.id, state])), [states]);
  const labelMap = useMemo(() => new Map(labels.map((label) => [label.id, label])), [labels]);

  const filteredMembers = useMemo(() => {
    const query = assigneeSearch.trim().toLowerCase();
    return query ? members.filter((member) => member.name.toLowerCase().includes(query)) : members;
  }, [assigneeSearch, members]);

  const filteredLabels = useMemo(() => {
    const query = labelSearch.trim().toLowerCase();
    return query ? labels.filter((label) => label.name.toLowerCase().includes(query)) : labels;
  }, [labelSearch, labels]);

  const selectedState = stateId ? stateMap.get(stateId) : undefined;
  const selectedParent = parentId ? issues.find((issue) => issue.id === parentId) : undefined;
  const assigneeNames = assigneeIds
    .map((id) => members.find((member) => member.id === id)?.name)
    .filter((name): name is string => Boolean(name));
  const selectedLabels = labelIds
    .map((id) => labelMap.get(id))
    .filter((label): label is LabelApiResponse => Boolean(label));

  const canCreateLabel =
    Boolean(labelSearch.trim()) &&
    !labels.some((label) => label.name.toLowerCase() === labelSearch.trim().toLowerCase());

  const fieldTriggerClass =
    'h-11 w-full min-w-0 justify-between px-3 font-normal sm:h-9 [&>span]:min-w-0 [&>span]:truncate';
  const menuItemClass = 'min-h-11 sm:min-h-8';
  const menuContentClass = 'w-[min(22rem,calc(100vw-2rem))] p-0';

  const resetFields = () => {
    setTitle('');
    setDescription('');
    setStateId('');
    setPriority('none');
    setAssigneeIds([]);
    setLabelIds([]);
    setStartDate('');
    setDueDate('');
    setCycleId(null);
    setModuleId(null);
    setParentId(null);
    setAssigneeSearch('');
    setLabelSearch('');
    setCreateLabelError(null);
  };

  const focusTitle = () => {
    requestAnimationFrame(() => titleInputRef.current?.focus());
  };

  const handleProjectChange = (nextProjectId: string) => {
    if (nextProjectId === projectId) return;
    setProjectId(nextProjectId);
    setStateId('');
    setLabelIds([]);
    setCycleId(null);
    setModuleId(null);
    setParentId(null);
    setLabelSearch('');
    setCreateLabelError(null);
    setParentPickerOpen(false);
  };

  const handleCreateLabel = async () => {
    const name = labelSearch.trim();
    if (!name || !workspaceSlug || !projectId || createLabelLoading) return;
    setCreateLabelError(null);
    setCreateLabelLoading(true);
    try {
      const created = await labelService.create(workspaceSlug, projectId, { name });
      setLabels((current) => [...current.filter((label) => label.id !== created.id), created]);
      setLabelIds((current) => (current.includes(created.id) ? current : [...current, created.id]));
      setLabelSearch('');
      setLabelMenuOpen(false);
    } catch (error) {
      setCreateLabelError(
        error instanceof Error
          ? error.message
          : t('workItem.create.labelError', 'Failed to create label.'),
      );
    } finally {
      setCreateLabelLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !projectId || submitting) return;

    const payload: CreateWorkItemDialogSubmit = {
      title,
      description,
      projectId,
      stateId: stateId || undefined,
      priority: priority !== 'none' ? priority : undefined,
      assigneeIds: assigneeIds.length ? assigneeIds : undefined,
      assigneeId: assigneeIds[0] ?? undefined,
      labelIds: labelIds.length ? labelIds : undefined,
      startDate: startDate || undefined,
      dueDate: dueDate || undefined,
      cycleId: cycleId ?? undefined,
      moduleId: moduleId ?? undefined,
      parentId: parentId ?? undefined,
      isDraft: draftOnly ? true : undefined,
    };

    if (!onSave) {
      if (createMore) {
        resetFields();
        focusTitle();
      } else {
        onClose();
      }
      return;
    }

    setSubmitting(true);
    try {
      await onSave(payload);
      if (createMore) {
        resetFields();
        focusTitle();
      } else {
        onClose();
      }
    } catch {
      /* Callers expose the actionable API message through `createError`.
         Keeping the form open also preserves everything the user entered. */
    } finally {
      setSubmitting(false);
    }
  };

  const requestClose = () => {
    if (!submitting) onClose();
  };

  const assigneeSummary =
    assigneeNames.length === 0
      ? t('workItem.create.addAssignees', 'Add assignees')
      : assigneeNames.length === 1
        ? assigneeNames[0]
        : t('workItem.create.selectedCount', '{{name}} +{{count}}', {
            name: assigneeNames[0],
            count: assigneeNames.length - 1,
          });
  const labelSummary =
    selectedLabels.length === 0
      ? t('workItem.create.addLabels', 'Add labels')
      : selectedLabels.length === 1
        ? selectedLabels[0].name
        : t('workItem.create.selectedCount', '{{name}} +{{count}}', {
            name: selectedLabels[0].name,
            count: selectedLabels.length - 1,
          });

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) requestClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="grid max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-none grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-h-[calc(100dvh-3rem)] sm:max-w-3xl"
        onEscapeKeyDown={(event) => {
          if (submitting) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (submitting) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (submitting) event.preventDefault();
        }}
      >
        <DialogHeader className="relative gap-1 border-b px-4 py-4 pr-14 text-left sm:px-6 sm:py-5 sm:pr-16">
          <DialogTitle>
            {draftOnly
              ? t('drafts.draftWorkItem', 'Draft a work item')
              : t('workItem.create.title', 'Create work item')}
          </DialogTitle>
          <DialogDescription>
            {draftOnly
              ? t(
                  'drafts.emptyHint',
                  'Capture ideas as drafts and publish them into a project when you are ready.',
                )
              : t('workItem.create.description', 'Add a work item to a project.')}
          </DialogDescription>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 size-11 sm:top-3 sm:right-3 sm:size-8"
            aria-label={t('common.close', 'Close')}
            disabled={submitting}
            onClick={requestClose}
          >
            <X />
          </Button>
        </DialogHeader>

        <form id="create-work-item-v2-form" onSubmit={handleSubmit} className="contents">
          <div className="min-h-0 overflow-x-hidden overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
            <div className="space-y-6">
              <section className="space-y-4" aria-labelledby="create-work-item-basics-heading">
                <h3 id="create-work-item-basics-heading" className="sr-only">
                  {t('workItem.create.basics', 'Work item details')}
                </h3>

                <div className="space-y-2">
                  <Label htmlFor="create-work-item-project">{t('common.project', 'Project')}</Label>
                  <Select value={projectId} onValueChange={handleProjectChange}>
                    <SelectTrigger
                      id="create-work-item-project"
                      className="h-11 w-full sm:h-9"
                      disabled={submitting || projects.length === 0}
                    >
                      <FolderKanban className="text-muted-foreground" />
                      <SelectValue placeholder={t('common.selectProject', 'Select project')} />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id} className={menuItemClass}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="create-work-item-title">{t('common.title', 'Title')}</Label>
                  <Input
                    ref={titleInputRef}
                    id="create-work-item-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder={t('workItem.create.titlePlaceholder', 'What needs to be done?')}
                    className="h-11 sm:h-9"
                    disabled={submitting}
                    autoFocus
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="create-work-item-description">
                    {t('common.description', 'Description')}
                  </Label>
                  <Textarea
                    id="create-work-item-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder={t(
                      'workItem.create.descriptionPlaceholder',
                      'Add context, acceptance criteria, or links…',
                    )}
                    className="min-h-28 resize-y"
                    disabled={submitting}
                  />
                </div>
              </section>

              <section className="space-y-3" aria-labelledby="create-work-item-properties-heading">
                <div>
                  <h3 id="create-work-item-properties-heading" className="text-sm font-medium">
                    {t('workItem.create.properties', 'Properties')}
                  </h3>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {t(
                      'workItem.create.propertiesHint',
                      'Add planning details now or update them later.',
                    )}
                  </p>
                </div>

                <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="create-work-item-state">{t('views.state', 'State')}</Label>
                    <Select
                      value={stateId || EMPTY_VALUE}
                      onValueChange={(value) => setStateId(value === EMPTY_VALUE ? '' : value)}
                      disabled={submitting}
                    >
                      <SelectTrigger id="create-work-item-state" className="h-11 w-full sm:h-9">
                        <span
                          className="size-2.5 shrink-0 rounded-full border"
                          style={
                            selectedState?.color
                              ? { backgroundColor: selectedState.color }
                              : undefined
                          }
                        />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={EMPTY_VALUE} className={menuItemClass}>
                          {t('workItem.create.noState', 'No state')}
                        </SelectItem>
                        {states.map((state) => (
                          <SelectItem key={state.id} value={state.id} className={menuItemClass}>
                            {state.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="create-work-item-priority">
                      {t('views.priority', 'Priority')}
                    </Label>
                    <Select
                      value={priority}
                      onValueChange={(value) => setPriority(value as Priority)}
                      disabled={submitting}
                    >
                      <SelectTrigger id="create-work-item-priority" className="h-11 w-full sm:h-9">
                        <Signal className="text-muted-foreground" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map((value) => (
                          <SelectItem
                            key={value}
                            value={value}
                            className={`${menuItemClass} capitalize`}
                          >
                            {value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="create-work-item-assignees">
                      {t('views.assignees', 'Assignees')}
                    </Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          id="create-work-item-assignees"
                          type="button"
                          variant="outline"
                          className={fieldTriggerClass}
                          disabled={submitting}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <User className="text-muted-foreground" />
                            <span className="truncate">{assigneeSummary}</span>
                          </span>
                          <ChevronsUpDown className="text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className={menuContentClass}>
                        <div className="p-2">
                          <Input
                            value={assigneeSearch}
                            onChange={(event) => setAssigneeSearch(event.target.value)}
                            placeholder={t('common.search', 'Search')}
                            aria-label={t('workItem.create.searchAssignees', 'Search assignees')}
                            className="h-11 sm:h-9"
                            onKeyDown={(event) => event.stopPropagation()}
                          />
                        </div>
                        <DropdownMenuSeparator />
                        <div className="max-h-60 overflow-y-auto p-1">
                          {assigneeIds.length > 0 && (
                            <>
                              <DropdownMenuItem
                                className={menuItemClass}
                                onSelect={() => setAssigneeIds([])}
                              >
                                {t('workItem.create.noAssignee', 'No assignee')}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          )}
                          {filteredMembers.length === 0 ? (
                            <DropdownMenuLabel className="text-muted-foreground py-3 font-normal">
                              {t('common.noResults', 'No results')}
                            </DropdownMenuLabel>
                          ) : (
                            filteredMembers.map((member) => (
                              <DropdownMenuCheckboxItem
                                key={member.id}
                                checked={assigneeIds.includes(member.id)}
                                className={menuItemClass}
                                onSelect={(event) => event.preventDefault()}
                                onCheckedChange={(checked) =>
                                  setAssigneeIds((current) =>
                                    checked
                                      ? current.includes(member.id)
                                        ? current
                                        : [...current, member.id]
                                      : current.filter((id) => id !== member.id),
                                  )
                                }
                              >
                                {member.name}
                              </DropdownMenuCheckboxItem>
                            ))
                          )}
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="create-work-item-labels">{t('views.labels', 'Labels')}</Label>
                    <DropdownMenu
                      open={labelMenuOpen}
                      onOpenChange={(nextOpen) => {
                        setLabelMenuOpen(nextOpen);
                        if (!nextOpen) {
                          setLabelSearch('');
                          setCreateLabelError(null);
                        }
                      }}
                    >
                      <DropdownMenuTrigger asChild>
                        <Button
                          id="create-work-item-labels"
                          type="button"
                          variant="outline"
                          className={fieldTriggerClass}
                          disabled={submitting}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            {selectedLabels[0]?.color ? (
                              <span
                                className="size-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: selectedLabels[0].color }}
                              />
                            ) : (
                              <Tag className="text-muted-foreground" />
                            )}
                            <span className="truncate">{labelSummary}</span>
                          </span>
                          <ChevronsUpDown className="text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className={menuContentClass}>
                        <div className="p-2">
                          <Input
                            value={labelSearch}
                            onChange={(event) => {
                              setLabelSearch(event.target.value);
                              setCreateLabelError(null);
                            }}
                            placeholder={t('common.search', 'Search')}
                            aria-label={t('workItem.create.searchLabels', 'Search labels')}
                            className="h-11 sm:h-9"
                            onKeyDown={(event) => event.stopPropagation()}
                          />
                        </div>
                        <DropdownMenuSeparator />
                        <div className="max-h-60 overflow-y-auto p-1">
                          {filteredLabels.map((label) => (
                            <DropdownMenuCheckboxItem
                              key={label.id}
                              checked={labelIds.includes(label.id)}
                              className={menuItemClass}
                              onSelect={(event) => event.preventDefault()}
                              onCheckedChange={(checked) =>
                                setLabelIds((current) =>
                                  checked
                                    ? current.includes(label.id)
                                      ? current
                                      : [...current, label.id]
                                    : current.filter((id) => id !== label.id),
                                )
                              }
                            >
                              <span
                                className="size-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: label.color ?? 'currentColor' }}
                              />
                              {label.name}
                            </DropdownMenuCheckboxItem>
                          ))}
                          {filteredLabels.length === 0 && !canCreateLabel && (
                            <DropdownMenuLabel className="text-muted-foreground py-3 font-normal">
                              {t('common.noResults', 'No results')}
                            </DropdownMenuLabel>
                          )}
                          {canCreateLabel && (
                            <>
                              {filteredLabels.length > 0 && <DropdownMenuSeparator />}
                              <DropdownMenuItem
                                className={menuItemClass}
                                disabled={createLabelLoading}
                                onSelect={(event) => {
                                  event.preventDefault();
                                  void handleCreateLabel();
                                }}
                              >
                                {createLabelLoading ? (
                                  <LoaderCircle className="animate-spin" />
                                ) : (
                                  <Plus />
                                )}
                                {t('workItem.create.createLabel', 'Create label “{{name}}”', {
                                  name: labelSearch.trim(),
                                })}
                              </DropdownMenuItem>
                            </>
                          )}
                          {createLabelError && (
                            <p
                              role="alert"
                              aria-live="polite"
                              className="text-destructive px-2 py-2 text-xs"
                            >
                              {createLabelError}
                            </p>
                          )}
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="create-work-item-start-date">
                      {t('views.startDate', 'Start date')}
                    </Label>
                    <div className="relative">
                      <CalendarDays className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                      <Input
                        id="create-work-item-start-date"
                        type="date"
                        value={startDate}
                        onChange={(event) => setStartDate(event.target.value)}
                        className="h-11 min-w-0 pl-9 sm:h-9"
                        disabled={submitting}
                      />
                    </div>
                  </div>

                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="create-work-item-due-date">
                      {t('views.dueDate', 'Due date')}
                    </Label>
                    <div className="relative">
                      <CalendarDays className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                      <Input
                        id="create-work-item-due-date"
                        type="date"
                        value={dueDate}
                        onChange={(event) => setDueDate(event.target.value)}
                        className="h-11 min-w-0 pl-9 sm:h-9"
                        disabled={submitting}
                      />
                    </div>
                  </div>

                  {showCycles && (
                    <div className="min-w-0 space-y-2">
                      <Label htmlFor="create-work-item-cycle">{t('views.cycle', 'Cycle')}</Label>
                      <Select
                        value={cycleId ?? EMPTY_VALUE}
                        onValueChange={(value) => setCycleId(value === EMPTY_VALUE ? null : value)}
                        disabled={submitting}
                      >
                        <SelectTrigger id="create-work-item-cycle" className="h-11 w-full sm:h-9">
                          <Layers className="text-muted-foreground" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={EMPTY_VALUE} className={menuItemClass}>
                            {t('workItem.create.noCycle', 'No cycle')}
                          </SelectItem>
                          {cycles.map((cycle) => (
                            <SelectItem key={cycle.id} value={cycle.id} className={menuItemClass}>
                              {cycle.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {showModules && (
                    <div className="min-w-0 space-y-2">
                      <Label htmlFor="create-work-item-module">{t('views.module', 'Module')}</Label>
                      <Select
                        value={moduleId ?? EMPTY_VALUE}
                        onValueChange={(value) => setModuleId(value === EMPTY_VALUE ? null : value)}
                        disabled={submitting}
                      >
                        <SelectTrigger id="create-work-item-module" className="h-11 w-full sm:h-9">
                          <Layers className="text-muted-foreground" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={EMPTY_VALUE} className={menuItemClass}>
                            {t('workItem.create.noModule', 'No module')}
                          </SelectItem>
                          {modules.map((module) => (
                            <SelectItem key={module.id} value={module.id} className={menuItemClass}>
                              {module.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="min-w-0 space-y-2 sm:col-span-2">
                    <Label htmlFor="create-work-item-parent">
                      {t('workItem.create.parent', 'Parent work item')}
                    </Label>
                    <Popover open={parentPickerOpen} onOpenChange={setParentPickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          id="create-work-item-parent"
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={parentPickerOpen}
                          className={fieldTriggerClass}
                          disabled={submitting}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <Link2 className="text-muted-foreground" />
                            <span className="truncate">
                              {selectedParent?.name ??
                                (parentId
                                  ? parentId.slice(0, 8)
                                  : t('workItem.create.addParent', 'Add parent'))}
                            </span>
                          </span>
                          <ChevronsUpDown className="text-muted-foreground" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className={`${menuContentClass} p-0`}>
                        <Command>
                          <CommandInput
                            placeholder={t('workItem.create.searchParents', 'Search work items…')}
                          />
                          <CommandList className="max-h-64">
                            <CommandEmpty>{t('common.noResults', 'No results')}</CommandEmpty>
                            <CommandGroup>
                              {parentId && (
                                <CommandItem
                                  value="clear-parent-selection"
                                  className={menuItemClass}
                                  onSelect={() => {
                                    setParentId(null);
                                    setParentPickerOpen(false);
                                  }}
                                >
                                  <X />
                                  {t('workItem.create.noParent', 'No parent')}
                                </CommandItem>
                              )}
                              {issues.map((issue) => (
                                <CommandItem
                                  key={issue.id}
                                  value={`${issue.name} ${issue.id}`}
                                  className={menuItemClass}
                                  onSelect={() => {
                                    setParentId(issue.id);
                                    setParentPickerOpen(false);
                                  }}
                                >
                                  <Check
                                    className={parentId === issue.id ? 'opacity-100' : 'opacity-0'}
                                  />
                                  <span className="truncate">{issue.name}</span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </section>

              {createError && (
                <p
                  id="create-work-item-error"
                  role="alert"
                  aria-live="polite"
                  className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm"
                >
                  {createError}
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="flex flex-col gap-3 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex min-h-11 items-center gap-2 sm:min-h-9">
              <Checkbox
                id="create-work-item-create-more"
                checked={createMore}
                onCheckedChange={(checked) => setCreateMore(checked === true)}
                disabled={submitting}
              />
              <Label htmlFor="create-work-item-create-more" className="cursor-pointer font-normal">
                {t('workItem.create.createMore', 'Create more')}
              </Label>
            </div>
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
              <Button
                type="button"
                variant="outline"
                className="h-11 sm:h-9"
                onClick={requestClose}
                disabled={submitting}
              >
                {t('common.discard', 'Discard')}
              </Button>
              <Button
                type="submit"
                className="h-11 sm:h-9"
                disabled={submitting || !title.trim() || !projectId}
                aria-describedby={createError ? 'create-work-item-error' : undefined}
              >
                {submitting && <LoaderCircle className="animate-spin" />}
                {submitting
                  ? t('common.creating', 'Creating…')
                  : draftOnly
                    ? t('drafts.saveDraft', 'Save draft')
                    : t('workItem.create.submit', 'Create work item')}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
