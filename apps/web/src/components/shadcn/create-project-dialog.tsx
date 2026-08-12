import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/shadcn/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/shadcn/ui/dialog';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/shadcn/ui/field';
import { Input } from '@/components/shadcn/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shadcn/ui/select';
import { Textarea } from '@/components/shadcn/ui/textarea';
import { projectService } from '../../services/projectService';
import { workspaceService } from '../../services/workspaceService';
import { getApiErrorMessage } from '../../api/client';
import type { ProjectApiResponse, WorkspaceMemberApiResponse } from '../../api/types';

/** 2 = public (any workspace member), 0 = secret (invited members only). */
const NETWORK_PUBLIC = 2;
const NETWORK_SECRET = 0;

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceSlug: string;
  onSuccess?: (project: ProjectApiResponse) => void;
}

/**
 * Design preview of the create-project form, built from shadcn primitives.
 *
 * Covers the fields the API needs to create a project. The cover image and
 * icon pickers the shipped modal carries are left out: they open modals of
 * their own, which is a nesting problem this preview does not need to solve.
 */
export function CreateProjectDialog({
  open,
  onOpenChange,
  workspaceSlug,
  onSuccess,
}: CreateProjectDialogProps) {
  const { t } = useTranslation();

  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [description, setDescription] = useState('');
  const [network, setNetwork] = useState<'public' | 'secret'>('public');
  const [projectLeadId, setProjectLeadId] = useState<string>('');
  const [members, setMembers] = useState<WorkspaceMemberApiResponse[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    workspaceService
      .listMembers(workspaceSlug)
      .then(setMembers)
      .catch(() => {
        /* The lead is optional, so an unreadable member list just leaves the
           dropdown empty rather than blocking the form. */
      });
  }, [open, workspaceSlug]);

  const reset = () => {
    setName('');
    setIdentifier('');
    setDescription('');
    setNetwork('public');
    setProjectLeadId('');
    setError('');
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError(t('project.create.nameRequired', 'Project name is required.'));
      return;
    }

    setSubmitting(true);
    try {
      const project = await projectService.create(workspaceSlug, {
        name: name.trim(),
        identifier: identifier.trim() || undefined,
        description: description.trim() || undefined,
        network: network === 'public' ? NETWORK_PUBLIC : NETWORK_SECRET,
        project_lead_id: projectLeadId || undefined,
      });
      onSuccess?.(project);
      reset();
      onOpenChange(false);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err) || t('project.create.error', 'Failed to create project.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t('project.create.title', 'Create project')}</DialogTitle>
            <DialogDescription>
              {t(
                'project.create.subtitle',
                'Projects group the work items, cycles, and modules your team ships together.',
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <Field>
              <FieldLabel htmlFor="project-name">
                {t('project.create.nameLabel', 'Name')}
              </FieldLabel>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('project.create.namePlaceholder', 'Project name')}
                disabled={submitting}
                autoFocus
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="project-identifier">
                {t('project.create.idLabel', 'Project ID')}
              </FieldLabel>
              <Input
                id="project-identifier"
                value={identifier}
                onChange={(e) =>
                  setIdentifier(
                    e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9-]/g, '')
                      .slice(0, 7),
                  )
                }
                placeholder={t('project.create.idPlaceholder', 'Project ID')}
                maxLength={7}
                disabled={submitting}
              />
              <FieldDescription>
                {t(
                  'project.create.idHint',
                  'Prefixes every work item, e.g. DEV-1. Generated from the name if left empty.',
                )}
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="project-description">
                {t('project.create.descriptionLabel', 'Description')}
              </FieldLabel>
              <Textarea
                id="project-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t(
                  'project.create.descriptionPlaceholder',
                  'What is this project for?',
                )}
                disabled={submitting}
                rows={3}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="project-network">
                  {t('project.create.accessLabel', 'Access')}
                </FieldLabel>
                <Select
                  value={network}
                  onValueChange={(value) => setNetwork(value as 'public' | 'secret')}
                  disabled={submitting}
                >
                  <SelectTrigger id="project-network" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">
                      {t('project.create.accessPublic', 'Public')}
                    </SelectItem>
                    <SelectItem value="secret">
                      {t('project.create.accessSecret', 'Private')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor="project-lead">
                  {t('project.create.leadLabel', 'Lead')}
                </FieldLabel>
                <Select
                  value={projectLeadId}
                  onValueChange={setProjectLeadId}
                  disabled={submitting || members.length === 0}
                >
                  <SelectTrigger id="project-lead" className="w-full">
                    <SelectValue placeholder={t('project.create.leadPlaceholder', 'Unassigned')} />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((member) => (
                      <SelectItem key={member.id} value={member.member_id ?? member.id}>
                        {member.member_display_name ||
                          member.member_email ||
                          t('project.create.leadUnknown', 'Member')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {error && (
              <Field>
                <FieldError>{error}</FieldError>
              </Field>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting
                ? t('project.create.submitting', 'Creating…')
                : t('project.create.submit', 'Create project')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
