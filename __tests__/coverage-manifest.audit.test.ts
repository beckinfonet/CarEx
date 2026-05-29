// Phase 11 LQUAL-02 self-audit: the per-requirement coverage manifest must
// exist on disk, must be regenerable from scripts/generate-coverage-manifest.sh,
// and must report zero missing LIST-* requirements. This is the LQUAL-02
// deliverable check — without it, LQUAL-02 itself has no covering test.
//
// Why this lives in mobile __tests__ (and not in the planning tree): Phase 11
// CONTEXT D-10 + Plan 11-07 mandate the manifest is regenerable, not
// hand-curated. The cleanest way to enforce that invariant in CI is a jest
// test that re-runs the generator and diffs against the committed manifest.

import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';

const REPO_ROOT = path.resolve(__dirname, '..');
const SCRIPT_PATH = path.join(REPO_ROOT, 'scripts', 'generate-coverage-manifest.sh');
const MANIFEST_PATH = path.join(
  REPO_ROOT,
  '.planning',
  'phases',
  '11-buyer-affected-ux-quality-security-review',
  '11-COVERAGE.md',
);

// Anchor the sibling backend off the MAIN repo root (worktree-aware), matching
// the script's own resolution. `git rev-parse --git-common-dir` returns the
// worktree's git-dir for a normal checkout and the main repo's git-dir
// (.git/worktrees/<id>'s grandparent) when run from a worktree.
function resolveMainRepoRoot(): string {
  try {
    const commonDir = execFileSync('git', ['rev-parse', '--git-common-dir'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    }).trim();
    // common-dir may be relative; resolve against REPO_ROOT.
    const absCommonDir = path.isAbsolute(commonDir)
      ? commonDir
      : path.resolve(REPO_ROOT, commonDir);
    // For `…/.git` it's the main repo's git-dir; parent IS main repo root.
    if (absCommonDir.endsWith('/.git')) {
      return path.dirname(absCommonDir);
    }
    return REPO_ROOT;
  } catch {
    return REPO_ROOT;
  }
}

const MAIN_REPO_ROOT = resolveMainRepoRoot();
const BACKEND_PATH = path.resolve(MAIN_REPO_ROOT, '..', 'backend-services', 'carEx-services', '__tests__');

describe('LQUAL-02: per-requirement coverage manifest self-audit', () => {
  test('generator script exists and is executable', () => {
    expect(fs.existsSync(SCRIPT_PATH)).toBe(true);
    // Check executable bit (any of owner/group/other).
    const mode = fs.statSync(SCRIPT_PATH).mode;
    // eslint-disable-next-line no-bitwise
    expect(mode & 0o111).not.toBe(0);
  });

  test('committed 11-COVERAGE.md manifest exists', () => {
    expect(fs.existsSync(MANIFEST_PATH)).toBe(true);
  });

  // The next two assertions require running the generator. Skip them if the
  // sibling backend repo is not present on this machine (e.g., CI without
  // backend checkout) — partial-coverage gating is still useful to surface,
  // but the "zero missing" gate is only meaningful when both repos are
  // visible to the script.
  const backendPresent = fs.existsSync(BACKEND_PATH);

  (backendPresent ? test : test.skip)(
    'committed manifest matches a fresh `bash scripts/generate-coverage-manifest.sh` run',
    () => {
      const fresh = execFileSync('bash', [SCRIPT_PATH], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
      });
      const committed = fs.readFileSync(MANIFEST_PATH, 'utf8');
      // Normalize the timestamp line so re-runs are deterministic across time.
      const stripTimestamp = (s: string) =>
        s.replace(/^Generated: .*$/m, 'Generated: <stripped>');
      expect(stripTimestamp(fresh)).toBe(stripTimestamp(committed));
    },
  );

  (backendPresent ? test : test.skip)(
    'manifest reports zero missing LIST-* requirements (coverage-check block is clean)',
    () => {
      const committed = fs.readFileSync(MANIFEST_PATH, 'utf8');
      const missingLines = committed
        .split('\n')
        .filter((line) => /❌\s+\*\*L(BUY|QUAL|MOB|UI|ADM|DATA|ENF|SEC)-/.test(line));
      // If this trips, regenerate the manifest and add a covering describe()
      // (or document the gap with operator sign-off per Plan 11-07 Task 2).
      expect(missingLines).toEqual([]);
      expect(committed).toMatch(/All LIST-\* requirements covered\./);
    },
  );
});
