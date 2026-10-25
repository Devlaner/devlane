-- This migration fixes a typo in existing data. There is no safe way to
-- reverse it: we can't tell which "cancelled" rows were the mistyped default
-- versus states that were always spelled correctly, and reintroducing the typo
-- would just bring the bug back. Intentionally a no-op.
SELECT 1;
