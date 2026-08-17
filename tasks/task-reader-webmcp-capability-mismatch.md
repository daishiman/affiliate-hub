---
graph_node_id: "task-reader-webmcp-capability-mismatch"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "security"
tags: ["security","webmcp","reader"]
priority: "high"
start_date: null
target_date: null
iteration: null
title: "読者ページの AI 向けの道具が、読者の権限では動かない"
owners: ["daishiman"]
created_at: "2026-08-18T00:10:00Z"
updated_at: "2026-08-18T02:00:00Z"
status: "done"
depends_on: []
related_nodes: []
resource_scope: ["presentation","application","tests"]
purpose: null
goal: null
mvp_alignment: {"background":"読者ページの画面は read-site.ts（権限不要）を通るのに、同じページに載せた WebMCP の道具は read-product.ts（product.read が要る）を呼んでいる","mvp_fit":"direct","purpose":"読者ページの AI 向けの案内を、読者の権限で実際に動く形にする","rationale":"これまでは同一サイトの呼び出しが見本の管理権限へ落ちていたため通っていた。ah-2ro でその落ち込みを止めた結果、道具の側が動かなくなった"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-reader-webmcp-capability-mismatch.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-18T00:10:00Z","origin_kind":"manual","source_digest":null,"source_path":"src/presentation/tools/webmcp-policy.ts","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "ah-2ro で同一サイトの身元を読者へ直した結果、読者ページの WebMCP が admin 側のユースケースを呼んでいたことが表に出た"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-reader-webmcp-capability-mismatch.md","confidence":0.9}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":"2026-08-18T02:00:00Z","evidence_refs":["src/application/usecases/site/read-article-facets.ts","src/presentation/tools/reader-tools.ts","tests/presentation/reader-tools.test.ts","tests/ui/disclosure-text.test.ts"],"policy":"manual","reconciled_at":null,"source":"manual","status":"done"}
implementation_readiness: {"checked_at":null,"missing_sections":[],"status":"incomplete"}
---

# 目的

読者ページに載せている AI 向けの道具（WebMCP）を、
**読者の権限で実際に動く形**にする。

## 背景

`ah-2ro` で、同一サイトからの呼び出しの身元を
「ログインしていなければ読者」へ直した。その結果、
**読者ページに載せている道具が全部断られる**ことが表に出た。

原因は身元ではなく、**道具が向いている先**である。

| 同じ読者ページの中で | 呼んでいる先 | 要る権限 |
| --- | --- | --- |
| 画面の表示 | `src/application/usecases/site/read-site.ts` | **要らない**（公開の道） |
| AI 向けの道具 | `src/application/usecases/product/read-product.ts` | `product.read`（管理側の道） |

`PAGE_TOOLS`（`src/presentation/tools/webmcp-policy.ts`）が読者ページへ載せている
`list_ranking` `get_product` `compare_products` `get_evidence` `explain_ranking`
`filter_products` `find_alternatives` `list_test_runs` は、すべて後者である。

これまでこの食い違いが見えなかったのは、同一サイトの呼び出しが
**見本の身元（管理権限つき）へ落ちていた**ため、たまたま通っていたからである。
つまりこの道具たちは、はじめから読者の権限では一度も動いていない。

WebMCP の決まりの 4 つ目「**すべて通常の画面操作でも同じことができる**」
（`webmcp-policy.ts` 冒頭）とも食い違っている。

## 入力と前提条件

- `ah-2ro` が済んでいること（同一サイトの身元が読者になっていること）
- `read-site.ts` に権限の要らない読み取りがすでにあること

## 出力と成果物

次のどちらかに揃える。**決めるのは公開範囲の判断なので、着手前に決める。**

- **A: 読者でも読める道へ載せ替える**
  読者ページの道具を `read-site.ts` 側（または同等の公開用ユースケース）へ向ける。
  読者ページの AI 案内は残る。無い読み取りは足すことになる
- **B: AI 向けの案内をログイン後だけにする**
  読者ページからは WebMCP を出さない。実装は小さいが、
  **読者向け AI 案内という製品の柱を降ろす**判断になる

`docs/spec` の AI ファーストの位置づけからは A が本筋だが、
足す読み取りの量が読めないため、決めは持ち帰りとする。

## 依存関係

`ah-2ro`（済）。

## 実装対象

- `src/presentation/tools/webmcp-policy.ts`（載せる道具の一覧）
- `src/presentation/tools/product-tools.ts`（向き先）
- `src/application/usecases/site/read-site.ts`（足りない公開の読み取り）

## Write scope と競合制約

`src/presentation/tools/` と `src/application/usecases/site/`。

## GitHub publication

`local_only`。

## 実行手順

1. A か B を決める（決めるまで着手しない）
2. A なら、読者ページが画面に出している項目だけを公開の読み取りとして揃える。
   **画面に出していない項目を道具から出さない**（そこが新しい漏れ口になる）
3. 読者の身元で 1 つずつ実際に呼んで、通ることを確かめる
4. `tests/presentation/api-routes.test.ts` の
   「読者ページに載せている道具は、読者の権限では断られる」を
   **通る側の検査へ書き換える**（いまは断られることを固定してある）

## 受入条件

- 読者の身元で、読者ページに載っている道具がすべて実行できる（A の場合）
- 読者ページに出していないデータが、道具からは 1 件も出ない
- 管理用の読み取りは、読者の身元では引き続き断られる（`ah-2ro` の状態を崩さない）

## 検証方法

`pnpm run preview` で読者ページを開き、AI 向けの道具を 1 つ実際に呼んで
結果が返ることを見る。そのうえで、同じ呼び出しで管理用の道具を叩き、
**断られること**も同じ画面から確かめる。

## リスクとロールバック

A で公開の読み取りを足すとき、**画面に出していない項目まで返してしまう**のが
いちばん危ない。道具の戻り値は、画面が出している項目の範囲を超えない。
戻すときは `PAGE_TOOLS` を空にすれば、AI 案内だけが消えて画面は動く。

## Handoff

**「読者ページの AI が動かない」を不具合として直さないこと。**
動いていたのは、ログインしていない人が管理権限で動いていたからである。
直す先は身元ではなく、道具の向き先である。

## 規範

- `src/presentation/tools/webmcp-policy.ts` の冒頭（WebMCP の 4 つの決まり）
- `src/infrastructure/platform/api-token.ts` の冒頭（同一サイトの範囲）
- `tasks/task-same-origin-actor-scope.md`（`ah-2ro`）

## 結果（2026-08-18）

**A を採った。** ただし `read-site.ts` に公開の読み取りを足すのではなく、
読者が実際に見ている**記事から切り出す**形にした
（`src/application/usecases/site/read-article-facets.ts`、道具は `reader_*` 8 種）。

理由は上の「リスク」に書いた一点で、商品台帳へ公開の読み取りを新設すると
「画面に出す範囲」と「道具が返す範囲」を人が二重に管理することになる。
記事から切ると、**画面に出していない項目が道具から出ることが原理的に起きない**。

着手前には見えていなかったことが 3 つある。

1. `get_disclosure` も同じ壊れ方をしていた（この課題は 8 種と書いたが、実際は 9 種）
2. `list_test_runs` は**読者向けの出どころが無い**。検証の記録を出す読者ページが
   まだ無いので、実装が無いわけでもない。`unreachableReason` という欄を足して
   区別できるようにし、理由を書いたものはページから降りていることを検査で固定した（残 8 種）
3. 受け入れ条件 §30.7「広告表示が…AI回答で一貫する」の検査が、
   **一度も AI 回答での一貫性を見ていなかった**（動かない別名どうしを比べていた）。
   読者向けの道具が記事の画面と同じ文を返す形に直した

赤は 3 方向で実測した: 道具を管理側へ向け直す / 入力の形が違う道具へ向ける /
記事に順位があるのに空＋理由を返す。**空だけを見て通すと「全部断られている」
状態でも緑になる**ため、中身が返ることまで見ている。

`pnpm run preview` での実測は行っていない（見本データでの実行と、
読者の身元での 1 件ずつの呼び出しは自動検査で固定した）。
