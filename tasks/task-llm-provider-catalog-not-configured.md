---
graph_node_id: "task-llm-provider-catalog-not-configured"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "platform"
tags: ["llm","settings","cost"]
priority: "high"
start_date: null
target_date: null
iteration: null
title: "モデルの目録(LLM_PROVIDER_CATALOG)が未設定で、鍵を入れてもモデルが並ばない"
owners: ["daishiman"]
created_at: "2026-08-18T07:10:00Z"
updated_at: "2026-08-18T07:10:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["src","docs"]
purpose: null
goal: null
mvp_alignment: {"background":"生成画面へモデルを選ぶ欄を入れたが、手元の preview では 5 提供元すべてが『選べるモデルがありません』になる。目録(LLM_PROVIDER_CATALOG)が空だからである","mvp_fit":"enabling","purpose":"単価つきのモデル目録を設定し、選べるモデルが実際に並ぶ状態にする","rationale":"単価は目録からしか引けない(infrastructure/llm/pricing.ts)。目録が空だと、鍵を登録してもモデルは 1 つも並ばず下書きは作れない。つまり鍵より目録が先である"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-llm-provider-catalog-not-configured.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-18T07:10:00Z","origin_kind":"manual","source_digest":null,"source_path":"src/infrastructure/llm/llm-provider-catalog.ts","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "設定が空のため、実装済みの経路が手元で動かない"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-llm-provider-catalog-not-configured.md","confidence":0.9}]
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

**単価つきのモデル目録（`LLM_PROVIDER_CATALOG`）を設定し、
生成画面に選べるモデルが実際に並ぶ状態にする。**

## 背景

生成画面へ「どのモデルで書くか」を選ぶ欄を入れた（残課題 59）。
ところが手元の `pnpm run preview` で実測すると、
**5 提供元すべてが「選べるモデルがありません」**になる。

原因は鍵ではなく目録である。目録が空なので、
提供元は 5 つ並ぶが、その下にモデルが 1 つも無い。

これは**順番の問題**である。鍵を登録しても、目録が空なら
モデルは 1 つも並ばず、下書きは作れない。
つまり **鍵より目録が先**である。

単価も目録からしか引けない（`src/infrastructure/llm/pricing.ts`）。
単価が引けないモデルは、選んでも呼び出しの手前で止まる。

## 入力と前提条件

`LLM_PROVIDER_CATALOG` は JSON の設定値で、**秘密ではない**（単価表である）。
形は `src/infrastructure/llm/llm-provider-catalog.ts` が持っている。
提供元は 5 件（anthropic / google / openai / xai は鍵が要る、workers_ai は枠だけ）。

**単価は実際の価格でなければ意味がない。** こちらの記憶で書くと、
古い値で「安いつもりの高いモデル」を選ばせることになる。
各社の価格ページを見て、その日の値を入れる。

## 出力と成果物

1. `LLM_PROVIDER_CATALOG` の設定（手元・dev・本番）
2. 単価をどこから取ったか（各社の価格ページと確認日）の記録
3. 生成画面で、少なくとも 1 つの提供元にモデルが並ぶこと

## 依存関係

なし。**鍵の登録（残課題 08q / ag8）より先に行う。**

## 実装対象

- `LLM_PROVIDER_CATALOG` の設定値（コードではなく設定）
- `docs/product/backlog.md` 項目 59 の「まだ確かめていないこと」

## Write scope と競合制約

設定値のみ。`src/infrastructure/llm/llm-provider-catalog.ts` の形は変えない。

## GitHub publication

`local_only`。

## 実行手順

1. 各社の価格ページで、使うモデルの 100 万トークンあたりの入力・出力単価を確認する
2. 目録の JSON を組み立てる（モデルは各社 1〜2 個で足りる。多いほど選ぶのが難しくなる）
3. 手元へ入れて `pnpm run preview` で並ぶことを実測する
4. dev・本番へ入れる（秘密ではないので `wrangler.jsonc` の `vars` でよい）

## 受入条件

- 生成画面で、少なくとも 1 つの提供元にモデルが並ぶ
- 選択肢に単価が出ており、その値が価格ページと一致する
- 鍵を登録していない提供元には「API キーがまだ登録されていません」が出る
  （目録が空のうちは、この表示にすら到達しない）

## 検証方法

`pnpm run preview` の `/admin/generation` を、通行証を持った `writer` で開く。
`<select>` の中に `提供元::モデル` の値を持つ選択肢が 1 つ以上あること。

## リスクとロールバック

**古い単価を入れると、記事 1 本あたりの費用が実際と食い違う。**
単価は記事の版に焼き込まれるので、あとから直しても過去の記録は直らない。
確認日を必ず残す。戻すのは設定値の差し替えで足りる。

## Handoff

残課題 59（モデルを選ぶ欄）を実装した際に、preview の実測で見つけた。
**画面は正しく動いており、足りないのは設定だけである。**

## 規範

- `src/infrastructure/llm/llm-provider-catalog.ts`
- `src/infrastructure/llm/pricing.ts`
- `docs/product/backlog.md` 項目 59
