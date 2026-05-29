---
phase: 11-buyer-affected-ux-quality-security-review
plan: 07
type: execute
wave: 5
depends_on: ["11-02", "11-03", "11-04", "11-05", "11-06"]
files_modified:
  - scripts/generate-coverage-manifest.sh
  - .planning/phases/11-buyer-affected-ux-quality-security-review/11-COVERAGE.md
autonomous: true
requirements: [LQUAL-02]
requirements_addressed: [LQUAL-02]
must_haves:
  truths:
    - "scripts/generate-coverage-manifest.sh exists and is executable; it greps both mobile and backend (sibling) test trees for describe('LXXX-NN: ...') patterns"
    - "Running the script emits a markdown table mapping every LIST-* requirement ID to its covering test file(s)"
    - "The trailing coverage-check block enumerates ALL LIST-* IDs from .planning/REQUIREMENTS.md; any ID with zero hits prints `❌ <ID> — no covering test found`"
    - "11-COVERAGE.md exists and reports zero missing requirements (every LIST-* found at least once)"
  artifacts:
    - path: "scripts/generate-coverage-manifest.sh"
      provides: "Bash generator that greps cross-repo test tree for requirement-ID describe blocks"
      contains: "L(BUY|QUAL|MOB|UI|ADM|DATA|ENF|SEC)"
    - path: ".planning/phases/11-buyer-affected-ux-quality-security-review/11-COVERAGE.md"
      provides: "Per-requirement coverage manifest with mobile + backend test citations"
      contains: "## Coverage check"
  key_links:
    - from: "scripts/generate-coverage-manifest.sh"
      to: "mobile + backend test trees"
      via: "grep -rEn describe pattern across configured TEST_DIRS"
      pattern: "TEST_DIRS"
    - from: "11-COVERAGE.md"
      to: ".planning/REQUIREMENTS.md"
      via: "grep -oE pattern to enumerate all LIST-* IDs and check coverage"
      pattern: "ALL_LIST_IDS"
---

<objective>
Build the per-requirement coverage manifest generator + run it to produce 11-COVERAGE.md, the LQUAL-02 deliverable.

Purpose: LQUAL-02 mandates every LIST-* requirement is covered by at least one jest test. Per D-10 + RESEARCH §Don't Hand-Roll, the lowest-cost mechanism is grep+awk over the `describe('LXXX-NN: ...')` naming convention adopted across Phase 7..11 (verified in 11-PATTERNS + Phase 8/9/10 STATE.md). The script must cross the repo boundary into the sibling backend at `../backend-services/carEx-services` to pick up LDATA-*, LADM-*, LENF-*, LSEC-* coverage from Phases 7-9. Pitfall 10 — manifest must capture completed-phase requirements, not just LBUY/LQUAL.

Output: One bash script + one generated markdown manifest committed under .planning/phases/11/.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/REQUIREMENTS.md
@.planning/phases/11-buyer-affected-ux-quality-security-review/11-CONTEXT.md
@.planning/phases/11-buyer-affected-ux-quality-security-review/11-RESEARCH.md
@.planning/phases/11-buyer-affected-ux-quality-security-review/11-PATTERNS.md
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Create scripts/generate-coverage-manifest.sh (cross-repo describe-pattern grep + markdown emission)</name>
  <read_first>
    - .planning/phases/11-buyer-affected-ux-quality-security-review/11-RESEARCH.md (§Code Examples lines 787-837 — full bash script template)
    - .planning/phases/11-buyer-affected-ux-quality-security-review/11-PATTERNS.md (§generate-coverage-manifest.sh lines 703-716)
    - .planning/REQUIREMENTS.md (read full — confirm LIST-* IDs: LSEC-01..03, LDATA-01..04, LADM-01..05, LENF-01..03, LUI-01..04, LMOB-01..02, LBUY-01..04, LQUAL-01..03 — 28 total IDs)
    - List the actual existing test directories before generation: `ls __tests__ src/components/moderation/__tests__ src/screens/__tests__ src/services/moderation/__tests__ 2>/dev/null` and `ls ../backend-services/carEx-services/__tests__ 2>/dev/null` (latter per MEMORY.md sibling-repo location)
  </read_first>
  <action>
    Per CONTEXT D-10 + RESEARCH §Code Examples + Pitfall 10 (cross-repo grep) + Assumption A5 (backend repo at sibling path).

    Create new file `scripts/generate-coverage-manifest.sh`. Base on the RESEARCH template (lines 787-837) with these EXPLICIT FIXES (declared-array bash is required for portability):

    File content (~75-95 lines):

    Shebang + strict mode:
    ```
    #!/usr/bin/env bash
    # scripts/generate-coverage-manifest.sh — Phase 11 LQUAL-02 per-requirement coverage manifest
    #
    # Usage:
    #   bash scripts/generate-coverage-manifest.sh > .planning/phases/11-buyer-affected-ux-quality-security-review/11-COVERAGE.md
    #
    # Greps both mobile (this repo) and backend (sibling at ../backend-services/carEx-services)
    # test trees for describe('LXXX-NN: ...') strings. Convention adopted phase-wide per CONTEXT D-10.
    set -euo pipefail
    ```

    Header emission (heredoc with proper escaping):
    ```
    cat <<EOF
    # Phase 11 LQUAL-02 — Per-requirement coverage manifest

    Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)
    Convention: every \`describe('LXXX-NN: …')\` block tags its covering requirement.

    | Requirement | Test file(s) |
    |-------------|--------------|
    EOF
    ```

    Configurable TEST_DIRS array (per Pitfall 10 + Assumption A5 — backend path is the MEMORY.md sibling location):
    ```
    TEST_DIRS=(
      "__tests__"
      "src/components/moderation/__tests__"
      "src/screens/__tests__"
      "src/services/moderation/__tests__"
      "../backend-services/carEx-services/__tests__"
    )
    ```

    Collect requirement → files map (declare -A is bash 4+; macOS default bash is 3.2 — surface to operator if needed; alternative: use parallel arrays). Per Assumption A5 the dev env has bash 4+ via Homebrew OR the script falls back to a portable two-array implementation. Use the portable two-array approach for safety:
    ```
    IDS=()      # parallel array of requirement IDs
    PATHS=()    # parallel array of "ID|filepath" entries

    for dir in "${TEST_DIRS[@]}"; do
      [ -d "$dir" ] || continue
      # grep -rEn output format: file:line:matched_line
      while IFS=$'\n' read -r match; do
        file=$(echo "$match" | cut -d: -f1)
        rest=$(echo "$match" | cut -d: -f3-)
        # Extract the LXXX-NN identifier from describe('LXXX-NN: ...')
        id=$(echo "$rest" | grep -oE "L(BUY|QUAL|MOB|UI|ADM|DATA|ENF|SEC)-[0-9]+" | head -1)
        [ -z "$id" ] && continue
        # Normalize path relative to cwd if possible
        rel=$(realpath --relative-to=. "$file" 2>/dev/null || echo "$file")
        # Avoid duplicates per (ID, file) pair
        key="${id}|${rel}"
        already=0
        for existing in "${PATHS[@]:-}"; do
          if [ "$existing" = "$key" ]; then already=1; break; fi
        done
        if [ "$already" -eq 0 ]; then
          PATHS+=("$key")
          # Track unique IDs
          id_seen=0
          for existing_id in "${IDS[@]:-}"; do
            if [ "$existing_id" = "$id" ]; then id_seen=1; break; fi
          done
          [ "$id_seen" -eq 0 ] && IDS+=("$id")
        fi
      done < <(grep -rEn "describe\(['\"]L(BUY|QUAL|MOB|UI|ADM|DATA|ENF|SEC)-[0-9]+" "$dir" || true)
    done
    ```

    Emit rows sorted by ID, files comma-separated:
    ```
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
    ```

    Coverage-check trailing block:
    ```
    echo ""
    echo "## Coverage check"
    echo ""
    # Enumerate all LIST-* IDs from REQUIREMENTS.md
    ALL_LIST_IDS=$(grep -oE 'L(BUY|QUAL|MOB|UI|ADM|DATA|ENF|SEC)-[0-9]+' .planning/REQUIREMENTS.md | sort -u)
    missing_count=0
    for id in $ALL_LIST_IDS; do
      found=0
      for existing_id in "${IDS[@]:-}"; do
        if [ "$existing_id" = "$id" ]; then found=1; break; fi
      done
      if [ "$found" -eq 0 ]; then
        echo "- ❌ **$id** — no covering test found"
        missing_count=$((missing_count + 1))
      fi
    done
    if [ "$missing_count" -eq 0 ]; then
      echo "All LIST-* requirements covered."
    fi
    ```

    After file write, make executable: `chmod +x scripts/generate-coverage-manifest.sh`.

    Critical fixes from RESEARCH template:
    1. The original used `declare -A MAP` (associative array, bash 4+); portable replacement uses parallel `IDS` + `PATHS` arrays with explicit duplicate detection — works on macOS default bash 3.2.
    2. The original used `realpath --relative-to=.` which is GNU-only; the `2>/dev/null || echo "$file"` fallback retained from research handles macOS lacking that flag.
    3. The original collected `MAP["$id"]+="$file\n"` and emitted via `echo -e ${MAP[$id]} | sort -u`; the portable replacement de-duplicates inline so emit is straightforward join.

    The describe-pattern regex is intentionally `L(BUY|QUAL|MOB|UI|ADM|DATA|ENF|SEC)-[0-9]+` (no leading optional `L?` — the bare `QUAL-01` from Phase 6 substrate is NOT a LIST-* ID and shouldn't claim LIST-* coverage). Plan 11-06 compound describe IDs `'QUAL-01 / LQUAL-01: ...'` produce a regex match on `LQUAL-01` — that's the correct behavior; the leading `QUAL-01` is ignored by the regex.
  </action>
  <verify>
    <automated>chmod +x scripts/generate-coverage-manifest.sh && bash scripts/generate-coverage-manifest.sh > /tmp/coverage-test-output.md && head -40 /tmp/coverage-test-output.md && echo "—" && grep -c "^| L" /tmp/coverage-test-output.md</automated>
  </verify>
  <acceptance_criteria>
    - File `scripts/generate-coverage-manifest.sh` exists with executable bit set: `test -x scripts/generate-coverage-manifest.sh` exits 0
    - `grep -c "TEST_DIRS=" scripts/generate-coverage-manifest.sh` returns 1
    - `grep -c "../backend-services/carEx-services" scripts/generate-coverage-manifest.sh` returns 1 (cross-repo grep included)
    - `grep -c "L(BUY|QUAL|MOB|UI|ADM|DATA|ENF|SEC)" scripts/generate-coverage-manifest.sh` >= 2 (regex used in grep + ALL_LIST_IDS extraction)
    - `grep -c "## Coverage check" scripts/generate-coverage-manifest.sh` returns 1
    - Running the script exits 0 (no bash errors)
    - Script output contains a markdown table with at least 10 rows of `| L... |` format (mobile + backend covering describes are expected — at minimum LBUY-01..04 + LQUAL-01..02 + Phase 7-10 backend rows; gates only the lower bound)
  </acceptance_criteria>
  <done>Script executable; runs without error; emits well-formed markdown with cross-repo coverage rows + coverage-check trailing block.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Run the generator and commit 11-COVERAGE.md with zero missing LIST-* IDs</name>
  <read_first>
    - .planning/REQUIREMENTS.md (read full — enumerate all 28 LIST-* IDs to know what missing rows would look like)
    - The current output of `bash scripts/generate-coverage-manifest.sh` (Task 1 verify output)
  </read_first>
  <action>
    Per CONTEXT D-10 + LQUAL-02 + Pitfall 10.

    Step 1: Run `bash scripts/generate-coverage-manifest.sh > .planning/phases/11-buyer-affected-ux-quality-security-review/11-COVERAGE.md` from the repo root.

    Step 2: Read the generated 11-COVERAGE.md.

    Step 3: If the trailing `## Coverage check` section contains any `❌ <ID> — no covering test found` lines:
       - For each missing ID, determine the cause:
         (a) The test file exists but the `describe()` string doesn't follow the convention — fix the test file describe string to start with `'LXXX-NN: ...'`.
         (b) No test exists for that requirement — surface to operator BEFORE bypassing. LQUAL-02 is a merge-gate; missing coverage is a real gap.
       - If (a): edit the relevant test file (likely a Phase 7-10 backend test or a Phase 10 mobile test), update the describe string to include the requirement ID prefix per D-10, commit, then re-run the generator.
       - If (b): the missing requirement IS a real gap that must be reported in the SUMMARY for operator review. Phase 11 cannot ship LQUAL-02 as PASSED until either coverage is added OR the requirement is explicitly accepted-as-deferred with operator sign-off.

    Step 4: Re-run the script after any test-file describe edits until the trailing block prints `All LIST-* requirements covered.` (zero missing).

    Step 5: Verify the manifest is complete:
       - All 28 LIST-* IDs from REQUIREMENTS.md appear as rows in the table.
       - Each row lists at least one test file path.
       - No row has empty cell.

    Step 6: Commit `11-COVERAGE.md` to `.planning/phases/11-buyer-affected-ux-quality-security-review/` exactly as emitted by the generator (no manual edits — manifest is regenerable per D-10).

    DO NOT manually add rows to 11-COVERAGE.md. DO NOT bypass the script with hand-curated content. The manifest's authority is the script's grep output; manual edits make it unaudittable.

    If during generation the operator discovers a Phase 7-10 test that should already cover a requirement but uses an old describe convention (e.g., `describe('suspend listing returns 200 + audit row', ...)`), it is acceptable to edit ONLY the describe string (add the `'LADM-02: '` prefix) to bring it under the manifest. Do NOT change test bodies; the prefix update is metadata only.

    Important caveat: editing backend test files lives in the SIBLING repo at `../backend-services/carEx-services/`. The operator should commit the backend edits in that repo's main branch and re-run the mobile-side generator. Cross-repo coordination is explicit per Assumption A5.
  </action>
  <verify>
    <automated>bash scripts/generate-coverage-manifest.sh | diff - .planning/phases/11-buyer-affected-ux-quality-security-review/11-COVERAGE.md && grep -c "❌" .planning/phases/11-buyer-affected-ux-quality-security-review/11-COVERAGE.md</automated>
  </verify>
  <acceptance_criteria>
    - File `.planning/phases/11-buyer-affected-ux-quality-security-review/11-COVERAGE.md` exists
    - `grep -c "^| L" .planning/phases/11-buyer-affected-ux-quality-security-review/11-COVERAGE.md` returns at least 20 (manifest has 20+ rows; ideal is 28 covering all LIST-* IDs but some may share rows if multi-covered)
    - `grep -c "❌" .planning/phases/11-buyer-affected-ux-quality-security-review/11-COVERAGE.md` returns 0 (no missing requirements)
    - `grep -c "All LIST-\* requirements covered" .planning/phases/11-buyer-affected-ux-quality-security-review/11-COVERAGE.md` returns 1
    - Generator-vs-committed diff is empty (no manual edits)
    - All 4 Phase 11 LBUY-* IDs appear as rows: `grep -cE "^\| LBUY-0[1-4] \|" .planning/phases/11-buyer-affected-ux-quality-security-review/11-COVERAGE.md` returns exactly 4
    - All 3 Phase 11 LQUAL-* IDs appear as rows: `grep -cE "^\| LQUAL-0[1-3] \|" .planning/phases/11-buyer-affected-ux-quality-security-review/11-COVERAGE.md` >= 2 (LQUAL-03 may not appear until Plan 11-08 lands LIST-SECURITY.md; if so, surface to operator — this is a sequencing concern, see plan note below)
  </acceptance_criteria>
  <done>11-COVERAGE.md committed with all 28 LIST-* IDs covered; zero ❌ entries; generator-vs-file diff is empty.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Cross-repo grep | Script reads sibling repo's __tests__/ — read-only; never mutates backend |
| describe() string → manifest claim | A test using the convention claims to cover its named requirement; verification of test body is NOT the manifest's job (LQUAL-02 is structural coverage, not behavioral correctness) |
| Manifest file content | Regenerable from script + source tree; no manual edits per D-10 |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-11-07-01 | Tampering | Manual hand-editing of 11-COVERAGE.md to claim false coverage | mitigate | Acceptance criterion `diff - 11-COVERAGE.md` exits 0 — file exactly matches generator output. No room for hand-curated rows. |
| T-11-07-02 | Information disclosure | Script leaks backend file paths beyond ../backend-services/carEx-services/__tests__/ | accept | TEST_DIRS array is the closed-set of scanned paths; the script does not recurse outside it. Backend internals (server.js, src/payments/, etc.) are NOT scanned. |
| T-11-07-03 | Spoofing | A test uses `describe('LADM-01: ...')` but tests an unrelated behavior | accept | LQUAL-02 is structural coverage (existence of a labeled describe), not behavioral correctness. Plan 11-08 security review reads the actual test bodies for verdict (d) TOCTOU evidence. |
| T-11-07-04 | Repudiation | Plan 11-06 compound IDs not picked up | mitigate | Regex `describe\(['\"]L(BUY\|QUAL\|...)-[0-9]+` matches `'QUAL-01 / LQUAL-01: ...'` at the LQUAL-01 substring. The leading `QUAL-01` is invisible to the regex (no leading `L`). |
</threat_model>

<verification>
- Script runs cleanly without bash errors
- 11-COVERAGE.md committed
- Trailing coverage-check shows zero ❌ entries
- Plan 11-06 compound describes are picked up by the regex
</verification>

<success_criteria>
- LQUAL-02: every LIST-* requirement covered by at least one jest test
- Manifest regenerable, not hand-curated
- Cross-repo coverage achieved (mobile + backend)
</success_criteria>

<output>
After completion, create `.planning/phases/11-buyer-affected-ux-quality-security-review/11-07-SUMMARY.md` capturing:
- Total LIST-* IDs covered (should be 27 or 28 depending on whether Plan 11-08 LIST-SECURITY landed before this plan ran)
- Any backend describe-string edits made + commit refs in the sibling repo
- Any pre-existing test files that needed describe-prefix edits
</output>
