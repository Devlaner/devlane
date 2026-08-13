import type { TFunction } from 'i18next';

/**
 * Some strings are looked up with a computed (template-literal) key, e.g.
 * `t(`module.status.${id}`, label)`. i18next-parser can't see those keys
 * statically, so they're registered here with their English defaults to keep the
 * `en`, `az`, and `tr` catalogs complete. This function is never called — it exists so
 * the parser (and translators) have every key. Keep it in sync with the enum
 * sources it mirrors.
 */
export function registerDynamicKeys(t: TFunction) {
  // module statuses (src/lib/moduleStatuses.ts)
  t('module.status.backlog', 'Backlog');
  t('module.status.planned', 'Planned');
  t('module.status.in_progress', 'In Progress');
  t('module.status.paused', 'Paused');
  t('module.status.completed', 'Completed');
  t('module.status.cancelled', 'Cancelled');

  // state groups (STATE_GROUP_LABELS)
  t('stateGroup.backlog', 'Backlog');
  t('stateGroup.unstarted', 'Todo');
  t('stateGroup.started', 'In Progress');
  t('stateGroup.completed', 'Done');
  t('stateGroup.cancelled', 'Cancelled');
  t('views.filter.stateGroup.backlog', 'Backlog');
  t('views.filter.stateGroup.unstarted', 'Todo');
  t('views.filter.stateGroup.started', 'In Progress');
  t('views.filter.stateGroup.completed', 'Done');
  t('views.filter.stateGroup.canceled', 'Cancelled');

  // relation types (RELATION_TYPE_LABELS)
  t('workItem.relationType.blocking', 'Blocking');
  t('workItem.relationType.blocked_by', 'Blocked by');
  t('workItem.relationType.duplicate', 'Duplicate');
  t('workItem.relationType.relates_to', 'Relates to');

  // priorities
  t('views.filter.priority.urgent', 'Urgent');
  t('views.filter.priority.high', 'High');
  t('views.filter.priority.medium', 'Medium');
  t('views.filter.priority.low', 'Low');
  t('views.filter.priority.none', 'None');
  t('profile.priority.urgent', 'Urgent');
  t('profile.priority.high', 'High');
  t('profile.priority.medium', 'Medium');
  t('profile.priority.low', 'Low');
  t('profile.priority.none', 'None');

  // work-item grouping (ProjectSavedViewActiveFilters)
  t('views.filter.grouping.active', 'Active');
  t('views.filter.grouping.backlog', 'Backlog');

  // saved-view display properties (SAVED_VIEW_DISPLAY_PROPERTY_LABELS)
  t('display.property.id', 'ID');
  t('display.property.assignee', 'Assignee');
  t('display.property.start_date', 'Start date');
  t('display.property.due_date', 'Due date');
  t('display.property.labels', 'Labels');
  t('display.property.priority', 'Priority');
  t('display.property.state', 'State');
  t('display.property.sub_work_count', 'Sub-work item count');
  t('display.property.attachment_count', 'Attachment count');
  t('display.property.link', 'Link');
  t('display.property.estimate', 'Estimate');
  t('display.property.module', 'Module');
  t('display.property.cycle', 'Cycle');

  // view access (viewAccessInfo)
  t('views.access.public', 'Public');
  t('views.access.private', 'Private');
  t('views.access.restricted', 'Restricted');

  // settings sections (src/components/settings/sections-config.tsx)
  t('settings.section.general', 'General');
  t('settings.section.members', 'Members');
  t('settings.section.features', 'Features');
  t('settings.section.notifications', 'Notifications');
  t('settings.section.states', 'States');
  t('settings.section.labels', 'Labels');
  t('settings.section.estimates', 'Estimates');
  t('settings.section.automations', 'Automations');
  t('settings.section.profile', 'Profile');
  t('settings.section.preferences', 'Preferences');
  t('settings.section.security', 'Security');
  t('settings.section.activity', 'Activity');
  t('settings.section.tokens', 'Personal Access Tokens');
  t('settings.section.integrations', 'Integrations');
  t('settings.section.exports', 'Exports');
  t('settings.section.webhooks', 'Webhooks');

  // webhook event labels + hints (WebhooksSettings EVENTS)
  t('settings.webhooks.event.issue.label', 'Issues');
  t('settings.webhooks.event.issue.hint', 'Created, updated, or deleted issues');
  t('settings.webhooks.event.project.label', 'Projects');
  t('settings.webhooks.event.project.hint', 'Project lifecycle changes');
  t('settings.webhooks.event.module.label', 'Modules');
  t('settings.webhooks.event.module.hint', 'Module changes');
  t('settings.webhooks.event.cycle.label', 'Cycles');
  t('settings.webhooks.event.cycle.hint', 'Cycle changes');
  t('settings.webhooks.event.issue_comment.label', 'Issue comments');
  t('settings.webhooks.event.issue_comment.hint', 'New comments on issues');

  // instance-admin sections (InstanceAdminLayout SECTIONS)
  t('instanceAdmin.section.general', 'General');
  t('instanceAdmin.section.admins', 'Admins');
  t('instanceAdmin.section.workspace', 'Workspaces');
  t('instanceAdmin.section.email', 'Email');
  t('instanceAdmin.section.authentication', 'Authentication');
  t('instanceAdmin.section.ai', 'Artificial intelligence');
  t('instanceAdmin.section.image', 'Images in Devlane');
  t('instanceAdmin.section.integrations', 'Integrations');

  // project section switcher (ProjectSectionDropdown / ProjectSectionHeader)
  t('header.section.issues', 'Work items');
  t('header.section.cycles', 'Cycles');
  t('header.section.modules', 'Modules');
  t('header.section.pages', 'Pages');
  t('header.section.views', 'Views');

  // org-size select (constants/workspace.ts)
  t('workspace.orgSize.selectRange', 'Select a range');
}
