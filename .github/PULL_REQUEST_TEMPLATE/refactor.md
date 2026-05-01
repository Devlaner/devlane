<!--
  Refactor PR template.
  Usage: append `?template=refactor.md` to the PR URL.
  Title: `refactor(<scope>): <description>` (≤ 100 chars).

  A refactor is a NO-BEHAVIOR-CHANGE PR. If this PR also fixes a bug or
  adds a feature, use `bugfix.md` or `feature.md` instead and call out
  the refactor as a side effect.
-->

## What's being refactored

<!-- One sentence: which module / pattern, and the new shape it takes. -->

## Linked issues / context

<!-- Optional. Useful if this is part of a multi-PR refactor sequence. -->

## Why now

<!-- The pain point this unblocks: a planned feature, a recurring bug
     class, a performance ceiling, or "this code grew faster than its
     structure could keep up." Reviewers should understand the cost of
     NOT doing this. -->

## Approach

<!-- The new structure, in 3–5 bullets. Mention which files moved, which
     responsibilities shifted, and which abstractions you introduced or
     collapsed. Layering rule for the API: handler → service → store. -->
-
-

## Behavior preservation

<!-- How you verified there's no behavior change. -->
- [ ] Existing tests still pass without modification
- [ ] No public API surface changed (URLs, request/response shapes, exported types)
- [ ] No DB schema change
- [ ] No new env vars / instance settings
- [ ] If any tests were renamed/moved, semantics are identical

## Out of scope

<!-- Cleanup you noticed but deliberately deferred. Open follow-up issues
     and link them here. -->
-

## Test plan

- [ ] `npm run validate` green
- [ ] Manually exercised the affected flow end-to-end
- [ ] Spot-checked one or two neighboring flows that share the touched code

## Risk and rollback

<!-- How would we revert this if a regression slips through?
     - One commit, easy `git revert`?
     - Touches a migration (irreversible without down-migration)?
     - Cross-PR dependency? -->

## Checklist

- [ ] PR title is `refactor(<scope>): …` and ≤ 100 chars
- [ ] Truly no behavior change (otherwise switch to `feature.md` / `bugfix.md`)
- [ ] No `--no-verify` bypass
- [ ] No half-finished migrations or dead code introduced
