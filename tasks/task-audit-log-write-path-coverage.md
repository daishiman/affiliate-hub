---
graph_node_id: "task-audit-log-write-path-coverage"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "security"
tags: ["audit-log","compliance","port-wiring"]
priority: "high"
start_date: null
target_date: null
iteration: null
title: "書き込みの入口 20 件が操作の記録へ届いていない"
owners: ["daishiman"]
created_at: "2026-08-18T08:00:00Z"
updated_at: "2026-08-18T08:00:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["src","docs","tests"]
purpose: null
goal: null
mvp_alignment: {"background":"port-wiring の 2 つ目の検査で、書き込みの入口 21 件のうち記録へ届いているのは 3 件（記事の承認・段階の移動・生成 AI の鍵）だけと実測された。公開・配信の予約・成果の調整・リンクの取り込み・サイト作成は 1 件も記録されない","mvp_fit":"enabling","purpose":"運営者の書き込み操作を、誰がいつ行ったかとして残るようにする。記録の要らない読者の操作・計測は理由つきの除外へ移す","rationale":"入口の門が入り、身元が見本ではなく実在の担当者になった。記録する相手が実在して初めて「誰がやったか」が意味を持つ。門より先にやると見本の身元しか残らなかった"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-audit-log-write-path-coverage.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-18T08:00:00Z","origin_kind":"manual","source_digest":null,"source_path":"docs/product/port-wiring-report.md","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "既存の検査が出した実測一覧を塞ぐ作業で、新機能ではない"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-audit-log-write-path-coverage.md","confidence":0.9}]
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

運営者が行った書き込み操作を、**誰がいつ何をしたか**として残るようにする。
記録が要らないもの（読者の操作・自動の計測）は、理由つきの除外へ移して
数から外す。**上限を上げて緑にすることはしない。**

## 背景

`node scripts/port-wiring.mjs` の 2 つ目の検査が、
**書き込みの入口 21 件のうち記録へ届いているのは 3 件だけ**と実測した
（記事の承認・段階の移動・生成 AI の鍵の管理）。
残り 20 件は 1 行も記録を残さない。

この形は「口が塞がっている」のではなく「**一部の経路からしか通っていない**」。
`AuditLogPort.append` は呼ばれているので、手続き単位の総ざらいでは永久に緑になる。

順番として、ここは入口の門（`ah-5lo` / `ah-2ro`）の**後**でなければ意味が無い。
門より先に記録を足すと、残るのは見本の身元（`u_sample`）だけになる。

## 入力と前提条件

- `docs/product/port-wiring-report.md` の「書き込みなのに操作の記録へ届いていない入口」（自動生成の 20 件）
- `quality-gates.config.mjs` の `PORT_WIRING_MAX_UNRECORDED` / `PORT_WIRING_MAX_WRITE_EXCLUSIONS`
- `src/domain/compliance/audit-log.ts` の `AuditAction`（現在 17 語）
- `src/application/usecases/content/manage-content.ts` の `record()`（既存の書き方の見本）

## 出力と成果物

1. 読者の操作・自動の計測を、`docs/product/port-wiring.md` へ理由つきで除外登録する
2. 運営者の書き込みへ記録を足す。**取り返しがつかないものから順に**
   （公開 / 配信の予約・変更・取り消し / 外部連携の鍵 / サイト作成 / 成果の調整）
3. 足りない `AuditAction` の語彙を増やす（配信の予約、外部連携の鍵、成果の調整、サイト作成）
4. 除外と上限は**同じ変更の中で**動かす（片方だけ動かすと合計が増える）

## 依存関係

`ah-2ro`（同一サイトの身元）・入口の門（済）。
`ah-dao`（変更操作を `signedInActor()` へ）は並行して進めてよい。

## 実装対象

- `src/domain/compliance/audit-log.ts`（語彙）
- `src/application/usecases/` の該当する入口
- `docs/product/port-wiring.md`（除外の登録簿）
- `quality-gates.config.mjs`（上限）

## Write scope と競合制約

`src/application/usecases/`・`src/domain/compliance/`・`docs/product/`・`tests/`。
`scripts/port-wiring.mjs` は**触らない**（検査そのものを変えて数を動かさない）。

## GitHub publication

`local_only`。

## 実行手順

1. 20 件を「記録が要る / 要らない」で精査する。要らない理由は**一本の筋**で書く
   （読者の操作である・計測である）。書けないものは要る側に倒す
2. 除外を `docs/product/port-wiring.md` へ登録し、同じ変更で上限を下げる
3. 記録を足す。順は**取り返しがつかないもの**から
4. 各追加で「記録に失敗したら操作を成功として返さない」を守る
   （既存の `record()` と同じ扱い。断り文に**何が済んで何が残っているか**を書く）
5. 記録は**保存の後**に書く。先に書くと、保存が落ちたときに
   「起きていない操作」の証拠が残る

## 受入条件

- `PORT_WIRING_MAX_UNRECORDED` が実測とともに下がっている（上げていない）
- 除外はすべて理由つきで、理由が「読者の操作」「自動の計測」のどちらかに当たる
- 追加した記録が、**保存の後**に書かれている
- 記録に失敗したとき、操作が成功として返らない
- 赤を実測している（記録の呼び出しを 1 つ外すと、その入口を名指しで落ちる）

## 検証方法

```bash
node scripts/port-wiring.mjs      # 件数が下がることを見る
pnpm vitest run tests/application # 追加した記録のテスト
```

そのうえで、追加した記録を 1 つ外して赤になることを実測する。

## リスクとロールバック

**語彙を増やしすぎるのがいちばん危ない。** 操作 1 つに 1 語を当てると、
後から一覧を読む人が「同じことの別名」を区別できなくなる。
既存の 17 語で言えるものは既存語を使う。

記録の追加で操作が失敗しやすくなる（記録に失敗すると操作も失敗する）。
これは意図した設計だが、保存先が不安定な環境では体感が悪くなる。
戻すときは、足した `record()` 呼び出しを外せば元の挙動に戻る。

## Handoff

**「20 件を今日全部塞ぐ」を目標にしない。** この検査の目的は
偶然に頼るのをやめることで、数を 0 にすることではない。
1 件ずつ、記録が要る理由を書きながら減らす。
除外へ逃げたくなったら、そこが判断の分かれ目である。
