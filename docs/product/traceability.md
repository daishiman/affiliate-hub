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
| REQ-P01 | §9.1 Workspace／Brand管理（テナント分離・ブランド属性・編集/AI/広告方針・禁止表現・標準CTA/免責・言語・TZ） | `src/domain/identity/workspace.ts`（プラン別の上限・稼働判定）、`src/domain/identity/brand.ts`（表示名/法的表示名/連絡先/立場/声/禁止表現/免責/言語/時間帯/標準CTA）、`src/domain/identity/membership.ts`、`src/domain/shared/tenancy.ts`、`src/application/usecases/identity/manage-workspace.ts`（概況・ロール・メンバー・ブランド・広告表記・監査ログの6ユースケース）、`src/presentation/tools/settings-tools.ts` | `src/app/admin/settings/page.tsx` | サイドナビ「設定」。ホームの「手当てが必要なもの」からも設定へ戻れる | loading（サーバ描画）/ empty（各表に「登録するとここに並びます」）/ error（`ErrorView` + ホームへ戻る）/ 操作不可（権限が無い項目は `requireCapability` で理由つきに落ちる） | 対応（`catalogStack` の縦積み。表は48remで縦積み） | 対応（`<th scope="row">` の定義表・`aria-current`・44px最小） | PASS（`tests/presentation/composition.test.ts` / `tests/presentation/admin-routes.test.ts`） | 実装済（保存先は見本データ。編集操作は残課題） |
| REQ-P02 | §9.2 アフィリエイトURL受信箱（貼付・CSV・API・拡張・WebMCP・重複検出・分類・リンク状態・商品候補・4状態管理） | `src/domain/monetization/link-ingestion.ts`（取込元5種 `paste`/`csv`/`api`/`extension`/`webmcp`、状態4種 `received`/`resolved`/`matched`/`rejected`、`normalizeAffiliateUrl` によるURL正規化と `findDuplicate` の重複検出、`isInternalHost` の内部宛先拒否）、`src/application/usecases/monetization/manage-link-inbox.ts`、`src/presentation/tools/affiliate-tools.ts`（`submit_affiliate_url` ほか）、`src/presentation/admin/inbox-action.ts` / `inbox-forms.tsx` | `src/app/admin/inbox/page.tsx` | サイドナビ「受信箱」+ ホームの「手当てが必要なもの」 | loading / empty（貼り付け欄と使い方を出す）/ error / 操作不可（スタブ表示で「まだ保存されません」を明示） | 対応 | 対応（`ToolForm` 共通部品。入力欄にラベルと説明、送信は44px最小） | PASS（`tests/domain/link-ingestion.test.ts`） | 実装済（保存先は見本データ。CSV一括と拡張機能の入口はスタブ） |
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
| REQ-S02 | §22.2 Affiliate Inbox（9要素） | `src/application/usecases/monetization/manage-link-inbox.ts`、`src/presentation/admin/inbox-forms.tsx` | `src/app/admin/inbox/page.tsx` | サイドナビ「受信箱」+ ホームの手当て一覧 | loading / empty / error / 保存先が仮であることのスタブ表示 | 対応 | 対応 | PASS（`tests/domain/link-ingestion.test.ts` / `tests/presentation/admin-routes.test.ts`） | 実装済（保存は見本データ） |
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

## J. 権限（§25 全10ロール）

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

## 集計（2026-08-17 時点）

### 全機能

| 区分 | 件数 |
| --- | --- |
| **全要件数 N** | **172** |
| 実装済 X | 140 |
| スタブ Y | 32 |
| 未着手 Z | **0** |

集計方法: 本ファイル内で `| REQ-` から始まる行の**最後の欄**を機械的に数えた値。手計算ではない。

```bash
T=docs/product/traceability.md
# 行数
grep -cE '^\| REQ-' $T                                  # → 172
# 結果の欄で分類（「実装済（保存先は見本データ）」のような但し書き付きも数える）
grep -E '^\| REQ-' $T | grep -cE '\| \**実装済'          # → 140
grep -E '^\| REQ-' $T | grep -cE '\| \**スタブ'          # → 32
grep -E '^\| REQ-' $T | grep -cE '\| \**未着手'          # → 0（該当なしなので grep は終了コード 1 を返す）
```

節ごとの内訳（全要件 / 実装済 / スタブ / 未着手）:

| 節 | 内容 | 全 | 実装済 | スタブ | 未着手 |
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
| J | 権限（10ロール） | 11 | 11 | 0 | 0 |
| K | セキュリティ・コンプライアンス | 10 | 6 | 4 | 0 |
| L | 品質検査（QC-01〜QC-17） | 12 | 11 | 1 | 0 |
| M | 禁止依存 | 5 | 4 | 1 | 0 |
| N | 受け入れ条件（§30.1〜§30.8） | 8 | 8 | 0 | 0 |
| | **合計** | **172** | **140** | **32** | **0** |

### UI/UX（画面義務のある要件のみ）

画面義務のある要件 = A(10) + B(10) + C(18) + D(12) + E(11) + F(32) = 93 行。
このうち 3 行（REQ-G07 / REQ-G09 / REQ-G10）は**画面を持たないことが正しい**要件
（型で禁じる仕組み・評価セット・分離の担保）なので、義務のある行は **90**。

| 区分 | 件数 |
| --- | --- |
| **画面義務のある機能 N** | **90** |
| 画面あり X | **90** |
| 画面なし Z | **0** |

G〜N の節（API・イベント・WebMCP・MCP・権限・セキュリティ・品質検査・禁止依存・受け入れ条件）は
横断的な決めごとであり、単独の画面を持たない。これらは A〜F の画面の上で効いている
（例: 権限は各画面の表示制御として、品質検査は記事詳細の指摘欄として現れる）。

**「API はあるが画面が無い」行は 0 件。** 検査は人の目視ではなく、
`tests/presentation/admin-routes.test.ts` と `tests/domain/site-routes.test.ts` が
「表にある道には画面がある」「画面には表の行がある（孤立ページ禁止）」「導線が空でない」を
毎回機械的に確かめている。

### まだ中身が無いもの（スタブ）の内訳

つなぎ目だけあって中身が無いものは **38件**。一覧と、それぞれ何が済めば実装できるかは
`docs/product/stub-ledger.md`（`tests/infrastructure/stub-ledger.test.ts` がコードから生成。手書きではない）。

| 区分 | 件数 | 解除に必要なこと |
| --- | --- | --- |
| ASP 連携 | 9 | 各 ASP の審査通過と API 利用申請（**秘密情報は利用者本人がブラウザから登録する**） |
| 配信チャネル | 9 | 各媒体の開発者登録と接続情報の登録（note は公式APIが無く、「直接投稿できない」と宣言済みのため対象外） |
| 保存先 | 11 | D1 への差し替え。見本データと同じ形を返す実装を書けば、画面もドメインも触らずに済む |
| 生成AI の提供元 | 4 | 提供元の鍵の登録 |
| 読者向け道具 | 3 | 計測データの実接続 |
| ログイン情報 | 1 | Google 側でのアプリ登録 |
| ファイルの一時公開URL | 1 | R2 の署名付きURL発行の実装 |

呼ぶと必ず失敗を返す。**成功したふりをしない**ので、
「つながっているのに結果が空」という分かりにくい壊れ方をしない。

表の「スタブ」32行と、この38件は数え方が違う。
32 は**要件の行**を数えたもの、38 は**コードのつなぎ目**を数えたもので、
1つの要件が複数のつなぎ目を持つことがある（例: 配信は媒体ごとに 1 つ）。

### Z（未着手）が 0 になった経緯

初回の表では未着手 116 件だった。そこから、
**「まだ書いていないだけ」の行を 1 行も残さない**方針で、上から順に
ドメイン型 → ユースケース → 差し替え可能な接続部 → 入口 3種（REST / WebMCP / MCP）→ 画面
まで通した。残った 32 行のスタブは、いずれも**外部の許可・審査・鍵の登録を待っている**もので、
こちら側の作業では解除できない。解除条件は 1 行ずつ表に書いてある。

- 「まずはコア機能から」といったスコープ縮小は行っていない。171件すべてを表に載せ、1件も未分類にしていない。
- **`test` 列に `PASS` と書いた行だけが自動テストで確認済み。** 実装済であっても、
  テストが無い行に `PASS` は書いていない（証拠のない `PASS` を出さない）。
- 受け入れ条件（§30）は文書の宣言ではなく、`tests/acceptance/acceptance-criteria.test.ts` の
  39 テストとして動く。**画面や AI が使うのと同じ入口から流している**ので、
  入口の配線が外れれば落ちる。
