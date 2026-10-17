import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CreateWorkspaceForm } from '@/v2/components/create-workspace-form';
import { AuthPageShellV2 } from '@/v2/components/auth-page-shell';
import { useAuth } from '../../contexts/AuthContext';
import { workspaceService } from '../../services/workspaceService';
import { getApiErrorMessage } from '../../api/client';
import { slugFromName, validateWorkspaceSlug } from '../../utils/workspace';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export function CreateWorkspacePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isAuthenticated, user } = useAuth();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [organizationSize, setOrganizationSize] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useDocumentTitle(t('workspace.create.documentTitle', 'Create workspace'));

  const baseUrl = typeof window !== 'undefined' ? `${window.location.origin}/` : '';

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setName(next);
    if (!slug || slug === slugFromName(name)) {
      setSlug(slugFromName(next));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmedName = name.trim();
    const trimmedSlug = slug.trim().toLowerCase() || slugFromName(trimmedName);

    if (!trimmedName) {
      setError(t('workspace.create.errorName', 'Please enter a workspace name.'));
      return;
    }
    if (!validateWorkspaceSlug(trimmedSlug)) {
      setError(
        t(
          'workspace.create.errorSlug',
          'Workspace URL must be lowercase letters, numbers, and hyphens only.',
        ),
      );
      return;
    }
    if (!isAuthenticated || !user) {
      setError(
        t('workspace.create.errorNotSignedIn', 'You need to be signed in to create a workspace.'),
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const ws = await workspaceService.create({
        name: trimmedName,
        slug: trimmedSlug,
        ...(organizationSize.trim() ? { organization_size: organizationSize.trim() } : {}),
      });
      navigate(`/${ws.slug}`, { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthPageShellV2 contentWidth="md">
      <CreateWorkspaceForm
        name={name}
        onNameChange={handleNameChange}
        slug={slug}
        onSlugChange={setSlug}
        organizationSize={organizationSize}
        onOrganizationSizeChange={setOrganizationSize}
        baseUrl={baseUrl}
        onSubmit={(e) => void handleSubmit(e)}
        isSubmitting={isSubmitting}
        error={error}
      />
    </AuthPageShellV2>
  );
}
