# System task overlay: 受入・品質証跡の集約と検証可能性の確保

## Machine-readable registration fields

- feature_package_id: feature-package/feat-blog-ui-builder
- owners: ["daishiman"]
- tags: ["p11", "feat-blog-ui-builder"]
- related_nodes: []
- parent_feature: feat-blog-ui-builder
- phase_ref: P11
- classification: confidence=1.0; reason=feat-blog-ui-builder の P11 lifecycle 責務への確定写像; candidate=tasks/feat-blog-ui-builder/sys-blog-ui-builder-p11.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P07の受入判定証跡 (A1-A14全14件) とP09の品質検査証跡が一箇所 (docs/spec/feat-blog-ui-builder/evidence/) へ集約され、第三者が同じ手順で再現・検証できる状態を成立させる。A10-A14 (SEO/AI検索) の証跡として、HTML/JSON-LD出力サンプル・sitemap/robots/llms.txt内容・IndexNow送信スキップログ・guideline_references管理画面スクリーンショットを含む。

## 背景

受入判定と品質検査の証跡が個別文書に散在していると、後続のP12運用文書化やP13リリース判断時に参照コストが高くなるため、本 phase で一箇所へ集約する。A10-A14の証跡はSSRの性質上HTMLソースや自動生成ファイルの内容を含む。source_feature_digest: sha256:8953a167a43f5fc55998ebfcaa83f437d59f0d567cde6e7c15e8b568ab470d7b

## 前提条件

- Required spec/architecture/phase/task nodes: feat-blog-ui-builder, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/database.md, architecture/arch-two-layer-platform.md
- Entry gate: 直前 phase task の depends_on 完了 (intra-feature dependency)
- P11 upstream entry gate: SYS-BLOG-UI-BUILDER-P07, SYS-BLOG-UI-BUILDER-P09 の implementation_readiness=complete
- Source pin: system-spec-harness v0.1.11 (C08 source_pin) / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: N/A: 証跡の生成自体はP07/P09で完了済みであり本phaseは集約のみ行う
- Backend: N/A: 証跡の生成自体はP07/P09で完了済みであり本phaseは集約のみ行う
- API: N/A: 証跡の生成自体はP06/P09で完了済みであり本phaseは集約のみ行う
- Data: N/A: 証跡の生成自体はP07で完了済みであり本phaseは集約のみ行う
- Infrastructure: N/A: デプロイ単位への影響なし
- Security: N/A: 証跡の生成自体はP09で完了済みであり本phaseは集約のみ行う
- Quality: applicable; A1-A14全14件の再現可能な証跡集約が本 phase の完了条件である
- Documentation: applicable; evidence/配下の集約文書そのものが成果物である
- Operations: N/A: 運用手順はP12が所有する

## Architecture and deploy unit

- Architecture decisions: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/database.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存 src/app/admin/sites 配下画面の新エンティティへの移行はP08が所有する

## 成果物

- Produced artifacts: docs/spec/feat-blog-ui-builder/evidence/ (受入判定+品質検査証跡一式と再現手順。A1-A9: スクリーンショット・axe-core結果・操作記録。A10: HTML/JSON-LDサンプル。A11: sitemap/robots/llms.txtサンプル。A12: SEO/AI標準ブロック出力サンプル。A13: IndexNowスキップログ。A14: guideline_references管理画面スクリーンショット)
- Consumed artifacts: docs/spec/feat-blog-ui-builder/acceptance-report.md, docs/spec/feat-blog-ui-builder/quality-report.md
- Write scope/touches: docs/spec/feat-blog-ui-builder/evidence/

## Tracker publication and completion

> 本specは`tracker_binding_intent`とGitHub公開intentだけを宣言し、永続bindingの解決・起票・完了収束はdev-graphが所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-BLOG-UI-BUILDER-P11; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-plannerはintentのみを宣言し、dev-graphがtracker mutationとreconciliationを行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-BLOG-UI-BUILDER-P11; system-dev-plannerは事前割当を行わない
- Worktree lease: claim SYS-BLOG-UI-BUILDER-P11 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on の完了 + resource_scope (feat-blog-ui-builder 配下) と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- feat-blog-ui-builder の scope_out に該当する変更
- 証跡の新規生成 (P07/P09が既に生成した証跡の集約に限る)

## テスト戦略

- テストレベル選定: 単体: ユースケース関数・データモデル変換ロジック・JSON-LD生成純関数・IndexNow送信スキップロジック・guideline_references 90日判定ロジックの単体テストを緑化する。結合: 画面からAPI、APIからD1永続化までの結合テストを緑化する。境界値: サイドバー折りたたみ境界・配色上書き解除時のフォールバック・固定ページ未作成時の空状態・axe-core重大違反0件境界・IndexNow鍵未設定時のスキップ境界・guideline_references 90日超境界を緑化する。回帰: 既存 tests/ 配下の全テストスイートを0件失敗のまま維持する。
- カバレッジ目標: 既定 80% を新規実装コード (src/presentation/ui, src/app/api/admin, src/application, src/infrastructure/persistence/d1, src/application/seo) に適用する。
- 層別方針: 本 task は Workstream applicability 上で frontend/backend/infrastructure のいずれも applicable ではないため、対象層別方針は N/A: 個別実装検証は別 phase が所有する。
- 保守性制約: pixel位置依存・DOM構造依存のテストを禁止し、可視ラベル・アクセシブル名・レスポンスステータス・返却データの属性など振る舞い検証に限定する。

## 完了条件

- docs/spec/feat-blog-ui-builder/evidence/ に A1-A14 の14件すべての証跡が集約されている
- A10-A14 (SEO/AI検索) の証跡 (HTML/JSON-LD・sitemap/robots/llms.txt・IndexNowログ・guideline_references画面) が含まれている

## 判定項目

- [ ] evidence/ に A1-A9 の証跡 (スクリーンショット・axe-core結果) が存在する
- [ ] evidence/ に A10 の証跡 (HTML/JSON-LD出力サンプル) が存在する
- [ ] evidence/ に A11 の証跡 (sitemap/robots/llms.txtサンプル) が存在する
- [ ] evidence/ に A13 の証跡 (IndexNowスキップログ) が存在する
- [ ] evidence/ に A14 の証跡 (guideline_references管理画面スクリーンショット) が存在する
- [ ] 再現手順が記述されている

## Verification and evidence

- Automated commands: `pnpm run verify` (証跡再現手順に含まれる検証スクリプトを実行する)
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-blog-ui-builder` (本 package の C12 決定論検証を世代非依存に再実行する)
- Required evidence: P11 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: P07の受入判定証跡 (A1-A14全14件) とP09の品質検査証跡が一箇所 (docs/spec/feat-blog-ui-builder/evidence/) へ集約され、第三者が同じ手順で再現・検証できる状態を成立させる。
- Generic execution prompt: feat-blog-ui-builder の goal と本 task の 前提条件/成果物/write_scope/スコープ外 を渡し、実装手段は固定せず P11 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件 (本 task の acceptance)・カバレッジ目標 (既定80%) green・既存テストの回帰0件・Required evidence の証跡取得・write_scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装から独立評価 (P03/P09/P10相当) へ渡し、findingをGeneric execution promptへ反映して再実行し、rubric verdict=PASSまで反復する。上限到達時はfail-closedで停止し前段phaseへ差し戻す
- P13 spec/architecture writeback: N/A: P13 owns writeback

## Rollout and rollback

- Rollout: P11 の成果物を write_scope 内へ適用し、次phaseへ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P11 の write_scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: 受入14件に関わる評価がconfirmed + evaluation pass + readiness complete + promoted digest + dev-graph registration complete

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/database.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-blog-ui-builder
- Phase doc: system-plan-phase-names.md#P11
- Dependencies: SYS-BLOG-UI-BUILDER-P07, SYS-BLOG-UI-BUILDER-P09
- source_feature_digest: sha256:8953a167a43f5fc55998ebfcaa83f437d59f0d567cde6e7c15e8b568ab470d7b
