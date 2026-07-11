ALTER TABLE user_notification_preferences
    ADD COLUMN property_change_in_app BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN property_change_email BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN state_change_in_app BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN state_change_email BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN comment_in_app BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN comment_email BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN mention_in_app BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN mention_email BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN issue_completed_in_app BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN issue_completed_email BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE user_notification_preferences
SET
    property_change_in_app = property_change,
    property_change_email = property_change,
    state_change_in_app = state_change,
    state_change_email = state_change,
    comment_in_app = comment,
    comment_email = comment,
    mention_in_app = mention,
    mention_email = mention,
    issue_completed_in_app = issue_completed,
    issue_completed_email = issue_completed;
