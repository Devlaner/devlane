ALTER TABLE user_notification_preferences
    DROP COLUMN IF EXISTS issue_completed_email,
    DROP COLUMN IF EXISTS issue_completed_in_app,
    DROP COLUMN IF EXISTS mention_email,
    DROP COLUMN IF EXISTS mention_in_app,
    DROP COLUMN IF EXISTS comment_email,
    DROP COLUMN IF EXISTS comment_in_app,
    DROP COLUMN IF EXISTS state_change_email,
    DROP COLUMN IF EXISTS state_change_in_app,
    DROP COLUMN IF EXISTS property_change_email,
    DROP COLUMN IF EXISTS property_change_in_app;
