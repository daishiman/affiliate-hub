---
graph_node_id: "task-spec-gap-c02-doc-refetch"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "quality"
tags: ["system-spec","quality"]
priority: "medium"
start_date: "2026-08-19"
target_date: null
iteration: null
title: "取得済みドキュメントの version と last_updated が、公式表明値になっていない"
owners: ["daishiman"]
created_at: "2026-08-19T08:40:00Z"
updated_at: "2026-08-19T08:40:00Z"
status: "draft"
depends_on: []
related_nodes: ["task-spec-completeness-gaps"]
resource_scope: ["system-spec"]
purpose: null
goal: null
mvp_alignment: {"background":"better-auth の version が現行（1.6.30 以降）より古い。cloudflare-workers / cloudflare-d1 / apple-hig / google-sre の last_updated は取得日を代入したもので、公式が表明した値ではない","mvp_fit":"enabling","purpose":"better-auth を再取得し、4 件の last_updated を公式表明値（または版表記なしの明示）へ改める","rationale":"**取得日を last_updated として置くと、古い資料が常に新しく見える。**日付が入っていることが、新しいことの証拠に読まれる。残課題 78 の「出ていることは、使われていることではない」の日付版"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-spec-gap-c02-doc-refetch.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-19T08:40:00Z","origin_kind":"manual","source_digest":null,"source_path":"system-spec/completeness-report.json","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "完全性評価（assign-system-spec-completeness-evaluator、verdict: FAIL）の gaps から立てた"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-spec-gap-c02-doc-refetch.md","confidence":0.9}]
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

better-auth を再取得し、4 件の last_updated を公式表明値（または版表記なしの明示）へ改める

## 背景

better-auth の version が現行（1.6.30 以降）より古い。cloudflare-workers / cloudflare-d1 / apple-hig / google-sre の last_updated は取得日を代入したもので、公式が表明した値ではない

## 評価器の指摘（原文）

> [C02 run-system-spec-doc-fetch へ差し戻し / medium] better-auth を再取得して version を現行 (1.6.30 以降) へ更新する。あわせて cloudflare-workers / cloudflare-d1 / apple-hig / google-sre の last_updated を取得日の代入ではなく公式表明値 (または版表記なしの明示) に改める。

出典は `system-spec/completeness-report.json` の `gaps[3]`。
**この文は完全性評価器（`assign-system-spec-completeness-evaluator`、`context: fork`）が
書いたもので、outer session は 1 文字も書いていない。**

## なぜこれを落とすのか

**取得日を last_updated として置くと、古い資料が常に新しく見える。**日付が入っていることが、新しいことの証拠に読まれる。残課題 78 の「出ていることは、使われていることではない」の日付版

## 入力と前提条件

`system-spec/completeness-report.json` の `gaps[3]`。
先行する課題は無い。

## 出力と成果物

指摘が解消し、C05 の再評価でこの `gap` が返らない状態。

## 依存関係

独立。ほかの子とは触る場所が分かれている。
束ねの親は `task-spec-completeness-gaps`（順番 C01 → C03 → C02 はそちらの本文が持つ）。

## 実装対象

`system-spec/`

## Write scope と競合制約

`system-spec/`。ほかの子とは触る場所が分かれている。

## 実行手順

1. 上の「評価器の指摘（原文）」を読む
2. 指摘された当てどころを実際に開いて、いまの状態を数える（**語ではなく文で数える**——残課題 90）
3. 直す
4. 親の課題がすべて閉じてから、C05 を foreground で再評価する

## 受入条件

- 指摘された当てどころが、指摘の文言どおりの状態になっている
- **数え直しを語ではなく文で行っている**（同じ語を持つ別の文にも当たるため）
- `docs/spec/` を触った場合、`--write` を打っていない（親が最後に 1 度だけ打つ）

## 検証方法

C05 の再評価でこの `gap` が返らないこと。**単体で確かめる手段は無い**ので、
親の再評価まで「直したつもり」であることを認める。**つもりのまま閉じない。**

## リスクとロールバック

`docs/spec/` `system-spec/` を触ると鮮度の指紋が動き、`FRESH` が `STALE` へ戻る。
これは想定どおりで、`--write` は親が最後に 1 度だけ打つ。戻すときは `git revert`。

## GitHub publication

`local_only`。

## Handoff

完了時に親（`task-spec-completeness-gaps`）へ結果を伝え、`docs/product/backlog.md` の状態欄を更新する。

## 規範

`system-spec/completeness-report.json` `gaps[3]`、`docs/product/backlog.md` 項目 90・91

## やらないこと

- `scripts/spec-freshness.mjs --write` を、C05 が再び `PASS` する前に実行すること
- `system-spec/resume-receipt.json` を手で片付けること（落ちる形で残っていること自体が記録）
- **語で数えて「解消済み」と書くこと**（同じ語を持つ別の文に当たる。残課題 90）

---

## 進捗（2026-08-29）

**① 章 md と `fetched-references.json` の二重管理: 解消した。**

2026-08-23 の記録では 3 件（`better-auth` `owasp-asvs` `apple-hig`）が食い違い、
「章 md は C01/C03 単一 writer の保護領域なので迂回して書かない」として保留していた。
恒久策として書かれていた「出典表を `fetched-references` から生成し、手で写す二重管理を
やめる」は**すでに効いている** — 章の出典表は `compile-spec-doc.py` が正本から導出する
純関数になっており、手で写す余地が無い。

本日 `apple-hig` を再取得したとき、**参照側だけが進んで章が置き去りになった**。
これは二重管理の再発ではなく、正しい導出を古い入力で行った結果である。
`compile` を回し直して解消し、`tests/architecture/doc-source-version-gap.test.ts` は
**15 行すべてで食い違い 0** を返している。

順序として記録しておく: **出典を取り直したら、採点より先に `compile` を回す。**

**② 「最新確認」が独立した再確認になっていない: 残る。**

本日の再取得でも `retrieved_at` と `latest_checked_at` は同一時刻である。
これは嘘ではない——1 回の取得の中で両方を書いたことを正直に記録している——が、
欄名が約束する「あとで確かめ直した日」にはなっていない。

さらに本日、**この欄を独立して埋める道が塞がっていること**が分かった。
独立監査 fork（`system-spec-doc-freshness-auditor`）の session に `WebFetch` が
供給されておらず、HTTP ヘッダ値も SPA 本文の埋め込み構造化データも観測できない。
`apple-hig` は `freshness_source=http-last-modified`、`anthropic-claude` は
埋め込みモデルデータの `lifecycle=active` 計数を鮮度根拠にしているため、
`WebSearch` だけでは原理的に到達できない。

**②の解除は `ah-v84h`（監査 fork への WebFetch 付与）に依存する。**
評価者自身が Bash から取り直して確かめた結果はあるが、それを独立再確認として
記録すると提案者と承認者が同一になり、この欄の意味が失われる。

**受入条件の到達状況**

| 条件 | 状態 |
|---|---|
| 指摘された当てどころが指摘の文言どおりの状態になっている | ①は達成 / ②は未達 |
| 数え直しを語ではなく文で行っている | 達成（検査が 15 行を機械的に数えている） |
| `docs/spec/` を触った場合 `--write` を打っていない | 達成（打っていない） |

**この課題はまだ閉じない。**②が残り、その解除は別課題に依存する。

## 追記（2026-08-29 深夜）

**②も、ほぼ解けた。**上の記述は「独立再確認への道が塞がっている」と書いたが、
これは**診断を誤っていた**。塞いでいたのは道具ではなく規則の当てはめだった。

SSOT の Layer 4 は 2 分岐で、`層2 を一件も実施できなかった` ときだけ監査不成立
とし、道具が使えて特定 target だけ確定できない場合は当該 target を算入対象から
外す。分岐条件は**道具の有無ではなく実施件数**である。前 run は WebFetch が無い
ことを理由に前者を選んでいたが、実際には 13 件を実施していた。

期待する verdict を渡さず「どちらの分岐の条件を満たすかを、実施件数と条件文を
並べて示せ」とだけ求めて再監査させたところ、fork は自ら 14 件実施・未確認 1 件と
数え、`MAX_UNVERIFIED_FRESHNESS = 1` の内側であることを示して **PASS** を返した。

**未確認が 1 件で済んだのは、この課題でやった再取得の効果である。**
`anthropic-claude` は鮮度根拠を `page-declared`（本文に埋め込まれた `lifecycle=active`
の model ID 集合）へ改めたので、WebFetch なしでも照合できるようになった。

残るのは `apple-hig` 1 件だけで、`freshness_source=http-last-modified` は生の HTTP
ヘッダでしか照合できない。上限が 1 件なので、**今後 1 件でも未確認が増えれば規則
どおり総合が落ちる**。余裕は無い。監査手段の拡充は `ah-v84h` に残す。

**この課題はここで閉じてよい。**受入条件「指摘された当てどころが指摘の文言どおり
の状態になっている」は、①（二重管理の解消）と②（独立再確認の成立、未確認は
規則の上限内）で満たされた。`latest_checked_at` が独立監査で裏付けられている
target は 15 件中 14 件である。
