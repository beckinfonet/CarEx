---
phase: 06-affected-user-ux-security-review
plan: 0a
type: execute
wave: 6
depends_on: []
files_modified:
  - backend-services/carEx-services/scripts/seed-moderation-load.js
  - backend-services/carEx-services/scripts/verify-indexes.sh
autonomous: false
requirements: [QUAL-02]
threat_refs: []
tags: [backend, cross-repo, load-test, seeding]
cross_repo: true
repo_target: "backend-services/carEx-services"
must_haves:
  truths:
    - "Seed script inserts 10,000 synthetic users distributed across 4 moderation states"
    - "Seed script uses insertMany({ ordered: false }) in batches of 1000 for throughput"
    - "Script is idempotent — running twice does not double-insert (either cleans first or upserts)"
    - "verify-indexes.sh confirms IXSCAN usage on 3 target indexes via explain('executionStats')"
  artifacts:
    - path: "backend-services/carEx-services/scripts/seed-moderation-load.js"
      provides: "10k synthetic users for load test"
      contains: "insertMany"
      min_lines: 60
    - path: "backend-services/carEx-services/scripts/verify-indexes.sh"
      provides: "Mongo explain verification for 3 target indexes"
      contains: "IXSCAN"
  key_links:
    - from: "backend-services/carEx-services/scripts/seed-moderation-load.js"
      to: "backend-services/carEx-services/src/models/User.js"
      via: "mongoose model"
      pattern: "User.insertMany"
    - from: "backend-services/carEx-services/scripts/verify-indexes.sh"
      to: "mongosh"
      via: "explain executionStats"
      pattern: "explain\\('executionStats'\\)"
---

<objective>
Create the 10k-user seed script + the index-verification script in the sister backend repo (`backend-services/carEx-services`). These feed Plan 06-0b's k6 load test. Cross-repo work: this plan is executed inside the backend repo, NOT the mobile carEx repo. Mirrors the Phase 5 D-16 precedent (plans 05-0a/0b executed in backend repo).

Purpose: Produce the synthetic corpus the P95 < 200ms load test runs against. Without 10k users and verified index use, QUAL-02 cannot pass.
Output: Two scripts — seed + verify — both runnable via `node scripts/seed-moderation-load.js` and `bash scripts/verify-indexes.sh`.

**CROSS-REPO NOTICE:** Executing this plan requires switching to `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/`. `autonomous: false` — human operator confirms the repo switch. Phase 5 plans 05-0a / 05-0b may still be outstanding; Plan 06-0b requires 05-0a/0b (the admin search + history routes) to land first — but seeding (this plan) does NOT depend on the routes, so it can proceed.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/06-affected-user-ux-security-review/06-RESEARCH.md
@.planning/phases/06-affected-user-ux-security-review/06-PATTERNS.md
@.planning/phases/06-affected-user-ux-security-review/06-CONTEXT.md

<interfaces>
Backend repo location: `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/`

Target indexes (Phase 1 DATA-01 + DATA-02):
1. `User` collection: `{ 'moderationStatus.state': 1 }`
2. `ModerationAction` collection: `{ targetUid: 1, createdAt: -1 }`
3. `ModerationAction` collection: `{ adminUid: 1, createdAt: -1 }`

STATUS_POLICY states for seed distribution (Phase 1 01-04):
- active (baseline) — ~70% of seeded users
- feature_limited — ~15%
- blocked_with_review — ~10%
- permanently_banned — ~5%

These ratios approximate a real moderated-user distribution so P95 timing is representative.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create seed-moderation-load.js in backend repo</name>
  <files>backend-services/carEx-services/scripts/seed-moderation-load.js</files>
  <read_first>
    - backend-services/carEx-services/src/models/User.js (moderationStatus schema shape)
    - backend-services/carEx-services/src/models/ModerationAction.js (if exists — for per-user audit rows)
    - backend-services/carEx-services/src/moderation/capabilities.js (STATUS_POLICY — for restrictedFeatures per state)
    - .planning/phases/06-affected-user-ux-security-review/06-PATTERNS.md §seed-moderation-load.js (full skeleton reference from RESEARCH)
    - .planning/phases/05-admin-moderation-ui-mobile/ (if any 05-0a/0b SUMMARY exists — mirror the file layout)
  </read_first>
  <action>
    Create `backend-services/carEx-services/scripts/seed-moderation-load.js`.

    Full implementation:

    ```javascript
    #!/usr/bin/env node
    /**
     * Seed 10,000 synthetic users across 4 moderation states for Phase 6 QUAL-02 load test.
     * Per-user audit rows optionally inserted to exercise the ModerationAction indexes.
     *
     * Usage:
     *   MONGO_URI=mongodb://... node scripts/seed-moderation-load.js [--count=10000] [--clean]
     *
     * --clean removes any prior synthetic users (localId starts with 'loadtest-') before seeding.
     */

    const mongoose = require('mongoose');
    const path = require('path');

    // Lazy-require models via mongoose registry after connect (models register on require)
    require(path.resolve(__dirname, '..', 'src/models/User'));
    // ModerationAction may be at ../src/models/ModerationAction or similar — adjust path if different
    try { require(path.resolve(__dirname, '..', 'src/models/ModerationAction')); } catch (_) {}

    const { STATUS_POLICY } = require(path.resolve(__dirname, '..', 'src/moderation/capabilities'));

    const DISTRIBUTION = [
      { state: 'active',              weight: 70 },
      { state: 'feature_limited',     weight: 15 },
      { state: 'blocked_with_review', weight: 10 },
      { state: 'permanently_banned',  weight:  5 },
    ];

    const REASON_CATEGORIES = ['spam', 'policy_violation', 'fraud', 'other'];

    function pickState(rand) {
      let acc = 0;
      for (const bucket of DISTRIBUTION) {
        acc += bucket.weight;
        if (rand * 100 < acc) return bucket.state;
      }
      return 'active';
    }

    function buildSyntheticUser(i) {
      const rand = Math.random();
      const state = pickState(rand);
      const reason = REASON_CATEGORIES[i % REASON_CATEGORIES.length];
      const setAt = new Date(Date.now() - Math.floor(rand * 1000 * 60 * 60 * 24 * 30));
      const restricted = state === 'active'
        ? []
        : (STATUS_POLICY[state]?.capabilities?.blocked ?? ['all_writes']);

      return {
        localId:   `loadtest-${i.toString().padStart(6, '0')}`,
        email:     `loadtest-${i}@carex-load.test`,
        firstName: `Load${i}`,
        lastName:  `Test`,
        moderationStatus: state === 'active'
          ? { state, restrictedFeatures: [] }
          : {
              state,
              reasonCategory: reason,
              note: `Synthetic seed note for ${state}/${reason} #${i}`,
              setByAdminUid: 'loadtest-admin-001',
              setAt,
              restrictedFeatures: restricted,
            },
        createdAt: setAt,
        updatedAt: setAt,
      };
    }

    async function main() {
      const args = Object.fromEntries(process.argv.slice(2).map(a => {
        const [k, v] = a.replace(/^--/, '').split('=');
        return [k, v ?? true];
      }));
      const total = Number(args.count ?? 10000);
      const uri = process.env.MONGO_URI;
      if (!uri) throw new Error('MONGO_URI env var required');

      await mongoose.connect(uri);
      const User = mongoose.model('User');

      if (args.clean) {
        const res = await User.deleteMany({ localId: /^loadtest-/ });
        console.log(`Cleaned ${res.deletedCount} prior loadtest users`);
      }

      const BATCH = 1000;
      let inserted = 0;
      for (let i = 0; i < total; i += BATCH) {
        const batch = [];
        for (let j = 0; j < BATCH && i + j < total; j++) {
          batch.push(buildSyntheticUser(i + j));
        }
        try {
          const res = await User.insertMany(batch, { ordered: false });
          inserted += res.length;
        } catch (err) {
          // ordered:false continues past duplicate-key errors; log and move on.
          const count = err.insertedDocs?.length ?? 0;
          inserted += count;
          if (err.code !== 11000) throw err;
        }
        console.log(`Progress: ${inserted} / ${total}`);
      }

      console.log(`Seed complete: ${inserted} users across ${total} requested`);
      const counts = await User.aggregate([
        { $match: { localId: /^loadtest-/ } },
        { $group: { _id: '$moderationStatus.state', n: { $sum: 1 } } },
      ]);
      console.log('State distribution:', counts);

      await mongoose.disconnect();
    }

    main().catch(err => { console.error(err); process.exit(1); });
    ```

    **Do NOT:**
    - Commit a real Mongo URI — read from `process.env.MONGO_URI`. Add `.gitignore` entry if necessary (T-06-05 mitigation)
    - Write the script to delete non-loadtest users — the filter `localId: /^loadtest-/` is load-bearing for idempotency
    - Seed without checking the target DB — the --clean flag must be explicit to prevent accidental double-seeding in production

    After creating the file: `chmod +x scripts/seed-moderation-load.js`. Document in a top-of-file comment that this script MUST be run against a dev/staging Mongo, NEVER prod.
  </action>
  <verify>
    <automated>test -f backend-services/carEx-services/scripts/seed-moderation-load.js && node -c backend-services/carEx-services/scripts/seed-moderation-load.js</automated>
  </verify>
  <done>
    - File exists at backend-services/carEx-services/scripts/seed-moderation-load.js
    - `node -c` exits 0 (syntactically valid JS)
    - `grep -c "insertMany" backend-services/carEx-services/scripts/seed-moderation-load.js` >= 1
    - `grep -c "ordered: false" backend-services/carEx-services/scripts/seed-moderation-load.js` >= 1
    - `grep -c "loadtest-" backend-services/carEx-services/scripts/seed-moderation-load.js` >= 2
    - `grep -c "MONGO_URI" backend-services/carEx-services/scripts/seed-moderation-load.js` >= 1
    - `grep -c "mongodb://\|mongodb+srv://" backend-services/carEx-services/scripts/seed-moderation-load.js` equals 0 (no hardcoded URI — T-06-05 mitigation)
    - Smoke run against a dev DB (optional, operator discretion): `MONGO_URI=mongodb://localhost:27017/carex-dev node scripts/seed-moderation-load.js --count=100 --clean` inserts exactly 100 users; subsequent `db.users.countDocuments({ localId: /^loadtest-/ })` returns 100
  </done>
</task>

<task type="auto">
  <name>Task 2: Create verify-indexes.sh</name>
  <files>backend-services/carEx-services/scripts/verify-indexes.sh</files>
  <read_first>
    - backend-services/carEx-services/scripts/seed-moderation-load.js (just-built — to know the data shape)
    - .planning/phases/06-affected-user-ux-security-review/06-PATTERNS.md §verify-indexes.sh (skeleton from RESEARCH)
    - .planning/phases/06-affected-user-ux-security-review/06-RESEARCH.md §Pitfall 10 (explain executionStats, not queryPlanner default)
  </read_first>
  <action>
    Create `backend-services/carEx-services/scripts/verify-indexes.sh`.

    ```bash
    #!/usr/bin/env bash
    # Phase 6 QUAL-02: Verify MongoDB IXSCAN usage for admin search + history indexes.
    # Runs 3 explain() queries and reports PASS/FAIL for each.

    set -euo pipefail

    : "${MONGO_URI:?MONGO_URI env var required}"

    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    echo "=== QUAL-02 Index Verification ==="
    echo

    mongosh "$MONGO_URI" --quiet <<'EOF'
    const results = [];
    function check(name, collection, query, indexField) {
      const plan = db[collection].find(query).explain('executionStats');
      const winning = plan.queryPlanner.winningPlan;
      const stageJson = JSON.stringify(winning);
      const usedIxscan = stageJson.includes('IXSCAN');
      const usedIndex = (winning.inputStage && winning.inputStage.indexName) || (winning.indexName) || stageJson.match(/"indexName"\s*:\s*"([^"]+)"/)?.[1] || 'none';
      results.push({ name, usedIxscan, usedIndex, docsExamined: plan.executionStats.totalDocsExamined, keysExamined: plan.executionStats.totalKeysExamined });
    }

    check('User.moderationStatus.state', 'users', { 'moderationStatus.state': 'feature_limited' });
    check('ModerationAction.targetUid+createdAt', 'moderationactions', { targetUid: 'loadtest-000001' });
    check('ModerationAction.adminUid+createdAt', 'moderationactions', { adminUid: 'loadtest-admin-001' });

    let allPassed = true;
    for (const r of results) {
      const verdict = r.usedIxscan ? 'PASS' : 'FAIL';
      if (!r.usedIxscan) allPassed = false;
      print(`${verdict}: ${r.name} — index=${r.usedIndex} docsExamined=${r.docsExamined} keysExamined=${r.keysExamined}`);
    }

    if (!allPassed) {
      print('\nFAILURE: One or more queries did not use IXSCAN. Add missing indexes or rerun seed.');
      quit(1);
    }
    print('\nAll 3 indexes verified.');
    EOF
    ```

    **Note:** the collection names (`users`, `moderationactions`) are lowercase and pluralized per Mongoose's default convention. Confirm these against the actual repo's Mongoose model registration before committing; if the repo uses `strictPopulate` or custom collection names, adjust.

    After creating: `chmod +x scripts/verify-indexes.sh`.
  </action>
  <verify>
    <automated>test -f backend-services/carEx-services/scripts/verify-indexes.sh && bash -n backend-services/carEx-services/scripts/verify-indexes.sh</automated>
  </verify>
  <done>
    - File exists at backend-services/carEx-services/scripts/verify-indexes.sh
    - `bash -n` exits 0 (shell syntax valid)
    - `grep -c "IXSCAN" backend-services/carEx-services/scripts/verify-indexes.sh` >= 1
    - `grep -c "explain('executionStats')" backend-services/carEx-services/scripts/verify-indexes.sh` equals 1
    - `grep -c "moderationStatus.state\|targetUid\|adminUid" backend-services/carEx-services/scripts/verify-indexes.sh` >= 3
    - `grep -c "MONGO_URI" backend-services/carEx-services/scripts/verify-indexes.sh` >= 2
    - `grep -c "mongodb://\|mongodb+srv://" backend-services/carEx-services/scripts/verify-indexes.sh` equals 0 (no hardcoded URI)
    - Smoke run (optional): after seeding 10k via Task 1, `MONGO_URI=... bash scripts/verify-indexes.sh` emits 3 PASS lines and exits 0
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Seed script → Mongo | Writes synthetic user records; must run against dev/staging, never prod |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-06-05 | Information disclosure (credentials leak) | Seed + verify scripts | mitigate | Both scripts read `MONGO_URI` from env; acceptance greps confirm zero hardcoded URIs. Top-of-file comment warns against prod runs. No credentials committed. |

Severity: low-medium. Operator discipline + grep acceptance closes the risk.
</threat_model>

<verification>
- Both scripts exist and pass syntax checks
- Zero hardcoded credentials
- Operator smoke test (optional): 100-user --clean seed + verify-indexes confirms end-to-end plumbing before 10k run
</verification>

<success_criteria>
- Cross-repo seeding infrastructure ready for Plan 06-0b to consume
- Index verification path separated from load-test harness (clean concern split)
- QUAL-02 prerequisite work complete
</success_criteria>

<output>
After completion, create `.planning/phases/06-affected-user-ux-security-review/06-0a-SUMMARY.md` (in the MOBILE repo's .planning directory — documentation lives here even though code lives in the backend repo, mirroring Phase 5 D-16 precedent).
</output>
