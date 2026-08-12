import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Check, Layers, Search, Signal, Tag, User } from 'lucide-react';
import { Badge } from '@/components/shadcn/ui/badge';
import { Button } from '@/components/shadcn/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/shadcn/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/shadcn/ui/dropdown-menu';
import { Input } from '@/components/shadcn/ui/input';
import { Label } from '@/components/shadcn/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shadcn/ui/select';
import { Textarea } from '@/components/shadcn/ui/textarea';
import { cycleService } from '../../services/cycleService';
import { labelService } from '../../services/labelService';
import { moduleService } from '../../services/moduleService';
import { stateService } from '../../services/stateService';
import { workspaceService } from '../../services/workspaceService';
import type {
  CycleApiResponse,
  LabelApiResponse,
  ModuleApiResponse,
  ProjectApiResponse,
  StateApiResponse,
} from '../../api/types';
import type { Priority } from '../../types';
import type { WorkItemInitialValues } from '../CreateWorkItemModal';

const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low', 'none'];

/** What a submitted form hands back — same shape the shipped modal emits. */
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

/**
 * Design preview of the work item composer, built from shadcn primitives. It
 * stands alongside CreateWorkItemModal rather than replacing it, so the two can
 * be compared side by side.
 *
 * The props and the submitted payload match the shipped modal, so a caller can
 * swap one for the other. Two things the shipped modal has are deliberately not
 * carried over: the parent-item picker, which opens a second modal of its own,
 * and inline label creation — both belong to flows outside this preview.
 */
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
  const [createMore, setCreateMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [states, setStates] = useState<StateApiResponse[]>([]);
  const [labels, setLabels] = useState<LabelApiResponse[]>([]);
  const [cycles, setCycles] = useState<CycleApiResponse[]>([]);
  const [modules, setModules] = useState<ModuleApiResponse[]>([]);
  const [members, setMembers] = useState<Array<{ id: string; name: string }>>([]);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [labelSearch, setLabelSearch] = useState('');

  const selectedProject = projects.find((p) => p.id === projectId) ?? projects[0];
  const pid = selectedProject?.id ?? '';
  const showModules = selectedProject?.module_view ?? true;
  const showCycles = selectedProject?.cycle_view ?? true;

  /* The form is seeded when the dialog opens, and only then: `initialValues`
     and `projects` are fresh objects on most renders, so reacting to them
     would wipe out what is being typed. */
  const seedRef = useRef({ defaultProjectId, defaultModuleId, projects });
  seedRef.current = { defaultProjectId, defaultModuleId, projects };

  /* Re-seeding also when `initialValues` changes identity, so picking Edit or
     Duplicate on another row while the dialog is open loads that row. */
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
  }, [open, initialValues]);

  /* Property options belong to the selected project, so switching projects
     reloads them. */
  useEffect(() => {
    if (!open || !workspaceSlug || !pid) {
      return;
    }
    let cancelled = false;
    Promise.all([
      stateService.list(workspaceSlug, pid),
      labelService.list(workspaceSlug, pid),
      cycleService.list(workspaceSlug, pid),
      moduleService.list(workspaceSlug, pid),
    ])
      .then(([st, lab, cy, mod]) => {
        if (cancelled) return;
        setStates(st ?? []);
        setLabels(lab ?? []);
        setCycles(cy ?? []);
        setModules(mod ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setStates([]);
        setLabels([]);
        setCycles([]);
        setModules([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, workspaceSlug, pid]);

  useEffect(() => {
    if (!open || !workspaceSlug) return;
    let cancelled = false;
    workspaceService
      .listMembers(workspaceSlug)
      .then((list) => {
        if (cancelled) return;
        setMembers(
          (list ?? []).map((m) => ({
            id: m.member_id,
            name:
              m.member_display_name?.trim() ||
              m.member_email?.split('@')[0] ||
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

  /* A project with cycles or modules turned off cannot carry the selection the
     previous project left behind. */
  useEffect(() => {
    if (!showCycles) setCycleId(null);
    if (!showModules) setModuleId(null);
  }, [showCycles, showModules]);

  const stateMap = useMemo(() => new Map(states.map((s) => [s.id, s])), [states]);
  const labelMap = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels]);

  const filteredMembers = useMemo(() => {
    const needle = assigneeSearch.trim().toLowerCase();
    return needle ? members.filter((m) => m.name.toLowerCase().includes(needle)) : members;
  }, [members, assigneeSearch]);

  const filteredLabels = useMemo(() => {
    const needle = labelSearch.trim().toLowerCase();
    return needle ? labels.filter((l) => l.name.toLowerCase().includes(needle)) : labels;
  }, [labels, labelSearch]);

  /** Clears everything the user typed but keeps the project selection. */
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || submitting) return;
    if (!onSave) {
      if (createMore) resetFields();
      else onClose();
      return;
    }
    setSubmitting(true);
    try {
      await onSave({
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
        isDraft: draftOnly ? true : undefined,
      });
      /* "Create more" clears the form for the next item instead of closing.
         Closing is decided here rather than by the caller, so a caller that
         closes on every save cannot defeat the toggle. */
      if (createMore) resetFields();
      else onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const selectedState = stateId ? stateMap.get(stateId) : undefined;
  const firstLabel = labelIds[0] ? labelMap.get(labelIds[0]) : undefined;
  const selectedCycle = cycleId ? cycles.find((c) => c.id === cycleId) : undefined;
  const selectedModule = moduleId ? modules.find((m) => m.id === moduleId) : undefined;
  const assigneeNames = assigneeIds
    .map((id) => members.find((m) => m.id === id)?.name)
    .filter(Boolean);

  const propertyTriggerClass = 'h-8 gap-1.5 rounded-full text-xs font-normal';

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
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
        </DialogHeader>

        <form id="create-work-item-v2-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="create-work-item-project">{t('common.project', 'Project')}</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger id="create-work-item-project" className="w-full">
                <SelectValue placeholder={t('common.project', 'Project')} />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-work-item-title">{t('common.title', 'Title')}</Label>
            <Input
              id="create-work-item-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('common.title', 'Title')}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-work-item-description">
              {t('common.description', 'Description')}
            </Label>
            {/* Plain text, as in the shipped composer — the rich editor belongs
                to the work item detail page. */}
            <Textarea
              id="create-work-item-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('workItem.create.descriptionPlaceholder', 'Click to add description')}
              rows={4}
            />
          </div>

          {/* Properties as a row of pills, mirroring the shipped composer's
              strip rather than stacking a dozen labelled fields. */}
          <div className="flex flex-wrap items-center gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" className={propertyTriggerClass}>
                  <span
                    className="size-2.5 shrink-0 rounded-full border"
                    style={
                      selectedState?.color ? { backgroundColor: selectedState.color } : undefined
                    }
                  />
                  {selectedState?.name ?? t('views.state', 'State')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-72 w-56 overflow-y-auto">
                {states.length === 0 ? (
                  <DropdownMenuLabel className="text-muted-foreground font-normal">
                    {t('drafts.noStates', 'No states.')}
                  </DropdownMenuLabel>
                ) : (
                  <DropdownMenuRadioGroup value={stateId} onValueChange={setStateId}>
                    {states.map((state) => (
                      <DropdownMenuRadioItem key={state.id} value={state.id}>
                        {state.name}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" className={propertyTriggerClass}>
                  <Signal className="opacity-70" />
                  <span className="capitalize">
                    {priority === 'none' ? t('views.priority', 'Priority') : priority}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40">
                <DropdownMenuRadioGroup
                  value={priority}
                  onValueChange={(next) => setPriority(next as Priority)}
                >
                  {PRIORITIES.map((value) => (
                    <DropdownMenuRadioItem key={value} value={value} className="capitalize">
                      {value}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" className={propertyTriggerClass}>
                  <User className="opacity-70" />
                  {assigneeNames.length === 0
                    ? t('views.assignees', 'Assignees')
                    : assigneeNames[0]}
                  {assigneeNames.length > 1 && (
                    <Badge variant="secondary">+{assigneeNames.length - 1}</Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-72 w-56 overflow-y-auto">
                <div className="relative p-1">
                  <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2" />
                  <Input
                    value={assigneeSearch}
                    onChange={(e) => setAssigneeSearch(e.target.value)}
                    placeholder={t('common.search', 'Search')}
                    aria-label={t('common.search', 'Search')}
                    className="h-8 pl-8"
                    /* The menu's own typeahead would otherwise steal the keys
                       as they are typed into this field. */
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
                <DropdownMenuSeparator />
                {filteredMembers.length === 0 ? (
                  <DropdownMenuLabel className="text-muted-foreground font-normal">
                    {t('common.noResults', 'No results')}
                  </DropdownMenuLabel>
                ) : (
                  filteredMembers.map((member) => (
                    <DropdownMenuCheckboxItem
                      key={member.id}
                      checked={assigneeIds.includes(member.id)}
                      /* Kept open so several people can be picked in one go. */
                      onSelect={(e) => e.preventDefault()}
                      onCheckedChange={(checked) =>
                        setAssigneeIds((prev) =>
                          checked ? [...prev, member.id] : prev.filter((id) => id !== member.id),
                        )
                      }
                    >
                      {member.name}
                    </DropdownMenuCheckboxItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" className={propertyTriggerClass}>
                  {firstLabel ? (
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: firstLabel.color ?? 'currentColor' }}
                    />
                  ) : (
                    <Tag className="opacity-70" />
                  )}
                  {firstLabel?.name ?? t('views.labels', 'Labels')}
                  {labelIds.length > 1 && <Badge variant="secondary">+{labelIds.length - 1}</Badge>}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-72 w-56 overflow-y-auto">
                <div className="relative p-1">
                  <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2" />
                  <Input
                    value={labelSearch}
                    onChange={(e) => setLabelSearch(e.target.value)}
                    placeholder={t('common.search', 'Search')}
                    aria-label={t('common.search', 'Search')}
                    className="h-8 pl-8"
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
                <DropdownMenuSeparator />
                {filteredLabels.length === 0 ? (
                  <DropdownMenuLabel className="text-muted-foreground font-normal">
                    {t('views.noLabels', 'No labels.')}
                  </DropdownMenuLabel>
                ) : (
                  filteredLabels.map((label) => (
                    <DropdownMenuCheckboxItem
                      key={label.id}
                      checked={labelIds.includes(label.id)}
                      onSelect={(e) => e.preventDefault()}
                      onCheckedChange={(checked) =>
                        setLabelIds((prev) =>
                          checked ? [...prev, label.id] : prev.filter((id) => id !== label.id),
                        )
                      }
                    >
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: label.color ?? 'currentColor' }}
                      />
                      {label.name}
                    </DropdownMenuCheckboxItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {showCycles && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={propertyTriggerClass}
                  >
                    <Layers className="opacity-70" />
                    {selectedCycle?.name ?? t('views.cycle', 'Cycle')}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-72 w-56 overflow-y-auto">
                  {cycles.length === 0 ? (
                    <DropdownMenuLabel className="text-muted-foreground font-normal">
                      {t('views.selectCycle', 'Select cycle')}
                    </DropdownMenuLabel>
                  ) : (
                    <>
                      {cycles.map((cycle) => (
                        <DropdownMenuItem key={cycle.id} onSelect={() => setCycleId(cycle.id)}>
                          {cycle.name}
                        </DropdownMenuItem>
                      ))}
                      {cycleId && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => setCycleId(null)}>
                            {t('common.clear', 'Clear')}
                          </DropdownMenuItem>
                        </>
                      )}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {showModules && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={propertyTriggerClass}
                  >
                    <Layers className="opacity-70" />
                    {selectedModule?.name ?? t('views.module', 'Module')}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-72 w-56 overflow-y-auto">
                  {modules.length === 0 ? (
                    <DropdownMenuLabel className="text-muted-foreground font-normal">
                      {t('views.selectModules', 'Select modules')}
                    </DropdownMenuLabel>
                  ) : (
                    <>
                      {modules.map((module) => (
                        <DropdownMenuItem key={module.id} onSelect={() => setModuleId(module.id)}>
                          {module.name}
                        </DropdownMenuItem>
                      ))}
                      {moduleId && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => setModuleId(null)}>
                            {t('common.clear', 'Clear')}
                          </DropdownMenuItem>
                        </>
                      )}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" className={propertyTriggerClass}>
                  <CalendarDays className="opacity-70" />
                  {startDate || t('views.startDate', 'Start date')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-auto p-2">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-8"
                />
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" className={propertyTriggerClass}>
                  <CalendarDays className="opacity-70" />
                  {dueDate || t('views.dueDate', 'Due date')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-auto p-2">
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="h-8"
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {createError && <p className="text-destructive text-sm">{createError}</p>}
        </form>

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={createMore}
            onClick={() => setCreateMore((prev) => !prev)}
            className="gap-1.5"
          >
            <span
              className={
                createMore
                  ? 'border-primary bg-primary text-primary-foreground flex size-4 items-center justify-center rounded-sm border'
                  : 'border-input flex size-4 items-center justify-center rounded-sm border'
              }
            >
              {createMore && <Check className="size-3" />}
            </span>
            {t('workItem.create.createMore', 'Create more')}
          </Button>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              type="submit"
              form="create-work-item-v2-form"
              disabled={submitting || !title.trim() || !projectId}
            >
              {draftOnly
                ? t('drafts.saveDraft', 'Save draft')
                : t('workItem.create.submit', 'Create work item')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
