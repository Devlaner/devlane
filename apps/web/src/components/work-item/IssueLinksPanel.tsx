import { useState, type Dispatch, type SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader } from '../ui';
import { issueService } from '../../services/issueService';
import { safeUrl } from '../../lib/sanitize';
import type { IssueLinkApiResponse } from '../../api/types';
import { IconPlus, IconLink } from './issue-detail-icons';

interface IssueLinksPanelProps {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  links: IssueLinkApiResponse[];
  onLinksChange: Dispatch<SetStateAction<IssueLinkApiResponse[]>>;
}

/** Right-rail "Links" card: inline add-link form plus the list of existing links. */
export function IssueLinksPanel({
  workspaceSlug,
  projectId,
  issueId,
  links,
  onLinksChange,
}: IssueLinksPanelProps) {
  const { t } = useTranslation();
  const [addLinkOpen, setAddLinkOpen] = useState(false);
  const [addLinkUrl, setAddLinkUrl] = useState('');
  const [addLinkTitle, setAddLinkTitle] = useState('');
  const [addingLink, setAddingLink] = useState(false);

  return (
    <Card>
      <CardHeader className="flex items-center justify-between text-sm font-medium text-(--txt-secondary)">
        <span className="flex items-center gap-1.5">
          <IconLink />
          {t('workItem.links.title', 'Links')}
        </span>
        <button
          type="button"
          onClick={() => {
            setAddLinkOpen((v) => !v);
            setAddLinkUrl('');
            setAddLinkTitle('');
          }}
          className="rounded p-0.5 text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover)"
          title={t('workItem.links.add', 'Add link')}
        >
          <IconPlus />
        </button>
      </CardHeader>
      <CardContent className="space-y-1 pt-2">
        {addLinkOpen && (
          <form
            className="space-y-1.5 pb-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!addLinkUrl.trim() || !workspaceSlug) return;
              setAddingLink(true);
              try {
                const created = await issueService.createLink(workspaceSlug, projectId, issueId, {
                  url: addLinkUrl.trim(),
                  title: addLinkTitle.trim() || undefined,
                });
                onLinksChange((prev) => [...prev, created]);
                setAddLinkOpen(false);
              } catch {
                /* ignore */
              }
              setAddingLink(false);
            }}
          >
            <input
              type="url"
              placeholder={t('workItem.links.urlPlaceholder', 'https://...')}
              value={addLinkUrl}
              onChange={(e) => setAddLinkUrl(e.target.value)}
              required
              className="w-full rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-canvas) px-2 py-1 text-xs text-(--txt-primary) focus:outline-none focus:ring-1 focus:ring-(--border-focus)"
            />
            <input
              type="text"
              placeholder={t('workItem.links.titlePlaceholder', 'Title (optional)')}
              value={addLinkTitle}
              onChange={(e) => setAddLinkTitle(e.target.value)}
              className="w-full rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-canvas) px-2 py-1 text-xs text-(--txt-primary) focus:outline-none focus:ring-1 focus:ring-(--border-focus)"
            />
            <div className="flex gap-1">
              <button
                type="submit"
                disabled={addingLink}
                className="rounded-(--radius-md) bg-(--bg-accent-primary) px-2 py-1 text-xs text-white disabled:opacity-50"
              >
                {addingLink ? t('workItem.links.adding', 'Adding…') : t('common.add', 'Add')}
              </button>
              <button
                type="button"
                onClick={() => setAddLinkOpen(false)}
                className="rounded-(--radius-md) px-2 py-1 text-xs text-(--txt-secondary) hover:bg-(--bg-layer-1-hover)"
              >
                {t('common.cancel', 'Cancel')}
              </button>
            </div>
          </form>
        )}
        {links.length === 0 && !addLinkOpen ? (
          <p className="text-xs text-(--txt-tertiary)">
            {t('workItem.links.empty', 'No links yet.')}
          </p>
        ) : (
          links.map((l) => (
            <div key={l.id} className="flex items-center gap-1 group">
              <a
                href={safeUrl(l.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate text-xs text-(--txt-accent-primary) hover:underline"
                title={l.url}
              >
                {l.title || l.url}
              </a>
              <button
                type="button"
                onClick={async () => {
                  if (!workspaceSlug) return;
                  await issueService
                    .deleteLink(workspaceSlug, projectId, issueId, l.id)
                    .catch(() => {});
                  onLinksChange((prev) => prev.filter((x) => x.id !== l.id));
                }}
                className="shrink-0 opacity-0 group-hover:opacity-100 rounded p-0.5 text-(--txt-tertiary) hover:text-(--txt-danger-primary)"
                title={t('workItem.links.remove', 'Remove link')}
              >
                ×
              </button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
