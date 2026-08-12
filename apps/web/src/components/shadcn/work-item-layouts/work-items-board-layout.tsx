import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/shadcn/ui/avatar';
import { Badge } from '@/components/shadcn/ui/badge';
import { Card, CardContent } from '@/components/shadcn/ui/card';
import { ScrollArea, ScrollBar } from '@/components/shadcn/ui/scroll-area';
import { cn, getImageUrl } from '@/lib/utils';
import { IssuePRBadge } from '@/components/work-item/IssuePRBadge';
import {
  PRIORITY_LABELS,
  formatDate,
  priorityVariant,
  stateDotStyle,
} from '../../../lib/projectV2';
import type {
  GroupedIssuesResult,
  SubGroupedIssuesResult,
} from '../../../lib/issueListGroupAndSort';
import type { SavedViewDisplayPropertyId } from '../../../lib/projectSavedViewDisplay';
import type { SavedViewGroupBy } from '../../../lib/projectSavedViewDisplay';
import type {
  GitHubIssueSummaryEntry,
  IssueApiResponse,
  LabelApiResponse,
  StateApiResponse,
  WorkspaceMemberApiResponse,
} from '../../../api/types';
import type { Priority } from '../../../types';

interface WorkItemsBoardLayoutProps {
  groupedIssues: GroupedIssuesResult;
  /** Swimlanes inside each column; null when sub-grouping does not apply. */
  subGroupedIssues: SubGroupedIssuesResult | null;
  showEmptyGroups: boolean;
  groupBy: SavedViewGroupBy;
  states: StateApiResponse[];
  labels: LabelApiResponse[];
  members: WorkspaceMemberApiResponse[];
  prSummary: Record<string, GitHubIssueSummaryEntry>;
  hasCol: (id: SavedViewDisplayPropertyId) => boolean;
  issueUrl: (issueId: string) => string;
  /** Only wired while grouping by state: dropping a card moves its state. */
  onCardMove: (issueId: string, targetStateId: string) => void;
}

/**
 * Kanban board over the shared grouping. Columns are the groups the controller
 * produced, so group-by, order-by and every filter apply here exactly as they do
 * in the table.
 */
export function WorkItemsBoardLayout({
  groupedIssues,
  subGroupedIssues,
  showEmptyGroups,
  groupBy,
  states,
  labels,
  members,
  prSummary,
  hasCol,
  issueUrl,
  onCardMove,
}: WorkItemsBoardLayoutProps) {
  const { t } = useTranslation();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const stateById = new Map(states.map((state) => [state.id, state]));
  const labelById = new Map(labels.map((label) => [label.id, label]));
  const memberById = new Map(members.map((member) => [member.member_id ?? member.id, member]));
  const dragEnabled = groupBy === 'states';

  const memberLabel = (memberId: string) => {
    const member = memberById.get(memberId);
    return (
      member?.member_display_name?.trim() ||
      member?.member_email?.trim() ||
      t('common.member', 'Member')
    );
  };

  const renderCard = (issue: IssueApiResponse) => (
    <Card
      key={issue.id}
      draggable={dragEnabled}
      onDragStart={(event) => {
        if (!dragEnabled) return;
        setDraggingId(issue.id);
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', issue.id);
      }}
      onDragEnd={() => {
        setDraggingId(null);
        setDropTarget(null);
      }}
      className={cn(
        'gap-0 py-0 shadow-none transition-colors',
        dragEnabled && 'cursor-grab active:cursor-grabbing',
        draggingId === issue.id && 'opacity-50',
      )}
    >
      <CardContent className="space-y-2 p-3">
        <div className="flex items-start gap-2">
          <Link
            to={issueUrl(issue.id)}
            className="focus-visible:ring-ring min-w-0 flex-1 rounded-sm text-sm font-medium outline-none focus-visible:ring-2"
          >
            <span className="line-clamp-2">{issue.name}</span>
          </Link>
          <IssuePRBadge summary={prSummary[issue.id]} />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {hasCol('priority') && (
            <Badge variant={priorityVariant(issue.priority)}>
              {PRIORITY_LABELS[(issue.priority ?? 'none') as Priority] ?? issue.priority}
            </Badge>
          )}
          {hasCol('labels') &&
            (issue.label_ids ?? [])
              .filter((id) => labelById.has(id))
              .slice(0, 2)
              .map((id) => (
                <Badge key={id} variant="outline" className="max-w-28">
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full"
                    style={{
                      backgroundColor: labelById.get(id)?.color || 'var(--muted-foreground)',
                    }}
                  />
                  <span className="truncate">{labelById.get(id)?.name}</span>
                </Badge>
              ))}
        </div>

        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          {hasCol('id') && <span className="font-mono">#{issue.sequence_id ?? ''}</span>}
          {hasCol('due_date') && issue.target_date && <span>{formatDate(issue.target_date)}</span>}
          {hasCol('assignee') && (issue.assignee_ids?.length ?? 0) > 0 && (
            <span className="ml-auto flex -space-x-2">
              {(issue.assignee_ids ?? []).slice(0, 3).map((memberId) => (
                <Avatar
                  key={memberId}
                  className="border-background size-6 border-2"
                  title={memberLabel(memberId)}
                >
                  <AvatarImage
                    src={getImageUrl(memberById.get(memberId)?.member_avatar) ?? ''}
                    alt=""
                  />
                  <AvatarFallback className="text-[10px]">
                    {memberLabel(memberId).slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <ScrollArea className="w-full">
      <div className="flex min-h-96 items-start gap-4 pb-4">
        {(subGroupedIssues?.primaryOrder ?? groupedIssues.order).map((groupKey) => {
          const laneCells = subGroupedIssues?.cells.get(groupKey);
          const items = subGroupedIssues
            ? subGroupedIssues.subOrder.flatMap((subKey) => laneCells?.get(subKey) ?? [])
            : (groupedIssues.groups.get(groupKey) ?? []);
          const columnState = stateById.get(groupKey);
          return (
            <section
              key={groupKey}
              className={cn(
                'bg-muted/30 flex w-72 shrink-0 flex-col rounded-xl border',
                dropTarget === groupKey && 'ring-ring ring-2',
              )}
              aria-label={
                subGroupedIssues
                  ? subGroupedIssues.primaryTitle(groupKey)
                  : groupedIssues.title(groupKey)
              }
              onDragOver={(event) => {
                if (!dragEnabled || !draggingId || !columnState) return;
                event.preventDefault();
                setDropTarget(groupKey);
              }}
              onDragLeave={() =>
                setDropTarget((current) => (current === groupKey ? null : current))
              }
              onDrop={(event) => {
                if (!dragEnabled || !columnState) return;
                event.preventDefault();
                const issueId = event.dataTransfer.getData('text/plain') || draggingId;
                setDraggingId(null);
                setDropTarget(null);
                if (issueId) onCardMove(issueId, columnState.id);
              }}
            >
              <header className="flex items-center gap-2 border-b px-3 py-2.5">
                {groupBy === 'states' && (
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full"
                    style={stateDotStyle(columnState)}
                  />
                )}
                <span className="truncate text-sm font-medium">
                  {subGroupedIssues
                    ? subGroupedIssues.primaryTitle(groupKey)
                    : groupedIssues.title(groupKey)}
                </span>
                <Badge variant="secondary" className="ml-auto tabular-nums">
                  {items.length}
                </Badge>
              </header>

              <div className="flex flex-col gap-2 p-2">
                {items.length === 0 && (
                  <p className="text-muted-foreground px-2 py-6 text-center text-xs">
                    {t('common.none', 'None')}
                  </p>
                )}
                {subGroupedIssues
                  ? subGroupedIssues.subOrder.map((subKey) => {
                      const laneItems = laneCells?.get(subKey) ?? [];
                      if (laneItems.length === 0 && !showEmptyGroups) return null;
                      return (
                        <div key={subKey} className="space-y-2">
                          <p className="text-muted-foreground flex items-center gap-2 px-1 pt-1 text-[11px] font-medium">
                            <span className="truncate">{subGroupedIssues.subTitle(subKey)}</span>
                            <Badge variant="outline" className="tabular-nums">
                              {laneItems.length}
                            </Badge>
                          </p>
                          {laneItems.map(renderCard)}
                        </div>
                      );
                    })
                  : items.map(renderCard)}
              </div>
            </section>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
