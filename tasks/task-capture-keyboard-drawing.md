---
graph_node_id: "task-capture-keyboard-drawing"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "quality"
tags: ["a11y","quality","ui"]
priority: "medium"
start_date: "2026-08-19"
target_date: null
iteration: null
title: "描く操作がポインタのみで、キーボードから行えない"
owners: ["daishiman"]
created_at: "2026-08-19T02:00:00Z"
updated_at: "2026-08-19T02:00:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["docs","tests"]
purpose: null
goal: null
mvp_alignment: {"background":"REQ-FB05 の a11y 欄は「対応」とだけ書いてあったが、動かして確かめると、画面の写しへ書き込む操作はポインタでしか行えなかった","mvp_fit":"enabling","purpose":"画面の写しへの書き込みを、キーボードだけで完了できるようにする","rationale":"道具の選択まではキーボードで進めるのに、そこから先が描けない。途中で行き止まりになる導線を、正直に書いたうえで塞ぐ"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-capture-keyboard-drawing.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-19T02:00:00Z","origin_kind":"manual","source_digest":null,"source_path":"docs/product/backlog.md","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "2026-08-19 の FB 群の宣言作業で、判定欄を動かして確かめたときに見つかった"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-capture-keyboard-drawing.md","confidence":0.9}]
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

**画面の写しへの書き込みを、キーボードだけで完了できるようにする。**

## 背景

改善要望の受け口では、画面の写しを撮ったあとに「ここが分かりにくい」と
印を付けられる。この**印を付ける操作が、ポインタでしかできない**。

道具の選択（枠・矢印・塗りつぶし）まではキーボードで到達できる。
到達できるのに、そこから先で**描けない**。
これは「入口が無い」より悪い。**途中まで進めるので、進める人には
できるように見える。**

`docs/product/traceability.md` の `REQ-FB05` の a11y 欄は、2026-08-19 まで
**「対応」の 1 語**だった。欄を読んでも分からず、動かして初めて分かった。
同日、欄を「一部」に落としてある（文章は正直になった）。
**この課題は、文章ではなく状態のほうを直すためにある。**

文章だけ落として閉じると、正直に書いてあるぶん誰も直さなくなる。

## 入力と前提条件

- `src/presentation/ui/patterns/`（画面の写しに印を付ける部品）
- `docs/product/traceability.md` `REQ-FB05`（a11y 欄はいま「一部」）
- `docs/product/backlog.md` 項目 82

## 出力と成果物

キーボードだけで、**印を 1 つ置いて確定できる**こと。決め打ちにしない候補:

- 位置を持つ入力欄（数値）で矩形を指定し、プレビューへ反映する
- 矢印キーで選択中の印を動かす／`Enter` で確定・`Esc` で取り消す
- 「この要素が分かりにくい」を、座標ではなく**画面の要素の一覧から選ぶ**
  （そもそも座標を扱わせない。最も安く、読み上げとも噛み合う）

3 つ目が本命。座標での描画をキーボードに翻訳するのではなく、
**そもそも座標を要求しない別の道**を用意するほうが、実装も操作も短い。

## 依存関係

無し。

## 実装対象

- `src/presentation/ui/patterns/` の該当部品
- `tests/ui/keyboard-operation.test.tsx`（この画面を対象に加える）

## Write scope と競合制約

`src/presentation/ui/patterns/` と `tests/ui/`。
`docs/product/` の生成物には触らない。

## GitHub publication

`local_only`。

## 実行手順

1. **できないことを、まず検査として書く。** キーボードだけで印を 1 つ確定する
   テストを書き、**赤になることを実測で見る**
2. 「出力と成果物」の 3 つ目（要素の一覧から選ぶ）で実装する
3. 手順 1 のテストが緑になることを見る
4. `REQ-FB05` の a11y 欄を「一部」から戻す。**このとき、戻す根拠を
   テスト名で書く**（「対応」の 1 語に戻さない）

## 受入条件

- 手順 1 のテストが、実装前は赤・実装後は緑であること（両方を実測で示す）
- ポインタでの操作が従来どおり動くこと（**既存の道を落とさない**）
- `REQ-FB05` の a11y 欄が、テスト名を指していること

## 検証方法

`tests/ui/keyboard-operation.test.tsx` に加える。
壊して測るときは scratchpad へ複製を取り、後始末は複製からの書き戻しだけで行う
（`docs/architecture/testing-architecture.md` §5-2）。

## リスクとロールバック

要素の一覧から選ぶ方式にすると、**いま座標で撮れていた「文字の間」や
「余白」を指せなくなる**。指せなくなるものが出たら、一覧の粒度を
細かくするのではなく、**自由記述の欄で補える**ことを確かめる
（受け口には本文がある）。

## リスク: 「対応」に書き戻して閉じること

- 欄の文字を戻すのは成果ではない。**手順 1 のテストが緑になったことだけが根拠になる。**
- ポインタ操作を消してキーボードに一本化するのも違う。片方を落として
  もう片方を満たすのは、a11y の対応ではなく機能の削除である。

## Handoff

手順 1 の赤を実測したかどうかを必ず書く。
`REQ-FB05` の a11y 欄を何に書き換えたかを、テスト名つきで書く。

## 規範

- `docs/product/backlog.md` 項目 82
- `tasks/task-judgment-column-audit.md`（`FB03` 型。1 語しか書いていない欄）
- `docs/architecture/testing-architecture.md` §5-2

## やらないこと

- `REQ-FB05` の a11y 欄を、実装を動かさずに書き換えること
- ポインタでの描画を落とすこと
