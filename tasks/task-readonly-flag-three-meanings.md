---
graph_node_id: "task-readonly-flag-three-meanings"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "quality"
tags: ["quality","security","webmcp"]
priority: "high"
start_date: null
target_date: null
iteration: null
title: "readOnly という 1 つの旗が 3 つの決定を兼ねている（申告 / 測定対象 / WebMCP 掲載）"
owners: ["daishiman"]
created_at: "2026-08-18T12:40:00Z"
updated_at: "2026-08-18T12:40:00Z"
status: "draft"
depends_on: []
related_nodes: ["task-audit-actions-without-emitters"]
resource_scope: ["src","tests","docs"]
purpose: null
goal: null
mvp_alignment: {"background":"残課題 69 で export_manual_draft の readOnly: true が嘘だったと分かった。旗の値そのものより、1 つの旗が 3 つの決定を兼ねていることが根である","mvp_fit":"direct","purpose":"1 つの値が黙って別の決定に効く状態を無くす","rationale":"①のつもりで書いた true が③に効いて、ページ内の AI に記事の本文を渡していた。逆に false へ直した瞬間に②から外れ、検査対象から静かに消えた"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-readonly-flag-three-meanings.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-18T12:40:00Z","origin_kind":"manual","source_digest":null,"source_path":"docs/product/backlog.md","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "残課題 69 の作業中、readOnly: false へ直したら正常系テストの対象から外れたことで気づいたもの。backlog.md の項目 76"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-readonly-flag-three-meanings.md","confidence":0.9}]
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

道具の `readOnly` が同時に決めている **3 つのこと**を分ける。
または、手で書かせずに**測る**ほうへ寄せる。

## 背景

`readOnly` はいま次の 3 つを一度に決めている。

1. **外への申告**: MCP の `readOnlyHint`（`mcp-adapter`）
2. **測定対象に入るかどうか**: `tool-catalog-adapters.test.ts` の
   `readOnlyTools` が正常系・テナント分離・REST 200 を回している
3. **WebMCP に載せるかどうか**: `toWebMcpDescriptors` / `PAGE_TOOLS`

**1 つの旗が 3 つの決定を兼ねていると、どれか 1 つのつもりで書いた値が、
残り 2 つに黙って効く。**

実際に両方向で効いた。

- `export_manual_draft` は ①のつもり（「投稿はしない」）で `true` と書かれ、
  ③が黙って効いて**ページ内の AI に記事の本文を渡していた**。痕跡は残らなかった
- `false` へ直した瞬間に②から外れ、**正常系とテナント分離の検査対象から静かに消えた**。
  記録がスタブで失敗するため入れられないのだが、
  これは「**検査が減ったことが緑として現れる**」形である

## 入力と前提条件

- `src/presentation/tools/tool-definition.ts`（`readOnly` の定義）
- `src/presentation/tools/webmcp-adapter.ts` / `webmcp-policy.ts`（③）
- `tests/presentation/tool-catalog-adapters.test.ts`（②）
- `tests/presentation/readonly-honesty.test.ts`（実行で測る側。2026-08-18 に追加）

## 出力と成果物

- 3 つの決定がそれぞれ別の根拠を持つ状態、または
- 「状態を変えるか」を手で書かせず実行で測る仕組み

## 依存関係

無し。ただし `readonly-honesty.test.ts` が先にあること（済）。

## 実装対象

- `src/presentation/tools/tool-definition.ts`
- `src/presentation/tools/webmcp-adapter.ts`
- `tests/presentation/tool-catalog-adapters.test.ts`

## Write scope と競合制約

`src/presentation/tools/**`。旗を分けると **95 個すべての道具定義**に波及するため、
道具を足す作業と同時に進めない。

## GitHub publication

`local_only`。

## 実行手順

1. 3 つの決定それぞれについて、**いま何件が旗の値だけを根拠にしているか**を数える
2. ③（WebMCP 掲載）を別の値にするか、`PAGE_TOOLS` の明示列挙だけを根拠にできないか見る
3. ②は「読み取り専用だから正常系を回せる」ではなく
   「**入力の見本があるから回せる**」が本来の条件のはずなので、そこを確かめる
4. ①だけを `readOnly` に残す

**3 つに増やすことが目的ではない。**増やすと今度は 3 つとも人が手で書く値になる。
「状態を変えるか」は `readonly-honesty.test.ts` が実行で測れているので、
**手で書かせずに測る**ほうへ寄せられないかを先に検討する。

## 受入条件

- `readOnly` の値を 1 つ変えたときに、どの決定が変わるかが定義の場所から読める
- ②の対象が「読み取り専用かどうか」ではない根拠で決まっている
  （書き込みの道具がテナント分離の検査から外れたままにならない）

## 検証方法

`export_manual_draft` を `readOnly: true` に戻したときに
`readonly-honesty.test.ts` が赤になることは実測済み。
分けたあとも同じ実測が通ること。加えて、
**書き込みの道具がテナント分離の検査に入っているか**を件数で示す。

## リスクとロールバック

95 個の道具定義に触るため、機械的な置換が漏れると
「旗を書き忘れた道具」が既定値で WebMCP に載る事故が起きうる。
**既定値は「載せない」側に倒す。**戻すのは型の 1 行なのでロールバックは容易。

## Handoff

②の話は単独でも重い。**いま `readOnly: false` の道具は、
`tool-catalog-adapters.test.ts` のテナント分離検査に 1 件も入っていない。**
つまり REQ-M03 の「作業場所をまたげないこと」は、
**読み取りの道具でしか確かめられていない。**書き込みのほうが被害は大きい。
これは分離の作業とは別に、単独で起票する価値がある。

## 規範

- `docs/product/backlog.md` 項目 76
- `docs/product/required-test-types.md` §4
- `docs/spec/10-テスト戦略仕様.md` §3-3
