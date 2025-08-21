# Vernon

Every time you delete a file or function, **Vernon** writes a short eulogy for it — sourced entirely from your git history.

> *"Here lies getUserById(), born March 2022, killed by a refactor. It survived 47 commits before meeting its end. Cause of death: "refactor: move to new query layer". No tests were broken in its removal. Suspicious."*

Your git history is now a cemetery.

## Install

### From JSR

```bash
deno install -g --allow-run --allow-read --allow-write jsr:@vladcuciureanu/vernon
```

### Standalone binary

```bash
deno compile --allow-run --allow-read --allow-write --output vernon bin/vernon.ts
```

This produces a single `vernon` binary with zero runtime dependencies.

## Usage

```bash
# Scan the latest commit for deletions
vernon scan

# Scan staged changes (pre-commit mode)
vernon diff

# Scan a specific range
vernon scan --ref HEAD~5..HEAD

# Preview without writing to CEMETERY.md
vernon scan --dry-run

# View the cemetery
vernon history

# Manually mourn a specific file
vernon mourn src/old-module.ts

# Built-in hook management
vernon hook install
vernon hook uninstall
```

### Options

| Flag | Description |
|------|-------------|
| `--dry-run` | Print obituaries to stdout only |
| `--verbose` | Show detection details |
| `--limit N` | Max obituaries per run (default: 20) |
| `--ref <ref>` | Git ref or range to scan |

## CEMETERY.md

Obituaries are appended to a `CEMETERY.md` file at your repo root:

```md
# Code Cemetery

> Where deleted code rests in peace.

## 2026-03-24

### getUserById() (src/api/users.ts)

> Here lies getUserById(), born 2022-03-15, deleted 2026-03-24.
> Touched by 47 commits and jane's bare hands.
> Killed by john, with the commit message "refactor: move to new query layer".
> No tests were broken in its removal. Suspicious.

### src/utils/legacy-parser.js

> Gone but not forgotten: legacy-parser.js.
> Created 2021-06-01, removed 2026-03-24. It had a good run.
> Served faithfully across 342 lines of pure logic.
> The death certificate reads: "chore: remove dead code".
> 404: Function not found. Forever.
```

The file is left **uncommitted** so you can include it on your own terms.

## Git Hook Setup

### Built-in

```bash
vernon hook install    # writes to .git/hooks/pre-commit
vernon hook uninstall  # removes it
```

This appends a `deno run` command to your pre-commit hook. If a hook already exists, it won't overwrite it — just appends.

### Manual hook

Add this to `.git/hooks/pre-commit` (or your hook runner of choice):

```bash
deno run --allow-run --allow-read --allow-write jsr:@vladcuciureanu/vernon diff
```

## Supported Languages

Function and class detection works for:

| Language | Extensions | What it detects |
|----------|------------|----------------|
| JavaScript / TypeScript | `.js` `.ts` `.jsx` `.tsx` `.mjs` `.cjs` | functions, arrow functions, classes, methods |
| Python | `.py` | `def`, `class` |
| Go | `.go` | `func`, methods with receivers |
| Rust | `.rs` | `fn`, `impl` |
| Java / Kotlin | `.java` `.kt` | methods, classes |
| Ruby | `.rb` | `def`, `class` |
| PHP | `.php` | `function`, `class` |

Whole-file deletions are detected for **all** file types.

## How It Works

1. **Diff parsing** — reads `git diff` output, finds deleted files and removed hunks
2. **Function detection** — regex-based, scans removed lines for function/class signatures
3. **Metadata extraction** — queries `git log` for birth date, original author, commit count, last editor
4. **Obituary generation** — picks random fragments from 5 flavour pools (24,192 unique combinations), interpolates with real git data
5. **Cemetery** — appends to `CEMETERY.md`

No AI. No network calls. Just git and templates.
