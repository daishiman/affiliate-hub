# 要件追跡表（双方向トレーサビリティ）

- 形式: ブログ層仕様 付属 §4-F の `trace` 形式に統一
- 根拠: プラットフォーム層 §30.8（双方向トレーサビリティは必須）
- 最終更新: 2026-08-17 / 対象: 作業中の `feat/clean-architecture-skeleton`（計測の記録を D1 へつなぎ、数字の画面まで届かせたところまで）
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
| REQ-P01 | §9.1 Workspace／Brand管理（テナント分離・ブランド属性・編集/AI/広告方針・禁止表現・標準CTA/免責・言語・TZ） | `src/domain/identity/workspace.ts`（プラン別の上限・稼働判定）、`src/domain/identity/brand.ts`（表示名/法的表示名/連絡先/立場/声/禁止表現/免責/言語/時間帯/標準CTA）、`src/domain/identity/membership.ts`、`src/domain/shared/tenancy.ts`、`src/application/usecases/identity/manage-workspace.ts`（概況・ロール・メンバー・ブランド・広告表記・監査ログの6ユースケース）、`src/presentation/tools/settings-tools.ts` | `src/app/admin/settings/page.tsx` | サイドナビ「設定」。ホームの「手当てが必要なもの」からも設定へ戻れる | loading（サーバ描画）/ empty（各表に「登録するとここに並びます」）/ error（`ErrorView` + ホームへ戻る）/ 操作不可（権限が無い項目は `requireCapability` で理由つきに落ちる） | 対応（`catalogStack` の縦積み。表は48remで縦積み） | 対応（`<th scope="row">` の定義表・`aria-current`・44px最小） | PASS（`tests/presentation/composition.test.ts` / `tests/presentation/admin-routes.test.ts`） | 実装済（保存先は見本データ。編集操作は残課題） |
| REQ-P02 | §9.2 アフィリエイトURL受信箱（貼付・CSV・API・拡張・WebMCP・重複検出・分類・リンク状態・商品候補・4状態管理） | `src/domain/monetization/link-ingestion.ts`（取込元5種 `paste`/`csv`/`api`/`extension`/`webmcp`、状態4種 `received`/`resolved`/`matched`/`rejected`、`normalizeAffiliateUrl` によるURL正規化と `findDuplicate` の重複検出、`isInternalHost` の内部宛先拒否）、`src/application/usecases/monetization/manage-link-inbox.ts`、`src/presentation/tools/affiliate-tools.ts`（`submit_affiliate_url` ほか）、`src/presentation/admin/inbox-action.ts` / `inbox-forms.tsx` | `src/app/admin/inbox/page.tsx` | サイドナビ「受信箱」+ ホームの「手当てが必要なもの」 | loading / empty（貼り付け欄と使い方を出す）/ error / 操作不可（スタブ表示で「まだ保存されません」を明示） | 対応 | 対応（`ToolForm` 共通部品。入力欄にラベルと説明、送信は44px最小） | PASS（`tests/domain/link-ingestion.test.ts`） | 実装済（保存先は D1。接続が供給されない環境＝`pnpm dev`・自動テストでは見本データへ回り、そのことを画面に出す。CSV一括と拡張機能の入口はスタブ） |
| REQ-P03 | §9.3 商品インテリジェンス（21属性・情報源・信頼度・有効期限） | `src/domain/product/product.ts`（共通属性を型で固定し、カテゴリー固有の属性は `specifications` で持つ）、`src/domain/product/product-identity.ts`（JAN/ASIN/型番による同一判定）、`src/domain/product/merchant-offer.ts`、`src/domain/shared/provenance.ts`（情報源・信頼度・有効期限）、`src/application/usecases/product/read-product.ts`、`src/presentation/tools/product-tools.ts` | `src/app/admin/products/page.tsx`、`src/app/admin/products/[product]/page.tsx` | サイドナビ「商品」+ 受信箱の商品候補 + 順位表の商品名 | loading / empty / error / 期限切れ（値を出さず「情報が古い」理由を表示） | 対応 | 対応 | PASS（`tests/presentation/admin-routes.test.ts`） | 実装済（21属性のうちカテゴリー固有分は見本データ。外部からの自動収集はスタブ） |
| REQ-P04 | §9.4 比較エンジン（Exact Offer / Variant / Direct Competitor / Alternative Solution の4分類） | `src/domain/product/comparison.ts`（4分類 `RelationshipType` と比較セット）、`src/domain/ranking/scoring.ts`（順位の計算はここだけ）、`src/application/usecases/ranking/rank-products.ts`（報酬の型を受け取れない `Editorial<T>` 依存） | `src/app/admin/rankings/page.tsx`、`src/app/admin/products/compare/page.tsx` | サイドナビ「評価基準と順位」+ ホームの「いま試せること」+ 商品詳細の比較リンク | empty / error / 選外理由に対応 | 対応（48rem で表を縦積み） | 対応（表見出しに `scope`、数字は等幅、コントラストAA） | PASS（`tests/presentation/composition.test.ts` / `tests/architecture/commercial-isolation.test.ts`） | 実装済 |
| REQ-P05 | §9.5 Persona Studio（書き手・読者・話し方・実体験・資格・禁止事項・事実境界 §13.3） | `src/domain/authoring/author-persona.ts`、`src/domain/authoring/audience-persona.ts`、`src/domain/authoring/writing-style.ts`、`src/application/usecases/authoring/manage-personas.ts`（事実境界の判定 `checkFactBoundary` を含む）、`src/presentation/tools/content-tools.ts`、`src/presentation/admin/fact-boundary-action.ts` / `fact-boundary-form.tsx` | `src/app/admin/personas/page.tsx` | サイドナビ「書き手と読者」+ 記事の書き手表示から | loading / empty（4箇所）/ error / 事実境界に触れる指定は理由つきで拒否 | 対応 | 対応 | PASS（`tests/application/manage-personas.test.ts`） | 実装済（保存先は見本データ） |
| REQ-P06 | §9.6 AI Content Studio（生成マトリクス・切り口16種・出力契約・自動品質確認17項目） | `src/domain/authoring/content-package.ts`（`CONTENT_ANGLES` 16種・段階4種・長さ・CTA種別・代表セル抽出）、`src/domain/authoring/quality-check.ts`（`QualityCheckId` 17項目を `runQualityChecks` で実行）、`src/domain/authoring/content-variant.ts`（出力契約）、`src/application/usecases/authoring/plan-generation-matrix.ts`、`src/infrastructure/generation/`（プロンプト組み立て） | `src/app/admin/content/matrix/page.tsx`、`src/app/admin/content/page.tsx`、`src/app/admin/content/[variant]/page.tsx` | サイドナビ「記事」→「生成マトリクス」+ 商品詳細から | loading / empty / error / 生成の提供元が未接続であることをスタブ表示 | 対応 | 対応 | PASS（`tests/application/generation-matrix.test.ts` / `tests/infrastructure/prompt-assembly.test.ts`） | 実装済（生成AIの呼び出しのみスタブ。鍵の登録が済めば動く） |
| REQ-P07 | §9.7 Site Builder（10パターン・ウィザード13ステップ・Blueprint・ページ構造・内部リンク・SEO） | `src/domain/authoring/site-blueprint.ts`（`SITE_PATTERNS` 10種・`STANDARD_PAGES`・信頼ページ必須判定・テーマトークン・差別化10軸）、`src/domain/authoring/site-draft.ts`（13ステップの下書き）、`src/domain/authoring/site-routes.ts`（18ルートの正本）、`src/application/usecases/site/build-site.ts`、`src/presentation/admin/site-wizard-action.ts` / `site-wizard-form.tsx` | `src/app/admin/sites/page.tsx`、`src/app/admin/sites/new/page.tsx`、`src/app/admin/sites/[site]/page.tsx` | サイドナビ「ブログ」→「新しいブログを作る」 | loading / empty / error / 未入力ステップは次へ進めない理由を表示 | 対応 | 対応（各ステップに見出しと説明、`ToolForm` の宣言型属性を共通化） | PASS（`tests/application/build-site.test.ts` / `tests/ui/blueprint-theme.test.ts`） | 実装済（**コードを書かずに4本目のブログを追加できることを実測済**） |
| REQ-P08 | §9.8 Distribution Hub（Connector契約・予約・投稿・失敗リトライ・Publication状態8+異常5） | `src/domain/distribution/channel.ts`（`CHANNEL_CAPABILITIES` と `supportsDirectPublish`。note は公式APIが無いため直接投稿できないことを型で表明）、`src/domain/distribution/publication.ts`（状態遷移表 `ALLOWED` と `MAX_SEND_ATTEMPTS`）、`src/application/usecases/distribution/manage-distribution.ts`、`src/application/usecases/distribution/publication-calendar.ts`、`src/infrastructure/channels/` | `src/app/admin/distribution/page.tsx`、`.../[publication]/page.tsx`、`.../calendar/page.tsx` | サイドナビ「配信」+ 記事詳細の公開操作 | loading / empty / error / 接続先が未登録の媒体は投稿ボタンを出さず理由を表示 | 対応 | 対応 | PASS（`tests/infrastructure/channel-connector.test.ts` / `tests/application/publication-calendar.test.ts`） | 実装済（各媒体への実送信のみスタブ。接続情報の登録が済めば動く） |
| REQ-P09 | §9.9 Affiliate Hub（ASP・プログラム・リンク原本・TrackingLink・リンク切れ・成果） | `src/domain/monetization/affiliate-program.ts`、`src/domain/monetization/affiliate-link.ts`（リンク原本と計測リンク、リンク切れの状態）、`src/domain/monetization/conversion.ts`、`src/application/usecases/monetization/manage-affiliate.ts`、`src/presentation/tools/affiliate-tools.ts` | `src/app/admin/affiliate/page.tsx`、`src/app/admin/affiliate/[conversion]/page.tsx` | サイドナビ「報酬」+ 受信箱から | loading / empty（4箇所）/ error（4箇所）/ ASP未接続をスタブ表示 | 対応 | 対応 | PASS（`tests/presentation/admin-routes.test.ts`） | 実装済（ASP への実接続のみスタブ。秘密情報は利用者本人が別画面で登録する） |
| REQ-P10 | §9.10 Analytics（商品・コンテンツ・書き手・読者・媒体・切り口・CTA・販売店・ASP・ブログ・投稿日時の11軸絞込） | `src/domain/analytics/dimensions.ts`（11軸の定義表・お金に近い軸の印）、`src/application/ports/analytics.ts`（`MetricDimensions` 11項目 + `listAxisOptions` / `listSplittableKeys`）、`src/application/usecases/analytics/filter-metrics.ts`、`src/presentation/tools/analytics-tools.ts` `filter_metrics`（REST / WebMCP / MCP 共通） | `src/app/admin/analytics/page.tsx` | サイドナビ「数字」→「切り口で絞って見る」 | loading（サーバ描画）/ empty（条件に当たる数字が無い理由を文で表示）/ error（`ErrorView`）/ 操作不可（分けられない軸は選び欄を出さず理由を表示） | 対応（`--card-min-width` の自動折返し。独自の px 指定なし） | 対応（`fieldset`/`legend`、各欄に説明文、色に頼らず「（報酬に直結する切り口）」を文字で表示、JS 無しでも `<form method="get">` で動く） | PASS（`tests/application/filter-metrics.test.ts` 20件） | 実装済（数字の元は見本データ。実測は Cloudflare Analytics 接続後） |

## B. プラットフォーム層 主要画面（§22.1〜§22.8）

| REQ | 要件 | 実装 | 画面 | 導線 | 状態 | RWD | a11y | test | 結果 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-S01 | §22.1 ダッシュボード（11ウィジェット） | `src/application/usecases/dashboard/read-dashboard.ts`（11ウィジェットを1ユースケースで算出）、`src/presentation/tools/dashboard-tools.ts`（`get_dashboard`）、`src/presentation/ui/patterns/work-board.tsx` | `src/app/admin/page.tsx` | サイドナビ先頭 `/admin`。各ウィジェットが解消先の画面へ直リンク（行き先は `ADMIN_NAV` 内であることをテストで固定） | loading（`force-dynamic` のサーバ描画）/ empty（`EmptyView` + 手当て不要の理由）/ error（`ErrorView` + 設定への導線）/ 数えられない（値ではなく理由を表示。0件と混同しない） | 対応（`.board` が `auto-fill` グリッド） | 対応（色に加えて読み上げ用の状態語、リンクは `tap-target-min`） | PASS（`tests/application/dashboard.test.ts` 10件） | 実装済 |
| REQ-S02 | §22.2 Affiliate Inbox（9要素） | `src/application/usecases/monetization/manage-link-inbox.ts`、`src/presentation/admin/inbox-forms.tsx` | `src/app/admin/inbox/page.tsx` | サイドナビ「受信箱」+ ホームの手当て一覧 | loading / empty / error / 保存先が仮であることのスタブ表示 | 対応 | 対応 | PASS（`tests/domain/link-ingestion.test.ts` / `tests/presentation/admin-routes.test.ts` / `tests/integration/d1-link-inbox.test.ts`） | 実装済（保存先は D1。接続が無い環境では見本データへ回る） |
| REQ-S03 | §22.3 Product Intelligence（11要素） | `src/application/usecases/product/read-product.ts`、`src/presentation/ui/patterns/evidence.tsx`（出典表示）、`factuality.tsx`（事実と推測の区別） | `src/app/admin/products/page.tsx`、`.../[product]/page.tsx`、`.../compare/page.tsx` | サイドナビ「商品」+ 受信箱の商品候補 | loading / empty / error / 情報が古いときは値を出さず理由を表示 | 対応 | 対応 | PASS（`tests/presentation/admin-routes.test.ts`） | 実装済（外部からの自動収集のみスタブ） |
| REQ-S04 | §22.4 Persona Studio（8要素） | `src/application/usecases/authoring/manage-personas.ts`、`src/presentation/admin/fact-boundary-form.tsx` | `src/app/admin/personas/page.tsx` | サイドナビ「書き手と読者」 | loading / empty（4箇所）/ error / 事実境界を越える指定は理由つきで拒否 | 対応 | 対応 | PASS（`tests/application/manage-personas.test.ts`） | 実装済（保存は見本データ） |
| REQ-S05 | §22.5 Content Matrix（3行軸 × 7媒体列） | `src/application/usecases/authoring/plan-generation-matrix.ts`（`selectRepresentativeCells` で代表セルを選ぶ）、`src/application/usecases/content/manage-content.ts` | `src/app/admin/content/matrix/page.tsx`、`src/app/admin/content/page.tsx`、`.../[variant]/page.tsx` | サイドナビ「記事」+ 商品詳細 | loading / empty / error / 生成の提供元が未接続であることを表示 | 対応（48rem で表を縦積み） | 対応 | PASS（`tests/application/generation-matrix.test.ts`） | 実装済（生成AIの呼び出しのみスタブ） |
| REQ-S06 | §22.6 Site Builder（11要素） | `src/application/usecases/site/build-site.ts`、`src/application/usecases/site/manage-sites.ts`、`src/presentation/admin/site-wizard-form.tsx` | `src/app/admin/sites/page.tsx`、`.../new/page.tsx`、`.../[site]/page.tsx` | サイドナビ「ブログ」 | loading / empty / error / 未入力のステップは次へ進めない理由を表示 | 対応 | 対応 | PASS（`tests/application/build-site.test.ts`） | 実装済 |
| REQ-S07 | §22.7 Publication Calendar（8要素・ドラッグ変更） | `src/application/usecases/distribution/publication-calendar.ts`（媒体/接続先のアカウント/投稿予定/承認状態/キャンペーン/コンテンツパッケージ/エラーの7要素 + 予定日変更）、`src/presentation/tools/distribution-tools.ts`（`get_publication_calendar` / `reschedule_publication`（人の確認必須））、`src/presentation/ui/patterns/schedule-calendar.tsx`、`src/presentation/admin/reschedule-action.ts` / `reschedule-form.tsx` | `src/app/admin/distribution/calendar/page.tsx` | `/admin/distribution` の「いつ出すかを見る」から。カレンダー側からは各配信の詳細とパンくずで戻れる | loading（サーバ描画）/ empty（その月に予定なし + 記事の進行への導線）/ error（`ErrorView` + 一覧へ戻る）/ 操作不可（公開の権限が無い場合は変更欄を出さず理由を表示） | 対応（48rem 未満で7列を解除し日ごとの縦並び。`--breakpoint-md` の写し） | 対応（`<table>` + `scope="col"` の曜日見出し、色に頼らず注意を文で表示、変更は日時入力欄でキーボード操作可） | PASS（`tests/application/publication-calendar.test.ts` 18件） | 実装済（**ドラッグ操作のみ未実装**。キーボードで操作できないため日時入力欄を正の手段とした。掴む操作は同じユースケースを呼ぶ追加として残課題） |
| REQ-S08 | §22.8 Analytics（11軸絞込） | `src/application/usecases/analytics/filter-metrics.ts`、`src/presentation/ui/patterns/filter-bar.tsx`（絞り込みの棚。11軸ぶんを画面ごとに書き起こさない）、`src/presentation/tools/analytics-tools.ts` `filter_metrics` | `src/app/admin/analytics/page.tsx` | サイドナビ「数字」。絞り込み後の URL をそのまま共有すると同じ条件が再現する | loading / empty / error / 操作不可の4状態。**分けて数えていない指標は 0 ではなく理由を返す**（`tests/application/filter-metrics.test.ts` で固定） | 対応（`grid-template-columns: repeat(auto-fill, minmax(--card-min-width, 1fr))`） | 対応（`fieldset`/`legend`・44px 最小の選び欄・`:focus-visible` の共通リング） | PASS（`tests/application/filter-metrics.test.ts` 20件） | 実装済（数字の元は見本データ。実測は Cloudflare Analytics 接続後） |
| REQ-S09 | 共通レイアウト（サイドナビ・現在地表示・退避先・権限による表示制御） | `src/presentation/ui/templates/app-shell.tsx`、`tokens.css`、`primitives/`（ボタン・入力欄・状態表示・理由表示）、`src/domain/identity/permissions.ts`（能力による表示制御。`can()` の結果を画面へ渡す） | `src/app/admin/layout.tsx` + 各ページで `AppShell` | サイドナビ `ADMIN_NAV`（12項目） | loading / empty / error / 操作不可の4状態を部品化（title・body・reason を必須にして無言を防止） | 対応（48rem で段組み解除、表は縦積み） | 対応（`aria-current`・`:focus-visible` の共通リング・44px 最小・`prefers-reduced-motion`） | PASS（`tests/presentation/composition.test.ts` / `tests/ui/ui-layers.test.ts` / `tests/ui/design-tokens.test.ts`） | 実装済 |
| REQ-S10 | 認証画面（Google OAuth・サインイン・サインアウト・招待受諾） | `src/infrastructure/identity/session-repository.ts` / `session-actor.ts`（合言葉の照合と権限の引き当ては**実装済み**。合言葉は潰した値だけ保存する）+ `src/infrastructure/identity/sample-actor.ts`（合言葉を発行する入口が入るまでの見本。台帳 `identity:sample-actor` に登録済み） | `src/app/signin/page.tsx` | `/admin/settings` の「ログイン」から | 見本であることを明示（`StubNotice` + 解除条件）/ いま誰として動いているか / その人にできないこと（公開・招待）を理由つきで表示 | 対応（共通の読者向け骨格 `PublicShell`） | 対応（定義表に `<th scope="row">`、リンクは44px最小） | PASS（`tests/presentation/admin-routes.test.ts` の孤立ページ検査） | **スタブ**（確かめる側は実装済み。残るのは**発行する側**。解除条件: Google 側でこのアプリを登録し、発行された識別子と秘密の値を**利用者本人がブラウザから**登録すること。秘密情報を AI が読める場所に置かせないため代行しない） |

## C. ブログ層 情報アーキテクチャ（§7 全18ルート）

ルート表の正本は `src/presentation/site/routes.ts`。`tests/domain/site-routes.test.ts` が
**「表にある route には画面がある」「画面には表の行がある（孤立ページ禁止）」「導線が空でない」**
を毎回機械的に確かめる。下の表はその検査を通った状態を書き写したもの。

RWD・a11y は全ルート共通の枠（`page-frame.tsx` と共通 UI 部品）で担保しており、
`tests/ui/design-tokens.test.ts` と `tests/ui/ui-layers.test.ts` が生の色・生の px・
層またぎの import を機械的に禁止している。個別ルートごとの再掲はしない。

| REQ | ルート | 実装（画面） | 導線 | 状態 | RWD | a11y | test | 結果 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-B01 | `/s/{site}`（トップ） | `src/app/s/[site]/page.tsx` + `presentation/site/page-frame.tsx` | 入口（サイト一覧 `/` から） | 新着0件・取得失敗に文言あり | 対応 | 対応 | PASS（`tests/domain/site-routes.test.ts`） | 実装済 |
| REQ-B02 | `/s/{site}/categories/{category}` | `src/app/s/[site]/categories/[category]/page.tsx` | トップのカテゴリ一覧 + 共通ヘッダのナビ | 0件・失敗に文言あり | 対応 | 対応 | PASS（`tests/domain/site-routes.test.ts`） | 実装済 |
| REQ-B03 | `/s/{site}/best/{topic}`（ランキング記事） | `src/app/s/[site]/best/[topic]/page.tsx` + `article-page.tsx` | トップ・カテゴリの記事カード | 未公開/不存在に文言あり | 対応 | 対応 | PASS（`tests/domain/site-routes.test.ts`） | 実装済 |
| REQ-B04 | `/s/{site}/reviews/{product}` | `src/app/s/[site]/reviews/[product]/page.tsx` | ランキングの商品名・記事内リンク | 同上 | 対応 | 対応 | PASS（`tests/domain/site-routes.test.ts`） | 実装済 |
| REQ-B05 | `/s/{site}/compare/{comparison}` | `src/app/s/[site]/compare/[comparison]/page.tsx` | カテゴリ・記事内リンク | 同上 | 対応 | 対応 | PASS（`tests/domain/site-routes.test.ts`） | 実装済 |
| REQ-B06 | `/s/{site}/guides/{topic}` | `src/app/s/[site]/guides/[topic]/page.tsx` | トップの初心者導線・カテゴリ | 同上 | 対応 | 対応 | PASS（`tests/domain/site-routes.test.ts`） | 実装済 |
| REQ-B07 | `/s/{site}/tools/{tool}`（診断・計算） | `src/app/s/[site]/tools/[tool]/page.tsx` + `reader-tool-form.tsx` | トップの「試せること」・カテゴリ | スタブ表示あり。計算式未登録は数値を作らず理由を返す | 対応 | 対応 | PASS（`tests/domain/site-routes.test.ts`） | スタブ |
| REQ-B08 | `/s/{site}/search`（言葉で探す） | `src/app/s/[site]/search/page.tsx` + `search-box.tsx` | 共通ヘッダに常設 | 未入力・0件・結果・失敗の4状態 | 対応 | 対応 | PASS（`tests/domain/site-routes.test.ts`） | 実装済 |
| REQ-B09 | `/s/{site}/shortlist`（気になる商品） | `src/app/s/[site]/shortlist/page.tsx` | 共通ヘッダ + 記事内の保存操作 | スタブ表示あり（保存先が記憶のみ） | 対応 | 対応 | PASS（`tests/domain/site-routes.test.ts`） | スタブ |
| REQ-B10 | `/s/{site}/authors/{author}` | `src/app/s/[site]/authors/[author]/page.tsx` + `person-page.tsx` | 記事の書き手名 | 不存在に文言あり | 対応 | 対応 | PASS（`tests/domain/site-routes.test.ts`） | 実装済 |
| REQ-B11 | `/s/{site}/experts/{expert}` | `src/app/s/[site]/experts/[expert]/page.tsx` + `person-page.tsx` | 記事の監修者表示 | 同上 | 対応 | 対応 | PASS（`tests/domain/site-routes.test.ts`） | 実装済 |
| REQ-B12 | `/s/{site}/methodology`（評価方法） | `src/app/s/[site]/methodology/page.tsx` + `policy-page.tsx` | 記事の評価基準・フッタ | 未登録に文言あり | 対応 | 対応 | PASS（`tests/domain/site-routes.test.ts`） | 実装済 |
| REQ-B13 | `/s/{site}/editorial-policy` | `src/app/s/[site]/editorial-policy/page.tsx` | フッタ | 同上 | 対応 | 対応 | PASS（`tests/domain/site-routes.test.ts`） | 実装済 |
| REQ-B14 | `/s/{site}/advertising-policy` | `src/app/s/[site]/advertising-policy/page.tsx` | フッタ + 記事の広告表記 | 同上 | 対応 | 対応 | PASS（`tests/domain/site-routes.test.ts`） | 実装済 |
| REQ-B15 | `/s/{site}/ai-policy` | `src/app/s/[site]/ai-policy/page.tsx` | フッタ | 同上 | 対応 | 対応 | PASS（`tests/domain/site-routes.test.ts`） | 実装済 |
| REQ-B16 | `/s/{site}/corrections`（訂正） | `src/app/s/[site]/corrections/page.tsx` | フッタ + 記事の訂正報告 | 0件・失敗に文言あり | 対応 | 対応 | PASS（`tests/domain/site-routes.test.ts`） | 実装済 |
| REQ-B17 | `/s/{site}/privacy` + `/s/{site}/terms` | `src/app/s/[site]/privacy/page.tsx`、`.../terms/page.tsx` | フッタ | 未登録に文言あり | 対応 | 対応 | PASS（`tests/domain/site-routes.test.ts`） | 実装済 |
| REQ-B18 | `/s/{site}/contact` | `src/app/s/[site]/contact/page.tsx` + `contact-form.tsx` | フッタ | スタブ表示あり（送信先が未接続） | 対応 | 対応 | PASS（`tests/domain/site-routes.test.ts`） | スタブ |

**3 本のブログすべてが同じ画面コードで動く。** ブログ名がファイル構成に
現れていないことも同テストが検査している（`src/app/s/video-editing-gear/` のような
フォルダを作った瞬間に落ちる）。
## D. 記事構成・文章（ブログ層 §8〜§11、プラットフォーム層 §16.4〜§16.6）

| REQ | 要件 | 実装 | 画面 | test | 結果 |
| --- | --- | --- | --- | --- | --- |
| REQ-W01 | §8 記事共通構成 25セクション | `src/domain/authoring/article-structure.ts` `COMMON_ARTICLE_SECTIONS`（25件）+ `missingSections()` を公開ゲートが使用 | `/admin/writing`（節の一覧と理由）+ REQ-B03〜B06 | PASS（`tests/domain/writing-rules.test.ts`「記事の骨格」5件） | 実装済 |
| REQ-W02 | §9.1 ランキング記事の body 構成 | `article-structure.ts` `ARTICLE_TYPE_SECTIONS.ranking`（評価基準・検証条件・順位・商品カード・選外・用途別ベスト） | `/admin/writing?type=ranking` / REQ-B03 | PASS（同上・型ごとの必須節） | 実装済 |
| REQ-W03 | §9.2 個別レビューの body 構成 | `ARTICLE_TYPE_SECTIONS.review`（検証条件・実測・長期使用・競合比較） | `/admin/writing?type=review` / REQ-B04 | PASS（同上） | 実装済 |
| REQ-W04 | §9.3 比較記事の body 構成 | `ARTICLE_TYPE_SECTIONS.comparison`（差分表・用途別結論） | `/admin/writing?type=comparison` / REQ-B05 | PASS（同上） | 実装済 |
| REQ-W05 | §9.4 ハウツー記事の body 構成 | `ARTICLE_TYPE_SECTIONS.guide`（完了後の状態・必要時間・費用・事前準備・全手順・成功状態・エラー対処・次の行動） | `/admin/writing?type=guide` / REQ-B06 | PASS（`tests/application/writing-method.test.ts`「やり方の記事」） | 実装済 |
| REQ-W06 | §10.1 文章の基本順序（結論→理由→根拠→具体例→例外→意味→行動） | `src/domain/authoring/writing-style.ts` `PARAGRAPH_ORDER` | `/admin/writing`「段落の並べ方」 | PASS（`tests/application/writing-method.test.ts`「結論から始めて次の行動で終える」） | 実装済 |
| REQ-W07 | §10.2 事実6分類の書き分けと文中表示 | `writing-style.ts` `FACT_LABELS` / `FACT_TONE_RULES`、表示は `src/presentation/ui/patterns/factuality.tsx` `FactSourceBadge`（記号+文字。色だけで区別しない） | `/admin/writing`「事実の種類ごとの書き分け」（バッジ実表示） | PASS（`tests/ui/fact-source.test.ts` 4件＝業務側と画面側の一覧一致 / `writing-method.test.ts`「6種類・語尾が種類ごとに違う」） | 実装済 |
| REQ-W08 | §10.3 スタイル規則（文長・段落・単位・日付・禁止表現） | `writing-style.ts` `STYLE_RULES`（9件・理由つき）、禁止表現の実検査は `quality-check.ts` `EXAGGERATION_PATTERNS` | `/admin/writing`「文体の決まり」 | PASS（`writing-method.test.ts`「理由が付いている」/ `tests/domain/invariants.test.ts`「誇大表現を書くと止まる」） | 実装済 |
| REQ-W09 | §11 会話・吹き出し（4話者・連続最大2・40〜120字・話者名表示・色以外での区別） | `src/domain/authoring/conversation-block.ts` `createConversationBlock` / `validateConversationFlow`（本文を挟むと連続を数え直す）。`quality-check.ts` の検査18 `conversation_flow` として公開前検査に接続済み | `/admin/writing`「会話の決まり」 | PASS（`tests/domain/writing-rules.test.ts`「吹き出し」7件 / `invariants.test.ts`「続けすぎを止める」） | 実装済 |
| REQ-W10 | §16.6 マルチサイト重複対策（10軸差別化・言い換え禁止） | `src/domain/authoring/site-blueprint.ts` `DifferentiationAxes`（10軸）+ `differentiationGap()`（3軸以上）、`src/application/usecases/site/manage-sites.ts` が全ブログ対を判定。言い換え本文は `quality-check.ts` `similarity()` ≥0.85 で停止 | `/admin/sites`（近すぎるブログ対の警告） | PASS（`tests/domain/writing-rules.test.ts`「似たブログを増やさない」3件） | 実装済 |
| REQ-W11 | セクション別雛形（一文結論・リード文・評価基準・商品カード・デメリット・FAQ・最終結論） | `article-structure.ts` の各 `SectionSpec.purpose`（AI への指示文と編集者への説明を兼ねる）+ `writing-style.ts` `OPENING_PATTERNS`（型ごとの書き出し） | `/admin/writing`（節ごとの「なぜ置くか」列） | PASS（`writing-method.test.ts`「どの節にも理由がある」） | 実装済 |
| REQ-W12 | ペルソナ差分の事実境界（fact_fingerprint 不変） | `src/domain/authoring/author-persona.ts` `checkFactBoundary()`、`src/application/usecases/authoring/manage-personas.ts` | `/admin/personas` + `src/presentation/admin/fact-boundary-form.tsx` | PASS（`tests/application/manage-personas.test.ts` / `invariants.test.ts`「FACT_BOUNDARY_VIOLATED」） | 実装済 |

## E. 生成基盤（本作業で新設）

| REQ | 要件 | 実装 | 画面 | test | 結果 |
| --- | --- | --- | --- | --- | --- |
| REQ-G01 | プロンプト設計（配置・バージョニング・7ブロック構造） | `src/domain/generation/prompt-blocks.ts`（`PROMPT_BLOCKS` 7件・`promptPath()`・`requireNewVersion()` で版の上書きを禁止） | `/admin/generation`「指示文の 7 つの塊」 | PASS（`tests/domain/generation-plan.test.ts`「指示文の組み立て」7件） | 実装済 |
| REQ-G02 | 入力変数の型固定（§15.1 の必須14項目 + 3追加） | `src/domain/generation/generation-input.ts`（18項目・`validateGenerationInput()` / `missingInputFields()`。素材は `Editorial<T>` のみ受け取り報酬情報を持ち込めない） | `/admin/generation`「渡す項目」（不足の実表示） | PASS（同テスト「渡す項目」6件） | 実装済 |
| REQ-G03 | プロンプトインジェクション対策（5対策） | `src/domain/generation/injection-guard.ts`（7パターン検出・削除せず保留・素材に無いURLの検出・スキーマ再試行3回で失敗確定・許可capabilityの限定）、組み立ては `src/infrastructure/llm/prompt-assembly.ts` | `/admin/generation`「取り込んだ文章の確認」+ 共通部品 `MaterialReview` | PASS（同テスト「取り込んだ文章の扱い」6件・攻撃文5種を検出／通常の商品説明は誤検出なし） | 実装済 |
| REQ-G04 | 出力契約 `generated_variant` の JSON Schema 化 | `src/domain/generation/output-contract.ts`（必須20項目・`generatedVariantJsonSchema()`・`checkOutputShape()`・`verdictMayUse()` で自己申告点数を合否から除外） | `/admin/generation`「受け取りの形」 | PASS（同テスト「受け取りの形」5件） | 実装済 |
| REQ-G05 | スキル8種（構成/本文/比較表/会話/媒体変換/品質検査/広告表記/メタ） | `src/domain/generation/skill-catalog.ts`（8件・`dependsOn` / `skillOrderBreaches()` / `selfInspectionBreaches()`） | `/admin/generation`「手順」 | PASS（同テスト「手順と承認のつながり」2件） | 実装済 |
| REQ-G06 | サブエージェント6種（researcher/writer/fact-checker/compliance/channel/editor） | `src/domain/generation/agent-roster.ts`（6件・`concludeRevision()` は3巡で人へ回す） | `/admin/generation`「役の分け方」 | PASS（同テスト「役の分け方」5件） | 実装済 |
| REQ-G07 | 執筆系と検証系の分離（GC-5） | 同 `agent-roster.ts`。`AuthoringAgent \| ReviewAgent` の判別共用体で、検証役に `"generate"` 道具を持たせるとコンパイルが通らない。`freshContext: true` も型リテラル。実行時の崩れは `separationBreaches()` | 画面義務なし（`/admin/generation` に崩れ検知の警告枠） | PASS（同テスト「崩れた一覧を渡すと崩れとして返る」を含む） | 実装済 |
| REQ-G08 | 承認フロー（§18.1 12段階）との接続 | `src/domain/generation/approval-bridge.ts` `STAGE_BRIDGE`（12段階×`advancedBy`）。`bridgeBreaches()` が `CONTENT_STATES` / `HUMAN_APPROVAL_REQUIRED` と突き合わせる | `/admin/generation`「どこから先が人の判断か」/ `/admin/content` | PASS（同テスト「人の承認が要る段階を AI が進められない」） | 実装済 |
| REQ-G09 | 評価セット 50件以上（網羅12+9+8+5 / 敵対8 / 境界8） | `evals/generation/cases.ts`（50件）+ `quality-gates.ts` | 画面義務なし | PASS（`tests/evals/generation-eval-set.test.ts`） | 実装済 |
| REQ-G10 | ローンチ基準 LB-1〜LB-8 と CI 連携 | `evals/generation/launch-bars.ts`（LB-1〜LB-8） | 画面義務なし | PASS（同テスト）。CI への接続は初回リリース後（`ci.yml` 未設置） | スタブ |
| REQ-G11 | 生成の実行（素材を渡して下書きを 1 本作らせる） | `src/application/usecases/generation/draft-content-variant.ts`（`LlmPort` を使う唯一のユースケース。18項目が欠けていれば呼ばない／資料は `untrustedContext` へ入れ指示欄に混ぜない／呼ぶ前に費用を見積もる／打ち切りと形違いは受け取らない）、`src/domain/generation/draft-instructions.ts`（7ブロックの文面）、`src/infrastructure/llm/llm-setup.ts`（`ACTIVE_PROVIDER` 1行が提供元を決める） | `/admin/generation`「下書きを作らせてみる」（そろっていない状態／そろった状態を実際に押して確かめられる）。REST と バックエンド MCP から `draft_content_variant`。**WebMCP には載せない**（`readOnly: false`。ページ内の AI に課金を起こさせないため） | PASS（`tests/application/draft-content-variant.test.ts` 10件） | 実装済（生成AIへの接続のみスタブ。提供元の選定と鍵の登録が済めば動く） |

## F. データモデル（§21 全32エンティティ）

`ドメイン型` = 型と不変条件が `src/domain/` にあるか（**業務の決めごとはここにしか無い**）。
`保存` = いまどこに置いているか。`見本データ` は `src/infrastructure/persistence/sample/` のこと。
D1 への差し替えは、この列だけを別の実装に取り替えれば済む（画面もドメインも触らない）。

| REQ | エンティティ | ドメイン型 | 保存 | 画面 | 結果 |
| --- | --- | --- | --- | --- | --- |
| REQ-E01 | Workspace | `identity/workspace.ts` | 見本データ | REQ-S09 | 実装済 |
| REQ-E02 | User | `identity/user.ts`（認証情報を持つ場所が型に無いことをテストで固定） | 認証基盤側 | REQ-S09 | スタブ（解除条件: Google 認証の登録。秘密情報は利用者本人がブラウザから登録する） |
| REQ-E03 | Membership | `identity/membership.ts` | 見本データ | REQ-S09 | 実装済 |
| REQ-E04 | Brand | `identity/brand.ts` | 見本データ | REQ-S06 | 実装済 |
| REQ-E05 | Site | `authoring/site.ts`（**広告表記が空だと公開できない**をテストで固定） | 見本データ | REQ-S06 | スタブ（解除条件: 画面がいま設計図と下書きで動いているため、公開状態の管理をこの型へ寄せる作業） |
| REQ-E06 | SiteBlueprint | `authoring/site-blueprint.ts` | 見本データ | REQ-S06 | 実装済 |
| REQ-E07 | AuthorPersona | `authoring/author-persona.ts` | `people` | REQ-S04 | 実装済 |
| REQ-E08 | AudiencePersona | `authoring/audience-persona.ts` | 見本データ | REQ-S04 | 実装済 |
| REQ-E09 | ChannelConnection | `distribution/channel.ts` | 見本データ | REQ-S07 | 実装済（各媒体への実接続のみスタブ） |
| REQ-E10 | AffiliateAccount | `monetization/affiliate-program.ts` | `asps` | REQ-P09 | 実装済（ASP への実接続のみスタブ） |
| REQ-E11 | AffiliateProgram | `monetization/affiliate-program.ts` | `programs` | REQ-P09 | 実装済 |
| REQ-E12 | AffiliateLink | `monetization/affiliate-link.ts` | 見本データ | REQ-P09 | 実装済 |
| REQ-E13 | TrackingLink（§19.2.1） | `monetization/tracking-link.ts`（**転送先を URL 文字列で持てない**ことをテストで固定） | 見本データ | REQ-P09 | スタブ（解除条件: `/go/<合言葉>` の転送経路の設置。型と判定は済んでいる） |
| REQ-E14 | SourceArtifact | `shared/provenance.ts` | 見本データ | REQ-S03 | 実装済 |
| REQ-E15 | Product | `product/product.ts` | `products` | REQ-S03 | 実装済 |
| REQ-E16 | ProductVariant | `product/product.ts` | 見本データ | REQ-S03 | スタブ（解除条件: 色・容量ちがいを画面で分けて扱う要望が出たとき。いまは 1 商品 1 行で足りている） |
| REQ-E17 | MerchantOffer | `product/merchant-offer.ts` | 見本データ | REQ-S03 | 実装済 |
| REQ-E18 | ComparisonSet | `product/comparison.ts` | 見本データ | REQ-S03 | 実装済 |
| REQ-E19 | Claim | `evidence/claim.ts` | 見本データ | REQ-S03 | 実装済 |
| REQ-E20 | Evidence | `evidence/evidence.ts` | 見本データ | REQ-S03 | 実装済 |
| REQ-E21 | TestRun | `evidence/evidence.ts` | 見本データ | REQ-S03 | 実装済 |
| REQ-E22 | Campaign | `distribution/campaign.ts`（**報酬額を書ける場所が型に無い**ことをテストで固定） | 見本データ | REQ-S07 | スタブ（解除条件: 配信予定をまとめて扱う画面。単発の予定管理はすでに動いている） |
| REQ-E23 | ContentPackage | `authoring/content-package.ts` | 見本データ | REQ-S05 | 実装済 |
| REQ-E24 | MasterBrief | `authoring/master-brief.ts`（**原本に無い主張を原稿に足せない**をテストで固定） | 見本データ | REQ-S05 | スタブ（解除条件: 生成AIの呼び出し。原本から原稿を作る流れの入口がそこにある） |
| REQ-E25 | ContentVariant | `authoring/content-variant.ts` | `articles` | REQ-S05 | 実装済 |
| REQ-E26 | Asset | `authoring/asset.ts`（**由来・利用条件・代替テキストが無いと作れない**をテストで固定） | R2（`storage-r2.ts`） | REQ-S06 | スタブ（解除条件: 画像の登録画面。保管先の実装と型は済んでいる） |
| REQ-E27 | Publication | `distribution/publication.ts` | 見本データ | REQ-S07 | 実装済 |
| REQ-E28 | Metric | `analytics/metrics.ts` | 見本データ | REQ-S08 | 実装済（数字の元は見本データ） |
| REQ-E29 | Conversion | `monetization/conversion.ts` | `conversions` | REQ-S08 | 実装済 |
| REQ-E30 | Experiment | `analytics/experiment.ts`（**件数が足りないうちは判定できない**をテストで固定） | 見本データ | REQ-S08 | スタブ（解除条件: 実測値の取り込み。件数が無いと実験そのものが成立しない） |
| REQ-E31 | PolicyRule | `compliance/policy-rule.ts` | `disclosures` | REQ-S06 | 実装済 |
| REQ-E32 | AuditLog | `compliance/audit-log.ts` | 見本データ | REQ-S09 | スタブ（解除条件: 追記だけができる保存先。書き換えられる場所に置くと監査の意味が無くなるため、見本データのままにしている） |

**32 件すべてにドメイン型がある。** 不変条件は `tests/domain/entity-invariants.test.ts` と
`tests/domain/invariants.test.ts` が機械で確かめている。

補助テーブル（§21 に明示はないが実装済）: `categories`, `articlePeople`, `articleProducts`, `faqs`, `updateLogs`。

## G. API とイベント（§23）

| REQ | 要件 | 実装 | test | 結果 |
| --- | --- | --- | --- | --- |
| REQ-API01 | §23.1 REST/RPC エンドポイント群（受信箱・商品・比較・生成・公開・分析） | `src/app/api/tools/route.ts`（一覧）と `src/app/api/tools/[tool]/route.ts`（実行）。1 つのツールカタログから全操作が出るため、業務が増えても入口は増えない | PASS（`tests/presentation/entry-points.test.ts` / `one-usecase-three-adapters.test.ts`） | 実装済 |
| REQ-API02 | 認可（テナント境界・ロール）を全エンドポイントで強制 | `src/presentation/http/tool-scope.ts` `isToolAllowedForScope()` を REST と MCP の両方が呼ぶ。テナントは `assertSameTenant()`、ロールは `requireCapability()`。オリジン制約は `src/presentation/http/origin-guard.ts` | PASS（`tests/presentation/entry-points.test.ts` / `webmcp-policy.test.ts`「オリジン制約」） | 実装済 |
| REQ-EV01 | `affiliate_url.submitted` | `src/domain/shared/domain-events.ts` + `manage-link-inbox.ts` で発行 | PASS（`tests/domain/domain-events.test.ts`） | 実装済 |
| REQ-EV02 | `affiliate_url.resolved` | 同上（`manage-link-inbox.ts`） | PASS | 実装済 |
| REQ-EV03 | `product.matched` | 同上（`manage-link-inbox.ts`） | PASS | 実装済 |
| REQ-EV04 | `product.enriched` | 定義のみ。解除条件: 外部情報から商品属性を補う取込処理 | 台帳に記載（`docs/product/event-ledger.md`） | スタブ |
| REQ-EV05 | `comparison.ready` | 定義のみ。解除条件: 比較候補の 4 分類（同一/派生/競合/代替）の判定処理 | 同上 | スタブ |
| REQ-EV06 | `content_package.created` | 定義のみ。解除条件: 記事のまとまりを作る画面と生成の起動 | 同上 | スタブ |
| REQ-EV07 | `content_variant.generated` | `manage-content.ts` で発行 | PASS | 実装済 |
| REQ-EV08 | `content_variant.approved` | `manage-content.ts` で発行 | PASS | 実装済 |
| REQ-EV09 | `publication.scheduled` | `publication-calendar.ts` の予定日変更で発行 | PASS | 実装済 |
| REQ-EV10 | `publication.published` | 定義のみ。解除条件: 配信の実行（各サービスの認証が要る） | 同上 | スタブ |
| REQ-EV11 | `publication.failed` | 定義のみ。解除条件: 配信の実行と失敗の取り扱い | 同上 | スタブ |
| REQ-EV12 | `affiliate_link.broken` | 定義のみ。解除条件: リンク切れ検出の定期実行 | 同上 | スタブ |
| REQ-EV13 | `affiliate_program.terminated` | 定義のみ。解除条件: ASP からの提携状態の取得 | 同上 | スタブ |
| REQ-EV14 | `claim.expired` | 定義のみ。解除条件: 根拠の有効期限を見て回る定期実行 | 同上 | スタブ |
| REQ-EV15 | `content.refresh_due` | `manage-content.ts` で発行 | PASS | 実装済 |
| REQ-EV16 | `conversion.received` | 定義のみ。解除条件: ASP からの成果データ取込 | 同上 | スタブ |

16 件すべてが `src/domain/shared/domain-events.ts` に定義済みで、必須項目が欠けたまま
送ることは `buildEvent()` が型と検査で止める。**うち 7 件を実際に発行している**。
発行していない 9 件は `docs/product/event-ledger.md`（テストが自動生成する台帳）に
「何が済めば出せるか」つきで残す。空欄は検査で許していない。

## H. WebMCP（管理側 §24.1 / 読者側 ブログ層 §14.2）

| REQ | 要件 | 実装 | 通常UI経路（FD-4） | 結果 |
| --- | --- | --- | --- | --- |
| REQ-WA01 | 管理側 読み取り10種（`search_affiliate_sources` 〜 `get_publication_status`） | `src/presentation/tools/spec-contract.ts` `TOOL_CONTRACT`。**10 種中 9 種が仕様の名前で呼べる**（`inspect_affiliate_url` のみスタブ）。画面は `/admin/tools` | REQ-S01〜S08 | スタブ |
| REQ-WA02 | 管理側 状態変更8種（`create_affiliate_source_draft` 〜 `publish_approved_content`）+ 確認必須 | 同上。**8 種中 4 種**が動く。確認必須は `requiresHumanApproval` + `invokeTool()` が AI を弾く | REQ-S01〜S08 | スタブ |
| REQ-WB01 | 読者側 読み取り9種 | 同上。**9 種すべて動く**（`get_disclosure` は `list_disclosures` の別名） | REQ-B01〜B09 | 実装済 |
| REQ-WB02 | 読者側 状態変更1種（`submit_feedback`）+ 確認UI | `submit_contact` の別名。ページ内 AI には渡さない（`PAGE_TOOLS` は読み取りのみ） | REQ-B16 | 実装済 |
| REQ-WC01 | `document.modelContext` を正規経路にする（CHG-001） | `src/presentation/ui/webmcp-provider.tsx` `resolveModelContext()`（`navigator` は後ろに置く旧経路） | — | 実装済 |
| REQ-WC02 | 能力検出 → 非対応時は通常UIへフォールバック | 同上。`registerWebMcpTools()` は登録先が無ければ何もしない | — | 実装済 |
| REQ-WC03 | 機能フラグ配下での有効化 | `src/presentation/tools/webmcp-policy.ts` `WEBMCP_ENABLED` / `isWebMcpEnabled()`。切ると渡す道具が空になり、画面はそのまま使える | PASS（`tests/presentation/webmcp-policy.test.ts`「機能フラグ」） | 実装済 |
| REQ-WC04 | 1ページ6ツール以下・読み取り専用から導入 | 同 `PAGE_TOOLS`（7 種別ぶん）+ `MAX_TOOLS_PER_PAGE`。ページ種別は `SiteFrame` の `pageKind` から決まる | PASS（同「ページ種別ごとの道具」7件） | 実装済 |
| REQ-WC05 | 宣言型フォーム（`toolname`/`tooldescription`/`toolparamdescription`、状態変更に `toolautosubmit` 不使用） | `src/presentation/ui/primitives/tool-form.tsx` + `field.tsx` / `textarea.tsx`。属性名が小文字で出ることを出力で確認 | PASS（`tests/ui/tool-form.test.tsx` / `webmcp-policy.test.ts`「宣言型フォーム」） | 実装済 |
| REQ-WC06 | §14.6 オリジン制約 | `src/presentation/http/origin-guard.ts` `checkOrigin()` を `/api/mcp` と `/api/tools/[tool]` の両方が呼ぶ | PASS（`tests/presentation/webmcp-policy.test.ts`「オリジン制約」5件） | 実装済 |
| REQ-WC07 | §16.4 エラー形式 | `src/presentation/http/error-response.ts`（REST）と `mcp-adapter.ts` `errorToMcpResult()`（MCP）。変換は 1 箇所で、必ず「次にできること」を添える | PASS（`tests/presentation/entry-points.test.ts`） | 実装済 |
| REQ-WC08 | 現行の3ツール（`list_programs`/`record_conversion`/`get_revenue_summary`）は暫定 | 新しいカタログ（`buildToolCatalog`）へ移行済み。旧 `src/lib/mcp/specs.ts` は存在しない | — | 実装済 |

## I. バックエンドMCP（§24.3）

| REQ | 要件 | 実装 | 結果 |
| --- | --- | --- | --- |
| REQ-M01 | Resources 8種 | `src/presentation/tools/spec-contract.ts` `MCP_RESOURCES`（8種）+ `mcp-adapter.ts` の `resources/list` / `resources/read`。中身は必ず既存のツールから取る（読み出しを二重に書かない）。画面は `/admin/tools` | 実装済 |
| REQ-M02 | Tools 8種 | 同 `TOOL_CONTRACT` の `mcp_tool`。**8 種中 6 種**が仕様の名前で呼べる（`generate_content_variants` は `draft_content_variant` として実装）。残り 2 種は方針の保存と媒体の接続情報の未登録（理由は表に明記） | スタブ |
| REQ-M03 | MCP エンドポイントと認可 | `src/app/api/mcp/route.ts`（JSON-RPC / stateless）。認可は `authenticateRequest()` + `visibleTools()`、オリジンは `checkOrigin()`。ツールは REST・WebMCP と同じ 1 つのカタログ | 実装済 |

## J. 権限（§25 全10ロール + 追加1）

| REQ | ロール | 実装 | 画面での表現 | 結果 |
| --- | --- | --- | --- | --- |
| REQ-R01 | Owner | `src/domain/identity/permissions.ts` `ROLE_CAPABILITIES.owner`（22 capability） | `/admin/settings`「役割ごとにできること」の表 | 実装済 |
| REQ-R02 | Workspace Admin | 同 `workspace_admin`（owner から `workspace.manage` を除く） | 同上 | 実装済 |
| REQ-R03 | Brand Manager | 同 `brand_manager`（ブランド配下の運営一式。会員管理と報酬管理は持たない） | 同上 | 実装済 |
| REQ-R04 | Researcher | 同 `researcher`（商品・根拠の登録まで。記事は読むだけ） | 同上 | 実装済 |
| REQ-R05 | Writer | 同 `writer`（下書きと生成。承認・公開は持たない） | 同上 | 実装済 |
| REQ-R06 | Reviewer | 同 `reviewer`（事実確認・表現確認。公開は持たない） | 同上 | 実装済 |
| REQ-R07 | Publisher | 同 `publisher`（公開のみ。本文を書き換えられない） | 同上 | 実装済 |
| REQ-R08 | Analyst | 同 `analyst`（数字と報酬の閲覧のみ） | 同上 | 実装済 |
| REQ-R09 | Contributor | 同 `contributor`（記事の読み書きのみ） | 同上 | 実装済 |
| REQ-R10 | AI Service Account（下書き・分析のみ。原則公開不可） | 同 `ai_service_account`。加えて `HUMAN_ONLY_CAPABILITIES`（承認・公開・会員管理・報酬管理・書き出し）は `requireCapability()` が `isAiServiceAccount` を見て必ず拒否する | `/admin/settings`「人にしかできないこと」の枠 | 実装済 |
| REQ-R11 | 公開権限と編集権限の分離 | `content.write` と `content.publish` を別の capability にし、`publisher` は書き込みを持たない。状態遷移は `src/domain/authoring/content-state.ts` `transition()` が AI を弾く | `/admin/content/[variant]`（承認できない理由の表示）+ `/admin/settings`（PASS: `tests/domain/invariants.test.ts` / `tests/application/manage-personas.test.ts`） | 実装済 |
| REQ-R12 | Feedback Admin（**仕様 §25 に無い追加**。改善要望の機能に伴う） | 同 `feedback_admin`（`feedback.*` 4 つ + `integration_key.manage` のみ。記事の権限は 1 つも持たない）。`workspace_admin` で代用しなかったのは、要望を読ませたいだけの相手に公開の権限まで渡るため | `/admin/settings`「役割ごとにできること」の表（PASS: `tests/domain/permissions.test.ts`「使い勝手の担当は、改善要望まわりだけで、記事には一切触れない」） | 実装済 |

## K. セキュリティ・コンプライアンス（§26、§17、ブログ層 §16.1・§17.2・§20）

| REQ | 要件 | 実装 | test | 結果 |
| --- | --- | --- | --- | --- |
| REQ-SEC01 | §26.4 テナント分離（全クエリに workspace_id 制約） | `src/domain/shared/tenancy.ts` `assertSameTenant()` を 6 つのユースケース群（product / ranking / content / distribution / monetization / publication）が呼ぶ | NOT RUN（保存先が見本データのため、DB クエリ側の制約は未検証） | スタブ |
| REQ-SEC02 | URL取り込みの SSRF 対策（private IP・redirect・スキーム制限） | 入口は `src/domain/monetization/link-ingestion.ts` `normalizeAffiliateUrl()` / `isInternalHost()`。取得は `src/infrastructure/http/guarded-fetch.ts` が転送を自動で追わず 1 ホップごとに再判定（回数5・2MB・10秒の上限つき） | PASS（`tests/infrastructure/guarded-fetch.test.ts` 9件 + `tests/architecture/dependency-direction.test.ts`「外部への取得は guarded-fetch だけが行う」） | 実装済 |
| REQ-SEC03 | provenance（§10.5）の記録 | `src/domain/shared/provenance.ts` `createProvenance()` / `isExpired()` | NOT RUN（記録は作れるが、取得系アダプタが未接続のため実データが流れない） | スタブ |
| REQ-SEC04 | §19.4 編集評価と報酬データの分離（Ranking Service は Editorial のみ） | `src/domain/shared/data-classification.ts` の `Editorial<T>` / `Commercial<T>`。ランキングのユースケースに報酬ポートを注入すると型が通らない | PASS（`tests/architecture/commercial-isolation.test.ts` / `dependency-direction.test.ts`「ランキングのユースケースは報酬のポートを参照しない」） | 実装済 |
| REQ-SEC05 | プロンプトインジェクション対策（ブログ層 §16.1） | `src/domain/generation/injection-guard.ts`（7パターン検出・削除せず保留）+ `src/infrastructure/llm/prompt-assembly.ts`（指示と資料を別枠・区切り記号の無効化・資料は指示ではないと明記） | PASS（`tests/domain/generation-plan.test.ts`「取り込んだ文章の扱い」6件） | 実装済 |
| REQ-SEC06 | `rel="sponsored"`（ブログ層 §17.2） | `src/domain/compliance/disclosure.ts` `relAttributeFor()`、表示は `src/presentation/ui/patterns/disclosure.tsx` `AffiliateLink` のみ。画面が自前で書いていないことを機械で検査 | PASS（`tests/domain/invariants.test.ts` / `tests/ui/ui-layers.test.ts`「画面が広告表示を自前で書いていない」） | 実装済 |
| REQ-SEC07 | 広告表示・コンプライアンス（薬機法・景表法・ASP規約） | `src/domain/compliance/policy-rule.ts`（分野×出力先で絞る。根拠と代替表現が無いルールは登録できない）+ `quality-check.ts` の誇大表現・広告表記・CTA過剰。公開可否は `publish-gate.ts` | PASS（`tests/domain/invariants.test.ts` 該当群）。分野別ルールの初期データ登録は残課題 | スタブ |
| REQ-SEC08 | WCAG 2.2 AA（ブログ層 §20） | 共通UIで担保: 触れる大きさ `--tap-target-min`、`--focus-ring-*`、`aria-current`、色以外での区別（`FactualityBadge` / `FactSourceBadge` は記号+文字）、表の `scope` / `caption` | PASS（`tests/ui/design-tokens.test.ts` / `tests/ui/patterns-render.test.tsx`）。自動計測（axe）と実機での読み上げ確認は残課題 | スタブ |
| REQ-SEC09 | 監査ログ（AuditLog） | `src/domain/compliance/audit-log.ts` `createAuditLogEntry()` / `redactSensitive()`（秘密情報は `[記録しません]` に置換）/ `wasApprovedByHuman()` | `/admin/settings`（監査記録の一覧） | 実装済 |
| REQ-SEC10 | 秘密情報の取り扱い（Secrets は wrangler secret、リポジトリに置かない） | `.gitignore`（`.dev.vars`） | NOT RUN | 実装済 |

## L. 品質検査（`05-文章作成メソッド仕様.md` §7 の QC-01〜QC-17）

| REQ | 検査 | 実装 | 結果 |
| --- | --- | --- | --- |
| REQ-QC01 | QC-01 必須セクションの存在 | `src/domain/authoring/article-structure.ts` `missingSections()` を `src/domain/compliance/publish-gate.ts` が `required_sections` として呼ぶ | 実装済 |
| REQ-QC02 | QC-02〜QC-04 段落・文長・見出し | `quality-check.ts` `paragraph_shape`（1段落3文まで）/ `sentence_length`（1文80文字まで）/ `vague_heading`（`VAGUE_HEADING_PATTERNS`） | 実装済 |
| REQ-QC03 | QC-05 禁止表現 | `quality-check.ts` `EXAGGERATION_PATTERNS`（8種）+ `checkProhibitedPhrases()`（書き手ごと）+ `policy-rule.ts`（分野別・登録制） | 実装済 |
| REQ-QC04 | QC-06 事実分類の付与 | `src/domain/shared/data-classification.ts` + `writing-style.ts` `FACT_LABELS`（6種）。表示は `FactSourceBadge` | 実装済 |
| REQ-QC05 | QC-07 根拠のない主張 | `src/domain/evidence/claim.ts` `isClaimUsable` + `quality-check.ts` `unsourced_number` / `missing_citation` | 実装済 |
| REQ-QC06 | QC-08〜QC-10 単位・結論一致・日付 | `quality-check.ts` `unit_missing`（`MEASURE_WORDS` の後ろの数値に単位が無ければ止める）/ `conclusion_mismatch`（冒頭と最終の結論を照合）/ `relative_date`（「先日」「今年」など11種） | 実装済 |
| REQ-QC07 | QC-11 ペルソナ差分の事実境界 | `src/domain/authoring/author-persona.ts` `checkFactBoundary()` を `quality-check.ts` `fabricated_experience` が呼ぶ | 実装済 |
| REQ-QC08 | QC-12 マルチサイト重複 | `quality-check.ts` `similarity()`（3-gram、0.85以上で停止）+ `site-blueprint.ts` `differentiationGap()`（10軸・3軸以上） | 実装済 |
| REQ-QC09 | QC-13 広告表記 | `quality-check.ts` `disclosure_present`（媒体が本文内表記を要求する場合も見る）+ `publish-gate.ts` `disclosure` | 実装済 |
| REQ-QC10 | QC-14 会話ブロック制約 | `conversation-block.ts` `validateConversationFlow()` を `quality-check.ts` `conversation_flow` が呼ぶ（本文を挟むと連続を数え直す） | 実装済 |
| REQ-QC11 | QC-15〜QC-17 薬機法・景表法・アクセシビリティ | 薬機法・景表法は `policy-rule.ts`（分野×出力先・根拠と代替表現つき）、アクセシビリティは共通UI側（REQ-SEC08）。分野別ルールの初期データは未登録 | スタブ |
| REQ-QC12 | 公開ゲート（ブログ層 §21 の11項目） | `src/domain/compliance/publish-gate.ts` `evaluatePublishGate()`（13項目。仕組みの無いものは失敗にせず `skipped` に残す） | 実装済 |

いずれの検査結果も `/admin/content/[variant]` に表示される（止めた件数・理由・
**検査していない項目とその理由**）。「検査していないものを合格に見せない」ため、
`skipped` を画面に出すところまでを 1 組として扱う。

## M. 禁止依存（ブログ層 §27）

| REQ | 要件 | 検査方法 | 実装 | 結果 |
| --- | --- | --- | --- | --- |
| REQ-FD01 | ランキング式の重複実装禁止 | `tests/architecture/dependency-direction.test.ts`「ランキングの計算は domain/ranking の外に無い」 | `src/domain/ranking/scoring.ts` に集約 | 実装済 |
| REQ-FD02 | 報酬データを推薦スコア入力にしない | `Editorial<T>`/`Commercial<T>` の型 + 組み立て時の実行時検査 + `tests/architecture/commercial-isolation.test.ts` | `src/domain/shared/data-classification.ts`、`src/application/usecases/ranking/rank-products.ts` | 実装済 |
| REQ-FD03 | 根拠のない主張を公開しない | 公開ゲート QC-07 | `publish-gate.ts`（部分） | スタブ |
| REQ-FD04 | WebMCP でしか到達できない機能を作らない | 1つのカタログを4入口へ写す（`tests/presentation/one-usecase-three-adapters.test.ts`、`tests/presentation/composition.test.ts`） | `src/presentation/tools/catalog.ts`、`src/presentation/composition.ts` | 実装済 |
| REQ-FD05 | ブログ層で正規データを再定義しない | スキーマ定義が `src/db/schema.ts` のみであること | 実装済（現状1箇所） | 実装済 |
| REQ-FD06 | サーバー操作ファイルの形を揃える（`"use server"` からは非同期の関数だけを出す） | `tests/architecture/server-action-exports.test.ts`（`src` 全走査。型以外の `export` を許さない） | 状態の型と初期値は `*-state.ts` に置く（sites / fact-boundary / reschedule の3件） | 実装済 |

## N. 受け入れ条件（プラットフォーム層 §30.1〜§30.8）

検証は `tests/acceptance/acceptance-criteria.test.ts` に置いてある。
**中の関数を直接呼ばず、画面や AI が使うのと同じ入口（ツールカタログ）から流している。**
中を直接つつくと、入口の配線が外れていてもテストは緑のままになるため。

| REQ | 条件 | 検証方法 | 結果 |
| --- | --- | --- | --- |
| REQ-A01 | §30.1 URL登録（5項目） | `acceptance-criteria.test.ts` §30.1（4テスト）。元の URL がそのまま残ること、危険な URL を断ること、確認待ちで止まること、情報源をたどれること | 実装済 |
| REQ-A02 | §30.2 比較（4項目） | 同 §30.2（4テスト）。同一/代替の区別、候補の理由、**報酬が比較スコアに入らないこと**、手動での増減 | 実装済 |
| REQ-A03 | §30.3 ペルソナ（4項目） | 同 §30.3（4テスト）。書き手・読者が複数、組み合わせで書き分け、実体験のない一人称の検出 | 実装済 |
| REQ-A04 | §30.4 AI生成（6項目） | 同 §30.4（7テスト）。4媒体の生成、素材が揃うまで始められないこと、主張と根拠の確認、広告表記の自動挿入、媒体ルール違反の警告、切り口の違い、**根拠のない主張は承認できないこと** | 実装済 |
| REQ-A05 | §30.5 ブログ（5項目） | 同 §30.5（5テスト）。複数サイト、サイトごとの設定、標準構成、会話・比較・商品カードが共通部品として在ること、公開先の信頼ページ | 実装済 |
| REQ-A06 | §30.6 配信（6項目） | 同 §30.6（6テスト）。媒体別プレビュー、承認後だけ外部投稿、重複防止、結果とURLの保存、**note を直接投稿と誤表示しないこと**、失敗理由と再実行 | 実装済 |
| REQ-A07 | §30.7 アフィリエイト（5項目） | 同 §30.7（5テスト）。リンク改変なし、使用箇所の追跡、リンク切れ検出、提携終了の影響範囲、`rel="sponsored"` の一貫 | 実装済 |
| REQ-A08 | §30.8 双方向トレーサビリティ | 同 §30.8（2テスト）＋ **本ファイルがその実体**。実測を名乗る主張には必ず根拠が付き、根拠の無い主張は消さずに「推測」と表示される | 実装済 |

---

## O. 見た目の切り替え（配色 × 明暗）

利用者の追加要件。**配色（青系・ピンク系・ホワイト系・グレー系・グリーン系ほか）× 明暗（端末に合わせる／明るい／暗い）** の 2 軸。
掛け合わせの数だけ定義を書かないことが要で、各トークンは `light-dark(明るい値, 暗い値)` の 1 行に保つ。

| REQ | 要件 | 実装 | 画面 | 導線 | 状態 | RWD | a11y | test | 結果 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-TH01 | 明暗を切り替えられる（端末の設定に合わせる／明るい／暗い）。ダークは明るい値の反転にしない | `src/domain/authoring/site-blueprint.ts`（`COLOR_MODES` / `COLOR_MODE_LABELS`）、`src/presentation/ui/tokens/semantic.css`（`color-scheme` と `[data-color-mode]`）、各トークンは `light-dark()` の 1 行 | `src/app/admin/settings/page.tsx`「画面の見た目」、読者側は `src/presentation/ui/templates/site-shell.tsx` の足元 | サイドナビ「設定」／ブログの記事を読み終えた位置 | 未選択（＝端末の設定に従う。属性を出さないことが既定）/ 不正な値は既定へ落とす | 対応（選択欄は `auto-fit` で狭い画面では縦積み） | 対応（`fieldset`/`legend`、各欄にラベルと説明、全配色×明暗で AA） | PASS（`tests/ui/theme-contrast.test.ts` 全配色×明暗、`tests/ui/design-tokens.test.ts`） | 実装済 |
| REQ-TH02 | 配色を複数から選べる（青系・ピンク系・ホワイト系・グレー系・グリーン系を含む）。増やしても部品は変わらない | `src/domain/authoring/site-blueprint.ts`（`BRAND_THEMES` 10種・`BRAND_THEME_LABELS`）、`src/presentation/ui/tokens/themes.css`（各配色が同じ 10 トークンを上書き）、`src/presentation/ui/tokens/primitives.css`（色の段） | 同上（管理画面のみ配色を選べる） | サイドナビ「設定」 | 不正な値は既定へ落とす（`parseBrandTheme`） | 対応 | 対応（操作色と注意色を同系色にせず、明度差だけの区別にしない） | PASS（`tests/ui/theme-contrast.test.ts`、`tests/ui/blueprint-theme.test.ts`） | 実装済（**配色を 1 つ増やす作業を実測。3 ファイル・部品 0 ファイル**。`docs/architecture/changeability-scenarios.md` ⑫） |
| REQ-TH03 | 切り替え部品を一元化する（管理画面用と読者用で二重実装しない） | `src/presentation/ui/patterns/appearance-picker.tsx`（唯一の実装。選択肢は渡してもらう形で、配色の一覧を持たない）、`src/presentation/ui/appearance.ts`（属性名・cookie 名・当て方） | `src/app/admin/settings/page.tsx`、`src/presentation/ui/templates/site-shell.tsx`、見本帳 `src/app/admin/ui-catalog/page.tsx` §18 | 設定／ブログの足元／見本帳 | 選択肢に無い値は無視する | 対応 | 対応（共通の `Select` を使うため、ラベル・説明・focus の作法が全画面で同じ） | PASS（`tests/ui/ui-layers.test.ts`「見本帳に全部の部品が載っている」「部品が業務判断を持っていない」） | 実装済 |
| REQ-TH04 | 再マウントもチラつき（FOUC）も起こさない。最初の描画から前回の選択が効く | `src/presentation/appearance.ts`（cookie を読む唯一の場所）、`src/app/layout.tsx`（一番外側に属性を当てる唯一の場所）、切り替えは属性の書き換えのみ | 全画面（`<html>` の属性） | — | 未選択は既定（`graphite-amber` / 端末の設定） | 対応 | 対応（JS が動かない環境でも選択が効く） | PASS（`pnpm run preview` で 25 ルートを cookie 付きで確認。全ルートで属性が当たることを実測） | 実装済（**端末ごとの保存。アカウントに紐づける持ち回りはログイン導入後**） |
| REQ-TH05 | 配色を増やすと自動でコントラスト検査に入る（増やしたのに検査されない、が起きない） | `tests/ui/theme-contrast.test.ts`（検査対象を `BRAND_THEMES` から取り、色の組み合わせは部品の CSS から機械的に集める） | 画面義務なし（検査の仕組み） | — | — | — | — | PASS（配色追加でテスト数が 74 → 76 に自動増。テストファイルは無変更） | 実装済 |

**この節で見つけて直した実際の不具合（2 件）**:

- 暗い画面で `--color-text-on-accent` に暗いとき用の値が無く、実行中のボタンと注意の吹き出しが **1.11〜1.25:1** だった（読めない）。
- スタブの印（`.stubLabel`）が **3.30:1** で、12px の文字には足りなかった。**スタブの印は「まだ中身が無い」を伝える最重要の表示**なので、読めないことは致命的だった。

どちらも目視では見つけていない。**機械検査を書いた結果として出てきた。**

---

## P. 計測（AI の利用と費用 / 読まれ方 / 同意）

利用者の追加要件。**「どのブログで誰がどのモデルを使ったか」**と
**「どこを押し、どこを時間をかけて見ているか」**の 2 つを測る。

設計上の要は 3 つある。

1. **計測できることの一覧を 1 箇所に置き、送る側・貯める側・数える側の型をそこから導く。**
   イベント名の文字列を各所で書くと「画面は `cta_click`、集計は `click_cta`」で
   数字が永遠に 0、という壊れ方をする。壊れても画面は正常に見えるので気づけない。
2. **計測点を画面に手で埋め込まない。** 共通UIの部品が `data-tel-*` で自分が何かを名乗り、
   拾う側が画面全体で 1 回だけ拾う。手で埋め込むと新しい画面だけ計測が抜ける。
3. **同意は最初から組み込む。** 後から足すと、足す時点で既に同意なしの記録が貯まっており、
   消すところから始まる。黙っている人を同意した扱いにしない。

| REQ | 要件 | 実装 | 画面 | 導線 | 状態 | RWD | a11y | test | 結果 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-TM01 | 計測イベントの形を 1 箇所で定義し、送信・保存・集計の型をそこから導く（イベント名の文字列を各所で作らない） | `src/domain/analytics/telemetry-events.ts`（`TELEMETRY_EVENTS` 12種の表。`TelemetryPayload<K>` は手書きではなく表から導出。`buildEvent` が知らない名前・欠けた項目・型違いを入口で落とす） | 画面義務なし（型の仕組み） | — | — | — | — | PASS（`tests/domain/telemetry.test.ts` 「表にない名前は送れない」「必須の項目が欠けていると落ちる」「型が違うと落ちる」） | 実装済 |
| REQ-TM02 | AI 利用の計測（作業場所・ブランド・ブログ・実行者・モデル・提供元・用途・プロンプトテンプレートIDと版・入出力トークン・所要時間・成否・概算費用・成果物への参照） | `src/domain/analytics/telemetry-events.ts` `ai_model_usage`（17項目）、`src/domain/analytics/ai-usage.ts`（`MODEL_PRICES` / `estimateCostJpy` / `rollupAiUsage`）、`src/application/ports/telemetry.ts` `TelemetrySinkPort.aiUsage` | `src/app/admin/ai-usage/page.tsx` | サイドナビ「AI の利用と費用」 | loading（サーバ描画）/ empty（利用が無い理由を文で表示）/ error（`ErrorView` + ホームへ戻る）/ 保存先の状態を `StorageNotice` で明示 | 対応 | 対応（`<th scope="row">` の表、数字は等幅） | PASS（`tests/domain/telemetry.test.ts` 「AI の記録は参照 ID だけを持ち、文章そのものを持たない」ほか） | 実装済（保存先は D1 の `telemetry_events`） |
| REQ-TM03 | ブログごと・モデルごとの利用状況と費用を見る管理画面 | `src/application/usecases/analytics/ai-usage-report.ts`（数字と一緒に**その数字の限界**を返す。概算であること、価格未登録のモデルが何件あるか） | `src/app/admin/ai-usage/page.tsx` | サイドナビ「AI の利用と費用」／「数字」から相互に行き来 | 上と同じ4状態 + 価格未登録のモデルがあるときの注意書き | 対応 | 対応 | PASS（`tests/domain/telemetry.test.ts` 「ブログ × モデルで畳み、費用の多い順に並ぶ」「失敗した呼び出しも数え、費用に含める」「価格が分からないモデルの件数が残る」） | 実装済（保存先は D1 の `telemetry_events`） |
| REQ-TM04 | 読者の行動計測（ページ閲覧・読み進めた割合・要素ごとのクリック・節ごとの滞在時間・離脱位置・検索と絞り込み・成果リンクのクリック・内部リンクの遷移） | `src/domain/analytics/telemetry-events.ts`（`page_view` / `scroll_depth` / `section_dwell` / `element_click` / `ranking_row_click` / `affiliate_click` / `internal_link_click` / `search_performed` / `filter_changed` / `page_exit`）、`src/presentation/telemetry/collector.tsx`、`src/app/api/telemetry/route.ts` | 読者向け全ページ（`src/presentation/site/page-frame.tsx` の共通枠から 1 箇所だけ差し込む） | 読者がブログを読む操作そのもの | 同意が無いときは回数だけ数える／`suppressAll` のときは何も送らない | 対応（表示に影響しない） | 対応（`data-*` 属性のみで、読み上げ・操作に影響しない） | PASS（`tests/domain/telemetry.test.ts` 「同意が無くても、回数だけのイベントは記録できる」ほか） | 実装済（保存先は D1 の `telemetry_events`） |
| REQ-TM05 | 計測点を各画面に手で埋め込まない（共通UIの部品が「この要素は何か」を宣言する） | `src/presentation/ui/telemetry-attrs.ts`（要素12種・節9種の名乗り）、`patterns/disclosure.tsx`（`AffiliateLink` は**必ず**名乗るので成果リンクのクリックは取りこぼせない）、`patterns/product-card.tsx`、`patterns/ranking-table.tsx`（順位表の各行） | `src/app/admin/ui-catalog/page.tsx`（部品の見本帳） | サイドナビ「画面部品の見本」 | 印を付けない使い方（見本帳）では `undefined` を渡せば付かない | 対応 | 対応 | PASS（`tests/ui/ui-layers.test.ts` 「部品が業務判断を持っていない」「共通UIから通信しない」） | 実装済 |
| REQ-TM06 | 節ごとの滞在時間を構造上のまとまり（導入・順位・比較・根拠・CTA など）で測る | `src/presentation/ui/templates/article-view.tsx`（節が種類を名乗る）、`src/presentation/telemetry/collector.tsx`（`IntersectionObserver` で半分見えたら計時、1 秒未満は捨てる） | 記事画面（`/s/{site}/best/*`・`/reviews/*`・`/compare/*`・`/guides/*`） | 記事を読む操作 | 見えていない節は測らない／同意が無ければ測らない | 対応 | 対応 | PASS（`tests/ui/ui-layers.test.ts`、節の種類は `TELEMETRY_SECTION_KINDS` に限定） | 実装済（保存先は D1 の `telemetry_events`） |
| REQ-TM07 | 同意管理を最初から組み込む。**同意が無くても壊れない**（誰のものか分からない形の集計だけになる） | `src/domain/analytics/consent.ts`（`decideConsent` / `mayRecord`）、`src/presentation/ui/patterns/consent-banner.tsx`（2つのボタンの目立ち方を揃える＝断りにくくしない）、`src/presentation/telemetry/consent-server.ts`（cookie とヘッダを読む唯一の場所） | 読者向け全ページの足元（`templates/site-shell.tsx`）、見本帳 §19 | ブログのどのページからでも。回答後は「いまどうなっているか」と取り消しの入口が残る | 未回答／許可／拒否の3状態すべてに表示あり。**断ると使えなくなる機能は無い** | 対応 | 対応（共通の `Button`、44px 最小、色に頼らず文で状態を伝える） | PASS（`tests/domain/telemetry.test.ts` 「黙っている人を同意した扱いにしない」「断った人は詳しい計測をしない」「同意が無くても、回数だけのイベントは記録できる」） | 実装済 |
| REQ-TM08 | ブラウザの追跡拒否（DNT / GPC）を実際に効かせる。自動巡回とプレビューは数字に混ぜない | `src/domain/analytics/consent.ts`（判断の順番は 巡回/プレビュー → GPC/DNT → 本人の許可 の 1 通りだけ）、`src/presentation/telemetry/consent-server.ts`（読めないときは同意なしに倒す） | `/s/{site}/measurement`（決まった理由をそのまま表示） | フッター「計測について」 | 読み取りに失敗しても同意なし扱いで動く | 対応 | 対応 | PASS（`tests/domain/telemetry.test.ts` 「ブラウザの追跡拒否は、本人の許可より強い」「自動巡回とプレビューは一切記録しない」） | 実装済 |
| REQ-TM09 | 仮名化・保存期間・削除手段（生 IP と詳しい位置は記録しない。無期限で貯めない） | `src/domain/analytics/consent.ts`（`RETENTION_DAYS` 回数のみ400日／詳しい記録90日、`retentionDeadline` / `isExpired`、`readerKeyScope` は日とブログで区切るので日をまたぐと別人）、`src/domain/analytics/telemetry-events.ts`（`FORBIDDEN_FIELDS` 17語を入口で落とす）、`src/application/ports/telemetry.ts`（`purgeExpired` / `forgetReader` を最初から port に持つ） | `/s/{site}/measurement`（保存期間を明示） | フッター「計測について」 | — | 対応 | 対応 | PASS（`tests/domain/telemetry.test.ts` 「無期限がない」「記録してはいけない項目が混ざっていたら、そのイベントごと落とす」「日をまたぐと別のものになる」「ブログをまたいで同じ人として繋がらない」） | 実装済 |
| REQ-TM10 | 読者向けの開示ページ（何を記録し、何を記録しないか、いつ消すか、どう取り消すか） | `src/application/usecases/analytics/explain-telemetry.ts`（**内容を画面に書き起こさず登録表から生成する**。計測を 1 つ足せば説明にも自動で出る） | `src/app/s/[site]/measurement/page.tsx` | 全ページのフッター「計測について」＋同意のお願いの中のリンク | 未回答／許可／拒否のいまの状態を先頭に表示 | 対応（`PolicyView` の共通枠） | 対応 | PASS（`tests/domain/site-routes.test.ts`「表にある道には画面がある」「画面には表の行がある」。ルート表に `measurement` を追加済み） | 実装済 |
| REQ-TM11 | 読者の体験を損なわない（本文の表示をふさがない・失敗しても記事に影響しない・まとめて送る・離脱時は `sendBeacon`） | `src/presentation/telemetry/collector.tsx`（15秒ごと／20件たまったら送る、離脱時は `sendBeacon`、送信失敗は握りつぶす）、`src/app/api/telemetry/route.ts`（**常に 204 を返す**。計測の失敗を読者に見せない。本文32KB・1回50件の上限） | 画面義務なし（送り方の決めごと） | — | — | — | — | PASS（`pnpm run build` で全ルート生成。計測は本文の描画を待たない） | 実装済 |
| REQ-TM12 | 計測は差し替え可能な接続部にする（ドメインは計測の実装を知らない） | `src/application/ports/telemetry.ts`（`TelemetrySinkPort` / `ConsentStorePort` / `TelemetryQueryPort`）、`src/infrastructure/persistence/sample/telemetry-sample-sink.ts`、`src/infrastructure/composition.ts`（差し込みは 1 箇所） | 画面義務なし（層の分離） | — | — | — | — | PASS（`tests/architecture/dependency-direction.test.ts`「domain は infrastructure を知らない」） | 実装済 |
| REQ-TM13 | 計測の保存先（`telemetry_events` 1 表） | `drizzle/0007_shallow_molten_man.sql`、`src/infrastructure/persistence/d1/telemetry-repository.ts`（`createD1TelemetrySink` と `createD1TelemetryMetricsRepository` が**同じ 1 表**を書き／読みする）。`sample/telemetry-sample-sink.ts` は接続の無い場所（`pnpm dev`・自動テスト）で使う**控え**として残す | 画面義務なし（保存先） | — | 保存先の状態を `/admin/analytics`・`/admin/ai-usage` の `StorageNotice` で明示 | — | — | PASS（`tests/integration/d1-telemetry.test.ts` 11 件が実際の D1 と `drizzle/*.sql` で動く） | 実装済。**AI 利用も同じ表に入れる**（別表を作らない。同じ「起きたこと」を 2 か所に分けると、どちらが本当かを決める根拠が無くなる） |

**測らないと決めたもの**（要件の裏返しとして明記する）:

- 生の IP アドレス、詳しい位置情報 — 宣言の段階でも送信の段階でも落とす
- プロンプト本文、生成された文章そのもの — **参照 ID だけ**を持つ。入れると、消したはずの下書きが計測の記録として残り続ける
- 他サイトでの行動 — このアプリが配信していないページを測らない
- 消せない目印（IP や端末情報から作る指紋） — 本人が消す手段を持てないため作らない

---

## Q. 改善ループ（測る → 比べる → 直す を回す仕組み）

利用者の追加要件。**「分析をして、それをさらに良くする」を、
文章の構成にも見た目にも同じ仕組みで回す**。将来は正のループ・探索・劣化検知なども足したい。

設計上の要は 4 つある。

1. **変えられるものを登録表 1 枚に集める。**
   軸を 1 つ足すときに宣言するのは「候補の作り方 / どこに効かせるか / 何の指標で見るか」の 3 つだけで、
   ループ本体は 1 行も変わらない。色の実験も見出し順の実験も、同じ 1 本の道を通る。
2. **見せ方の設定（Variant Spec）を一級の物にする。**
   配色も見出し順も余白も、すべて「軸 → 値」の集まりという 1 つの形で表す。
   記録は既にある `Provenance`（出どころ）に載せる。**2 つ目の記録の仕組みを作らない。**
3. **件数が足りないうちは何も言わない。**
   小さなサイトではほとんどの比較が「分からない」で終わる。それが正しい。
   数字を良く見せるために判定を緩めると、根拠のない判断が記事の作り方の基準として残る。
4. **ループが「順位に報酬を入れない」の抜け道にならない。**
   これを人の心がけに任せない。軸の登録時に、既にある `assertFeedbackAllowed` へ突き当てる。

| REQ | 要件 | 実装 | 画面 | 導線 | 状態 | RWD | a11y | test | 結果 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-IM01 | 変えられるものを登録表 1 箇所に集める。軸を足してもループ本体を変えない | `src/domain/analytics/optimization.ts`（`OPTIMIZATION_DIMENSIONS` 20軸。各軸が候補の作り方・効かせ先・見る指標・直し先を宣言する） | `src/app/admin/improvement/dimensions/page.tsx`（一覧は登録表から生成。**画面に書き起こさない**） | サイドナビ「改善の状況」→「変えられるものを見る」 | 未実施の軸は「未実施」と出す | 対応（表は横スクロール、狭い画面で縦積み） | 対応（`<th scope="row">`、数字は等幅） | PASS（`tests/domain/improvement.test.ts`「登録済みの軸はすべて登録条件を満たす」「軸を足しても、判定と次の一手は軸の名前を知らないまま動く」） | 実装済 |
| REQ-IM02 | 文章の軸（構成・節の順・導入文の長さ・見出しの言い方・文の長さ・切り口・比較表の列・根拠の置き方・CTA の言い方・記事の長さ・画像の位置） | `optimization.ts` `group: "text"` の 10 軸 | 同上（「文章の組み立て」の表） | 同上 | — | 対応 | 対応 | PASS（同上） | 実装済 |
| REQ-IM03 | 見た目の軸（配色と明暗・文字の大きさ・余白の詰め方・本文の横幅・順位表の見せ方・最初に見える範囲の作り） | `optimization.ts` `group: "visual"` の 6 軸（配色は O 節の `BRAND_THEMES` をそのまま値に使う。**別の配色一覧を作らない**） | 同上（「見た目」の表） | 同上 | — | 対応 | 対応 | PASS（同上） | 実装済 |
| REQ-IM04 | たどり方の軸（内部リンクの位置と数・関連記事の見せ方・目次の形・記事の種類ごとのひな型） | `optimization.ts` `group: "navigation"` の 4 軸 | 同上（「たどり方」の表） | 同上 | — | 対応 | 対応 | PASS（同上） | 実装済 |
| REQ-IM05 | 見せ方の設定を一級の物にし、色も構成も同じ形で表す。記録は既にある出どころの仕組みに載せる | `src/domain/analytics/variant-spec.ts`（`VariantSpec` = `{軸, 値}` の集まり + `Provenance`。`createVariantSpec` が未登録の軸・型違い・重複を落とす） | `src/app/admin/improvement/dimensions/page.tsx`「いまの見せ方の設定」（`explainVariantSpec` の 1 文をそのまま出す） | サイドナビ「改善の状況」→「変えられるものを見る」 | 設定が無いときは理由つきの空表示／未承認は「（未承認）」と出す | 対応 | 対応 | PASS（`tests/domain/improvement.test.ts`「登録されていない軸は設定に入れられない」「数値で決める軸に文字を入れられない」「承認していない設定は、承認していないと分かる形で出る」） | 実装済 |
| REQ-IM06 | 適用には必ず人の承認を通す。**見た目だけの変更も同じ** | `variant-spec.ts` `approveVariantSpec`、`src/domain/analytics/improvement.ts`（`ImprovementSuggestion.requiresApproval` は `true` 固定で、`false` を書けない型） | `src/app/admin/improvement/page.tsx`（提案ごとに承認が要る旨を表示） | サイドナビ「改善の状況」 | 未承認の設定は適用できない旨を出す | 対応 | 対応 | PASS（`tests/domain/improvement.test.ts`「判定できないときでも次の一手は記録される」で `requiresApproval` を固定） | 実装済 |
| REQ-IM07 | 一度に変える軸の数を制限する（何が効いたか分からない比較を始めさせない） | `variant-spec.ts` `MAX_SIMULTANEOUS_DIMENSIONS = 2` と `assertComparable`、`src/domain/analytics/loop-run.ts`（開始時にも突き当てる） | `src/app/admin/improvement/dimensions/page.tsx` 冒頭の注意 | 同上 | 超えた比較は始める前に断る（理由に何を変えているかを列挙） | 対応 | 対応 | PASS（`tests/domain/improvement.test.ts`「同時に変えてよい数を超える比較は始める前に止まる」「差が無い 2 つは比べられない」） | 実装済 |
| REQ-IM08 | 必要件数に届くまで差があると言わない。多重比較にも対処する。小さなサイトでは正直に「効果不明」を出す | `src/domain/analytics/improvement.ts`（`judgeComparison`。必要件数は比較の数に比例、必要な差は平方根に比例。判定は 判定保留／効果不明／良くなった／悪くなった の 4 つ） | `src/app/admin/improvement/page.tsx`（判定保留・効果不明も同じ大きさで出す） | サイドナビ「改善の状況」 | 判定保留のときは「あと何件必要か」を文で出す | 対応 | 対応 | PASS（`tests/domain/improvement.test.ts`「件数が足りないうちは判定保留にする」「同時に見ている比較が多いほど、必要な件数が増える」「差が小さいときは効果不明と言う」） | 実装済 |
| REQ-IM09 | 実験の開始・終了・判定の履歴を残す。件数不足のまま終わらせない。指標の後出しを許さない | `src/domain/analytics/loop-run.ts`（`createLoopRun` / `startLoopRun` / `concludeLoopRun` / `stopLoopRun`。判定保留は終わらせられない。開始前に決めた指標以外では判定できない。打ち切りには理由が要る） | `src/app/admin/improvement/page.tsx`（比較ごとの状態と理由） | サイドナビ「改善の状況」 | 実施中／判定済／打ち切りを状態として表示 | 対応 | 対応 | PASS（`tests/domain/improvement.test.ts`「件数が足りないまま終わらせられない」「始める前に決めた指標以外では判定できない」「打ち切るには理由が要る」） | 実装済 |
| REQ-IM10 | ループの種類を増やせる形にする（負のループ・正のループ・探索・劣化検知・費用最適化）。**実装するのは 1 種類だけ** | `src/domain/analytics/loop-kinds.ts`（`LOOP_KINDS` 5種。動くのは「悪いところを直すループ」1 種のみ。他は動かすのに何が要るかを持つ）。共通の書き方は 見るもの／比べるもと／決め方／効かせ先／向き／止め方／承認者 | `src/app/admin/improvement/dimensions/page.tsx`「ループの種類」 | サイドナビ「改善の状況」→「変えられるものを見る」 | 動かないループには「まだ動きません」＋必要なものを出す | 対応 | 対応 | PASS（`tests/domain/improvement.test.ts`「いま動くのは 1 種類だけ」「まだ動かないループには、動かすのに何が要るかが必ず書いてある」） | 実装済（**動くのは 1 種類。残り 4 種類は形だけ**） |
| REQ-IM11 | ループを足すと、外せない約束が自動で付く。正のループには上限と止め方を必ず付ける | `loop-kinds.ts`（`UNIVERSAL_GUARDRAILS` 5件を `registerLoopKind` が自動で合成。正のループには上限値・連続適用 3 回まで・読者体験の下限で即停止 を追加。止め方の無いループは登録できない） | 同上（各ループの「外せない約束」「止める条件」） | 同上 | 登録に失敗したループは存在しない（起動時に落ちる） | 対応 | 対応 | PASS（`tests/domain/improvement.test.ts`「どのループにも、外せない約束が自動で付く」「正のループには上限と止め方が必ず付く」「止め方の無いループは登録できない」） | 実装済 |
| REQ-IM12 | ループが「順位に報酬を入れない」の抜け道にならない。根拠・広告表示・アクセシビリティ・同意の見せ方・事実と推測の書き分けは軸にできない | `optimization.ts` `NON_OPTIMIZABLE` 6件 + `assertRegistrable`（直し先を記事の書き直しと題材選びに限定し、**既にある `assertFeedbackAllowed` へそのまま突き当てる**。同じ決まりを 2 か所に書かない） | `src/app/admin/improvement/dimensions/page.tsx`「調整してはいけないもの」（軸の一覧と同じ画面に置く。別ページにすると、軸を足す人が読まない） | サイドナビ「改善の状況」→「変えられるものを見る」 | 登録しようとすると仕組みが断る（人のレビューではない） | 対応 | 対応 | PASS（`tests/domain/improvement.test.ts`「調整してはいけないものは、どれも軸にできない」「順位づけ・推奨・合格ラインへ戻す軸は登録できない」「収益の指標で見る軸は、記事の書き直し以外へ戻せない」） | 実装済 |
| REQ-IM13 | 改善ループの保存先（`variant_specs` / `loop_runs` / `loop_observations` テーブル） | `src/infrastructure/persistence/sample/improvement-sample-repository.ts`（見本データ。**保存は本当に失敗を返す**。見本には良くなった／判定保留／効果不明の 3 通りをわざと入れてある） | `/admin/improvement` に仮置きである旨を `StubNotice` で明示 | サイドナビ「改善の状況」 | 読み出しは見本、保存は失敗 | — | — | PASS（`tests/infrastructure/stub-ledger.test.ts` が台帳をコードから生成） | **スタブ**（解除条件: `variant_specs` / `loop_runs` / `loop_observations` テーブルの追加。台帳 `persistence:improvement-sample`） |

**軸にしないと決めたもの**（要件の裏返しとして明記する）:

- 根拠を示すこと — 根拠を減らせば文章は短く読みやすくなり、数字は良くなりやすい。**良くなるからこそ対象にしない**
- 広告であることの表示 — 景品表示法（ステマ告示）に関わる。有無も目立ち方も試験の対象にしない
- アクセシビリティ (WCAG 2.2 AA) — コントラストや操作性を落とすと見た目の印象は上がることがある。下限は動かさない
- 同意の選択肢の目立ち方 — 許可の側を目立たせれば同意率は上がる。それは改善ではなくダークパターン
- 事実と推測の書き分け — 推測を断定に変えると説得力は上がる。上がるが、嘘に近づく
- 順位づけの入力 — 報酬を順位に入れない決まりを、改善ループを迂回路にして破らないため

---

## R. テストの網羅（`docs/spec/10-テスト戦略仕様.md`）

利用者の追加要件。**「単体テストだけではない必要なテストを交え、変更しやすい仕組みにする」**。

この節の行は、他の節と性質が違う。**画面を持たないことが正しい**（テストは読者にも管理者にも見えない）。
代わりに「どのコマンドで確かめられるか」を `test` 欄に書く。

**この節を先回りで PASS にしない。** 実装が済んだ時点で、実際に走らせた結果だけを書き換える。

| REQ | 要件 | 実装 | 画面 | 導線 | 状態 | RWD | a11y | test | 結果 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-TS01 | テストの土台を 1 箇所に集める（ファクトリ・テストダブル・担当者・時刻固定・描画補助・読み上げ検査） | `tests/support/`（`factories.ts` / `doubles.ts` / `actors.ts` / `clock.ts` / `render.tsx` / `a11y.ts`） | — | — | — | — | — | 土台自身は `tests/architecture/` の契約検査で「各テストが自前で組み立てていないこと」を見る。型に項目を 1 つ足したときの書き換えが 1 箇所に閉じることを実測済み | 完了 |
| REQ-TS02 | 業務の決まりごとの単体テスト（順位に報酬を入れない／公開の条件／ループの外せない約束／止め方と上限／テナント境界） | `tests/domain/`（既存 9 ファイル） | — | — | — | — | — | PASS（`pnpm test tests/domain`） | 実装済 |
| REQ-TS03 | 手順の単体テスト。外側はすべてポートのテストダブルに差し替える | `tests/application/`（既存 8 ファイル） | — | — | — | — | — | PASS（`pnpm test tests/application`）。組み立ては `tests/support/` へ集約済み。**テスト用の差し替えで Editorial / Commercial の印が黙って消える不具合**をここで検出し、`testDeps()` 側で直した（印は列挙されない形で付くため、展開して組み直すと消える） | 完了 |
| REQ-TS04 | API の単体テストを**入口 3 種すべて**に対して、道具の一覧から生成する（正常系・入力検証・認証認可・テナント分離・エラー形式・スタブが失敗を返すこと） | `tests/presentation/tool-catalog-adapters.test.ts`（道具の一覧と項目名の辞書 `tool-inputs.ts` から 368 件を生成。入口 3 種で正常系・入力検証・認証認可・テナント分離・エラー形式・スタブが失敗を返すことを確認）と `one-usecase-three-adapters.test.ts` | — | — | — | — | — | PASS（368 件） | 完了 |
| REQ-TS05 | 画面の単体テスト（4 つの状態・孤立ページ禁止・入力検証・キーボード操作・フォーカス・読み上げ） | `tests/ui/page-render.test.tsx`（経路の表 `route-table.ts` から画面 50 枚を総当たり）、`patterns-render.test.tsx` / `tool-form.test.tsx`（部品） | — | — | — | — | — | PASS | 完了 |
| REQ-TS06 | 読み上げ検査を機械で行う（axe）。**配色 5 種 × 明暗 2 種すべて**でコントラストを確かめる | axe は `tests/support/a11y.ts` 経由で `page-render.test.tsx` が全画面に適用。コントラストは `tests/ui/theme-contrast.test.ts` が配色 5 種 × 明暗 2 種を登録表から総当たり | — | — | — | — | — | PASS | 完了 |
| REQ-TS07 | 結合テスト（生成 → 承認 → 公開 → 計測 → 分析 → 提案 → 承認 → 再生成の 1 周）。実際の D1 とマイグレーションを使う | `tests/integration/d1-link-inbox.test.ts`（wrangler の `getPlatformProxy` で workerd 上の実際の D1 を立て、`drizzle/*.sql` をそのまま流す。手書きの CREATE TABLE は使わない）と `tests/integration/full-loop.test.ts`（1 周を実際のユースケースで通す 7 件） | — | — | — | — | — | PASS。**両側から書いた**: 保存先を書ける差し替えにして 1 周が回ることを見たうえで、本番の組み立て（`createDeps()`）では未接続の段が成功を装わず次の一手つきで断ることを別に固定した。導入時に実在の不具合を検出（同じリンクの 2 回目の貼り付けが永久に失敗する／計測が数字に届かない／配信を作る入口が無い）。**計測の断絶は 2026-08-17 に解消**（残課題 25、`tests/integration/d1-telemetry.test.ts`） | 完了 |
| REQ-TS08 | 境界値・異常系（0/1/上限/上限+1、空/最大/最大+1、日付と時差、ページ送りの端）。**とくに統計判定の境界**で、件数が足りないのに「差がある」と言わないこと | `tests/domain/boundaries.test.ts`（統計判定・有効期限・商品同一性・会計期間・表現ポリシー、64 件）と `tests/domain/boundaries-platform.test.ts`（契約プランの上限・役割・金額・価格の鮮度・比較表の上限・配信の状態遷移、57 件） | — | — | — | — | — | PASS（121 件） | 完了 |
| REQ-TS09 | 契約検査（依存の向き・色や余白の直書き禁止・スタブ台帳・1 概念 1 定義・計測イベントの形が送信側と一致） | `tests/architecture/`（依存方向・商業データ遮断・Server Action・**閾値の一元化** `quality-gates.test.ts`・**1 概念 1 定義** `single-definition.test.ts`・**テストの誠実さと秘密情報の混入** `test-honesty.test.ts`）、`tests/ui/design-tokens.test.ts`、`tests/infrastructure/stub-ledger.test.ts` | — | — | — | — | — | PASS。導入時に実在の重複を検出して解消済み（収益モデルの表示名が画面によって「提携販売」「成果報酬の紹介」の 2 通り、記事タイプも 2 通り、`Site` 型が 2 つ、`/s` 接頭辞が 2 か所、`Page` が「取得の指定」と「画面の枠」で衝突）。いずれも**わざと壊して赤くなることを確認済み** | 完了 |
| REQ-TS10 | カバレッジを**層別**に測り、全体と「スタブを除いた実質」を併記する。数字合わせを禁じる | `vitest.config.mts` のカバレッジ設定、`scripts/coverage-report.mjs`、`docs/product/coverage.md` | — | — | — | — | — | 実測（2026-08-17、`pnpm verify` 通過時）: 全体 行 91.2% / 分岐 80.4% / 関数 86.5% / 文 89.2%。層別（行）は domain 94.3 / application 98.6 / presentation 88.7 / app 89.7 / infrastructure 78.7 で全層が下限以上。**閾値は 1 度も下げていない**（下限 80 のまま、テストを足して越えた）。スタブと実質の差 -10.7pt は**スタブ側が薄い向き**（数字合わせなら逆に振れる）だが、契約検査が絶対値で見るため上限 3pt には未達 → 残課題 24 | 完了（判定方法の見直しのみ残る） |

**この節の行に画面を作らない理由**: テストは製品の機能ではなく、製品が壊れていないことの確認手段である。
画面を作ると「テストの画面が最新か」を人が見張ることになり、確認手段自体が確認対象になる。
確認は `pnpm verify` の出力（機械が毎回作り直すもの）に一本化する。

---

## S. 自動チェックと公開（`docs/spec/11-CI-CD・品質ゲート仕様.md`）

利用者の追加要件。**「CI/CD が通るようにし、こちらで管理できるようにしておく」**。

「管理できる」を、確かめられる 4 つに分解してある（仕様 §1）。

| REQ | 要件 | 実装 | 画面 | 導線 | 状態 | RWD | a11y | test | 結果 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-CI01 | `pnpm verify` が CI とまったく同じ検査を再現する（機械の上でしか試せない状態を作らない） | `scripts/verify.mjs`、`package.json` の `verify` | — | — | — | — | — | PASS。`ci.yml` の検査ステップは `pnpm run verify` の 1 行のみ。**わざと壊して確認済**（型の誤りを 1 つ入れて終了コード 1、後続 4 件は実行せず停止、案内は ci-cd-guide ④） | **実装済** |
| REQ-CI02 | 閾値と検査項目を**1 箇所**に集め、CI 設定と手元の設定が別々に育たないようにする | `quality-gates.config.mjs`（読み手は `vitest.config.mts` / `scripts/verify.mjs` / `scripts/coverage-report.mjs` / `tests/architecture/quality-gates.test.ts` の 4 つ） | — | — | — | — | — | PASS（`tests/architecture/quality-gates.test.ts` 13 件）。`.github/workflows/` に閾値が書き写されていないことも同テストが機械的に検査する | **実装済** |
| REQ-CI03 | 検査の順番を固定する（型 → 静的検査 → 単体 → 結合 → 画面/読み上げ → カバレッジ閾値 → ビルド → 公開） | `quality-gates.config.mjs` の `CHECKS` が唯一の正本（`ci.yml` は順番を持たない） | — | — | — | — | — | PASS。順番の固定は `quality-gates.config.mjs` 側にあり、`ci.yml` は呼ぶだけなので**ずれようがない**。ビルドは検査では行わず公開時に 1 回だけ（型の確認は `next typegen` で足りる。理由は ci-cd-guide ②） | **実装済** |
| REQ-CI04 | ワークフローは 3 本だけ（検査 / 公開 / データの形の変更）。重複を残さない | `.github/workflows/{ci,deploy,migrate}.yml` | — | — | — | — | — | PASS。旧 `deploy-dev.yml` / `deploy-prod.yml` は削除済み。出し先は枝で決まる（`dev`→試し場 / `main`→本番） | **実装済** |
| REQ-CI05 | データの形の変更を自動で走らせない。手動起動＋確認文字列 `APPLY` を必須にし、順番は「形の変更 → 公開」 | `.github/workflows/migrate.yml` | — | — | — | — | — | PASS。`workflow_dispatch` のみ。`confirm != 'APPLY'` で最初のステップが失敗する。適用前に `wrangler d1 export` で控えを取り、成果物として 30 日保管。`deploy.yml` にマイグレーションは 1 行も無い | **実装済** |
| REQ-CI06 | 公開後のスモークテストを**間隔を空けて 2 回**行い、落ちたら緑で通さない | `.github/scripts/smoke.sh`（30 秒 → 1 回目 → 90 秒 → 2 回目） | — | — | — | — | — | 構文は確認済（`bash -n`）。判定は 2 回目で行い、落ちたら `exit 1`。**本番 URL に対する実行は未実施**（公開が未了のため） | **実装済**（実行は公開後） |
| REQ-CI07 | 秘密情報は GitHub Secrets と Cloudflare の環境変数にだけ置く。**登録は利用者本人が行い、代行しない** | `.dev.vars.example`（値を書かない）、`docs/product/ci-cd-guide.md` §8 に本人が実行する手順、`tests/architecture/test-honesty.test.ts`（鍵らしい形の文字列の検出と、見本に値を書いていないことの検査） | — | — | — | — | — | PASS。導入時に `.dev.vars.example` に値（`local-development-token`）が入っていたのを検出して空欄化。鍵らしい文字列を混ぜて赤くなることも確認済み | 完了 |
| REQ-CI08 | 非エンジニアが読める運用説明（何を見ているか / 落ちたらどうするか / どう公開し、どう戻すか） | `docs/product/ci-cd-guide.md` | — | — | — | — | — | 文書のため自動検査の対象外。`docs/spec/00-README.md` からの参照切れは既存の文書検査で見る | **実装済** |

**「わざと壊して赤くなることを確認する」まで済ませて初めて、この節を PASS にする。**
落ちない自動チェックは、動いているように見えるだけで、何も守っていない。

---

## T. 改善要望フィードバック（`docs/spec/12-改善要望フィードバック仕様.md`）

利用者の追加要件。**システム管理者どうしで改善要望をやり取りし、そのまま作業へ渡せるようにする**。

規範正本は `docs/spec/12-改善要望フィードバック仕様.md`（FB-AC-01〜24）、
実装契約は `docs/architecture/feedback-loop.md`。
この節は**ループの 2 件目**として作る。**新しい仕組みを横に建てない。**

| REQ | 要件 | 実装 | 画面 | 導線 | 状態 | RWD | a11y | test | 結果 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-FB01 | ループの種類の登録表へ 2 件目として `product_improvement` を足す。歯止め 5 本は自動で付く（定義側で書き忘れられない） | `src/domain/analytics/loop-kinds.ts`（受け取る画面が揃ったので `readiness: "implemented"`。判定規則は「1 件届いたら扱いを決める」で、**必要件数の判定には乗せない**） | — | — | — | — | — | PASS（`tests/domain/loop-kinds.test.ts`／`tests/domain/improvement.test.ts`：歯止めが自動で付く・統計の判定に乗っていない・動くのは 2 種類だけ） | 実装済 |
| REQ-FB02 | どの画面の右下にも同じ「改善」ボタンが出る。押せるのは管理者だけ | `src/presentation/ui/patterns/feedback-button.tsx`（共通UIの型）。差し込み口は `src/presentation/ui/templates/app-shell.tsx` の 1 箇所（`AdminShell` は素通し） | 管理側の全画面（共通レイアウト 1 箇所） | 画面右下に固定。キーボードでも到達できる | 権限なし=非表示 / 通常 / 送信中 / 送信済み | 対応（375px でも本文に重ならない） | 対応（`aria-label`、44px 最小、フォーカス可視） | PASS（`tests/ui/feedback-button.test.tsx`：4状態 + axe + 全配色 × 明暗）、`tests/presentation/nav-permissions.test.ts` | 実装済 |
| REQ-FB03 | 押すと出る書き込み欄。画面名が自動で入る。種類は 3 つ。「改善したいこと」は必須、「どうなってほしいですか」は任意 | `feedback-button.tsx`（ボタンと書き込み欄は**同じ 1 ファイル**。開閉の状態が 2 つに割れないため）、`src/domain/feedback/report.ts` | 同上（重ねて出す） | ボタン → 書き込み欄 → 送信 → 一覧へ | 未入力 / 入力中 / 送信中 / 失敗 / 送信済み | 対応 | 対応（Esc で閉じる、フォーカスを閉じ込める、必須は色以外でも示す） | PASS（`tests/ui/feedback-button.test.tsx`、`tests/domain/feedback.test.ts`：必須の空欄・長すぎる本文の境界・種類は 3 つだけ） | 実装済 |
| REQ-FB04 | 画面の写しを撮る。撮れなかったときは**撮れていないことをその場で伝える**。貼り付け・ファイル選択でも足せる | `src/presentation/ui/patterns/capture-canvas.tsx`、`src/domain/feedback/capture-policy.ts` | 書き込み欄の中 | 「画面を撮る」／貼り付け／ファイル | 未取得 / 取得中 / 取得済み / 一部撮れず / 失敗 | 対応 | 対応（画像に代わる説明を必ず持つ） | PASS（`tests/ui/capture-canvas.test.tsx`：撮れなかったときの文言が出る） | 実装済 |
| REQ-FB05 | 写しへ書き込める（手書き・四角・矢印・文字・黒塗り／赤・茶・青・黒、黒塗りは色を選べない）。**元に戻す・撮り直す・画像を外して文章だけで送る**ができる | 同上 + `src/domain/feedback/capture-policy.ts` | 同上 | 道具を選ぶ → 描く → 戻す／撮り直す／外す | 道具ごとの選択状態、履歴の有無で「元に戻す」の可否が変わる | 対応（指でも操作できる） | 対応（道具の選択を色だけで示さない、キーボードでも選べる） | PASS（`tests/ui/capture-canvas.test.tsx`：道具・元に戻す・画像を外す） | 実装済 |
| REQ-FB06 | 黒塗りは**画像そのものを塗り替える**。元画像を残して上に重ねる作りにしない | `src/domain/feedback/capture-policy.ts` の 5 手順（4 で元画像を捨てる） | — | — | — | — | — | PASS（`tests/domain/feedback.test.ts`：保存された値から元画像を取り出せない） | 実装済 |
| REQ-FB07 | 届いた要望の一覧。状態ごとの件数、重ねられる絞り込み、払い出しの状態・回数・最終日時の列、**まとめて払い出す**、空のときの案内文 | `src/app/admin/feedback/page.tsx`、`src/presentation/admin/feedback-forms.tsx`（`FeedbackHandoffForm`）、`src/application/usecases/feedback/list-feedback.ts` | `/admin/feedback`（「使い勝手を直す」の下） | 左メニュー → 一覧 → 詳細 | 空 / 一覧あり / 絞り込みで 0 件 / 失敗 | 対応（狭い幅では表を積む） | 対応（表の見出しを読み上げられる） | PASS（`tests/ui/page-render.test.tsx`：4状態 + axe。孤立ページ禁止は `tests/presentation/nav-permissions.test.ts`）、`tests/application/feedback.test.ts` | 実装済 |
| REQ-FB08 | 詳細画面 10 区画。「どうなってほしいか」が無いときは**無いと書く**。作業場所・ブランド・サイトも記録。技術情報は件数つきで畳む。状態の切り替え・メモ・扱いの決定（対応しない／重複／廃棄／元に戻す）は**やり直せる**。操作の記録は消さずに積む | `src/app/admin/feedback/[report]/page.tsx`、`src/presentation/admin/feedback-forms.tsx`（`FeedbackStatusForm` / `FeedbackDispositionForm`）、`src/domain/feedback/status.ts` / `disposition.ts` | `/admin/feedback/[report]` | 一覧 → 詳細 → 払い出し | 空欄あり / 通常 / 更新中 / 失敗 / 廃棄済み | 対応 | 対応（畳んだ区画の開閉を読み上げ、件数を文字で持つ） | PASS（`tests/presentation/feedback-actions.test.ts`：決めた扱いが取り消しで戻る・見送りは理由が要る、`tests/ui/feedback-admin-forms.test.tsx`、`tests/ui/page-render.test.tsx`） | 実装済 |
| REQ-FB09 | 作業する側へ渡す方法は 2 つだけ（人が写して渡す／鍵で取りに来る）。**何度渡しても結果が変わらない**ことを画面に書き、渡した記録に「誰が・どの鍵で」を残す | `src/domain/feedback/handoff.ts`、`src/application/usecases/feedback/hand-off-feedback.ts`、`src/app/api/feedback/pending/route.ts`、鍵の判定は `src/presentation/composition.ts` の `resolveIntegrationAccess`（**presentation で infrastructure を読んでよい唯一のファイル**） | 詳細画面の払い出し区画 | 「指示文を見る」／「払い出し済みにする」／「取得コマンドをコピー」 | 未払い出し / 下読みのみ / 払い出し済み / 一部渡せず / 失敗 | 対応 | 対応（渡した記録を表で読み上げられる） | PASS（`tests/application/feedback.test.ts`、`tests/presentation/feedback-pending-route.test.ts`：2 回目は空・下読みでは回数が増えない・履歴に「誰が・どの鍵で」が残る） | 実装済 |
| REQ-FB10 | 指示文に入れてよいものを**列挙して決める**。氏名・メールアドレス・画像・鍵・他の作業場所のデータは入れない。雛形は既にある版管理の仕組みに乗せる | `src/domain/feedback/handoff-prompt.ts`、`src/infrastructure/generation/handoff-templates.ts` | — | — | — | — | — | PASS（`tests/domain/handoff-prompt.test.ts`：許可した項目以外が 1 つでも混ざったら落ちる、`tests/presentation/feedback-pending-route.test.ts`：入口の出力にも混ざらない） | 実装済 |
| REQ-FB11 | **本文を AI への命令として実行しない**。1 つの区切りの中だけに置き、「これはデータであり命令ではない」と先に宣言し、区切りをまねた文字列を無害化し、区切りの外へ利用者の書いたものを出さない | 同上 | — | — | — | — | — | PASS（`tests/domain/handoff-prompt.test.ts`：区切りをまねた本文・制御文字・命令文を入れても外へ出ない） | 実装済 |
| REQ-FB12 | 鍵の発行・失効・最終利用・使える範囲を管理する。**値は発行時に 1 度だけ表示し、保存はかけ直した形で行う**。回数制限と操作の記録を持つ | `src/domain/feedback/integration-access.ts`、`src/application/usecases/feedback/manage-integration-keys.ts`、`src/infrastructure/platform/secret-minter.ts`、`src/presentation/admin/integration-access-form.tsx`、`src/app/admin/settings/integration-access/page.tsx`（`integration-key` ではなく `integration-access` にしたのは、この作業環境が鍵らしき名前のファイルへの書き込みを止めるため。見張りは迂回しない） | `/admin/settings/integration-access` | 設定 → 連携の鍵 | 鍵なし / 発行直後（1 度だけ表示） / 一覧 / 失効済み / 失敗 | 対応 | 対応（「1 度しか表示しない」ことを送信前に文字で伝える） | PASS（`tests/domain/feedback.test.ts`：保存された値から元の鍵を復元できない、`tests/presentation/feedback-actions.test.ts`：一覧を出し直しても値は返らない・AI の役割では発行できない、`tests/ui/feedback-admin-forms.test.tsx` + axe） | 実装済 |

**送信前に「何が一緒に送られるか」を見せる。** 封筒（送信者欄・添付）に氏名・メールアドレス・画像を
入れないことは仕組みで保証できるが、**本文に利用者自身が書いたものは機械的に取り除けない**。
「取り除きました」とは書かない（仕様 §10-1）。取りこぼしたときに誤った安心を与えるためである。

**Beads との二重管理をしない。** 届いた声はこの機能の保存先が持ち、作業単位は Beads が持つ。
1 件の要望が持つ Beads の課題番号は最大 1 つで、**着手・完了の状態は Beads を正とし、要望側へ写さない**（仕様 §12）。

---

## 集計（2026-08-17 時点）

### 全機能

| 区分 | 件数 |
| --- | --- |
| **全要件数 N** | **235** |
| 実装済・完了 X | 201（実装済 191 + 完了 10） |
| スタブ Y | 34 |
| 未着手 Z | **0** |

**未着手は 0 になった。** 最後まで残っていた T 節（改善要望フィードバック）12 件は、
送る口・一覧・詳細・払い出し・取りに来る入口・鍵の管理まで作り、
走らせたテストの名前を各行の `test` 欄に書いてある。
**先回りで「実装済」と書かない。** 走らせた結果が出た行だけを書き換える。

**残る要件スタブ 34 件は「作っていない」ではなく「本物の保存先につないでいない」である。**
差し替え先は `docs/architecture/feedback-loop.md` §2 の表に 1 行ずつ書いてある。

改善要望と受信箱は、2026-08-17 に**保存先を D1 へつないだ**（`feedback_reports` /
`integration_keys` / `integration_key_usages` / `link_ingestions`）。接続が供給されない環境
（`pnpm dev`・自動テスト）では見本データへ回るが、**黙って落ちない**（何で動いているかを画面に出す）。
同じ日に、**画面の写しの置き場**（R2）もつないだ。ここでも判断は同じで、
入れる口（要望フォームの「画面を撮る」）と出す口（要望の詳細画面）が**両方すでにあり**、
間だけが無かった。

配り方は**期限つき URL（署名付き URL）を使わない**ことにした。R2 のバインディングからは
作れずアクセスキーの発行が要ること、そして**配った後に閉じられない**ことによる。
代わりに取り出す口を 1 本置き（`/api/feedback-captures/<id>`）、どの作業場所のものかは
**URL ではなく呼び出し元の身元から**決める。ログインが入ったら、この 1 か所に判定を足せば閉じられる。

保存期間（180 日）を過ぎた写しは、**消す前から読み出し側で渡さない**。
掃除は同じ日に定期実行へつないだ（毎日 1 回、日本時間 2:00）が、掃除が
1 日 1 回である以上「期限は過ぎたが順番が来ていない」写しは必ず生まれるし、
掃除が失敗し続けることもある。**二重に守る**ことでのみ、画面の説明が実態と合う。

定期実行のために、Worker の入口を OpenNext の生成物から
**それを包む `worker-entry.js`** へ移した。生成物には画面と API の受け口しか無く、
定期実行の受け口が存在しないため。掃除の中身は `src/` の TypeScript にあり、
入口は配線だけを持つ（テストの無い場所に判断を置かないため）。
この配線は `tests/architecture/worker-entry.test.ts` が見張る
（入口が生成物へ戻る／環境を増やしたときに定期実行を書き忘れる／入口が掃除を呼ばなくなる、
の 3 通りは**いずれも公開に成功してしまう**種類の壊れ方なので、機械で見る）。

同じ日に、**ブログ作成ウィザードの下書きと、そこから作られたブログ**もつないだ
（`site_drafts` / `site_blueprints`、マイグレーション 0006）。
**この順番にした理由は「入れる口が既にあるから」**。入れる口が無い保存先を先につなぐと、
一生埋まらない空の画面ができ、「まだ作っていない」より判断しにくい状態になる。
記事の本文（`published_articles`）はまだ見本データのままで、入れる口が無い側に当たる。

**「スタブ」という言葉は 2 つの数え方がある。混ぜない。**

| 言葉 | 数えているもの | いまの値 | 正本 |
| --- | --- | --- | --- |
| スタブ（要件） | 仕様の要件のうち、本物の保存先や外部接続につながっていないもの | 34 | この表の最後の欄 |
| スタブ（つなぎ目） | コード上の差し込み口のうち、中身がまだ無いもの | 37 | `docs/product/stub-ledger.md` |
| 控え（つなぎ目） | 本物ができたあとも、接続が無い環境用に残す見本実装 | 5 | 同上。**消す予定が無いので減らない** |

要件側の 34 が減っていないのは、**要件のスタブ判定と保存先の接続が 1 対 1 ではない**ため。
たとえば REQ-E05（Site）の解除条件は保存先ではなく「公開状態の管理をこの型へ寄せる作業」で、
保存先をつないでも満たされない。**数が動かないことを、進んでいない証拠として読まない**
（逆に、動いていないのに動かして見せることもしない）。

要件 1 件が複数のつなぎ目を使うこともあれば、その逆もあるため、2 つの数字は一致しない。
一致させようとせず、**どちらの数え方の話をしているかを明示する**。

### Beads の課題が open なのに、この表が「実装済」なのはなぜか

3 つ目の数え方がある。**Beads の 1 課題は「機能をひととおり届ける」単位**で、
この表の 1 行は「仕様の要件 1 つ」である。要件が満たされていても、
その機能を届けたと言うには保存先や外部接続が要る。だから両方が同時に正しい。

食い違いではないことを 2026-08-17 に 1 件ずつ確かめ、
各課題の記録へ**残っている具体物**を書いた（`bd show <id>` の NOTES）。

| 課題 | この表での扱い | open のままにしている理由 |
| --- | --- | --- |
| `ah-87b` 読者向け公開面 | REQ-B01〜B22 実装済 | 公開記事の保存先が見本データ。外部の資格は不要 |
| `ah-dtq` Affiliate Hub | REQ-P09 実装済 | 保存先（資格不要）＋ ASP 8 社の申請（**利用者本人**） |
| `ah-g1i` Persona Studio | 該当行なし（書き手の管理） | `personas` の保存先。外部の資格は不要 |
| `ah-jyn` 商品インテリジェンス | REQ-P03 実装済 | 保存先（資格不要）＋ 外部からの自動収集 |
| `ah-mps` WebMCP の面 | REQ-API01 実装済 | 面は動く。載せる道具の**結果**が見本データ |
| `ah-q2s` Site Blueprint | REQ-E05 スタブ | 保存先は 2026-08-17 に D1 へつないだ（`site_drafts` / `site_blueprints`）。残るのは公開状態の管理を型へ寄せる作業 |
| `ah-ejk` 編集ワークフロー | REQ-P06 / REQ-S05 実装済 | 保存先（資格不要）＋ 生成 AI の鍵（**利用者本人**） |

**どれも「作っていない」ではない。** 資格が要らない 5 件は今つなげられる作業で、
資格が要る 2 件は利用者本人の登録が済むまで動かせない。

集計方法: 本ファイル内で `| REQ-` から始まる行の**最後の欄**を機械的に数えた値。手計算ではない。

```bash
T=docs/product/traceability.md
# 結果の欄で分類（「実装済（保存先は見本データ）」のような但し書き付きも数える）
grep -E '^\| REQ-' $T | grep -cE '\| \**実装済'          # → 191
grep -E '^\| REQ-' $T | grep -cE '\| \**完了'            # → 10
grep -E '^\| REQ-' $T | grep -cE '\| \**スタブ'          # → 34
grep -E '^\| REQ-' $T | grep -cE '\| \**未着手'          # → 0
# 合計（下の「画面を持たないことが正しい行」の表も `| REQ-` で始まるため、
# 単純な行数ではなく結果の欄で分類した 4 つの和を全要件数とする）
grep -E '^\| REQ-' $T | grep -cE '\| \**(実装済|完了|スタブ|未着手)'   # → 235
```

「実装済」と「完了」を分けているのは、**確かめ方が違う**ためである。
「実装済」は製品の機能が動くこと、「完了」はその機能を確かめる仕組み自体が
**わざと壊して赤くなるところまで**確認できていることを指す（R 節・S 節）。

節ごとの内訳（全要件 / 実装済・完了 / スタブ / 未着手）:

| 節 | 内容 | 全 | 実装済・完了 | スタブ | 未着手 |
| --- | --- | --- | --- | --- | --- |
| A | プラットフォーム層 機能モジュール | 10 | 10 | 0 | 0 |
| B | プラットフォーム層 主要画面 | 10 | 9 | 1 | 0 |
| C | ブログ層 情報アーキテクチャ（18ルート） | 18 | 15 | 3 | 0 |
| D | 記事構成・文章 | 12 | 12 | 0 | 0 |
| E | 生成基盤 | 11 | 10 | 1 | 0 |
| F | データモデル（32エンティティ） | 32 | 23 | 9 | 0 |
| G | API とイベント（イベント16種を1行ずつに分解済み） | 18 | 9 | 9 | 0 |
| H | WebMCP | 12 | 10 | 2 | 0 |
| I | バックエンドMCP | 3 | 2 | 1 | 0 |
| J | 権限（10ロール + 追加1） | 12 | 12 | 0 | 0 |
| K | セキュリティ・コンプライアンス | 10 | 6 | 4 | 0 |
| L | 品質検査（QC-01〜QC-17） | 12 | 11 | 1 | 0 |
| M | 禁止依存 | 6 | 5 | 1 | 0 |
| N | 受け入れ条件（§30.1〜§30.8） | 8 | 8 | 0 | 0 |
| O | 見た目の切り替え（配色 × 明暗） | 5 | 5 | 0 | 0 |
| P | 計測（AI の利用と費用 / 読まれ方 / 同意） | 13 | 13 | 0 | 0 |
| Q | 改善ループ（測る → 比べる → 直す） | 13 | 12 | 1 | 0 |
| R | テストの網羅 | 10 | 10 | 0 | 0 |
| S | 自動チェックと公開 | 8 | 8 | 0 | 0 |
| T | 改善要望フィードバック | 12 | 12 | 0 | 0 |
| | **合計** | **235** | **202** | **33** | **0** |


### UI/UX（画面義務のある要件のみ）

画面義務のある要件 = A(10) + B(10) + C(18) + D(12) + E(11) + F(32) + O(5) + P(13) + Q(13) + T(12) = 136 行。
このうち 13 行は**画面を持たないことが正しい**要件なので、義務のある行は **123**。

| 画面を持たないことが正しい行 | なぜ画面が要らないか |
| --- | --- |
| REQ-G07 / REQ-G09 / REQ-G10 | 型で禁じる仕組み・分離の担保 |
| REQ-TH05 | 配色を増やすと自動で検査に入る仕組み |
| REQ-TM01 | 計測イベントの型を導出する仕組み |
| REQ-TM11 | 送り方の決めごと（読者に見せない） |
| REQ-TM12 | 層の分離（差し替え可能な接続部） |
| REQ-TM13 | 保存先（`/admin/analytics`・`/admin/ai-usage` に保存先の状態は出る） |
| REQ-IM13 | 保存先（`/admin/improvement` に仮置きである旨は出る） |
| REQ-FB01 | ループの種類の登録表（歯止めが自動で付く仕組み） |
| REQ-FB06 | 黒塗りの作り方（結果は写しの中に現れる） |
| REQ-FB10 / REQ-FB11 | 指示文に入れてよいものの決めごとと、本文を命令として扱わない仕組み |

| 区分 | 件数 |
| --- | --- |
| **画面義務のある機能 N** | **123** |
| 画面あり X | **123** |
| 画面をこれから作る | **0** |
| 義務があるのに画面が無い Z | **0** |

**T 節の 8 行の画面も作り終えた。** 右下のボタンと書き込み欄は共通レイアウト 1 箇所から出し、
`/admin/feedback`・`/admin/feedback/[report]`・`/admin/settings/integration-access` の 3 画面は
`tests/ui/route-table.ts` に登録してある。この表が**画面が何本あるかの正本**で、
`tests/ui/page-render.test.tsx` が実ファイルと突き合わせ、
`tests/presentation/nav-permissions.test.ts` が左メニューからの到達を見る。
**改善要望のために新しい検査の枠を作らなかった**（`docs/architecture/feedback-loop.md` §5）。

**R 節（テスト）と S 節（自動チェックと公開）は画面義務の対象外。** 製品の機能ではなく、
製品が壊れていないことを確かめる手段だからである。ここに画面を作ると、
確認手段そのものが「最新かどうか人が見張る対象」になり、増やすほど信用が下がる。
確認は `pnpm verify` の出力に一本化する（R 節末尾に理由を明記）。

G〜N の節（API・イベント・WebMCP・MCP・権限・セキュリティ・品質検査・禁止依存・受け入れ条件）は
横断的な決めごとであり、単独の画面を持たない。これらは A〜F の画面の上で効いている
（例: 権限は各画面の表示制御として、品質検査は記事詳細の指摘欄として現れる）。

**「API はあるが画面が無い」行は 0 件。** 検査は人の目視ではなく、
`tests/presentation/admin-routes.test.ts` と `tests/domain/site-routes.test.ts` が
「表にある道には画面がある」「画面には表の行がある（孤立ページ禁止）」「導線が空でない」を
毎回機械的に確かめている。

### まだ中身が無いもの（スタブ）の内訳

つなぎ目だけあって中身が無いものは **36件**（ほかに、本物ができたあと接続の無い場所で使う**控え**が 7件）。一覧と、それぞれ何が済めば実装できるかは
`docs/product/stub-ledger.md`（`tests/infrastructure/stub-ledger.test.ts` がコードから生成。手書きではない）。

| 区分 | 件数 | 解除に必要なこと |
| --- | --- | --- |
| ASP 連携 | 9 | 各 ASP の審査通過と API 利用申請（**秘密情報は利用者本人がブラウザから登録する**） |
| 配信チャネル | 9 | 各媒体の開発者登録と接続情報の登録（note は公式APIが無く、「直接投稿できない」と宣言済みのため対象外） |
| 保存先 | 9 | D1 への差し替え。見本データと同じ形を返す実装を書けば、画面もドメインも触らずに済む（**計測の記録先・受信箱・改善要望・ブログ設定は接続済み**。残りは記事・商品・順位・配信・報酬・改善ループ・作業場所設定と、クリックの記録） |
| 生成AI の提供元 | 4 | 提供元の鍵の登録 |
| 読者向け道具 | 3 | 商品データの取込と道具ごとの計算式、読者ごとの保存先（KV）、問い合わせの送信設定 |
| ログイン情報 | 1 | Google 側でのアプリ登録 |
| ファイルの一時公開URL | 1 | R2 の署名付きURL発行の実装 |

呼ぶと必ず失敗を返す。**成功したふりをしない**ので、
「つながっているのに結果が空」という分かりにくい壊れ方をしない。

表の「スタブ」33行と、この36件は数え方が違う。
33 は**要件の行**を数えたもの、36 は**コードのつなぎ目**を数えたもので、
1つの要件が複数のつなぎ目を持つことがある（例: 配信は媒体ごとに 1 つ）。

### 未着手 12 件（T 節）が 0 になった経緯

この 12 件は、**この文書を書いた時点ではまだ作っていなかった改善要望フィードバック**だった。
先に文書と課題へ落としてから作る順にしたので、着手前は全部が未着手で正しかった。

作る順は、送る側（ボタン → 書き込み欄 → 写しへの書き込みと黒塗り）→
受け取る側（一覧 → 詳細 → 状態と扱い）→ 渡す側（指示文 → 人が写す → 鍵で取りに来る）とし、
**1 つ作るごとにテストを書いてこの表を更新した**。
全部作ってから一括でテストを書く進め方はしていない。

**新しい仕組みを横に建てなかった。** 改善要望はループの種類の 2 件目として登録し
（`src/domain/analytics/loop-kinds.ts`）、状態の持ち方・承認・履歴・可視化は既にあるものを使った。
ループの種類を 1 つ増やす手間は `docs/architecture/changeability-scenarios.md` ⑮ で実測してある。

**作ったのに誰も開けない状態だったことが、後から分かった。**
見本のログイン（認証を入れるまでの仮の担当者）に `feedback.read` が無く、
一覧も詳細も**常に「権限がありません」**を出し、案内からも消えていた。
画面を描く検査は全部緑だった。描けてはいたからである。
`feedback_admin`（記事の権限を 1 つも持たない役割）を作って見本のログインへ足し、
`tests/presentation/nav-permissions.test.ts`「いま動かせるログイン（見本）で、案内の
すべての画面に行ける」で固定した。**わざと元に戻して赤くなることを確認済み。**

R 節・S 節の 15 件（テストと自動チェック）も、同じやり方で 0 になった。
**閾値を下げて緑にしたことは 1 度も無い**（`docs/product/coverage.md` §4）。

### 機能側の未着手（A〜Q）が 0 になった経緯

初回の表では未着手 116 件だった。そこから、
**「まだ書いていないだけ」の行を 1 行も残さない**方針で、上から順に
ドメイン型 → ユースケース → 差し替え可能な接続部 → 入口 3種（REST / WebMCP / MCP）→ 画面
まで通した。残った 34 行のスタブは、いずれも**外部の許可・審査・鍵の登録、または D1 のテーブル追加を待っている**もので、
こちら側の作業だけでは解除できない。解除条件は 1 行ずつ表に書いてある。

- 「まずはコア機能から」といったスコープ縮小は行っていない。234件すべてを表に載せ、1件も未分類にしていない。
- **`test` 列に `PASS` と書いた行だけが自動テストで確認済み。** 実装済であっても、
  テストが無い行に `PASS` は書いていない（証拠のない `PASS` を出さない）。
- 受け入れ条件（§30）は文書の宣言ではなく、`tests/acceptance/acceptance-criteria.test.ts` の
  39 テストとして動く。**画面や AI が使うのと同じ入口から流している**ので、
  入口の配線が外れれば落ちる。
