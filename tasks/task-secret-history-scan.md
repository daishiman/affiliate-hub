---
graph_node_id: "task-secret-history-scan"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "platform"
tags: ["security","secrets"]
priority: "medium"
start_date: null
target_date: null
iteration: null
title: "秘密の値が過去の履歴に入っていないかを、1 度走査する"
owners: ["daishiman"]
created_at: "2026-08-18T09:00:00Z"
updated_at: "2026-08-18T09:00:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["tests","docs"]
purpose: null
goal: null
mvp_alignment: {"background":"tests/architecture/secrets-not-in-repo.test.ts は『これから入るのを止める』検査で、いま git が追跡しているものだけを見る。過去の履歴は見ない","mvp_fit":"enabling","purpose":"履歴に秘密が入っていないことを 1 度だけ実測し、結果を記録する","rationale":"入口を塞いだ検査が緑であることを『過去にも漏らしていない』と読み違えると、鍵の作り直しが必要な事態を見落とす"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-secret-history-scan.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-18T09:00:00Z","origin_kind":"manual","source_digest":null,"source_path":"tests/architecture/secrets-not-in-repo.test.ts","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "既存の検査が見ていない範囲を、別の手当てとして切り出したもの"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-secret-history-scan.md","confidence":0.9}]
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

**秘密の値が過去のコミットに入っていないかを 1 度走査し、結果を残す。**

## 背景

`tests/architecture/secrets-not-in-repo.test.ts` は
**「これから入るのを止める」検査**であって、
**「すでに履歴にあるものを見つける」検査ではない**。
見ているのは、いま git が追跡しているファイルだけである。

一度コミットされた値は、作業ツリーから消しても履歴に残る。
つまり**この検査が緑でも「過去に漏らしていない」ことにはならない**。
両者は同じ「秘密が入っていない」という言葉で語られるので、
書いておかないと片方の緑がもう片方の証拠として読まれる。

## 入力と前提条件

- 走査の対象は `git log --all` が届く全リビジョン
- 判定の形は既存の検査が持っているもの（既知の発行元の形＋名前つきの代入）を再利用する。
  **形を新しく考え直さない**。2 つの物差しができると、片方だけ緩む

## 出力と成果物

1. 走査を 1 度実行し、当たりが有ったか無かったかの実測
2. 当たりが有った場合は、**その値の作り直し**（履歴の書き換えより先。
   書き換えても、それまでに clone した人の手元には残っている）
3. 結果と実施日の記録（当たり 0 件でも書く。書かないと次に同じ走査をやり直す）

## 依存関係

なし。ただし**当たりが有った場合の鍵の作り直しは利用者ご本人の作業**である。

## 実装対象

- 走査の手順（1 度きりの実行でよく、毎回の門にはしない）
- 結果の記録先

## Write scope と競合制約

`tests/architecture/secrets-not-in-repo.test.ts` の判定の形は変えない（読むだけ）。

## GitHub publication

`local_only`。

## 実行手順

1. 既存の検査から判定の形を取り出せる状態にする
2. 全リビジョンの追加行に対して当てる
3. 当たりを一覧にし、**値そのものは記録に書かない**（記録が新しい漏れになる）
4. 当たりが有れば利用者へ「どの発行元の鍵を作り直すか」だけを伝える

## 受入条件

- 全リビジョンを走査したことが、実行した記録から分かる
- 当たり 0 件のときも、実施日つきで記録が残る
- 記録の中に秘密の値そのものが 1 つも入っていない

## 検証方法

走査の対象リビジョン数が `git rev-list --all --count` と一致すること。

## リスクとロールバック

**当たりを見つけたときに、履歴の書き換えを先にやらない。**
書き換えは共同作業者の手元と食い違いを起こすうえ、
すでに配られた値は消えない。**先に作り直す**。

## Handoff

`ah-44d` の作業中、既存の検査の見ている範囲を冒頭 1 行で明示した際に切り出した。

## 規範

- `tests/architecture/secrets-not-in-repo.test.ts`
- `docs/product/backlog.md`
