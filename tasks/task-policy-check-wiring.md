---
graph_node_id: "task-policy-check-wiring"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "compliance"
tags: ["compliance","content"]
priority: "high"
start_date: null
target_date: null
iteration: null
title: "表現ポリシーの検査を、記事の確認画面から実際に呼ぶ"
owners: ["daishiman"]
created_at: "2026-08-17T23:30:00Z"
updated_at: "2026-08-17T23:30:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["domain","application","presentation"]
purpose: null
goal: null
mvp_alignment: {"background":"policy-rule-seed.ts に初期ルール 13 件が入り検査 75 件で固定したが、application 側に呼び出しが 1 つも無い","mvp_fit":"direct","purpose":"記事の確認画面で、薬機法・景表法・ASP 規約の違反が実際に出るようにする","rationale":"ルールがあっても呼ばれなければ違反は永久に 0 件で、検査があるように見えて無い"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-policy-check-wiring.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-17T23:30:00Z","origin_kind":"manual","source_digest":null,"source_path":"src/domain/compliance/policy-rule-seed.ts","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "ルールの一覧と当て方は揃っているが、呼び出し口と分野の欄が無く、記事から到達できない"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-policy-check-wiring.md","confidence":0.9}]
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

表現ポリシー（薬機法・景表法・金融・ASP 規約）の違反が、
**記事の確認画面に実際に出る**ようにする。

## 背景

`src/domain/compliance/policy-rule-seed.ts` に初期ルール 13 件が入り、
1 件ごとに「当たらねばならない文」と「当たってはならない文」を持たせて
検査 75 件で固定した（両方向の赤を実測済み）。

**しかし、application 層から `checkPolicies()` を呼んでいる場所が 1 つも無い。**
`PolicyRuleRepositoryPort` は宣言だけで実装が無い。
このままだと違反は永久に 0 件で、**検査があるように見えて無い**状態になる。

足りないものが 2 つある。

1. ルールの保存先（`PolicyRuleRepositoryPort` の実装と、新しい作業場所への配布）
2. **記事がどの分野のものかを表す欄**。いまの `ContentPackage` には無い。
   分野が分からないと `general` のルールしか当てられず、
   薬機法・金融のルールは登録されているのに一度も効かない

2 は `ah-d9s`（データモデル基盤）の範囲と重なる。

## 入力と前提条件

- `ah-099` で入れた初期ルールと検査
- 分野の欄を `ContentPackage` に足せること

## 出力と成果物

- 記事の確認画面に違反の一覧（根拠と代わりの書き方つき）が出る
- `block` の違反があるあいだは承認へ進めない
- 分野の欄が保存先にある

## 依存関係

`ah-d9s` の分野の欄。

## 実装対象

- `src/domain/authoring/content-package.ts`（分野の欄）
- `src/application/usecases/content/manage-content.ts`（呼び出し）
- `src/infrastructure/persistence/`（ルールの保存先）
- `src/presentation/ui/patterns/`（違反の表示）

## Write scope と競合制約

`src/domain/authoring/` と `src/application/usecases/content/` と `src/infrastructure/persistence/`。

## GitHub publication

`local_only`。

## 実行手順

1. `ContentPackage` に分野の欄を足す（既定は `general`）
2. ルールの保存先を作り、作業場所を作ったときに初期ルールを配る
3. `manage-content` の品質検査と同じところで `checkPolicies()` を呼ぶ
4. `block` の違反があるとき、承認へ進めない理由を 1 行出す

## 受入条件

- 薬機法の分野に設定した記事で「治ります」と書くと、確認画面に違反が出る
- 同じ文でも家電の記事では出ない
- `block` の違反があるあいだ承認へ進めない
- 呼び出しを外すと落ちる検査がある

## 検証方法

`pnpm run preview` で記事の確認画面を開き、違反が出ることと、
承認へ進めない理由が 1 行出ることを実際に見る。

## リスクとロールバック

広げすぎたルールが正しい記述まで止めると、運用でポリシーごと切られる。
そのため `block` は法令で言い切れるものだけに限り、
迷うものは `warn`（人が確認すれば通せる）に置いてある。この線引きを動かさない。

## Handoff

**「ルールを登録したから対応済み」と書かないこと。**
呼ばれていないルールは、無いルールと結果が 1 文字も違わない。

## 規範

- `docs/product/traceability.md` REQ-SEC07
- `src/domain/compliance/policy-rule-seed.ts` の冒頭
