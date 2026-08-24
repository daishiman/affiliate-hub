# System task overlay: 単一用途画面・共通コンポーネント・管理API・マルチSNSの実装

## Machine-readable registration fields

- feature_package_id: feature-package/feat-uiux-overhaul
- owners: ["daishiman"]
- tags: ["p05", "feat-uiux-overhaul"]
- related_nodes: []
- parent_feature: feat-uiux-overhaul
- phase_ref: P05
- classification: confidence=1.0; reason=feat-uiux-overhaul の P05 lifecycle 責務への確定写像; candidate=tasks/feat-uiux-overhaul/sys-uiux-overhaul-p05.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

アイコン付き開閉サイドバー、単一用途へ分割した管理画面、管理対象4種の CRUD 画面と API、共通コンポーネントへの集約、SNSプロバイダ抽象、ブログ別コンポーネント scaffold、1商品から複数ブログへのコンセプト別文章作成導線を実装し、P04 のテストが緑化する状態を成立させる。

## 背景

サイドバーは src/presentation/ui/templates/app-shell.tsx の ADMIN_NAV と ADMIN_NAV_GROUPS に集約されており、ここへアイコン列と折りたたみ状態を導入すれば全画面へ一括で波及する。画面固有の実装は src/presentation/ui/patterns 配下の共有部品へ寄せ、重複ハードコーディングを排除する。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-uiux-overhaul, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, architecture/arch-two-layer-platform.md
- Entry gate: 直前 phase task の depends_on 完了 (intra-feature dependency)
- P01 upstream entry gate: N/A: intra-feature depends_on gate
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: applicable; アイコン付き開閉サイドバー・単一用途画面・情報削減・カード密度と文章量の規則適用を実装する
- Backend: applicable; 管理ユースケースと投稿状態の読み取りを実装する
- API: applicable; 管理対象4種の CRUD と投稿状態参照 API を実装する
- Data: applicable; 複数ブログとコンセプト別文章の関連、投稿状態の参照を実装する
- Infrastructure: N/A: 既存 Cloudflare Workers/D1/R2 デプロイ単位を変更せずアプリケーションコードのみ変更する
- Security: applicable; 管理操作の権限判定を既存 RBAC 契約へ接続して実装する
- Quality: applicable; P04 のテストが緑化することを実装完了条件とする
- Documentation: N/A: 文書更新は P12 が所有する
- Operations: N/A: 運用手順は P12 が所有する

## Architecture and deploy unit

- Architecture decisions: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存管理画面の共通部品への移行は P08 が所有する

## 成果物

- Produced artifacts: src/presentation/ui/templates/app-shell.tsx (ADMIN_NAV へのアイコン付与・折りたたみ状態・現在地表示), src/presentation/ui/primitives/ と src/presentation/ui/patterns/ (カード密度・文章量・状態表示・一覧/フォーム/削除確認の共通部品), src/app/admin/ (単一用途へ分割した管理画面と投稿状態の反映), src/app/api/admin/ (ブログ・記事・商品・SNS投稿の一覧/作成/更新/削除と投稿状態参照API), src/application/ (管理ユースケース), src/infrastructure/sns/ (X/Facebook 等を追加実装のみで拡張できるプロバイダ実装群), scripts/scaffold-blog-components.ts (新規ブログ構築時のブログ固有コンポーネント scaffold)
- Consumed artifacts: src/presentation/ui/__tests__/, src/app/api/admin/__tests__/, docs/spec/feat-uiux-overhaul/component-contract.md, docs/spec/feat-uiux-overhaul/sns-provider-contract.md, docs/spec/feat-uiux-overhaul/blog-scaffold-contract.md, docs/spec/feat-uiux-overhaul/admin-api-contract.md
- Write scope/touches: src/presentation/ui/, src/app/admin/, src/app/api/admin/, src/application/, src/infrastructure/sns/, scripts/scaffold-blog-components.ts

## Tracker publication and completion

> 本specは`tracker_binding_intent`とGitHub公開intentだけを宣言し、永続bindingの解決・起票・完了収束はdev-graphが所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-UIUX-OVERHAUL-P05; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-plannerはintentのみを宣言し、dev-graphがtracker mutationとreconciliationを行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-UIUX-OVERHAUL-P05; system-dev-plannerは事前割当を行わない
- Worktree lease: claim SYS-UIUX-OVERHAUL-P05 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on=['P04'] の完了 + resource_scope (feat-uiux-overhaul 配下) と active lease が重複しないこと
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

- Automated commands: `pnpm run preview` (Workers ランタイム, localhost:8787) 上で P05 に対応する検証コマンドを実行する
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-uiux-overhaul` (本 package の C12 決定論検証を世代非依存に再実行する)
- Required evidence: P05 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: アイコン付き開閉サイドバー、単一用途へ分割した管理画面、管理対象4種の CRUD 画面と API、共通コンポーネントへの集約、SNSプロバイダ抽象、ブログ別コンポーネント scaffold、1商品から複数ブログへのコンセプト別文章作成導線を実装し、P04 のテストが緑化する状態を成立させる。
- Generic execution prompt: feat-uiux-overhaul の goal (全画面が単一用途に分割され、管理対象に基本管理機能(一覧・新規作成・編集・削除)とそのAPIが揃い、カード間隔・文章量・サイドバーが最適化され、各サイト・SNSへの投稿状態が画面へ反映され、1商品から複数ブログへコンセプト別文章を作成でき、X/Facebook等の新SNSをプロバイダ追加のみで拡張できる構成になっている) と本 task の 前提条件/成果物/write_scope/スコープ外 を渡し、実装手段は固定せず P05 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件 (本 task の acceptance)・カバレッジ目標 (既定80%) green・既存テストの回帰0件・Required evidence の証跡取得・write_scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装から独立評価 (P03/P09/P10相当) へ渡し、findingをGeneric execution promptへ反映して再実行し、rubric verdict=PASSまで反復する。上限到達時はfail-closedで停止しP01から現phaseへ差し戻す
- P13 spec/architecture writeback: N/A: P13 owns writeback

## Rollout and rollback

- Rollout: P05 の成果物を write_scope 内へ適用し、次phaseへ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P05 の write_scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: 受入10件に関わる評価がconfirmed + evaluation pass + readiness complete + promoted digest + dev-graph registration complete

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-uiux-overhaul
- Phase doc: system-plan-phase-names.md#P05
- Dependencies: SYS-UIUX-OVERHAUL-P04
