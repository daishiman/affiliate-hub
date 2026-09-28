---
graph_node_id: "uiux-followup-reopen-discard-not-restored"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "quality"
tags: ["system-spec","quality"]
priority: "medium"
start_date: "2026-09-09"
target_date: null
iteration: null
title: "reopen で退避された欄が再確定時に戻らない問題が反復して起きている"
owners: ["daishiman"]
created_at: "2026-09-09T00:00:00Z"
updated_at: "2026-09-09T00:00:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["system-spec"]
purpose: null
goal: null
mvp_alignment: {"background":"同じ形の抜けが 3 度起きた (required_info_checks / qa_refs / 再び required_info_checks)。2026-08-28 の実測では戻っていない欄は 0 件で、症状はいま出ていない。原因は 2 つ構造の側に残っている: (A) 退避する欄が state_transition_matrix.py の reopen 分岐にリテラルの一覧で書かれており、新しい欄を載せ忘れると黙って消える (上限 0 で固定・現在 0 件)。(B) 戻す窓口が欄ごとに個別なので、退避されるが戻す窓口が無い欄が作れる (上限 1 で固定)。(B) は現在 1 件 = serves_intents。","mvp_fit":"enabling","purpose":"reopen が退避した欄を再確定が戻さない構造上の穴を、症状ではなく原因の側で上限固定する。","rationale":"退避を戻すのではなく現在の状態で数え直すほうが真実に近い、と 2026-08-22 に判断した。その判断は残しつつ、載せ忘れと窓口欠落を件数上限として機械に見張らせる。"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/uiux-followup-reopen-discard-not-restored.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-09-09T00:00:00Z","origin_kind":"manual","source_digest":null,"source_path":".claude/plugins/system-spec-harness/skills/run-system-spec-elicit/scripts/state_transition_matrix.py","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "bd issue ah-nuu の external_ref が指す先の node が存在せず、lint-orphan-external-ref が OE-001 (true_orphan) として検出したため実在させた"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/uiux-followup-reopen-discard-not-restored.md","confidence":0.9}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-nuu","github_mirror":null,"linked_at":"2026-09-09T00:00:00Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":"manual","status":"open"}
implementation_readiness: {"checked_at":null,"missing_sections":[],"status":"incomplete"}
---

# 目的

reopen が退避した欄を再確定 (confirm) が戻さない構造上の穴を、症状ではなく原因の側で
件数上限として固定し、同じ形の抜けが 4 度目に起きないようにする。

## 背景

同じ形の抜けが 3 度起きた実測記録がある。(1) `required_info` / `required_info_checks`、
(2) `qa_refs`、(3) 再び `required_info_checks`。

reopen は cell の欄を `reopen_log[].discarded` へ退避するが、confirm は退避を戻さない。
戻す窓口は欄ごとに個別に作られており (`restore-qa-refs` は `qa_refs` 専用)、
欄が増えるたびに同じ穴が空く。

2026-08-22 の実測では確定 8 セル全ての `required_info_checks` が HEAD の 1 件から 0 件に
なっており、`record-required-info-check` で数え直して回復させた
（退避を戻すのではなく、現在の状態で数え直すほうが真実に近いと判断した）。

2026-08-28 に測り直したところ、**症状はいま 0 件**である。確定 8 セルそれぞれについて
「その章で退避されたことのある欄」と「いま持っている欄」を突き合わせ、戻っていない欄は 0 件だった。
3 度目の数え直しによる回復が効いている。

## 入力と前提条件

- 入力: `system-spec/spec-state.json` の `reopen_log[].discarded`、各確定セルの現在の欄
- 前提: reopen 非経由の確定直接変更は writer が遮断している

## 出力と成果物

- 生成物: 載せ忘れ件数と窓口欠落件数を数える検査 (上限つき)
- 更新対象: `state_transition_matrix.py` の reopen 分岐

## 依存関係

- `depends_on`: なし
- ブロッカー: なし

## 実装対象

症状ではなく原因を固定する。原因は 2 つあり、どちらも構造の側に残っている。

- **(A) 退避する欄がリテラルの一覧で書かれている。** `state_transition_matrix.py` の reopen 分岐に
  欄名が直に並んでいるため、確定セルに新しい欄が生えたとき載せ忘れると、その欄は reopen で黙って消える。
  → 上限 0 で固定。いま載せ忘れ 0 件。
- **(B) 戻す窓口が欄ごとに個別。** 退避されるが戻す窓口が無い欄が作れてしまう。
  → 上限 1 で固定。

(B) はいま 1 件ある。退避リスト (`qa_ref` / `qa_refs` / `serves_goals` / `serves_intents` /
`required_info` / `required_info_checks` の 6 欄) のうち、`serves_intents` だけ値を書ける op が
存在しない。

## Write scope と競合制約

- touches: `system-spec`
- 排他資源: `spec-state.json` (書込は `apply-spec-transition.py` の単一 writer 経由のみ)
- 上限を緑化のために引き上げない。上限は下げる向きにだけ動かす。

## GitHub publication

- mode: `local_only`
- labels / milestone / project_aliases: 設定しない

## status の意味論 (二重正本の禁止)

status の正本は本 node である。bd issue `ah-nuu` は投影であり、
どちらか一方だけを動かさない。

ただし語彙は一対一ではない。bd 側は `in_progress`、graph 側は `draft` である。
graph の `active` は `confirmation_status=confirmed` / `evaluation_status=pass` /
`implementation_readiness=complete` を同時に要求する (`active_not_ready`)。
本 node はまだ評価を通していないので `active` にはできない。
通すために評価済みと名乗れば、評価していないものが評価済みになる。
bd の `in_progress` は「人が手をつけている」という別の軸を表しており、
graph の `draft` と矛盾しない。

## 実行手順

1. 確定セルの欄集合と reopen 分岐のリテラル一覧を突き合わせ、載せ忘れを数える (上限 0)
2. 退避リストの各欄について、値を書ける op が存在するかを数え、窓口欠落を数える (上限 1)
3. `serves_intents` に値を書ける op を用意し、上限を 1 から 0 へ下げる

## 受入条件

- 載せ忘れ件数が 0 で、上限 0 の検査が緑である
- 窓口欠落件数が宣言した上限以下で、`serves_intents` の解消時に上限を下げている
- 症状 (戻っていない欄) が 0 件であることを実測で示している

## 検証方法

確定セルごとに「退避されたことのある欄」と「現在持っている欄」を突き合わせ、
差分 0 件を確認する。加えて上限つき検査 2 本が exit 0 であることを確認する。

## リスクとロールバック

- リスク: 上限を引き上げれば検査は緑になるが、それは見張りを外したのと同じである。
  上限は下げる向きにだけ動かす。
- ロールバック: 検査の追加と上限宣言のみなので、削除すれば元に戻る。
  `spec-state.json` の内容は変更しない。

## Handoff

- owner: daishiman
- (A) は固定済み。残りは (B) の `serves_intents` に窓口を用意して上限を 0 へ下げること。
