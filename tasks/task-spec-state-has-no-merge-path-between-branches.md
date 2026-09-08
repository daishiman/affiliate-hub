---
graph_node_id: "task-spec-state-has-no-merge-path-between-branches"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "quality"
tags: ["system-spec","quality"]
priority: "medium"
start_date: "2026-09-08"
target_date: null
iteration: null
title: "spec-state.json に枝どうしの合流経路が無く、片方の追記記録が黙って落ちる"
owners: ["daishiman"]
created_at: "2026-09-08T00:00:00Z"
updated_at: "2026-09-08T12:52:05Z"
status: "done"
depends_on: []
related_nodes: []
resource_scope: ["system-spec"]
purpose: null
goal: null
mvp_alignment: {"background":"2026-09-08 の dev 合流で実測: retracted_qa_log は dev に 28 件・本ブランチに 0 件。reopen_log は dev のみ 55 件・本ブランチのみ 43 件。qa_log は本ブランチが dev の上位集合 (dev のみ 0 件・共通 76 件・本ブランチのみ 37 件) で取りこぼしなし","mvp_fit":"enabling","purpose":"枝で積んだ判断の記録が、合流のときに黙って消えないようにする","rationale":"spec-state.json は 1 つの JSON に複数の追記専用ログを持つ。git のテキストマージは配列の要素単位で合流できないので、衝突すればどちらか片方が丸ごと残る。落ちても validator は通る (各ログの中身は独立して整合するため) ので、失われたことに気づけない"}
scope_in: []
scope_out: []
acceptance: ["2 つの spec-state.json を入力に、追記専用ログを要素単位で合流する経路が apply-spec-transition.py 側に在る","同じ id の要素は重複せず、片側にしか無い要素は落ちない","合流できない衝突 (同じセルが両側で別の状態へ確定している等) は自動で解決せず、人へ差し出して止まる","合流後の state が validate-coverage-matrix.py --require-complete --require-foundation を通る"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-spec-state-has-no-merge-path-between-branches.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"c174b75ed0b6296d171b3796d80d4cda2edf506ed4b59fb5ac6db0902fdf898a","evaluator":"final-review","evidence_ref":"docs/spec/feat-blog-top-page-composition/final-review.md"}
source_lineage: {"imported_at":"2026-09-08T00:00:00Z","origin_kind":"manual","source_digest":null,"source_path":"system-spec/spec-state.json","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "dev 合流の実測で、追記専用ログが片側しか残らないことが確かめられた"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-spec-state-has-no-merge-path-between-branches.md","confidence":0.9}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-2ann","github_mirror":null,"linked_at":"2026-09-08T12:12:45Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":"2026-09-08T12:52:05Z","evidence_refs":[".claude/plugins/system-spec-harness/skills/run-system-spec-elicit/scripts/state_transition_merge.py",".claude/plugins/system-spec-harness/tests/test_spec_state_merge.py","docs/spec/feat-blog-top-page-composition/final-review.md"],"policy":"manual","reconciled_at":"2026-09-08T12:52:05Z","source":"manual","status":"done"}
implementation_readiness: {"checked_at":"2026-09-08T21:05:00Z","missing_sections":[],"status":"complete"}
---

# 目的

枝で積んだ判断の記録が、合流のときに**黙って消えない**ようにする。

## 背景

2026-09-08、`origin/dev` を本ブランチへ合流させたあと、`spec-state.json` の各ログを
実測で突き合わせた:

| ログ | dev | 本ブランチ | 差 |
|---|---|---|---|
| `qa_log` | 76 | 113 | dev のみ **0**・共通 76・本ブランチのみ 37 |
| `retracted_qa_log` | **28** | **0** | dev の 28 件が丸ごと無い |
| `reopen_log` | 144 | 132 | dev のみ **55**・本ブランチのみ **43** |
| `approval_log` | 6 | 7 | 本ブランチが 1 件多い (今回追加分) |
| `decisions` | 15 | 15 | 同数 |

## 今回は実害が無かった

**dev で取り下げた 28 件の問答は、本ブランチの `qa_log` にも存在しない** (実測: 生きている
のは 0 件)。その問答を裏付けにしている確定セルも 0 件である。つまり「取り下げたはずの
根拠が別の枝で生き返る」という最悪の形にはなっていない。

失われているのは**取り下げの理由**という監査記録である。dev 側の 28 件には
「written-requirements を名乗りながら source.path / section / sha256 を持たない」
「answer が利用者の逐語ではなく AI が起草した受入条件だった」など、なぜその問答を
外したのかが書かれている。本ブランチではその判断が読めない。

## なぜ気づけないのか

`spec-state.json` は 1 つの JSON に複数の**追記専用ログ**を持つ。git のテキストマージは
JSON 配列の要素単位で合流できないので、衝突すればどちらか片方が丸ごと残る。

そして**落ちても validator は通る**。各ログは独立して整合するので、
`validate-coverage-matrix.py` も `validate-knowledge-graph.py` も緑のままである。
失われたことに気づく手がかりが無い。

## 入力と前提条件

- `system-spec/spec-state.json` (両ブランチ版)
- `apply-spec-transition.py` (唯一の writer)
- `references/spec-state-contract.md` (state の形状の正本)

## 出力と成果物

- 追記専用ログを要素単位で合流する経路 (`apply-spec-transition.py` のサブコマンド)
- 合流できない衝突を人へ差し出して止まる仕組み

## 依存関係

なし。

## 実装対象

- `.claude/plugins/system-spec-harness/skills/run-system-spec-elicit/scripts/apply-spec-transition.py`
- 対応するテスト

## Write scope と競合制約

writer とそのテストのみ。**正本の `spec-state.json` はこの作業では動かさない。**

## 実行手順

1. 追記専用ログ (`qa_log` / `reopen_log` / `retracted_qa_log` / `approval_log`) と、
   合流できないもの (`matrix` の各セル・`requirements_foundation`・`decisions`) を分ける。
2. 前者は id を鍵に和集合を取る。同じ id で中身が違う場合は衝突として扱う。
3. 後者は自動で解決しない。両側が別の値を持つなら、差分を人へ差し出して止まる。
4. `--dry-run` で何が合流し何が衝突するかを先に見せる。

## 受入条件

- 2 つの `spec-state.json` を入力に、追記専用ログを要素単位で合流する経路が writer 側に在る。
- 同じ id の要素は重複せず、片側にしか無い要素は落ちない。
- 合流できない衝突 (同じセルが両側で別の状態へ確定している等) は自動で解決せず、人へ
  差し出して止まる。
- 合流後の state が `validate-coverage-matrix.py --require-complete --require-foundation` を通る。

## 検証方法

今回の実測 (dev 版と本ブランチ版) を fixture にして、合流結果が
`retracted_qa_log` 28 件・`reopen_log` は両側固有分を含む件数になることを確かめる。

## リスクとロールバック

**自動で合流させすぎないこと。** `matrix` のセルを機械が勝手に選ぶと、根拠の無い確定が
生まれる。合流してよいのは「追記しかされない・要素が互いに独立」なログだけである。

## GitHub publication

`local_only`。

## Handoff

完了時に本 node を close する。あわせて、今回落ちた dev 側 28 件の取り下げ理由を
本ブランチへ取り込むかどうかを判断の記録として残す。

## 規範

- `spec-state.json` を手で編集しない。合流も writer を通す。
- 衝突を自動で解決しない。判断が要るものは止めて差し出す。

## やらないこと

- git の merge driver の自作 (writer 経由という単一の入口を壊すため)
- 確定セルの自動合流
