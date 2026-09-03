# System task overlay: 管理画面 UI/UX 全面改善の要求ベースライン確定

## Machine-readable registration fields

- feature_package_id: feature-package/feat-uiux-overhaul
- owners: ["daishiman"]
- tags: ["p01", "feat-uiux-overhaul"]
- related_nodes: []
- parent_feature: feat-uiux-overhaul
- phase_ref: P01
- classification: confidence=1.0; reason=feat-uiux-overhaul の P01 lifecycle 責務への確定写像; candidate=tasks/feat-uiux-overhaul/sys-uiux-overhaul-p01.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

feat-uiux-overhaul の10件の受け入れ条件を、実装着手前に一意で検証可能な要求ベースラインへ確定し、既存 src/app/admin 配下の全画面を単一用途の観点で棚卸しし、各画面で残す情報と落とす情報を情報優先度マップとして機械可読に固定した状態を成立させる。

## 背景

既存の管理画面は1画面に複数タスクが混在し、タスク遂行に不要な説明文が常時表示されているため認知負荷が高い。system-spec/ui-ux.md の情報設計契約と docs/spec/09-UIテーマ仕様.md の密度・余白規則を要求として接地させ、以降の設計・実装が判断根拠を持てるようにする。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-uiux-overhaul, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, architecture/arch-two-layer-platform.md
- Entry gate: 直前 phase task の depends_on 完了 (intra-feature dependency)
- P01 upstream entry gate: N/A: intra-feature depends_on gate
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: applicable; 既存 src/app/admin 配下の全画面を単一用途の観点で棚卸しし分割単位を要求として確定する
- Backend: applicable; 管理対象4種の CRUD に必要なユースケース境界を要求として確定する
- API: applicable; 一覧/作成/更新/削除と投稿状態参照に必要な API 契約の要求を確定する
- Data: applicable; 投稿状態・ブログ・記事・商品・SNS投稿の参照モデル要求を確定する
- Infrastructure: N/A: 既存 Cloudflare Workers/D1/R2 デプロイ単位を変更しない
- Security: applicable; 管理操作の権限要求を既存 RBAC 契約の範囲で確定する
- Quality: applicable; 受入10件を検証可能な形へ書き下すことを完了条件とする
- Documentation: applicable; 要求ベースライン文書そのものが本 phase の成果物である
- Operations: N/A: 運用手順は P12 が所有する

## Architecture and deploy unit

- Architecture decisions: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存管理画面の共通部品への移行は P08 が所有する

## 成果物

- Produced artifacts: docs/spec/feat-uiux-overhaul/requirements-baseline.md (受入10件の検証可能化), docs/spec/feat-uiux-overhaul/screen-inventory.md (既存 src/app/admin 全画面の用途棚卸しと単一用途分割案), docs/spec/feat-uiux-overhaul/information-priority-map.json (画面別に残す情報・落とす情報・加工する情報の優先度束)
- Consumed artifacts: features/feat-uiux-overhaul.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md
- Write scope/touches: docs/spec/feat-uiux-overhaul/requirements-baseline.md, docs/spec/feat-uiux-overhaul/screen-inventory.md, docs/spec/feat-uiux-overhaul/information-priority-map.json

## Tracker publication and completion

> 本specは`tracker_binding_intent`とGitHub公開intentだけを宣言し、永続bindingの解決・起票・完了収束はdev-graphが所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-UIUX-OVERHAUL-P01; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-plannerはintentのみを宣言し、dev-graphがtracker mutationとreconciliationを行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-UIUX-OVERHAUL-P01; system-dev-plannerは事前割当を行わない
- Worktree lease: claim SYS-UIUX-OVERHAUL-P01 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on=[] の完了 + resource_scope (feat-uiux-overhaul 配下) と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- feat-uiux-overhaul の scope_out (認証・Workspace基盤, 記事生成エンジン本体, SNS実配信の実行系, 文章品質規則そのもの, 読者向け公開面) に該当する変更
- write_scope 外のパスへの変更

## テスト戦略

- テストレベル選定: 単体: 共通コンポーネントとユースケース関数の単体テストを緑化する。結合: 画面からAPI、APIからデータ参照までの結合テストを緑化する。境界値: サイドバー折りたたみ時の識別性・空一覧・権限なしロールの境界テストを緑化する。回帰: 既存テストスイートを0件失敗のまま維持する。
- カバレッジ目標: 既定 80% を新規実装コード (src/presentation/ui, src/app/api/admin, src/application) に適用する。
- 層別方針: フロントエンド: behavior ベースでサイドバー開閉・画面遷移・情報表示の振る舞いを検証する。バックエンド/API/データ: API 契約 + ロジック単体 + データ参照結合で CRUD と投稿状態反映を検証する。
- 保守性制約: pixel 位置依存・DOM 構造依存のテストを禁止し、可視ラベル・アクセシブル名・レスポンスステータス・返却データの属性など振る舞い検証に限定する。

## Verification and evidence

- Automated commands: `pnpm run preview` (Workers ランタイム, localhost:8787) 上で P01 に対応する検証コマンドを実行する
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-uiux-overhaul` (本 package の C12 決定論検証を世代非依存に再実行する)
- Required evidence: P01 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: feat-uiux-overhaul の10件の受け入れ条件を、実装着手前に一意で検証可能な要求ベースラインへ確定し、既存 src/app/admin 配下の全画面を単一用途の観点で棚卸しし、各画面で残す情報と落とす情報を情報優先度マップとして機械可読に固定した状態を成立させる。
- Generic execution prompt: feat-uiux-overhaul の goal (全画面が単一用途に分割され、管理対象に基本管理機能(一覧・新規作成・編集・削除)とそのAPIが揃い、カード間隔・文章量・サイドバーが最適化され、各サイト・SNSへの投稿状態が画面へ反映され、1商品から複数ブログへコンセプト別文章を作成でき、X/Facebook等の新SNSをプロバイダ追加のみで拡張できる構成になっている) と本 task の 前提条件/成果物/write_scope/スコープ外 を渡し、実装手段は固定せず P01 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件 (本 task の acceptance)・カバレッジ目標 (既定80%) green・既存テストの回帰0件・Required evidence の証跡取得・write_scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装から独立評価 (P03/P09/P10相当) へ渡し、findingをGeneric execution promptへ反映して再実行し、rubric verdict=PASSまで反復する。上限到達時はfail-closedで停止しP01から現phaseへ差し戻す
- P13 spec/architecture writeback: N/A: P13 owns writeback

## Rollout and rollback

- Rollout: P01 の成果物を write_scope 内へ適用し、次phaseへ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P01 の write_scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: 受入10件に関わる評価がconfirmed + evaluation pass + readiness complete + promoted digest + dev-graph registration complete

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-uiux-overhaul
- Phase doc: system-plan-phase-names.md#P01
- Dependencies: N/A: P01 は intra-feature 依存を持たない起点 task である
