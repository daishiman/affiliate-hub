---
graph_node_id: "SYS-THUMBNAIL-VISUAL-SYSTEM-P03"
artifact_kind: "task"
artifact_subtypes: []
project_id: "feature-package-feat-thumbnail-visual-system"
domain: "quality"
tags: ["p03","feat-thumbnail-visual-system"]
priority: null
start_date: null
target_date: null
iteration: null
title: "設計の独立レビューと外部接続なし・決定論性・境界不可侵ゲート"
owners: ["daishiman"]
created_at: "2026-09-04T04:16:11Z"
updated_at: "2026-09-04T04:16:11Z"
status: "active"
depends_on: ["SYS-THUMBNAIL-VISUAL-SYSTEM-P02"]
related_nodes: ["spec-system-spec-index","arch-system-spec-overview"]
resource_scope: ["docs/spec/feat-thumbnail-visual-system/design-review.md"]
purpose: "P02を生成者と分けてレビューし、外部接続混入・非決定性・CLS未達・feat-reader-surfaceとの境界侵犯を実装前に止める。"
goal: "P02を生成者と分けてレビューし、外部接続混入・非決定性・CLS未達・feat-reader-surfaceとの境界侵犯を実装前に止める。"
scope_in: ["Produced artifacts: 独立design-review記録と修正済み設計digest","Consumed artifacts: features/feat-thumbnail-visual-system.md, features/feat-thumbnail-visual-system.context.json, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/retrieval-evidence/kajetblog-top-analysis.md, SYS-THUMBNAIL-VISUAL-SYSTEM-P02","Write scope/touches: docs/spec/feat-thumbnail-visual-system/design-review.md"]
scope_out: ["記事本文および本文中図解のAI生成 (feat-ai-content-studio)","トップページの区画構成と表示順 (feat-blog-top-page-composition)","外部ECからの商品画像取得・再配信 (feat-affiliate-inbox / feat-product-intelligence)","テンプレート・配色の選択UIそのもの (feat-blog-ui-builder)","記事本文中の画像を含む画面全体の表示品質・アクセシビリティ規約 (feat-reader-surfaceが所有)。本featureはサムネイル・代替図版・アイコンだけを対象とする","画像の著作権処理・素材調達の運用"]
acceptance: ["Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-thumbnail-visual-system`","Automated commands: `pnpm typecheck`、`pnpm content:validate`、対象test suite。実装を持たないphaseは適用外理由をreportへ残す","Required evidence: docs/spec/feat-thumbnail-visual-system/design-review.md"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform"]
parent_feature: "feat-thumbnail-visual-system"
feature_package_id: "feature-package/feat-thumbnail-visual-system"
phase_ref: "P03"
file_path: "tasks/feat-thumbnail-visual-system/sys-thumbnail-visual-system-p03.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"3495330b8d67c78fac526b7468ec270cb6f15e6e8c07d88d6e80dd526d37109d","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/feature-package-feat-thumbnail-visual-system/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-04T04:16:11Z","origin_kind":"system-dev-planner","source_digest":"3495330b8d67c78fac526b7468ec270cb6f15e6e8c07d88d6e80dd526d37109d","source_path":".dev-graph/published/feature-package-feat-thumbnail-visual-system/task-specs/phase-03-design-review.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
classification_confidence: 1.0
classification_reason: "feat-thumbnail-visual-systemのP03 lifecycle責務への確定写像"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-thumbnail-visual-system/sys-thumbnail-visual-system-p03.md","confidence":1.0}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-lj21","github_mirror":null,"linked_at":"2026-09-04T07:33:17Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"linked_pr_merged_all","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-09-04T03:19:00Z","missing_sections":[],"status":"complete"}
---

# System task overlay: 設計の独立レビューと外部接続なし・決定論性・境界不可侵ゲート

## Machine-readable registration fields

- feature_package_id: feature-package/feat-thumbnail-visual-system
- owners: ["daishiman"]
- tags: ["p03", "feat-thumbnail-visual-system"]
- related_nodes: ["spec-system-spec-index", "arch-system-spec-overview"]
- parent_feature: feat-thumbnail-visual-system
- phase_ref: P03
- classification: confidence=1.0; reason=feat-thumbnail-visual-systemのP03 lifecycle責務への確定写像; candidate=tasks/feat-thumbnail-visual-system/sys-thumbnail-visual-system-p03.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P02を生成者と分けてレビューし、外部接続混入・非決定性・CLS未達・feat-reader-surfaceとの境界侵犯を実装前に止める。

## 背景

記事・ブログ・管理画面のどの一覧でも内容を一目で識別できるサムネイルが必ず表示され、画像が無いことによる空白や版面のずれが起きないようにする。記事編集での明示アップロード・アイキャッチ指定・本文先頭画像の優先順位で登録し、いずれも無い場合はタイトル・カテゴリー・ブログ配色トークンから外部接続なしで決定論的に代替図版を生成する。R2へオリジナルと16:9派生(複数幅)を保存し、トップページ・記事一覧・カテゴリー・タグ・検索結果・関連記事・管理画面のブログ一覧/記事一覧/プレビューの全画面へ配信する。サムネイル・代替図版・アイコンに限りCLS 0.1未満を満たし、OGP/Twitter Card(summary_large_image)へ再利用する。本phaseはSYS-THUMBNAIL-VISUAL-SYSTEM-P02の確定成果物を入力にする。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-thumbnail-visual-system, spec-system-spec-index, arch-system-spec-overview, SYS-THUMBNAIL-VISUAL-SYSTEM-P02
- Entry gate: depends_onの全taskがdoneまたはclosed
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: applicable; 画面ごとの表示適用漏れを意味レビューする
- Backend: applicable; 決定論的生成の入出力契約をレビューする
- API: applicable; R2派生APIの入出力とerror taxonomyをレビューする
- Data: applicable; cache keyと再生成抑止ロジックの整合をレビューする
- Infrastructure: N/A: 配備変更なし
- Security: applicable; 代替図版生成コード経路に外部接続が混入していないかを独立レビューする
- Quality: applicable; C1-C4とA1-A7被覆を採点する
- Documentation: applicable; verdictとfindingを記録する
- Operations: applicable; 障害時fallback設計をレビューする

## Architecture and deploy unit

- Architecture decisions: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md
- Deploy unit/environment: cloudflare-workers-opennext-app。サムネイル原本はR2、metadataはD1に保存し、分析文書だけのphaseも最終的な適用先をこのunitへ固定する
- Compatibility/migration/backfill: 既存の記事一覧・関連記事表示、D1 schemaとの後方互換を保ち、破壊的移行はP08のdry-runとrollback証跡なしに実行しない

## 成果物

- Produced artifacts: 独立design-review記録と修正済み設計digest
- Consumed artifacts: features/feat-thumbnail-visual-system.md, features/feat-thumbnail-visual-system.context.json, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/retrieval-evidence/kajetblog-top-analysis.md, SYS-THUMBNAIL-VISUAL-SYSTEM-P02
- Write scope/touches: docs/spec/feat-thumbnail-visual-system/design-review.md

## Tracker publication and completion

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads bindingではGitHub Projectsを更新しない
- PR completion policy: linked_pr_merged_all
- PR body contract: Beads issue参照とdev-graph graph_node_id=SYS-THUMBNAIL-VISUAL-SYSTEM-P03を記載し、target branchはdevとする
- Ownership boundary: system-dev-plannerはintentを宣言し、dev-graphが起票・依存・完了収束を所有する

## Branch and worktree execution

- Branch: dev-graph登録後にC15がdevgraph/SYS-THUMBNAIL-VISUAL-SYSTEM-P03として割り当てる
- Worktree lease: 実装開始前にSYS-THUMBNAIL-VISUAL-SYSTEM-P03をclaimし、heartbeatとreleaseをlease契約どおり行う
- Parallel safety: depends_on完了、write_scopeとactive leaseの非重複を確認する
- Completion projection: feature branchはpending eventだけを残し、default branch reconciliationでdurable doneを確定する

## スコープ外

- 記事本文および本文中図解のAI生成 (feat-ai-content-studio)
- トップページの区画構成と表示順 (feat-blog-top-page-composition)
- 外部ECからの商品画像取得・再配信 (feat-affiliate-inbox / feat-product-intelligence)
- テンプレート・配色の選択UIそのもの (feat-blog-ui-builder)
- 記事本文中の画像を含む画面全体の表示品質・アクセシビリティ規約 (feat-reader-surfaceが所有)。本featureはサムネイル・代替図版・アイコンだけを対象とする
- 画像の著作権処理・素材調達の運用

## テスト戦略

- テストレベル選定: 単体は決定論的代替図版生成の純粋関数・登録経路優先順位判定・R2派生命名を検証する。結合はR2/D1接続とusecase境界を検証する。境界値は空タイトル・多バイト文字・重複URL・R2障害・再生成競合・mobile viewportを検証する。回帰は既存の記事一覧・関連記事・OGP出力を保つ。
- カバレッジ目標: 新規または変更するapplication codeは既定80%を下回らず、決定論性テスト(同一入力2回実行のバイト一致)は対象関数100%網羅を要求する。
- 層別方針: Frontendは可視ラベルとアクセシブル名によるbehavior検証とCLS実測、BackendはR2/D1結合とAPI契約、InfrastructureはIaC静的検証とdevelopment smokeを使う。
- 保守性制約: pixel位置依存とDOM構造依存のassertを禁止し、操作結果・状態・契約・生成バイト列を検証する。

## Verification and evidence

- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-thumbnail-visual-system`
- Automated commands: `pnpm typecheck`、`pnpm content:validate`、対象test suite。実装を持たないphaseは適用外理由をreportへ残す
- Required evidence: docs/spec/feat-thumbnail-visual-system/design-review.md
- Acceptance state: P03: C1矛盾なし・C2漏れなし・C3整合性あり・C4依存整合に加え、代替図版生成の外部接続0、同一入力から同一バイト列が得られる決定論性、CLS規約の測定可能性、feat-reader-surfaceの本文画像責務への非侵犯境界の全チェックを証拠付きPASSにする。

## Inner goal-seek execution loop

- Methodology contract: system-task-goal-seek/v1
- Goal: P02を生成者と分けてレビューし、外部接続混入・非決定性・CLS未達・feat-reader-surfaceとの境界侵犯を実装前に止める。
- Generic execution prompt: feature goal、当phaseの目的、depends_on成果物、write_scope、scope_outを入力し、手段を固定せず観測可能なacceptanceを満たす成果物を作る
- Rubric: 当task acceptance、既定80% coverage、回帰0、required evidence、write_scope厳守の全項目
- Feedback loop: 実装と独立した評価へ渡し、findingを次周のpromptへ反映してrubric verdict=PASSまで反復する。上限到達時はfail-closedで前phaseへ差し戻す
- P13 spec/architecture writeback: N/A: P13が所有する。

## Rollout and rollback

- Rollout: 独立design-review記録と修正済み設計digestをwrite_scope内へ適用し、検証PASS後に依存する次phaseへ渡す
- Rollback trigger and steps: P03のrubric verdictがFAILのまま上限へ到達した場合、write_scope内の当phase変更を戻し、直前のpromoted generationへ復帰する

## Handoff

- Executor: system build route。dev-graph登録とworktree claim後に実行する
- Ready when: confirmed、evaluation pass、implementation readiness complete、promoted digest、dev-graph exact-13 registrationが揃う
- Completion condition: P03: C1矛盾なし・C2漏れなし・C3整合性あり・C4依存整合に加え、代替図版生成の外部接続0、同一入力から同一バイト列が得られる決定論性、CLS規約の測定可能性、feat-reader-surfaceの本文画像責務への非侵犯境界の全チェックを証拠付きPASSにする。

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-thumbnail-visual-system
- Phase doc: .claude/plugins/system-dev-planner/references/system-plan-phase-names.md#P03
- Dependencies: SYS-THUMBNAIL-VISUAL-SYSTEM-P02
