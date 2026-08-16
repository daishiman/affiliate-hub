# Prompt: R2b-readiness

> C11の純粋validation report、C02保存済みimplementation_readiness/evaluation_status/source digest、validate-system-plan.pyのP01..P13 exact-set/13-node DAGを照合し、不一致またはincomplete/pending/fail/staleならmissing sectionsをsurfaceしてhandoffを保留する

## Layer 1: 基本定義層

- `responsibility_id`: `R2b-readiness`
- `skill`: `run-dev-graph-requirements`
- responsibility summary: C11の純粋validation reportとC02が保存したimplementation_readiness/evaluation_statusを照合し、不一致またはincomplete/pending/fail/staleならmissing sectionsをsurfaceしてhandoffを保留する
- 不変目的: C11の純粋validation report、C02保存済みimplementation_readiness/evaluation_status/source digest、validate-system-plan.pyのP01..P13 exact-set/13-node DAGを照合し、不一致またはincomplete/pending/fail/staleならmissing sectionsをsurfaceしてhandoffを保留する
- 成功条件は Layer 2 の受入条件と Layer 5 の二値 checklist の同時充足とする。

## Layer 2: ドメイン層

### 入力契約

- C11 report、C02保存readiness/evaluation、source digest。C11 report は `validate-graph-schema.py --graph <repo の .dev-graph/state/graph.json>` の実行出力へ係留し、graph.json 直読や ad-hoc script の出力を report として扱わない (2026-07-23 live-trial で validator 0回実行のまま照合が自己申告された fail-open の再発防止)。source digest の照合対象は、選択 feature node、同 feature の `architecture_refs`、同じ `feature_package_id` を持つ task 13 件の lineage closure 全件とする。これを `validate-source-digest.py --registered` へ重複除去・node ID 昇順で渡し、`confirmation_status`/`evaluation_status`/`implementation_readiness` の比較だけや task 13 件だけの検査で readiness を PASS にしない。

### 出力契約

- ready/blocked/stale verdictとnode/section別missing_sections。

### 責務境界

- statusを更新せず不一致を隠さずincomplete/pending/fail/staleをreadyにしない。

### 受入条件

- C11 reportとC02 saved stateが一致し、選択 feature・その `architecture_refs`・package task 13 件の closure 全件を `--registered` に渡した `validate-source-digest.py` が exit 0 (stale digest 0件) で、`validate-system-plan.py --repo-root "$DEV_GRAPH_ROOT" --feature-package "<選択 feature node の feature_package_id>"` の P01..P13 exact-set/13-node DAG が PASS した complete/pass/confirmed だけ ready になる。`--staging` や package 引数なし実行へ読み替えない。

## Layer 3: インフラ層

- 使用資産: validate-graph-schema、validate-source-digest、`validate-system-plan.py --feature-package <選択 feature node の feature_package_id>`。
- path は caller repository context または skill-relative reference から解決し、環境固有の絶対 path を成果物へ保存しない。

## Layer 4: 共通ポリシー層

- 入力契約、authority、containment、schema のいずれかが未達なら fail-closed とし、部分成功を PASS にしない。
- secret と認証情報を prompt 出力、graph、receipt に埋め込まない。
- 同一入力と同一 revision/digest では同じ decision と output shape を返す。

## Layer 5: エージェント層 (l5-contract v2.0.0)

### 5.1 担当 agent

- `run-dev-graph-requirements/R2b-readiness`。重い判断または独立検証は `Agent` で分離 context に fork する。

### 5.2 ゴール定義

- 目的: C11の純粋validation report、C02保存済みimplementation_readiness/evaluation_status/source digest、validate-system-plan.pyのP01..P13 exact-set/13-node DAGを照合し、不一致またはincomplete/pending/fail/staleならmissing sectionsをsurfaceしてhandoffを保留する
- 背景: この責務を隣接 responsibility から分離し、入力・出力・authority を一意にする。
- 達成ゴール: ready/blocked/stale verdictとnode/section別missing_sectionsが生成され、受入条件を満たした状態になっている。

### 5.3 完了チェックリスト (ゴール到達の停止条件)

- [ ] 宣言した入力が全て検証済みである
- [ ] 出力が宣言した shape と authority を満たす
- [ ] 責務境界に反する read/write/delegation が0件である
- [ ] `validate-graph-schema.py` を実行して C11 report を取得している (graph.json 直読や自作 script で代替しない)
- [ ] C11 reportとC02 saved stateが一致したcomplete/pass/confirmedだけreadyになる
- [ ] 選択 feature、同 feature の `architecture_refs`、同一 package の task 13 件を重複除去した lineage closure 全件を `--registered` に渡した `validate-source-digest.py` を実行し exit 0 である (task 13 件だけ、status 比較、目視で代替しない)
- [ ] `validate-system-plan.py --repo-root "$DEV_GRAPH_ROOT" --feature-package "<選択 feature node の feature_package_id>"` の P01..P13 exact-set/13-node DAG が PASS し、`--staging` や package 引数なし実行をしていない

### 5.4 実行方式

- 固定手順を持たない。未達 checklist を評価し、操作を都度立案・実行・検証する。各周回末に `original_goal`、`delta_from_original`、`merged_directive_for_next`、`drift_signal` を追記し、最大5周で未達なら上位 skill へ fail-closed で返す。

## Layer 6: オーケストレーション層

- PASSのみR3、FAILは不足一覧へ渡す。
- 前段 receipt/digest と後段 input digest を一致させ、stale handoff を拒否する。

## Layer 7: UserInput

- 不足情報が実行結果を変える場合だけ `AskUserQuestion` を使う。repo policy で決まる値、保存先、secret、node ID は質問しない。
- ユーザー提示は日本語、schema key/CLI parameter は原語を保つ。

## 出力指示

Layer 2 の入力・出力・責務境界・受入条件を正本としてこの単一責務だけを実行し、思考過程を出力せず、artifact/receipt、検証結果、未達 blocker だけを返す。
