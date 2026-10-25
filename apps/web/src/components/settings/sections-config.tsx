import type { ReactNode } from 'react';
import { Bot } from 'lucide-react';
import {
  IconGrid,
  IconUsers,
  IconZap,
  IconActivity,
  IconTag,
  IconClock,
  IconArchive,
  IconPerson,
  IconGear,
  IconBell,
  IconLock,
  IconKey,
  IconPlug,
  IconUpload,
  IconWebhook,
} from './icons';

export type WorkspaceSettingsSection =
  | 'general'
  | 'members'
  | 'agents'
  | 'notifications'
  | 'api-tokens'
  | 'integrations'
  | 'exports'
  | 'webhooks';
export type ProjectSettingsSection =
  | 'general'
  | 'members'
  | 'features'
  | 'notifications'
  | 'states'
  | 'labels'
  | 'estimates'
  | 'automations';
export type AccountSettingsSection =
  | 'profile'
  | 'preferences'
  | 'notifications'
  | 'security'
  | 'activity'
  | 'tokens';

export interface SettingsSectionConfig<T extends string> {
  id: T;
  label: string;
  icon: ReactNode;
}

export const PROJECT_SECTIONS: SettingsSectionConfig<ProjectSettingsSection>[] = [
  { id: 'general', label: 'General', icon: <IconGrid /> },
  { id: 'members', label: 'Members', icon: <IconUsers /> },
  { id: 'features', label: 'Features', icon: <IconZap /> },
  { id: 'notifications', label: 'Notifications', icon: <IconBell /> },
  { id: 'states', label: 'States', icon: <IconActivity /> },
  { id: 'labels', label: 'Labels', icon: <IconTag /> },
  { id: 'estimates', label: 'Estimates', icon: <IconClock /> },
  { id: 'automations', label: 'Automations', icon: <IconArchive /> },
];

export const ACCOUNT_SECTIONS_PROFILE: SettingsSectionConfig<AccountSettingsSection>[] = [
  { id: 'profile', label: 'Profile', icon: <IconPerson /> },
  { id: 'preferences', label: 'Preferences', icon: <IconGear /> },
  { id: 'notifications', label: 'Notifications', icon: <IconBell /> },
  { id: 'security', label: 'Security', icon: <IconLock /> },
  { id: 'activity', label: 'Activity', icon: <IconActivity /> },
];

export const ACCOUNT_SECTIONS_DEVELOPER: SettingsSectionConfig<AccountSettingsSection>[] = [
  { id: 'tokens', label: 'Personal Access Tokens', icon: <IconKey /> },
];

// The nav groups these as Administration = slice(0, 5), Developer = slice(5).
// Keep the first five as the admin sections; append Developer-facing ones.
export const WORKSPACE_SECTIONS: SettingsSectionConfig<WorkspaceSettingsSection>[] = [
  { id: 'general', label: 'General', icon: <IconGrid /> },
  { id: 'members', label: 'Members', icon: <IconUsers /> },
  { id: 'agents', label: 'Agents', icon: <Bot className="size-4" /> },
  { id: 'notifications', label: 'Notifications', icon: <IconBell /> },
  { id: 'integrations', label: 'Integrations', icon: <IconPlug /> },
  { id: 'exports', label: 'Exports', icon: <IconUpload /> },
  { id: 'webhooks', label: 'Webhooks', icon: <IconWebhook /> },
  { id: 'api-tokens', label: 'API Tokens', icon: <IconKey /> },
];
