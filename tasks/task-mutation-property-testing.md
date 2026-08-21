---
graph_node_id: "task-mutation-property-testing"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "quality"
tags: ["quality","testing"]
priority: "critical"
start_date: "2026-08-17"
target_date: null
iteration: null
title: "テストを騙せない仕組み（ミューテーション・プロパティベース）"
owners: ["daishiman"]
created_at: "2026-08-17T11:00:00Z"
updated_at: "2026-08-17T11:00:00Z"
status: "draft"
depends_on: ["task-test-tier-design"]
related_nodes: []
resource_scope: ["tests","scripts","quality-gates.config.mjs"]
purpose: null
goal: null
mvp_alignment: {"background":"約 91% の網羅率は構造的なものでしかなく、行が正しいか・仕様を覆えているかを 1 つも言っていない。アサーションが 0 でも 100% に届く","mvp_fit":"enabling","purpose":"実装をハードコードして通したテストが、機械で見つかるようにする","rationale":"ミューテーションは「テストを外から壊して落ちるか」を測るので、構造的カバレッジが答えられない問いに答えられる"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-mutation-property-testing.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-17T11:00:00Z","origin_kind":"manual","source_digest":null,"source_path":"docs/spec/10-テスト戦略仕様.md","source_plugin":null,"source_version":null}
classification_confidence: 0.95
classification_reason: "利用者からのテスト戦略の要求を作業単位として登録"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-mutation-property-testing.md","confidence":0.95}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":"manual","status":"in_progress"}
implementation_readiness: {"checked_at":null,"missing_sections":[],"status":"incomplete"}
---

# 目的

**テストを騙せない仕組み**を入れる。いまの約 91% は構造的な網羅率でしかなく、
その行が正しいか・仕様を覆えているかは 1 つも言っていない。
アサーションが 1 つも無くても 100% に届く。

## 背景

構造的カバレッジが答えられないことは 3 つある。

1. その行が**正しい**か（実行されたことしか分からない）
2. **仕様**を覆えているか（コードにしか目盛りが無い）
3. 実装がハードコードで通っていないか

これを外から確かめる手段が、L-1 ミューテーションと L-2 プロパティベースである。

## 入力と前提条件

- N（段の設計）が完了していること。ミューテーションは重いので 2 段・3 段へ置く
- `src/domain` と `src/application` はポートで外界から切れており、単体で回せる

## 出力と成果物

- L-1 ミューテーションテスト（Stryker）。**domain と application は必須**
  - ミューテーションスコアを品質ゲートへ入れ、閾値を `quality-gates.config.mjs` に置く
  - **閾値をゼロにしない**
  - どの層を覆っていて、どの層を覆っていないかを `docs/product/coverage.md` の隣に書く
- L-2 プロパティベーステスト
  - 順位づけが報酬額の変更で不変であること
  - 採点順序の安定性・単調性
  - テナント分離
  - 公開ゲート（開示が無ければ、どう組んでも公開できない）
  - Variant Spec の描画
  - 直列化と復元の往復
  - 正規化・重複排除の冪等性
  - 見つかった最小反例は**回帰テストとして残す**
- L-3 テストの作成を実装から切り離す。仕様から導き、テスト→要件 ID を辿れるようにする
- L-4 検出する（機械で）
  - アサーションの無いテスト
  - 常に真になるアサーション、`expect(true).toBe(true)`
  - 無条件のスナップショット更新
  - `.skip` / `.only` / コメントアウトされたテスト
  - カバレッジ除外プラグマの濫用（除外には書かれた理由を要る）

## 依存関係

N（`task-test-tier-design`）の完了後に着手する。

## 実装対象

- `stryker.config.mjs`（新規）
- `tests/property/`（新規）
- `scripts/test-honesty.mjs`（新規。L-4 の検出）
- `quality-gates.config.mjs`
- `docs/spec/10-テスト戦略仕様.md`

## Write scope と競合制約

`tests/` / `scripts/` / `quality-gates.config.mjs` / リポジトリ直下の設定ファイル。

## GitHub publication

`local_only`。

## 実行手順

1. ミューテーションを domain の 1 モジュールで走らせ、**実測スコアを出す**
2. 低ければ低いまま記録する（それが分かること自体が目的）
3. 生き残った変異を見て、テストを足す（**閾値を下げない**）
4. application へ広げる
5. プロパティベースを不変条件から順に足す
6. L-4 の検出を作り、既存テストに当てる

## 受入条件

- ミューテーションスコアが**実測値**として記録されている（低くても正直に出す）
- domain と application が対象に入っている
- 覆っていない層が明記されている
- 反例が回帰テストとして残っている
- L-4 の検出が既存テストに当たり、違反ゼロまたは理由つきで記録されている

## 検証方法

わざと `>` を `>=` に変えた変異が**生き残らない**ことを確かめる。
生き残るなら、その分岐のテストが無い。

## リスクとロールバック

ミューテーションは重い。2 段・3 段に置き、1 段（push ごと）には入れない。

## Handoff

完了後に M（テスト種別の網羅）へ進む。
