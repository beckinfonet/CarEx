---
quick_id: 260605-gvs
slug: member-count-strip
date: 2026-06-05
status: complete
branch: feature_total_user_count
backend_branch: feature/user-count-endpoint
---

# Summary: Member-count strip + backend user-count endpoint

Integrated the `user_count_handoff.zip` design (Option B — social-proof strip) onto
HomeScreenV2 and built the backend endpoint that feeds it.

## What shipped

### Backend (`carEx-services`, branch `feature/user-count-endpoint`, commit 86928e2)
- `GET /api/stats/users` (public, no auth — matches `/api/cars`) in `server.js`.
  Returns `{ count, growthPct }`:
  - `count = User.countDocuments()`
  - `growthPct = round(newThisYear / (count - newThisYear) * 100)`, where
    `newThisYear = countDocuments({ createdAt >= 1y ago })`; `0` when no prior-year base.
- **NOT yet on prod**: Railway deploys backend `main`. Merge `feature/user-count-endpoint`
  → `main` and let Railway deploy before the strip appears in the prod app.

### Mobile (`carEx`, branch `feature_total_user_count`)
- `src/components/home/v2/MemberCountStrip.tsx` — handoff component, pasted verbatim.
- `src/utils/formatMembers.ts` — Hermes-safe manual grouping (EN `,` / RU non-breaking
  space) so the RU number never wraps. + unit test (`__tests__/formatMembers.test.ts`).
- `src/constants/translations.ts` — `membersNoun` / `membersCaption` / `membersPeriod`
  in RU + EN (translation-parity test green).
- `src/services/AuthService.ts` — `getMemberStats()` → returns `{count,growthPct}` or
  `null` on failure.
- `src/screens/HomeScreenV2.tsx` — mount-fetch into `memberStats` state; renders
  `{memberStats && <MemberCountStrip … />}` between `ActiveFilterChips` and `HeroRotator`.
  **Conditional render** = before the backend route is live in prod, the strip is simply
  hidden (no zeros, no crash).

## Verification
- `npx tsc --noEmit`: no new errors in any changed file (pre-existing errors only — old
  untyped `signUp`/`signIn` in AuthService, and test-file node-types issues — exist on main).
- `npm jest` home/v2 + translation-parity: 29/29 pass. `formatMembers`: 3/3 pass.
- Backend `node --check server.js` OK; `require('./server.js')` loads clean.

## Follow-ups (not done here)
- Merge + deploy backend `feature/user-count-endpoint` → prod so the strip lights up.
- Manual on-device verify at RU 320pt (number one line, caption wraps, growth holds corner).
- `user_count_handoff.zip` left untracked in the repo root — delete when no longer needed.
