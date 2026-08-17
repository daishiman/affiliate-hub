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
updated_at: "2026-08-17T23:30:00Z"
status: "draft"
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
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-17T23:30:00Z","origin_kind":"manual","source_digest":null,"source_path":"docs/product/ci-cd-guide.md","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "使用量監視は非公開化を前提条件とする後追い作業で、いまは実施条件が成立していない"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-actions-usage-monitor.md","confidence":0.9}]
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

リポジトリを**非公開にした後**、GitHub Actions の月間使用量が
**無料枠 2,000 分の 70% を超えたら警告が出る**状態にする。

## 背景

「月間使用量が 70% を超えたら警告」は 2026-08-17 に指示を受けたが、
**この時点では実装しないと判断した**。判断の中身を残す。

1. **見張る対象がまだ無い。** 標準ランナーは**公開リポジトリでは無料・無制限**で、
   いまこのリポジトリは公開である。使用量に上限が無いのだから、
   「上限の 70%」という数を作れない。ここで無理に入れると、
   **常に 0% を報告し続ける、落ちない見張り**になる。落ちない門は無い門と見分けが付かない。
2. **口座単位の使用量を取るには秘密情報が 1 つ増える。**
   `GET /users/{user}/settings/billing/actions` には個人アクセストークンが要る。
   このリポジトリの規則では、秘密情報を AI が読めるファイルやコマンドラインに置かない。
   登録は利用者本人が行う必要があり、**見張る対象が無い段階でその手間を払う理由が無い**。
3. **代わりに、無料で分かることは先に入れた。**
   `.github/workflows/nightly.yml` の「所要時間と月あたりの見積り」が毎回、
   実測の所要時間と「非公開なら月何分になるか」を出す。
   非公開かつ月 1,400 分（枠の 70%）を超える見込みになった時点で `::warning::` が出る。
   これは口座全体ではなく**いちばん重い深い門だけ**の数だが、当たりは付く。

つまり残っているのは「口座全体を見る」部分だけであり、**非公開にした日が着手日**になる。

## 入力と前提条件

- リポジトリが**非公開になっている**こと（これが着手条件。公開のうちは着手しない）
- 利用者本人が `read:user` 権限の個人アクセストークンを GitHub の画面で作り、
  リポジトリの Secrets に登録すること（**代行しない**）

## 出力と成果物

- 月間使用量を取得して枠に対する割合を出すワークフロー（週 1 回程度）
- 70% で `::warning::`、90% で `::error::`
- 割合の基準値は `quality-gates.config.mjs` に 1 箇所だけ置く

## 依存関係

無し。ただし**非公開化が実施条件**である。

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

1. 非公開になっていることを確認する（なっていなければ着手しない）
2. 利用者本人にトークンの作成と登録を依頼する
3. 使用量を取得するワークフローを足す
4. しきい値を **1 度わざと超える値に下げて**、警告が出ることを実測する
5. しきい値を戻す

## 受入条件

- 70% 超で警告が出ることを、しきい値を一時的に下げて**実際に見た**
- しきい値が `quality-gates.config.mjs` の 1 箇所にある
- トークンがコードにもコマンドラインにも書かれていない

## 検証方法

しきい値を現在の使用率より低い値に一時変更し、ワークフローを手動起動して
**警告が出ることを確認する**。出ないなら、それは見張りではない。

## リスクとロールバック

ワークフロー 1 本の追加。戻すときはファイルを消し、登録した秘密情報を利用者本人が削除する。
使用量の取得に失敗しても、ほかの検査は止めない（この見張り自体でマージを止めない）。

## Handoff

着手する人へ。**この課題を「公開のまま」やらないこと。**
公開のうちは分母が無限なので、何を作っても常に緑になる見張りができあがる。
着手の合図はリポジトリを非公開にした日である。

## 規範

- `.github/workflows/nightly.yml` の「予算の門」と「所要時間と月あたりの見積り」
- `docs/product/ci-cd-guide.md` §9（実測と月あたりの試算）
- `docs/spec/11-CI-CD・品質ゲート仕様.md` §8
