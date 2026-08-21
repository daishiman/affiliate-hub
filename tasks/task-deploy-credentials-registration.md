---
graph_node_id: "task-deploy-credentials-registration"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "quality"
tags: ["cicd","security","handoff"]
priority: "high"
start_date: null
target_date: null
iteration: null
title: "公開の合言葉（Cloudflare の口座番号と鍵）を利用者本人が登録する"
owners: ["daishiman"]
created_at: "2026-08-17T23:30:00Z"
updated_at: "2026-08-17T23:30:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["cicd"]
purpose: null
goal: null
mvp_alignment: {"background":"deploy.yml と migrate.yml は CLOUDFLARE_ACCOUNT_ID と CLOUDFLARE_API_TOKEN を参照するが、まだ登録されていない","mvp_fit":"enabling","purpose":"main へマージしたら公開まで自動で進む状態にする","rationale":"秘密情報は AI が読めるファイルやコマンドラインに置かないため、登録は必ず利用者本人がブラウザで行う"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-deploy-credentials-registration.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-17T23:30:00Z","origin_kind":"manual","source_digest":null,"source_path":"tasks/task-verify-and-workflows.md","source_plugin":null,"source_version":null}
classification_confidence: 0.95
classification_reason: "機械では代行できない登録作業で、登録が済むまで自動公開と自動マイグレーションが動かない"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-deploy-credentials-registration.md","confidence":0.95}]
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

`main` へマージしたら**公開まで自動で進む**状態にする。
そのために必要な合言葉 2 つを、**利用者本人が**ブラウザで登録する。

## 背景

`.github/workflows/deploy.yml` と `migrate.yml` は、次の 2 つを参照している。

| 名前 | 中身 |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare の口座番号（秘密ではないが、鍵と対で要る） |
| `CLOUDFLARE_API_TOKEN` | 公開する権限を持つ鍵 |

**まだ登録されていない。** そのため、いまマージしても公開は走らず、
公開は手元からの実行に頼っている。手元からの実行は
「その場の作業ツリーをビルドする」ため、コミットしていない変更が
そのまま本番へ出る余地が残る。登録が済むと、この余地が構造的に消える。

**この作業を AI に代行させない。** 鍵をこちらへ渡すと、
渡した時点でファイルや実行履歴に残り、消したつもりでも残り続ける。

## 入力と前提条件

- Cloudflare の管理画面に入れること
- GitHub のこのリポジトリの設定を触れること

## 出力と成果物

- GitHub の Secrets に上の 2 つが登録されている
- `main` へのマージで `deploy.yml` が最後まで通る

## 依存関係

`ah-ita`（検査と自動処理の設置）の後。設置そのものは済んでいる。

## 実装対象

なし（設定作業）。触るファイルは無い。

## Write scope と競合制約

なし。

## GitHub publication

`local_only`。

## 実行手順

1. Cloudflare の管理画面 → My Profile → API Tokens → Create Token
2. テンプレート「Edit Cloudflare Workers」を選ぶ（**Global API Key は使わない**。
   あれは口座の全権で、公開だけに絞れない）
3. 口座番号は Workers & Pages の画面の右側に出ている
4. GitHub → このリポジトリ → Settings → Secrets and variables → Actions →
   New repository secret で、上の表の名前のまま 2 つ登録する
5. Actions の画面から `migrate.yml` を手で 1 回走らせて、通ることを見る

## 受入条件

- `deploy.yml` が `main` へのマージで最後まで通る
- 鍵がリポジトリの中のファイル・コミット・実行ログのどこにも出ていない

## 検証方法

`main` へ何か 1 つマージし、Actions の画面で公開まで緑になることを見る。
その後、本番 URL を**時間を空けて 2 回**開く
（配布後も古い処理が 1〜2 分残るため、1 回では反映を判定できない）。

## リスクとロールバック

鍵が漏れたときは、Cloudflare の画面から**その鍵だけを失効**させて作り直す。
口座ごと作り直す必要は無い。だから 2 で全権の鍵を使わない。

## Handoff

**登録が済むまでは、公開は手元からの実行に頼る。**
そのときは実行前に `git status --porcelain` が空であることを必ず見る
（作業ツリーがそのまま本番になるため）。

## 規範

- `docs/product/ci-cd-guide.md`
- `.github/workflows/deploy.yml` / `migrate.yml`
