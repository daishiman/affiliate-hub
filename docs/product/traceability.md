# 要件追跡表（双方向トレーサビリティ）

- 形式: ブログ層仕様 付属 §4-F の `trace` 形式に統一
- 根拠: プラットフォーム層 §30.8（双方向トレーサビリティは必須）
- 最終更新: 2026-08-16 / 対象コミット: `f0fd783`（層構造・共通UI・順位画面まで）
- 判定語彙: **実装済** = 動作する実体がある / **スタブ** = 形はあるが中身が仮 / **未着手** = 実体なし / **未対応** = UI/UX の観点として明示的に未対応
- **証拠のない PASS を出さない。** `evidence` が空の行は実装済としない。`test` が `NOT RUN` の行は「テスト未実行」を意味し、実装済であっても検証済とは書かない。

## 列の意味（message B の要求）

| 列 | 意味 |
| --- | --- |
| 実装 | 実装場所（ファイルパス）。未着手は `—` |
| 画面 | route または component path。UI 義務がない要件は `画面義務なし` |
| 導線 | その画面へどこから到達するか。孤立ページは禁止 |
| 状態 | loading / empty / error / 権限なし の4状態への対応 |
| RWD | レスポンシブ対応 |
| a11y | キーボード操作・フォーカス・ラベル・コントラスト |
| 結果 | 実装済 / スタブ / 未着手 |

---

## A. プラットフォーム層 機能モジュール（§9.1〜§9.10）

| REQ | 要件 | 実装 | 画面 | 導線 | 状態 | RWD | a11y | test | 結果 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-P01 | §9.1 Workspace／Brand管理（テナント分離・ブランド属性・編集/AI/広告方針・禁止表現・標準CTA/免責・言語・TZ） | `src/domain/shared/tenancy.ts`（型のみ） | 未着手 | 未着手 | 未対応 | 未対応 | 未対応 | NOT RUN | 未着手 |
| REQ-P02 | §9.2 アフィリエイトURL受信箱（貼付・CSV・API・拡張・WebMCP・重複検出・分類・リンク状態・商品候補・4状態管理） | — | 未着手 | 未着手 | 未対応 | 未対応 | 未対応 | NOT RUN | 未着手 |
| REQ-P03 | §9.3 商品インテリジェンス（21属性・情報源・信頼度・有効期限） | `src/db/schema.ts` products（部分） | 未着手 | 未着手 | 未対応 | 未対応 | 未対応 | NOT RUN | スタブ |
| REQ-P04 | §9.4 比較エンジン（Exact Offer / Variant / Direct Competitor / Alternative Solution の4分類） | `src/domain/ranking/`（順位付けは実装済。候補の4分類は未実装） | `/admin/rankings` | サイドナビ「評価基準と順位」+ ホームの「いま試せること」 | empty / error / 選外理由に対応 | 対応（48rem で表を縦積み） | 対応（表見出しに `scope`、数字は等幅、コントラストAA） | PASS（`tests/presentation/composition.test.ts`） | スタブ |
| REQ-P05 | §9.5 Persona Studio（書き手・読者・話し方・実体験・資格・禁止事項・事実境界 §13.3） | — | 未着手 | 未着手 | 未対応 | 未対応 | 未対応 | NOT RUN | 未着手 |
| REQ-P06 | §9.6 AI Content Studio（生成マトリクス・切り口16種・出力契約・自動品質確認17項目） | `docs/spec/07-生成基盤設計.md`（設計のみ） | 未着手 | 未着手 | 未対応 | 未対応 | 未対応 | NOT RUN | 未着手 |
| REQ-P07 | §9.7 Site Builder（10パターン・ウィザード13ステップ・Blueprint・ページ構造・内部リンク・SEO） | `docs/spec/06-…テンプレート.md`（設計のみ） | 未着手 | 未着手 | 未対応 | 未対応 | 未対応 | NOT RUN | 未着手 |
| REQ-P08 | §9.8 Distribution Hub（Connector契約・予約・投稿・失敗リトライ・Publication状態8+異常5） | — | 未着手 | 未着手 | 未対応 | 未対応 | 未対応 | NOT RUN | 未着手 |
| REQ-P09 | §9.9 Affiliate Hub（ASP・プログラム・リンク原本・TrackingLink・リンク切れ・成果） | `src/db/schema.ts` asps/programs/conversions、`src/app/page.tsx`（一覧表示のみ） | `/`（トップ） | ルートのみ | error のみ（DB未接続メッセージ） | 一部 | 未対応 | NOT RUN | スタブ |
| REQ-P10 | §9.10 Analytics（商品・コンテンツ・書き手・読者・媒体・切り口・CTA・販売店・ASP・ブログ・投稿日時の11軸絞込） | `src/lib/mcp/tools.ts` `get_revenue_summary`（1軸のみ） | 未着手 | 未着手 | 未対応 | 未対応 | 未対応 | NOT RUN | スタブ |

## B. プラットフォーム層 主要画面（§22.1〜§22.8）

| REQ | 要件 | 実装 | 画面 | 導線 | 状態 | RWD | a11y | test | 結果 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-S01 | §22.1 ダッシュボード（11ウィジェット） | — | `/(admin)/dashboard` 予定 | サイドナビ先頭 | 未対応 | 未対応 | 未対応 | NOT RUN | 未着手 |
| REQ-S02 | §22.2 Affiliate Inbox（9要素） | — | `/(admin)/inbox` 予定 | サイドナビ | 未対応 | 未対応 | 未対応 | NOT RUN | 未着手 |
| REQ-S03 | §22.3 Product Intelligence（11要素） | — | `/(admin)/products` 予定 | サイドナビ + Inbox の商品候補 | 未対応 | 未対応 | 未対応 | NOT RUN | 未着手 |
| REQ-S04 | §22.4 Persona Studio（8要素） | — | `/(admin)/personas` 予定 | サイドナビ | 未対応 | 未対応 | 未対応 | NOT RUN | 未着手 |
| REQ-S05 | §22.5 Content Matrix（3行軸 × 7媒体列） | — | `/(admin)/content` 予定 | サイドナビ + 商品詳細 | 未対応 | 未対応 | 未対応 | NOT RUN | 未着手 |
| REQ-S06 | §22.6 Site Builder（11要素） | — | `/(admin)/sites` 予定 | サイドナビ | 未対応 | 未対応 | 未対応 | NOT RUN | 未着手 |
| REQ-S07 | §22.7 Publication Calendar（8要素・ドラッグ変更） | — | `/(admin)/calendar` 予定 | サイドナビ | 未対応 | 未対応 | 未対応 | NOT RUN | 未着手 |
| REQ-S08 | §22.8 Analytics（11軸絞込） | — | `/(admin)/analytics` 予定 | サイドナビ | 未対応 | 未対応 | 未対応 | NOT RUN | 未着手 |
| REQ-S09 | 共通レイアウト（サイドナビ・現在地表示・退避先・権限による表示制御） | `src/presentation/ui/app-shell.tsx`、`tokens.css`、`button.tsx`、`field.tsx`、`state-view.tsx`、`callout.tsx`（権限による表示制御のみ未対応。認証が入るまで保留のためスタブ判定） | `src/app/admin/layout.tsx` + 各ページで `AppShell` | サイドナビ `ADMIN_NAV`（10項目） | loading / empty / error / 操作不可の4状態を部品化（title・body・reason を必須にして無言を防止） | 対応（48rem で段組み解除、表は縦積み） | 対応（`aria-current`・`:focus-visible` の共通リング・44px 最小・`prefers-reduced-motion`） | PASS（`tests/presentation/composition.test.ts`） | スタブ |
| REQ-S10 | 認証画面（Google OAuth・サインイン・サインアウト・招待受諾） | — | `/(auth)/signin` 予定 | 未認証時の全画面から | 未対応 | 未対応 | 未対応 | NOT RUN | 未着手 |

## C. ブログ層 情報アーキテクチャ（§7 全18ルート）

| REQ | ルート | 実装 | 導線 | 状態 | RWD | a11y | test | 結果 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-B01 | `/`（トップ：10ブロック） | — | — | 未対応 | 未対応 | 未対応 | NOT RUN | 未着手 |
| REQ-B02 | `/categories/{category}`（9ブロック） | — | トップ + グローバルナビ | 未対応 | 未対応 | 未対応 | NOT RUN | 未着手 |
| REQ-B03 | `/best/{topic}`（ランキング記事） | — | トップ・カテゴリ | 未対応 | 未対応 | 未対応 | NOT RUN | 未着手 |
| REQ-B04 | `/reviews/{product}`（個別レビュー） | — | ランキング商品カード | 未対応 | 未対応 | 未対応 | NOT RUN | 未着手 |
| REQ-B05 | `/compare/{comparison}`（比較記事） | — | カテゴリ・記事内リンク | 未対応 | 未対応 | 未対応 | NOT RUN | 未着手 |
| REQ-B06 | `/guides/{topic}`（ハウツー・初心者ガイド） | — | トップ初心者導線 | 未対応 | 未対応 | 未対応 | NOT RUN | 未着手 |
| REQ-B07 | `/tools/{tool}`（診断・計算） | — | トップ・カテゴリ | 未対応 | 未対応 | 未対応 | NOT RUN | 未着手 |
| REQ-B08 | `/search`（自然言語検索） | — | ヘッダ常設 | 未対応 | 未対応 | 未対応 | NOT RUN | 未着手 |
| REQ-B09 | `/shortlist`（候補の保存） | — | 各商品カードの保存操作 | 未対応 | 未対応 | 未対応 | NOT RUN | 未着手 |
| REQ-B10 | `/authors/{author}` | — | 記事の byline | 未対応 | 未対応 | 未対応 | NOT RUN | 未着手 |
| REQ-B11 | `/experts/{expert}` | — | 記事の監修者表示 | 未対応 | 未対応 | 未対応 | NOT RUN | 未着手 |
| REQ-B12 | `/methodology`（評価方法） | — | 記事の評価基準セクション | 未対応 | 未対応 | 未対応 | NOT RUN | 未着手 |
| REQ-B13 | `/editorial-policy` | — | フッタ | 未対応 | 未対応 | 未対応 | NOT RUN | 未着手 |
| REQ-B14 | `/advertising-policy` | — | フッタ + 記事の広告表記 | 未対応 | 未対応 | 未対応 | NOT RUN | 未着手 |
| REQ-B15 | `/ai-policy` | — | フッタ | 未対応 | 未対応 | 未対応 | NOT RUN | 未着手 |
| REQ-B16 | `/corrections`（訂正） | — | フッタ + 記事の訂正報告 | 未対応 | 未対応 | 未対応 | NOT RUN | 未着手 |
| REQ-B17 | `/privacy` + `/terms` | — | フッタ | 未対応 | 未対応 | 未対応 | NOT RUN | 未着手 |
| REQ-B18 | `/contact` | — | フッタ | 未対応 | 未対応 | 未対応 | NOT RUN | 未着手 |

## D. 記事構成・文章（ブログ層 §8〜§11、プラットフォーム層 §16.4〜§16.6）

| REQ | 要件 | 実装 | 画面 | test | 結果 |
| --- | --- | --- | --- | --- | --- |
| REQ-W01 | §8 記事共通構成 25セクション | `docs/spec/06-…` §3-1（定義のみ） | REQ-B03〜B06 に内包 | NOT RUN | 未着手 |
| REQ-W02 | §9.1 ランキング記事の body 構成 | `docs/spec/06-…` §3-2 / §5 | REQ-B03 | NOT RUN | 未着手 |
| REQ-W03 | §9.2 個別レビューの body 構成 | `docs/spec/06-…` §3-2 | REQ-B04 | NOT RUN | 未着手 |
| REQ-W04 | §9.3 比較記事の body 構成 | `docs/spec/06-…` §3-2 | REQ-B05 | NOT RUN | 未着手 |
| REQ-W05 | §9.4 ハウツー記事の body 構成 | `docs/spec/06-…` §3-2 | REQ-B06 | NOT RUN | 未着手 |
| REQ-W06 | §10.1 文章の基本順序（結論→理由→根拠→具体例→例外→意味→行動） | `docs/spec/05-…` §1-1 | 画面義務なし | NOT RUN | 未着手 |
| REQ-W07 | §10.2 事実6分類の書き分けと文中表示 | `docs/spec/05-…` §4、`src/domain/shared/data-classification.ts` | 記事本文の `data-fact-type` | NOT RUN | スタブ |
| REQ-W08 | §10.3 スタイル規則（文長・段落・単位・日付・禁止表現） | `docs/spec/05-…` §2 | 画面義務なし | NOT RUN | 未着手 |
| REQ-W09 | §11 会話・吹き出し（4話者・連続最大2・40〜120字・話者名表示・色以外での区別） | `docs/spec/05-…`、`src/db/schema.ts` conversationBlocks | 記事本文 | NOT RUN | スタブ |
| REQ-W10 | §16.6 マルチサイト重複対策（10軸差別化・言い換え禁止） | `docs/spec/05-…` §6 | 画面義務なし | NOT RUN | 未着手 |
| REQ-W11 | セクション別雛形（一文結論・リード文・評価基準・商品カード・デメリット・FAQ・最終結論） | `docs/spec/05-…` §3 | 画面義務なし | NOT RUN | 未着手 |
| REQ-W12 | ペルソナ差分の事実境界（fact_fingerprint 不変） | `docs/spec/05-…` §5 | Persona Studio | NOT RUN | 未着手 |

## E. 生成基盤（本作業で新設）

| REQ | 要件 | 実装 | 画面 | test | 結果 |
| --- | --- | --- | --- | --- | --- |
| REQ-G01 | プロンプト設計（配置・バージョニング・7ブロック構造） | `docs/spec/07-…` §1 | 画面義務なし | NOT RUN | 未着手 |
| REQ-G02 | 入力変数の型固定（§15.1 の必須14項目 + 3追加） | `docs/spec/07-…` §1-2 | 画面義務なし | NOT RUN | 未着手 |
| REQ-G03 | プロンプトインジェクション対策（5対策） | `docs/spec/07-…` §1-4 | 画面義務なし | NOT RUN | 未着手 |
| REQ-G04 | 出力契約 `generated_variant` の JSON Schema 化 | `docs/spec/07-…` §1-5 | 画面義務なし | NOT RUN | 未着手 |
| REQ-G05 | スキル8種（構成/本文/比較表/会話/媒体変換/品質検査/広告表記/メタ） | `docs/spec/07-…` §2 | Content Matrix から起動 | NOT RUN | 未着手 |
| REQ-G06 | サブエージェント6種（researcher/writer/fact-checker/compliance/channel/editor） | `docs/spec/07-…` §3 | Content Matrix の実行状況表示 | NOT RUN | 未着手 |
| REQ-G07 | 執筆系と検証系の分離（GC-5） | `docs/spec/07-…` §3-2 | 画面義務なし | NOT RUN | 未着手 |
| REQ-G08 | 承認フロー（§18.1 12段階）との接続 | `docs/spec/07-…` §3-3 | Content Matrix / 承認画面 | NOT RUN | 未着手 |
| REQ-G09 | 評価セット 50件以上（網羅12+9+8+5 / 敵対8 / 境界8） | `docs/spec/07-…` §4 | 画面義務なし | NOT RUN | 未着手 |
| REQ-G10 | ローンチ基準 LB-1〜LB-8 と CI 連携 | `docs/spec/07-…` §4-3 | 画面義務なし | NOT RUN | 未着手 |

## F. データモデル（§21 全32エンティティ）

`スキーマ` = `src/db/schema.ts` に定義あり / `ドメイン` = `src/domain/` に型あり。

| REQ | エンティティ | スキーマ | ドメイン | 管理画面 | 結果 |
| --- | --- | --- | --- | --- | --- |
| REQ-E01 | Workspace | 未 | `shared/tenancy.ts` 型のみ | REQ-S09 | スタブ |
| REQ-E02 | User | 未 | 未 | REQ-S10 | 未着手 |
| REQ-E03 | Membership | 未 | 未 | REQ-S09 | 未着手 |
| REQ-E04 | Brand | 未 | 未 | REQ-S06 | 未着手 |
| REQ-E05 | Site | 未 | 未 | REQ-S06 | 未着手 |
| REQ-E06 | SiteBlueprint | 未 | 未 | REQ-S06 | 未着手 |
| REQ-E07 | AuthorPersona | `people`（部分） | 未 | REQ-S04 | スタブ |
| REQ-E08 | AudiencePersona | 未 | 未 | REQ-S04 | 未着手 |
| REQ-E09 | ChannelConnection | 未 | 未 | REQ-S07 | 未着手 |
| REQ-E10 | AffiliateAccount | `asps`（部分） | 未 | REQ-P09 | スタブ |
| REQ-E11 | AffiliateProgram | `programs` | 未 | `/`（一覧のみ） | スタブ |
| REQ-E12 | AffiliateLink | 未 | 未 | REQ-P09 | 未着手 |
| REQ-E13 | TrackingLink（リポジトリ追補 §19.2.1） | 未 | 未 | REQ-P09 | 未着手 |
| REQ-E14 | SourceArtifact | 未 | `shared/provenance.ts` 型 | REQ-S03 | スタブ |
| REQ-E15 | Product | `products` | 未 | REQ-S03 | スタブ |
| REQ-E16 | ProductVariant | 未 | 未 | REQ-S03 | 未着手 |
| REQ-E17 | MerchantOffer | 未 | 未 | REQ-S03 | 未着手 |
| REQ-E18 | ComparisonSet | 未 | 未 | REQ-S03 | 未着手 |
| REQ-E19 | Claim | 未 | `evidence/claim.ts` | REQ-S03 | スタブ |
| REQ-E20 | Evidence | 未 | `evidence/evidence.ts` | REQ-S03 | スタブ |
| REQ-E21 | TestRun | 未 | 未 | REQ-S03 | 未着手 |
| REQ-E22 | Campaign | 未 | 未 | REQ-S07 | 未着手 |
| REQ-E23 | ContentPackage | 未 | 未 | REQ-S05 | 未着手 |
| REQ-E24 | MasterBrief | 未 | 未 | REQ-S05 | 未着手 |
| REQ-E25 | ContentVariant | `articles`（部分） | 未 | REQ-S05 | スタブ |
| REQ-E26 | Asset | 未 | 未 | REQ-S06 | 未着手 |
| REQ-E27 | Publication | 未 | 未 | REQ-S07 | 未着手 |
| REQ-E28 | Metric | 未 | 未 | REQ-S08 | 未着手 |
| REQ-E29 | Conversion | `conversions` | 未 | REQ-S08 | スタブ |
| REQ-E30 | Experiment | 未 | 未 | REQ-S08 | 未着手 |
| REQ-E31 | PolicyRule | `disclosures`（部分） | 未 | REQ-S06 | スタブ |
| REQ-E32 | AuditLog | 未 | 未 | REQ-S09 | 未着手 |

補助テーブル（§21 に明示はないが実装済）: `categories`, `articlePeople`, `articleProducts`, `faqs`, `updateLogs`。

## G. API とイベント（§23）

| REQ | 要件 | 実装 | test | 結果 |
| --- | --- | --- | --- | --- |
| REQ-API01 | §23.1 REST/RPC エンドポイント群（受信箱・商品・比較・生成・公開・分析） | `src/app/api/mcp/route.ts` のみ | NOT RUN | スタブ |
| REQ-API02 | 認可（テナント境界・ロール）を全エンドポイントで強制 | `src/lib/mcp/auth.ts`（MCP のみ） | NOT RUN | スタブ |
| REQ-EV01〜16 | §23.2 イベント16種（`affiliate_url.submitted` 〜 `conversion.received`） | — | NOT RUN | 未着手 |

イベント16種の内訳: `affiliate_url.submitted` / `affiliate_url.resolved` / `product.matched` / `product.enriched` / `comparison.ready` / `content_package.created` / `content_variant.generated` / `content_variant.approved` / `publication.scheduled` / `publication.published` / `publication.failed` / `affiliate_link.broken` / `affiliate_program.terminated` / `claim.expired` / `content.refresh_due` / `conversion.received` — **全16件が未着手**。

## H. WebMCP（管理側 §24.1 / 読者側 ブログ層 §14.2）

| REQ | 要件 | 実装 | 通常UI経路（FD-4） | 結果 |
| --- | --- | --- | --- | --- |
| REQ-WA01 | 管理側 読み取り10種（`search_affiliate_sources` 〜 `get_publication_status`） | — | REQ-S01〜S08 | 未着手 |
| REQ-WA02 | 管理側 状態変更8種（`create_affiliate_source_draft` 〜 `publish_approved_content`）+ 確認必須 | — | REQ-S01〜S08 | 未着手 |
| REQ-WB01 | 読者側 読み取り9種（`list_ranking`/`get_product`/`compare_products`/`get_evidence`/`list_test_runs`/`explain_ranking`/`filter_products`/`get_disclosure`/`find_alternatives`） | — | REQ-B01〜B09 | 未着手 |
| REQ-WB02 | 読者側 状態変更1種（`submit_feedback`）+ 確認UI | — | REQ-B16 | 未着手 |
| REQ-WC01 | `document.modelContext` を正規経路にする（CHG-001） | `src/lib/webmcp/client.ts` | — | 実装済 |
| REQ-WC02 | 能力検出 → 非対応時は通常UIへフォールバック | `src/lib/webmcp/client.ts` `resolveModelContext()` | — | 実装済 |
| REQ-WC03 | 機能フラグ配下での有効化 | — | — | 未着手 |
| REQ-WC04 | 1ページ6ツール以下・読み取り専用から導入 | — | — | 未着手 |
| REQ-WC05 | 宣言型フォーム（`toolname`/`tooldescription`/`toolparamdescription`、状態変更に `toolautosubmit` 不使用） | — | — | 未着手 |
| REQ-WC06 | §14.6 オリジン制約 | — | — | 未着手 |
| REQ-WC07 | §16.4 エラー形式 | — | — | 未着手 |
| REQ-WC08 | 現行の3ツール（`list_programs`/`record_conversion`/`get_revenue_summary`）は暫定 | `src/lib/mcp/specs.ts` | `/` | スタブ |

## I. バックエンドMCP（§24.3）

| REQ | 要件 | 実装 | 結果 |
| --- | --- | --- | --- |
| REQ-M01 | Resources 8種 | — | 未着手 |
| REQ-M02 | Tools 8種 | — | 未着手 |
| REQ-M03 | MCP エンドポイントと認可 | `src/app/api/mcp/route.ts`、`src/lib/mcp/auth.ts`（旧実装）。新しい入口は `src/presentation/tools/mcp-adapter.ts` と `src/app/api/tools/`（REST）。両者の統合は残課題9 | スタブ |

## J. 権限（§25 全10ロール）

| REQ | ロール | 実装 | 画面での表現 | 結果 |
| --- | --- | --- | --- | --- |
| REQ-R01 | Owner | — | 権限なし状態の表示を含む | 未着手 |
| REQ-R02 | Workspace Admin | — | 同上 | 未着手 |
| REQ-R03 | Brand Manager | — | 同上 | 未着手 |
| REQ-R04 | Researcher | — | 同上 | 未着手 |
| REQ-R05 | Writer | — | 同上 | 未着手 |
| REQ-R06 | Reviewer | — | 同上 | 未着手 |
| REQ-R07 | Publisher | — | 同上 | 未着手 |
| REQ-R08 | Analyst | — | 同上 | 未着手 |
| REQ-R09 | Contributor | — | 同上 | 未着手 |
| REQ-R10 | AI Service Account（下書き・分析のみ。原則公開不可） | — | 同上 | 未着手 |
| REQ-R11 | 公開権限と編集権限の分離 | — | 承認フロー画面 | 未着手 |

## K. セキュリティ・コンプライアンス（§26、§17、ブログ層 §16.1・§17.2・§20）

| REQ | 要件 | 実装 | test | 結果 |
| --- | --- | --- | --- | --- |
| REQ-SEC01 | §26.4 テナント分離（全クエリに workspace_id 制約） | `src/domain/shared/tenancy.ts`（型のみ） | NOT RUN | スタブ |
| REQ-SEC02 | URL取り込みの SSRF 対策（private IP・redirect・スキーム制限） | — | NOT RUN | 未着手 |
| REQ-SEC03 | provenance（§10.5）の記録 | `src/domain/shared/provenance.ts` | NOT RUN | スタブ |
| REQ-SEC04 | §19.4 編集評価と報酬データの分離（Ranking Service は Editorial のみ） | `src/domain/ranking/`（型による排除は未実装） | NOT RUN | スタブ |
| REQ-SEC05 | プロンプトインジェクション対策（ブログ層 §16.1） | `docs/spec/07-…` §1-4（設計のみ） | NOT RUN | 未着手 |
| REQ-SEC06 | `rel="sponsored"`（ブログ層 §17.2） | — | NOT RUN | 未着手 |
| REQ-SEC07 | 広告表示・コンプライアンス（薬機法・景表法・ASP規約） | — | NOT RUN | 未着手 |
| REQ-SEC08 | WCAG 2.2 AA（ブログ層 §20） | — | NOT RUN | 未着手 |
| REQ-SEC09 | 監査ログ（AuditLog） | — | NOT RUN | 未着手 |
| REQ-SEC10 | 秘密情報の取り扱い（Secrets は wrangler secret、リポジトリに置かない） | `.gitignore`（`.dev.vars`） | NOT RUN | 実装済 |

## L. 品質検査（`05-文章作成メソッド仕様.md` §7 の QC-01〜QC-17）

| REQ | 検査 | 実装 | 結果 |
| --- | --- | --- | --- |
| REQ-QC01 | QC-01 必須セクションの存在 | `src/lib/content/publish-gate.ts`（一部） | スタブ |
| REQ-QC02 | QC-02〜QC-04 段落・文長・見出し | — | 未着手 |
| REQ-QC03 | QC-05 禁止表現 | — | 未着手 |
| REQ-QC04 | QC-06 事実分類の付与 | `src/domain/shared/data-classification.ts` | スタブ |
| REQ-QC05 | QC-07 根拠のない主張 | `src/domain/evidence/claim.ts` `isClaimUsable` | スタブ |
| REQ-QC06 | QC-08〜QC-10 単位・結論一致・日付 | — | 未着手 |
| REQ-QC07 | QC-11 ペルソナ差分の事実境界 | — | 未着手 |
| REQ-QC08 | QC-12 マルチサイト重複 | — | 未着手 |
| REQ-QC09 | QC-13 広告表記 | `src/db/schema.ts` disclosures | スタブ |
| REQ-QC10 | QC-14 会話ブロック制約 | — | 未着手 |
| REQ-QC11 | QC-15〜QC-17 薬機法・景表法・アクセシビリティ | — | 未着手 |
| REQ-QC12 | 公開ゲート（ブログ層 §21 の11項目） | `src/lib/content/publish-gate.ts` | スタブ |

## M. 禁止依存（ブログ層 §27）

| REQ | 要件 | 検査方法 | 実装 | 結果 |
| --- | --- | --- | --- | --- |
| REQ-FD01 | ランキング式の重複実装禁止 | `tests/architecture/dependency-direction.test.ts`「ランキングの計算は domain/ranking の外に無い」 | `src/domain/ranking/scoring.ts` に集約 | 実装済 |
| REQ-FD02 | 報酬データを推薦スコア入力にしない | `Editorial<T>`/`Commercial<T>` の型 + 組み立て時の実行時検査 + `tests/architecture/commercial-isolation.test.ts` | `src/domain/shared/data-classification.ts`、`src/application/usecases/ranking/rank-products.ts` | 実装済 |
| REQ-FD03 | 根拠のない主張を公開しない | 公開ゲート QC-07 | `publish-gate.ts`（部分） | スタブ |
| REQ-FD04 | WebMCP でしか到達できない機能を作らない | 1つのカタログを4入口へ写す（`tests/presentation/one-usecase-three-adapters.test.ts`、`tests/presentation/composition.test.ts`） | `src/presentation/tools/catalog.ts`、`src/presentation/composition.ts` | 実装済 |
| REQ-FD05 | ブログ層で正規データを再定義しない | スキーマ定義が `src/db/schema.ts` のみであること | 実装済（現状1箇所） | 実装済 |

## N. 受け入れ条件（プラットフォーム層 §30.1〜§30.8）

| REQ | 条件 | 検証方法 | 結果 |
| --- | --- | --- | --- |
| REQ-A01 | §30.1 | 受け入れテストとして実装予定 | 未着手 |
| REQ-A02 | §30.2 | 同上 | 未着手 |
| REQ-A03 | §30.3 | 同上 | 未着手 |
| REQ-A04 | §30.4 根拠のない主張は公開不可 | 公開ゲートのテスト | スタブ |
| REQ-A05 | §30.5 | 同上 | 未着手 |
| REQ-A06 | §30.6 | 同上 | 未着手 |
| REQ-A07 | §30.7 | 同上 | 未着手 |
| REQ-A08 | §30.8 双方向トレーサビリティ | **本ファイルがその実体** | 実装済 |

---

## 集計（2026-08-16 時点）

### 全機能

| 区分 | 件数 |
| --- | --- |
| **全要件数 N** | **156** |
| 実装済 X | 8 |
| スタブ Y | 32 |
| 未着手 Z | 116 |

集計方法: 本ファイル内で `| REQ-` から始まる行を機械的に数えた値。手計算ではない。

```bash
grep -cE '^\| REQ-'            docs/product/traceability.md   # → 156
grep -cE '^\| REQ-.*実装済 \|$' docs/product/traceability.md   # → 8
grep -cE '^\| REQ-.*スタブ \|$' docs/product/traceability.md   # → 32
grep -cE '^\| REQ-.*未着手 \|$' docs/product/traceability.md   # → 116
```

節ごとの内訳: A 10 / B 10 / C 18 / D 12 / E 10 / F 32 / G 3（イベント16種は `REQ-EV01〜16` の1行に集約し、実体16件は同節本文に全件列挙） / H 12 / I 3 / J 11 / K 10 / L 12 / M 5 / N 8

### UI/UX（画面義務のある要件のみ）

画面義務のある要件 = A(10) + B(10) + C(18) + F(32、管理画面が必要) = **70**

| 区分 | 件数 |
| --- | --- |
| **画面義務のある機能 N** | **70** |
| 画面あり X | 2（REQ-P04 の順位画面 `/admin/rankings`、REQ-P09 の案件一覧 `/`） |
| 画面スタブ Y | 1（REQ-S09 共通レイアウト。部品と骨格は実装済、権限による表示制御が未対応） |
| 画面なし Z | 67 |

共通UI基盤（トークン・ボタン・入力欄・状態表示・理由表示・画面骨格）は実装済で、
残り 67 件は「基盤の上に画面を1枚ずつ載せる」作業。基盤づくりからのやり直しは発生しない。

管理画面のホーム `/admin` は要件行を持たない案内ページのため、上の集計には数えていない。

### まだ中身が無いもの（スタブ）の内訳

つなぎ目だけあって中身が無いものは **22件**。一覧と、それぞれ何が済めば実装できるかは
`docs/product/stub-ledger.md`（コードから生成、手書きではない）。

| 区分 | 件数 |
| --- | --- |
| ASP 連携 | 8 |
| 配信チャネル | 8（note は「直接投稿できない」と宣言済みのため対象外） |
| 生成AI の提供元 | 3 |
| 保存先（見本データ） | 1 |
| ログイン情報（見本） | 1 |
| ファイルの一時公開URL | 1 |

### Z（未着手）が 0 でない理由

**理由は1つに集約される: 本セッションは仕様の統合・分解・計画までを完了させ、実装は未着手のまま残っている。**

- 依頼された11 verb のうち、`spec` の再実行に必要な統合仕様（`04`〜`07`）と本トレーサビリティ表を先に作成した。実装（画面68枚・エンティティ26件・イベント16種など）はこの表を入力として `decompose` → `plan` → 実装タスクへ展開する対象であり、**本セッション時点では未着手であることを事実として報告する**。
- 「まずはコア機能から」といったスコープ縮小は行っていない。139件すべてを表に載せ、1件も未分類にしていない。
- 実装済 5件の内訳: REQ-WC01 / REQ-WC02（`document.modelContext` 移行）、REQ-SEC10（秘密情報の取り扱い）、REQ-FD05（スキーマ定義の一元化）、REQ-A08（本表）。いずれも `evidence` としてファイルパスを持つ。
- **`test` 列は原則 `NOT RUN` である。** `PASS` と書いた行だけが自動テストで確認済み（REQ-P04 / REQ-S09 / REQ-FD01 / REQ-FD02 / REQ-FD04）。それ以外は実装済であっても検証済とは書かない（証拠のない PASS を出さない）。
- 実装済 8件のうち本作業で加わったのは REQ-FD01（ランキング式の重複禁止）・REQ-FD02（報酬をランキングの入力にしない）・REQ-FD04（AI からしか使えない機能を作らない）の3件。いずれも文書の宣言ではなく、`pnpm run lint` と `pnpm test` が落ちる形で担保している。
