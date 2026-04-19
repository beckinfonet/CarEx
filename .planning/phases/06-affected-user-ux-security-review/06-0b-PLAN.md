---
phase: 06-affected-user-ux-security-review
plan: 0b
type: execute
wave: 6
depends_on: [06-0a]
files_modified:
  - backend-services/carEx-services/scripts/load-test/admin-search.k6.js
  - backend-services/carEx-services/.gitignore
autonomous: false
requirements: [QUAL-02]
threat_refs: [T-06-05]
tags: [backend, cross-repo, load-test, k6]
cross_repo: true
repo_target: "backend-services/carEx-services"
must_haves:
  truths:
    - "k6 harness authenticates ONCE in setup() (mints Firebase idToken from K6_ADMIN_IDTOKEN env var OR via a dedicated test admin) and reuses across VU iterations"
    - "Threshold http_req_duration[p(95)] < 200 is declared as first-class pass/fail"
    - "Harness exercises GET /api/admin/users/search and GET /api/admin/moderation/:uid/history"
    - "No hardcoded credentials or idTokens; env-driven"
    - ".gitignore excludes any token-containing artifacts"
  artifacts:
    - path: "backend-services/carEx-services/scripts/load-test/admin-search.k6.js"
      provides: "k6 harness with auth + P95 threshold + 3 endpoint scenarios"
      contains: "thresholds"
      min_lines: 80
  key_links:
    - from: "backend-services/carEx-services/scripts/load-test/admin-search.k6.js"
      to: "GET /api/admin/users/search"
      via: "http.get with Bearer auth"
      pattern: "/api/admin/users/search"
    - from: "backend-services/carEx-services/scripts/load-test/admin-search.k6.js"
      to: "GET /api/admin/moderation/:uid/history"
      via: "http.get with Bearer auth"
      pattern: "/api/admin/moderation/.*/history"
---

<objective>
Create the k6 load-test harness in the sister backend repo. Authenticates once in `setup()` (RESEARCH §Pitfall 9 — do NOT re-auth per iteration), hits the two admin read endpoints (search + history), and enforces P95 < 200ms via k6 `thresholds`. Cross-repo plan — executed inside `backend-services/carEx-services`. `autonomous: false`.

Purpose: Deliver the QUAL-02 pass/fail gate. Pairs with Plan 06-0a's 10k seed + index verify to produce a complete ROADMAP §Phase 6 Success Criterion 5 artifact.

Output: One k6 JS harness + a `.gitignore` entry for any local token-containing file.

**EXECUTION PREREQUISITE:** backend Phase 5 plans `05-0a` (`GET /api/admin/moderation/:targetUid/history`) and `05-0b` (`GET /api/admin/users/search`) must land first. STATE.md tracks these as outstanding. This harness cannot produce meaningful timings until the routes exist. Plan can be WRITTEN any time; EXECUTION waits.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/06-affected-user-ux-security-review/06-RESEARCH.md
@.planning/phases/06-affected-user-ux-security-review/06-PATTERNS.md

<interfaces>
k6 installed via: `brew install k6` (local dev) or apt package for Linux CI. npm `k6` package is a STUB (autocomplete only).

Environment variables the harness reads:
- `K6_BASE_URL` — e.g. `http://localhost:5001` or staging URL (NEVER prod)
- `K6_ADMIN_IDTOKEN` — a pre-minted Firebase idToken for a test admin user. Minted out-of-band (via Firebase console or a helper script); NOT committed.
- `K6_VUS` — concurrent virtual users (default 50)
- `K6_DURATION` — test duration (default '1m')

Pass criteria (ROADMAP §Phase 6 Success Criterion 5): P95 < 200ms on admin search + history endpoints with 10k seeded users; `explain()` confirms index use (Plan 06-0a's verify-indexes.sh).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create admin-search.k6.js harness</name>
  <files>backend-services/carEx-services/scripts/load-test/admin-search.k6.js</files>
  <read_first>
    - backend-services/carEx-services/scripts/seed-moderation-load.js (Plan 06-0a — understand the loadtest-XXXXXX uid scheme)
    - .planning/phases/06-affected-user-ux-security-review/06-PATTERNS.md §admin-search.k6.js (full k6 skeleton from RESEARCH)
    - .planning/phases/06-affected-user-ux-security-review/06-RESEARCH.md §Pitfall 9 (setup-based auth, not per-iteration)
    - k6.io/docs/using-k6/thresholds (p(95) threshold syntax)
  </read_first>
  <action>
    Create `backend-services/carEx-services/scripts/load-test/admin-search.k6.js`.

    Full implementation:

    ```javascript
    // Phase 6 QUAL-02 — k6 load harness for admin search + moderation history endpoints.
    // Pass criteria: P95 < 200ms on both endpoints across 10k seeded users.
    //
    // Prerequisites:
    //   - 10k users seeded by scripts/seed-moderation-load.js
    //   - Firebase idToken for a test admin minted out-of-band (NEVER commit)
    //   - Phase 5 backend plans 05-0a + 05-0b landed (the two read routes)
    //
    // Run:
    //   K6_BASE_URL=http://localhost:5001 \
    //   K6_ADMIN_IDTOKEN=<token> \
    //   K6_VUS=50 K6_DURATION=1m \
    //   k6 run scripts/load-test/admin-search.k6.js

    import http from 'k6/http';
    import { check, sleep } from 'k6';

    const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:5001';
    const VUS      = Number(__ENV.K6_VUS ?? 50);
    const DURATION = __ENV.K6_DURATION || '1m';

    export const options = {
      vus: VUS,
      duration: DURATION,
      thresholds: {
        // ROADMAP §Phase 6 Success Criterion 5 — P95 < 200 ms, FIRST-CLASS assertion.
        http_req_duration: ['p(95)<200'],
        http_req_failed:   ['rate<0.01'],  // < 1% failures tolerated
      },
    };

    // Mint idToken ONCE in setup(); per-VU iterations reuse it.
    // Reason: Firebase Identity Toolkit rate-limits sign-in; re-auth per iteration
    // would invalidate the P95 measurement (auth latency dominates). RESEARCH §Pitfall 9.
    export function setup() {
      const token = __ENV.K6_ADMIN_IDTOKEN;
      if (!token) {
        throw new Error('K6_ADMIN_IDTOKEN env var required. Mint a Firebase idToken out-of-band for a test admin.');
      }
      return { token };
    }

    // Sample a random synthetic uid for the history-by-user scenario.
    function randomLoadtestUid() {
      // Seed uses localId = 'loadtest-XXXXXX' where XXXXXX is zero-padded 6-digit index 0..9999.
      const n = Math.floor(Math.random() * 10000);
      return `loadtest-${String(n).padStart(6, '0')}`;
    }

    export default function (data) {
      const headers = {
        'Authorization': `Bearer ${data.token}`,
        'Content-Type': 'application/json',
      };

      // Scenario 1: admin search — state filter
      const searchRes = http.get(`${BASE_URL}/api/admin/users/search?q=loadtest&state=feature_limited&limit=50`, { headers });
      check(searchRes, {
        'search status 200': (r) => r.status === 200,
        'search returns users array': (r) => {
          try { return Array.isArray(r.json().users); } catch { return false; }
        },
      });

      // Scenario 2: history by target uid
      const uid = randomLoadtestUid();
      const historyRes = http.get(`${BASE_URL}/api/admin/moderation/${uid}/history?limit=50`, { headers });
      check(historyRes, {
        'history status 200 or 404': (r) => r.status === 200 || r.status === 404,
      });

      sleep(0.1);  // small pause to avoid hammering on shared dev box
    }

    // Lifecycle hook — k6 prints per-scenario stats automatically; no custom report needed.
    ```

    **Post-run verification workflow (documented in a top-of-file comment or README alongside):**
    1. Seed 10k users: `node scripts/seed-moderation-load.js --count=10000 --clean`
    2. Verify indexes: `bash scripts/verify-indexes.sh` (all 3 PASS)
    3. Mint Firebase idToken for a test admin (out-of-band — do NOT commit)
    4. Run k6: `K6_BASE_URL=... K6_ADMIN_IDTOKEN=... k6 run scripts/load-test/admin-search.k6.js`
    5. Read the k6 summary — confirm P95 < 200ms on http_req_duration AND failure rate < 1%

    **Do NOT:**
    - Hardcode any token, email, password, or URL
    - Add Firebase sign-in inside the default function — auth ONLY in setup()
    - Target prod — base URL is env-driven

    Pair with Task 2's `.gitignore` entry to prevent accidental commits of any local token file.
  </action>
  <verify>
    <automated>test -f backend-services/carEx-services/scripts/load-test/admin-search.k6.js && node -c backend-services/carEx-services/scripts/load-test/admin-search.k6.js 2>&1 | grep -v "Cannot use import" || true</automated>
  </verify>
  <done>
    - File exists at backend-services/carEx-services/scripts/load-test/admin-search.k6.js
    - `grep -c "thresholds" backend-services/carEx-services/scripts/load-test/admin-search.k6.js` >= 1
    - `grep -c "'p(95)<200'" backend-services/carEx-services/scripts/load-test/admin-search.k6.js` equals 1
    - `grep -c "export function setup" backend-services/carEx-services/scripts/load-test/admin-search.k6.js` equals 1
    - `grep -c "K6_ADMIN_IDTOKEN" backend-services/carEx-services/scripts/load-test/admin-search.k6.js` >= 2
    - `grep -c "/api/admin/users/search" backend-services/carEx-services/scripts/load-test/admin-search.k6.js` equals 1
    - `grep -c "/api/admin/moderation/.*/history\|/api/admin/moderation/\${" backend-services/carEx-services/scripts/load-test/admin-search.k6.js` >= 1
    - `grep -cE "eyJ[A-Za-z0-9_-]+\.eyJ" backend-services/carEx-services/scripts/load-test/admin-search.k6.js` equals 0 (no JWT-shaped literal in the file)
    - k6 dry-parse: `k6 inspect scripts/load-test/admin-search.k6.js` (if k6 installed) returns JSON options with vus/duration/thresholds set
  </done>
</task>

<task type="auto">
  <name>Task 2: Add .gitignore entries for load-test token artifacts</name>
  <files>backend-services/carEx-services/.gitignore</files>
  <read_first>
    - backend-services/carEx-services/.gitignore (current contents — do NOT duplicate existing entries)
  </read_first>
  <action>
    Append to `backend-services/carEx-services/.gitignore`:

    ```
    # Phase 6 QUAL-02 — never commit load-test tokens or seed reports.
    scripts/load-test/*.token
    scripts/load-test/*.env
    scripts/load-test/report.*
    k6-summary.*
    ```

    If the .gitignore already has a broad `*.env` or `*.token` entry, these added entries are redundant but harmless.
  </action>
  <verify>
    <automated>grep -c "k6-summary\|scripts/load-test/\*.token\|scripts/load-test/\*.env" backend-services/carEx-services/.gitignore</automated>
  </verify>
  <done>
    - `grep -c "scripts/load-test" backend-services/carEx-services/.gitignore` >= 1
    - `grep -c "k6-summary" backend-services/carEx-services/.gitignore` >= 1
    - `git status backend-services/carEx-services/` shows .gitignore modified
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| k6 harness → Firebase admin idToken | Privileged access token must never be committed |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-06-05 | Information disclosure (credential leak) | k6 harness auth | mitigate | (a) idToken read from env var only (acceptance: zero hardcoded token JWT shapes). (b) .gitignore entries block common token-containing filenames. (c) Top-of-file comment documents the out-of-band mint step. (d) Harness does NOT call Firebase sign-in — relies on operator-provided token, eliminating credential material in the codebase entirely. |

Severity: medium (admin idToken is privileged). Mitigations reduce to low.
</threat_model>

<verification>
- k6 harness has P95 < 200 threshold declared as first-class
- Auth in setup() only; no per-iteration credential fetch
- Zero hardcoded credentials; .gitignore blocks accidental commits
- Execution blocked until backend 05-0a/0b ship (operator awareness noted)
</verification>

<success_criteria>
- QUAL-02 harness infrastructure complete (Plan 06-0a seed + Plan 06-0b harness)
- Cross-repo work isolated per D-16 precedent
- Operator can run end-to-end load test once Phase 5 backend routes land and idToken is minted
</success_criteria>

<output>
After completion, create `.planning/phases/06-affected-user-ux-security-review/06-0b-SUMMARY.md` in the MOBILE .planning directory (cross-repo convention).
</output>
