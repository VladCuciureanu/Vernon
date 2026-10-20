# Vernon

Vernon writes obituaries for the files and functions you delete, using your git history for the facts and a set of templates for the grief.

```md
### getUserById() (src/api/users.ts)

> Here lies getUserById(), born 2022-03-15, deleted 2026-03-24. Touched by 47 commits and jane's bare hands. Killed by john, with the commit message "refactor: move to new query layer". No tests were broken in its removal. Suspicious.
```

No AI and no network calls: just `git` and templates.

## Requirements

- Node.js 26 or newer
- `git` on your PATH

## Install

Vernon isn't on the npm registry yet, so install it from a clone:

```bash
git clone https://github.com/VladCuciureanu/Vernon.git
cd Vernon
npm install     # the prepare script compiles to dist/
npm link        # puts `vernon` on your PATH
```

An earlier Deno build is published on JSR as `jsr:@vladcuciureanu/vernon`.

## Usage

```bash
vernon scan                         # deletions in the latest commit (HEAD~1..HEAD)
vernon scan --ref HEAD~5..HEAD      # deletions in a range
vernon diff                         # deletions in the staged changes
vernon mourn src/old-module.ts      # only deletions in this exact path (accepts --ref)
vernon history                      # print CEMETERY.md
vernon hook install                 # add Vernon to the pre-commit hook
vernon hook uninstall               # remove it again
```

With no command, Vernon runs `scan`. Obituaries are printed to stdout and appended to `CEMETERY.md` at the repository root, under a heading for today's date. Vernon never commits that file; that's up to you.

| Option | Applies to | Description |
|--------|------------|-------------|
| `--ref <ref>` | `scan`, `mourn` | Revision range to scan (default `HEAD~1..HEAD`). A single ref is compared against the working tree. |
| `--dry-run` | `scan`, `diff`, `mourn` | Print obituaries without writing `CEMETERY.md` |
| `--limit <n>` | `scan`, `diff` | Maximum obituaries per run (default 20) |
| `--verbose` | `scan`, `diff`, `mourn` | List each detected deletion, and say when none were found or the limit cut some off |
| `-h`, `--help` | all | Show help |

Errors are printed to stderr as a single `vernon: ...` line. Outside a git repository, `scan`, `diff` and `mourn` exit with status 1, and so does a git error (for example an unknown ref). A usage error (an unknown command or option, an option missing its value, or a `--limit` that isn't a positive integer) also prints a short usage line and exits with status 2.

### Pre-commit hook

`vernon hook install` adds these lines to the `pre-commit` hook in the hooks directory git uses (`core.hooksPath` is respected), creating the hook if needed and inserting before a trailing `exit` in an existing one:

```sh
# vernon hook
command -v vernon >/dev/null 2>&1 && vernon diff || true
```

The hook is skipped when `vernon` isn't on your PATH and never blocks a commit. `vernon hook uninstall` removes only those lines, and deletes the hook if nothing else is left in it. To manage the hook yourself, add the second line to whatever hook runner you use.

### What gets detected

Whole-file deletions are detected for every file type. Deleted functions and classes are detected by regex in these languages; a signature that is removed and re-added in the same file (edited or moved) is not counted.

| Language | Extensions | Detects |
|----------|------------|---------|
| JavaScript / TypeScript | `.js` `.jsx` `.ts` `.tsx` `.mjs` `.cjs` | functions, arrow functions assigned to variables, classes, methods |
| Python | `.py` | `def`, `class` |
| Go | `.go` | `func`, including methods |
| Rust | `.rs` | `fn`, `impl` |
| Java / Kotlin | `.java` `.kt` | methods with an access modifier, classes |
| Ruby | `.rb` | `def`, `class` |
| PHP | `.php` | `function`, `class` |

Each obituary combines one line from each of five template pools (24,192 combinations) with the file's creation date, original author, last editor, commit count, line count and the subject of the commit that deleted it.

## Development

```bash
npm test                          # node:test, test/**/*.test.ts
npm run check                     # biome check, typecheck and tests
npm run format                    # format and apply safe fixes with Biome
npm run build                     # compile to dist/
npm start -- scan --dry-run       # run from source
npm run dev -- scan --dry-run     # run from source, restarting on changes
```

## License

MIT
