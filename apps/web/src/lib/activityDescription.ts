import i18n from '../i18n';
import type { UserActivityItem } from '../api/types';

/**
 * Field names the activity feed can name in the user's language. Keys mirror
 * the `field` values written by the API (see recordActivity in
 * internal/service/issue.go), with the `_added`/`_removed`/`_updated` suffix
 * stripped — "assignees_added" and "assignees_removed" share one label.
 */
const FIELD_LABELS: Record<string, string> = {
  name: 'name',
  description: 'description',
  priority: 'priority',
  state: 'state',
  start_date: 'start date',
  target_date: 'due date',
  estimate_point: 'estimate',
  parent: 'parent',
  project_id: 'project',
  is_epic: 'epic',
  assignees: 'assignee',
  labels: 'label',
  relation: 'relation',
  link: 'link',
  attachment: 'attachment',
  comment: 'comment',
};

/** Splits "assignees_added" into its field and its action. */
function splitField(field: string): { base: string; action: 'added' | 'removed' | 'updated' } {
  for (const action of ['added', 'removed', 'updated'] as const) {
    const suffix = `_${action}`;
    if (field.endsWith(suffix)) return { base: field.slice(0, -suffix.length), action };
  }
  return { base: field, action: 'updated' };
}

function fieldLabel(base: string): string {
  const fallback = FIELD_LABELS[base] ?? base.replace(/_/g, ' ');
  return i18n.t(`activity.field.${base}`, fallback);
}

/**
 * The display text for one activity-feed row, in the active UI language.
 *
 * Rows carrying free text (a comment, or an activity with its own note) have no
 * `verb` from the API, so their server-rendered `description` is used as-is —
 * it's user content, not a phrase to translate.
 */
export function describeActivity(item: UserActivityItem): string {
  if (!item.verb) return item.description;
  if (item.verb === 'created') return i18n.t('activity.created', 'Created work item');
  if (item.verb === 'deleted') return i18n.t('activity.deleted', 'Deleted work item');
  if (!item.field) return item.description;

  const { base, action } = splitField(item.field);
  const field = fieldLabel(base);
  const oldValue = item.old_value ?? '';
  const newValue = item.new_value ?? '';

  if (action === 'added') {
    const value = newValue || oldValue;
    return value
      ? i18n.t('activity.added', 'Added {{field}}: {{value}}', { field, value })
      : i18n.t('activity.addedBare', 'Added {{field}}', { field });
  }
  if (action === 'removed') {
    const value = oldValue || newValue;
    return value
      ? i18n.t('activity.removed', 'Removed {{field}}: {{value}}', { field, value })
      : i18n.t('activity.removedBare', 'Removed {{field}}', { field });
  }
  if (oldValue && newValue) {
    return i18n.t('activity.updatedFromTo', 'Updated {{field}} from {{old}} to {{new}}', {
      field,
      old: oldValue,
      new: newValue,
    });
  }
  if (newValue) {
    return i18n.t('activity.updatedTo', 'Updated {{field}} to {{new}}', { field, new: newValue });
  }
  if (oldValue) {
    return i18n.t('activity.updatedFrom', 'Updated {{field}} from {{old}}', {
      field,
      old: oldValue,
    });
  }
  return i18n.t('activity.updated', 'Updated {{field}}', { field });
}
