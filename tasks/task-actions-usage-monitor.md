---
graph_node_id: "task-actions-usage-monitor"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "quality"
tags: ["quality","cicd","cost"]
priority: "medium"
start_date: null
target_date: null
iteration: null
title: "非公開にしたら、GitHub Actions の月間使用量を口座単位で見張る"
owners: ["daishiman"]
created_at: "2026-08-17T23:30:00Z"
updated_at: "2026-08-24T12:00:00Z"
status: "done"
depends_on: []
related_nodes: []
resource_scope: ["docs","cicd"]
purpose: null
goal: null
mvp_alignment: {"background":"公開リポジトリのあいだは標準ランナーが無料・無制限のため、見張る対象そのものが存在しない","mvp_fit":"enabling","purpose":"非公開へ切り替えた後、月 2,000 分の枠を 70% 超えたら警告が出る状態にする","rationale":"枠を使い切ると検査も公開も止まる。止まってから気づくと、その場で「検査を減らす」判断に流れる"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-actions-usage-monitor.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-17T23:30:00Z","origin_kind":"manual","source_digest":null,"source_path":"docs/product/ci-cd-guide.md","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "公開中は安全に skip し、非公開化と token 登録後に同じ workflow が口座単位の使用量監視へ切り替わる実装タスク"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-actions-usage-monitor.md","confidence":0.9}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-xp8","github_mirror":null,"linked_at":"2026-08-24T12:00:00Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":"2026-08-24T12:00:00Z","evidence_refs":["beads:ah-xp8",".github/workflows/actions-usage.yml","scripts/actions-usage.mjs","tests/architecture/actions-usage.test.ts","docs/product/ci-cd-guide.md"],"policy":"manual","reconciled_at":"2026-08-24T12:00:00Z","source":"manual","status":"done"}
implementation_readiness: {"checked_at":"2026-08-24T12:00:00Z","missing_sections":[],"status":"complete"}
---

# 目的

リポジトリが非公開になったとき、GitHub Actions の月間使用量を口座単位で取得し、
設定した 70% / 90% のしきい値で警告できるようにする。公開中は誤った割合を作らず安全に skip する。

## 背景

このリポジトリは 2026-08-24 時点で公開のため、標準 runner の「無料枠に対する割合」は監視対象にならない。
そこで workflow 自体は先に入れ、公開中または token 未登録なら notice / warning を出して成功終了する形にした。
非公開化後は同じ workflow が GitHub Billing API を読み、コード変更なしで監視を開始する。

## 入力と前提条件

- 公開中: token 不要。監視は安全に skip する
- 非公開化後: 利用者本人が GitHub Billing API を読める fine-grained token を Secret `ACTIONS_USAGE_TOKEN` に登録する
- User は `/users/{owner}/settings/billing/usage`、Organization は `/organizations/{owner}/settings/billing/usage` を使う

## 出力と成果物

- 週次と手動起動の `.github/workflows/actions-usage.yml`
- Actions の `unitType=minutes` だけを集計する `scripts/actions-usage.mjs`
- 70% で `::warning::`、90% で `::error::` annotation（他の検査は止めない）
- 割合の基準値は `quality-gates.config.mjs` に 1 箇所だけ置く

## 依存関係

GitHub enhanced billing platform と token 権限。利用できない口座では warning に縮退し、CI を止めない。

## 実装対象

- `.github/workflows/`（使用量を見るワークフロー 1 本）
- `quality-gates.config.mjs`（警告と失敗のしきい値）
- `docs/product/ci-cd-guide.md`（運用の記述）

## Write scope と競合制約

`.github/workflows/` と `quality-gates.config.mjs` と `docs/`。
`nightly.yml` の「所要時間と月あたりの見積り」と役割が重なるので、
**どちらが口座全体でどちらが 1 ジョブかを、両方のコメントに書き分ける**。

## GitHub publication

`local_only`。

## 実行手順

1. `actions-usage.yml` が repository visibility と owner type を GitHub API から得る
2. 公開中なら skip、非公開で token が無ければ warning
3. token があれば Billing API の `usageItems` から Actions minutes を合計する
4. `ACTIONS_USAGE_MINUTES` を使うテスト用 override で 70% / 90% 境界を再現する

## 受入条件

- override により 70% / 90% の境界と annotation を自動テストで確認する
- しきい値が `quality-gates.config.mjs` の 1 箇所にある
- トークンがコードにもコマンドラインにも書かれていない
- GitHub 公式の現行 API version `2026-03-10` と `usageItems` 契約に一致する

## 検証方法

`pnpm vitest run tests/architecture/actions-usage.test.ts` と全体品質ゲートを実行する。
非公開口座での実 token 確認は外部運用時に実施し、コードの完了条件とは分ける。

## リスクとロールバック

ワークフロー 1 本の追加。戻すときはファイルを消し、登録した秘密情報を利用者本人が削除する。
使用量の取得に失敗しても、ほかの検査は止めない（この見張り自体でマージを止めない）。

## Handoff

非公開化したら Secret を登録して手動起動し、summary に口座の分数が出ることを確認する。
token や API エラーはログへ値を出さず、警告として次回へ持ち越す。

## 規範

- `.github/workflows/nightly.yml` の「予算の門」と「所要時間と月あたりの見積り」
- `docs/product/ci-cd-guide.md` §9（実測と月あたりの試算）
- `docs/spec/11-CI-CD・品質ゲート仕様.md` §8
