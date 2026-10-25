-- Installations that applied the Slack integration migration while it was
-- (mis)numbered 000013 never ran 000013_fix_cancelled_state_group, so their
-- default Cancelled states may still be in the misspelled "canceled" group.
-- Re-apply the correction; it is a no-op where it already ran.
UPDATE states SET "group" = 'cancelled' WHERE "group" = 'canceled';
