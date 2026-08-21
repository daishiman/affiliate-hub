---
graph_node_id: "task-audit-actions-without-emitters"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "quality"
tags: ["quality","audit","compliance"]
priority: "high"
start_date: null
target_date: null
iteration: null
title: "記録の語 9 つが出す場所を持っていない（AuditAction 28 語のうち実処理は 19 語）"
owners: ["daishiman"]
created_at: "2026-08-18T12:20:00Z"
updated_at: "2026-08-18T12:20:00Z"
status: "draft"
depends_on: []
related_nodes: ["task-test-type-traits-remaining"]
resource_scope: ["src","tests","docs"]
purpose: null
goal: null
mvp_alignment: {"background":"残課題 69 で export.performed が語だけあって出す場所が無いと分かり、調べたら実際に穴だった（記事の本文を人へ丸ごと渡すのに記録が 1 件も残らない）。同じ形が 9 語残っている","mvp_fit":"direct","purpose":"語だけがあって出す場所が無い記録を無くす","rationale":"記録の語が並んでいると、次に数える人はその操作が記録されていると思う。export.performed のときは実際に持ち出しの穴だった"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-audit-actions-without-emitters.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-18T12:20:00Z","origin_kind":"manual","source_digest":null,"source_path":"docs/product/backlog.md","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "残課題 69（記録の義務を性質へ結ぶ）の作業中に AuditAction の 28 語を src/ と突き合わせて洗い出したもの。backlog.md の項目 74"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-audit-actions-without-emitters.md","confidence":0.9}]
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

`AuditAction` の 28 語のうち、**実処理から出しているのは 19 語**である。
残り 9 語について、1 語ずつ「要件がその記録を求めているか」を確かめ、
**出す**か **union から消す**かのどちらかに決める。

## 背景

残課題 69 で `audit-log` を性質へ結ぶために 28 語を `src/` と突き合わせた。
そのとき `export.performed` が**語だけあって出す場所が無い**ことに気づき、
調べたら実際に穴だった——`createExportManualDraftUseCase` は記事の本文を
人へ丸ごと渡すのに、記録を 1 件も残していなかった。

**語だけがあって出す場所が無いのは、そのとき見つけた穴と同じ形である。**

## 入力と前提条件

- `src/domain/compliance.ts` の `AuditAction`（28 語）
- `docs/spec/02-補充仕様-ギャップと追加要件.md:119`（必須記録対象 6 つ）
- 残課題 69 の計測結果: 実処理 19 語 / 見本のみ 2 語 / 出す場所無し 7 語

## 出力と成果物

- 9 語のそれぞれについて、**出す場所を作った**か、**union から消した**か、
  **機能が無いので待つと決めて理由を書いた**かのどれか
- 出した語には、記録が実際に残ることを見るテスト（`@types audit-log`）

## 依存関係

無し。ただし `member.role_changed` は残課題 62（権限変更の機能そのもの）が先。

## 実装対象

- `src/application/usecases/**`（記録を出す場所）
- `src/domain/compliance.ts`（消す場合の union）
- `tests/application/**`（記録が残ることの検査）

## Write scope と競合制約

`src/application/usecases/**` と `src/domain/compliance.ts`。
union を削ると**画面の記録一覧の表示側**（`AUDIT_ACTION_LABEL` 相当）に波及するため、
表示側の正本を同時に触る作業と並行しない。

## GitHub publication

`local_only`。

## 対象（2 段に分かれる）

### 見本データの中だけ 2 語

`content.created` / `ranking_model.changed`。
`src/infrastructure/persistence/sample/settings-sample-repository.ts` にしか無い。

**画面には記録が並ぶのに、その行を作った操作が存在しない。**
見本を消した時点で 0 件になる。ここを先に見る。

### 出す場所がどこにも無い 7 語

`connector.connected` / `connector.disconnected` / `content.corrected` /
`content.unpublished` / `disclosure.changed` / `member.role_changed` /
`policy_rule.changed`。

さらに 2 つに分かれる。

- **機能がまだ無いもの**: `member.role_changed`（残課題 62）、`connector.*`（ASP 接続がスタブ）
- **機能はあるのに出していないもの**: `content.unpublished`。取り下げは
  `content.state_changed` に混ざっており、
  `src/application/usecases/content/manage-content.ts:668` のコメントが自ら残課題と書いている

## 実行手順

**まとめて足さない。** 1 語ずつ、要件がその記録を求めているかを確かめてから出す。
求めていない語は union から**消す**ほうを選ぶ。
語が残っていると、次に数える人が同じ計測をやり直すことになる。

判断の根拠は仕様書 §7 の必須記録対象 6 つ
（公開 / 削除 / リンク差し替え / 権限変更 / 成果データ修正 / エクスポート）と、
要件文が記録を求めている行に置く。**実装の現状から義務を逆算しない。**

## 受入条件

- `AuditAction` の全語について、実処理から出す場所があるか、
  無い理由が書かれているかのどちらかになっている
- 見本データにしか無い語が 0 語（見本を消しても記録一覧の説明が付く状態）

## 検証方法

残課題 69 と同じ数え方をやり直し、19 / 2 / 7 の内訳が変わったことを実測する。
`action:` の直値だけでなく、**引数として渡される語**も拾う
（`integration_key.revoked` / `llm_credential.revoked` は最初の計測で取りこぼした）。

## リスクとロールバック

union から語を消すと、**過去に書かれた記録の行が読めなくなる**おそれがある。
D1 には文字列で入っているため、型から消しても行は残る。
消す前に、その語の行が本番と見本に 1 件も無いことを確かめる。
戻すのは型定義の 1 行なので、ロールバックは容易。

## Handoff

**まとめて足さない。**「機能はあるのに出していない」`content.unpublished` だけは
穴の可能性があるので先に見る。残りは機能が無いものが多く、
**出す場所を先に作ると、呼ばれないコードが増えるだけになる。**

## 規範

- `docs/product/backlog.md` 項目 74
- `docs/product/required-test-types.md` §4
- `docs/spec/02-補充仕様-ギャップと追加要件.md:119`
