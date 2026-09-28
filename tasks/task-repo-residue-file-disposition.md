---
graph_node_id: "task-repo-residue-file-disposition"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "tooling"
tags: ["housekeeping","follow-up"]
priority: "medium"
start_date: null
target_date: null
iteration: null
title: "残置ファイルの扱いを決める (system-spec/$O ほか)"
owners: ["daishiman"]
created_at: "2026-09-05T00:00:00Z"
updated_at: "2026-09-05T00:00:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["system-spec",".dev-graph"]
purpose: null
goal: null
mvp_alignment: {"background":"system-spec/$O・system-spec/tr.txt・.dev-graph/tmp/linkage/probe.json・.dev-graph/tmp/node-patch.json・scratch-state.json が git status に残り続けている","mvp_fit":"deferred","purpose":"作業の跡と成果物を見分けられるようにする","rationale":"残置が増えると git status が読めなくなり、本当の変更が埋もれる。出所を確かめずに消すのは別の事故なので、1 件ずつ決める"}
scope_in: ["各ファイルの出所の特定と、扱いの決定"]
scope_out: ["中身を読まずに一括で消すこと"]
acceptance: ["`system-spec/$O` / `system-spec/tr.txt` / `.dev-graph/tmp/*` / `scratch-state.json` の各々について、残すか消すかが決まっている","残すものには、なぜ残すかが書かれている"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-repo-residue-file-disposition.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":null,"origin_kind":"manual","source_digest":null,"source_path":null,"source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "standalone follow-up task filed while closing the thumbnail work"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-repo-residue-file-disposition.md","confidence":0.9}]
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

作業の跡と成果物を見分けられるようにし、`git status` が読める状態へ戻す。

## 背景

`system-spec/$O`、`system-spec/tr.txt`、`.dev-graph/tmp/` 配下、`scratch-state.json` が`git status` に残り続けている。残置が増えると本当の変更がその中に埋もれ、「この差分は意図したものか」を毎回目で選り分けることになる。

ただし**中身を読まずに一括で消すのは別の事故**である。`system-spec/$O` のような名前はリダイレクトの打ち間違いで生まれた空ファイルのこともあれば、生成物のこともある。1 件ずつ決める。

## 入力と前提条件

- 入力: `git status --porcelain` に出る未追跡ファイルの一覧と、各ファイルの中身
- 前提: 消す前に中身を見る。`rm` が拒否されたら迂回せず止める

## 出力と成果物

- 生成物: 各ファイルの扱い (残す/消す/`.gitignore` へ) の決定と、その理由
- 更新対象: `.gitignore`、および残置ファイルそのもの

## 依存関係

- `depends_on`: なし
- ブロッカー: なし

## 実装対象

- Frontend: N/A
- Backend/API: N/A
- Database/Data: N/A
- Infrastructure: N/A
- Security/Privacy: 残置ファイルに秘密が書かれていないかを、消す前に確かめる
- Documentation: `.gitignore` の意図をコメントで残す

## Write scope と競合制約

- `touches`: system-spec/ .dev-graph/ .gitignore
- 排他資源: なし
- 並列実行条件: 同じ path を触る task と同時に走らせない
- branch: devgraph/task-repo-residue-file-disposition
- worktree lease: 実装前に `graph_node_id` を claim し、終了時に release する
- completion projection: feature branch は pending event のみ記録し、既定ブランチ側の reconcile が done を書く

## GitHub publication

- Mode: local_only
- Project aliases: N/A: github.enabled=false
- Issue labels/milestone: N/A: Beads が実行管理する
- Initial Project fields: N/A: GitHub Projects を使わない
- Publication gate: `status=active && confirmation_status=confirmed && evaluation_status=pass && implementation_readiness.status=complete`
- Failure policy: pending_retry。local の task は巻き戻さない
- Completion policy: manual (github.enabled=false のため source=manual)
- PR linkage requirement: 本文に Beads ID と `dev-graph: task-repo-residue-file-disposition` を書く。base は `dev`
- Closed without merge: keep_active
- Local reconciliation: 手動 (`bd-bridge.py --op close --reason ...`)

## status の意味論 (二重正本の禁止)

frontmatter の `status` は文書ライフサイクルのみを表す。実行状態 (未着手・進行中・完了) の正本は
`completion_evidence` と `beads_linkage` であり、この本文へ書き写さない。

## 実行手順

1. 各残置ファイルの中身を読み、出所 (どの実行が作ったか) を特定する
2. 秘密が含まれていないことを確かめる
3. 残すもの・消すもの・`.gitignore` へ入れるものを 1 件ずつ決める
4. 決めた理由を PR 本文へ書く

## 受入条件

- [ ] `system-spec/$O` / `system-spec/tr.txt` / `.dev-graph/tmp/*` / `scratch-state.json` の各々について、残すか消すかが決まっている
- [ ] 残すものには、なぜ残すかが書かれている
- [ ] `git status --porcelain` の未追跡行が、意図したものだけになる

## 検証方法

- 自動検証: `git status --porcelain`
- 手動検証: 残す判断をしたファイルについて、次の作業者が理由を読めるか確かめる
- 証跡: PR 本文の判断一覧

## リスクとロールバック

- リスク: 生成物を残置と誤認して消すと、作り直せない情報が失われる
- ロールバック: 消す前に中身を PR 本文へ記録しておけば、作り直せる

## Handoff

- 実装 route: human。次に利用するノード: なし
