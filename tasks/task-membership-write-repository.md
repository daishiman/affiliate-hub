---
graph_node_id: "task-membership-write-repository"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "security"
tags: ["security","identity","persistence"]
priority: "high"
start_date: null
target_date: null
iteration: null
title: "担当者の登録を書く側が見本のままで、招待を画面から出せない"
owners: ["daishiman"]
created_at: "2026-08-18T05:30:00Z"
updated_at: "2026-08-22T00:00:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["src","tests"]
purpose: null
goal: null
mvp_alignment: {"background":"ログインの導入で、権限を引く側だけを本物の登録へ差し替えた。書く側は見本のまま残っている","mvp_fit":"enabling","purpose":"招待の追加・役割の変更・担当の取り消しを、画面から保存できるようにする","rationale":"読み取りを先に本物へ差し替えたのは、そこが見本のままだとログインが成立しても全員が見本の役割で動くため。書き込みはドメインの型に招待アドレスを足す変更を伴い、幅が別物になる"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-membership-write-repository.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-18T05:30:00Z","origin_kind":"manual","source_digest":null,"source_path":"src/infrastructure/identity/membership-reader.ts","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "ログイン導入(ah-361)で読み取り側だけを本物にした結果、書き込み側の見本が残った"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-membership-write-repository.md","confidence":0.9}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":"2026-08-22T00:00:00Z","evidence_refs":["src/infrastructure/persistence/d1/membership-repository.ts","docs/product/setup-tasks.md","docs/product/first-owner-row.md"],"policy":"manual","reconciled_at":"2026-08-22T00:00:00Z","source":"manual","status":"done"}
implementation_readiness: {"checked_at":null,"missing_sections":[],"status":"incomplete"}
---

# 目的

**担当者の登録を「書く側」を、見本から本物の保存先（D1 の `memberships`）へ移す。**
招待を出す・役割を変える・担当を外すが、画面からできる状態にする。

## 背景

ログインの導入（`ah-361`）で差し替えたのは**読み取り側だけ**である。

| 向き | いまの状態 | 実装 |
| --- | --- | --- |
| 権限を**引く**（ログインした人の役割） | **本物**（D1） | `src/infrastructure/identity/membership-reader.ts` |
| 担当者を**書く**（招待・役割の変更・取り消し） | **本物**（D1、2026-08-21） | `src/infrastructure/persistence/d1/membership-repository.ts` |
| いまの担当者数（容量） | **本物**（D1、2026-08-22） | `MembershipRepositoryPort.countCurrent`。解除済みは数えない |

読み取りを先にしたのは、**そこが見本のままだとログインが成立しても全員が見本の役割で動く**ためである。
順番はこれで正しい。ただし、書く側が見本のままなので次の状態になっている。

- `/admin/settings` の担当者管理で招待を足しても、**保存されない**
- 入ってよい人の行は、いま **seed か手作業**でしか作れない

## 入力と前提条件

- `memberships` は招待をアドレスで持つ形になっている
  （`invited_email` が必須、`user_id` は初回ログインまで空。`drizzle/0015_ambitious_starhawk.sql`）
- 入ってよい人は**必ず、入る前に行がある**。「最初に入った人を管理者にする」特例は置かない
  （置くと、その抜け道は認証が入ったあとも残る）

## 出力と成果物

1. ドメインの `Membership` 型へ**招待アドレス**を足す（いまは `userId` しか持たない）
2. `MembershipRepositoryPort.save` の D1 実装
3. `/admin/settings` の担当者管理を、その実装へつなぐ
4. 所有者の最初の 1 行を作る道（seed または 1 回きりの投入手順）

**`AUTH_ALLOWED_EMAILS`（名簿）と `memberships`（招待）は別物である。**
名簿は「Google の確認を通ってよいか」、招待は「どの作業場所の何の役か」。
片方だけでは入れない。この 2 段を 1 つにまとめない
（まとめると、環境変数を書き換えるだけで権限が変わる状態になる）。

## 依存関係

`ah-361`（ログインの導入）。招待の行が無いと誰も入れないため、**鍵の登録より先に**
所有者の 1 行が要る（4 番）。1〜3 は鍵の登録と並行してよい。

## 実装対象

- `src/domain/identity/`（`Membership` 型）
- `src/infrastructure/persistence/d1/`（`save` の実装）
- `src/infrastructure/composition.ts`（差し替えの 1 行）
- `src/app/admin/settings/`（担当者管理の画面）

## Write scope と競合制約

`src/domain/identity/`、`src/infrastructure/`、`src/app/admin/settings/`。

## GitHub publication

`local_only`。

## 実行手順

1. `Membership` に招待アドレスを足し、見本側も同じ形に揃える
2. D1 の `save` を書く（招待の追加・役割の変更・取り消しの 3 つ）
3. 台帳（`docs/product/stub-ledger.md`）から担当者の登録を外す
4. 所有者の 1 行を投入し、実際にログインして役割が効くことを見る

## 受入条件

- `/admin/settings` から招待したアドレスの行が D1 に残る
- そのアドレスで初めてログインした人の `user_id` が埋まり、役割が効く
- 担当を外した人が、次のログインで入れなくなる
- **招待の無いアドレスは、名簿に載っていても入れない**（2 段のまま）

## 検証方法

`pnpm run preview` で、招待 → ログイン → 役割の確認 → 取り消し → 再ログインを 1 周する。

## リスクとロールバック

危ないのは、**画面から書けないことを理由に「最初の人を管理者にする」処理を足す**ことである。
それを足すと、招待をアドレスで持つ設計の意味が消える
（誰でも最初の 1 人になれる口が、認証が入ったあとも残る）。
所有者の 1 行は seed か手作業で入れる。

## Handoff

読み取り側（`membership-reader.ts`）は**触らない**。あちらは招待しただけの行
（`user_id` が空）を権限として渡さないことを検査で固定してある。

## 規範

- `src/infrastructure/identity/membership-reader.ts` 冒頭（読み書きを分けた理由）
- `src/infrastructure/identity/session-issuer.ts` 冒頭（招待をアドレスで持つ理由）
- `docs/product/stub-ledger.md`（見本のまま残っているものの台帳）
