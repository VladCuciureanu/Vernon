import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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

test("cli - an option value that looks like an option gets one error line", { skip }, () => {
  const { dir } = makeRepo();
  for (const [name, value] of [
    ["--limit", "-1"],
    ["--ref", "-x"],
  ]) {
    const result = vernon(dir, "scan", name, value, "--dry-run");
    assertUsageError(result, /which looks like an option/);
    const errors = result.stderr.split("\n").filter((line) => line.startsWith("vernon: "));
    assert.deepEqual(errors, [
      `vernon: option '${name}' got '${value}', which looks like an option; write ${name}=${value}`,
    ]);
    assert.doesNotMatch(result.stderr, /-XYZ|\.\./);
  }
});

test("cli - an option followed by a long option needs a value", { skip }, () => {
  const { dir } = makeRepo();
  const result = vernon(dir, "scan", "--limit", "--verbose");
  assertUsageError(result, /^vernon: option '--limit' needs a value$/m);
  assert.deepEqual(
    result.stderr.split("\n").filter((line) => line.startsWith("vernon: ")).length,
    1,
  );
  assert.doesNotMatch(result.stderr, /--limit=/);
});

test("cli - an option value starting with a dash works with =", { skip }, () => {
  const { dir } = makeRepo();
  assertUsageError(
    vernon(dir, "scan", "--limit=-1", "--dry-run"),
    /^vernon: --limit must be a positive integer, got '-1'$/m,
  );
  const ok = vernon(dir, "scan", "--ref=HEAD~2..HEAD", "--limit=1", "--dry-run");
  assert.deepEqual(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /doomed\(\)/);
});

test("cli - parseArgs errors print one error line", { skip }, () => {
  const { dir } = makeRepo();
  for (const args of [["--dryrun"], ["--limit"], ["--dry-run=1"], ["-x"]]) {
    const result = vernon(dir, "scan", ...args);
    assert.deepEqual(result.status, 2, result.stdout);
    const stderr = result.stderr.trimEnd().split("\n");
    assert.deepEqual(stderr.length, 2, result.stderr);
    assert.match(stderr[0], /^vernon: \S.*[^.\s]$/);
    assert.match(stderr[1], /^Usage: vernon/);
  }
});

test("cli - options that don't apply to the command are usage errors", { skip }, () => {
  const { dir } = makeRepo();
  assertUsageError(vernon(dir, "diff", "--ref", "HEAD~2"), /--ref does not apply to diff/);
  assertUsageError(vernon(dir, "mourn", "api.ts", "--limit", "1"), /--limit does not apply/);
  assertUsageError(vernon(dir, "history", "--verbose"), /--verbose does not apply/);
  assertUsageError(vernon(dir, "hook", "install", "--dry-run"), /--dry-run does not apply/);
  assert.deepEqual(existsSync(join(dir, ".git", "hooks", "pre-commit")), false);
});

test("cli - mourn without a path is a usage error, not a scan", { skip }, () => {
  const { dir } = makeRepo();
  assertUsageError(vernon(dir, "mourn", "--ref", "HEAD~2..HEAD", "--dry-run"), /mourn needs/);
});

test("cli - hook without a valid action is a usage error on stderr", { skip }, () => {
  const { dir } = makeRepo();
  assertUsageError(vernon(dir, "hook"), /hook needs an action/);
  assertUsageError(vernon(dir, "hook", "instal"), /unknown hook action 'instal'/);
});

test("cli - extra arguments are usage errors", { skip }, () => {
  const { dir } = makeRepo();
  assertUsageError(vernon(dir, "scan", "HEAD~2"), /unexpected argument 'HEAD~2'/);
  assertUsageError(vernon(dir, "mourn", "a.ts", "b.ts"), /unexpected argument 'b\.ts'/);
});

test("cli - --help works with any command", { skip }, () => {
  const { dir } = makeRepo();
  const result = vernon(dir, "hook", "--help");
  assert.deepEqual(result.status, 0, result.stderr);
  assert.match(result.stdout, /Commands:/);
});

test("cli - obituaries piped to another program have no emoji", { skip }, () => {
  const { dir, git } = makeRepo();
  git("rm", "-q", "old.py");

  const result = vernon(dir, "diff", "--dry-run");

  assert.deepEqual(result.status, 0, result.stderr);
  assert.match(result.stdout, /old\.py/);
  assert.doesNotMatch(result.stdout, /\p{Extended_Pictographic}/u);
});

test("cli - --version prints the package version", { skip }, () => {
  const { dir } = makeRepo();
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

  const result = vernon(dir, "--version");

  assert.deepEqual(result.status, 0, result.stderr);
  assert.deepEqual(result.stdout.trim(), pkg.version);
});

test("cli - mourn accepts a directory and mourns everything under it", { skip }, () => {
  const { dir, git } = makeRepo();
  mkdirSync(join(dir, "lib", "sub"), { recursive: true });
  writeFileSync(join(dir, "lib", "a.py"), "x = 1\n");
  writeFileSync(join(dir, "lib", "sub", "b.py"), "y = 2\n");
  writeFileSync(join(dir, "library.py"), "z = 3\n");
  git("add", ".");
  git("commit", "-q", "-m", "add lib");
  git("rm", "-q", "-r", "lib", "library.py");
  git("commit", "-q", "-m", "drop lib");

  for (const path of ["lib", "lib/"]) {
    const result = vernon(dir, "mourn", path, "--dry-run");
    assert.deepEqual(result.status, 0, result.stderr);
    assert.match(result.stdout, /a\.py/);
    assert.match(result.stdout, /b\.py/);
    assert.doesNotMatch(result.stdout, /library\.py/);
  }

  const exact = vernon(dir, "mourn", "lib/a.py", "--dry-run");
  assert.match(exact.stdout, /a\.py/);
  assert.doesNotMatch(exact.stdout, /b\.py/);
});

test("cli - mourn rejects an empty or slash-only path but takes . as the whole tree", {
  skip,
}, () => {
  const { dir } = makeRepo();

  for (const path of ["", "/", "//", "\\"]) {
    assertUsageError(vernon(dir, "mourn", path, "--ref", "HEAD~2..HEAD"), /mourn needs a file/);
  }

  const all = vernon(dir, "mourn", ".", "--ref", "HEAD~2..HEAD", "--dry-run");
  assert.deepEqual(all.status, 0, all.stderr);
  assert.match(all.stdout, /doomed\(\)/);
});

test("cli - mourn normalises ./, backslashes and paths relative to a subdirectory", {
  skip,
}, () => {
  const { dir, git } = makeRepo();
  mkdirSync(join(dir, "src", "legacy"), { recursive: true });
  writeFileSync(join(dir, "src", "legacy", "a.py"), "x = 1\n");
  writeFileSync(join(dir, "src", "keep.py"), "y = 2\n");
  git("add", ".");
  git("commit", "-q", "-m", "add legacy");
  git("rm", "-q", "-r", "src/legacy", "src/keep.py");
  git("commit", "-q", "-m", "drop legacy");
  // git rm took the directories with it; recreate them to run vernon there.
  mkdirSync(join(dir, "src", "legacy"), { recursive: true });

  const cases: [string, string][] = [
    [dir, "./src/legacy"],
    [dir, "src\\legacy"],
    [dir, ".\\src\\legacy\\"],
    [join(dir, "src"), "legacy"],
    [join(dir, "src"), "./legacy/a.py"],
    [join(dir, "src", "legacy"), "."],
    [join(dir, "src", "legacy"), "../legacy"],
  ];
  for (const [cwd, path] of cases) {
    const result = vernon(cwd, "mourn", path, "--dry-run");
    assert.deepEqual(result.status, 0, result.stderr);
    assert.match(result.stdout, /a\.py/, `${path} from ${cwd}`);
    assert.doesNotMatch(result.stdout, /keep\.py/, `${path} from ${cwd}`);
  }
});
