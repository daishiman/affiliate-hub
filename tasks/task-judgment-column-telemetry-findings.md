---
graph_node_id: "task-judgment-column-telemetry-findings"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "quality"
tags: ["quality","testing","traceability"]
priority: "medium"
start_date: "2026-08-19"
target_date: null
iteration: null
title: "判定欄が指す検査が実在しない・別のものを見ている（計測 5 件の実測と、残り 22 件への引き継ぎ）"
owners: ["daishiman"]
created_at: "2026-08-19T05:20:00Z"
updated_at: "2026-08-21T05:20:00Z"
status: "draft"
depends_on: []
related_nodes: ["task-judgment-column-audit"]
resource_scope: ["docs","tests"]
purpose: null
goal: null
mvp_alignment: {"background":"計測 (TM) の判定欄を 29 通り壊して測ったところ 12 通りが緑のまま通り、欄の書きぶりと実態に相関が無いことが分かった","mvp_fit":"enabling","purpose":"残る群 (FD/TS/W/CI/TH/E/IM) の判定欄も同じやり方で全件当たる","rationale":"欄を根拠に怪しいものを選別できないので、選別せず全件当たるほかない"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-judgment-column-telemetry-findings.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-19T05:20:00Z","origin_kind":"manual","source_digest":null,"source_path":"docs/product/backlog.md","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "ah-9id (task-judgment-column-audit) の TM 群の実測結果と、残る群への引き継ぎを記録として立てた"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-judgment-column-telemetry-findings.md","confidence":0.9}]
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

**計測（TM）の判定欄で見つかった 5 件を記録し、残る 22 件へ同じやり方を引き継ぐ。**

手順の正本は `tasks/task-judgment-column-audit.md`（`ah-9id`）にある。
**こちらはその実測の記録と、残りの範囲**を持つ。手順をここに二重に書かない。

## 背景

2026-08-19、TM 群の判定欄の主張を **29 通り壊して測った。12 通りが緑のまま通った。**

このとき、`PASS` と検査名まで書いてある側も緑になり、
「対応」「注意書き」としか書いていない側も緑になった。
**欄の書きぶりと実態のあいだに相関が無い。**

これがこの課題の結論である。点検の手順は「怪しい欄を選んで確かめる」ではなく、
**「欄を根拠に選別できないので全件当たる」**になる。選別できるなら点検は要らない。

## 入力と前提条件

見つかった 5 件（いずれも 2026-08-19 に直してある）。

| 要件 | 欄に書いてあったこと | 実際 | 型 |
| --- | --- | --- | --- |
| `REQ-TM05` | `ui-layers.test.ts` の 2 つの検査名 | 片方は**存在しない名前**、指したファイルに `telemetry` の文字が 1 つも無く、一覧を壊しても緑 | `IM10` + `TM04` + `W03` の**三重** |
| `REQ-TM06` | 節の種類は `TELEMETRY_SECTION_KINDS` に限定 | この名前は `tests/` 全体で参照 0 件 | `W03` |
| `REQ-TM10` | `site-routes.test.ts`「表にある道には画面がある」 | 道と画面の対応は見ているが、説明の中身は誰も見ていない | `TM04` |
| `REQ-TM11` | `pnpm run build` で全ルート生成 | これは検査ではない。**しかし実際の検査は実在して機能していた** | **新しい型** |
| `REQ-TM02` 実装欄 | `ai_model_usage`（17項目） | 数えると **16** | 数の嘘 |

## 2026-08-21 の TM 群 全件点検（第 2 巡・`ah-2jm`）

**TM 群の判定欄を、選別せずに全件当たった。18 通り壊して 4 通りが緑。**

見た範囲（欄が 1 つも残っていないことを言うために書き出す）:
`REQ-TM01`〜`REQ-TM13` の 13 行すべてと、節の前書き 3 点、締めくくり「測らないと決めたもの」4 点。

緑だった 4 件（＝欄が実態より強いことを言っていた）:

| 場所 | 欄に書いてあったこと | 壊し方と結果 | 型 |
| --- | --- | --- | --- |
| `REQ-TM03` 状態欄 | 価格未登録の注意書きは `ai-usage-page.test.tsx` で見ている | 注意書きを作る箇所を丸ごと消しても緑。あの検査は `telemetryUseCases` ごと差し替え、注意書きを**手で渡している** | `TM04` |
| `REQ-TM07` 状態欄 | 未回答／許可／拒否の 3 状態すべてに表示あり | 断った人にだけ何も出さない実装にしても緑（取り消す手段まで消える） | `W03` |
| `REQ-TM07` 実装欄 | 2 つのボタンの目立ち方を揃える | 「記録してよい」だけを `tone="primary"` にしても緑 | `W03` / `FB03` |
| 前書き 2 | 計測点を画面に手で埋め込まない | 画面へ `data-tel-kind="cta_buton"` を直接書いても緑 | `W03` |

赤だった 14 件（要件が実際に固定されている側）: イベント一覧の増減、禁止語 17 語、保存期間 90 日、
黙っている人を同意扱いしない、DNT/GPC が本人の選択より強い、巡回・プレビューの抑止、
要素 12 種・節 9 種の一覧、記事の節の名乗り、`AffiliateLink` が必ず名乗ること、
説明を登録表から作ること、イベント名の綴り違い、1 回 50 件・本文 32KB の上限、
消せない目印を作らないこと（`readerKeyScope`）。

塞いだもの（**文章だけを直して閉じていない**）:

- `tests/application/ai-usage-report.test.ts`（新設 6 件）— `TM03`
- `tests/ui/consent-banner.test.tsx`（新設 12 件）— `TM07`
- `tests/ui/ui-layers.test.ts`「計測の印を画面や部品が手で書いていない」（追加 1 件）— 前書き 2
- `tests/ui/zz-probe-tone.test.tsx`（新設 2 件）— 上の「目立ち方が揃っている」が
  class の一致で見ているため、tone の違いが class に出なくなるとあれが何も見なくなる。その支え

引用の誤りとして直したもの: `REQ-TM02` の「要件が並べた 16 項目が…」（その名前のテストは無い）、
`REQ-TM09` の `isExpired`（実際は `isRetentionExpired`）。どちらも `IM10` 型。

**塞げずに残したもの**（欄にそう書いた）:

- `REQ-TM13`「別表を作らない」— `src/db/schema.ts` が別作業で編集中のため、壊して測っていない
- 締めくくり「他サイトでの行動を測らない」— 記録の中身では判断できず、拾う側の作りに依る

なお、この課題の「残る 22 件（FD 6 / TS 6 / W 3 / CI 2 / TH 2 / E 1 / IM 1 / TM 1）」は
TM 以外の群を含む。**今回当たったのは TM 群のみ**で、他の群は `ah-9id` の範囲として触っていない。

## 出力と成果物

1. 残る 22 件（FD 6 / TS 6 / W 3 / CI 2 / TH 2 / E 1 / IM 1 / TM 1）の判定欄を全件当たった記録
2. 見つかった嘘を実測へ置き換えた `docs/product/traceability.md`
3. 塞いだ検査（**文章を直すだけで閉じない**）

## 依存関係

`tasks/task-judgment-column-audit.md`（手順の正本）。

## 実装対象

`docs/product/traceability.md`、`tests/`。

## Write scope と競合制約

`docs/`、`tests/`。実装は、要件そのものが破れていた場合にのみ触る。

## 実行手順

`tasks/task-judgment-column-audit.md` の「実行手順」に従う。この課題で追加するのは 2 点だけ。

1. **群ごとに、壊した通り数と緑だった通り数を数えて残す**
   （TM 群は 29 通り中 12 通り。数が残っていないと、次の群で「今回は少なかった」が言えない）
2. **`TM11` 型を見つけたら、実装を触らない**。直すのは欄だけである

## 受入条件

- 残る群について、判定欄を**選別せずに全件**当たっている
- 緑だったものは塞いでから欄を直している（文章だけを直して閉じていない）
- 群ごとの「壊した通り数 / 緑だった通り数」が残っている

## 検証方法

塞いだことの確認は、**実装を壊して赤になるところまで**見る。
壊す前に scratchpad へ複製を取り、複製から書き戻す。
`git checkout --` / `git restore` / `git clean` / `rm` を後始末に使わない。

## リスクとロールバック

`TM11` 型を他の型と同じつもりで扱うと、**動いているものを壊す**。
壊して赤になったのに欄が検査を指していないときは、実装ではなく欄の問題である。

## リスク: 型を 1 つ当てて満足すること

`REQ-TM05` は 1 行の欄に 3 つの型が同時に起きていた。
1 つ目を当てた時点で「この欄は嘘だった」と片付くので手が止まりやすい。
**型を 1 つ当てても、その欄の残りを最後まで見る。**

## GitHub publication

`local_only`。

## Handoff

完了時に `docs/product/backlog.md` 項目 85 と項目 80 を更新する。

## 規範

`tasks/task-judgment-column-audit.md`、`docs/product/required-test-types.md` §4

## やらないこと

- 欄の書きぶりで点検する順番を決めること（相関が無いことが分かっている）
- 文章だけを直して閉じること
