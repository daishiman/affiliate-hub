# dev-graph

dev-graph は、repository内のMarkdownと`.dev-graph/state/graph.json`を正本にして、作業ノード・依存関係・tracker投影・複数worktree実行を管理するlocal-first pluginです。

## Public command

`/dev-graph`のpublic verbは、システム開発を要件定義から運用まで毎回同じ手順で進めるための次の11個です。

```text
/dev-graph init
/dev-graph spec
/dev-graph decompose ...
/dev-graph plan --feature-id <id> --feature-context <relative-json>
/dev-graph requirements --feature-id <id> --handoff-target <target>
/dev-graph node ...
/dev-graph next ...
/dev-graph worktree <claim|heartbeat|park|release|reclaim|list> ...
/dev-graph status ...
/dev-graph sync ...
/dev-graph render ...
```

`init → spec → decompose → plan → requirements`は前工程の出力を次工程が使う一方向パイプライン、`node → next → worktree → status → sync`は開発中に繰り返す運用ループです。`render`は任意の時点で実行できます。

| verb | 役割 | 主な出力 |
|---|---|---|
| `init` | dev-graphと保存先を冪等に初期化 | content root 6個＋`.dev-graph/` |
| `spec` | 確定仕様・設計をsource_lineage付きで取込 | `system-spec/`＋`specs/`＋`architecture/`＋graph |
| `decompose` | 構想をfeature・architecture・依存へマクロ分解 | `features/`＋`architecture/`＋graph |
| `plan` | ready featureをタスク仕様書へ分解 (external `run-system-dev-plan`) | `.dev-graph/plans/`。昇格後は`tasks/<feature>/` |
| `requirements` | 実装要件を導出しreadiness充足時にhandoff | 要件定義書＋handoff |
| `node` | 1ノードのMarkdownとgraphをall-or-noneで追加・差分更新 | `issues/`、`tasks/`、`specs/`、`architecture/`、`docs/`、`features/`＋graph |
| `next` | 依存・resource競合・active leaseを満たす次のbatchを計算 | 画面＋`eval-log/` |
| `worktree` | worktree leaseをclaim/更新/解放 | `<git-common-dir>/dev-graph/{leases,events}.json` |
| `status` | node・依存・完了状態をread-only検索 | 画面＋`eval-log/` |
| `sync` | Beads/GitHub/PRと冪等収束 | graph＋外部tracker＋完了時の`tasks/` |
| `render` | 外部依存なしの静的SVG/HTMLを生成 | `.dev-graph/render/index.html` |

## Direct script smoke checks

repository rootで次を実行できます。

```bash
python3 "${CLAUDE_PLUGIN_ROOT:-plugins/dev-graph}/scripts/resolve-repo-context.py" --repo-root "$PWD" --mode read
python3 "${CLAUDE_PLUGIN_ROOT:-plugins/dev-graph}/scripts/validate-graph-schema.py" --repo-root "$PWD" --graph .dev-graph/state/graph.json
python3 "${CLAUDE_PLUGIN_ROOT:-plugins/dev-graph}/scripts/validate-repo-config.py" --repo-root "$PWD" --config .dev-graph/config.json
python3 "${CLAUDE_PLUGIN_ROOT:-plugins/dev-graph}/scripts/build-parity-manifest.py" --repo-root "$PWD" --out eval-log/dev-graph/run-dev-graph-schedule/parity-manifest.json
python3 "${CLAUDE_PLUGIN_ROOT:-plugins/dev-graph}/scripts/schedule-graph.py" --repo-root "$PWD" --graph .dev-graph/state/graph.json --leases "$(git rev-parse --git-common-dir)/dev-graph/leases.json" --eval-log eval-log/run-dev-graph-schedule-execution.json
python3 "${CLAUDE_PLUGIN_ROOT:-plugins/dev-graph}/scripts/status-graph.py" --repo-root "$PWD" --status active
python3 "${CLAUDE_PLUGIN_ROOT:-plugins/dev-graph}/scripts/manage-worktree-lease.py" --repo-root "$PWD" --op list
python3 "${CLAUDE_PLUGIN_ROOT:-plugins/dev-graph}/scripts/sync-graph.py" --repo-root "$PWD" --dry-run
python3 "${CLAUDE_PLUGIN_ROOT:-plugins/dev-graph}/scripts/render-graph-html.py" --repo-root "$PWD" --graph .dev-graph/state/graph.json --out .dev-graph/render/index.html
```

`node`は、完全なnodeまたは既存nodeへのpatchをJSONで渡します。`body`はfrontmatterを含めません。

```json
{
  "graph_node_id": "task-example",
  "patch": {"graph_node_id": "task-example", "status": "active"},
  "body": "# 目的\n\n差分更新後の本文"
}
```

```bash
python3 "${CLAUDE_PLUGIN_ROOT:-plugins/dev-graph}/scripts/upsert-node.py" \
  --repo-root "$PWD" \
  --input .dev-graph/staging/node-input.json \
  --dry-run
```

## Safety boundaries

- `node`だけが通常のgraph/content writerです。package登録とlifecycle更新もC02 writer契約を経由します。
- `node`はWAL（先行書込みログ）を使い、割込み後は次の`node`実行でrollbackしてから再実行します。pending中はread-only consumerがfail-closedで停止します。
- `next`と`status`はgraph/content/tracker/leaseを変更しません。許可する書込みは`eval-log/`だけです。
- `next`のBeads経路は、parity manifestの由来（`generated_at`／`source_graph_digest`）を必須にします。`source_graph_digest`がgraphのcanonical digestと一致しないsnapshotはstaleとして停止します。回復手順は`scripts/build-parity-manifest.py`によるmanifestの再生成であり、digestを現在値へ書き換えることではありません（正本: `references/execution-tracker-contract.md` §10）。
- parity manifestの生成は`build-parity-manifest.py`の単一writerに限ります。graphだけを読みtrackerを読まないため、C28の突合が「自分で作った答えを自分で採点する」形になりません。`sync --apply --parity-manifest <path>`は同じgeneratorを収束直後に呼びます。
- worktree leaseは`.dev-graph/locks/`へ保存しません。git共通ディレクトリ配下の`dev-graph/`を使います。
- `sync --dry-run`はlocal/Beads/GitHub/Projects writeを0件にします。
- `sync-graph.py --apply`後は同じ入力で`--dry-run`を再実行し、`changes=0`と`pending_retry=[]`を確認します。fixture adapterは`--remote-state <repo内JSON>`で決定論的に試験できます。
- `render`はgraphを変更せず、repository内のHTML出力だけを書き換えます。
- public dispatcherは全11 verbを正規capabilityへdispatchします。上流verb（`init/spec/decompose/plan/requirements`）の成果物確定は各dispatch先Skillが行い、上位commandが自動登録しない成果物だけを`node`（単一writer）で登録します。`system-spec`という単独verbはありません（`spec`がsystem-spec-harnessを引用します）。

## graph.json の merge driver install (clone / worktree ごとに 1 回)

`.dev-graph/state/graph.json` は約 340 ノードが 1 配列に並ぶ単一 JSON のため、git 標準の行ベース 3-way マージは近接した追加/削除を衝突として誤検出します。`graph_node_id` を鍵にした構造マージ driver を使ってください。

```bash
python3 "${CLAUDE_PLUGIN_ROOT:-plugins/dev-graph}/scripts/build-merged-graph.py" --install
```

`.gitattributes` は `merge=devgraph-json` という **driver 名**しか宣言できません (任意コマンドの実行になるため、コマンド本体の指定を git が禁じています)。名前からコマンドへの解決は `git config merge.devgraph-json.driver` 側にあるため、**clone と worktree のたびに上記 `--install` が必要**です。冪等 (何回実行しても同じ結果) なので迷ったら再実行してかまいません。

未 install の環境では driver 名が解決できず、git は従来どおり行ベースで衝突を表示します (壊れた自動解決にはなりません = fail-safe)。

既に conflicted になってしまった graph を後から解消する場合:

```bash
python3 "${CLAUDE_PLUGIN_ROOT:-plugins/dev-graph}/scripts/build-merged-graph.py" --resolve-conflict --dry-run
python3 "${CLAUDE_PLUGIN_ROOT:-plugins/dev-graph}/scripts/build-merged-graph.py" --resolve-conflict
```

片側から消えているノードは既定で温存します (事故で消えたノードを黙って葬らないため)。意図的な削除と確認できた場合だけ `--accept-deletion <graph_node_id>` で明示承認してください。

## Validation

```bash
python3 -m pytest plugins/dev-graph/tests -q
claude plugin validate plugins/dev-graph
```

## 改善要望

本 plugin への改善要望は `/run-skill-feedback dev-graph` で投入できます (SSOT: harness-creator/skills/run-skill-feedback、symlink 配備)。
