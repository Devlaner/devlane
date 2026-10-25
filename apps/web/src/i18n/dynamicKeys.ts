import type { TFunction } from 'i18next';

/**
 * Some strings are looked up with a computed (template-literal) key, e.g.
 * `t(`module.status.${id}`, label)`. i18next-parser can't see those keys
 * statically, so they're registered here with their English defaults to keep the
 * `en` and `az` catalogs complete. This function is never called — it exists so
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

  // instance-admin sections (InstanceAdminLayout SECTIONS) — label + description
  t('instanceAdmin.section.general.label', 'General');
  t('instanceAdmin.section.general.desc', 'Identify your instances and get key details.');
  t('instanceAdmin.section.admins.label', 'Admins');
  t('instanceAdmin.section.admins.desc', 'Manage instance administrators.');
  t('instanceAdmin.section.workspace.label', 'Workspaces');
  t('instanceAdmin.section.workspace.desc', 'Manage all workspaces on this instance.');
  t('instanceAdmin.section.email.label', 'Email');
  t('instanceAdmin.section.email.desc', 'Configure your SMTP controls.');
  t('instanceAdmin.section.authentication.label', 'Authentication');
  t('instanceAdmin.section.authentication.desc', 'Configure authentication modes.');
  t('instanceAdmin.section.ai.label', 'Artificial intelligence');
  t('instanceAdmin.section.ai.desc', 'Configure your OpenAI creds.');
  t('instanceAdmin.section.image.label', 'Images in Devlane');
  t('instanceAdmin.section.image.desc', 'Allow third-party image libraries.');
  t('instanceAdmin.section.integrations.label', 'Integrations');
  t('instanceAdmin.section.integrations.desc', 'Configure GitHub and other integrations.');

  // instance-admin breadcrumb (InstanceAdminLayout BREADCRUMB_LABEL)
  t('instanceAdmin.breadcrumb.settings', 'Settings');
  t('instanceAdmin.breadcrumb.general', 'General');
  t('instanceAdmin.breadcrumb.admins', 'Admins');
  t('instanceAdmin.breadcrumb.workspace', 'Workspace');
  t('instanceAdmin.breadcrumb.email', 'Email');
  t('instanceAdmin.breadcrumb.authentication', 'Authentication');
  t('instanceAdmin.breadcrumb.ai', 'Artificial Intelligence');
  t('instanceAdmin.breadcrumb.image', 'Image');
  t('instanceAdmin.breadcrumb.integrations', 'Integrations');

  // project section switcher (ProjectSectionDropdown / ProjectSectionHeader)
  t('header.section.issues', 'Work items');
  t('header.section.cycles', 'Cycles');
  t('header.section.modules', 'Modules');
  t('header.section.pages', 'Pages');
  t('header.section.views', 'Views');

  // project sidebar nav (Sidebar)
  t('nav.project.issues', 'Work items');
  t('nav.project.epics', 'Epics');
  t('nav.project.cycles', 'Cycles');
  t('nav.project.modules', 'Modules');
  t('nav.project.views', 'Views');
  t('nav.project.pages', 'Pages');
  t('nav.project.intake', 'Intake');

  // home widgets (WorkspaceHomePage)
  t('home.widget.quicklinks', 'Quicklinks');
  t('home.widget.recents', 'Recents');
  t('home.widget.stickies', 'Your stickies');

  // notifications tabs (NotificationsPage)
  t('notifications.tab.all', 'All');
  t('notifications.tab.mentions', 'Mentions');
  t('notifications.tab.archived', 'Archived');

  // pages tabs + sort (PagesPage)
  t('pages.tab.public', 'Public');
  t('pages.tab.private', 'Private');
  t('pages.tab.archived', 'Archived');
  t('pages.sort.updated_at', 'Date modified');
  t('pages.sort.created_at', 'Date created');
  t('pages.sort.name', 'Name');

  // saved-view date presets (ProjectSavedViewActiveFilters)
  t('views.filter.datePreset.1_week', 'Last 1 week');
  t('views.filter.datePreset.2_weeks', 'Last 2 weeks');
  t('views.filter.datePreset.1_month', 'Last 1 month');
  t('views.filter.datePreset.2_months', 'Last 2 months');
  t('views.filter.datePreset.custom', 'Custom range');

  // estimate type options (ProjectEstimatesSettings)
  t('settings.estimates.typeOption.points', 'Points');
  t('settings.estimates.typeOption.categories', 'Categories');

  // notification preference rows (NotificationPreferencesPanel) — label + desc
  t('settings.notifications.row.property.label', 'Property changes');
  t(
    'settings.notifications.row.property.desc',
    "Notify me when work items' properties like assignees, priority, or estimates change.",
  );
  t('settings.notifications.row.state.label', 'State change');
  t(
    'settings.notifications.row.state.desc',
    'Notify me when a work item moves to a different state.',
  );
  t('settings.notifications.row.completed.label', 'Work item completed');
  t('settings.notifications.row.completed.desc', 'Notify me when a work item is completed.');
  t('settings.notifications.row.comments.label', 'Comments');
  t('settings.notifications.row.comments.desc', 'Notify me when someone comments on a work item.');
  t('settings.notifications.row.mentions.label', 'Mentions');
  t(
    'settings.notifications.row.mentions.desc',
    'Notify me when someone mentions me in a comment or description.',
  );

  // page-editor colour names (ColorDropdown)
  t('editor.colorName.gray', 'Gray');
  t('editor.colorName.brown', 'Brown');
  t('editor.colorName.orange', 'Orange');
  t('editor.colorName.yellow', 'Yellow');
  t('editor.colorName.green', 'Green');
  t('editor.colorName.blue', 'Blue');
  t('editor.colorName.purple', 'Purple');
  t('editor.colorName.red', 'Red');

  // page-editor slash menu (slashCommands ITEMS) — title + subtitle
  t('editor.slash.text.title', 'Text');
  t('editor.slash.text.subtitle', 'Plain paragraph');
  t('editor.slash.heading1.title', 'Heading 1');
  t('editor.slash.heading1.subtitle', 'Large section heading');
  t('editor.slash.heading2.title', 'Heading 2');
  t('editor.slash.heading2.subtitle', 'Medium section heading');
  t('editor.slash.heading3.title', 'Heading 3');
  t('editor.slash.heading3.subtitle', 'Small section heading');
  t('editor.slash.bulletList.title', 'Bulleted list');
  t('editor.slash.bulletList.subtitle', 'Unordered list');
  t('editor.slash.numberedList.title', 'Numbered list');
  t('editor.slash.numberedList.subtitle', 'Ordered list');
  t('editor.slash.todoList.title', 'To-do list');
  t('editor.slash.todoList.subtitle', 'Checklist');
  t('editor.slash.quote.title', 'Quote');
  t('editor.slash.quote.subtitle', 'Block quote');
  t('editor.slash.codeBlock.title', 'Code block');
  t('editor.slash.codeBlock.subtitle', 'Formatted code');
  t('editor.slash.table.title', 'Table');
  t('editor.slash.table.subtitle', '3x3 table');
  t('editor.slash.image.title', 'Image');
  t('editor.slash.image.subtitle', 'Embed by URL');
  t('editor.slash.divider.title', 'Divider');
  t('editor.slash.divider.subtitle', 'Horizontal rule');

  // page-editor toolbar (PageEditorToolbar item.labelKey)
  t('editor.toolbar.bold', 'Bold');
  t('editor.toolbar.italic', 'Italic');
  t('editor.toolbar.underline', 'Underline');
  t('editor.toolbar.strikethrough', 'Strikethrough');
  t('editor.toolbar.alignLeft', 'Left align');
  t('editor.toolbar.alignCenter', 'Center align');
  t('editor.toolbar.alignRight', 'Right align');
  t('editor.toolbar.numberedList', 'Numbered list');
  t('editor.toolbar.bulletedList', 'Bulleted list');
  t('editor.toolbar.todoList', 'To-do list');
  t('editor.toolbar.quote', 'Quote');
  t('editor.toolbar.inlineCode', 'Inline code');
  t('editor.toolbar.codeBlock', 'Code block');
  t('editor.toolbar.insertTable', 'Insert table');
  t('editor.toolbar.insertImage', 'Insert image');
  t('editor.toolbar.imageUrlPrompt', 'Image URL');

  // org-size select (constants/workspace.ts)
  t('workspace.orgSize.selectRange', 'Select a range');
}
