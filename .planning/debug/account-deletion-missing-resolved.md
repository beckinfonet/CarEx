# Debug: Account deletion option missing (App Store review)

**Status:** resolved
**Date:** 2026-06-10

## Symptom
Account deletion option was present earlier, then disappeared. App Store review
flagged the app for missing an account-deletion path (Guideline 5.1.1(v)).

## Investigation
- Deletion backend/service/context/translations all still present:
  `AuthService.deleteAccount`, `AuthContext.deleteAccount`, `t.deleteAccount`.
- Button existed in `AccountSettingsScreen.tsx` but only inside the
  `isEditing ? (...)` branch — i.e. rendered ONLY after tapping "Edit".

## Root cause
Originally (commit `0cf9725` "account deletion added") the Delete Account button
lived on **ProfileScreen**, always visible. Commit `704d38f` refactored it into
the new `AccountSettingsScreen` and placed the button **inside the edit-mode
branch** of the view/edit ternary. In default view mode there was no delete
option, so reviewers (who don't enter edit mode) reported it as missing.

## Fix
Moved the `<TouchableOpacity>` Delete Account button out of the `isEditing`
branch to **after** the ternary in `AccountSettingsScreen.tsx`, so it renders in
both view and edit mode — always discoverable.

## Verification
- tsc: no errors on file.
- eslint: only pre-existing errors/warnings (unused catch vars, inline styles)
  in untouched code.
- Structure: ternary closes at the `)}`, button now renders unconditionally
  inside the form card.
