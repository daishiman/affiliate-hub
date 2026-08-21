---
graph_node_id: "task-publish-article-affiliate-links"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "affiliate"
tags: ["affiliate","publish","measurement"]
priority: "high"
start_date: null
target_date: null
iteration: null
title: "公開された記事に、成果リンクを載せる経路が無い"
owners: ["daishiman"]
created_at: "2026-08-18T03:00:00Z"
updated_at: "2026-08-18T03:00:00Z"
status: "draft"
depends_on: []
related_nodes: ["task-tracking-code-issuance","task-click-tracking-go-route"]
resource_scope: ["src","tests","docs","drizzle"]
purpose: null
goal: null
mvp_alignment: {"background":"公開の手続き buildArticle が ranking も productCards も作らず、版が持つ affiliateLinkIds が公開記事へ 1 件も渡らない","mvp_fit":"direct","purpose":"実運用の記事から成果リンクが出て、押されたクリックが突合できる状態にする","rationale":"アフィリエイトの収益そのものを測る経路で、ここが 0 件だと計測の下流が全部 0 になる"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-publish-article-affiliate-links.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-18T03:00:00Z","origin_kind":"manual","source_digest":null,"source_path":"src/application/usecases/site/publish-article.ts","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "公開の手続きと表現の型を実測で辿り、渡っていない箇所を特定した"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-publish-article-affiliate-links.md","confidence":0.9}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":"manual","status":"open"}
implementation_readiness: {"checked_at":null,"missing_sections":[],"status":"incomplete"}
---

# 目的

**公開された記事から成果リンクが出るようにする。** いまは 1 件も出ない。

## 背景

読み取り用の型には順位表（`ranking`）と商品カード（`productCards`）の欄があり、
画面もそれを描ける。ところが公開の手続き
（`src/application/usecases/site/publish-article.ts` の `buildArticle`）は
**どちらも作らない**。実際に持っているのは見本データだけである。

記事の版（`ContentVariant`）は `affiliateLinkIds` を持っていて、
表現のきまりの判定（`hasAffiliateCta`）はそれを見ている。
**それなのに、公開された記事へは 1 件も渡っていない。**

このため、直前の作業（`ah-dok` / 項目 57）で作った合言葉の発行の口には
**流れてくるものが無い**。実運用の読者は今も ASP の URL を直に踏み、
押されたことは 1 件も記録されない。

### なぜ気づきにくいか

**画面からは見えない。** 順位表が空でも、記事としては成立して見える。
唯一の手がかりは `/admin/analytics` の「成果リンクがまだ 1 件もありません」で、
これは項目 57 で見張りとして立てたものである。

### 項目 56 から分かれた理由

項目 56 には原因の違う欠落が 2 つ混ざっていた。症状がどちらも
「クリックが数えられない」だったためである。**数える経路（項目 57）を直しても、
数える対象が 0 件なら数字は動かない。** この項目は後者を塞ぐ。

## 入力と前提条件

- `affiliate_links` の表がまだ無い。成果リンクの ID から転送先 URL を引けない
- 版が持つ `affiliateLinkIds` は ID の列であり、URL も商品名も持たない

## 出力と成果物

- 公開の手続きが、版の `affiliateLinkIds` から順位表または商品カードを作る
- 作られたリンクが `/go/<合言葉>` として読者に出る
- `redirect_resolutions` に写しが増える

## 依存関係

`ah-dok`（合言葉の発行の口）。**あちらは済んでいて、こちらが手前**である。

## 実装対象

- `src/application/usecases/site/publish-article.ts`（`buildArticle`）
- 成果リンクの保存先（`affiliate_links` 相当。新規マイグレーション）
- `tests/application/publish-article*.test.ts`

## Write scope と競合制約

`src/application/usecases/site/`、`src/infrastructure/persistence/d1/`、
`drizzle/`、`tests/`、`docs/`。

## GitHub publication

`local_only`。

## 実行手順

1. 成果リンクの保存先を決める（ID → 転送先 URL・商品・提携先）
2. 公開の手続きが版の `affiliateLinkIds` から表現を組み立てる
3. **公開して写しが 1 件増えるところを、本物のランタイムで見る**

## 受入条件

- 公開の手続きが、成果リンクを持つ版から順位表または商品カードを作る
- 公開された記事の中のリンクが `/go/<合言葉>` になっている
- **`pnpm run preview` で記事を 1 本公開し、`redirect_resolutions` の行が
  1 件増えることを実際に見る**（`docs/product/runtime-verification.md` の
  「未確認」を 1 行埋める）
- `/admin/analytics` の未突合の件数が 0 になる
- 上記をテストで固定する
- REQ-E13 を「完了」にできる

## 検証方法

`pnpm run preview` で公開 → `sqlite3 .wrangler/state/v3/d1/…/*.sqlite
"SELECT count(*) FROM redirect_resolutions"` が増えることを見る。
**HTTP の番号ではなく行数を見る**（`runtime-verification.md` §7）。

## リスクとロールバック

成果リンクの保存先を新しく作るので、マイグレーションが増える。
既存の `redirect_resolutions` は触らない（あちらは転送に要る値の平らな写しで、
役割が違う）。

## Handoff

REQ-E13 の完了はこれが済んでから。

## 規範

- `docs/product/backlog.md` 項目 58
- `docs/product/click-measurement.md`（何が数えられていて何が数えられていないか）
- `docs/product/runtime-verification.md`（公開 → 写しが増えるの未確認行）
- `tasks/task-tracking-code-issuance.md`（`ah-dok`。合言葉を発行する口）
- `tasks/task-click-tracking-go-route.md`（転送の入口 `/go/`）
