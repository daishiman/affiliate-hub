# System task overlay: 開発環境へのリリースとsystem-specへの書き戻し

## Machine-readable registration fields

- feature_package_id: feature-package/feat-blog-ui-builder
- owners: ["daishiman"]
- tags: ["p13", "feat-blog-ui-builder"]
- related_nodes: []
- parent_feature: feat-blog-ui-builder
- phase_ref: P13
- classification: confidence=1.0; reason=feat-blog-ui-builder の P13 lifecycle 責務への確定写像; candidate=tasks/feat-blog-ui-builder/sys-blog-ui-builder-p13.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

本featureの成果をdevブランチ経由で開発環境へ反映し、実装で確定したテーマ実装契約・コンポーネント契約・データモデルがsystem-spec (ui-ux.md/frontend.md/database.md) へ書き戻された状態を成立させる。

## 背景

AGENTS.mdの枝の順番規約により、作業ブランチはdevブランチへPRを出す。system-specは確定章の直接編集をC11 hookとC01 writerが拒否するため、R4-reopenを経由して実装確定内容を書き戻す。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-blog-ui-builder, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/database.md, architecture/arch-two-layer-platform.md
- Entry gate: 直前 phase task の depends_on 完了 (intra-feature dependency)
- P13 upstream entry gate: SYS-BLOG-UI-BUILDER-P12 の implementation_readiness=complete
- Source pin: system-spec-harness v0.1.11 (C08 source_pin) / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: N/A: 実装自体はP05/P08で完了済みであり本phaseはリリースと書き戻しのみ行う
- Backend: N/A: 実装自体はP05で完了済みであり本phaseはリリースと書き戻しのみ行う
- API: N/A: 実装自体はP05で完了済みであり本phaseはリリースと書き戻しのみ行う
- Data: N/A: 実装自体はP05で完了済みであり本phaseはリリースと書き戻しのみ行う
- Infrastructure: applicable; `pnpm run deploy:dev` によるCloudflare Workers/D1/R2への反映を行う
- Security: N/A: 権限変更を伴わない
- Quality: applicable; リリース後の回帰0件維持が本 phase の完了条件である
- Documentation: applicable; release-report.mdとsystem-spec書き戻しが本 phase の成果物である
- Operations: applicable; PR宛先dev・マージ・デプロイの運用手順に従う

## Architecture and deploy unit

- Architecture decisions: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/database.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存 src/app/admin/sites 配下画面の新エンティティへの移行はP08が所有する

## 成果物

- Produced artifacts: docs/spec/feat-blog-ui-builder/release-report.md (PRリンク・デプロイ結果・書き戻し内容の記録); system-spec/ui-ux.md・frontend.md・database.md への実装確定内容の書き戻し (R4-reopen経由)
- Consumed artifacts: docs/spec/feat-blog-ui-builder/ui-rules.md, docs/spec/feat-blog-ui-builder/operations.md
- Write scope/touches: docs/spec/feat-blog-ui-builder/release-report.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/database.md

## Tracker publication and completion

> 本specは`tracker_binding_intent`とGitHub公開intentだけを宣言し、永続bindingの解決・起票・完了収束はdev-graphが所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-BLOG-UI-BUILDER-P13; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-plannerはintentのみを宣言し、dev-graphがtracker mutationとreconciliationを行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-BLOG-UI-BUILDER-P13; system-dev-plannerは事前割当を行わない
- Worktree lease: claim SYS-BLOG-UI-BUILDER-P13 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on の完了 + resource_scope (feat-blog-ui-builder 配下) と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- feat-blog-ui-builder の scope_out に該当する変更
- mainブランチへの直接PR (宛先は既定でdevとする)

## テスト戦略

- テストレベル選定: 単体: ユースケース関数・データモデル変換ロジックの単体テストを緑化する。結合: 画面からAPI、APIからD1永続化までの結合テストを緑化する。境界値: サイドバー折りたたみ境界・配色上書き解除時のフォールバック・固定ページ未作成時の空状態・axe-core重大違反0件境界を緑化する。回帰: 既存 tests/ 配下の全テストスイートを0件失敗のまま維持する。
- カバレッジ目標: 既定 80% を新規実装コード (src/presentation/ui, src/app/api/admin, src/application, src/infrastructure/persistence/d1) に適用する。
- 層別方針: インフラ: IaC 静的検証 + smoke でCloudflare Workers/D1/R2への反映を確認する。
- 保守性制約: pixel位置依存・DOM構造依存のテストを禁止し、可視ラベル・アクセシブル名・レスポンスステータス・返却データの属性など振る舞い検証に限定する。

## Verification and evidence

- Automated commands: `pnpm run build` (リリース前ビルド確認)
- Automated commands: `pnpm run preview` (Workersランタイムでのリリース前最終確認)
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-blog-ui-builder` (本 package の C12 決定論検証を世代非依存に再実行する)
- Required evidence: P13 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: 本featureの成果をdevブランチ経由で開発環境へ反映し、実装で確定したテーマ実装契約・コンポーネント契約・データモデルがsystem-spec (ui-ux.md/frontend.md/database.md) へ書き戻された状態を成立させる。
- Generic execution prompt: feat-blog-ui-builder の goal (テンプレートから新規ブログを作成でき、配色をブログ既定とページ単位で選べ、ヘッダー・サイドバー・フッターが常時表示され、運営者情報・全カテゴリー・サイトポリシー・プライバシーポリシー・特定商取引法に基づく表記・お問い合わせの固定ページと図解・比較などの表現ブロックを構築でき、公開面/作成/保存/管理一覧の各面でブログ×アフィリエイトの配置が一覧・逆引きできる状態になっている) と本 task の 前提条件/成果物/write_scope/スコープ外 を渡し、実装手段は固定せず P13 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件 (本 task の acceptance)・カバレッジ目標 (既定80%) green・既存テストの回帰0件・Required evidence の証跡取得・write_scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装から独立評価 (P03/P09/P10相当) へ渡し、findingをGeneric execution promptへ反映して再実行し、rubric verdict=PASSまで反復する。上限到達時はfail-closedで停止し前段phaseへ差し戻す
- P13 spec/architecture writeback: required: system-spec/ui-ux.md・frontend.md・database.md への実装確定内容の書き戻しをR4-reopen経由で行う

## Rollout and rollback

- Rollout: P13 の成果物を write_scope 内へ適用し、次phaseへ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P13 の write_scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: 受入9件に関わる評価がconfirmed + evaluation pass + readiness complete + promoted digest + dev-graph registration complete

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/database.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-blog-ui-builder
- Phase doc: system-plan-phase-names.md#P13
- Dependencies: SYS-BLOG-UI-BUILDER-P12
