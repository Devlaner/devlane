import { useEffect, useState } from 'react';
import { Copy, Pencil, Trash2, Link as LinkIcon, Plus } from 'lucide-react';
import { moduleService, type ModuleLinkApiResponse } from '../../services/moduleService';
import { safeUrl } from '../../lib/sanitize';
import { ModuleLinkModal } from './ModuleLinkModal';

interface ModuleLinksSectionProps {
  workspaceSlug: string;
  projectId: string;
  moduleId: string;
}

function timeAgo(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const sec = Math.max(1, Math.floor((Date.now() - t) / 1000));
  const units: [number, string][] = [
    [31536000, 'year'],
    [2592000, 'month'],
    [604800, 'week'],
    [86400, 'day'],
    [3600, 'hour'],
    [60, 'minute'],
  ];
  for (const [s, label] of units) {
    const v = Math.floor(sec / s);
    if (v >= 1) return `${v} ${label}${v > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}

/** Small favicon for a link, falling back to a generic icon. */
function LinkFavicon({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    host = '';
  }
  if (failed || !host) {
    return <LinkIcon className="size-3.5 shrink-0 text-(--txt-icon-tertiary)" />;
  }
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`}
      alt=""
      className="size-3.5 shrink-0 rounded-sm"
      onError={() => setFailed(true)}
    />
  );
}

/**
 * "Links" panel for a module: a list of link cards (favicon + title, with copy /
 * edit / delete on hover and an "added … ago" line) plus an add button that
 * opens the create/edit modal. Fetches its own data.
 */
export function ModuleLinksSection({
  workspaceSlug,
  projectId,
  moduleId,
}: ModuleLinksSectionProps) {
  const [links, setLinks] = useState<ModuleLinkApiResponse[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ModuleLinkApiResponse | null>(null);

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

  const submit = async (data: { url: string; title: string }, id?: string) => {
    if (id) {
      await moduleService.updateLink(workspaceSlug, projectId, moduleId, id, data);
    } else {
      await moduleService.createLink(workspaceSlug, projectId, moduleId, data);
    }
    load();
  };

  const remove = async (id: string) => {
    try {
      await moduleService.deleteLink(workspaceSlug, projectId, moduleId, id);
      load();
    } catch {
      // best-effort
    }
  };

  const copy = (url: string) => {
    void navigator.clipboard?.writeText(url);
  };

  const actionBtn =
    'grid place-items-center rounded-sm p-1 text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover)';

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-(--txt-secondary)">Links</h3>
        <button
          type="button"
          aria-label="Add link"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          className="grid place-items-center rounded-sm p-1 text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
        >
          <Plus className="size-4" />
        </button>
      </div>

      {links.length > 0 && (
        <div className="space-y-2">
          {links.map((l) => (
            <div
              key={l.id}
              className="group relative flex flex-col rounded-(--radius-md) bg-(--bg-layer-2) p-2.5"
            >
              <div className="flex w-full items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2">
                  <span className="py-0.5">
                    <LinkFavicon url={l.url} />
                  </span>
                  <a
                    href={safeUrl(l.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={l.title || l.url}
                    className="truncate text-[11px] text-(--txt-accent-primary) hover:underline"
                  >
                    {l.title || l.url}
                  </a>
                </div>
                <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    aria-label="Edit link"
                    className={actionBtn}
                    onClick={() => {
                      setEditing(l);
                      setModalOpen(true);
                    }}
                  >
                    <Pencil className="size-3" />
                  </button>
                  <button
                    type="button"
                    aria-label="Copy link"
                    className={actionBtn}
                    onClick={() => copy(l.url)}
                  >
                    <Copy className="size-3" />
                  </button>
                  <button
                    type="button"
                    aria-label="Remove link"
                    className="grid place-items-center rounded-sm p-1 text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-danger-primary)"
                    onClick={() => void remove(l.id)}
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </div>
              <p className="mt-0.5 pl-5 text-[11px] text-(--txt-tertiary)">
                Added {timeAgo(l.created_at)}
              </p>
            </div>
          ))}
        </div>
      )}

      <ModuleLinkModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initial={editing}
        onSubmit={submit}
      />
    </section>
  );
}
