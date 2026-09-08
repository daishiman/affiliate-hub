# 実装要件定義書: feat-feedback-capture-self-exclusion (改善要望の写しから送信 UI 自身を外す)

> 本書は dev-graph `requirements` verb が確定仕様 (system-spec) と昇格済み feature execution package から導出した実装要件である。実装コードは含まない。実装は `task-graph` build へ handoff する。

## スナップショット

- graph snapshot digest: `sha256:881715642300f0e307126ef9d297f1db1489e4720d418bae0eb709c9d1abef87`
- graph revision: 353
- feature package: `feature-package/feat-feedback-capture-self-exclusion`
- promoted generation digest: `sha256:892cd5611c443a5f90b97047a9542489c44be963ff4d775c30b640e7aca40b7d`
- promoted generation path: `.dev-graph/published/generations/feature-package-feat-feedback-capture-self-exclusion/892cd5611c443a5f90b97047a9542489c44be963ff4d775c30b640e7aca40b7d`
- handoff target: `task-graph`
- emitted_at: 2026-08-30T13:42:29Z

## 目的と到達状態

- 目的: 改善要望に添える画面の写しから、送信モーダルと起動ボタン自身を外し、利用者が本当に伝えたい箇所が写るようにする
- 到達状態: 改善ボタンを押して撮られた写しに送信 UI が 1 画素も写らず、撮り直しでも同じ規則が効き、写しが撮れない環境でも送信 UI が待たずに開く

## スコープ

スコープ内:

- 撮影開始 (getDisplayMedia 呼出) と送信 UI の可視化を別の時点へ分ける
- 写しの取得が確定するまで送信モーダルを描かない
- 右下固定の起動ボタンを写しの対象から外す
- 撮り直し (再撮影) 経路にも同じ規則を効かせる
- 写しが撮れない・拒否・非対応のときは待たずに送信 UI を開く退避経路
- data-floating-overlay 属性を写し除外と重なり監査の共通の手掛かりにする
- 属性の付与漏れを拾う検査

スコープ外:

- 改善要望フィードバック機能そのものの無効化
- 起動ボタンの撤去
- 写しの書き込み (手書き/四角/矢印/文字/黒塗り) の仕様変更
- 一覧・詳細・払い出し経路の変更
- 写し以外の添付手段の追加

## 受入条件と実装要件の namespace

- canonical acceptance registry: `features/feat-feedback-capture-self-exclusion.md#frontmatter.acceptance`
- planner projection: `features/feat-feedback-capture-self-exclusion.context.json#/acceptance`
- canonical IDs: `A1`–`A7` (配列の 1 始まり順番)
- acceptance source digest: `sha256:56d8535f7ab28e7dc90c4ebf590db587dbe0a003f0769b2515f19536fd992630`
- feature context digest (現行 bytes): `sha256:3ff191c19523cd47fb620ed9b27ade3221ab8e58124bc02b4d3550447727da28`
- promoted package source feature digest: `sha256:3ff191c19523cd47fb620ed9b27ade3221ab8e58124bc02b4d3550447727da28` (現行 feature context digest と一致)
- derived implementation requirements: `docs/spec/feat-feedback-capture-self-exclusion/requirements-baseline.md`

本書は A1–A7 の文言を複製しない。受入の意味を確認するときは canonical ID と digest を一組で参照する。

## アーキテクチャ参照

- `arch-two-layer-platform` (architecture/arch-two-layer-platform.md)

- 仕様正本 (複製せず lineage 参照): `system-spec/frontend.md` (確定質疑 `qa-frontend-web-capture-self-occlusion`), `system-spec/ui-ux.md`

## readiness matrix

| node | kind | confirmation | evaluation | readiness | missing sections |
|---|---|---|---|---|---|
| `arch-two-layer-platform` | architecture | confirmed | pass | complete | なし |
| `feat-feedback-capture-self-exclusion` | feature | confirmed | pass | complete | なし |
| `SYS-FB-CAPTURE-EXCLUSION-P01` | task | confirmed | pass | complete | なし |
| `SYS-FB-CAPTURE-EXCLUSION-P02` | task | confirmed | pass | complete | なし |
| `SYS-FB-CAPTURE-EXCLUSION-P03` | task | confirmed | pass | complete | なし |
| `SYS-FB-CAPTURE-EXCLUSION-P04` | task | confirmed | pass | complete | なし |
| `SYS-FB-CAPTURE-EXCLUSION-P05` | task | confirmed | pass | complete | なし |
| `SYS-FB-CAPTURE-EXCLUSION-P06` | task | confirmed | pass | complete | なし |
| `SYS-FB-CAPTURE-EXCLUSION-P07` | task | confirmed | pass | complete | なし |
| `SYS-FB-CAPTURE-EXCLUSION-P08` | task | confirmed | pass | complete | なし |
| `SYS-FB-CAPTURE-EXCLUSION-P09` | task | confirmed | pass | complete | なし |
| `SYS-FB-CAPTURE-EXCLUSION-P10` | task | confirmed | pass | complete | なし |
| `SYS-FB-CAPTURE-EXCLUSION-P11` | task | confirmed | pass | complete | なし |
| `SYS-FB-CAPTURE-EXCLUSION-P12` | task | confirmed | pass | complete | なし |
| `SYS-FB-CAPTURE-EXCLUSION-P13` | task | confirmed | pass | complete | なし |

closure 15 node の readiness は全件 complete、missing_sections は 0 件である。

## 実行タスク (exact 13)

| phase | node | title | file | resource_scope |
|---|---|---|---|---|
| P01 | `SYS-FB-CAPTURE-EXCLUSION-P01` | 改善要望の写しに送信 UI が写り込む条件の要求ベースライン確定 | `tasks/feat-feedback-capture-self-exclusion/sys-fb-capture-exclusion-p01.md` | docs/spec/feat-feedback-capture-self-exclusion/requirements-baseline.md, docs/spec/feat-feedback-capture-self-exclusion/capture-timeline.md, docs/spec/feat-feedback-capture-self-exclusion/floating-overlay-inventory.json |
| P02 | `SYS-FB-CAPTURE-EXCLUSION-P02` | 撮影と送信 UI 可視化を別の時点へ分ける設計の確定 | `tasks/feat-feedback-capture-self-exclusion/sys-fb-capture-exclusion-p02.md` | docs/spec/feat-feedback-capture-self-exclusion/capture-sequence-design.md, docs/spec/feat-feedback-capture-self-exclusion/floating-overlay-contract.md |
| P03 | `SYS-FB-CAPTURE-EXCLUSION-P03` | 設計の独立レビューと退避経路の妥当性判定 | `tasks/feat-feedback-capture-self-exclusion/sys-fb-capture-exclusion-p03.md` | docs/spec/feat-feedback-capture-self-exclusion/design-review-findings.md |
| P04 | `SYS-FB-CAPTURE-EXCLUSION-P04` | 写り込み検査と退避経路のテスト設計 | `tasks/feat-feedback-capture-self-exclusion/sys-fb-capture-exclusion-p04.md` | docs/spec/feat-feedback-capture-self-exclusion/test-design.md, docs/spec/feat-feedback-capture-self-exclusion/capture-test-fixtures.md |
| P05 | `SYS-FB-CAPTURE-EXCLUSION-P05` | 撮影中だけ送信 UI を写しの対象から外す実装 | `tasks/feat-feedback-capture-self-exclusion/sys-fb-capture-exclusion-p05.md` | src/presentation/ui/patterns |
| P06 | `SYS-FB-CAPTURE-EXCLUSION-P06` | 写り込み検査と回帰テストの実行と緑化 | `tasks/feat-feedback-capture-self-exclusion/sys-fb-capture-exclusion-p06.md` | tests/ui, tests/e2e |
| P07 | `SYS-FB-CAPTURE-EXCLUSION-P07` | 受入7件の受入判定 | `tasks/feat-feedback-capture-self-exclusion/sys-fb-capture-exclusion-p07.md` | docs/spec/feat-feedback-capture-self-exclusion/acceptance-report.md |
| P08 | `SYS-FB-CAPTURE-EXCLUSION-P08` | 浮遊要素の属性統一と重なり監査との共通化 | `tasks/feat-feedback-capture-self-exclusion/sys-fb-capture-exclusion-p08.md` | src/presentation/ui/patterns, tests/e2e/app-routes.spec.ts |
| P09 | `SYS-FB-CAPTURE-EXCLUSION-P09` | 品質保証と非機能の確認 | `tasks/feat-feedback-capture-self-exclusion/sys-fb-capture-exclusion-p09.md` | docs/spec/feat-feedback-capture-self-exclusion/quality-report.md |
| P10 | `SYS-FB-CAPTURE-EXCLUSION-P10` | 最終レビューと反映漏れの判定 | `tasks/feat-feedback-capture-self-exclusion/sys-fb-capture-exclusion-p10.md` | docs/spec/feat-feedback-capture-self-exclusion/final-review.md |
| P11 | `SYS-FB-CAPTURE-EXCLUSION-P11` | 証跡の収集と保全 | `tasks/feat-feedback-capture-self-exclusion/sys-fb-capture-exclusion-p11.md` | docs/spec/feat-feedback-capture-self-exclusion/evidence |
| P12 | `SYS-FB-CAPTURE-EXCLUSION-P12` | 仕様書と運用手順の追補 | `tasks/feat-feedback-capture-self-exclusion/sys-fb-capture-exclusion-p12.md` | docs/spec/12-改善要望フィードバック仕様.md, docs/spec/feat-feedback-capture-self-exclusion/operations.md |
| P13 | `SYS-FB-CAPTURE-EXCLUSION-P13` | dev への反映と公開 | `tasks/feat-feedback-capture-self-exclusion/sys-fb-capture-exclusion-p13.md` | docs/spec/feat-feedback-capture-self-exclusion/release-notes.md, docs/spec/12-改善要望フィードバック仕様.md, system-spec/frontend.md |

## 機能内依存 (前方 DAG)

- `SYS-FB-CAPTURE-EXCLUSION-P01` ← (entry)
- `SYS-FB-CAPTURE-EXCLUSION-P02` ← `SYS-FB-CAPTURE-EXCLUSION-P01`
- `SYS-FB-CAPTURE-EXCLUSION-P03` ← `SYS-FB-CAPTURE-EXCLUSION-P02`
- `SYS-FB-CAPTURE-EXCLUSION-P04` ← `SYS-FB-CAPTURE-EXCLUSION-P03`
- `SYS-FB-CAPTURE-EXCLUSION-P05` ← `SYS-FB-CAPTURE-EXCLUSION-P04`
- `SYS-FB-CAPTURE-EXCLUSION-P06` ← `SYS-FB-CAPTURE-EXCLUSION-P05`
- `SYS-FB-CAPTURE-EXCLUSION-P07` ← `SYS-FB-CAPTURE-EXCLUSION-P06`
- `SYS-FB-CAPTURE-EXCLUSION-P08` ← `SYS-FB-CAPTURE-EXCLUSION-P07`
- `SYS-FB-CAPTURE-EXCLUSION-P09` ← `SYS-FB-CAPTURE-EXCLUSION-P08`
- `SYS-FB-CAPTURE-EXCLUSION-P10` ← `SYS-FB-CAPTURE-EXCLUSION-P09`
- `SYS-FB-CAPTURE-EXCLUSION-P11` ← `SYS-FB-CAPTURE-EXCLUSION-P10`
- `SYS-FB-CAPTURE-EXCLUSION-P12` ← `SYS-FB-CAPTURE-EXCLUSION-P11`
- `SYS-FB-CAPTURE-EXCLUSION-P13` ← `SYS-FB-CAPTURE-EXCLUSION-P12`

P01→P13 の狭義の直列連鎖であり、分岐も合流も持たない。

## 現在の lifecycle projection

- P01〜P06: graph `status=closed` / `completion_evidence.status=done`、Beads `closed`
- P07: graph `status=active` / `completion_evidence.status=open`、Beads `ah-0d2q.7=open`
- P08〜P13: graph `status=active` / `completion_evidence.status=blocked`、Beads `open`。直列 DAG の前段未完了により blocked である
- P07 の reopen 根拠: 受入報告は `overall=PARTIAL`。A1 の実キャプチャ画素は、ローカル Chromium probe が OS の画面収録境界で `NotReadableError: Could not start video source` となり未観測のため PASS にしない
- P13 の外部完了境界: dev 向け PR、CI、merge、canonical writeback は未実施。実行事実が揃うまで open/blocked を保つ

## 機能間依存 (entry gate)

- `feat-feedback-capture-self-exclusion` depends_on: `feat-improvement-feedback`
- `p01_entry_gate`: `parent_feature.depends_on` の全 node が `done|closed` であること。P01 着手時に dev-graph scheduler が派生判定し、機能間依存を task DAG へ複製しない
- 現況: `feat-improvement-feedback` は graph `status=closed` / `completion_evidence.status=done`、Beads `ah-w6y=closed` で、entry gate は満たしている
- adapter 制約: 実行対象 feature の Beads issue `ah-0d2q` は epic、上流 `ah-w6y` は task のため、Beads は epic→task の blocks edge を `epics can only block other epics, not tasks` で拒否する。機能間依存の正本は dev-graph に保ち、この投影不能は 13-phase の機能内 edge parity と分離して扱う

## 世代非依存 validator command

本 package の C12 決定論検証を再実行するコマンド:

```bash
python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py \
  --repo-root . \
  --feature-package feature-package/feat-feedback-capture-self-exclusion
```

## gate 実行結果

- C11_validate_graph_schema: `{"command": "validate-graph-schema.py --graph .dev-graph/state/graph.json --repo-root .", "exit": 0, "valid": true, "violations": 0, "implementation_readiness": "complete"}`
- C02_saved_state: `{"implementation_readiness": "complete", "evaluation_status": "pass", "confirmation_status": "confirmed", "scope": "closure 15 node", "receipt": ".dev-graph/published/generations/feature-package-feat-feedback-capture-self-exclusion/892cd5611c443a5f90b97047a9542489c44be963ff4d775c30b640e7aca40b7d/dev-graph-registration-receipt.json", "expected_count": 13, "applied_count": 13}`
- source_digest: `{"command": "validate-source-digest.py --repo-root . --registered <closure 15 node>", "checked": 15, "registered_mismatch": 0}`
- validate_system_plan: `{"command": "validate-system-plan.py --repo-root . --feature-package feature-package/feat-feedback-capture-self-exclusion", "exit": 0, "status": "pass", "violations": 0, "validated_digest": "sha256:892cd5611c443a5f90b97047a9542489c44be963ff4d775c30b640e7aca40b7d"}`

## handoff

- handoff file: `.dev-graph/handoff/task-graph/feat-feedback-capture-self-exclusion.json`
- promoted generation: `.dev-graph/published/generations/feature-package-feat-feedback-capture-self-exclusion/892cd5611c443a5f90b97047a9542489c44be963ff4d775c30b640e7aca40b7d`
- 実装コード生成: 0 件 (本 verb は要件導出まで)

## 実装着手時の不変条件

- 各 task は promoted generation の phase 別 `resource_scope` と task projection の `resource_scope` / `Write scope/touches` が指す範囲内でのみ変更する
- 改善要望フィードバック機能そのもの・起動ボタン・写しの書き込み仕様は変更しない (feature の scope_out)
- worktree lease は `dev-graph worktree claim` 経由でのみ取得し、1 task 1 branch を守る
- 押した勢い (transient activation) を失う実装 (`getDisplayMedia` の呼出を await の後ろへ動かす等) は 受入 A4 に反するため採らない
- A1 は actual capture pixels が観測されるまで未完了とし、DOM/CSS の可視性検査で代用 PASS にしない
- P13 は dev 向け PR、CI、merge、canonical writeback の実際の完了事実が揃うまで completion にしない
