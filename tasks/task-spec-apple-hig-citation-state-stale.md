---
graph_node_id: "task-spec-apple-hig-citation-state-stale"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "specification"
tags: ["system-spec","follow-up"]
priority: "medium"
start_date: null
target_date: null
iteration: null
title: "apple-hig の引用不可理由が現物と食い違ったまま残っている"
owners: ["daishiman"]
created_at: "2026-09-06T00:00:00Z"
updated_at: "2026-09-06T02:20:00Z"
status: "draft"
depends_on: []
related_nodes: ["task-spec-doctrine-anchor-asvs-target"]
resource_scope: ["system-spec"]
purpose: null
goal: null
mvp_alignment: {"background":"frontend.md:315 と ui-ux.md:361 が apple-hig を『17681 B の JS シェルで本文なし』として引用不可にしているが、現在の取得証跡 design-principles.json は content_bytes 26295 で本文を含む","mvp_fit":"deferred","purpose":"章に書いてある引用不可の理由を、いま実際に取れているものと合わせる","rationale":"引けるのに引いていない状態を『引けなかった』と記録すると、次に同じ判断をする人がもう一度同じ壁を確かめ直すところから始める"}
scope_in: ["presentation concern の clause citation state を現在の取得証跡から採り直す","C03 再実行と C05 再評価をひと続きで行う"]
scope_out: ["章の直接編集","条項引用の判定基準そのものの変更"]
acceptance: ["frontend.md と ui-ux.md の presentation concern が、現物と食い違う引用不可理由を持たない","章を手で編集せず C03 の生成経路を通している","C05 再評価でこの finding が返らない"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-spec-apple-hig-citation-state-stale.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":null,"origin_kind":"manual","source_digest":null,"source_path":null,"source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "standalone follow-up task filed while closing the completeness cluster (ah-670)"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-spec-apple-hig-citation-state-stale.md","confidence":0.9}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"open"}
implementation_readiness: {"checked_at":null,"missing_sections":[],"status":"incomplete"}
---

# 目的

章に書いてある「引用できない理由」を、いま実際に取れているものと合わせる。

## 背景

`system-spec/frontend.md:315` と `system-spec/ui-ux.md:361` は presentation concern の条項引用を
「apple-hig は 17681 B の JavaScript シェルで本文が無い」という理由で不可としている。

しかし現在の取得証跡 `system-spec/retrieval-evidence/apple-hig.json` は、同じ公式 host の
ドキュメントデータ endpoint（`.../design/human-interface-guidelines/design-principles.json`、
`content_bytes=26295`、`page_title=Design principles`）へ差し替わっており、**本文を含んでいる**。

理由の側だけが古い。これは「引けなかった」ではなく「引けるのに引いていない」状態で、
読んだ人は取得を諦めた記録として受け取る。次に同じ判断をする人が、もう一度同じ壁を
確かめ直すところから始めることになる。

## 入力と前提条件

- 入力: `system-spec/retrieval-evidence/apple-hig.json`、`system-spec/frontend.md`、`system-spec/ui-ux.md`
- 前提: 章を直接編集しない。確定章は `guard-confirmed-chapter-overwrite.py` が守っている。
  直すのは生成物ではなく生成の入力側で、章は C03 の再実行で書き換わる

## 出力と成果物

- 更新対象: `system-spec/frontend.md`・`system-spec/ui-ux.md` の条項引用状態（C03 経由）
- 本文が取れているなら state を `available` へ反転させ、`cited_clauses` を埋める

## 依存関係

- `depends_on`: なし
- 併走の注意: これを直すと 8 章の指紋が動き、`completeness-report.json` の
  `inputs.sha256` と件数がずれる。**C05 の再評価まで含めて 1 回の作業として扱う。**
  章だけ直して評価を回さないと、報告書が古い入力に対する PASS を名乗ったまま残る
  （これは ah-xq57 で一度片付けたずれと同じ形）

## 実装対象

- Frontend: N/A
- Backend/API: N/A
- Database/Data: N/A
- Infrastructure: N/A
- Security/Privacy: N/A
- Documentation: `system-spec/frontend.md`・`system-spec/ui-ux.md`（**C03 の生成経由**であり、直接編集ではない）

## Write scope と競合制約

- `touches`: system-spec/
- 排他資源: `system-spec/frontend.md`、`system-spec/ui-ux.md`、`system-spec/completeness-report.json`
- 並列実行条件: 章を書く task・完成度評価を走らせる task と同時に走らせない
- branch: `devgraph/task-spec-apple-hig-citation-state-stale`
- worktree lease: 実装前に `graph_node_id` を claim し、終了時に release する
- completion projection: feature branch は pending event のみ記録し、既定ブランチ側の reconcile が done を書く

## 実行手順

1. `apple-hig.json` を開き、本文が実際に条項として引ける形かを確かめる
2. C03（`run-system-spec-compile`）を再実行し、presentation concern の
   clause citation state を現在の取得証跡から採り直す
3. 章の差分が理由の書き換えだけに収まっているかを読む
4. C05（`assign-system-spec-completeness-evaluator`）を再実行し、
   この finding が返らないことと `inputs` が新しい実体と一致することを確かめる

## 受入条件

- [ ] `frontend.md` と `ui-ux.md` の presentation concern が、現物と食い違う理由を持たない
- [ ] 章を手で編集していない（C03 の生成経路を通している）
- [ ] C05 再評価でこの finding が返らない
- [ ] `completeness-report.json` の `inputs` が更新後の実体と一致する

## 検証方法

- 自動検証: `python3 .claude/plugins/system-spec-harness/skills/assign-system-spec-completeness-evaluator/scripts/aggregate-completeness.py --report system-spec/completeness-report.json --fork-ledger eval-log/system-spec-harness/audit-fork-ledger.jsonl --spec-root .`
- 手動検証: 2 か所の理由文を読み、`apple-hig.json` の中身と突き合わせる
- 証跡: C05 の findings 一覧

## リスクとロールバック

- リスク: 章を再生成すると鮮度の指紋が動き、いま PASS している C05 が入力ずれで FAIL に見える
- ロールバック: `git revert`。章も報告書も生成物なので、入力を戻せば作り直せる

## GitHub publication

`local_only`。github.enabled=false のため completion policy は manual、
ローカルの決着は `bd-bridge.py --op close --reason ...` で書く。

## Handoff

実装 route: human。**tracker は `ah-1igm`**。
`task-spec-doctrine-anchor-asvs-target`（追跡先は既存の `ah-ejn`）と同じ回にまとめると、
C03 の再実行と C05 の再評価が 1 回で済む。完了時は `docs/product/backlog.md` の状態欄を更新する。

## 規範

`system-spec/completeness-report.json` の `findings`（severity=medium、bucket=design_knowledge_reflection/C15）
