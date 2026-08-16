# run-dev-graph-init 検証契約

SKILL.md の Execution contract 5 が参照する検証詳細の正本。本文には「2 script を実行する」
という実行指示だけを残し、その根拠・境界条件をここに置く。

## 変数束縛

| 変数 | 束縛先 | 束縛しない場合の故障 |
|---|---|---|
| `$DEV_GRAPH_PLUGIN` | `$CLAUDE_PLUGIN_ROOT` | plugin 資産を caller repo から読もうとして script 不在で停止する |
| `$DEV_GRAPH_ROOT` | C24 `resolve-repo-context.py --mode write` receipt の `repo_root` | cwd から再解決すると、symlink 配布時に plugin directory 自身を content authority と誤認する |

cwd からの再解決は禁止する。C24 receipt を得ていない状態でこの 2 script を走らせない。

## config 検証 (`validate-repo-config.py`)

schema 適合だけでは検出できない不変条件を含めて 3 層で検査する。

| 層 | 検査内容 | finding code |
|---|---|---|
| schema | `repo-config.schema.json` への適合 (条件制約 `execution_tracker.mode ∈ {github,both}` → `github.enabled=true`、`claude_hooks.source=project` → `project_plugin_link` required を含む) | `schema_violation` |
| path | repo-relative 宣言・宣言重複・realpath による repo 内包・実在 | `path_not_repo_relative` / `declared_path_collision` / `path_escapes_repository` / `content_root_missing` / `content_root_key_unknown` |
| hook link | `claude_hooks.source=project` のときだけ `project_plugin_link` の実体が plain symlink か | `project_plugin_link_absent` / `project_plugin_link_not_symlink` / `project_plugin_link_broken` / `project_plugin_link_not_directory` |
| 秘密材料 | `github` セクション配下値への token / GitHub node ID 混入 | `secret_material` |

**path 層が schema と別に要る理由**: schema の `pattern` は文字列しか見ない。`issues` という
repo-relative 文字列は pattern を通るが、その実体が repo 外を指す symlink なら
`path_policy.allow_outside_repository=false` 契約に違反する。realpath 解決は文字列検査で
代替できない。

**重複判定は完全一致だけを対象にする**。入れ子は禁止できない — 実運用 config の
`plan_roots.state` (`.dev-graph/state`) は `local_state.graph` (`.dev-graph/state/graph.json`)
の祖先であり、正当な配置である。

**秘密材料の report は値そのものを出さない**。この report は eval-log へ残るため、
検出した token を detail に載せると report 自体が秘密の二次保管場所になる。prefix 種別だけを出す。

## `--require-content-roots` に渡す root

本 skill が生成契約とするのは次の 6 root だけ。

```
issues tasks specifications architecture features documents
```

schema の `content_roots.required` は 7 key だが、7 番目の `system_spec` は
`run-dev-graph-system-spec` が取込時に用意する別責務の root であり、init は作らない。
実在要求を「宣言された content_roots 全件」にすると、**正常に完了した直後の repo が
恒久的に FAIL する**ため、実在を要求する key は呼び手が明示列挙する契約になっている。

この 6 root の並びは `plugins/dev-graph/tests/test_validate_repo_config.py` の `INIT_ROOTS`
と一致していなければならない。SKILL.md 本文の実行コマンドと本節の双方を同テストが照合する。

## graph 検証 (`validate-graph-schema.py`)

対象は `.dev-graph/state/graph.json`。`.dev-graph/` 直下の `graph.json` ではない
(config・templates・姉妹 skill・fixture のすべてが `state/` 配下を正本とする)。

## 手書き検証の禁止

jsonschema を skill 実行中に手書きして代替しない。receipt の `schema_result` は上記 2 script
の実行出力を正本とし、手書き要約で置き換えない。検証失敗時に部分成功を成功扱いしない。
