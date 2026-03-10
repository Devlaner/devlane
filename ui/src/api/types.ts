/**
 * API request/response types.
 * Keeps API contracts in one place for services and consumers.
 */

/** Request body for POST /api/workspaces/ */
export interface CreateWorkspaceRequest {
  name: string;
  slug: string;
}

/** Workspace as returned by the API (list + get) */
export interface WorkspaceApiResponse {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  logo?: string;
  created_at?: string;
  updated_at?: string;
}

/** Workspace member as returned by the API */
export interface WorkspaceMemberApiResponse {
  id: string;
  workspace_id: string;
  member_id: string;
  role: number;
  member_display_name?: string;
  member_email?: string | null;
  member_avatar?: string;
  created_at?: string;
  updated_at?: string;
}

/** Workspace invite as returned by the API */
export interface WorkspaceInviteApiResponse {
  id: string;
  workspace_id: string;
  email: string;
  accepted: boolean;
  token: string;
  role: number;
  created_at?: string;
  updated_at?: string;
}

/** GET /api/invitations/by-token/?token=... (public) */
export interface InviteByTokenResponse {
  workspace_name: string;
  workspace_slug: string;
  email: string;
  invitation_id: string;
}

/** Request body for POST /api/workspaces/:slug/projects/ */
export interface CreateProjectRequest {
  name: string;
  identifier?: string;
  description?: string;
  timezone?: string;
  cover_image?: string;
  emoji?: string;
  icon_prop?: ProjectIconProp | null;
  project_lead_id?: string;
  default_assignee_id?: string;
  guest_view_all_features?: boolean;
  module_view?: boolean;
  cycle_view?: boolean;
  issue_views_view?: boolean;
  page_view?: boolean;
  intake_view?: boolean;
  is_time_tracking_enabled?: boolean;
}

/** Project icon_prop from API (name + optional color) */
export interface ProjectIconProp {
  name?: string;
  color?: string;
}

/** Project as returned by the API (list + get) */
export interface ProjectApiResponse {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  identifier?: string;
  slug?: string;
  timezone?: string;
  cover_image?: string;
  emoji?: string;
  icon_prop?: ProjectIconProp | null;
  project_lead_id?: string | null;
  default_assignee_id?: string | null;
  guest_view_all_features?: boolean;
  module_view?: boolean;
  cycle_view?: boolean;
  issue_views_view?: boolean;
  page_view?: boolean;
  intake_view?: boolean;
  is_time_tracking_enabled?: boolean;
  created_at?: string;
  updated_at?: string;
}

/** Project member as returned by the API */
export interface ProjectMemberApiResponse {
  id: string;
  project_id: string;
  workspace_id: string;
  member_id?: string | null;
  role: number;
  created_at?: string;
  updated_at?: string;
}

/** Project invite as returned by the API */
export interface ProjectInviteApiResponse {
  id: string;
  project_id: string;
  workspace_id: string;
  email: string;
  accepted: boolean;
  token: string;
  role: number;
  created_at?: string;
  updated_at?: string;
}

/** State (workflow) as returned by the API */
export interface StateApiResponse {
  id: string;
  project_id: string;
  workspace_id: string;
  name: string;
  description?: string;
  color?: string;
  slug?: string;
  sequence?: number;
  group?: string;
  default?: boolean;
  created_at?: string;
  updated_at?: string;
}

/** Issue label as returned by the API */
export interface LabelApiResponse {
  id: string;
  project_id?: string;
  workspace_id: string;
  name: string;
  description?: string;
  color?: string;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

/** Issue as returned by the API (backend uses `name` not `title`) */
export interface IssueApiResponse {
  id: string;
  project_id: string;
  workspace_id: string;
  name: string;
  description?: Record<string, unknown>;
  description_html?: string;
  priority?: string;
  state_id?: string | null;
  parent_id?: string | null;
  assignee_ids?: string[];
  label_ids?: string[];
  cycle_ids?: string[];
  module_ids?: string[];
  sequence_id?: number;
  sort_order?: number;
  created_at: string;
  updated_at: string;
  created_by_id?: string | null;
  updated_by_id?: string | null;
  start_date?: string | null;
  target_date?: string | null;
  archived_at?: string | null;
  is_draft?: boolean;
}

/** Request body for POST issues */
export interface CreateIssueRequest {
  name: string;
  description?: string;
  priority?: string;
  state_id?: string | null;
  assignee_ids?: string[];
  label_ids?: string[];
  start_date?: string | null;
  target_date?: string | null;
  parent_id?: string | null;
}

/** GET /api/instance/setup-status/ */
export interface InstanceSetupStatusResponse {
  setup_required: boolean;
}

/** POST /api/instance/setup/ */
export interface InstanceSetupRequest {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  company_name?: string;
}

/** POST /auth/sign-in/ or POST /auth/sign-up/ or POST /api/instance/setup/ */
export interface UserApiResponse {
  id: string;
  email: string | null;
  username: string;
  first_name: string;
  last_name: string;
  display_name: string;
  avatar?: string;
  cover_image?: string;
  is_active: boolean;
  is_onboarded: boolean;
  date_joined: string;
  created_at: string;
  updated_at: string;
  user_timezone?: string;
}

/** PATCH /api/users/me/ (email not updatable) */
export interface UpdateMeRequest {
  first_name?: string;
  last_name?: string;
  display_name?: string;
  user_timezone?: string;
  avatar?: string;
  cover_image?: string;
}

/** POST /api/users/me/change-password/ */
export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

/** GET /api/users/me/notification-preferences/ */
export interface NotificationPreferencesResponse {
  property_change: boolean;
  state_change: boolean;
  comment: boolean;
  mention: boolean;
  issue_completed: boolean;
}

/** GET /api/users/me/activity/ */
export interface UserActivityItem {
  id: string;
  type: string;
  created_at: string;
  description: string;
  issue_id?: string;
  issue_name?: string;
  workspace_id?: string;
  project_id?: string;
}

/** GET /api/users/me/tokens/ */
export interface ApiTokenResponse {
  id: string;
  label: string;
  description: string;
  is_active: boolean;
  last_used?: string | null;
  expired_at?: string | null;
  created_at: string;
}

/** POST /api/users/me/tokens/ request */
export interface CreateTokenRequest {
  label: string;
  description?: string;
  expires_in?: string;
  expired_at?: string;
}

/** POST /auth/sign-in/ request */
export interface SignInRequest {
  email: string;
  password: string;
}

/** POST /auth/sign-up/ request; invite_token required when instance has allow_public_signup off */
export interface SignUpRequest {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  invite_token?: string;
}

/** Instance settings: section key -> value object (from GET /api/instance/settings/) */
export type InstanceSettingsResponse = Record<string, Record<string, unknown>>;

/** Section value for PATCH /api/instance/settings/:key */
export type InstanceSettingSectionValue = Record<string, unknown>;

/** General section shape */
export interface InstanceGeneralSection {
  instance_name?: string;
  admin_email?: string;
  instance_id?: string;
  only_admin_can_create_workspace?: boolean;
}

/** Email section shape (password is decrypted when returned from API) */
export interface InstanceEmailSection {
  host?: string;
  port?: string;
  sender_email?: string;
  security?: string;
  username?: string;
  password_set?: boolean;
  password?: string;
}

/** Auth section shape */
export interface InstanceAuthSection {
  allow_public_signup?: boolean;
  magic_code?: boolean;
  password?: boolean;
  google?: boolean;
  github?: boolean;
  gitlab?: boolean;
}

/** AI section shape (api_key is decrypted when returned from API) */
export interface InstanceAISection {
  model?: string;
  api_key_set?: boolean;
  api_key?: string;
}

/** Image section shape (unsplash_access_key is decrypted when returned from API) */
export interface InstanceImageSection {
  unsplash_access_key_set?: boolean;
  unsplash_access_key?: string;
}

/** Cycle as returned by the API */
export interface CycleApiResponse {
  id: string;
  name: string;
  description?: string;
  start_date?: string | null;
  end_date?: string | null;
  status: string;
  project_id: string;
  workspace_id: string;
  owned_by_id: string;
  sort_order?: number;
  issue_count?: number;
  created_at: string;
  updated_at: string;
}

/** Module as returned by the API */
export interface ModuleApiResponse {
  id: string;
  name: string;
  description?: string;
  start_date?: string | null;
  target_date?: string | null;
  status: string;
  project_id: string;
  workspace_id: string;
  sort_order?: number;
  issue_count?: number;
  created_at: string;
  updated_at: string;
}

/** Issue view (saved filter) as returned by the API */
export interface IssueViewApiResponse {
  id: string;
  name: string;
  description?: string;
  query?: Record<string, unknown>;
  filters?: Record<string, unknown>;
  display_filters?: Record<string, unknown>;
  display_properties?: Record<string, unknown>;
  access?: number;
  sort_order?: number;
  owned_by_id: string;
  workspace_id: string;
  project_id?: string | null;
  created_at: string;
  updated_at: string;
}

/** Page as returned by the API */
export interface PageApiResponse {
  id: string;
  name: string;
  /** Display title (may equal name); use for list display. */
  title?: string;
  description_html?: string;
  owned_by_id: string;
  updated_by_id?: string | null;
  workspace_id: string;
  access: number;
  parent_id?: string | null;
  sort_order?: number;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
}

/** Notification as returned by the API */
export interface NotificationApiResponse {
  id: string;
  title: string;
  message?: Record<string, unknown>;
  receiver_id: string;
  workspace_id: string;
  project_id?: string | null;
  triggered_by_id?: string | null;
  entity_identifier?: string | null;
  entity_name?: string;
  read_at?: string | null;
  created_at: string;
  updated_at: string;
}

/** Issue comment as returned by the API */
export interface IssueCommentApiResponse {
  id: string;
  issue_id: string;
  project_id: string;
  workspace_id: string;
  comment: string;
  created_at: string;
  updated_at: string;
  created_by_id?: string | null;
}

/** Quick link (workspace user link) as returned by the API */
export interface QuickLinkApiResponse {
  id: string;
  title: string;
  url: string;
  owner_id: string;
  workspace_id: string;
  project_id?: string | null;
  created_at: string;
  updated_at: string;
}

/** Sticky as returned by the API (name/description map to title/content in UI) */
export interface StickyApiResponse {
  id: string;
  name: string;
  color: string;
  description: string;
  sort_order?: number;
  workspace_id: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

/** Recent visit as returned by the API (with optional display fields from List) */
export interface RecentVisitApiResponse {
  id: string;
  workspace_id: string;
  project_id?: string | null;
  user_id: string;
  entity_identifier?: string | null;
  entity_name: string;
  last_visited_at: string;
  created_at: string;
  updated_at: string;
  display_title?: string;
  display_identifier?: string;
}

/** Request body for POST /api/workspaces/:slug/quick-links/ */
export interface CreateQuickLinkRequest {
  title?: string;
  url: string;
  project_id?: string | null;
}

/** Request body for POST /api/workspaces/:slug/stickies/ */
export interface CreateStickyRequest {
  name?: string;
  description?: string;
  color?: string;
}

/** Request body for POST /api/workspaces/:slug/recent-visits/ */
export interface RecordRecentVisitRequest {
  entity_name: string;
  entity_identifier?: string | null;
  project_id?: string | null;
}
