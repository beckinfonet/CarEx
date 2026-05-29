#!/usr/bin/env bash
# scripts/generate-coverage-manifest.sh — Phase 11 LQUAL-02 per-requirement coverage manifest
#
# Usage:
#   bash scripts/generate-coverage-manifest.sh > .planning/phases/11-buyer-affected-ux-quality-security-review/11-COVERAGE.md
#
# Greps both mobile (this repo) and backend (sibling repo per MEMORY.md location)
# test trees for describe('LXXX-NN: ...') strings. Convention adopted phase-wide per CONTEXT D-10.
#
# Portability: targets macOS default bash 3.2 (no `declare -A` associative arrays).
# Uses parallel IDS + PATHS arrays with explicit dedupe. realpath --relative-to is
# GNU-only; the `2>/dev/null || echo "$file"` fallback handles macOS lacking that flag.
set -euo pipefail

# Header — heredoc with backticks escaped for proper markdown emission.
cat <<EOF
# Phase 11 LQUAL-02 — Per-requirement coverage manifest

Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)
Convention: every \`describe('LXXX-NN: …')\` block tags its covering requirement.

| Requirement | Test file(s) |
|-------------|--------------|
EOF

# Per Pitfall 10 + Assumption A5 — backend path is the MEMORY.md sibling location.
# Script is intended to run from the mobile repo root, but it also works from a
# git worktree: we resolve the sibling backend repo relative to the main repo's
# common git-dir (so deeply-nested worktrees still find it).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Walk up from scripts/ to find the mobile-repo root. Prefer git common-dir
# (worktree-safe); fall back to script-parent directory.
MAIN_REPO_ROOT="$(git --git-dir="$(git rev-parse --git-common-dir 2>/dev/null)" rev-parse --show-toplevel 2>/dev/null || echo "$SCRIPT_DIR/..")"
# In worktree contexts, --show-toplevel returns the worktree root, not the main
# repo root. Detect and adjust: when git-common-dir resolves to a path ending
# in /.git rather than /.git/worktrees/<id>, --show-toplevel above is correct.
# When it ends in /.git/worktrees/<id>, the common-dir parent IS the main repo.
GIT_COMMON_DIR="$(git rev-parse --git-common-dir 2>/dev/null || echo "")"
if [ -n "$GIT_COMMON_DIR" ] && [ -d "$GIT_COMMON_DIR" ]; then
  case "$GIT_COMMON_DIR" in
    */.git)
      MAIN_REPO_ROOT="$(cd "$GIT_COMMON_DIR/.." && pwd)"
      ;;
    */.git/*)
      # Pathological — shouldn't happen for common-dir; leave default
      ;;
  esac
fi
BACKEND_TESTS_ABS="${MAIN_REPO_ROOT}/../backend-services/carEx-services/__tests__"

TEST_DIRS=(
  "__tests__"
  "src/components/moderation/__tests__"
  "src/screens/__tests__"
  "src/services/moderation/__tests__"
  "src/services/http/__tests__"
  "$BACKEND_TESTS_ABS"
)

# Parallel-arrays approach (bash 3.2 compatible — macOS default).
IDS=()      # unique requirement IDs seen
PATHS=()    # "ID|filepath" entries (dedup key)

for dir in "${TEST_DIRS[@]}"; do
  [ -d "$dir" ] || continue
  # grep -rEn output format: file:line:matched_line
  while IFS=$'\n' read -r match; do
    file=$(echo "$match" | cut -d: -f1)
    rest=$(echo "$match" | cut -d: -f3-)
    # Extract ALL LXXX-NN identifiers from the describe string. A single describe
    # block may carry compound coverage (e.g. '(LSEC-01 + LSEC-02)' or
    # 'QUAL-01 / LQUAL-01: ...'); we count each LIST-ID independently. The regex is
    # intentionally L(...)- with no leading optional `L?` — the bare `QUAL-01` from
    # Phase 6 substrate is NOT a LIST-* ID and must not claim LIST-* coverage.
    ids=$(echo "$rest" | grep -oE "L(BUY|QUAL|MOB|UI|ADM|DATA|ENF|SEC)-[0-9]+" | sort -u)
    [ -z "$ids" ] && continue
    # Normalize path so output is stable regardless of cwd: render backend test
    # files as `../backend-services/carEx-services/__tests__/...` (anchored at
    # the main repo root) and mobile test files as repo-root-relative paths.
    case "$file" in
      "$BACKEND_TESTS_ABS"/*)
        suffix="${file#$BACKEND_TESTS_ABS/}"
        rel="../backend-services/carEx-services/__tests__/${suffix}"
        ;;
      *)
        rel=$(realpath --relative-to="$MAIN_REPO_ROOT" "$file" 2>/dev/null || echo "$file")
        ;;
    esac
    for id in $ids; do
      key="${id}|${rel}"
      # Dedupe per (ID, file) pair.
      already=0
      for existing in "${PATHS[@]:-}"; do
        if [ "$existing" = "$key" ]; then
          already=1
          break
        fi
      done
      if [ "$already" -eq 0 ]; then
        PATHS+=("$key")
        # Track unique IDs.
        id_seen=0
        for existing_id in "${IDS[@]:-}"; do
          if [ "$existing_id" = "$id" ]; then
            id_seen=1
            break
          fi
        done
        [ "$id_seen" -eq 0 ] && IDS+=("$id")
      fi
    done
  done < <(grep -rEn "describe\(['\"][^'\"]*L(BUY|QUAL|MOB|UI|ADM|DATA|ENF|SEC)-[0-9]+" "$dir" || true)
done

# Emit rows sorted by ID, files comma-separated.
sorted_ids=$(printf '%s\n' "${IDS[@]:-}" | sort -u)
for id in $sorted_ids; do
  files=""
  for entry in "${PATHS[@]:-}"; do
    entry_id="${entry%%|*}"
    entry_file="${entry#*|}"
    if [ "$entry_id" = "$id" ]; then
      if [ -z "$files" ]; then
        files="$entry_file"
      else
        files="${files}, ${entry_file}"
      fi
    fi
  done
  echo "| $id | $files |"
done

# Trailing coverage-check block — enumerates ALL LIST-* IDs from REQUIREMENTS.md
# and prints a ❌ row for any with zero hits.
echo ""
echo "## Coverage check"
echo ""
ALL_LIST_IDS=$(grep -oE 'L(BUY|QUAL|MOB|UI|ADM|DATA|ENF|SEC)-[0-9]+' "${MAIN_REPO_ROOT}/.planning/REQUIREMENTS.md" | sort -u)
missing_count=0
for id in $ALL_LIST_IDS; do
  found=0
  for existing_id in "${IDS[@]:-}"; do
    if [ "$existing_id" = "$id" ]; then
      found=1
      break
    fi
  done
  if [ "$found" -eq 0 ]; then
    echo "- ❌ **$id** — no covering test found"
    missing_count=$((missing_count + 1))
  fi
done
if [ "$missing_count" -eq 0 ]; then
  echo "All LIST-* requirements covered."
fi
