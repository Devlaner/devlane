-- Split notification preferences into per-type email and in-app channels. The
-- existing boolean columns (property_change, ...) remain the in-app toggle;
-- these add the matching email toggle, defaulting to on to preserve today's
-- behavior where an in-app notification also emails the receiver.
ALTER TABLE user_notification_preferences ADD COLUMN IF NOT EXISTS email_property_change BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE user_notification_preferences ADD COLUMN IF NOT EXISTS email_state_change BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE user_notification_preferences ADD COLUMN IF NOT EXISTS email_comment BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE user_notification_preferences ADD COLUMN IF NOT EXISTS email_mention BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE user_notification_preferences ADD COLUMN IF NOT EXISTS email_issue_completed BOOLEAN NOT NULL DEFAULT TRUE;
