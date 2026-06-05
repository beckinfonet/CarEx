---
quick_id: 260605-gvs
slug: member-count-strip
date: 2026-06-05
title: Total member-count social-proof strip (Option B) on HomeScreenV2 + backend user-count endpoint
branch: feature_total_user_count
---

# Quick Task: Member-count strip + backend user-count endpoint

## Source
Design handoff bundle `user_count_handoff.zip` → `design_handoff_user_count/`.
Chosen direction: **Option B — social-proof strip**. README.md is high-fidelity and
ships a ready-to-paste RN component (`MemberCountStrip.tsx`). Adds a horizontal band
(avatar stack · count + caption · growth stat) between `GreetingBlock`/`ActiveFilterChips`
and `HeroRotator` on HomeScreenV2.

## Scope — two repos

### Backend (`backend-services/carEx-services`, separate git repo)
1. Add public `GET /api/stats/users` to `server.js` (next to the public `/api/cars`
   route, no auth middleware — matches `/api/cars`). Returns:
   `{ count: <total registered users>, growthPct: <YoY growth integer> }`.
   - `count = await User.countDocuments()`
   - `newThisYear = countDocuments({ createdAt: { $gte: oneYearAgo } })`
   - `base = count - newThisYear`; `growthPct = base > 0 ? round(newThisYear/base*100) : 0`
   - Standard try/catch → `res.status(500).json({ message })`.
   - NOTE (split-repo gotcha): prod Railway deploys backend `main`; this won't be live
     in prod until merged+deployed there. Mobile handles a null/failed fetch gracefully.

### Mobile (`carEx`, branch `feature_total_user_count`)
2. Add `src/components/home/v2/MemberCountStrip.tsx` — paste from handoff verbatim
   (import paths `./theme` + `../../../hooks/useTypography` already correct for this dir).
3. `src/utils/formatMembers.ts` — Hermes-safe manual thousands grouping:
   EN sep `,`, RU sep ` ` (non-breaking space) so the number never splits across lines.
   (Avoid `toLocaleString(locale)` — Hermes Intl locale support is unreliable.)
4. `src/constants/translations.ts` — add `membersNoun` / `membersCaption` / `membersPeriod`
   to BOTH RU (~L636) and EN (~L1645) blocks, beside `listingsCount`:
   - RU: `пользователей` / `покупают и продают` / `за год`
   - EN: `users` / `buying & selling` / `this year`
5. `src/services/AuthService.ts` — add `getMemberStats()` → `apiClient.get('/api/stats/users')`,
   returns `{ count, growthPct }` or `null` on failure (mirrors `getBackendUser` pattern).
6. `src/screens/HomeScreenV2.tsx` — import `AuthService`, `MemberCountStrip`, `formatMembers`;
   add `memberStats` state + mount-effect fetch; render
   `{memberStats && <MemberCountStrip … />}` between `ActiveFilterChips` and `HeroRotator`.
   Conditional render means a not-yet-deployed prod backend simply hides the strip (no zeros).

## Out of scope
- Caching/refresh of the count beyond a single mount fetch (it's a quiet stat).
- Making the strip tappable (handoff explicitly defers this).
- No new theme tokens (handoff confirms existing `V2.surface/border/text/textMuted/green`).

## Verification
- `npx tsc --noEmit` clean.
- `npm test` green (no test regressions; component is presentational).
- Backend: `node -e` smoke / curl `/api/stats/users` returns `{count, growthPct}` shape.
- Manual: RU 320pt — number stays one line (NBSP), caption wraps, growth holds corner.

## Commits
- Backend repo: one commit for the stats endpoint.
- Mobile repo: one feature commit on `feature_total_user_count`; STATE.md doc commit.
