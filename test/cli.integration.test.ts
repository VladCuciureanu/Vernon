import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const BIN = fileURLToPath(new URL("../bin/vernon.ts", import.meta.url));
const hasGit = spawnSync("git", ["--version"]).status === 0;
const skip = hasGit ? false : "git not installed";

function lines(...l: string[]): string {
  return `${l.join("\n")}\n`;
}

// c1 "add files": api.ts (keepMe, doomed), old.py
// c2 "remove doomed": deletes doomed(), edits keepMe's signature
// c3 "unrelated change": edits notes.txt
function makeRepo(): { dir: string; git: (...args: string[]) => void } {
  const dir = mkdtempSync(join(tmpdir(), "vernon-cli-test-"));
  const git = (...args: string[]) => {
    execFileSync("git", args, { cwd: dir, stdio: "ignore" });
  };
  git("init", "-q");
  git("config", "user.name", "Test Author");
  git("config", "user.email", "test@example.com");
  git("config", "commit.gpgsign", "false");

  writeFileSync(
    join(dir, "api.ts"),
    lines(
      "export function keepMe(a: number) {",
      "  return a;",
      "}",
      "",
      "export function doomed() {",
      "  return 1;",
      "}",
    ),
  );
  writeFileSync(join(dir, "old.py"), lines("def legacy():", "    pass"));
  writeFileSync(join(dir, "notes.txt"), "v1\n");
  git("add", ".");
  git("commit", "-q", "-m", "add files");

  writeFileSync(
    join(dir, "api.ts"),
    lines("export function keepMe(a: number, b: number) {", "  return a + b;", "}"),
  );
  git("commit", "-q", "-am", "remove doomed");

  writeFileSync(join(dir, "notes.txt"), "v2\n");
  git("commit", "-q", "-am", "unrelated change");

  return { dir, git };
}

function vernon(dir: string, ...args: string[]) {
  return spawnSync(process.execPath, [BIN, ...args], { cwd: dir, encoding: "utf8" });
}

test("cli - scan --ref mourns deletions in the range with that range's commit message", {
  skip,
}, () => {
  const { dir } = makeRepo();

  const result = vernon(dir, "scan", "--ref", "HEAD~2..HEAD", "--dry-run");

  assert.deepEqual(result.status, 0, result.stderr);
  assert.match(result.stdout, /doomed\(\)/);
  assert.match(result.stdout, /remove doomed/);
  assert.doesNotMatch(result.stdout, /keepMe/);
  assert.doesNotMatch(result.stdout, /unrelated change/);
  assert.deepEqual(existsSync(join(dir, "CEMETERY.md")), false);
});

test("cli - diff mourns staged deletions and writes CEMETERY.md", { skip }, () => {
  const { dir, git } = makeRepo();
  git("rm", "-q", "old.py");

  const result = vernon(dir, "diff");

  assert.deepEqual(result.status, 0, result.stderr);
  assert.match(result.stdout, /old\.py/);
  assert.match(result.stdout, /not yet committed/);
  const cemetery = readFileSync(join(dir, "CEMETERY.md"), "utf8");
  assert.match(cemetery, /### old\.py/);
  assert.match(cemetery, /not yet committed/);
});

test("cli - a bad --ref prints git's error and exits 1", { skip }, () => {
  const { dir } = makeRepo();

  const result = vernon(dir, "scan", "--ref", "no-such-ref");

  assert.deepEqual(result.status, 1);
  assert.match(result.stderr, /^vernon: .*no-such-ref/m);
  assert.deepEqual(result.stdout, "");
});

function assertUsageError(result: ReturnType<typeof vernon>, message: RegExp): void {
  assert.deepEqual(result.status, 2, result.stdout);
  assert.match(result.stderr, message);
  assert.match(result.stderr, /^vernon: /);
  assert.match(result.stderr, /Usage: vernon/);
  assert.deepEqual(result.stdout, "");
}

test("cli - an unknown command is a usage error, not a scan", { skip }, () => {
  const { dir } = makeRepo();
  assertUsageError(vernon(dir, "sacn", "--dry-run"), /unknown command 'sacn'/);
});

test("cli - unknown flags are usage errors", { skip }, () => {
  const { dir } = makeRepo();
  assertUsageError(vernon(dir, "scan", "--dryrun"), /unknown option '--dryrun'/);
  assertUsageError(vernon(dir, "-x"), /unknown option '-x'/);
});

test("cli - --ref and --limit without a value are usage errors", { skip }, () => {
  const { dir } = makeRepo();
  assertUsageError(vernon(dir, "scan", "--ref"), /--ref/);
  assertUsageError(vernon(dir, "scan", "--dry-run", "--limit"), /--limit/);
});

test("cli - --limit must be a positive integer", { skip }, () => {
  const { dir } = makeRepo();
  for (const bad of ["abc", "0", "1.5", "3x"]) {
    assertUsageError(vernon(dir, "scan", "--limit", bad, "--dry-run"), /--limit must be/);
  }
  const ok = vernon(dir, "scan", "--ref", "HEAD~2..HEAD", "--limit", "1", "--dry-run");
  assert.deepEqual(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /doomed\(\)/);
});
