# System task overlay: 品質保証とアクセシビリティ・非機能検査

## Machine-readable registration fields

- feature_package_id: feature-package/feat-blog-ui-builder
- owners: ["daishiman"]
- tags: ["p09", "feat-blog-ui-builder"]
- related_nodes: []
- parent_feature: feat-blog-ui-builder
- phase_ref: P09
- classification: confidence=1.0; reason=feat-blog-ui-builder の P09 lifecycle 責務への確定写像; candidate=tasks/feat-blog-ui-builder/sys-blog-ui-builder-p09.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

型検査・静的解析・axe-coreによるアクセシビリティ検査 (重大違反0件、light/dark両方のコントラスト基準充足)、表示崩れ・応答性能の各検査が基準を満たし、結果が記録された状態を成立させる。

## 背景

受入A9はaxe-coreの重大違反0件とlight/dark両方の本文コントラスト基準充足を明示要求している。sticky要素はWCAG 2.2 reflow/focus-not-obscuredの達成基準に抵触しうるため、本 phase で機械検査と手動検査を組み合わせて確認する。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-blog-ui-builder, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/database.md, architecture/arch-two-layer-platform.md
- Entry gate: 直前 phase task の depends_on 完了 (intra-feature dependency)
- P09 upstream entry gate: SYS-BLOG-UI-BUILDER-P08 の implementation_readiness=complete
- Source pin: system-spec-harness v0.1.11 (C08 source_pin) / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: applicable; sticky要素のWCAG 2.2 reflow/focus-not-obscured適合とlight/darkコントラストを検査する
- Backend: N/A: 非機能検査はUI/UX観点が中心でありAPI単体検査はP06で完了済み
- API: N/A: 非機能検査はUI/UX観点が中心でありAPI単体検査はP06で完了済み
- Data: N/A: データ検査はP06/P07で完了済み
- Infrastructure: N/A: デプロイ単位への影響なし
- Security: applicable; 既存admin RBAC契約の範囲で権限検査を実施する
- Quality: applicable; axe-core重大違反0件・型検査/lint合格が本 phase の完了条件である
- Documentation: applicable; quality-report.mdが検査結果の証跡文書である
- Operations: N/A: 運用手順はP12が所有する

## Architecture and deploy unit

- Architecture decisions: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/database.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存 src/app/admin/sites 配下画面の新エンティティへの移行はP08が所有する

## 成果物

- Produced artifacts: docs/spec/feat-blog-ui-builder/quality-report.md (型検査・lint・axe-core・視覚回帰・性能の結果)
- Consumed artifacts: docs/spec/feat-blog-ui-builder/migration-report.md, src/app/s/[site]/
- Write scope/touches: docs/spec/feat-blog-ui-builder/quality-report.md

## Tracker publication and completion

> 本specは`tracker_binding_intent`とGitHub公開intentだけを宣言し、永続bindingの解決・起票・完了収束はdev-graphが所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-BLOG-UI-BUILDER-P09; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-plannerはintentのみを宣言し、dev-graphがtracker mutationとreconciliationを行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-BLOG-UI-BUILDER-P09; system-dev-plannerは事前割当を行わない
- Worktree lease: claim SYS-BLOG-UI-BUILDER-P09 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on の完了 + resource_scope (feat-blog-ui-builder 配下) と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- feat-blog-ui-builder の scope_out に該当する変更
- 検査でFAILとなった場合の実装修正 (write_scope外であり、必要な場合はP05/P08へ差し戻す)

## テスト戦略

- テストレベル選定: 単体: ユースケース関数・データモデル変換ロジックの単体テストを緑化する。結合: 画面からAPI、APIからD1永続化までの結合テストを緑化する。境界値: サイドバー折りたたみ境界・配色上書き解除時のフォールバック・固定ページ未作成時の空状態・axe-core重大違反0件境界を緑化する。回帰: 既存 tests/ 配下の全テストスイートを0件失敗のまま維持する。
- カバレッジ目標: 既定 80% を新規実装コード (src/presentation/ui, src/app/api/admin, src/application, src/infrastructure/persistence/d1) に適用する。
- 層別方針: フロントエンド: behavior ベースでテンプレート選択・配色上書き・sticky折りたたみ・表現ブロック差替の振る舞いを検証する。
- 保守性制約: pixel位置依存・DOM構造依存のテストを禁止し、可視ラベル・アクセシブル名・レスポンスステータス・返却データの属性など振る舞い検証に限定する。

## Verification and evidence

- Automated commands: `pnpm run typecheck` (型検査)
- Automated commands: `pnpm run lint` (静的解析)
- Automated commands: `pnpm run visual` (視覚回帰・axe-core検査を含む)
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-blog-ui-builder` (本 package の C12 決定論検証を世代非依存に再実行する)
- Required evidence: P09 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: 型検査・静的解析・axe-coreによるアクセシビリティ検査 (重大違反0件、light/dark両方のコントラスト基準充足)、表示崩れ・応答性能の各検査が基準を満たし、結果が記録された状態を成立させる。
- Generic execution prompt: feat-blog-ui-builder の goal (テンプレートから新規ブログを作成でき、配色をブログ既定とページ単位で選べ、ヘッダー・サイドバー・フッターが常時表示され、運営者情報・全カテゴリー・サイトポリシー・プライバシーポリシー・特定商取引法に基づく表記・お問い合わせの固定ページと図解・比較などの表現ブロックを構築でき、公開面/作成/保存/管理一覧の各面でブログ×アフィリエイトの配置が一覧・逆引きできる状態になっている) と本 task の 前提条件/成果物/write_scope/スコープ外 を渡し、実装手段は固定せず P09 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件 (本 task の acceptance)・カバレッジ目標 (既定80%) green・既存テストの回帰0件・Required evidence の証跡取得・write_scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装から独立評価 (P03/P09/P10相当) へ渡し、findingをGeneric execution promptへ反映して再実行し、rubric verdict=PASSまで反復する。上限到達時はfail-closedで停止し前段phaseへ差し戻す
- P13 spec/architecture writeback: N/A: P13 owns writeback

## Rollout and rollback

- Rollout: P09 の成果物を write_scope 内へ適用し、次phaseへ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P09 の write_scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: 受入9件に関わる評価がconfirmed + evaluation pass + readiness complete + promoted digest + dev-graph registration complete

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/database.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-blog-ui-builder
- Phase doc: system-plan-phase-names.md#P09
- Dependencies: SYS-BLOG-UI-BUILDER-P08
