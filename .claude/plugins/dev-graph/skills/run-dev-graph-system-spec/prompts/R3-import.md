# Prompt: R3-import

> 確定system-spec章をC02経由で登録しsource_lineage(origin_kind/plugin/path/version/digest/imported_at)、confirmation=confirmed、evaluator evidenceを保持する

## Layer 1: 基本定義層

- `responsibility_id`: `R3-import`
- `skill`: `run-dev-graph-system-spec`
- 不変目的: 確定system-spec章をC02経由で登録しsource_lineage(origin_kind/plugin/path/version/digest/imported_at)、confirmation=confirmed、evaluator evidenceを保持する
- 成功条件は Layer 2 の受入条件と Layer 5 の二値 checklist の同時充足とする。

## Layer 2: ドメイン層

### 入力契約

- confirmed chapters、evaluator PASS、origin lineage、readiness。

### 出力契約

- C02 receiptとlineage/confirmation/evidence付きimport report。
- 登録・更新した node id を progress.json の `registered_this_run` へ追記する。
- 各 node の `source_digest` は自 `source_path` の実 file から sha256 計算 (他 file の digest 流用禁止。`validate-source-digest.py` の exit code で担保)。
- `confirmation_evidence.evidence_ref` は登録時点で対象 repository 内に実在する path を指す (正準: `system-spec/completeness-report.json`)。

### C02 登録の決定論的準備

system-spec-harness の evaluator が `PASS` の場合だけ、次の準備 script を実行する。これは
specification/architecture の内容を生成し直さず、確定済み `system-spec/` 成果物の本文そのものから
C02 用の 40-key node envelope と substantive body（空や placeholder でない本文）を作る adapter である。
組込み contract は artifact path と node shape のみを持ち、製品固有の本文を持たない。各出力 body は
対応する `source_artifact` の本文（YAML frontmatter のみ除去）と同一でなければならない。

この source-derived body は dev-graph の汎用 specification / architecture テンプレートを
埋めた成果物ではない。C11 は `source_lineage.origin_kind=system-spec-harness` を根拠に、
`template-contract.json#conditional_required_sections.system_spec_harness*` の確定 system-spec
見出し集合を適用する。manual origin は従来どおり汎用テンプレートの全見出しを要求し、
architecture も specification と同じく見出し欠落を fail-closed で拒否する。

```bash
IMPORT_DIR="$DEV_GRAPH_ROOT/.dev-graph/tmp/system-spec-import"
python3 "${CLAUDE_PLUGIN_ROOT:-plugins/dev-graph}/scripts/build-system-spec-import.py" \
  --repo-root "$DEV_GRAPH_ROOT" --out-dir "$IMPORT_DIR"
```

必ず architecture を先に、specification を後に C02 `upsert-node.py` で登録する。後者が
architecture_refs で前者を参照するため、順序を逆にすると dangling reference（存在しない参照）で
失敗する。`--body-file` を省略すると template の placeholder が C11 に拒否されるため、出力された
body を必ず渡す。`id`/`kind` 等の旧 alias を書き直したり、node envelope を手作業で再構成しない。

```bash
python3 "${CLAUDE_PLUGIN_ROOT:-plugins/dev-graph}/scripts/upsert-node.py" \
  --repo-root "$DEV_GRAPH_ROOT" --input "$IMPORT_DIR/architecture.node.json" \
  --body-file "$IMPORT_DIR/architecture.body.md"
python3 "${CLAUDE_PLUGIN_ROOT:-plugins/dev-graph}/scripts/upsert-node.py" \
  --repo-root "$DEV_GRAPH_ROOT" --input "$IMPORT_DIR/specification.node.json" \
  --body-file "$IMPORT_DIR/specification.body.md"
```

各 C02 receipt の `graph_node_id` を `registered_this_run` に追記し、最後に
`validate-graph-schema.py`、`validate-source-digest.py`、`validate-evidence-refs.py` を実行する。

### 責務境界

- C02迂回で書かず内容をfeatureへ複製せず未確定章を登録しない。

### 受入条件

- 全node正規kind、lineage全field/evidence/readiness欠落0になる。
- `validate-evidence-refs.py --progress <progress.json>` が exit 0 (本 run 登録 node の dangling 0件を script の exit code で担保。既存 node の dangling は同 script が `evidence_ref_audit` へ自動転記)。

## Layer 3: インフラ層

- 使用資産: C02 `upsert-node.py` とvalidate-graph-schemaとvalidate-evidence-refsとvalidate-source-digest。
- path は caller repository context または skill-relative reference から解決し、環境固有の絶対 path を成果物へ保存しない。

## Layer 4: 共通ポリシー層

- 入力契約、authority、containment、schema のいずれかが未達なら fail-closed とし、部分成功を PASS にしない。
- secret と認証情報を prompt 出力、graph、receipt に埋め込まない。
- 同一入力と同一 revision/digest では同じ decision と output shape を返す。

## Layer 5: エージェント層 (l5-contract v2.0.0)

### 5.1 担当 agent

- `run-dev-graph-system-spec/R3-import`。重い判断または独立検証は `Agent` で分離 context に fork する。

### 5.2 ゴール定義

- 目的: 確定system-spec章をC02経由で登録しsource_lineage(origin_kind/plugin/path/version/digest/imported_at)、confirmation=confirmed、evaluator evidenceを保持する
- 背景: この責務を隣接 responsibility から分離し、入力・出力・authority を一意にする。
- 達成ゴール: C02 receiptとlineage/confirmation/evidence付きimport reportが生成され、受入条件を満たした状態になっている。

### 5.3 完了チェックリスト (ゴール到達の停止条件)

- [ ] 宣言した入力が全て検証済みである
- [ ] 出力が宣言した shape と authority を満たす
- [ ] 責務境界に反する read/write/delegation が0件である
- [ ] 全node正規kind、lineage全field/evidence/readiness欠落0になる
- [ ] 登録 node id を progress.json の `registered_this_run` へ追記した
- [ ] `validate-source-digest.py --progress <progress.json>` を実行し exit 0 である (source_digest 流用0件)
- [ ] `validate-evidence-refs.py --progress <progress.json>` を実行し exit 0 である

### 5.4 実行方式

- 固定手順を持たない。未達 checklist を評価し、操作を都度立案・実行・検証する。各周回末に `original_goal`、`delta_from_original`、`merged_directive_for_next`、`drift_signal` を追記し、最大5周で未達なら上位 skill へ fail-closed で返す。

## Layer 6: オーケストレーション層

- ids/lineage/readinessをC04へ渡す。
- 前段 receipt/digest と後段 input digest を一致させ、stale handoff を拒否する。

## Layer 7: UserInput

- 不足情報が実行結果を変える場合だけ `AskUserQuestion` を使う。repo policy で決まる値、保存先、secret、node ID は質問しない。
- ユーザー提示は日本語、schema key/CLI parameter は原語を保つ。

## 出力指示

Layer 2 の入力・出力・責務境界・受入条件を正本としてこの単一責務だけを実行し、思考過程を出力せず、artifact/receipt、検証結果、未達 blocker だけを返す。
