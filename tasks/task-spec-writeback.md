---
graph_node_id: "task-spec-writeback"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "specification"
tags: ["spec-canonicalization","mvp"]
priority: "high"
start_date: "2026-08-16"
target_date: null
iteration: null
title: "仕様整理の最終レビューと draft PR"
owners: ["daishiman"]
created_at: "2026-08-16T11:19:17Z"
updated_at: "2026-08-17T10:36:03Z"
status: "closed"
depends_on: []
related_nodes: ["feat-spec-canonicalization","arch-spec-governance"]
resource_scope: ["docs/spec","system-spec","specs","architecture","features","tasks",".dev-graph",".beads"]
purpose: null
goal: null
mvp_alignment: {"background":"未追跡の仕様追加を main の Phase 0/1 と接続する必要がある","mvp_fit":"direct","purpose":"正本整理を draft PR として提出する","rationale":"今の作業そのものが成果物を提出するタスク"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-spec-writeback.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":null,"origin_kind":"manual","source_digest":null,"source_path":null,"source_plugin":null,"source_version":null}
classification_confidence: 0.92
classification_reason: "standalone close-out task for this spec writeback"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-spec-writeback.md","confidence":0.92}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-bvu","github_mirror":null,"linked_at":"2026-08-16T11:19:58Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":"2026-08-16T11:23:32Z","evidence_refs":["docs/spec-writeback-receipt.md","https://github.com/daishiman/affiliate-hub/pull/11"],"policy":"manual","reconciled_at":"2026-08-16T11:23:49Z","source":"manual","status":"done"}
implementation_readiness: {"checked_at":null,"missing_sections":[],"status":"incomplete"}
---

# 目的

仕様正本の整理結果を、品質ゲートと仕様反映の受領書付きで dev 向け draft PR に載せる。

## 背景

docs/spec の 01〜03 と system-spec が未追跡のまま追加されていた。origin/main には Phase 0 文書と Phase 1 スキーマがあり、正本関係を書かないとどちらが勝つか不明になる。

## 入力と前提条件

- 入力: docs/spec、system-spec、origin/main の Phase 0 / Phase 1
- 前提: アプリ動作を変えない。pycache は commit しない

## 出力と成果物

- 生成物: docs/spec 正本、system-spec 投影、specs / architecture / features / tasks、.dev-graph、Beads、受領書
- 更新対象: README、.gitignore、Phase 0 文書の参照注記

## 依存関係

- depends_on: なし
- ブロッカー: なし

## 実装対象

- Frontend: N/A: UI 変更なし
- Backend/API: N/A: API 変更なし
- Database/Data: N/A: スキーマ変更なし。As-Is 記述のみ更新
- Infrastructure: N/A: デプロイ単位は変えない
- Security/Privacy: N/A: 認証実装なし
- Documentation: 正本、投影、graph、README を更新

## Write scope と競合制約

- touches: docs/ spec/ system-spec/ architecture/ features/ tasks/ .dev-graph/ .beads/ README.md .gitignore
- 排他資源: docs/spec、system-spec
- 並列実行条件: 同一 path を触る task と同時に走らせない
- branch: devgraph/task-spec-writeback
- worktree lease: 本 worktree で実行
- completion projection: feature branch は pending。完了は draft PR 作成で手動記録

## GitHub publication

- Mode: local_only
- Project aliases: N/A: github.enabled=false
- Issue labels/milestone: N/A: Beads が実行管理
- Initial Project fields: N/A: GitHub Projects を使わない
- Publication gate: 文書が揃い、品質ゲートが機械層で通ること
- Failure policy: local のまま残す
- Completion policy: manual
- PR linkage requirement: 本文に Beads ID と dev-graph: task-spec-writeback を書く。base は dev
- Closed without merge: keep_active
- Local reconciliation: 手動

## status の意味論 (二重正本の禁止)

frontmatter の status は文書ライフサイクルのみ。実行状態は Beads と completion_evidence を正本とする。

## 実行手順

1. origin/main を local main へ取り込み、本ブランチへマージする
2. 正本の優先表と As-Is を更新する
3. dev-graph と Beads を正規 writer で初期化する
4. C02 で feature / architecture / specification / document / task を登録する
5. 品質ゲートを実行し、受領書を書く
6. 対象ファイルだけ commit し、dev 向け draft PR を作る

## 受入条件

- [ ] 正本の優先が 00-README で読める
- [ ] Phase 0 文書が残っている
- [ ] 品質ゲートの機械層が exit 0
- [ ] draft PR が origin/dev 向けである

## 検証方法

- 自動検証: validate-coverage-matrix.py / validate-knowledge-graph.py / validate-source-citation.py / validate-graph-schema.py
- 手動検証: git diff でアプリコードを変えていないことを確認
- 証跡: docs/spec-writeback-receipt.md

## リスクとロールバック

- リスク: 正本が増えて読者が迷う
- ロールバック: PR をマージしなければ本番に影響しない。revert で文書を戻せる

## Handoff

- 実装 route: human
- 次に利用するノード: feat-spec-canonicalization
