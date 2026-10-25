import { useState, type Dispatch, type SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '../ui';
import { issueService } from '../../services/issueService';
import type {
  IssueApiResponse,
  IssueRelationApiResponse,
  IssueRelationType,
} from '../../api/types';
import { IconPlus, IconRelation, RELATION_TYPE_LABELS } from './issue-detail-icons';

interface IssueRelationsPanelProps {
  workspaceSlug: string;
  projectId: string;
  projectIdentifier: string;
  issueId: string;
  baseUrl: string;
  allIssues: IssueApiResponse[];
  relations: IssueRelationApiResponse;
  onRelationsChange: Dispatch<SetStateAction<IssueRelationApiResponse>>;
}

/** Right-rail "Relations" card: inline add-relation form plus the list grouped by relation type. */
export function IssueRelationsPanel({
  workspaceSlug,
  projectId,
  projectIdentifier,
  issueId,
  baseUrl,
  allIssues,
  relations,
  onRelationsChange,
}: IssueRelationsPanelProps) {
  const { t } = useTranslation();
  const [addRelationOpen, setAddRelationOpen] = useState(false);
  const [addRelationType, setAddRelationType] = useState<IssueRelationType>('relates_to');
  const [addRelationSearch, setAddRelationSearch] = useState('');
  const [addingRelation, setAddingRelation] = useState(false);

  return (
    <Card>
      <CardHeader className="flex items-center justify-between text-sm font-medium text-(--txt-secondary)">
        <span className="flex items-center gap-1.5">
          <IconRelation />
          {t('workItem.relations.title', 'Relations')}
        </span>
        <button
          type="button"
          onClick={() => {
            setAddRelationOpen((v) => !v);
            setAddRelationSearch('');
          }}
          className="rounded p-0.5 text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover)"
          title={t('workItem.relations.add', 'Add relation')}
        >
          <IconPlus />
        </button>
      </CardHeader>
      <CardContent className="space-y-2 pt-2">
        {addRelationOpen && (
          <div className="space-y-1.5 pb-2">
            <select
              value={addRelationType}
              onChange={(e) => setAddRelationType(e.target.value as IssueRelationType)}
              className="w-full rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-canvas) px-2 py-1 text-xs text-(--txt-primary) focus:outline-none"
            >
              {Object.entries(RELATION_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {t(`workItem.relationType.${v}`, l)}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder={t('workItem.relations.searchPlaceholder', 'Search issues…')}
              value={addRelationSearch}
              onChange={(e) => setAddRelationSearch(e.target.value)}
              className="w-full rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-canvas) px-2 py-1 text-xs text-(--txt-primary) focus:outline-none focus:ring-1 focus:ring-(--border-focus)"
            />
            <div className="max-h-40 overflow-y-auto space-y-0.5">
              {allIssues
                .filter(
                  (i) =>
                    i.id !== issueId &&
                    (addRelationSearch === '' ||
                      i.name.toLowerCase().includes(addRelationSearch.toLowerCase())),
                )
                .slice(0, 20)
                .map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    disabled={addingRelation}
                    className="flex w-full items-center gap-2 rounded-(--radius-md) px-2 py-1 text-left text-xs hover:bg-(--bg-layer-1-hover) disabled:opacity-50"
                    onClick={async () => {
                      if (!workspaceSlug) return;
                      setAddingRelation(true);
                      try {
                        await issueService.addRelation(
                          workspaceSlug,
                          projectId,
                          issueId,
                          addRelationType,
                          [candidate.id],
                        );
                        const updated = await issueService.listRelations(
                          workspaceSlug,
                          projectId,
                          issueId,
                        );
                        onRelationsChange(updated);
                        setAddRelationOpen(false);
                      } catch {
                        /* ignore */
                      }
                      setAddingRelation(false);
                    }}
                  >
                    <span className="shrink-0 text-[11px] font-medium text-(--txt-accent-primary)">
                      {projectIdentifier}-{candidate.sequence_id}
                    </span>
                    <span className="truncate text-(--txt-primary)">{candidate.name}</span>
                  </button>
                ))}
            </div>
            <button
              type="button"
              onClick={() => setAddRelationOpen(false)}
              className="text-xs text-(--txt-tertiary) hover:text-(--txt-secondary)"
            >
              {t('common.cancel', 'Cancel')}
            </button>
          </div>
        )}
        {(['blocking', 'blocked_by', 'duplicate', 'relates_to'] as IssueRelationType[]).map(
          (rtype) => {
            const group = relations[rtype];
            if (!group?.length) return null;
            return (
              <div key={rtype}>
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-(--txt-tertiary)">
                  {t(`workItem.relationType.${rtype}`, RELATION_TYPE_LABELS[rtype])}
                </p>
                <div className="space-y-0.5">
                  {group.map((rel) => (
                    <div key={rel.id} className="flex items-center gap-1 group">
                      <Link
                        to={`${baseUrl}/issues/${rel.id}`}
                        className="min-w-0 flex-1 truncate text-xs text-(--txt-accent-primary) hover:underline"
                      >
                        {projectIdentifier}-{rel.sequence_id} {rel.name}
                      </Link>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!workspaceSlug) return;
                          await issueService
                            .removeRelation(workspaceSlug, projectId, issueId, rtype, rel.id)
                            .catch(() => {});
                          onRelationsChange((prev) => ({
                            ...prev,
                            [rtype]: prev[rtype].filter((x) => x.id !== rel.id),
                          }));
                        }}
                        className="shrink-0 opacity-0 group-hover:opacity-100 rounded p-0.5 text-(--txt-tertiary) hover:text-(--txt-danger-primary)"
                        title={t('common.remove', 'Remove')}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          },
        )}
        {!addRelationOpen && Object.values(relations).every((g) => !g?.length) && (
          <p className="text-xs text-(--txt-tertiary)">
            {t('workItem.relations.empty', 'No relations yet.')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
