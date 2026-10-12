-- Every project's default "Cancelled" state was seeded with the group
-- "canceled" (one L) while the rest of the app matches on "cancelled" (two L).
-- That mismatch made auto-close a no-op, kept cancelled issues out of
-- auto-archive, and mis-bucketed them as "backlog" in every progress chart.
-- Correct the existing rows so they line up with the seed fix.
UPDATE states SET "group" = 'cancelled' WHERE "group" = 'canceled';
