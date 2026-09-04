---
graph_node_id: "feat-reference-blog-admin-ux"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "frontend"
tags: ["reference-analysis","blog","admin","cognitive-load","affiliate-preview","screen-inventory","non-copying"]
priority: "high"
start_date: "2026-08-29"
target_date: null
iteration: null
title: "参照ブログ解析と低認知負荷の運用 UX"
owners: ["daishiman"]
created_at: "2026-08-29T14:36:00Z"
updated_at: "2026-09-04T06:01:14.811140Z"
status: "active"
depends_on: ["feat-blog-ops-crud","feat-blog-ui-builder","feat-affiliate-inbox"]
related_nodes: ["spec-system-spec-index","arch-system-spec-overview","feat-affiliate-hub","feat-reader-surface"]
resource_scope: ["src","drizzle","docs/spec","system-spec","features/feat-reference-blog-admin-ux.context.json"]
purpose: "参照ブログの公開ページ群と現行管理画面を証跡付きで解析し、著作物・ブランドを複製せずに読みやすいブログ構成へ抽象化するとともに、運営者が新規作成・改善・保存・アフィリエイト確認を迷わず完了できる管理体験を作る"
goal: "14サブサイトマップの全公開URLを台帳化し、ページ型ごとの詳細解析・画面一覧・共通レイアウト・記事会話構成・非模倣トークンが実装可能な仕様になり、管理画面では1画面1目的、1つの主要操作、進行開示、自動保存と明示的保存の状態可視化、アフィリエイトURL貼付時の画像・商品・販売元・価格・重複プレビュー、掲載ページ逆引きまでが視覚的に一貫して操作できる状態になっている"
scope_in: ["参照サイトの14サブサイトマップと全公開canonical URLの台帳化。各URLを記事年別・固定ページ・カテゴリ・タグ・著者・比較/ナビゲーター等の画面型に分類し、型ごとに複数代表ページを詳細分析する","公開面の詳細画面一覧と解剖表: ヘッダー、フッター、本文カラム、サイドバー、パンくず、目次、開示、導入、H2/H3、会話/注意/比較/スペック/CTA、関連記事、著者、コメント、法務導線の順序・位置・表示条件","タイトル・導入・要約・会話・比較・まとめのリズムを再利用可能な記事構成ルールへ抽象化し、写真は独自の図解・比較図・フロー・アイコン・データ表に置換する","参照元の固有文章・写真・ロゴ・固有名・色値・テーマ資産は転用せず、情報階層と操作原則のみを独自デザイントークンと部品ルールに変換する非模倣ゲート","現行コードの公開面と管理面を実画面で点検し、実装済み・欠落・重複・迷いやすい操作・データが見えない箇所を画面単位のgap ledgerにする","管理画面の認知負荷低減: 1画面1目的、1つの視覚的主操作、日本語の動詞ラベル、進行開示、既定値、直接編集、インライン検証、キーボード対応、危険操作の分離、次にすべきことの明示","記事とサイトの新規作成→改善→保存→プレビュー→公開フロー。自動保存中/保存済み/未保存/競合/失敗を常時表示し、再試行と差分復元で入力を失わない","アフィリエイトURL貼付時にcanonical URL、商品名、販売元、画像、価格/取得時刻、取得元、重複候補、取得失敗理由、画像無しの図解フォールバックを確定前にプレビューする","アフィリエイト一覧に商品・提携先・状態・最終確認・掲載数・要確認を表示し、リンクから掲載サイト/ページ/ブロックへ逆引きしてその場で確認・差し替えできる","詳細画面一覧表と管理CRUD一覧表に、利用者、目的、入口、主操作、表示データ、空/読込/失敗/成功/権限状態、デスクトップ/モバイル構成、必要API/データ、受入基準を対応付ける","主要フローのaxe-core重大違反0、200% zoom、キーボード完結、状態の色のみ依存禁止、ユーザビリティ試験で保存状態判別とアフィリエイト掲載先特定を検証する"]
scope_out: ["参照サイトの有料・非公開・認証必要ページへのアクセス、robotsやアクセス制御の回避","参照元の文章・写真・ロゴ・イラスト・固有名・色値・CSS/テーマ/プラグインの複製","アフィリエイト成果の広告主別確定、報酬支払い、会計処理、自動の購入判定","第三者ECの保護されたAPIへの無断接続や画像の無断再配信","この段階での本番公開、全記事の再編集、既存データの一括破壊的移行"]
acceptance: ["参照サイトの14サブサイトマップに含まれる全公開canonical URLが重複を除いて台帳化され、URL数・取得日・画面型・代表証跡が欠落なく記録されている","全URLが画面型のいずれかに分類され、各画面型にデスクトップとモバイルの代表詳細解析が対応している","公開面と管理面の詳細画面一覧表が、本文/サイドバー/ヘッダー/フッターの位置、構成、状態、主操作、必要データ、受入基準を含む","参照元の文章・写真・ロゴ・固有名・色値を含まず、同等の情報階層を独自トークンと図解ブロックで表現できる","記事作成はテンプレート選択から最初の下書き保存まで主導線が1本で、必須項目だけで開始でき、不要な分岐や同等の主ボタンが表示されない","編集中は未保存・保存中・保存済み時刻・失敗・競合が常に文字とアイコンで判別でき、失敗時に入力を失わず再試行または差分復元できる","改善画面は指摘を重要度と該当箇所でまとめ、1件ずつ適用・プレビュー・取消しでき、一括適用は差分確認後に限定される","アフィリエイトURLを貼ると保存前にcanonical URL、商品名、販売元、画像または図解フォールバック、価格と取得時刻、取得元、重複候補、取得失敗理由がプレビューされる","アフィリエイト一覧で状態・提携先・最終確認・掲載数を絞り込みでき、1操作で掲載サイト/ページ/ブロックへ逆引きできる","新規作成・改善・保存・アフィリエイト確認のユーザビリティテストで、初見参加者がナビゲーション説明なしで主タスクを完了し、保存済み判別と掲載先特定の成功率が90%以上である","公開面と管理面の主要フローはaxe-coreの重大違反0件、200% zoomで機能欠落なし、キーボードのみで完結し、状態を色のみに依存しない","実装前の現行画面gap ledgerと実装後の受入証跡が同じ画面IDと要件IDで対応し、未解決の欠落が一覧で確認できる"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-reference-blog-admin-ux.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"a052d177cdedc029acbb2fd747bce579c0626bed5f6b64f9a94504ed6a2e75bd","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-reference-blog-admin-ux/a052d177cdedc029acbb2fd747bce579c0626bed5f6b64f9a94504ed6a2e75bd/plan-findings.json"}
source_lineage: {"imported_at":"2026-08-29T14:36:00Z","origin_kind":"generated","source_digest":"832eb4a42809637b35a5619a2d058cc4c8a184d2b770fd0693e94aeb0c497d00","source_path":"system-spec/frontend.md","source_plugin":"dev-graph","source_version":"0.1.0"}
classification_confidence: 0.98
classification_reason: "今回の新規要望を、参照サイトの全URL台帳と画面型別詳細解析、非模倣の公開面ブループリント、低認知負荷の管理CRUD、アフィリエイト即時プレビュー/掲載先逆引きを一体の観測可能なenhancement featureにマクロ分解した。既存CRUD基盤は再定義せずdepends_onで再利用する"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-reference-blog-admin-ux.md","confidence":0.98}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-08-29T14:38:12Z","missing_sections":[],"status":"complete"}
---

# 目的

参照ブログの公開ページ群と現行管理画面を証跡付きで解析し、著作物・ブランドを複製せずに読みやすいブログ構成へ抽象化する。同時に、運営者が新規作成・改善・保存・アフィリエイト確認を迷わず完了できる管理体験を作る。

## 分析ベースライン（2026-08-29）

- sitemap index: 14 sub-sitemaps
- 公開 canonical URL: 重複を除き 1,072 URL
- 記事年別URL: 2018–2026年、60 / 70 / 81 / 100 / 111 / 137 / 150 / 214 / 45件（計968）
- その他: 固定ページ17、カテゴリ32、タグ32、著者23（news sitemapの重複は除外）
- 代表詳細確認: ホーム/記事一覧、サイトマップ、カテゴリ、現行記事、プロフィール、比較/ナビゲーター、著者アーカイブ

「全ページ分析」は全URLを1件ずつ手作業で模写する意味ではなく、全URLを台帳と画面型で漏れなくカバーし、各画面型の代表ページを複数詳細解析する方法を採用する。これによりテンプレート差と例外を追跡可能にする。

## 観測した公開面の共通構成

- グローバルヘッダー、カテゴリ導線、検索、パンくず
- タイトル、更新日、導入、アフィリエイトカード、利点/注意点、広告開示、階層目次
- 促進/診断モジュール、スペック表、H2/H3本文、繰り返しCTA、まとめ
- 著者、関連記事、SNS、タグ、コメント
- 2カラムの本文+サイドバーと、カテゴリ/法務/運営者情報をまとめたフッター

## 現行管理面のギャップ

現行実装には管理shell、1画面1目的の一部、プログレス/結果表示、13ステップウィザード、下書きCRUD、アフィリエイト台帳がある。一方、URL貼付直後の商品・販売元・画像・価格・取得元・canonical・重複の統合プレビュー、保存状態の常時可視化、掲載ページ/ブロックへの逆引きが不足している。

## スコープ

- スコープ内: frontmatter `scope_in` の11項目を正本とする。
- スコープ外: frontmatter `scope_out` の5項目を正本とする。

## 受入

frontmatter `acceptance` の1始まりの順番を A1–A12 のcanonical IDとする。実装計画・requirements・テストはこのIDにtraceする。

## アーキテクチャ参照

- `architecture_refs`: `arch-system-spec-overview`, `arch-two-layer-platform`
- 仕様正本: `system-spec/ui-ux.md`, `system-spec/frontend.md`, `system-spec/completeness-report.json`

## 機能間依存

- `depends_on`: `feat-blog-ops-crud`, `feat-blog-ui-builder`, `feat-affiliate-inbox`
- 依存理由: 既存のブログCRUD・公開レイアウト・アフィリエイト受信箱を基盤にし、重複実装を避けて解析証跡と運用UXを強化する。

## Handoff

- per-feature planning: `run-system-dev-plan --feature-id feat-reference-blog-admin-ux --feature-context features/feat-reference-blog-admin-ux.context.json`
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG
- 登録先: 全taskを同一 `parent_feature` / `feature_package_id` で C02 経由atomic登録する。expected/applied=13必須。
- 完了rollup: exact 13全doneとA1–A12の現行証跡が揃ったときだけfeatureをdoneにする。
