---
name: run-dev-graph-requirements
description: 確定 system spec と feature package から実装要件を導出したいとき、readiness 完了時だけ capability-build/task-graph build へ handoff したいときに使う。
version: 0.1.0
owner: harness maintainers
source: plugin-plans/dev-graph/component-inventory.json#C04
kind: run
prefix: run
hierarchy: L1
user-invocable: true
argument-hint: "[--repo-root PATH] [--feature-id ID] [--handoff-target PATH]"
allowed-tools: [Read, Write, Bash, Skill, AskUserQuestion, Agent]
script_refs: [../../scripts/resolve-repo-context.py, ../../scripts/validate-graph-schema.py, ../../scripts/validate-source-digest.py, ../../scripts/gh-bridge.py]
schema_refs: [../../schemas/graph-node.schema.json, ../../schemas/package-registration-receipt.schema.json]
reference_refs: [../../templates/template-contract.json, ../../../system-dev-planner/references/feature-execution-package-contract.md]
responsibility_refs:
  - prompts/R1-elicit.md
  - prompts/R2-plan.md
  - prompts/R2b-readiness.md
  - prompts/R3-handoff.md
responsibilities:
  - id: R1-elicit
    name: elicit
    prompt_required: true
    summary: "要件定義導出対象のグラフノード範囲と capability-build handoff 先をヒアリングして確定する"
  - id: R2-plan
    name: plan
    prompt_required: true
    summary: "5 artifact kindを横断し、C19が取り込んだsystem-spec-harness成果物とexternal plugin system-dev-planner (run-system-dev-plan) 由来のsystem task planを引用する要件抽出計画を組み立てる"
  - id: R2b-readiness
    name: readiness
    prompt_required: true
    summary: "C11の純粋validation reportとC02が保存したimplementation_readiness/evaluation_statusを照合し、不一致またはincomplete/pending/fail/staleならmissing sectionsをsurfaceしてhandoffを保留する"
  - id: R3-handoff
    name: handoff
    prompt_required: true
    summary: "C11のreadiness検証とsystem-dev-planner所有のsystem-plan検証 (validate-system-plan.py) の完了時だけ要件定義書をcapability-build/task-graph buildへhandoffする。不足時はmissing_sectionsを返して停止し、実装コードは生成しない"
combinators:
  - with-goal-seek
  - with-feedback-contract
goal_seek:
  engine: inline
  fork: subagent
  max_loops: 5
completeness_exempt:
  - "manifest: goal_seek.engine=inline が未達 checklist から実行局面を都度選ぶため、固定 phase の workflow-manifest.json は適用外。停止条件と配線は本文 ## ゴールシーク実行を正本とする。"
feedback_contract:
  max_iterations: 3
  criteria:
    - id: IN1
      loop_scope: inner
      text: "C11のreadiness validation digestとC02保存済みimplementation_readiness/evaluation_statusが一致し、選択feature・そのarchitecture_refs・package task 13件のlineage closure全件を--registeredに渡したvalidate-source-digest.pyがexit 0 (stale digest 0件) で、system-dev-plannerのvalidate-system-plan.pyを--feature-package <選択featureのfeature_package_id>で実行してP01..P13 exact 13・共通parent_feature/feature_package_id・機能内前方dependencyを検証し必須キー欠落が0件"
      verify_by: script
    - id: OUT1
      loop_scope: outer
      text: "導出した要件定義書が capability-build/task-graph build へ handoff され、本 skill 自身が実装コードを生成しないことを受入テストが確認する"
      verify_by: live-trial
    - id: OUT2
      loop_scope: outer
      text: "implementation_readiness=incompleteの参照ノードが混在するとき、missing_sectionsが漏れなくレポートへsurfaceされ、当該ノードのhandoffが保留されることを受入テストが確認する (要件C20)"
      verify_by: test
---

# run-dev-graph-requirements

## Purpose & Output Contract

- 入力: C24/C11 検証済み subgraph、C02 保存済み readiness/evaluation/source digest、system-dev-planner package。
- 出力: requirements document、readiness matrix、snapshot digest に固定した capability-build/task-graph handoff。
- 完了条件: C11/C02/`validate-source-digest.py`/`validate-system-plan.py` の四 gate が同一 digest で PASS し、missing section が0、本 skill による実装 code 生成が0である。

実装コードは生成しない。graph の5 artifact kind、C19 が取り込んだ system-spec lineage、external system-dev-planner の feature execution package を引用して requirements handoff を作る。

1. 対象 feature/subgraph と handoff target を確定する。
2. C11 の純粋 validation report と node の `implementation_readiness/evaluation_status/confirmation_status` を照合する。C11 report は `validate-graph-schema.py` の実行出力だけを正本とする (graph.json の直読や自作比較 script で代替しない)。scope は、選択 feature node、同 node の `architecture_refs` が指す node、同じ `feature_package_id` を持つ package task 13 件の lineage closure とする。この集合を重複除去・node ID 昇順で `--registered` に全件渡して `validate-source-digest.py` を実行し、**exit 0 を handoff の必須条件にする**。task 13 件だけの検査は closure 不足として拒否する。

```bash
# C11 report の取得 (これを実行せずに「C11 と照合した」と扱わない)
python3 "$DEV_GRAPH_PLUGIN/scripts/validate-graph-schema.py" \
  --graph "$DEV_GRAPH_ROOT/.dev-graph/state/graph.json" --repo-root "$DEV_GRAPH_ROOT"
python3 "$DEV_GRAPH_PLUGIN/scripts/validate-source-digest.py" \
  --repo-root "$DEV_GRAPH_ROOT" \
  --registered "<選択 feature + architecture_refs + package task 13 件の node id を昇順・カンマ区切りで全件>"
# exit 2 = stale/missing digest あり → handoff 0件で停止 (missing_sections へ surface)
```
3. system-dev-planner の version/entry point と `validate-system-plan.py` を preflight し、promotion 済み package の consumer として次の世代非依存 command を実行する。`--staging` や引数なし実行へ読み替えない。P01..P13 exact set・13-node DAG・package receipt は外部 validator で検証し、13 task の生成ロジックは複製しない。

```bash
python3 "$SYSTEM_DEV_PLANNER/scripts/validate-system-plan.py" \
  --repo-root "$DEV_GRAPH_ROOT" \
  --feature-package "<選択 feature node の feature_package_id>"
```
4. incomplete/pending/fail/stale、不足 section、lineage/confirmation 不整合が1件でもあれば `missing_sections` と remediation owner を返して handoff 0件で停止する。
5. 全 gate PASS 時だけ requirements document、graph snapshot digest、package reference、capability-build handoff reference を atomic emit する。gate 検証の PASS だけで完了扱いにしない — 要件定義書と handoff package の**成果物ファイルを emit するまでが本 skill の完了条件**であり、emit 0 件での完了申告は契約違反として扱う。

出力は readiness matrix と handoff package。`run-system-dev-plan` の出力を消費するが dev-graph 自身は task spec を作らない。

## ゴールシーク実行

### ゴール (Goal)

system-spec-harness確定成果物とsystem development task planを含むグラフ情報から実装要件を導出し、implementation-readiness完了時だけcapability-build/task-graph buildへ実装をhandoffした状態になっている

### 目的・背景 (Why)

実装コード生成は既存 capability-build/task-graph build へ責務分離するため、本ハーネスはグラフ情報から要件定義を導出するところまでを担う。要件定義が参照する各成果物がテンプレート必須セクションを充足していない (implementation-readiness不足) まま handoff すると後段 build が要件不足のまま着手してしまうため、本 skill が readiness を機械判定し不足セクションを事前に surface する (要件C20)。system development task planはexternal plugin system-dev-plannerのrun-system-dev-planをSkill呼出しで引用する (external_contract_ref: plugin-plans/system-dev-planner/handoff-run-plugin-dev-plan.json)。implementation_readiness/validator (validate-system-plan.py) も同pluginが所有する

### 完了チェックリスト

- [ ] scope 内 node の feature/package/system-spec lineage closure が欠落0である
- [ ] C11 report と C02 保存済み readiness/evaluation が一致する (report は `validate-graph-schema.py` の実行出力。graph.json 直読や自作照合で代替しない)
- [ ] 選択 feature、同 feature の `architecture_refs`、同一 package の task 13 件を重複除去した lineage closure 全件を `--registered` に渡した `validate-source-digest.py` が exit 0 である (task 13 件だけ、自作比較、目視で代替しない)
- [ ] `validate-system-plan.py --repo-root "$DEV_GRAPH_ROOT" --feature-package "<選択 feature node の feature_package_id>"` が PASS し、`--staging` や引数なし実行を使っていない
- [ ] incomplete/pending/fail/stale node の missing_sections と remediation owner が全件表示される
- [ ] 全 gate PASS の場合だけ requirements と capability-build handoff が同一 snapshot digest で生成される (成果物ファイルの実在が条件。progress.json 内の記載やgate PASS の事実だけでは未達)
- [ ] 本 skill が生成した実装 code file が0件である

### ゴールシークループ

frontmatter の `goal_seek.engine: inline` / `fork: subagent` / `max_loops: 5` を実行契約とする。固定手順は使わず、未達 checklist と担当 `prompts/*.md` からその周回の操作を都度生成する。各周回で inner criterion を検証し、完了後は outer criterion の live trial/content review を最大 `feedback_contract.max_iterations=3` 周で評価する。

### ゴールシーク配線

- 開始時に C24 `resolve-repo-context.py --mode read` の JSON receipt を得て、`repo_root` が `content_roots.repository` の realpath と一致する場合だけ `DEV_GRAPH_ROOT=<receipt.repo_root>` に固定する。cwd から再解決しない。
- 元のゴールを `$DEV_GRAPH_ROOT/eval-log/run-dev-graph-requirements-goal-spec.json` へ、各 checklist の status/evidence を `$DEV_GRAPH_ROOT/eval-log/run-dev-graph-requirements-progress.json` へ記録する。
- 未達 responsibility を担当する `prompts/<R-id>.md` を読み、`Agent` で分離 context に fork する。ユーザー判断が必要な境界だけ `AskUserQuestion` を使う。
- 各周回末に `$DEV_GRAPH_ROOT/eval-log/run-dev-graph-requirements-intermediate.jsonl` へ `original_goal`、`original_goal_hash`、`current_goal_snapshot`、`delta_from_original`、`merged_directive_for_next`、`drift_signal` を append-only で記録する。次周回は直前の `merged_directive_for_next` を必須入力にする。
- 5周到達時に未達が残れば完了扱いせず、progress と blocker を親へ handoff する。全 checklist と `feedback_contract.criteria` が PASS のときだけ完了する。

### ゴールシーク検証

各周回後に次の検査を実行し、中間成果物の欠落・goal drift・hash 不一致を fail-closed にする。

```bash
python3 - "$DEV_GRAPH_ROOT/eval-log/run-dev-graph-requirements-goal-spec.json" "$DEV_GRAPH_ROOT/eval-log/run-dev-graph-requirements-intermediate.jsonl" <<'PY'
import hashlib, json, sys
goal = json.load(open(sys.argv[1], encoding='utf-8'))
rows = [json.loads(line) for line in open(sys.argv[2], encoding='utf-8') if line.strip()]
required_keys = {'original_goal','original_goal_hash','current_goal_snapshot','delta_from_original','merged_directive_for_next','drift_signal'}
expected = hashlib.sha256(goal['original_goal'].encode('utf-8')).hexdigest()
assert rows, 'intermediate.jsonl is empty'
for row in rows:
    assert required_keys <= row.keys(), required_keys - row.keys()
    assert row['original_goal'] == goal['original_goal']
    assert row['original_goal_hash'] == expected
PY
```

## Criteria acceptance

- `criteria:IN1`: C11のreadiness validation digestとC02保存済み`implementation_readiness`/`evaluation_status`が一致し、選択feature・同featureの`architecture_refs`・同一packageのtask 13件からなるlineage closure全件を`--registered`に渡した`validate-source-digest.py`がexit 0 (stale digest 0件) になり、system-dev-plannerの`validate-system-plan.py --feature-package <選択featureのfeature_package_id>`がP01..P13 exact 13・共通`parent_feature/feature_package_id`・機能内前方dependencyを検証して必須キー欠落が0件になる。`gh-bridge.py` 由来のissue contextは補助入力に留め、この四gateの代替にしない。
- `criteria:OUT1`: requirementsを`capability-build/task-graph`へhandoffし、本skill自身は実装コードを生成しない。
- `criteria:OUT2`: `implementation_readiness=incomplete`では全`missing_sections`をsurfaceし、該当handoffを保留する。

## Gotchas

- node 内の readiness 値だけを信頼せず、C11 report、C02 saved state、source digest を同時に照合する。
- source digest の照合は `validate-source-digest.py` の exit code へ係留する。`confirmation_status`/`evaluation_status`/`implementation_readiness` の比較だけで readiness を PASS にすると、stale digest を素通りさせる fail-open になる (2026-07-21 live-trial r13 で実際に registered_mismatch 4件のまま handoff が emit された)。
- digest scope は package task だけではない。選択 feature と、その `architecture_refs` を含む lineage closure を同時に検査し、handoff が引用する上流仕様の stale を拒否する。
- `validate-system-plan.py` の exact-13 検証を独自ロジックで代替しない。
- promotion 後の requirements consumer は `--feature-package <選択 feature の package id>` を使う。生成中だけ存在する `--staging`、または package 引数なしの実行をしない。
- incomplete/pending/fail/stale を一部 handoff で回避せず、対応する `missing_sections` を全件返す。
- 実装は capability-build/task-graph に引き渡し、本 skill 内で code を生成しない。
