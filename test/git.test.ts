import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  GitError,
  getCauseOfDeath,
  getCommitCount,
  getCommitDiff,
  getFileContentBeforeDeletion,
  getFileOrigin,
} from "../src/git.ts";

function makeTempRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "vernon-git-test-"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, stdio: "ignore" });
  git("init", "-q");
  git("config", "user.name", "Test Author");
  git("config", "user.email", "test@example.com");
  git("config", "commit.gpgsign", "false");
  return dir;
}

function inDir<T>(dir: string, fn: () => T): T {
  const prev = process.cwd();
  process.chdir(dir);
  try {
    return fn();
  } finally {
    process.chdir(prev);
  }
}

test("git - file paths with shell metacharacters are passed literally", () => {
  const dir = makeTempRepo();
  const fileName = "evil$(touch pwned-path)`touch pwned-tick`.ts";
  writeFileSync(join(dir, fileName), "export const x = 1;\n");
  execFileSync("git", ["add", "--", fileName], { cwd: dir, stdio: "ignore" });
  execFileSync("git", ["commit", "-q", "-m", "add evil file"], { cwd: dir, stdio: "ignore" });

  inDir(dir, () => {
    assert.deepEqual(
      getFileContentBeforeDeletion(fileName, { kind: "staged" }),
      "export const x = 1;",
    );
    assert.deepEqual(getFileOrigin(fileName)?.author, "Test Author");
    assert.deepEqual(getCommitCount(fileName), 1);
  });

  assert.deepEqual(existsSync(join(dir, "pwned-path")), false);
  assert.deepEqual(existsSync(join(dir, "pwned-tick")), false);
});

test("git - --ref with shell metacharacters runs nothing", () => {
  const dir = makeTempRepo();
  writeFileSync(join(dir, "a.ts"), "1\n");
  execFileSync("git", ["add", "a.ts"], { cwd: dir, stdio: "ignore" });
  execFileSync("git", ["commit", "-q", "-m", "init"], { cwd: dir, stdio: "ignore" });

  inDir(dir, () => {
    assert.throws(() => getCommitDiff("HEAD; touch pwned-semi"), GitError);
    assert.throws(() => getCommitDiff("$(touch pwned-subst)"), GitError);
    assert.throws(() => getCommitDiff("--output=pwned-opt"), GitError);
  });

  assert.deepEqual(existsSync(join(dir, "pwned-semi")), false);
  assert.deepEqual(existsSync(join(dir, "pwned-subst")), false);
  assert.deepEqual(existsSync(join(dir, "pwned-opt")), false);
});

test("git - an unknown --ref throws git's error instead of returning nothing", () => {
  const dir = makeTempRepo();
  writeFileSync(join(dir, "a.ts"), "1\n");
  execFileSync("git", ["add", "a.ts"], { cwd: dir, stdio: "ignore" });
  execFileSync("git", ["commit", "-q", "-m", "init"], { cwd: dir, stdio: "ignore" });

  inDir(dir, () => {
    assert.throws(
      () => getCommitDiff("no-such-branch"),
      (err: unknown) => {
        assert.ok(err instanceof GitError);
        assert.match(err.message, /no-such-branch/);
        return true;
      },
    );
  });
});

test("git - default scan of a repo with a single commit is empty, not an error", () => {
  const dir = makeTempRepo();
  writeFileSync(join(dir, "a.ts"), "1\n");
  execFileSync("git", ["add", "a.ts"], { cwd: dir, stdio: "ignore" });
  execFileSync("git", ["commit", "-q", "-m", "init"], { cwd: dir, stdio: "ignore" });

  inDir(dir, () => {
    assert.deepEqual(getCommitDiff(), "");
  });
});

// Builds: c1 adds old.ts (3 lines) + keep.ts, c2 "remove old" deletes old.ts,
// c3 "unrelated" edits keep.ts.
function makeHistoryRepo(): string {
  const dir = makeTempRepo();
  const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, stdio: "ignore" });
  writeFileSync(join(dir, "old.ts"), ["a", "b", "c"].join(String.fromCharCode(10)));
  writeFileSync(join(dir, "keep.ts"), "1");
  git("add", ".");
  git("commit", "-q", "-m", "add files");
  git("rm", "-q", "old.ts");
  git("commit", "-q", "-m", "remove old");
  writeFileSync(join(dir, "keep.ts"), "2");
  git("commit", "-q", "-am", "unrelated");
  return dir;
}

test("git - cause of death comes from the scanned range, not the latest commit", () => {
  const dir = makeHistoryRepo();
  inDir(dir, () => {
    assert.deepEqual(
      getCauseOfDeath("old.ts", { kind: "commits", ref: "HEAD~2..HEAD" }),
      "remove old",
    );
    assert.deepEqual(
      getCauseOfDeath("old.ts", { kind: "commits", ref: "HEAD~2..HEAD~1" }),
      "remove old",
    );
    assert.deepEqual(getCauseOfDeath("old.ts", { kind: "commits", ref: "HEAD~2" }), "remove old");
    assert.deepEqual(getCauseOfDeath("old.ts", { kind: "staged" }), "not yet committed");
  });
});

test("git - content before deletion is read from the start of the scanned range", () => {
  const dir = makeHistoryRepo();
  inDir(dir, () => {
    const content = getFileContentBeforeDeletion("old.ts", {
      kind: "commits",
      ref: "HEAD~2..HEAD",
    });
    assert.deepEqual(content?.split(String.fromCharCode(10)).length, 3);
    assert.ok(getFileContentBeforeDeletion("old.ts", { kind: "commits", ref: "HEAD~2...HEAD" }));
    assert.ok(getFileContentBeforeDeletion("old.ts", { kind: "commits", ref: "HEAD~2" }));
    assert.deepEqual(getFileContentBeforeDeletion("old.ts", { kind: "commits" }), null);
  });
});
