---
graph_node_id: "task-nav-link-zero-hit-target"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "frontend"
tags: ["a11y","e2e","follow-up"]
priority: "high"
start_date: null
target_date: null
iteration: null
title: "案内リンクの実寸 0x0px を解く (E2E 94 件)"
owners: ["daishiman"]
created_at: "2026-09-05T00:00:00Z"
updated_at: "2026-09-05T00:00:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["src/presentation/ui","tests/e2e/pending-hit-targets.spec.ts"]
purpose: null
goal: null
mvp_alignment: {"background":"pending-hit-targets が a.navLink について「宣言44.0px / 実寸0.0×0.0px」を 2227 行報告している。0x0 は小さいのではなく場所を持っていない状態で、下限の検査が働いていない","mvp_fit":"deferred","purpose":"押せる大きさの宣言と実物を一致させ、hit-target 検査を本来の役目へ戻す","rationale":"下限 44px を下げれば緑になるが、それは指で押せるかを見張る役目を捨てること。実装と検査のどちらが誤りかを決める必要がある"}
scope_in: ["a.navLink が矩形を持たない条件の特定","実装か検査かの判断と修正"]
scope_out: ["下限 44px を下げること"]
acceptance: ["a.navLink の実寸が 0x0px でなくなる、または畳まれた状態を測らない線引きが理由付きで書かれている","下限 44px を下げていない","pending-hit-targets.spec.ts の 94 件が 0 件になる"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-nav-link-zero-hit-target.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":null,"origin_kind":"manual","source_digest":null,"source_path":null,"source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "standalone follow-up task filed from the P08 e2e run"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-nav-link-zero-hit-target.md","confidence":0.9}]
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

管理画面の案内リンクが「宣言では 44px、実寸では 0×0px」になっている状態を解き、
押せる大きさの宣言が実物と一致するようにする。

## 背景

`pnpm run test:e2e` の `pending-hit-targets.spec.ts` が **94 件**赤い。実文言:

```
/admin/sites/home-office-desk/appearance a.ui-module__HC55gq__navLink「ホーム」
  宣言44.0px / 実寸0.0×0.0px < 44.0px
```

同じ形が 2227 行ある。`a.navLink` は sidebar の案内リンクで、管理画面の全ページに
現れるため、1 つの原因が全ページ分の行数になっている。

**0×0px は「小さい」ではなく「場所を持っていない」**である。`display:none`、
畳まれた sidebar、あるいは親が高さ 0——いずれかで矩形が消えている。押せる大きさの
下限を宣言したのに実物が測れない状態なので、この検査は本来の役目
（指で押せるか）を果たしていない。

`app-shell.tsx` は `data-nav-collapsed={navCollapsed}` を持つ。畳まれた状態で
測っているなら、**検査側が開いてから測るべき**か、**畳まれた状態のリンクは
宣言の対象外とすべき**かのどちらかで、それは実装を見ないと決まらない。

## 入力と前提条件

- 入力: `tests/e2e/pending-hit-targets.spec.ts` の 94 件の指摘と、そこに出る route/class/文言
- 前提: **下限（44px）を下げて緑にしない。** 44px は指で押せる大きさの根拠であり、
  実物が測れないことの言い訳にしない

## 出力と成果物

- 更新対象: `src/presentation/ui/` の sidebar 周り、または
  `tests/e2e/pending-hit-targets.spec.ts` の測り方（どちらかは調査後に決まる）
- 期待: 宣言した全リンクが実寸を持ち、44px 以上である

## 依存関係

- `depends_on`: なし
- ブロッカー: なし

## 実装対象

- Frontend: sidebar の案内リンクが矩形を持つ条件を特定する
- Backend/API: N/A
- Database/Data: N/A
- Infrastructure: N/A
- Security/Privacy: N/A
- Documentation: 「畳まれた状態をどう扱うか」の線引きをコメントに残す

## Write scope と競合制約

- `touches`: src/presentation/ui tests/e2e/pending-hit-targets.spec.ts
- 排他資源: なし
- 並列実行条件: `app-shell.tsx` を触る task（`task-skip-link-duplication-app-shell`）と同時に走らせない
- branch: devgraph/task-nav-link-zero-hit-target
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
- PR linkage requirement: 本文に Beads ID と `dev-graph: task-nav-link-zero-hit-target` を書く。base は `dev`
- Closed without merge: keep_active
- Local reconciliation: 手動 (`bd-bridge.py --op close --reason ...`)

## status の意味論 (二重正本の禁止)

frontmatter の `status` は文書ライフサイクルのみを表す。実行状態 (未着手・進行中・完了) の正本は
`completion_evidence` と `beads_linkage` であり、この本文へ書き写さない。

## 実行手順

1. `/admin/sites/home-office-desk/appearance` を開き、`a.navLink` の
   `getBoundingClientRect()` が 0 になる条件を実際に見る
2. `data-nav-collapsed` の値と矩形の有無を突き合わせる
3. **どちらの誤りかを決める** —
   (a) 実装の誤り: 開いているはずの sidebar が場所を持っていない → 実装を直す
   (b) 検査の誤り: 畳まれた状態で測っている → 測る前に開くか、対象から外す
4. 決めた側を直し、`pnpm run test:e2e` で 94 件が消えることを確かめる

## 受入条件

- [ ] `a.navLink` の実寸が 0×0px でなくなる、または「畳まれた状態は測らない」線引きが
      理由付きでコメントに書かれている
- [ ] 下限 44px を下げていない
- [ ] `pending-hit-targets.spec.ts` の 94 件が 0 件になる

## 検証方法

- 自動検証: `pnpm run test:e2e`
- 手動検証: 実際に管理画面を開き、sidebar の案内リンクを指で押せる大きさか見る
- 証跡: E2E の実行ログ（修正前 94 件 → 修正後 0 件）

## リスクとロールバック

- リスク: 「測れないから対象外」とする逃げ方を選ぶと、押せない案内リンクが
  検査を素通りするようになる。対象外にするなら**なぜ測らなくてよいか**を書く
- ロールバック: revert で戻る

## Handoff

- 実装 route: human。次に利用するノード: なし
