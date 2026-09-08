# System task overlay: 19種断片カタログと保存形式・画像参照の要求ベースライン確定

## Machine-readable registration fields

- feature_package_id: feature-package/feat-article-block-editor
- owners: ["daishiman"]
- tags: ["p01", "feat-article-block-editor"]
- related_nodes: []
- parent_feature: feat-article-block-editor
- phase_ref: P01
- classification: confidence=1.0; reason=feat-article-block-editor の P01 lifecycle 責務への確定写像; candidate=tasks/feat-article-block-editor/sys-article-block-editor-p01.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

feat-article-block-editor の受入7件 (A1-A7) を実装着手前に一意で検証可能な要求ベースラインへ確定し、19種の断片カタログ (現行10種に加えるコードブロック・並列画像・表の拡張・色付き文字などの追加9種) の名称・属性・保存形式表現、拡張Markdown文字列 (prose-format.ts) とProseNode木の相互変換規約、画像参照の正本 (Editorial側D1) とR2へのpresigned PUTアップロード契約、公開ページ描画の許可リストの範囲を、既存 src/domain/blogops/prose-node.ts (187行・現行10種) と src/presentation/prose/prose-editor.tsx (682行・入力欄集約でWYSIWYGでない実装) の実測に接地させて決める。

## 背景

src/domain/blogops/prose-node.ts の ProseNode は paragraph / heading(level 3|4) / bullet-list / ordered-list / quote / callout(tone,title,text) / product-card(productId) / comparison-table(headers,rows) / image(src,alt) / divider の10種で、仕様 (FRONT-REQ-005) が要求する19種に届かない。src/presentation/prose/prose-editor.tsx (682行) は入力欄の集まりで WYSIWYG ではなく、商品idをinput要素 (placeholder=pc_...) で手入力させ、画像URLをinput要素 (placeholder=/media/... または https://...) で手入力させており、UIUX-ACC-008 (URL手入力欄が存在しない・商品は検索結果からの選択のみ) に正面から反する。節 (外側・ArticleBlockKind・見出し2固定) と本文断片 (内側・ProseNode・見出し3/4) の2層モデルは既にドメインに存在するが、編集面がその層の別を見せていない。記事本文の保存形式 (拡張Markdown文字列) の 決定である decisions[].dec-article-body-storage-format は recommended_pending_confirmation のままである。本phaseはこれらの実測された空白だけを、検証可能な要求として書き下ろす。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-article-block-editor, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, system-spec/infrastructure.md, system-spec/security.md, system-spec/maintenance-ops.md, architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Entry gate: 直前 phase task の depends_on 完了 (intra-feature dependency)
- P01 upstream entry gate: parent_feature.depends_on all done|closed (P01 claim 時に canonical dev-graph の parent feature が持つ depends_on 全件を都度読み、done|closed のときだけ通す派生 gate。upstream ID を task DAG へ複製しない)
- Source pin: system-spec-harness v0.1.11 (C08 source_pin) / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: N/A: 本 phase は編集面・公開面のコードを触らない
- Backend: applicable; 保存形式 (拡張Markdown⇄ProseNode木) の往復規約と画像参照の正本所在を要求として確定する
- API: N/A: presigned PUT発行APIと商品検索APIの契約設計は P02 が所有する
- Data: applicable; 画像参照テーブル (DB-IMAGE-01〜03) の保持項目を要求として確定する
- Infrastructure: applicable; R2への直接アップロード方式 (presigned PUT) の要求を確定する
- Security: applicable; 公開ページ描画の許可リスト (許可する断片・属性・スタイル) の範囲を要求として確定する
- Quality: applicable; 本 phase の完了条件を検証可能な形で満たす
- Documentation: applicable; 要求ベースライン文書そのものが本 phase の成果物である
- Operations: N/A: 運用手順 (孤児画像回収・既存記事移行) は P12 が所有する

## Architecture and deploy unit

- Architecture decisions: system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, system-spec/infrastructure.md, system-spec/security.md, system-spec/maintenance-ops.md, architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存記事マイグレーションと保存形式の前方互換確認は P08 が所有する

## 成果物

- Produced artifacts: docs/spec/feat-article-block-editor/requirements-baseline.md (A1-A7 の検証可能化と要件ID対応表); docs/spec/feat-article-block-editor/block-catalog-decisions.md (19種の断片カタログと追加9種の属性・保存形式表現の決定と根拠); docs/spec/feat-article-block-editor/image-upload-decisions.md (画像参照の正本所在 (Editorial側D1) とR2 presigned PUT契約、許可リストの範囲の決定と根拠)
- Consumed artifacts: features/feat-article-block-editor.md, features/feat-article-block-editor.context.json, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, system-spec/infrastructure.md, system-spec/security.md, src/domain/blogops/prose-node.ts, src/domain/blogops/prose-format.ts, src/presentation/prose/prose-editor.tsx
- Write scope/touches: docs/spec/feat-article-block-editor/requirements-baseline.md, docs/spec/feat-article-block-editor/block-catalog-decisions.md, docs/spec/feat-article-block-editor/image-upload-decisions.md

## Tracker publication and completion

> 本specは`tracker_binding_intent`とGitHub公開intentだけを宣言し、永続bindingの解決・起票・完了収束はdev-graphが所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-ARTICLE-BLOCK-EDITOR-P01; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-plannerはintentのみを宣言し、dev-graphがtracker mutationとreconciliationを行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-ARTICLE-BLOCK-EDITOR-P01; system-dev-plannerは事前割当を行わない
- Worktree lease: claim SYS-ARTICLE-BLOCK-EDITOR-P01 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on の完了 + resource_scope (src, drizzle, tests, worker-entry.js, docs/spec, system-spec) と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- feat-article-block-editor の scope_out (記事本文のAI生成、SEO/AEOの構造化データ導出と公開時点検、公開ページ側の読者導線・目次・サイドバー配置、管理画面全体の単一用途画面再編、複数媒体向け原稿の生成ハーネス、複数人の同時編集と競合解決、記事のバージョン履歴UIと差分表示、商品データそのものの取込・更新) に該当する変更
- src/domain/authoring/blog-template.ts の ExpressionBlock レジストリと src/application/adapters/expression-article-block.ts の型・変換ロジックの書き換え (表現ブロックと記事版面ブロックの意味を統合しない)
- src/presentation/site/expression-block-view.tsx が担う表現ブロック描画の変更
- 参考ブログの文章・素材・デザインの複製

## テスト戦略

- テストレベル選定: 単体: ProseNode 19種のparse/serialize純関数、許可リスト判定関数、presigned PUT発行の署名生成を入力から出力で検証する。結合: 編集面から保存・再読込までの往復、画像アップロードからR2参照確定までの経路、商品検索から断片挿入までの経路を検証する。境界値: 19種各1件の挿入・編集・公開描画一致、見出しレベル固定の挿入・移動・削除・貼り付け全操作、商品検索0件/複数件、画像アップロード成功/失敗、許可リスト外タグ混入、既存10種記事の読み込みと再保存不変性を検証する。回帰: 既存 tests/ 配下の全スイートを0件失敗のまま維持する。
- カバレッジ目標: 既定80%を新規実装コード (src/domain/blogops, src/presentation/prose, src/application/ports, src/application/usecases, src/infrastructure/persistence/d1) に適用する。
- 層別方針: フロントエンド: 本 phase は編集面のコードを触らないため対象外 (P02以降でbehavior検証を設計・適用する)。バックエンド: image-upload-decisions.md が確定する presigned PUT 発行のAPI 契約 (エンドポイント形状・署名パラメータ・有効期限・エラーコード) を P02 の API 設計と P04 のテスト設計がそのまま照合できる粒度で明記し、画像参照テーブルの保持項目に対するDB 結合 (D1 への INSERT/SELECT 往復) 検証観点を P04 へ引き渡す。インフラ: R2 への presigned PUT 直接アップロード方式を、後続 phase がIaC (wrangler.toml の R2 バケット/バインディング定義) として表現できる粒度まで要求へ落とし込み、smoke (実際の PUT 成功可否) で検証できる受け入れ条件を用意する。
- 保守性制約: pixel位置依存・DOM構造依存のテストを禁止し、可視ラベル・アクセシブル名・返却データの属性など振る舞い検証に限定する。

## Verification and evidence

- Automated commands: `pnpm run typecheck` (文書が参照する既存型契約の同定に破れが無いことを静的に確認する)
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-article-block-editor` (本 package の C12 決定論検証を世代非依存に再実行する)
- Required evidence: P01 の 成果物 section に記載した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: feat-article-block-editor の受入7件 (A1-A7) を実装着手前に一意で検証可能な要求ベースラインへ確定し、19種の断片カタログ (現行10種に加えるコードブロック・並列画像・表の拡張・色付き文字などの追加9種) の名称・属性・保存形式表現、拡張Markdown文字列 (prose-format.ts) とProseNode木の相互変換規約、画像参照の正本 (Editorial側D1) とR2へのpresigned PUTアップロード契約、公開ページ描画の許可リストの範囲を、既存 src/domain/blogops/prose-node.ts (187行・現行10種) と src/presentation/prose/prose-editor.tsx (682行・入力欄集約でWYSIWYGでない実装) の実測に接地させて決める。
- Generic execution prompt: feat-article-block-editor の goal (編集面と公開ページが同一の描画部品を通り、節と本文断片の2層がUI上で見分けられ、どの編集操作でも見出しレベルが動かず、19種の断片が`/`から挿入・編集・公開でき、商品と画像が手入力ではなく検索選択と直接アップロードで入る状態になっている) と本 task の 前提条件/成果物/write_scope/スコープ外 を渡し、実装手段は固定せず P01 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件 (本 task の acceptance)・カバレッジ目標 (既定80%) green・既存テストの回帰0件・Required evidence の証跡取得・write_scope 内へのスコープ厳守、の5点をすべて満たすこと
- Feedback loop: 実装から独立評価 (P03/P09/P10相当) へ渡し、findingをGeneric execution promptへ反映して再実行し、rubric verdict=PASSまで反復する。上限到達時はfail-closedで停止し前段phaseへ差し戻す
- P13 spec/architecture writeback: N/A: P13 owns writeback

## Rollout and rollback

- Rollout: P01 の成果物を write_scope 内へ適用し、次phaseへ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P01 の write_scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: 受入7件に関わる評価がconfirmed + evaluation pass + readiness complete + promoted digest + dev-graph registration complete

## 参照情報

- System specification: system-spec/ui-ux.md, system-spec/frontend.md, system-spec/backend.md, system-spec/database.md, system-spec/infrastructure.md, system-spec/security.md, system-spec/maintenance-ops.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-article-block-editor
- Phase doc: system-plan-phase-names.md#P01
- Dependencies: N/A: P01 は intra-feature 依存を持たない起点 task である
