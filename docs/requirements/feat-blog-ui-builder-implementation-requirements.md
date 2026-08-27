# 実装要件定義書: feat-blog-ui-builder (ブログ UI ビルダー (テンプレート・配色・アフィリエイト配置管理))

> 本書は dev-graph `requirements` verb が確定仕様 (system-spec) と昇格済み feature execution package から導出した実装要件である。実装コードは含まない。実装は `task-graph` build へ handoff する。

## スナップショット

- graph snapshot digest: `sha256:4b8bf3499e31990362e80da0979a604cda150cf140446f5c61a5c3ec0dec906e`
- graph revision: 267
- feature package: `feature-package/feat-blog-ui-builder`
- promoted generation digest: `sha256:9a2832f2d6f8656f3495435827399bed84d70c893a027d828694b07b46506fe1`
- handoff target: `task-graph`
- emitted_at: 2026-08-24T04:10:00Z

## 目的と到達状態

- 目的: ブログごとにテンプレートと配色を選び、公開面・作成・保存・管理一覧のどの面でも「どのブログにどのアフィリエイトが載っているか」を迷わず把握できるブログ UI を提供する
- 到達状態: テンプレートから新規ブログを作成でき、配色をブログ既定とページ単位で選べ、ヘッダー・サイドバー・フッターが常時表示され、運営者情報・全カテゴリー・サイトポリシー・プライバシーポリシー・特定商取引法に基づく表記・お問い合わせの固定ページと図解・比較などの表現ブロックを構築でき、公開面/作成/保存/管理一覧の各面でブログ×アフィリエイトの配置が一覧・逆引きできる状態になっている

## スコープ

スコープ内:

- ブログテンプレート (レビュー特化/比較特化/ハウツー/ニュース/ミニマル/ガジェット寄り の 6 種) からのブログ作成と差し替え (system-spec ui-ux §テンプレート)
- 配色の 2 層選択: ブログ既定テーマ (blog_theme) とページ単位上書き (page_theme_override)。decision-ui-theme-implementation (CSS light-dark()+data 属性) に従う
- 常時表示レイアウト: sticky ヘッダー・サイドバー・フッターと、狭幅でのサイドバー折りたたみ
- 固定ページ 6 種の構築 UI: 運営者情報 / 全カテゴリー / サイトポリシー / プライバシーポリシー / 特定商取引法に基づく表記 / お問い合わせ (legal_page)
- 記事表現ブロック: figure (図解) / comparison (比較表) / cta / summary / spec-table と、ガジェット依存部分の差し替え可能なスロット
- ブログ×アフィリエイト配置 (blog_affiliate_placement) の管理一覧・逆引き (アフィリエイト→掲載ブログ/ページ) と、公開面・作成・保存の各面での表示
- 参考ブログ (makuring.jp) の構成・配置・表記法の参照を反映した情報設計 (丸パクリはしない。利用者説明を一次根拠とする)

スコープ外:

- 記事本文の AI 生成そのもの (feat-ai-content-studio)
- アフィリエイト URL の登録・商品識別 (feat-affiliate-inbox / feat-affiliate-hub)
- クリック計測・成果突合の分析基盤 (feat-analytics-insight)
- 管理画面全体の単一用途画面再編 (feat-uiux-overhaul)
- 独自ドメイン・DNS 運用、テーマの外部販売

## 受入条件 (feature)

- テンプレート 6 種のいずれかを選んで新規ブログを作成でき、作成後もテンプレートを差し替えても既存記事が壊れない
- ブログ既定の配色を選べ、任意のページで配色を上書きでき、上書きを外すとブログ既定に戻る
- 公開面でヘッダー・サイドバー・フッターがスクロール中も常時表示され、狭幅ではサイドバーが折りたたまれる
- 運営者情報・全カテゴリー・サイトポリシー・プライバシーポリシー・特定商取引法に基づく表記・お問い合わせの 6 ページを管理画面から作成・編集・公開できる
- 記事内で図解・比較表・CTA・要約・スペック表のブロックを挿入でき、ガジェット依存部分はスロット差し替えで別カテゴリでも再利用できる
- 管理一覧でブログごとの掲載アフィリエイトが一覧でき、アフィリエイトから掲載ブログ/ページへ逆引きできる
- 作成・保存・公開面の各面で当該ページに反映されているアフィリエイトが表示され、保存前後で表示が一致する
- 配色・テンプレート・固定ページの設定は D1 (Drizzle) に永続化され、再読み込み後も保持される
- 公開面のレイアウト・配色は axe-core の重大違反 0 件で、light/dark 両方で本文コントラストが基準を満たす

## アーキテクチャ参照

- `arch-system-spec-overview` (architecture/system-spec-overview.md)
- `arch-two-layer-platform` (architecture/arch-two-layer-platform.md)

- 仕様正本 (複製せず lineage 参照): `system-spec/ui-ux.md`, `system-spec/frontend.md`, `system-spec/database.md`

## readiness matrix

| node | kind | confirmation | evaluation | readiness | missing sections |
|---|---|---|---|---|---|
| `arch-system-spec-overview` | architecture | confirmed | pass | complete | なし |
| `arch-two-layer-platform` | architecture | confirmed | pass | complete | なし |
| `feat-blog-ui-builder` | feature | confirmed | pass | complete | なし |
| `SYS-BLOG-UI-BUILDER-P01` | task | confirmed | pass | complete | なし |
| `SYS-BLOG-UI-BUILDER-P02` | task | confirmed | pass | complete | なし |
| `SYS-BLOG-UI-BUILDER-P03` | task | confirmed | pass | complete | なし |
| `SYS-BLOG-UI-BUILDER-P04` | task | confirmed | pass | complete | なし |
| `SYS-BLOG-UI-BUILDER-P05` | task | confirmed | pass | complete | なし |
| `SYS-BLOG-UI-BUILDER-P06` | task | confirmed | pass | complete | なし |
| `SYS-BLOG-UI-BUILDER-P07` | task | confirmed | pass | complete | なし |
| `SYS-BLOG-UI-BUILDER-P08` | task | confirmed | pass | complete | なし |
| `SYS-BLOG-UI-BUILDER-P09` | task | confirmed | pass | complete | なし |
| `SYS-BLOG-UI-BUILDER-P10` | task | confirmed | pass | complete | なし |
| `SYS-BLOG-UI-BUILDER-P11` | task | confirmed | pass | complete | なし |
| `SYS-BLOG-UI-BUILDER-P12` | task | confirmed | pass | complete | なし |
| `SYS-BLOG-UI-BUILDER-P13` | task | confirmed | pass | complete | なし |

## 実行タスク (exact 13)

| phase | node | title | file | resource_scope |
|---|---|---|---|---|
| P01 | `SYS-BLOG-UI-BUILDER-P01` | ブログ UI ビルダーの要求ベースライン確定 | `tasks/feat-blog-ui-builder/sys-blog-ui-builder-p01.md` | docs/spec/feat-blog-ui-builder/requirements-baseline.md, docs/spec/feat-blog-ui-builder/screen-inventory.md, docs/spec/feat-blog-ui-builder/information-priority-map.json |
| P02 | `SYS-BLOG-UI-BUILDER-P02` | データモデル・テーマ契約・コンポーネント契約・管理API契約の設計 | `tasks/feat-blog-ui-builder/sys-blog-ui-builder-p02.md` | docs/spec/feat-blog-ui-builder/data-model.md, docs/spec/feat-blog-ui-builder/theme-contract.md, docs/spec/feat-blog-ui-builder/component-contract.md, docs/spec/feat-blog-ui-builder/admin-api-contract.md |
| P03 | `SYS-BLOG-UI-BUILDER-P03` | 設計レビューと参照妥当性・テーマ一貫性の独立検証 | `tasks/feat-blog-ui-builder/sys-blog-ui-builder-p03.md` | docs/spec/feat-blog-ui-builder/design-review.md |
| P04 | `SYS-BLOG-UI-BUILDER-P04` | 受入9件に対応するテスト設計 | `tasks/feat-blog-ui-builder/sys-blog-ui-builder-p04.md` | docs/spec/feat-blog-ui-builder/test-design.md, tests/ui/, tests/application/, tests/infrastructure/ … |
| P05 | `SYS-BLOG-UI-BUILDER-P05` | テンプレート・配色2層・sticky常時表示・固定ページ・表現ブロック・配置管理の実装 | `tasks/feat-blog-ui-builder/sys-blog-ui-builder-p05.md` | src/app/admin/sites/, src/app/admin/sites/new/, src/app/api/admin/, src/presentation/ui/templates/ … |
| P06 | `SYS-BLOG-UI-BUILDER-P06` | テスト全量実行と回帰0件の確認 | `tasks/feat-blog-ui-builder/sys-blog-ui-builder-p06.md` | docs/spec/feat-blog-ui-builder/test-run-report.md |
| P07 | `SYS-BLOG-UI-BUILDER-P07` | 受入9件の受け入れ判定 | `tasks/feat-blog-ui-builder/sys-blog-ui-builder-p07.md` | docs/spec/feat-blog-ui-builder/acceptance-report.md |
| P08 | `SYS-BLOG-UI-BUILDER-P08` | 既存サイト管理画面の新エンティティへの移行と重複実装の解消 | `tasks/feat-blog-ui-builder/sys-blog-ui-builder-p08.md` | src/app/admin/sites/, src/app/admin/sites/[site]/, src/presentation/ui/templates/, docs/spec/feat-blog-ui-builder/migration-report.md |
| P09 | `SYS-BLOG-UI-BUILDER-P09` | 品質保証とアクセシビリティ・非機能検査 | `tasks/feat-blog-ui-builder/sys-blog-ui-builder-p09.md` | docs/spec/feat-blog-ui-builder/quality-report.md |
| P10 | `SYS-BLOG-UI-BUILDER-P10` | 最終レビューと残課題の確定 | `tasks/feat-blog-ui-builder/sys-blog-ui-builder-p10.md` | docs/spec/feat-blog-ui-builder/final-review.md |
| P11 | `SYS-BLOG-UI-BUILDER-P11` | 受入・品質証跡の集約と検証可能性の確保 | `tasks/feat-blog-ui-builder/sys-blog-ui-builder-p11.md` | docs/spec/feat-blog-ui-builder/evidence/ |
| P12 | `SYS-BLOG-UI-BUILDER-P12` | UI規則と運用手順の文書化 | `tasks/feat-blog-ui-builder/sys-blog-ui-builder-p12.md` | docs/spec/feat-blog-ui-builder/ui-rules.md, docs/spec/feat-blog-ui-builder/operations.md |
| P13 | `SYS-BLOG-UI-BUILDER-P13` | 開発環境へのリリースとsystem-specへの書き戻し | `tasks/feat-blog-ui-builder/sys-blog-ui-builder-p13.md` | docs/spec/feat-blog-ui-builder/release-report.md, system-spec/ui-ux.md, system-spec/frontend.md, system-spec/database.md |

## 機能内依存 (前方 DAG)

- `SYS-BLOG-UI-BUILDER-P01` ← (entry)
- `SYS-BLOG-UI-BUILDER-P02` ← `SYS-BLOG-UI-BUILDER-P01`
- `SYS-BLOG-UI-BUILDER-P03` ← `SYS-BLOG-UI-BUILDER-P02`
- `SYS-BLOG-UI-BUILDER-P04` ← `SYS-BLOG-UI-BUILDER-P03`
- `SYS-BLOG-UI-BUILDER-P05` ← `SYS-BLOG-UI-BUILDER-P04`
- `SYS-BLOG-UI-BUILDER-P06` ← `SYS-BLOG-UI-BUILDER-P05`
- `SYS-BLOG-UI-BUILDER-P07` ← `SYS-BLOG-UI-BUILDER-P06`
- `SYS-BLOG-UI-BUILDER-P08` ← `SYS-BLOG-UI-BUILDER-P05`
- `SYS-BLOG-UI-BUILDER-P09` ← `SYS-BLOG-UI-BUILDER-P08`
- `SYS-BLOG-UI-BUILDER-P10` ← `SYS-BLOG-UI-BUILDER-P09`
- `SYS-BLOG-UI-BUILDER-P11` ← `SYS-BLOG-UI-BUILDER-P07`, `SYS-BLOG-UI-BUILDER-P09`
- `SYS-BLOG-UI-BUILDER-P12` ← `SYS-BLOG-UI-BUILDER-P10`, `SYS-BLOG-UI-BUILDER-P11`
- `SYS-BLOG-UI-BUILDER-P13` ← `SYS-BLOG-UI-BUILDER-P12`

## 機能間依存 (entry gate)

- `feat-blog-ui-builder` depends_on: `feat-ui-foundation`, `feat-site-builder`, `feat-affiliate-hub`
- P01 着手前に上記 feature の完了を確認する (package からは `p01_entry_gate` 宣言を除去済み。ゲート判定は dev-graph scheduler が feature 間 depends_on から行う)

## gate 実行結果

- C11_validate_graph_schema: `{"command": "validate-graph-schema.py --graph .dev-graph/state/graph.json --repo-root .", "exit": 0, "valid": true, "violations": 0}`
- C02_saved_state: `{"implementation_readiness": "complete", "evaluation_status": "pass", "confirmation_status": "confirmed", "scope": "closure 16 node"}`
- source_digest: `{"command": "registered source_lineage.source_digest vs promoted published_digest", "checked": 13, "registered_mismatch": 0}`
- validate_system_plan: `{"command": "validate-system-plan.py --repo-root . --staging .dev-graph/published/feature-package-feat-blog-ui-builder", "exit": 0, "status": "pass", "violations": 0, "validated_digest": "sha256:9a2832f2d6f8656f3495435827399bed84d70c893a027d828694b07b46506fe1"}`

## handoff

- handoff file: `.dev-graph/handoff/task-graph/feat-blog-ui-builder.json`
- promoted generation: `.dev-graph/published/feature-package-feat-blog-ui-builder`
- 実装コード生成: 0 件 (本 verb は要件導出まで)

## 実装着手時の不変条件

- 各 task は `tasks/feat-blog-ui-builder/*.md` の write scope 内でのみ変更し、`feat-uiux-overhaul` が所有する管理画面全体の再編には踏み込まない (evaluator medium finding C1-scope-boundary)
- 参考ブログ (makuring.jp) は構成・配置・表記法の参考に留め、デザイン・文言の複製をしない
- worktree lease は `dev-graph worktree claim` 経由でのみ取得し、1 task 1 branch を守る
