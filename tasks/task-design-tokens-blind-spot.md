---
graph_node_id: "task-design-tokens-blind-spot"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "quality"
tags: ["quality","testing","design-tokens"]
priority: "medium"
start_date: "2026-08-19"
target_date: null
iteration: null
title: "design-tokens の色の検査に死角がある（定数表へ括り出すと見えなくなる）"
owners: ["daishiman"]
created_at: "2026-08-19T08:00:00Z"
updated_at: "2026-08-19T08:00:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["docs","tests"]
purpose: null
goal: null
mvp_alignment: {"background":"82 の実装中、canvas へ直書きした色が検査に引っかかり、定数表へ括り出したら緑になった。色は 1 つも変わっていない","mvp_fit":"enabling","purpose":"色の検査が実際に見ている範囲を、正当な例外と死角に分けて書き直す","rationale":"死角は正当なものと不当なものを区別しない。次に不当なものが同じ場所へ入っても同じように緑になる"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-design-tokens-blind-spot.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-19T08:00:00Z","origin_kind":"manual","source_digest":null,"source_path":"docs/product/backlog.md","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "残課題 78 ㉝ の (iii)（隠す向き）の実例として、82 の実装中に向こうから出てきた"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-design-tokens-blind-spot.md","confidence":0.9}]
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

**色の直書きを見張っている検査が、実際には何を見ていて何を見ていないのかを、
正当な例外と死角に分けて書き直す。**

## 背景

2026-08-19、残課題 82（台紙のキーボード操作）の実装中に**向こうから出てきた**形である。

`tests/ui/design-tokens.test.ts` の色の検査は、次の 1 行でしか見ていない。

```ts
if (/#[0-9a-f]{6}\b/i.test(line) && /(color|background|border|fill|stroke)/i.test(line)) {
```

**同じ行に `#rrggbb` があり、かつ `color|background|border|fill|stroke` のどれかがある**
ときだけ数える。だから:

- `ctx.strokeStyle = "#ffffff"` → **赤くなる**（同じ行に `stroke` がある）
- `const CARET_CODE = { light: "#ffffff", dark: "#101010" } as const;` → **緑になる**

**色は 1 つも変わっていない。書き方を検査から見えない側へ寄せただけである。**
残課題 78 ㉝ の (iii)、その「隠す向き」の実例（(iii) には見せる向きと隠す向きがある。
見せれば床なしの数が下がり、隠せば赤が緑になる。どちらも定義を動かさないので、
新旧の定義で数え直しても見つからない）。

既存の `COLOR_CODE` / `REDACT_CODE` も、同じ形で緑になっている。

### いちばん重い点

canvas は画素へ直に書くので CSS 変数が届かない。だから直書きは**正当な例外**である。
問題は例外であること自体ではない——

**検査はそれを例外として認めているのではなく、単に見えていない。**

**死角は、正当なものと不当なものを区別しない。**
次に不当なものが同じ場所へ入っても、まったく同じように緑になる。

## 入力と前提条件

- `tests/ui/design-tokens.test.ts`（検査の本体）
- `src/presentation/ui/patterns/capture-canvas.tsx`（`COLOR_CODE` / `REDACT_CODE` / `CARET_CODE`）
- 残課題 78 ㉝ の (iii)

## 出力と成果物

- 検査が見ている範囲の一覧（推測ではなく実測）
- 「正当な例外」と「死角」の切り分け
- 例外を**例外として記録する**書き方

## 依存関係

無し。残課題 78 と同じ根（測る側の範囲）を扱う。

## 実装対象

`tests/ui/design-tokens.test.ts`。実装（`src/`）の色は変えない。

## Write scope と競合制約

`docs/`、`tests/`。

## 実行手順

1. いまの正規表現が拾う行と拾わない行を、実測で分ける
2. `#rrggbb` を含むすべての行を一度数え、そのうち何件が検査に見えているかを出す
3. 見えていない行を、**正当な例外**（canvas など）と**それ以外**に分ける
4. 直し方を決める。案は 2 つ:
   - (1) 定数表の中（オブジェクトリテラルの値）まで走査する
   - (2) canvas 由来の 3 つを、理由つきの例外として明記する
5. 例外に選んだものは、**理由をその場に書く**（78 ㉟。根拠を書く手間が検問になる）

## 受入条件

- 見えていない行の件数が、推測ではなく実測で出ている
- その全件が「正当な例外」か「それ以外」のどちらかに割り当たっている
- 例外に回したものは、隣に理由が書かれている

## 検証方法

**壊して赤を見るだけでは足りない。**直したあと、**canvas ではない場所へ
`#rrggbb` を定数表の形で 1 つ置いて、赤くなるか**を確かめる。
赤くならなければ、死角は塞がっていない。

壊すときは先に scratchpad へ複製を取り、複製から書き戻す。
`git checkout --` / `git restore` / `git clean` / `rm` は後始末に使わない。

## リスクとロールバック

走査を広げると、いままで緑だった箇所が一斉に赤くなりうる。
**広げる変更は 1 つずつ入れる。**

## リスク: 検出器の検出器を作ること

**作らない。**作れば「例外らしい書き方を置く」ことが目的になり、
検問の中身が空になる（78 ㉟ と同じ理由）。

## GitHub publication

`local_only`。

## Handoff

完了時に `docs/product/backlog.md` 項目 78 ㉝ の (iii) の実例欄を更新する。

## 規範

`docs/product/backlog.md` 項目 78 ㉝・㉟

## やらないこと

- **着手前に上限を書くこと。**何件あるかが分かる前に上限を書くと、
  出た数に合わせて書くことになる。
- 落ちた箇所を例外へ回して緑にすること。
