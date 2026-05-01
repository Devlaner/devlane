<!--
  Feature PR template.
  Usage: append `?template=feature.md` to the PR URL.
  Title: `feat(<scope>): <description>` (≤ 100 chars).
-->

## Feature summary

<!-- One or two sentences: what the user can now do that they couldn't before. -->

## Linked issues / discussion

Closes #
<!-- Add design doc / planning link if there was one. -->

## User-facing behavior

<!-- The new flow, end to end. Include the surface (where the user sees it) and the trigger. -->

## What changed

### API (`api/`)
<!-- New endpoints, new env vars, new stores/services. Note routes with their HTTP verbs. -->
-

### UI (`ui/`)
<!-- New pages / components / services. Note where it's mounted in the route tree. -->
-

### Database
<!-- "No schema changes" or list new tables / columns / migrations. -->
-

## Why this design

<!-- Tradeoffs: simpler alternatives considered, why we chose this shape. Reviewers care most about this section for net-new features. -->

## Test plan

- [ ] `npm run validate` green
- [ ] Manual end-to-end walkthrough:
  1.
  2.
  3.
- [ ] Tested with both light and dark theme (if UI)
- [ ] Tested at narrow viewport (if UI)
- [ ] Re-running the migration on a fresh DB passes (if migration)

## Screenshots / recording

<!-- Drag images here. Recording > screenshots for new flows. -->

| Before | After |
| ------ | ----- |
|        |       |

## Out of scope (follow-ups)

<!-- Bullet list of work this PR explicitly does NOT include but should
     happen later. Open issues for each before you merge. -->
-

## Rollout notes

<!-- Feature flag? Instance settings toggle? Required data backfill? Order
     in which API + UI must deploy? Otherwise "None". -->

## Checklist

- [ ] PR title follows Conventional Commits and is ≤ 100 chars
- [ ] Trailing slashes on new routes match neighboring routes
- [ ] New env vars documented in `internal/config/config.go`
- [ ] New instance settings reachable from the admin UI
- [ ] No `--no-verify` bypass
- [ ] Acceptance criteria from the linked issue are all met
