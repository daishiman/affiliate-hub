---
name: run-dev-graph-schedule
description: feature ready と task ready を分離したいとき、依存・tracker parity・resource scope・active lease を満たす conflict-free batch を算出したいときに使う。
version: 0.1.0
owner: harness maintainers
source: plugin-plans/dev-graph/component-inventory.json#C15
kind: run
prefix: run
hierarchy: L1
user-invocable: true
argument-hint: "[--repo-root PATH] [--scope ID] [--max-parallel N]"
allowed-tools: [Read, Bash, AskUserQuestion, Task, Skill, Agent]
script_refs: [../../scripts/resolve-repo-context.py, ../../scripts/schedule-graph.py, ../../scripts/manage-worktree-lease.py, ../../scripts/bd-bridge.py, ../../scripts/build-parity-manifest.py]
schema_refs: [../../schemas/graph-node.schema.json]
responsibility_refs:
  - prompts/R1-elicit.md
  - prompts/R2-plan.md
  - prompts/R3-schedule.md
responsibilities:
  - id: R1-elicit
    name: elicit
    prompt_required: true
    summary: "算出対象範囲 (グラフ全体/サブツリー) と並列バッチの上限件数方針をヒアリングして確定する"
  - id: R2-plan
    name: plan
    prompt_required: true
    summary: "schedule-graph.py 呼び出しと結果整形の計画を組み立てる"
  - id: R3-schedule
    name: schedule
    prompt_required: true
    summary: "binding=beadsはC28のbd ready --jsonかつstatus/depends_on edge parity=confirmedの候補だけ、github/noneはstatus=activeかつconfirmed/pass/readiness completeだけをschedule-graph.pyへ渡し、resource_scope非重複batchへ整形する"
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
      text: "schedule-graph.py のready-setがblocked/draft/unconfirmed/evaluation非pass/readiness非completeを0件で含み、Beads receiptのgraph_status/graph_depends_on exact-setが現在graphと一致する"
      verify_by: script
    - id: OUT1
      loop_scope: outer
      text: "推薦タスクが全依存 (depends_on) 充足済み (ready) であることを受入テストが確認する"
      verify_by: live-trial
    - id: OUT2
      loop_scope: outer
      text: "提示した並列バッチ内で resource_scope (touches) が重複するノードペアが 0 件 (conflict-free) であることを受入テストが確認する"
      verify_by: test
    - id: OUT3
      loop_scope: outer
      text: "ready taskごとに一意なsuggested_branchとC09 worktree claim commandが返り、同一graph_node_idの二重claimはC27が0件に抑える"
      verify_by: test
---

# run-dev-graph-schedule

## Purpose & Output Contract

- 入力: C24/C11 検証済み subgraph、binding parity、C27 lease snapshot、max parallel。
- 出力: strict ready sets、resource-safe parallel batches、conflict pairs、`devgraph/<graph_node_id>` branch/claim command。
- 完了条件: 全推薦が confirmed/pass/readiness complete、全 dependency done、lease/resource conflict 0 を同時に満たす。

1. 対象 subgraph と max parallel を確定する。
2. beads binding は C28 の `ready` と status/depends_on exact-set parity=confirmed の積集合だけを採用する。github/none は local graph から算出する。
3. confirmed/pass/readiness complete、全依存 done、active lease なしだけを候補にする。
4. feature ready は system-dev-planner 起動候補、task ready は実行候補として別 batch にする。両者を同じ batch に混ぜない。
5. `schedule-graph.py` の resource_scope conflict と C27 lease snapshot を重ね、同じ resource を触る組を分離する。C17 独立 verifier が不一致を出したら推薦しない。

出力は ready sets、parallel batches、conflict pairs、各 task の `devgraph/<graph_node_id>` branch と `dev-graph worktree claim <id>` command。read-only で graph/tracker/lease を変更せず、実行receiptだけを`eval-log/run-dev-graph-schedule-execution.json`へ保存する。

平常経路は **parity manifest 生成 → ready-json 生成 (C28) → schedule 算出 (C16)** の順で実行する。3 ステップとも毎回作り直す揮発成果物で、committed 済みの古い receipt を再利用しない。`parity_provenance`を持たない古い receipt (例: eval-log 配下の 2026-07-18 実行分) をそのまま渡すと`schedule-graph.py`が即`ContractError`で止まる。

parity manifest は`build-parity-manifest.py`が canonical graph から作る唯一の生成経路である。tracker (Beads) を読まず graph だけを投影するので、C28 の突合が「自分で作った答えを自分で採点する」形にならない。manifest が欠落したまま C28 を回すと、graph 管理下の node が全て`parity_manifest_missing`へ落ちて ready-set が空になる。

```bash
python3 ../../scripts/build-parity-manifest.py --repo-root "$DEV_GRAPH_ROOT" \
  --out "$DEV_GRAPH_ROOT/eval-log/dev-graph/run-dev-graph-schedule/parity-manifest.json"
```

次に`bd-bridge.py --op ready`が`bd ready --json`候補を由来必須の`--parity-manifest`(`generated_at`/`source_graph_digest`、契約 §10) と突合し、`parity_provenance`つき receipt を stdout へ出すので、これを`--ready-json`のパスへ書き出す (`github`/`none` binding は ready-json 不要)。

```bash
python3 ../../scripts/bd-bridge.py --op ready --repo-root "$DEV_GRAPH_ROOT" \
  --parity-manifest "$DEV_GRAPH_ROOT/eval-log/dev-graph/run-dev-graph-schedule/parity-manifest.json" \
  > "$DEV_GRAPH_ROOT/eval-log/run-dev-graph-schedule-beads-ready.json"
```

```bash
python3 ../../scripts/schedule-graph.py \
  --repo-root "$DEV_GRAPH_ROOT" \
  --graph "$DEV_GRAPH_ROOT/.dev-graph/state/graph.json" \
  --ready-json "$DEV_GRAPH_ROOT/eval-log/run-dev-graph-schedule-beads-ready.json" \
  --leases "<git-common-dir>/dev-graph/leases.json" \
  --eval-log "$DEV_GRAPH_ROOT/eval-log/run-dev-graph-schedule-execution.json"
```

`--leases`を明示したのにsnapshotが存在しない場合は空扱いせず停止する。binding混在時は、`beads`だけを`--ready-json`の`edge_parity.confirmed=true`との積集合にし、`github/none`はlocal gateから計算する。`--ready-json`のC28 receiptは`parity_provenance`(`generated_at`/`source_graph_digest`)を必須とし、`source_graph_digest`が現graphのcanonical digestと一致しない場合はstale snapshotとして停止する (execution-tracker-contract §10)。回復手順は`build-parity-manifest.py`によるparity manifestの再生成であり、digestの書き換えではない。`run-dev-graph-sync` (C03) の`--apply --parity-manifest <path>`も同じgeneratorを呼び、収束直後のgraphでmanifestを更新する。C28の`unmapped`/`conflicts`は判定に使わず`source: "bd-bridge"`付きでreportへ引き継ぐ。`--scope`は指定nodeのsubtree、`--max-parallel`は1 batchの上限として適用する。期限切れleaseはactive扱いせず、graph/tracker/leaseの実行前後digestが1つでも変われば結果を破棄する。`--eval-log`はrepositoryの`eval-log/`配下だけを許可する。

## ゴールシーク実行

### ゴール (Goal)

グラフの依存関係・完了状態・active worktree leaseから次に着手すべきready-setと、リソーススコープ/lease重複のない複数worktree向け並列バッチを算出・提示した状態になっている

### 目的・背景 (Why)

依存関係を都度人手で追跡せずに次の一手を判断できるようにする。binding=beadsはC28でstatusとdepends_on edge exact-set parityがconfirmedの場合だけbd ready候補を採用し、parity pending/conflictは推薦しない。その候補へdev-graph固有のresource_scope/lease重複回避を重ねる。github/noneはC16で自前算出し、mode=bothはbinding別結果を合成する。二層ready-set: feature ready (機能間depends_on充足) はper-feature planning起動候補、task ready (feature内depends_on充足+resource_scope非競合) は実行候補として区別し、feature単位の並列batchとtask単位の並列batchを混在させない (MM-10)

### 完了チェックリスト

- [ ] candidate は confirmed/pass/readiness complete、全 depends_on done、active lease なしを満たす
- [ ] feature ready と task ready が別々の ready-set/batch に出力される
- [ ] 同一 parallel batch の resource_scope.touches 重複 pair が0件である
- [ ] 各 task の suggested_branch が `devgraph/<graph_node_id>` で claim command が public CLI 形式である
- [ ] 実行前後の graph/tracker/lease digest が同一である
- [ ] lease pathがgit common-dirの正本と一致し、Beads receiptのstatus/depends_on exact-setが現在graphに一致する
- [ ] C17独立verifierがready/batch/lease authorityを再計算してPASSしている

### ゴールシークループ

frontmatter の `goal_seek.engine: inline` / `fork: subagent` / `max_loops: 5` を実行契約とする。固定手順は使わず、未達 checklist と担当 `prompts/*.md` からその周回の操作を都度生成する。各周回で inner criterion を検証し、完了後は outer criterion の live trial/content review を最大 `feedback_contract.max_iterations=3` 周で評価する。

### ゴールシーク配線

- 開始時に C24 `resolve-repo-context.py --mode read` の JSON receipt を得て、`repo_root` が `content_roots.repository` の realpath と一致する場合だけ `DEV_GRAPH_ROOT=<receipt.repo_root>` に固定する。cwd から再解決しない。
- 元のゴールを `$DEV_GRAPH_ROOT/eval-log/run-dev-graph-schedule-goal-spec.json` へ、各 checklist の status/evidence を `$DEV_GRAPH_ROOT/eval-log/run-dev-graph-schedule-progress.json` へ記録する。
- 未達 responsibility を担当する `prompts/<R-id>.md` を読み、`Agent` で分離 context に fork する。ユーザー判断が必要な境界だけ `AskUserQuestion` を使う。
- 各周回末に `$DEV_GRAPH_ROOT/eval-log/run-dev-graph-schedule-intermediate.jsonl` へ `original_goal`、`original_goal_hash`、`current_goal_snapshot`、`delta_from_original`、`merged_directive_for_next`、`drift_signal` を append-only で記録する。次周回は直前の `merged_directive_for_next` を必須入力にする。
- 5周到達時に未達が残れば完了扱いせず、progress と blocker を親へ handoff する。全 checklist と `feedback_contract.criteria` が PASS のときだけ完了する。

### ゴールシーク検証

各周回後に次の検査を実行し、中間成果物の欠落・goal drift・hash 不一致を fail-closed にする。

```bash
python3 - "$DEV_GRAPH_ROOT/eval-log/run-dev-graph-schedule-goal-spec.json" "$DEV_GRAPH_ROOT/eval-log/run-dev-graph-schedule-intermediate.jsonl" <<'PY'
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

- `criteria:IN1`: `schedule-graph.py` の ready-set に blocked/draft/unconfirmed/evaluation非pass/readiness非complete または現在graphとstatus/depends_on exact-setが違うBeads候補が0件であることをscript testで検証する。
- `criteria:OUT1`: 推薦 task は全 `depends_on` がdoneで、未充足依存を持つ候補が ready-set に0件であることを受入テストで検証する。
- `criteria:OUT2`: 同一parallel batch内の `resource_scope.touches` 重複ペアが0件で、git common-dir正本のactive leaseと衝突する候補を推薦せず、C17独立verifierが再計算PASSすることを受入テストで検証する。
- `criteria:OUT3`: ready taskごとに一意な `suggested_branch=devgraph/<graph_node_id>` と `dev-graph worktree claim <id>` commandを返し、C27が同一graph_node_idの二重claimを0件に抑止することを受入テストで検証する。実行receiptは`eval-log/`だけへ書く。

## Gotchas

- `blocked/draft/unconfirmed/evaluation!=pass/readiness!=complete` のどれかを ready に混入させない。
- parity manifest を手書きしない。`build-parity-manifest.py` が唯一の生成経路で、`source_graph_digest` だけを現在値へ書き換える修正は stale 検出を恒久的に無効化する。
- `unmapped_summary.parity_manifest_missing` が候補数と同数なら、判定の前に manifest 生成が失敗/未実行である。ready-set の空を「着手可能なし」と読み替えない。
- 直接依存だけでなく全 `depends_on` の done を確認する。
- 同一 batch の `resource_scope.touches` と active lease の両方を衝突判定に使う。
- feature planning 候補と task 実行候補を同一 batch に混ぜない。
