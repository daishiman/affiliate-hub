<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 枝の順番

```
作業ブランチ ──PR──▶ dev ──PR──▶ main
                      │            │
                   開発環境       本番
```

**PR の宛先は既定で `dev` です。`main` へ直接出さないでください。**
`main` への PR は比較元が `dev` か `hotfix/*` でないと `branch-flow.yml` が落とします。

- 作業を始めるとき: `dev` から枝を切る
- 出すとき: `gh pr create --base dev`（宛先を省くと既定ブランチ＝`dev` になります）
- 本番へ出すとき: `dev` から `main` への PR を出す
- 本番だけが壊れていて急ぐとき: 枝を `hotfix/...` と名付けて `main` へ。
  **マージしたら `git push origin origin/main:dev` で `dev` へ戻すこと。**

戻し忘れると `dev` だけが古いまま取り残されます。2026-08-21 に実際そうなり、
`dev` が `main` から 451 コミット遅れて、開発環境では `/admin` も `/s` も 404 でした。
確かめる場所が本番しか無い状態になります。

詳しくは [README の「環境とデプロイフロー」](./README.md#環境とデプロイフロー)。

## 使えるエージェント資産 (AIDD エージェントキット v1.10.4)

このリポジトリはキットの**配布先**です。編集原本はここにはありません。
原本は `kanjo` リポジトリの `aidd-agent-kit/` にあり、そこから
`install-mac.command` が各ホストの実行時配置へ写します。

**下表の実行時配置を直接編集しないでください。** 直しても次の同期で消えます。
直すのは原本side、その後このリポジトリへ再同期して PR を出します。

| 種類 | Codex が読む場所 | Claude Code が読む場所 | 編集原本 (kanjo 側) |
|---|---|---|---|
| Skill | `.agents/skills/<name>/SKILL.md` | `.claude/skills/<name>/SKILL.md` | `aidd-agent-kit/skills/<name>/` |
| ワークフロー Skill | `.agents/skills/<name>/SKILL.md` | `.claude/commands/<name>.md` | `aidd-agent-kit/codex/workflow-skills/<name>/` |
| サブエージェント | `.codex/agents/app-orchestrator.toml` | `.claude/agents/app-orchestrator.md` | `aidd-agent-kit/codex/agents/`, `aidd-agent-kit/agents/` |

同期後の版は `.claude/aidd-agent-kit.version` に入ります。
どのファイルがキット所有かは `.claude/aidd-agent-kit.manifest` が持ちます。
**この一覧に載らないファイルはキットの管理外**で、同期では消えません。

`.codex/` は `.gitignore` で除外しているため、Codex の custom agent TOML は
各自の作業ツリーにだけ存在し、git には載りません。Codex 側を使うときは
自分で同期を実行してください。

`.claude/plugins/` 以下の harness 系プラグインはキットとは別系統です。
キットの同期はそちらに触れません。

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:970c3bf2 -->
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
   bd dolt push
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->

<!-- BEGIN BEADS CODEX SETUP: generated by bd setup codex -->
## Beads Issue Tracker

Use Beads (`bd`) for durable task tracking in repositories that include it. Use the `beads` skill at `.agents/skills/beads/SKILL.md` (project install) or `~/.agents/skills/beads/SKILL.md` (global install) for Beads workflow guidance, then use the `bd` CLI for issue operations.

### Quick Reference

```bash
bd ready                # Find available work
bd show <id>            # View issue details
bd update <id> --claim  # Claim work
bd close <id>           # Complete work
bd prime                # Refresh Beads context
```

### Rules

- Use `bd` for all task tracking; do not create markdown TODO lists.
- Run `bd prime` when Beads context is missing or stale. Codex 0.129.0+ can load Beads context automatically through native hooks; use `/hooks` to inspect or toggle them.
- Keep persistent project memory in Beads via `bd remember`; do not create ad hoc memory files.

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.
<!-- END BEADS CODEX SETUP -->


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
