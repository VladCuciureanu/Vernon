import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getCommitCount,
  getCommitDiff,
  getFileAuthor,
  getFileContentBeforeDeletion,
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
    assert.deepEqual(getFileContentBeforeDeletion(fileName), "export const x = 1;");
    assert.deepEqual(getFileAuthor(fileName), "Test Author");
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
    assert.deepEqual(getCommitDiff("HEAD; touch pwned-semi"), "");
    assert.deepEqual(getCommitDiff("$(touch pwned-subst)"), "");
    assert.deepEqual(getCommitDiff("--output=pwned-opt"), "");
  });

  assert.deepEqual(existsSync(join(dir, "pwned-semi")), false);
  assert.deepEqual(existsSync(join(dir, "pwned-subst")), false);
  assert.deepEqual(existsSync(join(dir, "pwned-opt")), false);
});
