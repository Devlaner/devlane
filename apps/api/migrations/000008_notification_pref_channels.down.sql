ALTER TABLE user_notification_preferences DROP COLUMN IF EXISTS email_property_change;
ALTER TABLE user_notification_preferences DROP COLUMN IF EXISTS email_state_change;
ALTER TABLE user_notification_preferences DROP COLUMN IF EXISTS email_comment;
ALTER TABLE user_notification_preferences DROP COLUMN IF EXISTS email_mention;
ALTER TABLE user_notification_preferences DROP COLUMN IF EXISTS email_issue_completed;
