import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button, Input } from '../components/ui';
import { pageService } from '../services/pageService';
import type { PageDescriptionEditorHandle } from '../components/PageDescriptionEditor';
import { PageDescriptionEditor } from '../components/PageDescriptionEditor';

export function NewPagePage() {
  const navigate = useNavigate();
  const { workspaceSlug, projectId } = useParams<{
    workspaceSlug: string;
    projectId: string;
  }>();
  const [searchParams] = useSearchParams();

  const pageType = searchParams.get('type');
  const initialAccess = useMemo(() => {
    if (pageType === 'private') return 1;
    // archived pages can't be created from this route in our backend; default to public
    return 0;
  }, [pageType]);

  const [access, setAccess] = useState<number>(initialAccess);
  const [name, setName] = useState<string>('Untitled page');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editorRef = useRef<PageDescriptionEditorHandle | null>(null);

  const baseUrl = useMemo(() => {
    if (!workspaceSlug || !projectId) return '';
    return `/${workspaceSlug}/projects/${projectId}`;
  }, [workspaceSlug, projectId]);

  if (!workspaceSlug || !projectId) {
    return <div className="text-(--txt-secondary)">Project not found.</div>;
  }

  const canSave = name.trim().length > 0 && !isSaving;

  const handleCreate = async () => {
    setError(null);
    if (!workspaceSlug || !projectId) return;
    const editorHtml = editorRef.current?.getHtml() ?? '<p></p>';

    if (!name.trim()) {
      setError('Please enter a page name.');
      return;
    }

    setIsSaving(true);
    try {
      const created = await pageService.create(workspaceSlug, {
        name: name.trim(),
        description_html: editorHtml,
        project_id: projectId,
        access,
      });
      navigate(`${baseUrl}/pages/${created.id}`);
    } catch (e) {
      setError((e as Error)?.message ?? 'Failed to create page.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Input
            label="Page title"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Untitled page"
          />

          <div className="flex gap-1 border-b border-(--border-subtle) pt-1">
            {[
              { key: 0, label: 'Public' },
              { key: 1, label: 'Private' },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setAccess(t.key)}
                className={`border-b-2 px-4 py-2 text-sm font-medium ${
                  access === t.key
                    ? 'border-(--brand-default) text-(--txt-primary)'
                    : 'border-transparent text-(--txt-secondary) hover:text-(--txt-primary)'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => navigate(`${baseUrl}/pages`)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!canSave} isLoading={isSaving}>
            Add page
          </Button>
        </div>
      </div>

      <PageDescriptionEditor
        ref={editorRef}
        initialHtml="<p></p>"
        placeholder="Write the page content…"
        autoFocus
      />

      {error && <div className="text-sm text-(--txt-danger-primary)">{error}</div>}
    </div>
  );
}
