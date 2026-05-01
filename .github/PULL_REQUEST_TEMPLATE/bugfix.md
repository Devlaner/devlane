<!--
  Bug-fix PR template.
  Usage: append `?template=bugfix.md` to the PR URL.
  Title: `fix(<scope>): <description>` (≤ 100 chars).
-->

## What was broken

<!-- One sentence describing the user-visible failure. -->

## Linked issues

Fixes #

## Root cause

<!-- The underlying bug — not the symptom. Mention the file/function where
     the bug actually lived and why the prior code was wrong. Reviewers
     should be able to tell, from this section alone, whether the fix
     addresses the cause or just hides the symptom. -->

## The fix

<!-- The smallest change that addresses the root cause. Note any deliberately
     out-of-scope cleanup you considered but didn't do. -->

## Why this fix is correct

<!-- Reasoning: invariants restored, edge cases considered, why this won't
     regress neighboring code paths. -->

## Reproduction

<!-- Exact steps that triggered the bug on `main`. Confirms the failure
     mode and that the fix actually resolves it. -->
1.
2.
3.

## Test plan

- [ ] `npm run validate` green
- [ ] Reproduction above no longer triggers the failure
- [ ] Added a regression test that fails on `main` and passes on this branch
- [ ] Manually verified neighboring flows that share the affected code path

## Regression risk

<!-- Where else could this fix have side effects? What did you check to
     rule out collateral breakage? -->

## Screenshots / logs (if applicable)

| Before (broken) | After (fixed) |
| --------------- | ------------- |
|                 |               |

## Checklist

- [ ] PR title is `fix(<scope>): …` and ≤ 100 chars
- [ ] Regression test added (or explained why one isn't possible)
- [ ] No `--no-verify` bypass
