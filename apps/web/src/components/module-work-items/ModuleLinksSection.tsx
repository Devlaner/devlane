import { useEffect, useState } from 'react';
import { Trash2, Plus, LinkIcon } from 'lucide-react';
import { moduleService, type ModuleLinkApiResponse } from '../../services/moduleService';
import { safeUrl } from '../../lib/sanitize';

interface ModuleLinksSectionProps {
  workspaceSlug: string;
  projectId: string;
  moduleId: string;
}

/**
 * Self-contained "Links" panel for a module: lists external links and lets the
 * user add or remove them. Fetches its own data so it can drop into the module
 * detail page without threading state through the parent.
 */
export function ModuleLinksSection({
  workspaceSlug,
  projectId,
  moduleId,
}: ModuleLinksSectionProps) {
  const [links, setLinks] = useState<ModuleLinkApiResponse[]>([]);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    moduleService
      .listLinks(workspaceSlug, projectId, moduleId)
      .then(setLinks)
      .catch(() => setLinks([]));
  };

  useEffect(() => {
    let cancelled = false;
    moduleService
      .listLinks(workspaceSlug, projectId, moduleId)
      .then((l) => {
        if (!cancelled) setLinks(l);
      })
      .catch(() => {
        if (!cancelled) setLinks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId, moduleId]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await moduleService.createLink(workspaceSlug, projectId, moduleId, {
        url: trimmed,
        title: title.trim() || undefined,
      });
      setUrl('');
      setTitle('');
      load();
    } catch {
      // best-effort
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await moduleService.deleteLink(workspaceSlug, projectId, moduleId, id);
      load();
    } catch {
      // best-effort
    }
  };

  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-sm font-medium text-(--txt-secondary)">
        <LinkIcon className="h-3.5 w-3.5" />
        Links
      </h3>
      {links.length > 0 && (
        <ul className="space-y-1">
          {links.map((l) => (
            <li
              key={l.id}
              className="group flex items-center justify-between gap-2 rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-2.5 py-1.5"
            >
              <a
                href={safeUrl(l.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-sm text-(--txt-accent-primary) hover:underline"
                title={l.url}
              >
                {l.title || l.url}
              </a>
              <button
                type="button"
                onClick={() => void remove(l.id)}
                className="shrink-0 text-(--txt-icon-tertiary) opacity-0 transition-opacity group-hover:opacity-100 hover:text-(--txt-danger-primary)"
                aria-label="Remove link"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="flex items-center gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          className="min-w-0 flex-1 rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-2 py-1 text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none focus:ring-1 focus:ring-(--border-focus)"
        />
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          className="w-32 rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-2 py-1 text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none focus:ring-1 focus:ring-(--border-focus)"
        />
        <button
          type="submit"
          disabled={!url.trim() || busy}
          className="inline-flex shrink-0 items-center gap-1 rounded-(--radius-md) border border-(--border-subtle) px-2 py-1 text-xs text-(--txt-secondary) hover:bg-(--bg-layer-1-hover) disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </form>
    </section>
  );
}
