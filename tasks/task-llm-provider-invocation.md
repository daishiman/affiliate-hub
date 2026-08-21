---
graph_node_id: "task-llm-provider-invocation"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "generation"
tags: ["generation","llm","cost"]
priority: "high"
start_date: null
target_date: null
iteration: null
title: "4 社の呼び出しを実装し、記事ごとにモデルを選べるようにする"
owners: ["daishiman"]
created_at: "2026-08-18T04:00:00Z"
updated_at: "2026-08-18T04:00:00Z"
status: "draft"
depends_on: []
related_nodes: ["task-llm-provider-connection"]
resource_scope: ["src","tests","docs"]
purpose: null
goal: null
mvp_alignment: {"background":"提供元の登録所 FACTORIES が 4 社ぶん全てスタブで、llm-setup.ts が使うモデル・単価・鍵の参照キーを目録とは別に持っている","mvp_fit":"direct","purpose":"鍵を登録すればそのまま記事が書ける状態まで、鍵の要らない範囲を先に済ませる","rationale":"ここが済んでいないと、鍵を登録しても呼び出しがスタブのままで何も起きない"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-llm-provider-invocation.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-18T04:00:00Z","origin_kind":"manual","source_digest":null,"source_path":"src/infrastructure/llm/llm-provider-registry.ts","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "生成 AI の呼び出し経路を実測で辿り、スタブのままの箇所と二重定義を特定した"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-llm-provider-invocation.md","confidence":0.9}]
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

**鍵を登録したら、その日のうちに下書きが 1 本できる状態にする。**
鍵が要らない範囲（呼び出しの実装・モデルの選び方・単価の置き場所）を先に済ませる。

## 背景

`task-llm-provider-connection`（`ah-ag8`）には、性質の違う 2 つが混ざっていた。

1. **鍵が要らない実装** — 4 社の呼び出しを書き、どのモデルを使うかを決められるようにする
2. **利用者ご本人にしかできない作業** — API キーの発行と登録

1 を 2 の中に置いたままにすると、**ご本人の手が空くまで実装が止まる**。
逆に 1 が済んでいないと、鍵を登録しても呼び出しはスタブのままで何も起きない。
この項目は 1 だけを扱う。2 は `ah-ag8` に残る。

### いま繋がっていないもの

- `llm-provider-registry.ts` の `FACTORIES` は **5 件すべて `createStubLlm`**。
  Anthropic のアダプタ（`providers/anthropic.ts`）は書かれているが、登録所へ繋いでいない
- `llm-setup.ts` が `MODEL_ID` / `PRICING` / `CREDENTIAL_REF` を持っている。
  **同じことを目録（`llm-provider-catalog.ts`）とここの 2 か所が別のやり方で決めている**。
  片方を直したときに、もう片方が古いままでも型検査は通る

## 入力と前提条件

- 目録は既に「単価は設定（`LLM_PROVIDER_CATALOG`）から読み、無ければ 0 件」の形になっている
- 鍵の値に触れる口（`LlmKeyAccess`）は応用層に型として届かない。触れるのは提供元アダプタだけ
- **鍵そのものは要らない。** 偽の応答で呼び出しの形が合っていることまでを扱う

## 出力と成果物

- `FACTORIES` の 4 社が実際の呼び出しになる（`workers_ai` は枠のまま）
- どのモデルで書くかを**記事ごとに選ぶ**。選ばなければ生成は始まらない
- どのモデルで書いたかが版に残る
- 単価は目録の設定 1 か所だけにある

## 依存関係

`ah-ag8`（鍵の登録）は**この後**。順序が逆になっていたのを分けた。

## 実装対象

- `src/application/ports/llm.ts`（`LlmRequest`）
- `src/application/usecases/generation/draft-content-variant.ts`
- `src/infrastructure/llm/llm-setup.ts` / `llm-provider-registry.ts`
- `src/infrastructure/llm/providers/`（google / openai / xai）
- `tests/` の対応する検査

## Write scope と競合制約

`src/application/`、`src/infrastructure/llm/`、`tests/`、`docs/`。

## GitHub publication

`local_only`。

## 実行手順

1. `LlmRequest` に「どの作業場所の・どの提供元の・どのモデルへ」を載せる
2. `llm-setup.ts` の `MODEL_ID` / `PRICING` / `CREDENTIAL_REF` を消し、目録へ寄せる
3. モデルを選ばずに下書きを作ろうとしたら止める（**既定を作らない**）
4. どのモデルで書いたかを版に残す
5. 4 社のアダプタを Anthropic → Google → OpenAI → xAI の順で書く
6. 単価を各社の公式ページで確認し、**確認した日と見たページ**を 1 行ずつ残す

## 受入条件

- `FACTORIES` の 4 社が `createStubLlm` でない
- モデル未選択のまま生成を頼むと、**何も選ばれずに止まる**
  （「とりあえず先頭」を入れない）
- 生成した結果に、実際に使われたモデルが載る
- 単価がコードの定数として存在しない（設定 1 か所だけ）
- 偽の応答での検査が 4 社ぶん通る

**この受入条件が満たされても「つながった」ではない。**
満たせるのは**「呼び出しの形が合っている」**までである。
実際の鍵で本物の応答を受け取ることは `ah-ag8` の側にあり、
`docs/product/runtime-verification.md` の該当行は**それまで「未確認」のまま**にする。

## 検証方法

- 偽の応答（`fetchImpl` の差し替え）で 4 社ぶんの検査
- `grep` で `llm-setup.ts` に単価とモデル名が無いこと

## リスクとロールバック

`LlmRequest` は生成の入口の型なので、足すと呼び出し側が全部止まる（型検査で分かる）。
戻すときはこの項目のコミットを打ち消せばよく、保存先には触れない。

## Handoff

**鍵の値を受け取らない。** 4 社ぶんが偽の応答で緑になった時点で、
ご本人へ登録の手順をお渡しする（`ah-ag8`）。

## 規範

- `tasks/task-llm-provider-connection.md`（`ah-ag8`。鍵の登録）
- `docs/architecture/changeability-scenarios.md` ②（提供元の差し替え）
- `docs/product/runtime-verification.md`（「呼び出しの形」と「つながった」を分けて書く場所）
