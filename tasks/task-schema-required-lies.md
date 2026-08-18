---
graph_node_id: "task-schema-required-lies"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "quality"
tags: ["quality","tools","ai"]
priority: "medium"
start_date: "2026-08-18"
target_date: null
iteration: null
title: "必須でないと宣言した項目が実際には必須なので、スキーマどおりに呼ぶ AI は必ず失敗し、同じ呼び方を繰り返す"
owners: ["daishiman"]
created_at: "2026-08-18T22:40:00Z"
updated_at: "2026-08-18T22:40:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["src","tests","docs"]
purpose: null
goal: null
mvp_alignment: {"background":"道具一覧の JSON Schema が required に入れていない項目を、ユースケースが必須として断る道具が 3 件ある","mvp_fit":"enabling","purpose":"AI が読む宣言と、実際に通る入力を一致させる","rationale":"AI は宣言を信じる以外にないので、宣言が嘘だと同じ呼び方を繰り返す以外の手がかりが無い"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-schema-required-lies.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-18T22:40:00Z","origin_kind":"manual","source_digest":null,"source_path":"tests/presentation/tool-inputs.ts","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "2026-08-18 に見本の入力を総当たりして見つかった、宣言と実際の必須項目のずれ"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-schema-required-lies.md","confidence":0.9}]
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

**道具一覧が宣言する「必須の項目」と、実際に通る入力を一致させる。**

## 背景

**AI は宣言を信じる以外にない。** 道具の使い方を知る手段は道具一覧の
JSON Schema だけで、それ以外に手がかりが無い。だから `required` に
入っていない項目は「無くても通る」と読む。

いまその読み方が外れる道具が 3 件ある。**スキーマどおりに作った入力が断られる**ので、
AI から見ると「正しく呼んだのに失敗した」だけになり、
**同じ呼び方をやり直す以外の手が無い**。人なら断り文を読んで直せるが、
AI は断り文から入力の形を作り直せない。

**これは残課題 76 の `readOnly` と同じ族**である。1 つの宣言が、
読む側の期待と実際の判断でずれている。

## 入力と前提条件

2026-08-18 の実測（`tests/presentation/tool-inputs.ts` の見本を持ち主の身元で
111 個の道具に総当たりし、断りの理由を数えた）。

| 道具 | `required` の宣言 | 実際に断られる理由 | ずれの原因 |
|---|---|---|---|
| `manage_integration_keys` | 空 | 「`action` を確認してください」 | `z.discriminatedUnion` は選択肢の共通の必須項目を JSON Schema の `required` へ写せない |
| `update_feedback_status` | `['id']` | 「変更する内容が指定されていません」 | 「`status` / `note` / `disposition` のどれか 1 つ以上」は `required` では表せない |
| `draft_content_variant` / `generate_content_variants` | `['provided']` | 「どのモデルで書くかが選ばれていません」 | `model` が `optional()` だが、無ければ必ず断る |

**3 件目だけは意図してそうしてある。** `src/presentation/tools/generation-input-schema.ts`
に理由が書いてある——入口で既定のモデルを入れると、
「選んだつもりが無いのに記録にモデル名が残る」ため。

**意図の有無は AI から見えない。** 振る舞いとしては 3 件とも同じである。
だから 3 件目を「これは正しい設計だから対象外」として外さない。
外すなら、**AI がその意図を読める形で宣言に書く**のが条件である。

## 出力と成果物

3 件について、**スキーマだけを読んで作った入力が通る**か、
**通らない理由がスキーマから読める**かのどちらかにする。

候補（決め打ちではない）:

- `required` に写せない条件を、**description の先頭に決まった形で書く**
  （例: 「必須: action」「status / note / disposition のいずれか 1 つ以上」）。
  description は AI が必ず読むので、いちばん安く届く
- 断り文に「**次にどう呼べばよいか**」を含める。ただしこれは補助で、
  これだけでは足りない（AI は自然文から入力の形を組み直せるとは限らない）
- 表せない形（`discriminatedUnion`・「どれか 1 つ以上」）を**入口では使わない**。
  道具を分ける（`list_integration_keys` / `issue_integration_key` /
  `revoke_integration_key`）と、`required` が素直に書ける

## 依存関係

無し。残課題 76・77 とは同じ族だが、独立に着手できる。

## 実装対象

- `src/presentation/tools/feedback-tools.ts`（`manage_integration_keys` / `update_feedback_status`）
- `src/presentation/tools/generation-input-schema.ts`（`draft_content_variant` の `model`）
- `src/presentation/tools/define-tool.ts`（`toJsonSchema` の写し方を変える場合）
- `tests/presentation/tool-inputs.ts`（見本の入力。直せば通るようになる）

## Write scope と競合制約

`src/presentation/tools/` と `tests/presentation/`。
道具の名前や形を変えると `docs/product/traceability.md` と
仕様の対応表に波及する。**残課題 78（生成物の保証）と同時に進めない**
——どちらも生成される文書を動かす。

## GitHub publication

`local_only`。

## 実行手順

1. 3 件それぞれについて、**スキーマの `required` だけを見て入力を組み立て**、
   断られることを実測する（穴の再現）
2. 直し方を決める（候補は「出力と成果物」に 3 つ）
3. 適用する
4. 手順 1 をもう一度やり、**今度は通る**ことを実測する
5. 同じずれが他の道具に無いかを、111 個の総当たりで確かめる

## 受入条件

- 3 件とも、スキーマだけから作った入力が通ること。
  通らないものが残るなら、**その理由がスキーマ（description を含む）から読めること**
- 「意図してそうしてある」を理由に対象から外した道具が無いこと。
  外すなら、意図が宣言に書かれていること
- 手順 5 で、同じずれが他に無いことを実測で示すこと

## 検証方法

**印を外して赤を実測する。** `tests/presentation/tool-inputs.ts` の見本から
その道具の項目を落とし、`required` の宣言どおりの入力にして呼び、
断られることを見る。直したあとは通ることを見る。

宣言を直したことをもって「AI が呼べるようになった」と書かない。
**宣言と実際が一致したことを、実際に呼んで確かめる。**

## リスクとロールバック

道具を分ける案を採ると、**道具の名前が変わる**。名前は仕様の対応表・
WebMCP の載せ先（`webmcp-policy.ts` の `PAGE_TOOLS`）・画面から参照されている。
1 件ずつ変え、`pnpm run verify` を都度通す。戻すときは名前を戻す。

## リスク: 断り文を優しくして終わりにすること（この課題で最も起きやすい失敗）

- **断り文を親切にしても、AI は入力の形を作り直せない。** 直っているのは
  人が読んだときの分かりやすさだけで、**同じ呼び方を繰り返す**という
  振る舞いは変わらない。
- **「意図してそうしてある」を免責にしない。** 意図の有無は AI から見えない。
  3 件目を外して 2 件に減らすのは 1 行でできるが、**件数が減ったことは
  守りが増えた理由にならない。**
- スキーマを緩めて（`required` を増やさずに）通るようにするのも違う。
  それは宣言を実際に合わせるのではなく、**実際の判断を消している**。

## Handoff

直した件数ではなく、**スキーマだけから呼べるようになった件数**を伝える。
手順 5（他に無いことの確認）を通したかどうかを書く。

## 規範

- `docs/product/backlog.md` 項目 79（この課題の要約）
- 残課題 76（`readOnly` の 3 つの意味。同じ族）
- 残課題 77（見本の入力。この課題と原因が近いが別物）
- `src/presentation/tools/generation-input-schema.ts`（3 件目の意図が書いてある場所）

## やらないこと

- 見本の入力（`tool-inputs.ts`）だけを直して閉じること。
  それは検査を通すだけで、**AI から見た宣言は嘘のまま**である
- テナント分離の下限を上げること。これは残課題 77 の話で、
  この課題を終えても下限は動かない（土台の壁が別にある）
