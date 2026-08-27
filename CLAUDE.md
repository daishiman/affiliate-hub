@AGENTS.md


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:6cd5cc61 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->

## Beads を書き換えるときの正規経路（このリポジトリ固有）

**上のブロックにある Quick Reference は beads が自動で書き込む汎用の文面で、
このリポジトリのフックとは食い違っています。** `bd` の書き換え系サブコマンド
（create / update / close / delete / purge / sql）を直に叩くと、PreToolUse フック
`.claude/plugins/dev-graph/hooks/guard-graph-schema.py` が次のように拒否します:

```
[guard-graph-schema] BLOCKED: Beads mutation は scripts/bd-bridge.py の単一チョークポイント経由に限定
```

実際に通るのは次の形だけです（フックが見ているのは「コマンド文字列に
`bd-bridge.py` が含まれるか」なので、この形なら通ります）:

```bash
B=.claude/plugins/dev-graph/scripts/bd-bridge.py

python3 $B --op show    --repo-root . --bd-issue-id <id>
python3 $B --op claim   --repo-root . --bd-issue-id <id>
python3 $B --op close   --repo-root . --bd-issue-id <id> --reason "<なぜ完了と言えるか>"
python3 $B --op update  --repo-root . --bd-issue-id <id> --status <status>
python3 $B --op dep-add --repo-root . --bd-issue-id <id> --depends-on <id>
```

`--dry-run` を付けると何も書かずに内容だけ返します。**先にこれで確かめること。**

epic（`issue_type=epic` の投影）を閉じるには `--feature-rollup-manifest` が要ります。
子が全部閉じたことを機械が確かめてからでないと epic は閉じられません。
「親だけ閉じて完了に見せる」ができないようにするためです。

読み取り系（一覧・詳細・ready・blocked・memories）はそのまま使えます。
止まるのは書き込みだけです。

**迂回しないこと。** チョークポイントは冪等性の確認・dev-graph node との突き合わせ・
workspace identity の検査をここ 1 か所でやっています。素の CLI が通ってしまうと、
Beads と dev-graph の状態が黙って食い違います。
