import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Input } from '../components/ui';
import { Modal } from '../components/ui/Modal';
import { PageDescriptionEditor, type PageDescriptionEditorHandle } from '../components/PageDescriptionEditor';
import { pageService } from '../services/pageService';

export function PageDetailPage() {
  const navigate = useNavigate();
  const { workspaceSlug, projectId, pageId } = useParams<{
    workspaceSlug: string;
    projectId: string;
    pageId: string;
  }>();

  const baseUrl = useMemo(() => {
    if (!workspaceSlug || !projectId) return '';
    return `/${workspaceSlug}/projects/${projectId}`;
  }, [workspaceSlug, projectId]);

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [access, setAccess] = useState<number>(0);
  const [descriptionHtml, setDescriptionHtml] = useState<string>('<p></p>');

  const editorRef = useRef<PageDescriptionEditorHandle | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (!workspaceSlug || !pageId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    pageService
      .get(workspaceSlug, pageId)
      .then((p) => {
        if (cancelled) return;
        setName(p.name ?? '');
        setAccess(typeof p.access === 'number' ? p.access : 0);
        setDescriptionHtml(p.description_html ?? '<p></p>');
      })
      .catch(() => {
        if (!cancelled) setError('Page not found.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, pageId]);

  const canSave = name.trim().length > 0 && !isSaving;

  const handleSave = async () => {
    if (!workspaceSlug || !pageId) return;
    setError(null);

    const editorHtml = editorRef.current?.getHtml() ?? descriptionHtml ?? '<p></p>';
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      const updated = await pageService.update(workspaceSlug, pageId, {
        name: name.trim(),
        description_html: editorHtml,
        access,
      });
      setName(updated.name ?? name);
      setAccess(typeof updated.access === 'number' ? updated.access : access);
      setDescriptionHtml(updated.description_html ?? editorHtml);
    } catch (e) {
      setError((e as Error)?.message ?? 'Failed to save page.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!workspaceSlug || !pageId) return;
    setError(null);
    setIsSaving(true);
    try {
      await pageService.delete(workspaceSlug, pageId);
      navigate(`${baseUrl}/pages`);
    } catch (e) {
      setError((e as Error)?.message ?? 'Failed to delete page.');
    } finally {
      setIsSaving(false);
      setDeleteOpen(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8 text-sm text-(--txt-tertiary)">Loading…</div>;
  }

  if (!workspaceSlug || !projectId || !pageId || !baseUrl) {
    return <div className="text-(--txt-secondary)">Project not found.</div>;
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Input
            label="Page title"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Page title"
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
            Back
          </Button>
          <Button onClick={handleSave} disabled={!canSave} isLoading={isSaving}>
            Save
          </Button>
          <Button
            variant="danger"
            onClick={() => setDeleteOpen(true)}
            disabled={isSaving}
            className="hidden sm:inline-flex"
          >
            Delete
          </Button>
        </div>
      </div>

      <PageDescriptionEditor
        ref={editorRef}
        initialHtml={descriptionHtml}
        placeholder="Write the page content…"
        onSaveShortcut={() => void handleSave()}
      />

      {error && <div className="text-sm text-(--txt-danger-primary)">{error}</div>}

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete page"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void handleDelete()} isLoading={isSaving}>
              Delete
            </Button>
          </>
        }
      >
        <div className="text-sm text-(--txt-secondary)">
          This will permanently remove the page.
        </div>
      </Modal>
    </div>
  );
}

