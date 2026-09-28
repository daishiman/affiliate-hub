---
graph_node_id: "task-doc-fetch-evidence-preservation"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "quality"
tags: ["system-spec","quality"]
priority: "medium"
start_date: "2026-09-09"
target_date: null
iteration: null
title: "C02 assembler で取得証跡の拡張フィールドを保持する"
owners: ["daishiman"]
created_at: "2026-09-09T00:00:00Z"
updated_at: "2026-09-09T00:00:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["system-spec","docs"]
purpose: null
goal: null
mvp_alignment: {"background":"起票時のバグ本体 (全 15 record から 3 欄が落ちる) は再現しない。3 欄は REQUIRED_INPUT_FIELDS と OUTPUT_FIELD_ORDER の両方に入っており、system-spec/fetched-references.json の実データ 15 件すべてが保持している。未達だったのは受入条件の最後の一項 (回帰テスト 0 件) で、2026-08-28 に .claude/plugins/system-spec-harness/tests/test_fetched_references_evidence.py を新設した (11 件・全緑)。","mvp_fit":"enabling","purpose":"build-fetched-references.py assemble が freshness_source / evidence_ref / evidence_sha256 の拡張契約を保持することを、回帰テストで両側から固定する。","rationale":"保持だけを当てると『入れたものが出てきた』という主張にしかならず、欄を持たない素材への振る舞いを何も言わない。欠けた素材が組み立てを断られることを同じ便で当てる。"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-doc-fetch-evidence-preservation.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-09-09T00:00:00Z","origin_kind":"manual","source_digest":null,"source_path":".claude/plugins/system-spec-harness/tests/test_fetched_references_evidence.py","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "bd issue ah-u5l.1 の external_ref が指す先の node が存在せず、lint-orphan-external-ref が OE-001 (true_orphan) として検出したため実在させた"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-doc-fetch-evidence-preservation.md","confidence":0.9}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-u5l.1","github_mirror":null,"linked_at":"2026-09-09T00:00:00Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":"manual","status":"open"}
implementation_readiness: {"checked_at":null,"missing_sections":[],"status":"incomplete"}
---

# 目的

`build-fetched-references.py assemble` が `freshness_source` / `evidence_ref` / `evidence_sha256`
の拡張契約を保持することを、回帰テストで両側から固定する。

## 背景

起票時 (2026-08-24) の申告は「assemble が全 15 record から 3 欄を落とす」だった。
2026-08-28 に測り直したところ、**バグ本体は既に直っていた**。3 欄は `REQUIRED_INPUT_FIELDS` と
`OUTPUT_FIELD_ORDER` の両方に入っており、`system-spec/fetched-references.json` の実データ 15 件
すべてが 3 欄を保持している。起票時の症状は再現しない。

未達だったのは受入条件の最後の一項、すなわち回帰テストが 0 件だったことである。
章コンパイラの手書き節消失と同じ形の問題 — 正規生成器が拡張契約を保持しない — なので、
症状が消えたことをもって閉じると、次に同じ穴が空いたとき誰も気づかない。

`.claude/plugins/system-spec-harness/tests/test_fetched_references_evidence.py` を新設した (11 件・全緑)。

## 入力と前提条件

- 入力: `system-spec/fetched-references.json`、`build-fetched-references.py` の
  `REQUIRED_INPUT_FIELDS` / `OUTPUT_FIELD_ORDER`
- 前提: repo-local の `validate-source-citation.py` が拡張契約を必須としている

## 出力と成果物

- 生成物: `.claude/plugins/system-spec-harness/tests/test_fetched_references_evidence.py`
- 更新対象: なし (assemble 本体の変更は不要と判明した)

## 依存関係

- `depends_on`: なし
- ブロッカー: なし

## 実装対象

回帰テストを両側から当てる。

- (a) 3 欄を持つ素材を入れたら 3 欄が同じ値で出る（保持）
- (b) `evidence_ref` / `evidence_sha256` を欠いた素材は組み立てを断られる（必須）

(b) が無いと (a) は「入れたものが出てきた」だけの主張になり、欄を持たない素材への振る舞いを
何も言わない。`freshness_source` が `REQUIRED_INPUT_FIELDS` に入っていない差も検査に書いた
（「3 欄すべて必須」と書いて緑にするには必須の側を広げるしかなく、実物と違う主張になる）。

## Write scope と競合制約

- touches: `system-spec`, `docs`
- 排他資源: なし
- `system-spec/fetched-references.json` の実データは書き換えない (テストは素材を自前で組む)

## GitHub publication

- mode: `local_only`
- 関連 draft PR: https://github.com/daishiman/affiliate-hub/pull/29
  （当該 PR の merge blocker ではなく、リリース後続として継続追跡する）

## status の意味論 (二重正本の禁止)

status の正本は本 node である。bd issue `ah-u5l.1` は投影であり、
graph 側の `draft` と bd 側の `open` は同じ事実の別語彙表現である。
どちらか一方だけを動かさない。

## 実行手順

1. 実データ 15 件が 3 欄を保持しているかを測る（症状の有無を先に確定する）
2. 保持側 (a) と必須側 (b) の回帰テストを書く
3. `OUTPUT_FIELD_ORDER` から欄を 1 行外して、テストが実際に落ちることを確かめる
4. 元に戻して全緑を確認する

## 受入条件

- 回帰テストが保持側と必須側の両方を当てている
- 欄を外したときにテストが落ちることを実測している（壊して測る）
- `validate-source-citation.py` が 0 違反である

## 検証方法

```
python3 -m pytest .claude/plugins/system-spec-harness/tests/test_fetched_references_evidence.py
python3 .claude/plugins/system-spec-harness/scripts/validate-source-citation.py --targets <wrap>
```

`--targets` は wrap が要る点に注意する。

## リスクとロールバック

- リスク: 「3 欄すべて必須」と書いて緑にしようとすると必須の側を広げることになり、
  実物と違う主張のテストが残る。テストが実装より強い主張をすると、後で実装側を歪める。
- ロールバック: テストの追加のみなので、削除すれば元に戻る。

## Handoff

- owner: daishiman
- 壊して測る手順まで完了済み。残りは受入条件の最終確認のみ。
