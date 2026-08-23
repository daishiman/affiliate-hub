# 要件追跡表（双方向トレーサビリティ）

- 形式: ブログ層仕様 付属 §4-F の `trace` 形式に統一
- 根拠: プラットフォーム層 §30.8（双方向トレーサビリティは必須）
- 最終更新: 2026-08-17 / 対象: 作業中の `feat/clean-architecture-skeleton`（書いた記事を自分のブログへ出す入口をつなぎ、**書く → 承認 → 予約 → 公開 → 読者が読む**が 1 周するところまで）
- 判定語彙: **実装済** = 動作する実体がある / **完了** = 実装済に加えて、確かめる仕組み自体をわざと壊して赤くなるところまで見た / **スタブ** = 形はあるが中身が仮 / **未着手** = 実体なし / **対象外（意図的）** = 作らないと決めた（下記）/ **未対応** = UI/UX の観点として明示的に未対応
- **「未着手」と「対象外（意図的）」を混ぜない。** 前者は「まだ手を付けていない」、後者は
  **「検討した結果、作らないと決めた」**である。決めたものを未着手のまま置くと、後から読んだ人が
  「やり忘れ」と受け取って作り直す。**対象外にするときは、必ず 決めた日 と 決めた理由 を同じ欄に書く**
  （理由の無い対象外は、やらない言い訳と区別が付かない）。
  対象外は**数え上げの独立した区分**であり、実装済・完了・スタブ・未着手のどれにも足さない。
- **証拠のない PASS を出さない。** `evidence` が空の行は実装済としない。`test` が `NOT RUN` の行は「テスト未実行」を意味し、実装済であっても検証済とは書かない。

## 列の意味（message B の要求）

| 列 | 意味 |
| --- | --- |
| 実装 | 実装場所（ファイルパス）。未着手は `—` |
| 画面 | route または component path。UI 義務がない要件は `画面義務なし` |
| 導線 | その画面へどこから到達するか。孤立ページは禁止 |
| 状態 | loading / empty / error / 権限なし の4状態への対応 |
| RWD | レスポンシブ対応 |
| a11y | キーボード操作・フォーカス・ラベル・コントラスト。**「対応」は「axe が緑」ではない**（下の凡例） |
| 結果 | 実装済 / スタブ / 未着手 |

### a11y 欄の凡例（2026-08-19 に書き足し、2026-08-22 に根拠の取り方を直した）

**「対応」の根拠を「axe を回している」に置かないこと。**
回っていることと、破ったときに赤くなることは別である。

実測（axe-core 4.13.0、画面 67 枚、`best-practice` を含む現行の `A11Y_TAGS`）:

| | 件数 | 意味 |
| --- | ---: | --- |
| axe-core の全規則 | 105 | 道具が持っている全部 |
| 現行の基準で有効 | 99 | `color-contrast` の 1 件だけ止めている |
| 画面 67 枚に当たった | 45 | 当たっただけ。赤くなるとは言っていない |
| **破ると実際に赤くなる** | **33** | **a11y 欄の「対応」が機械で裏を取れている範囲** |

**根拠にできるのは 33 件のほうである。** 当たった 45 件のうち残り 12 件は、
破っても判定不能どまり（8 件）か、緑で素通り（1 件・`target-size`）か、
判定対象が入れ物側にあって渡す側から壊しようがない（4 件・`document-title` など）。
しかも `findA11yViolations` は `incomplete` を捨てるので、
**判定不能はこの作業場所では緑と見分けが付かない。**
「45 件に当たっている」を根拠に書くと、その 12 件ぶんだけ見張りを水増しすることになる。

**2026-08-19 の対比を残す**（数え方を変えた回は新旧の両方を残す）:
`best-practice` を足す前は 有効 70・当たり 28・赤くできる 18 だった。
足した理由は件数ではなく、`landmark-unique` の**本物の違反 2 件**
（`/admin/settings` と `/admin/ui-catalog` が同じ名前の目印を 1 画面に 2 つ出していた）が
それまで 1 度も赤くならなかったことにある。

**この 3 つの数（99 / 45 / 33）の正本は `tests/ui/axe-rule-coverage.test.ts` である。**
上の表は写しなので、ずれた日に `tests/architecture/generated-doc-freshness.test.ts` ではなく
同ファイルの検査が赤くなる（写しと正本の一致をそこで見ている）。

**軸**: axe が見ているのは「書かれているものが妥当か」であって、
**「書かれるべきものが書かれているか」ではない。**
名前の無い `role="group"`、役割を名乗らない操作部品、向きを名乗らない表の見出し、
焦点を受けない `canvas` は、**規則を足しても届かない**（確かめた）。

**届かない領域の一覧は `tests/ui/axe-blind-spots.test.ts` が正本。**
この文書に写しを置かない。写しは、axe が見るようになった日にも古く見えない。
一覧は検査として書いてあるので、届くようになった日に赤くなる。

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
| REQ-P08 | §9.8 Distribution Hub（Connector契約・予約・投稿・失敗リトライ・Publication状態8+異常5） | `src/domain/distribution/channel.ts`（`CHANNEL_CAPABILITIES` と `supportsDirectPublish`。note は公式APIが無いため直接投稿できないことを型で表明）、`src/domain/distribution/publication.ts`（状態遷移表 `ALLOWED` と `MAX_SEND_ATTEMPTS`）、`src/application/usecases/distribution/manage-distribution.ts`（`createSchedulePublicationUseCase` が配信を作る唯一の入口。承認前を通さない・使える接続が複数なら聞き返す・同じ記事/先/時刻は 1 件にまとめる、を**ユースケース側**に置く）、`src/application/usecases/distribution/publication-calendar.ts`、`src/presentation/admin/schedule-publication-action.ts` / `schedule-publication-form.tsx`、`src/presentation/tools/distribution-tools.ts`（`schedule_publication`。人の確認必須）、`src/infrastructure/channels/`、`src/infrastructure/persistence/d1/distribution-repository.ts`（**予約・取りやめ・予定日の変更は D1 の `publications` に保存される**。見本は消さずに重ね、同じ id なら保存されたほうが勝つ）、`src/application/usecases/site/publish-article.ts`（**自分のブログへ出す道。コネクタではなくユースケースに置く**。理由は本文末尾の追記）、`src/presentation/admin/publish-article-action.ts` / `publish-article-form.tsx` / `publish-article-result.tsx`、`src/infrastructure/persistence/d1/published-article-repository.ts`（マイグレーション 0011） | `src/app/admin/distribution/page.tsx`、`.../[publication]/page.tsx`、`.../calendar/page.tsx`、`src/app/admin/content/[variant]/page.tsx`（「この記事を出す」）、`.../[publication]/page.tsx` の「いまサイトに出す」（自分のブログ宛てで未公開のときだけ出す。出し終わった配信に出すと同じ記事が 2 度出る） | サイドナビ「配信」+ 記事の画面の「この記事を出す」 | loading / empty / error / 接続先が未登録の媒体は投稿ボタンを出さず理由を表示 / 承認前・公開の権限が無い場合は欄を消さず、理由（ユースケースが返す `publishBlockedReason`）を表示。**見本のログインは `content.publish` を持たないため、いまは常に権限の理由が出る**（認証の導入待ち。残課題 26 / 28） | 対応 | 対応 | PASS（`tests/infrastructure/channel-connector.test.ts` / `tests/application/publication-calendar.test.ts` / `tests/application/schedule-publication.test.ts` 14 件 / `tests/ui/schedule-publication-form.test.tsx` 5 件 / `tests/integration/d1-distribution.test.ts` 8 件＝本物の D1 とマイグレーションで保存の往復を実測 / 自分のブログへ出す道: `tests/application/publish-article.test.ts` 32 件・`tests/domain/authored-sections.test.ts` 8 件・`tests/ui/publish-article-form.test.tsx` 11 件・`tests/ui/publish-article-result.test.tsx` 5 件・`tests/presentation/admin-actions.test.ts`「自分のブログへ記事を出す操作」10 件・`tests/integration/d1-published-article.test.ts` 15 件） | 実装済（保存先は D1。各媒体への実送信のみスタブで、接続情報の登録が済めば動く） |
| REQ-P09 | §9.9 Affiliate Hub（ASP・プログラム・リンク原本・TrackingLink・リンク切れ・成果） | `src/domain/monetization/affiliate-program.ts`、`src/domain/monetization/affiliate-link.ts`（リンク原本と計測リンク、リンク切れの状態）、`src/domain/monetization/conversion.ts`、`src/application/usecases/monetization/manage-affiliate.ts`、`src/presentation/tools/affiliate-tools.ts`、`src/infrastructure/persistence/d1/conversion-repository.ts`（成果の保存先）、`src/presentation/admin/adjust-conversion-form.tsx` / `adjust-conversion-action.ts`（金額を直す入口） | `src/app/admin/affiliate/page.tsx`、`src/app/admin/affiliate/[conversion]/page.tsx` | サイドナビ「報酬」+ 受信箱から | loading / empty（4箇所）/ error（4箇所）/ ASP未接続をスタブ表示 | 対応 | 対応 | PASS（`tests/presentation/admin-routes.test.ts`、`tests/integration/d1-conversion.test.ts` 8 件、`tests/infrastructure/d1-conversion-repository.test.ts` 15 件、`tests/ui/adjust-conversion-form.test.tsx` 8 件） | 実装済（手で直した金額の保存先は D1 の `affiliate_conversions`。取り込んだ額と手修正額は別の列で持つ。成果そのものの取込と ASP への実接続はスタブ。秘密情報は利用者本人が別画面で登録する） |
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
| REQ-S10 | 認証画面（Google OAuth・サインイン・サインアウト・招待受諾） | `src/infrastructure/identity/session-repository.ts` / `session-actor.ts`（合言葉の照合と権限の引き当ては**実装済み**。合言葉は潰した値だけ保存する）+ `src/infrastructure/identity/sample-actor.ts`（合言葉を発行する入口が入るまでの見本。台帳 `identity:sample-actor` に登録済み） | `src/app/signin/page.tsx` | `/admin/settings` の「ログイン」から | 見本であることを明示（`StubNotice` + 解除条件）/ いま誰として動いているか / その人にできないこと（公開・招待）を理由つきで表示 | 対応（共通の読者向け骨格 `PublicShell`） | 対応（定義表に `<th scope="row">`、リンクは44px最小） | PASS（`tests/presentation/admin-routes.test.ts` の孤立ページ検査 + `tests/architecture/open-doors.test.ts` 4 件＝いま開いている入口の台帳） | **スタブ**（確かめる側は実装済み。残るのは**発行する側**。**いま何が開いているかは `docs/product/open-doors.md` に測って書き出してある（2026-08-18 時点で 49 件 / 全 79 件）**。解除条件: Google 側でこのアプリを登録し、発行された識別子と秘密の値を**利用者本人がブラウザから**登録すること。秘密情報を AI が読める場所に置かせないため代行しない） |

## C. ブログ層 情報アーキテクチャ（§7 全18ルート）

ルート表の正本は `src/presentation/site/routes.ts`。`tests/domain/site-routes.test.ts` が
**「表にある route には画面がある」「画面には表の行がある（孤立ページ禁止）」「導線が空でない」**
を毎回機械的に確かめる。下の表はその検査を通った状態を書き写したもの。

RWD・a11y は全ルート共通の枠（`page-frame.tsx` と共通 UI 部品）で担保しており、
`tests/ui/design-tokens.test.ts` と `tests/ui/ui-layers.test.ts` が生の色・生の px・
層またぎの import を機械的に禁止している。個別ルートごとの再掲はしない。

| REQ | ルート | 実装（画面） | 導線 | 状態 | RWD | a11y | test | 結果 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-B01 | `/s/{site}`（トップ） | `src/app/s/[site]/page.tsx` + `presentation/site/page-frame.tsx` + `src/app/s/[site]/not-found.tsx` | 入口（サイト一覧 `/` から） | 新着0件・取得失敗に文言あり。**無いブログ名は HTTP 404**（`SiteFrame` が `notFound()`。画面は戻り先つきのまま。読者側 20 本すべてに効く） | 対応 | 対応 | PASS（`tests/domain/site-routes.test.ts` / `tests/ui/site-not-found.test.tsx`） | 実装済 |
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
| REQ-W02 | §9.1 ランキング記事の body 構成 | `article-structure.ts` `ARTICLE_TYPE_SECTIONS.ranking`（評価基準・検証条件・順位・商品カード・選外・用途別ベスト） | `/admin/writing?type=ranking` / REQ-B03 | PASS（`tests/domain/article-type-sections.test.ts` 16 件＝5 型 22 節を手で書き写した表で総当たり） | 実装済 |
| REQ-W03 | §9.2 個別レビューの body 構成 | `ARTICLE_TYPE_SECTIONS.review`（検証条件・実測・長期使用・競合比較） | `/admin/writing?type=review` / REQ-B04 | PASS（`tests/domain/article-type-sections.test.ts` 16 件＝5 型 22 節を手で書き写した表で総当たり） | 実装済 |
| REQ-W04 | §9.3 比較記事の body 構成 | `ARTICLE_TYPE_SECTIONS.comparison`（差分表・用途別結論） | `/admin/writing?type=comparison` / REQ-B05 | PASS（`tests/domain/article-type-sections.test.ts` 16 件＝5 型 22 節を手で書き写した表で総当たり） | 実装済 |
| REQ-W05 | §9.4 ハウツー記事の body 構成 | `ARTICLE_TYPE_SECTIONS.guide`（完了後の状態・必要時間・費用・事前準備・全手順・成功状態・エラー対処・次の行動） | `/admin/writing?type=guide` / REQ-B06 | PASS（`tests/domain/article-type-sections.test.ts` 16 件＝5 型 22 節を手で書き写した表で総当たり）。writing-method 側は 8 節中 3 節のみ | 実装済 |
| REQ-W06 | §10.1 文章の基本順序（結論→理由→根拠→具体例→例外→意味→行動） | `src/domain/authoring/writing-style.ts` `PARAGRAPH_ORDER` | `/admin/writing`「段落の並べ方」 | PASS（`tests/domain/writing-style-tables.test.ts`「7 段が仕様の順番どおりに並んでいる」ほか 4 件）。**2026-08-19 に足した。**それまで当たっていたのは先頭「結論」と末尾「次の行動」だけで、**間の 5 段は入れ替えても緑**、1 段落としても緑だった（`writing-method.test.ts` で実測）。要件文が禁じている行為で 2 通り壊して 2/2 赤 | 実装済 |
| REQ-W07 | §10.2 事実6分類の書き分けと文中表示 | `writing-style.ts` `FACT_LABELS` / `FACT_TONE_RULES`、表示は `src/presentation/ui/patterns/factuality.tsx` `FactSourceBadge`（記号+文字。色だけで区別しない） | `/admin/writing`「事実の種類ごとの書き分け」（バッジ実表示） | PASS（`tests/ui/fact-source.test.ts` 4件＝業務側と画面側の一覧一致 / `writing-method.test.ts`「6種類・語尾が種類ごとに違う」） | 実装済 |
| REQ-W08 | §10.3 スタイル規則（文長・段落・単位・日付・禁止表現） | `writing-style.ts` `STYLE_RULES`（9件・理由つき）、禁止表現の実検査は `quality-check.ts` `EXAGGERATION_PATTERNS` | `/admin/writing`「文体の決まり」 | PASS（`tests/domain/writing-style-tables.test.ts`「9 件が仕様の順番どおりに並んでいる」ほか。誇大表現の実検査は `tests/domain/invariants.test.ts`）。**2026-08-19 に足した。**それまでは「理由が空でない」の総当たりだけで、**決まりを 1 件消しても、文長を 1〜3 文 → 1〜5 文 に書き換えても緑**だった（実測）。`quality-check.ts` の `MAX_SENTENCES_PER_PARAGRAPH` との一致もここで結び直した（コメントは値が離れても黙る） | 実装済 |
| REQ-W09 | §11 会話・吹き出し（4話者・連続最大2・40〜120字・話者名表示・色以外での区別） | `src/domain/authoring/conversation-block.ts` `createConversationBlock` / `validateConversationFlow`（本文を挟むと連続を数え直す）。`quality-check.ts` の検査18 `conversation_flow` として公開前検査に接続済み | `/admin/writing`「会話の決まり」 | PASS（`tests/domain/writing-rules.test.ts`「吹き出し」7件 / `invariants.test.ts`「続けすぎを止める」） | 実装済 |
| REQ-W10 | §16.6 マルチサイト重複対策（10軸差別化・言い換え禁止） | `src/domain/authoring/site-blueprint.ts` `DifferentiationAxes`（10軸）+ `differentiationGap()`（3軸以上）、`src/application/usecases/site/manage-sites.ts` が全ブログ対を判定。言い換え本文は `quality-check.ts` `similarity()` ≥0.85 で停止 | `/admin/sites`（近すぎるブログ対の警告） | PASS（`tests/domain/writing-rules.test.ts`「似たブログを増やさない」3件） | 実装済 |
| REQ-W11 | セクション別雛形（一文結論・リード文・評価基準・商品カード・デメリット・FAQ・最終結論） | `article-structure.ts` の各 `SectionSpec.purpose`（AI への指示文と編集者への説明を兼ねる）+ `writing-style.ts` `OPENING_PATTERNS`（型ごとの書き出し） | `/admin/writing`（節ごとの「なぜ置くか」列） | PASS（`tests/domain/writing-style-tables.test.ts`「登録されている記事タイプすべてに書き出しの型がある」ほか 3 件）。**2026-08-19 に足した。**`OPENING_PATTERNS` は**テストからの参照が 1 つも無く**、型を 1 つ空にしても緑だった（実測）。キーの一覧は書き写さず `ARTICLE_TYPES` から取っている（記事タイプが増えた日に、書き出しが無いまま緑にならないため） | 実装済 |
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
| REQ-G10 | ローンチ基準 LB-1〜LB-8 と CI 連携 | `evals/generation/launch-bars.ts`（LB-1〜LB-8） | PASS（同テスト）。**CI へは接続しない**（2026-08-17 決定）。`ci.yml` は設置済みなので設置待ちではなく、**基準を当てる相手である評価セット本体を「作らない」と決めた**ため（ah-gzq / REQ-CI13）。基準そのもの（LB-1〜LB-8）は判断を覆すときに要るので残す | PASS（同テスト）。CI への接続は初回リリース後（`ci.yml` 未設置） | スタブ |
| REQ-G11 | 生成の実行（素材を渡して下書きを 1 本作らせる） | `src/application/usecases/generation/draft-content-variant.ts`（`LlmPort` を使う唯一のユースケース。18項目が欠けていれば呼ばない／資料は `untrustedContext` へ入れ指示欄に混ぜない／呼ぶ前に費用を見積もる／打ち切りと形違いは受け取らない）、`src/domain/generation/draft-instructions.ts`（7ブロックの文面）、`src/infrastructure/llm/llm-provider-registry.ts`（`createRoutingLlm` が依頼の `model.providerId` で提供元へ振り分ける。既定のモデルは置かず、未選択なら呼ばずに止まる） | `/admin/generation`「下書きを作らせてみる」（そろっていない状態／そろった状態を実際に押して確かめられる）。REST と バックエンド MCP から `draft_content_variant`。**WebMCP には載せない**（`readOnly: false`。ページ内の AI に課金を起こさせないため） | PASS（`tests/application/draft-content-variant.test.ts` 14件、`tests/infrastructure/llm-providers.test.ts` 44件） | 実装済（Anthropic / Google / OpenAI / xAI の 4 社とも**呼び出しの形が合っている**まで。偽の応答での検査は通るが、**実際の鍵での疎通は 4 社とも未確認**（件数として `docs/product/stub-ledger.md` の「実際の鍵で 1 度も呼んでいない提供元: **4 / 4 社**」に出る。`scripts/llm-live-proof.mjs` が本物の D1 から数える）。鍵の登録は利用者ご本人の作業。Workers AI は鍵ではなく実行環境の結び付けで呼ぶためスタブのまま） |

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
| REQ-E09 | ChannelConnection | `distribution/channel.ts`（**認証情報の値そのものを渡すと断る**を `tests/domain/entity-guards.test.ts` で固定） | 見本データ | REQ-S07 | 実装済（各媒体への実接続のみスタブ）。**2026-08-19 まで、作る関数を直接呼ぶテストが 1 つも無かった**（見本データが正しい値で 1 回呼ぶだけで、断る道は一度も通っていなかった）。断り 3 か所を消して全部走らせても 3875 件すべてが緑だった。いまは秘密の形 6 通り・長さの端 200/201 を当てている |
| REQ-E10 | AffiliateAccount | `monetization/affiliate-program.ts`（**鍵の値ではなく保管先の参照キーだけを持てる**を `tests/domain/entity-guards.test.ts` で固定） | `asps` | REQ-P09 | 実装済（ASP への実接続のみスタブ）。E09 と同じく **2026-08-19 まで直接呼ぶテストが無かった**。いまは長さの端 200/201 を当てている |
| REQ-E11 | AffiliateProgram | `monetization/affiliate-program.ts`（**承認率 0〜1 と報酬率 0〜100 の端**を `tests/domain/entity-guards.test.ts` で固定） | `programs` | REQ-P09 | 実装済。**2026-08-19 まで直接呼ぶテストが無かった。**単位の違う 2 つの割合が隣り合っているため、片方の端だけ見ると取り違えに気づけない。両方の内側・外側と、上限が同じ値になったら落ちる行を置いた |
| REQ-E12 | AffiliateLink | `monetization/affiliate-link.ts` | 見本データ | REQ-P09 | 実装済 |
| REQ-E13 | TrackingLink（§19.2.1） | `monetization/tracking-link.ts`（**転送先を URL 文字列で持てない**ことをテストで固定）／`app/go/[code]/route.ts`（転送の入口）／`persistence/d1/redirect-repository.ts`（読む口・**発行の口**・数え上げ）／`infrastructure/persistence/tracking-issuing-writer.ts`（公開の継ぎ目）／`application/read-models/article-tracking.ts` | `redirect_resolutions` | REQ-P09 | **未完**。発行の側は実装し、本物の D1 で確かめた（`tests/integration/d1-tracking-issuance.test.ts` 8 件: 合言葉が入る／写しの作業場所が持ち主側／出し直しても増えない／転送先が変わると新規発行＋旧は 410／https 以外は発行しない／数え上げ／作業場所の往復）。転送の入口は Workers ランタイムで実機確認済み（302 の行き先が保存値と一致 / 404 / 410 / 記録が D1 に残る / 分析画面のクリック数が 0→1）。**それでも実運用では合言葉が 1 件も発行されない。** 公開の手続き（`usecases/site/publish-article.ts` の `buildArticle`）が `ranking` も `productCards` も作らないため、公開された記事には成果リンクが 1 件も載らない（`ranking` / `productCards` を持つのは見本データだけ）。発行の口は正しく繋がっているが、**その手前に流し込むものが無い**。未発行の件数は `/admin/analytics` に出す（いまは「成果リンクがまだ 1 件もありません」と出る）。完了は、公開記事へ成果リンクを載せる経路ができ、この画面の未発行が 0 件になってから。何が数えられていて何が数えられていないかは `docs/product/click-measurement.md` |
| REQ-E14 | SourceArtifact | `shared/provenance.ts` | 見本データ | REQ-S03 | 実装済 |
| REQ-E15 | Product | `product/product.ts`（**識別子が 1 つも無い商品は作れない**を `tests/domain/entity-guards.test.ts` で固定） | `products` | REQ-S03 | 実装済。**2026-08-19 まで直接呼ぶテストが無かった。**識別子 0/1 件の端、販売終了日が発売日と同じ日／1 ミリ秒前の端、JAN の桁数 7/8/12/14/15 を当てている |
| REQ-E16 | ProductVariant | `product/product.ts`（**別に買えない枝は作れない**／**仕様の見出しと枝の値が食い違ったら断る**を `tests/domain/entity-guards.test.ts` で固定） | なし（**2026-08-19 まで「見本データ」と書いてあったが事実ではなかった**。`ProductVariant` は `src` と `tests` を通して参照 0 件で、誰も組み立てていない） | REQ-S03 | スタブ（解除条件は変わらず: 色・容量ちがいを**画面で**分けて扱う要望が出たとき。いまは 1 商品 1 行で足りている）。ただし **2026-08-19 に `createProductVariant` と断り 4 か所を足した**。画面は作っていない。**誰も作らない型は断る場所を持てず、必須種別を宣言できない**ため、当てどころのほうを先に作った。断り 4 か所を 1 か所ずつ取り払って全件走らせ、4 通りとも赤（落ちたのは新しい 8 件だけで、既存 4,294 件は全部緑だった） |
| REQ-E17 | MerchantOffer | `product/merchant-offer.ts` | 見本データ | REQ-S03 | 実装済 |
| REQ-E18 | ComparisonSet | `product/comparison.ts` | 見本データ | REQ-S03 | 実装済 |
| REQ-E19 | Claim | `evidence/claim.ts` | 見本データ | REQ-S03 | 実装済 |
| REQ-E20 | Evidence | `evidence/evidence.ts` | 見本データ | REQ-S03 | 実装済 |
| REQ-E21 | TestRun | `evidence/evidence.ts` | 見本データ | REQ-S03 | 実装済 |
| REQ-E22 | Campaign | `distribution/campaign.ts`（**報酬額を書ける場所が型に無い**ことをテストで固定） | 見本データ | REQ-S07 | スタブ（解除条件: 配信予定をまとめて扱う画面。単発の予定管理はすでに動いている） |
| REQ-E23 | ContentPackage | `authoring/content-package.ts`（**記事の分野（`domainScope`）が無いと作れない**をテストで固定。表現ポリシーを絞る唯一の手がかり） | 見本データ | REQ-S05 | 実装済 |
| REQ-E24 | MasterBrief | `authoring/master-brief.ts`（**原本に無い主張を原稿に足せない**をテストで固定） | 見本データ | REQ-S05 | スタブ（解除条件: 生成AIの呼び出し。原本から原稿を作る流れの入口がそこにある） |
| REQ-E25 | ContentVariant | `authoring/content-variant.ts` | `articles` | REQ-S05 | 実装済 |
| REQ-E26 | Asset | `authoring/asset.ts`（**由来・利用条件・代替テキストが無いと作れない**をテストで固定） | R2（`storage-r2.ts`） | REQ-S06 | スタブ（解除条件: 画像の登録画面。保管先の実装と型は済んでいる） |
| REQ-E27 | Publication | `distribution/publication.ts` | 見本データ | REQ-S07 | 実装済 |
| REQ-E28 | Metric | `analytics/metrics.ts` | 見本データ | REQ-S08 | 実装済（数字の元は見本データ） |
| REQ-E29 | Conversion | `monetization/conversion.ts` | `affiliate_conversions` | REQ-S08 | 実装済（旧 `conversions` 表は使わない。作業場所を持たず、取込額と手修正額を 1 列で兼ね、通貨・会計期間・締めの欄が無いため） |
| REQ-E30 | Experiment | `analytics/experiment.ts`（**件数が足りないうちは判定できない**をテストで固定） | 見本データ | REQ-S08 | スタブ（解除条件: 実測値の取り込み。件数が無いと実験そのものが成立しない） |
| REQ-E31 | PolicyRule | `compliance/policy-rule.ts` | `disclosures` | REQ-S06 | 実装済 |
| REQ-E32 | AuditLog | `compliance/audit-log.ts` | 見本データ | REQ-S09 | スタブ（解除条件: 追記だけができる保存先。書き換えられる場所に置くと監査の意味が無くなるため、見本データのままにしている） |

**32 件すべてにドメイン型がある。**

不変条件を当てているのは `tests/domain/entity-invariants.test.ts` /
`invariants.test.ts` / `entity-inputs.test.ts` / `entity-states.test.ts` /
`entity-enumerations.test.ts` の 5 ファイルである。

ここには 2026-08-19 まで「不変条件は前の 2 ファイルが機械で確かめている」と
だけ書いてあったが、これは**集合についての主張で、事実ではなかった**。
`src/domain` の断る場所 76 か所を 1 か所ずつ `if (false)` に書き換えて測ると、
**11 か所は消しても全件（約 3960 件）が緑**だった（URL・主張文・確認者名・
本文・プロンプト版の空、点数の 0〜1、人の確認を伴わない承認、ルール名・
検出表現の空、分野と出力先の語彙）。2 ファイルは実在し緑だったが、
その外に穴があった。後の 3 ファイルはこの 11 か所を塞ぐために足した。

**いま言えるのはここまでである**: 76 か所を測って 11 か所が穴で、
それを塞いだ。次に断る場所を足した回の穴は、また測らないと分からない。
測り方は `docs/product/required-test-types.md` §4 の
「2026-08-19 に減らしたぶん（68 → 49）」にある。

`REQ-E16`（ProductVariant）だけは作る関数を持たず、断る場所が 1 つも無かった。
**2026-08-19 に `createProductVariant` と断り 4 か所を足して宣言した**（`has-input`）。
このとき分かったのは、型が在ることと使われていることは別だということである。
`ProductVariant` は 32 件の一覧に他と同じ顔で並んでいたが、
**`src` と `tests` を通して 1 か所も組み立てられていなかった**。
一覧を眺めて数えるかぎり、この差は見えない。

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
| REQ-WB01 | 読者側 読み取り9種 | `src/presentation/tools/reader-tools.ts`（`reader_*` 8 種）+ `src/application/usecases/site/read-article-facets.ts`。読者が見ている**記事から切り出す**ので、画面に出していない項目は原理的に出ない。**`ah-83f` まで、この 9 種は管理側の道具を指しており、読者の身元では 1 件も通らなかった**（目録には並ぶので画面上は正常に見えた）。`list_test_runs` だけは読者向けの出どころが無く、`unreachableReason` を書いてページから降ろした（残 8 種） | REQ-B01〜B09 | 実装済（8/9。`list_test_runs` は画面が先） |
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
| REQ-R11 | 公開権限と編集権限の分離 | `content.write` と `content.publish` を別の capability にし、`publisher` は書き込みを持たない。状態遷移は `src/domain/authoring/content-state.ts` `transition()` が AI を弾く。**いまどこにいるかは `content_variants` の列に保存する**（`ContentVariantRepositoryPort.findState` / `saveState`、マイグレーション 0009）。業務の型 `ContentVariant` には入れない（AI が文章を返しただけで段階が進んだことにはならないため）。承認できない理由は `approvalBlockedReasonFor()` の 1 か所にあり、押す前の説明と押した後の断りが同じ言葉になる | `/admin/content/[variant]`（「次に進める」＝段階を選んで進める / 「内容を確認したので承認する」＝人だけの操作。承認・公開予約・公開は**進める先の選択肢に出さない**。承認できない理由は押す前に表示）+ `/admin/settings`（PASS: `tests/domain/invariants.test.ts` / `tests/application/manage-personas.test.ts` / `tests/application/manage-content.test.ts` 59 件 / `tests/presentation/admin-actions.test.ts`「記事の進行の操作」6 件 / `tests/ui/content-progress-form.test.tsx` 8 件） | 実装済（進めた段階と承認は D1 に保存される。押した人が見ていた段階と保存先が食い違えば断る） |
| REQ-R12 | Feedback Admin（**仕様 §25 に無い追加**。改善要望の機能に伴う） | 同 `feedback_admin`（`feedback.*` 4 つ + `integration_key.manage` のみ。記事の権限は 1 つも持たない）。`workspace_admin` で代用しなかったのは、要望を読ませたいだけの相手に公開の権限まで渡るため | `/admin/settings`「役割ごとにできること」の表（PASS: `tests/domain/permissions.test.ts`「使い勝手の担当は、改善要望まわりだけで、記事には一切触れない」） | 実装済 |

## K. セキュリティ・コンプライアンス（§26、§17、ブログ層 §16.1・§17.2・§20）

| REQ | 要件 | 実装 | test | 結果 |
| --- | --- | --- | --- | --- |
| REQ-SEC01 | §26.4 テナント分離（全クエリに workspace_id 制約） | `src/domain/shared/tenancy.ts` `assertSameTenant()` を 6 つのユースケース群（product / ranking / content / distribution / monetization / publication）が呼ぶ + **保存先の入口（Repository ポート）が作業場所を伴うことを宣言から機械的に見る**（`tests/architecture/tenant-scoped-ports.test.ts`、2026-08-18） | 一部 PASS。ポートの宣言 113 本を読み、①引数に `workspaceId` がある ②引数のどれかが `workspaceId` を持つ実体である ③理由つきで免除、のいずれかであることを固定した。免除は 10 件で、すべて「作業場所という考え方が当てはまらない」もの（作業場所そのものを扱う 7 本・読者向けの公開サイト 2 本・時刻で起動する配信の取り出し 1 本）。**この検査で実際に 1 件見つけて直した**: `ScoreCardRepositoryPort.save` は `EditorialScoreCard`（`workspaceId` を持たない型）だけを受け取っており、保存の時点で誰のものか分からなかった。赤を 3 方向で実測済み（作業場所を外す / 作業場所を取らないメソッドを足す / 直したのに免除を残す）。**NOT RUN のまま残っているのは DB クエリ側**（保存先が見本データの表が多く、SQL に workspace_id が付いているかは別途） | スタブ |
| REQ-SEC02 | URL取り込みの SSRF 対策（private IP・redirect・スキーム制限） | 入口は `src/domain/monetization/link-ingestion.ts` `normalizeAffiliateUrl()` / `isInternalHost()`。取得は `src/infrastructure/http/guarded-fetch.ts` が転送を自動で追わず 1 ホップごとに再判定（回数5・2MB・10秒の上限つき） | PASS（`tests/infrastructure/guarded-fetch.test.ts` 9件 + `tests/architecture/dependency-direction.test.ts`「外部への取得は guarded-fetch だけが行う」） | 実装済 |
| REQ-SEC03 | provenance（§10.5）の記録 | `src/domain/shared/provenance.ts` `createProvenance()` / `isExpired()` | NOT RUN（記録は作れるが、取得系アダプタが未接続のため実データが流れない） | スタブ |
| REQ-SEC04 | §19.4 編集評価と報酬データの分離（Ranking Service は Editorial のみ） | `src/domain/shared/data-classification.ts` の `Editorial<T>` / `Commercial<T>`。ランキングのユースケースに報酬ポートを注入すると型が通らない | PASS（`tests/architecture/commercial-isolation.test.ts` / `dependency-direction.test.ts`「ランキングのユースケースは報酬のポートを参照しない」） | 実装済 |
| REQ-SEC05 | プロンプトインジェクション対策（ブログ層 §16.1） | `src/domain/generation/injection-guard.ts`（7パターン検出・削除せず保留）+ `src/infrastructure/llm/prompt-assembly.ts`（指示と資料を別枠・区切り記号の無効化・資料は指示ではないと明記） | PASS（`tests/domain/generation-plan.test.ts`「取り込んだ文章の扱い」6件） | 実装済 |
| REQ-SEC06 | `rel="sponsored"`（ブログ層 §17.2） | `src/domain/compliance/disclosure.ts` `relAttributeFor()`、表示は `src/presentation/ui/patterns/disclosure.tsx` `AffiliateLink` のみ。画面が自前で書いていないことを機械で検査 | PASS（`tests/domain/invariants.test.ts` / `tests/ui/ui-layers.test.ts`「画面が広告表示を自前で書いていない」） | 実装済 |
| REQ-SEC07 | 広告表示・コンプライアンス（薬機法・景表法・ASP規約） | `src/domain/compliance/policy-rule.ts`（分野×出力先で絞る。根拠と代替表現が無いルールは登録できない）+ **初期ルール 13 件は `policy-rule-seed.ts`**（薬機法 4 / 景表法 3 / 金融 1 / 賭博・酒・子ども 3 / ASP 規約 2）。1 件ごとに「当たらねばならない文」と「当たってはならない文」を型で必須にしてある + `quality-check.ts` の誇大表現・広告表記・CTA過剰。公開可否は `publish-gate.ts` | PASS（`tests/domain/invariants.test.ts` 該当群 + `tests/domain/policy-rule-seed.test.ts` 75 件）。**赤を両方向で実測済み**: 表現を狭めると 2 件、広げすぎると 3 件が落ちる。広げすぎは `allows` だけでは捕まらなかったため、どのルールにも当たってはならない普通の文 10 本を別に持たせた。**記事の確認と承認から実際に呼ばれている**（2026-08-18、ah-1eg）: `ManageContentDeps.policyRules` → `createGetContentUseCase` / `createApproveContentUseCase`。`tests/application/manage-content.test.ts`「表現ポリシーの検査」8 件が、①薬機法の分野の記事で違反が出る ②同じ文でも分野ちがいには出ない ③画面の案内と承認の拒否が同じ理由で起きる ④企画が読めないときは「違反 0 件」にせず止める ⑤見出しも検査対象、を固定。**呼び出しを外すと 5 件が落ちることを実測済み**。当てるルールを絞る手がかりは `ContentPackage.domainScope`（ah-d9s、省略も既定値も無い必須の欄。`tests/domain/planning.test.ts` が固定。既定値 general に倒すと 1 件、分野を握り潰すと 1 件が落ちることを実測）。出力先の語彙は `tests/domain/policy-channel-scope.test.ts` が `ChannelKind` と突き合わせており、実際に 3 件（threads / wordpress / bluesky）の欠けが見つかって塞いだ（消すと 1 件落ちることを実測）。**保存先はまだ見本**（`policy-rule-sample-repository.ts`。読み取りは初期ルール 13 件をそのまま返し、追加・無効化はできない。policy_rules テーブルと配布処理が要る） | スタブ |
| REQ-SEC08 | WCAG 2.2 AA（ブログ層 §20） | 共通UIで担保: 触れる大きさ `--tap-target-min`、`--focus-ring-*`、`aria-current`、色以外での区別（`FactualityBadge` / `FactSourceBadge` は記号+文字）、表の `scope` / `caption` | PASS（`tests/ui/design-tokens.test.ts` / `tests/ui/patterns-render.test.tsx`）。自動計測（axe）と実機での読み上げ確認は残課題 | スタブ |
| REQ-SEC09 | 監査ログ（AuditLog） | `src/domain/compliance/audit-log.ts` `createAuditLogEntry()` / `redactSensitive()`（秘密情報は `[記録しません]` に置換）/ `wasApprovedByHuman()` + **保存先 `src/infrastructure/persistence/d1/audit-log-repository.ts`（`audit_logs` 表。足すだけで、書き換えも削除も口を置いていない）** + **書く側 `ManageContentDeps.auditLog` → `createApproveContentUseCase` / `createAdvanceContentStateUseCase`**（読み口は `/admin/settings` の監査記録の一覧） | **2026-08-18 に訂正（ah-099）。それまで「実装済」と書いていたが誤りだった**: 記録の作り方と読み口はあったのに、`AuditLogPort.append` を呼ぶ場所がコード全体に 1 つも無く、承認も公開も 1 件も記録されていなかった。一覧が「0 件」と出るだけなので画面からは正常に見える。REQ-SEC07 とまったく同じ形の穴。**いま塞いだのは記事の承認と段階の移動の 2 経路**（`tests/application/manage-content.test.ts`「操作の記録」7 件 + `tests/integration/d1-content.test.ts`「承認したことが、操作の記録として保存先に残る」1 件）。承認には理由を必須にした（`ApproveContentInput.reason`。ドメインの `REASON_REQUIRED` が求めており、受け取らなければ承認は必ず記録に失敗していた）。記録に失敗したら**操作を成功として返さない**（連絡＝`events` とは扱いが逆。理由は `record()` の説明）。**読み口も本物の D1 で通した**（`tests/integration/d1-audit-log.test.ts` 8 件）: 対象ごとの読み直し、**別の作業場所の記録が同じ対象名でも出てこないこと**、新しい順、期間と操作の種類での絞り込み、続きの読み出しで同じ行を 2 回出さないこと、差分が壊れた行でも行ごと消えないこと、AI の操作が人の操作として読み直されないこと、表が無いときに空の成功ではなく失敗が返ること。書く側だけでは足りないのは、**読めない記録は無い記録と同じ**だから。**赤を実測済み**: 記録の経路を外すと 5 件、理由の検査を外すと 1 件、作業場所の絞り込み・差分の読み戻し・続きの読み出しをそれぞれ壊すと対応する 1 件ずつが落ちる。**まだ書いていない経路**: 公開・取り下げ（`content.published` / `content.unpublished`）、広告表記とランキング基準の変更、担当者の役割変更。取り下げは `content.state_changed` として残るが、理由を受け取る欄がまだ無い。どのモデルが動かしたかも `ActorContext` に無いため `modelId` は常に null（残課題 53） | スタブ |
| REQ-SEC10 | 秘密情報の取り扱い（Secrets は wrangler secret、リポジトリに置かない） | `.gitignore`（`.dev.vars` / `.env`）+ `src/types/env.d.ts`（Secret は `wrangler.jsonc` に書かないので型が出ない、と明記）+ `wrangler.jsonc` に `vars` を置かない | PASS（`tests/architecture/secrets-not-in-repo.test.ts` 5件。git が追跡しているもの**全部**を毎回読み、既知の発行元の形と名前つきの実値代入を探す。当たった値は**場所と指紋だけ**を出して値は出さない。形は同じだが秘密でないと確かめた値は指紋で 1 件ずつ許す（現在 1 件＝外から入れた道具の同梱テストが使う架空のトークン）。**過去の履歴は見ない**） | 実装済 |

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
| REQ-QC11 | QC-15〜QC-17 薬機法・景表法・アクセシビリティ | 薬機法・景表法は `policy-rule.ts`（分野×出力先・根拠と代替表現つき）＋**初期ルール 13 件は `policy-rule-seed.ts`**（2026-08-17 に登録。例文を型で必須にし、検査 75 件で両方向の赤を実測）。アクセシビリティは共通UI側（REQ-SEC08）。**記事の確認と承認の両方から呼ばれている**（`src/application/usecases/content/manage-content.ts` が `deps.policyRules.listEnabled()` で分野ごとのきまりを取り、`checkPolicies()` に掛ける。止める判断は画面の案内だけでなく承認そのものが `CONFLICT` で断る） | PASS（`tests/domain/policy-rule-seed.test.ts` 75 件 + `tests/application/manage-content.test.ts`「表現ポリシーの検査」8 件）。赤の実測: 呼び出しを外すと 8 件のうち 5 件が落ちる。**スタブのまま据え置く理由が変わった** — 呼ばれていないからではなく、`policy_rules` テーブルが無く保存先が読み取り専用の見本（初期ルール 13 件を返すだけで、作業場所ごとの追加・無効化ができない）だから（ah-1eg / 残課題 52） |
| REQ-QC12 | 公開ゲート（ブログ層 §21 の11項目） | `src/domain/compliance/publish-gate.ts` `evaluatePublishGate()`（13項目。仕組みの無いものは失敗にせず `skipped` に残す） | 実装済 |

いずれの検査結果も `/admin/content/[variant]` に表示される（止めた件数・理由・
**検査していない項目とその理由**）。「検査していないものを合格に見せない」ため、
`skipped` を画面に出すところまでを 1 組として扱う。

## M. 禁止依存（ブログ層 §27）

| REQ | 要件 | 検査方法 | 実装 | 結果 |
| --- | --- | --- | --- | --- |
| REQ-FD01 | ランキング式の重複実装禁止 | `tests/architecture/dependency-direction.test.ts`「ランキングの計算は domain/ranking の外に無い」。**見ているのは `weight *` / `totalScore =` / `passThreshold <>` の 3 つの綴りだけ**で、この 3 語を外側へ書くと落ちることは実測した。**別の変数名で書き直した重み付き合計は捕まらない**（`0.4 * quality + 0.6 * price` と `items.reduce((a,i) => a + i.w * i.v, 0)` の 2 通りを外側へ入れて緑。文字列一致の限界であって、書き方の不足ではない）。**空振り防止を、集合ごとに置いた**。`filesUnder()` はディレクトリの不在を握りつぶして `[]` を返していたので、層を 1 つ改名しただけで 13 件すべて緑になった。いまは握りつぶしをやめ、下限表 `LEAST` に無い集合は受け付けず、下限を割ったら落ちる。**11 集合すべてを存在しない名前へ向けて、11/11 赤になることを実測した**（2026-08-19） | `src/domain/ranking/scoring.ts` に集約 | 実装済 |
| REQ-FD02 | 報酬データを推薦スコア入力にしない | `tests/architecture/commercial-isolation.test.ts`。型（`Editorial<T>` / `Commercial<T>`）と組み立て時の実行時検査の 2 段。**印 3 値 × 渡し先 2 種の総当たり 6 通りを表として置いた**（期待は実装から作らず手で書いてある）。順位づけ側と提携側のどちらの判定式を外しても 3 件赤になることを実測した。**1 通りだけ非対称**で、印の無いものは順位づけへ通る（型で止まる想定。残課題 87） | `src/domain/shared/data-classification.ts`、`src/application/usecases/ranking/rank-products.ts`、`src/application/usecases/monetization/manage-affiliate.ts` | 実装済 |
| REQ-FD03 | 根拠のない主張を公開しない | `tests/domain/invariants.test.ts`「公開ゲート」。`evaluatePublishGate()` が「主張が 0 件」と「主張があるのに根拠が 0 件」で止める。**端を足した**（主張ちょうど 1 件 × 根拠 0/1 件）— 足す前は判定を `claimCount > 0` から `> 1` へ緩めても 96 件すべて緑で、**主張 1 件・根拠 0 件が通るようになっても誰も気づかなかった**。見ているのは**件数だけ**で、主張 10 件に根拠 1 件でも通る（ここが「部分」の中身） | `src/domain/compliance/publish-gate.ts`（件数の検査。主張ごとの突合は未実装） | 実装済（件数まで） |
| REQ-FD04 | WebMCP でしか到達できない機能を作らない | `tests/architecture/webmcp-reachability.test.ts` 9 件。**道具 1 つずつの到達先を手で書いた表**（`tests/architecture/webmcp-reachable-screens.ts`、道具 111 件 = 本体 95 + §24 の別名 16、画面 43 種、ファイルは 189 行）と、実行時のカタログ・画面一覧（`tests/ui/route-table.ts`）を突き合わせる。表が実装から作られていないこと（`import` を 1 行も持たないこと）自体も §4 で見ている——ここが緩むと、道具を足したぶんだけ表も増えて永久に緑になる。**4 通り壊して 4 通り赤を実測**（画面の無い道具を足す / 表を自動生成に替える / 画面を 1 枚落とす / 道具の群を落とす）。壊し方はすべて実装側の行為で、判定式は触っていない。例外表は空。**`tool-catalog-adapters.test.ts` ほかは、この要件を見ていない**——あちらが見ているのは「1 つのカタログが 4 入口へ同じ形で写っている」ことで、写しが一致したまま画面に無い道具を足せる（残課題 88） | `src/presentation/tools/catalog.ts`、`src/presentation/composition.ts` | 対応 |
| REQ-FD05 | ブログ層で正規データを再定義しない（**テーブルの置き場所は決めた場所だけ。読む側の入口は `src/db/schema.ts` の 1 つに保つ**） | `tests/architecture/single-definition.test.ts`「保存の形の置き場所」。**2026-08-19 に新設した** — それまで判定欄には「スキーマ定義が `src/db/schema.ts` のみであること」とだけ書いてあり、これを見ている検査は 1 つも無かった。**書いてある事実も違っていた**: `sqliteTable` は `schema.ts` と `auth-schema.ts` の 2 か所にある。**要件文のほうを直した** — `auth-schema.ts` は Better Auth CLI の生成物（`src/auth.cli.ts` 冒頭の手順）で、手で書き換えても次の生成で消える。正本は Better Auth 側にあり、`schema.ts` が `export * from "./auth-schema"` で再輸出しているので**読む側の入口は 1 つのまま**である。要件が言いたかったのは「置き場所が 1 ファイル」ではなく「入口が 1 つ」だった。決めた場所の外でテーブルを定義すると赤になること、**再輸出を名指しに変えると赤になること**（入口が 2 つになる）を実測した | `src/db/schema.ts`（正本）、`src/db/auth-schema.ts`（Better Auth 側） | 実装済 |
| REQ-FD06 | サーバー操作ファイルの形を揃える（`"use server"` からは非同期の関数だけを出す） | `tests/architecture/server-action-exports.test.ts`。対象は `"use server"` で始まる **11 ファイル**で、空振り防止（対象 0 件なら赤）も持つ。`export const` / `export default` / `export const f = async () => {}` はいずれも落ちることを実測した。**`export { X }` の再輸出だけが素通りしていたので塞いだ** — 定数を `*-state.ts` へ移したあと元の場所から再輸出するのは自然な手順なので、ここが空いていると決まりの効き目が無くなる | 状態の型と初期値は `*-state.ts` に置く（`src/presentation/admin/` に 9 件、`src/domain/authoring/content-state.ts` を含めて 10 件） | 実装済 |

## N. 受け入れ条件（プラットフォーム層 §30.1〜§30.8）

検証は `tests/acceptance/acceptance-criteria.test.ts` に置いてある。
**中の関数を直接呼ばず、画面や AI が使うのと同じ入口（ツールカタログ）から流している。**
中を直接つつくと、入口の配線が外れていてもテストは緑のままになるため。

**ただし、入口を 1 本通すことは「確かめ切った」ことではない。**
受け入れ用の検査には分かれ目（境界・状態の全遷移・権限の表）が無い。
たとえば §30.1 は悪い URL を 5 個試すが、内部ネットワークの端
（`172.16.0.1` と `172.31.255.255`）は試していない。
分かれ目を持っているのは単体側の検査で、必須テスト種別
（`docs/product/required-test-types.md` §3 の `REQ-A01`〜`REQ-A08`）は
そちらに結んである。下の表の「分かれ目」列がその置き場所。

| REQ | 条件 | 検証方法（入口から 1 本） | 分かれ目（必須テスト種別の実体） | 結果 |
| --- | --- | --- | --- | --- |
| REQ-A01 | §30.1 URL登録（5項目） | `acceptance-criteria.test.ts` §30.1（4テスト）。元の URL がそのまま残ること、危険な URL を断ること、確認待ちで止まること、情報源をたどれること | `tests/domain/link-ingestion.test.ts`（受け取る/受け取らない URL、内部ネットワークの端、受信箱の 4 状態） | 実装済 |
| REQ-A02 | §30.2 比較（4項目） | 同 §30.2（4テスト）。同一/代替の区別、候補の理由、**報酬が比較スコアに入らないこと**、手動での増減 | `tests/application/read-product.test.ts`（1 つでは比較にならない、1 つでも引けなければ途中まで出さない、件数の上限） | 実装済 |
| REQ-A03 | §30.3 ペルソナ（4項目） | 同 §30.3（4テスト）。書き手・読者が複数、組み合わせで書き分け、実体験のない一人称の検出 | `tests/application/manage-personas.test.ts`（試した記録が無い一人称は止まる / 公表値に基づく書き方は通る） | 実装済 |
| REQ-A04 | §30.4 AI生成（6項目） | 同 §30.4（7テスト）。4媒体の生成、素材が揃うまで始められないこと、主張と根拠の確認、広告表記の自動挿入、媒体ルール違反の警告、切り口の違い、**根拠のない主張は承認できないこと** | `tests/application/generation-matrix.test.ts` + `tests/domain/generation-plan.test.ts`（上限 0 以下は断る、指示として読ませる書き方の検出） | 実装済 |
| REQ-A05 | §30.5 ブログ（5項目） | 同 §30.5（5テスト）。複数サイト、サイトごとの設定、標準構成、会話・比較・商品カードが共通部品として在ること、公開先の信頼ページ | `tests/application/build-site.test.ts`（13 段階のどこが埋まっていないか、保存すると次が開く） | 実装済 |
| REQ-A06 | §30.6 配信（6項目） | 同 §30.6（6テスト）。媒体別プレビュー、承認後だけ外部投稿、重複防止、結果とURLの保存、**note を直接投稿と誤表示しないこと**、失敗理由と再実行 | `tests/application/manage-distribution.test.ts`（公開済みからはどこへも進めない、他の作業場所の配信は見せない） | 実装済 |
| REQ-A07 | §30.7 アフィリエイト（5項目） | 同 §30.7（5テスト）。リンク改変なし、使用箇所の追跡、リンク切れ検出、提携終了の影響範囲、`rel="sponsored"` の一貫 | `tests/application/affiliate.test.ts`（売上を見る権限が無ければ一覧そのものを返さない） | 実装済 |
| REQ-A08 | §30.8 双方向トレーサビリティ | 同 §30.8（2テスト）＋ **本ファイルがその実体**。実測を名乗る主張には必ず根拠が付き、根拠の無い主張は消さずに「推測」と表示される | `tests/application/read-product.test.ts`（事実と推測を読者へ出す言葉で区別する、実測の主張には資料が付く） | 実装済 |

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
| REQ-TM01 | 計測イベントの形を 1 箇所で定義し、送信・保存・集計の型をそこから導く（イベント名の文字列を各所で作らない） | `src/domain/analytics/telemetry-events.ts`（`TELEMETRY_EVENTS` 12種の表。`TelemetryPayload<K>` は手書きではなく表から導出。`buildEvent` が知らない名前・欠けた項目・型違いを入口で落とす） | 画面義務なし（型の仕組み） | — | — | — | — | PASS（`tests/domain/telemetry-tables.test.ts`＝12 件すべてを組み立て、必須の欄を 1 つずつ落として名前つきで落ちることを確認。`telemetry.test.ts` は代表 1 件ずつ） | 実装済 |
| REQ-TM02 | AI 利用の計測（作業場所・ブランド・ブログ・実行者・モデル・提供元・用途・プロンプトテンプレートIDと版・入出力トークン・所要時間・成否・概算費用・成果物への参照） | `src/domain/analytics/telemetry-events.ts` `ai_model_usage`（16項目）、`src/domain/analytics/ai-usage.ts`（`MODEL_PRICES` / `estimateCostJpy` / `rollupAiUsage`）、`src/application/ports/telemetry.ts` `TelemetrySinkPort.aiUsage` | `src/app/admin/ai-usage/page.tsx` | サイドナビ「AI の利用と費用」 | loading（サーバ描画）/ empty（利用が無い理由を文で表示）/ error（`ErrorView` + ホームへ戻る）/ 保存先の状態を `StorageNotice` で明示 | 対応 | 対応（`<th scope="row">` の表、数字は等幅）。**2026-08-19 まで、この欄は「対応」だが検査は無かった** — 行の見出しをただのマスにしても、列の見出しから `scope` を全部落としても 4090 件すべてが緑だった（実測）。axe は届いているが**表の見出しの向きを見ない**ので、`tests/ui/ai-usage-page.test.tsx` で自分で見る | PASS（`tests/domain/telemetry.test.ts` 「AI の記録は参照 ID だけを持ち、文章そのものを持たない」「要件が並べた 16 項目が 1 つ残らず入っている」「価格表から静かに 1 件消えない」、`tests/ui/ai-usage-page.test.tsx`＝数字の並んだ状態の 8 件） | 実装済（保存先は D1 の `telemetry_events`） |
| REQ-TM03 | ブログごと・モデルごとの利用状況と費用を見る管理画面 | `src/application/usecases/analytics/ai-usage-report.ts`（数字と一緒に**その数字の限界**を返す。概算であること、価格未登録のモデルが何件あるか） | `src/app/admin/ai-usage/page.tsx` | サイドナビ「AI の利用と費用」／「数字」から相互に行き来 | 上と同じ4状態 + 価格未登録のモデルがあるときの注意書き（**2026-08-19 まで、注意書きを消しても緑だった**。`tests/ui/ai-usage-page.test.tsx` で見るようにした） | 対応 | 対応 | PASS（`tests/domain/telemetry.test.ts` 「ブログ × モデルで畳み、費用の多い順に並ぶ」「失敗した呼び出しも数え、費用に含める」「価格が分からないモデルの件数が残る」「ブログ名とモデル名の境目が、名前の中の文字とぶつからない」） | 実装済（保存先は D1 の `telemetry_events`） |
| REQ-TM04 | 読者の行動計測（ページ閲覧・読み進めた割合・要素ごとのクリック・節ごとの滞在時間・離脱位置・検索と絞り込み・成果リンクのクリック・内部リンクの遷移） | `src/domain/analytics/telemetry-events.ts`（`page_view` / `scroll_depth` / `section_dwell` / `element_click` / `ranking_row_click` / `affiliate_click` / `internal_link_click` / `search_performed` / `filter_changed` / `page_exit`）、`src/presentation/telemetry/collector.tsx`、`src/app/api/telemetry/route.ts` | 読者向け全ページ（`src/presentation/site/page-frame.tsx` の共通枠から 1 箇所だけ差し込む） | 読者がブログを読む操作そのもの | 同意が無いときは回数だけ数える／`suppressAll` のときは何も送らない | 対応（表示に影響しない） | 対応（`data-*` 属性のみで、読み上げ・操作に影響しない） | PASS（`tests/domain/telemetry-tables.test.ts`＝読者の 10 種を含む 12 件を手で書き写した表で総当たり）。**2026-08-19 まで、この欄は「PASS」だが検査は無かった** — `search_performed` と `filter_changed` はテストのどこにも出ておらず、表から消しても 3810 件すべてが緑だった（実測） | 実装済（保存先は D1 の `telemetry_events`） |
| REQ-TM05 | 計測点を各画面に手で埋め込まない（共通UIの部品が「この要素は何か」を宣言する） | `src/presentation/ui/telemetry-attrs.ts`（要素12種・節9種の名乗り）、`patterns/disclosure.tsx`（`AffiliateLink` は**必ず**名乗るので成果リンクのクリックは取りこぼせない）、`patterns/product-card.tsx`、`patterns/ranking-table.tsx`（順位表の各行） | `src/app/admin/ui-catalog/page.tsx`（部品の見本帳） | サイドナビ「画面部品の見本」 | 印を付けない使い方（見本帳）では `undefined` を渡せば付かない | 対応 | 対応 | PASS（`tests/ui/telemetry-attrs.test.tsx`＝要素12種・節9種を手で書き写した一覧と突き合わせ、`AffiliateLink` が必ず名乗ることを描いて確認）。**2026-08-19 まで、この欄は `tests/ui/ui-layers.test.ts` の 2 つの検査名を挙げていたが、うち「共通UIから通信しない」は存在せず、同ファイルに `telemetry` の文字も 1 つも無かった**（一覧から `affiliate_link` を消しても緑） | 実装済 |
| REQ-TM06 | 節ごとの滞在時間を構造上のまとまり（導入・順位・比較・根拠・CTA など）で測る | `src/presentation/ui/templates/article-view.tsx`（節が種類を名乗る）、`src/presentation/telemetry/collector.tsx`（`IntersectionObserver` で半分見えたら計時、1 秒未満は捨てる） | 記事画面（`/s/{site}/best/*`・`/reviews/*`・`/compare/*`・`/guides/*`） | 記事を読む操作 | 見えていない節は測らない／同意が無ければ測らない | 対応 | 対応 | PASS（`tests/ui/article-frame.test.tsx`＝記事の器が節ごとに識別子と種類を出す、`tests/ui/telemetry-collector.test.tsx`＝半分見えたら計時を始める・1 秒未満は捨てる）。**2026-08-19 まで、この欄が挙げていた `TELEMETRY_SECTION_KINDS` は `tests/` 全体で参照 0 件で、節の名乗りを丸ごと外しても緑だった**（滞在時間が静かに 0 件になる壊れ方） | 実装済（保存先は D1 の `telemetry_events`） |
| REQ-TM07 | 同意管理を最初から組み込む。**同意が無くても壊れない**（誰のものか分からない形の集計だけになる） | `src/domain/analytics/consent.ts`（`decideConsent` / `mayRecord`）、`src/presentation/ui/patterns/consent-banner.tsx`（2つのボタンの目立ち方を揃える＝断りにくくしない）、`src/presentation/telemetry/consent-server.ts`（cookie とヘッダを読む唯一の場所） | 読者向け全ページの足元（`templates/site-shell.tsx`）、見本帳 §19 | ブログのどのページからでも。回答後は「いまどうなっているか」と取り消しの入口が残る | 未回答／許可／拒否の3状態すべてに表示あり。**断ると使えなくなる機能は無い** | 対応 | 対応（共通の `Button`、44px 最小、色に頼らず文で状態を伝える） | PASS（`tests/domain/telemetry.test.ts` 「黙っている人を同意した扱いにしない」「断った人は詳しい計測をしない」「同意が無くても、回数だけのイベントは記録できる」） | 実装済 |
| REQ-TM08 | ブラウザの追跡拒否（DNT / GPC）を実際に効かせる。自動巡回とプレビューは数字に混ぜない | `src/domain/analytics/consent.ts`（判断の順番は 巡回/プレビュー → GPC/DNT → 本人の許可 の 1 通りだけ）、`src/presentation/telemetry/consent-server.ts`（読めないときは同意なしに倒す） | `/s/{site}/measurement`（決まった理由をそのまま表示） | フッター「計測について」 | 読み取りに失敗しても同意なし扱いで動く | 対応 | 対応 | PASS（`tests/domain/telemetry.test.ts` 「ブラウザの追跡拒否は、本人の許可より強い」「自動巡回とプレビューは一切記録しない」） | 実装済 |
| REQ-TM09 | 仮名化・保存期間・削除手段（生 IP と詳しい位置は記録しない。無期限で貯めない） | `src/domain/analytics/consent.ts`（`RETENTION_DAYS` 回数のみ400日／詳しい記録90日、`retentionDeadline` / `isExpired`、`readerKeyScope` は日とブログで区切るので日をまたぐと別人）、`src/domain/analytics/telemetry-events.ts`（`FORBIDDEN_FIELDS` 17語を入口で落とす）、`src/application/ports/telemetry.ts`（`purgeExpired` / `forgetReader` を最初から port に持つ） | `/s/{site}/measurement`（保存期間を明示） | フッター「計測について」 | — | 対応 | 対応 | PASS（`tests/domain/telemetry-tables.test.ts`＝禁止語 17 語すべてを送って落ちること、保存期間 90 日 / 400 日ちょうどの端、ブログをまたがない目印。禁止語を実際に送って確かめてあったのは 2026-08-19 まで 3 語だけだった） | 実装済 |
| REQ-TM10 | 読者向けの開示ページ（何を記録し、何を記録しないか、いつ消すか、どう取り消すか） | `src/application/usecases/analytics/explain-telemetry.ts`（**内容を画面に書き起こさず登録表から生成する**。計測を 1 つ足せば説明にも自動で出る） | `src/app/s/[site]/measurement/page.tsx` | 全ページのフッター「計測について」＋同意のお願いの中のリンク | 未回答／許可／拒否のいまの状態を先頭に表示 | 対応（`PolicyView` の共通枠） | 対応 | PASS（`tests/application/explain-telemetry.test.ts`＝説明を登録表から作っていること 8 件、`tests/ui/measurement-page.test.tsx`＝3 つの状態を実際に描いて先頭の言葉が変わること 6 件）。**2026-08-19 まで、この欄は `tests/domain/site-routes.test.ts` を挙げていたが、それは道と画面の対応を見ているだけで、説明の中身は誰も見ていなかった**（説明を丸ごと空にしても、先頭の状態を消しても緑） | 実装済 |
| REQ-TM11 | 読者の体験を損なわない（本文の表示をふさがない・失敗しても記事に影響しない・まとめて送る・離脱時は `sendBeacon`） | `src/presentation/telemetry/collector.tsx`（15秒ごと／20件たまったら送る、離脱時は `sendBeacon`、送信失敗は握りつぶす）、`src/app/api/telemetry/route.ts`（**常に 204 を返す**。計測の失敗を読者に見せない。本文32KB・1回50件の上限） | 画面義務なし（送り方の決めごと） | — | — | — | — | PASS（`tests/presentation/api-routes.test.ts`「計測の受け口」6 件＝1 回 50 件・本文 32KB の上限と、読み取れない本文でも 204 を返す扱い。`tests/ui/telemetry-collector.test.tsx`＝15 秒ごと／20 件たまったら送る）。**2026-08-19 まで、この欄は `pnpm run build` を挙げていた。それは検査ではない**（実際の検査は上の 2 本で、上限を 1 つでも動かすと赤くなる） | 実装済 |
| REQ-TM12 | 計測は差し替え可能な接続部にする（ドメインは計測の実装を知らない） | `src/application/ports/telemetry.ts`（`TelemetrySinkPort` / `ConsentStorePort` / `TelemetryQueryPort`）、`src/infrastructure/persistence/sample/telemetry-sample-sink.ts`、`src/infrastructure/composition.ts`（差し込みは 1 箇所） | 画面義務なし（層の分離） | — | — | — | — | PASS（`tests/architecture/dependency-direction.test.ts`「domain は外側の層に依存しない」「domain は Next.js / Drizzle / 外部SDK に依存しない」）。**2026-08-19 に引用を直した** — それまでここには「domain は infrastructure を知らない」と書いてあったが、**その名前のテストは存在しない**（`IM10` 型）。名前で探した人は、検査が無いと読むか、探すのをやめる。`src/domain/ranking/scoring.ts` へ `@/infrastructure/composition` の import を 1 行足すと赤になることを実測した | 実装済 |
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
| REQ-IM01 | 変えられるものを登録表 1 箇所に集める。軸を足してもループ本体を変えない | `src/domain/analytics/optimization.ts`（`OPTIMIZATION_DIMENSIONS` 20軸。各軸が候補の作り方・効かせ先・見る指標・直し先を宣言する） | `src/app/admin/improvement/dimensions/page.tsx`（一覧は登録表から生成。**画面に書き起こさない**） | サイドナビ「改善の状況」→「変えられるものを見る」 | 未実施の軸は「未実施」と出す | 対応（表は横スクロール、狭い画面で縦積み） | 対応（`<th scope="row">`、数字は等幅） | PASS（`tests/domain/improvement.test.ts`「登録済みの軸はすべて登録条件を満たす」「軸を足しても、判定と次の一手は軸の名前を知らないまま動く」「改善の軸が、まとまりごとに 1 件も欠けていない」） | 実装済 |
| REQ-IM02 | 文章の軸（構成・節の順・導入文の長さ・見出しの言い方・文の長さ・切り口・比較表の列・根拠の置き方・CTA の言い方・記事の長さ・画像の位置） | `optimization.ts` `group: "text"` の 10 軸 | 同上（「文章の組み立て」の表） | 同上 | — | 対応 | 対応 | PASS（`tests/domain/improvement.test.ts`「改善の軸が、まとまりごとに 1 件も欠けていない」が `text` の 10 行を並び順ごと固定する。**2026-08-19 まで「同上」＝「登録済みの軸はすべて登録条件を満たす」だけで、10 軸のうち 9 軸は名前を書き換えても緑だった**） | 実装済 |
| REQ-IM03 | 見た目の軸（配色と明暗・文字の大きさ・余白の詰め方・本文の横幅・順位表の見せ方・最初に見える範囲の作り） | `optimization.ts` `group: "visual"` の 6 軸（配色は O 節の `BRAND_THEMES` をそのまま値に使う。**別の配色一覧を作らない**） | 同上（「見た目」の表） | 同上 | — | 対応 | 対応 | PASS（同上の「改善の軸が、まとまりごとに 1 件も欠けていない」が `visual` の 6 行を固定。書き換えて赤になっていたのは `brand_theme` の 1 軸だけだった） | 実装済 |
| REQ-IM04 | たどり方の軸（内部リンクの位置と数・関連記事の見せ方・目次の形・記事の種類ごとのひな型） | `optimization.ts` `group: "navigation"` の 4 軸 | 同上（「たどり方」の表） | 同上 | — | 対応 | 対応 | PASS（同上の「改善の軸が、まとまりごとに 1 件も欠けていない」が `navigation` の 4 行を固定。4 軸とも、書き換えても緑だった） | 実装済 |
| REQ-IM05 | 見せ方の設定を一級の物にし、色も構成も同じ形で表す。記録は既にある出どころの仕組みに載せる | `src/domain/analytics/variant-spec.ts`（`VariantSpec` = `{軸, 値}` の集まり + `Provenance`。`createVariantSpec` が未登録の軸・型違い・重複を落とす） | `src/app/admin/improvement/dimensions/page.tsx`「いまの見せ方の設定」（`explainVariantSpec` の 1 文をそのまま出す） | サイドナビ「改善の状況」→「変えられるものを見る」 | 設定が無いときは理由つきの空表示／未承認は「（未承認）」と出す | 対応 | 対応 | PASS（`tests/domain/improvement.test.ts`「登録されていない軸は設定に入れられない」「数値で決める軸に文字を入れられない」「承認していない設定は、承認していないと分かる形で出る」） | 実装済 |
| REQ-IM06 | 適用には必ず人の承認を通す。**見た目だけの変更も同じ** | `variant-spec.ts` `approveVariantSpec`、`src/domain/analytics/improvement.ts`（`ImprovementSuggestion.requiresApproval` は `true` 固定で、`false` を書けない型） | `src/app/admin/improvement/page.tsx`（提案ごとに承認が要る旨を表示） | サイドナビ「改善の状況」 | 未承認の設定は適用できない旨を出す | 対応 | 対応 | PASS（`tests/domain/improvement.test.ts`「判定できないときでも次の一手は記録される」で `requiresApproval` を固定。承認そのものの順序は `tests/property/variant-spec.property.test.ts`「承認できるのは 1 回だけ（二重承認にならない）」「承認した人の名前が空なら承認できない」）。画面から承認する側は `tests/presentation/improvement-actions.test.ts`「登録 → 承認 → 開始 → 観測 → 判定 が、押した順に通る」（承認前に始めようとすると断られることまで）と「AI は、役割を持っていても試作を承認できない」 | 実装済（空の承認者を断る分岐は、2026-08-19 まで丸ごと消しても緑だった。上の総当たりが `fc.pre` でその側を前提から除いていたため。**押せる場所ができたのは 2026-08-19**。それまで `approveVariantSpec` はどの入口からも呼ばれていなかった） |
| REQ-IM07 | 一度に変える軸の数を制限する（何が効いたか分からない比較を始めさせない） | `variant-spec.ts` `MAX_SIMULTANEOUS_DIMENSIONS = 2` と `assertComparable`、`src/domain/analytics/loop-run.ts`（開始時にも突き当てる） | `src/app/admin/improvement/dimensions/page.tsx` 冒頭の注意 | 同上 | 超えた比較は始める前に断る（理由に何を変えているかを列挙） | 対応 | 対応 | PASS（`tests/domain/improvement.test.ts`「同時に変えてよい数を超える比較は始める前に止まる」「差が無い 2 つは比べられない」） | 実装済 |
| REQ-IM08 | 必要件数に届くまで差があると言わない。多重比較にも対処する。小さなサイトでは正直に「効果不明」を出す | `src/domain/analytics/improvement.ts`（`judgeComparison`。必要件数は比較の数に比例、必要な差は平方根に比例。判定は 判定保留／効果不明／良くなった／悪くなった の 4 つ） | `src/app/admin/improvement/page.tsx`（判定保留・効果不明も同じ大きさで出す） | サイドナビ「改善の状況」 | 判定保留のときは「あと何件必要か」を文で出す | 対応 | 対応 | PASS（`tests/domain/improvement.test.ts`「件数が足りないうちは判定保留にする」「同時に見ている比較が多いほど、必要な件数が増える」「差が小さいときは効果不明と言う」） | 実装済 |
| REQ-IM09 | 実験の開始・終了・判定の履歴を残す。件数不足のまま終わらせない。指標の後出しを許さない | `src/domain/analytics/loop-run.ts`（`createLoopRun` / `startLoopRun` / `concludeLoopRun` / `stopLoopRun`。判定保留は終わらせられない。開始前に決めた指標以外では判定できない。打ち切りには理由が要る） | `src/app/admin/improvement/page.tsx`（比較ごとの状態と理由）＋ `src/presentation/admin/improvement-forms.tsx`（登録・承認・開始・観測・判定・打ち切りの操作）＋ `src/presentation/admin/improvement-action.ts` | サイドナビ「改善の状況」 | 実施中／判定済／打ち切りを状態として表示。回す操作はブログを決めてから出る | 対応 | 対応 | PASS（`tests/domain/improvement.test.ts`「件数が足りないまま終わらせられない」「始める前に決めた指標以外では判定できない」「打ち切るには理由が要る」＋ `tests/presentation/improvement-actions.test.ts` 7 件（画面と同じ入口で 1 周・件数不足では終わらせない・理由の無い打ち切りを断る・誰が回せるか）＋ `tests/ui/improvement-forms.test.tsx` 12 件（観測前に「判定する」を出さない等）＋ `tests/ui/route-table.ts` の「どのブログで試すかを決めたとき」で描画と読み上げと Tab 順） | 実装済（**画面から回せるようになったのは 2026-08-19**。それまで履歴の型も判定も動いていたが、開始も観測も画面からは呼べなかった。同日、6 つの操作すべてを操作の記録（`variant_spec.drafted` / `variant_spec.approved` / `loop_run.started` / `.observed` / `.concluded` / `.stopped`）へ届けた。**誰が決めたかを言えない状態で読者に出す見せ方を変えない**ため） |
| REQ-IM10 | ループの種類を増やせる形にする（負のループ・正のループ・探索・劣化検知・費用最適化）。実装するのは動かす先がそろったものだけ | `src/domain/analytics/loop-kinds.ts`（`LOOP_KINDS` **6 種**。動くのは `content_improvement` と `product_improvement` の **2 種**。他は動かすのに何が要るかを持つ）。共通の書き方は 見るもの／比べるもと／決め方／効かせ先／向き／止め方／承認者 | `src/app/admin/improvement/dimensions/page.tsx`「ループの種類」 | サイドナビ「改善の状況」→「変えられるものを見る」 | 動かないループには「まだ動きません」＋必要なものを出す | 対応 | 対応 | PASS（`tests/domain/improvement.test.ts`「いま動くのは 2 種類だけ（使われない仕組みを先回りで作らない）」「まだ動かないループには、動かすのに何が要るかが必ず書いてある」「ループの種類と、動いているかどうかが変わっていない」） | 実装済（**動くのは 2 種類。残り 4 種類は形だけ**） |
| REQ-IM11 | ループを足すと、外せない約束が自動で付く。正のループには上限と止め方を必ず付ける | `loop-kinds.ts`（`UNIVERSAL_GUARDRAILS` 5件を `registerLoopKind` が自動で合成。正のループには上限値・連続適用 3 回まで・読者体験の下限で即停止 を追加。止め方の無いループは登録できない） | 同上（各ループの「外せない約束」「止める条件」） | 同上 | 登録に失敗したループは存在しない（起動時に落ちる） | 対応 | 対応 | PASS（`tests/domain/improvement.test.ts`「どのループにも、外せない約束が自動で付く」「正のループには上限と止め方が必ず付く」「止め方の無いループは登録できない」「外せない約束が、1 件も欠けていない」） | 実装済（**2026-08-19 まで、約束 5 件はどれも文言を書き換えて緑だった**。「自動で付く」を見る検査が一覧そのものを回していたため、一覧から「順位づけの入力に成果や報酬を入れない」が消えても落ちなかった） |
| REQ-IM12 | ループが「順位に報酬を入れない」の抜け道にならない。根拠・広告表示・アクセシビリティ・同意の見せ方・事実と推測の書き分けは軸にできない | `optimization.ts` `NON_OPTIMIZABLE` 6件 + `assertRegistrable`（直し先を記事の書き直しと題材選びに限定し、**既にある `assertFeedbackAllowed` へそのまま突き当てる**。同じ決まりを 2 か所に書かない） | `src/app/admin/improvement/dimensions/page.tsx`「調整してはいけないもの」（軸の一覧と同じ画面に置く。別ページにすると、軸を足す人が読まない） | サイドナビ「改善の状況」→「変えられるものを見る」 | 登録しようとすると仕組みが断る（人のレビューではない） | 対応 | 対応 | PASS（`tests/domain/improvement.test.ts`「調整してはいけないものの一覧が、1 件も欠けていない」「調整してはいけない 6 件は、名前を直接あてても軸にできない」「順位づけ・推奨・合格ラインへ戻す軸は登録できない」「収益の指標で見る軸は、記事の書き直し以外へ戻せない」） | 実装済（**この PASS は 2026-08-19 まで嘘だった**。根拠にしていた「調整してはいけないものは、どれも軸にできない」は `NON_OPTIMIZABLE` を回して `NON_OPTIMIZABLE` 由来の禁止を確かめており、一覧から「広告であることの表示」を外すと**それを A/B 試験の軸にできるようになるのに緑**だった。6 件とも同じ。一覧をテスト側の文字列で固定して塞いだ） |
| REQ-IM13 | 改善ループの保存先（`variant_specs` / `loop_runs` / `loop_observations` テーブル） | `src/db/schema.ts`（3 表。`drizzle/0016_kind_stick.sql`）＋ `src/infrastructure/persistence/d1/improvement-repository.ts`（保存の道筋）＋ `src/domain/analytics/loop-record.ts`（**保存先に置いてよいものの定義**。一覧 4 つを保存側でも突き当てる。D1 が無い環境だけ `sample/improvement-sample-repository.ts` に落ちる） | `/admin/improvement` | サイドナビ「改善の状況」 | 読み書きとも D1 | — | — | PASS（`tests/integration/d1-improvement.test.ts` 本物の D1 で 44 件、`tests/domain/loop-record.test.ts` 10 件） | 実装済（画面からの操作も 2026-08-19 に追加。見本の保存先も、同じ `loop-record.ts` を通したうえで**本当に控えへ書く**ようになった） |

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
| REQ-TS01 | テストの土台を 1 箇所に集める（ファクトリ・テストダブル・担当者・時刻固定・描画補助・読み上げ検査） | `tests/support/`（`factories.ts` / `doubles.ts` / `actors.ts` / `clock.ts` / `render.tsx` / `a11y.ts`） | — | — | — | — | — | **2026-08-19 訂正: ここに「土台自身は `tests/architecture/` の契約検査で『各テストが自前で組み立てていないこと』を見る」と書いてあったが、その検査は存在しない。** `tests/architecture/` の 15 ファイルの `describe` を全部読んで確かめた。あるのは依存方向・Editorial/Commercial の遮断・鍵の漏れ・生成された文書であることの保証・閾値の一元化・入口の一覧・Server Action・テストの誠実さ・仕様の鮮度・1 概念 1 定義・秘密の値・Worker の配線・保存先の作業場所で、**「テストが `tests/support/` を通しているか」を見るものは 1 つも無い**。`test-honesty.test.ts` は名前が近いが、見ているのは**テストが何かを確かめているか**であって、**何を使って組み立てたか**ではない。「型に項目を 1 つ足したときの書き換えが 1 箇所に閉じる」は**実測を 1 度したという記録**であって検査ではない（次に崩れたときに知らせない）。土台の集約そのものは実在する（`tests/support/` の 6 ファイル）が、**それを強制する仕組みは無い** → **2026-08-19 に塞いだ**: `tests/architecture/test-foundation.test.ts`（15 件）が ①6 つの土台が実在し、どれも 1 つ以上のテストから使われている ②axe を呼ぶ口は `tests/support/a11y.ts` の 1 つだけ ③基準時刻 `NOW` を土台の外に書き写していない、を見る。**書いた結果、③に違反する 3 件が見つかった**（`tests/application/reader-interaction.test.ts` / `tests/domain/feedback.test.ts` / `tests/domain/boundaries-platform.test.ts` が同じ日時を自前で書いていた。`NOW` を動かしてもそこだけ古いまま緑で残る形）。土台へ寄せてある。壊して測った 4 通り（基準時刻を書き写す／axe を外から読む／土台を 1 つ改名する／走査先を存在しない名前へ向ける）は **4/4 赤**。見ていないものも検査の冒頭に書いた（ファクトリとテストダブルの自前実装の検出は、素直な入力データと機械では区別が付かないため入れていない） | 完了 |
| REQ-TS02 | 業務の決まりごとの単体テスト（順位に報酬を入れない／公開の条件／ループの外せない約束／止め方と上限／テナント境界） | `tests/domain/`（既存 9 ファイル） | — | — | — | — | — | **実測（2026-08-19）: 31 ファイル / 998 件が緑**（`pnpm exec vitest run tests/domain`）。実装欄の「既存 9 ファイル」は古い。この欄は**要件の側に検査が無い**（「`tests/domain/` にテストがあること」を言うメタ要件で、壊して赤にできる当てどころは個々の業務要件の側にある）。必須種別を宣言していないのはそのため | 実装済 |
| REQ-TS03 | 手順の単体テスト。外側はすべてポートのテストダブルに差し替える | `tests/application/`（既存 8 ファイル） | — | — | — | — | — | **実測（2026-08-19）: 26 ファイル / 797 件が緑**（`pnpm exec vitest run tests/application`。実装欄の「既存 8 ファイル」は古い）。`TS02` と同じメタ要件で、当てどころは個々の手順の側にある。組み立ては `tests/support/` へ集約済み。**テスト用の差し替えで Editorial / Commercial の印が黙って消える不具合**をここで検出し、`testDeps()` 側で直した（印は列挙されない形で付くため、展開して組み直すと消える） | 完了 |
| REQ-TS04 | API の単体テストを**入口 3 種すべて**に対して、道具の一覧から生成する（正常系・入力検証・認証認可・テナント分離・エラー形式・スタブが失敗を返すこと） | `tests/presentation/tool-catalog-adapters.test.ts`（道具の一覧と項目名の辞書 `tool-inputs.ts` から 368 件を生成。入口 3 種で正常系・入力検証・認証認可・テナント分離・エラー形式・スタブが失敗を返すことを確認）と `one-usecase-three-adapters.test.ts` | — | — | — | — | — | 実測（2026-08-19、`pnpm vitest run`）: `tool-catalog-adapters.test.ts` **463 件** + `one-usecase-three-adapters.test.ts` 6 件。**ここに「368 件」と書いてあったのは古い数字**（手で書いた数字は古くなっても古く見えない）。必須種別を宣言済（`has-permission` / `has-tenant` / `has-enumerated-input`）で、印を外すと `tenant-isolation` / `permission-matrix` / `decision-table` / `equivalence` が欠けて赤になることを実測済み | 完了 |
| REQ-TS05 | 画面の単体テスト（4 つの状態・孤立ページ禁止・入力検証・キーボード操作・フォーカス・読み上げ） | `tests/ui/page-render.test.tsx`（経路の表 `route-table.ts` から画面 50 枚を総当たり）、`patterns-render.test.tsx` / `tool-form.test.tsx`（部品） | — | — | — | — | — | PASS | 完了 |
| REQ-TS06 | 読み上げ検査を機械で行う（axe）。**配色 5 種 × 明暗 2 種すべて**でコントラストを確かめる | axe は `tests/support/a11y.ts` 経由で `page-render.test.tsx` が全画面に適用。コントラストは `tests/ui/theme-contrast.test.ts` が配色 5 種 × 明暗 2 種を登録表から総当たり | — | — | — | — | — | PASS。**実測（2026-08-19）**: 配色は `BRAND_THEMES` の **10 種**（要件の 5 種は下限で、登録表から取るので上回る）、明暗 2 種で **20 通り**を総当たり。同じファイルに空振り防止が 2 件ある（「検査対象を実際に読めている」＝対象が 0 件なら赤／「利用者が指定した 5 系統がそろっている」＝名札だけ足してトークンを書き忘れた形も赤）。ファイル全体で 24 件。**壊して測った**: `green` の名札を外すと赤 1/22、配色の名札だけ足して `themes.css` に書かないと赤 1/26（後者は 2026-08-19 に検査を 1 つ足してから赤になる。それまでこのファイル単体では緑だったが、全部走らせれば `tests/ui/blueprint-theme.test.ts` が 2 件落ちていた＝製品の穴ではなく、1 ファイルだけを測ったときの見え方の問題）。**2026-08-19 追記——「機械で行う」の範囲を測った**: axe-core 4.13.0 の全 105 規則のうち、いまの設定で有効なのは 70 件、画面 67 枚に実際に当たったのは **28 件**、違反 0 件。`best-practice` まで広げると有効 100 件・当たり 45 件になり、**`landmark-unique` の本物の違反が 2 件**出る（`admin/settings` と `admin/ui-catalog`）。広げる変更は入れていない（理由と代わりの手当ては backlog 84）。**規則を広げても届かない領域**——名前の無い `role="group"`、役割を名乗らない操作部品、向きを名乗らない表の見出し、焦点を受けない `canvas`、`aria-live` の不在、中身を説明していない `alt`——は `tests/ui/axe-blind-spots.test.ts` に **7 件を検査として**置いた（axe が見るようになった日に赤くなる向き）。**壊して測った**: 一覧から 1 件消すと赤 2/28、落ちたのは足した床 2 本だけで残り 26 件は緑。**2026-08-19 追記——「当たり 28 件」のうち、破って赤にできるのは 18 件だけ**（`tests/ui/axe-rule-coverage.test.ts` に規則ごとの陽性対照として固定）。残り 10 件は、入れ物側に固定されていて渡す側から壊せないもの 4 件（`document-title` `html-has-lang` `html-lang-valid` `aria-hidden-body`）、判定不能どまり 5 件（`bypass` `th-has-data-cells` `duplicate-id-aria` `form-field-multiple-labels` `aria-hidden-focus`）、緑で素通り 1 件（`target-size`。jsdom が全要素 0×0 を返すため大きさを判定できない）。**`findA11yViolations` は `incomplete` を捨てるので、判定不能の 5 件も緑と見分けが付かない**——「機械で行う」と書けるのは 28 件ではなく **18 件**である。**同日さらに追記——見る基準を `best-practice` まで広げた。**理由は「当たる規則が増えるから」ではなく **`landmark-unique` の違反が現に出ていて 1 度も赤くならなかったから**（`/admin/settings` と `/admin/ui-catalog` が同じ名前の目印を 1 画面に 2 つ出していた）。広げた時点で赤 6 本が出て、部品側（`asLandmark`）と渡し方（`asPartOfPage()`）で直した。**数え方を変えたので新旧の両方を残す**: 当たり **28 → 45 件**、赤くできる **18 → 33 件**、届かない **10 → 12 件**。増えた 17 件のうち 15 件が赤くでき、2 件（`landmark-one-main` / `page-has-heading-one`）は**有効になったがこの渡し方では中身を 1 文字も見ていない**。したがって **「機械で行う」と書けるのは 45 件ではなく 33 件**である。止めている規則（`color-contrast` の 1 件）には上限 1・理由の無い項目 0 件・その陽性対照の 3 本を置き、止めていない有効な規則 99 件を固定した。詳細と壊して測った結果は backlog 84 | 完了 |
| REQ-TS07 | 結合テスト（生成 → 承認 → 公開 → 計測 → 分析 → 提案 → 承認 → 再生成の 1 周）。実際の D1 とマイグレーションを使う | `tests/integration/d1-link-inbox.test.ts`（wrangler の `getPlatformProxy` で workerd 上の実際の D1 を立て、`drizzle/*.sql` をそのまま流す。手書きの CREATE TABLE は使わない）と `tests/integration/full-loop.test.ts`（1 周を実際のユースケースで通す 7 件） | — | — | — | — | — | PASS。**両側から書いた**: 保存先を書ける差し替えにして 1 周が回ることを見たうえで、本番の組み立て（`createDeps()`）では未接続の段が成功を装わず次の一手つきで断ることを別に固定した。導入時に実在の不具合を検出（同じリンクの 2 回目の貼り付けが永久に失敗する／計測が数字に届かない／配信を作る入口が無い）。**計測の断絶は 2026-08-17 に解消**（残課題 25、`tests/integration/d1-telemetry.test.ts`）。**配信を作る入口も 2026-08-17 に解消**（残課題 26、`createSchedulePublicationUseCase`）。1 周のテストが domain を直接呼んで代用していた箇所は**このユースケースを通す形に置き換え済み**（同じ要求を 2 回出しても増えないことも 1 周の中で確かめている） | 完了 |
| REQ-TS08 | 境界値・異常系（0/1/上限/上限+1、空/最大/最大+1、日付と時差、ページ送りの端）。**とくに統計判定の境界**で、件数が足りないのに「差がある」と言わないこと | `tests/domain/boundaries.test.ts`（統計判定・有効期限・商品同一性・会計期間・表現ポリシー、64 件）と `tests/domain/boundaries-platform.test.ts`（契約プランの上限・役割・金額・価格の鮮度・比較表の上限・配信の状態遷移、57 件） | — | — | — | — | — | 実測（2026-08-19、`pnpm vitest run`）: `boundaries.test.ts` **64 件** + `boundaries-platform.test.ts` **58 件** = **122 件**。**ここに「121 件」と書いてあったのは古い数字**。必須種別を宣言済（`has-input`）で、`boundaries-platform` の印を外すと `equivalence` が欠けて赤になる。`boundaries` の印だけを外すと緑のままだが、これは相方が `boundary` を別に持っているためで、弱点ではない | 完了 |
| REQ-TS09 | 契約検査（依存の向き・色や余白の直書き禁止・スタブ台帳・1 概念 1 定義・計測イベントの形が送信側と一致） | `tests/architecture/`（依存方向・商業データ遮断・Server Action・**閾値の一元化** `quality-gates.test.ts`・**1 概念 1 定義** `single-definition.test.ts`・**テストの誠実さと秘密情報の混入** `test-honesty.test.ts`）、`tests/ui/design-tokens.test.ts`、`tests/infrastructure/stub-ledger.test.ts` | — | — | — | — | — | PASS。導入時に実在の重複を検出して解消済み（収益モデルの表示名が画面によって「提携販売」「成果報酬の紹介」の 2 通り、記事タイプも 2 通り、`Site` 型が 2 つ、`/s` 接頭辞が 2 か所、`Page` が「取得の指定」と「画面の枠」で衝突）。いずれも**わざと壊して赤くなることを確認済み**。2026-08-19 に `has-code-placement-rule` で宣言した（名乗る先は `dependency-direction.test.ts` と `single-definition.test.ts`）。宣言のほうも壊して測り、**2 通りとも赤**（2 ファイルの両方から `@req REQ-TS09` を外す／2 ファイルの両方の `@types` から `code-boundary` を落とす。片方だけ外しても緑なのは、もう片方が同じ種別を持っているため） | 完了 |
| REQ-TS10 | カバレッジを**層別**に測り、全体と「スタブを除いた実質」を併記する。数字合わせを禁じる | `vitest.config.mts` のカバレッジ設定、`scripts/coverage-report.mjs`、`docs/product/coverage.md` | — | — | — | — | — | 実測（2026-08-17、`pnpm verify` 通過時）: 全体 行 91.2% / 分岐 80.4% / 関数 86.5% / 文 89.2%。層別（行）は domain 94.3 / application 98.6 / presentation 88.7 / app 89.7 / infrastructure 78.7 で全層が下限以上。**閾値は 1 度も下げていない**（下限 80 のまま、テストを足して越えた）。スタブと実質の差 -10.7pt は**スタブ側が薄い向き**（数字合わせなら逆に振れる）だが、契約検査が絶対値で見るため上限 3pt には未達 → 残課題 24。**2026-08-19 の実測（`docs/product/coverage.md` の自動生成の囲みが正本）: 全体 行 90.9 / 分岐 81.2 / 関数 87.9 / 文 88.8。層別（行）は domain 95.9 / application 97.8 / presentation 89.4 / app 87.8 / infrastructure 82.2 で全層が下限以上。差は -9.5pt。**判定は片側だけを見る形に直っている** — `judgeStubGap(91.6, 82.1)` を実際に呼ぶと `exceeded: false`（「スタブは実質を上回っていない（望ましい向き）」）で、絶対値では見ていない。**ただし残課題 24 の状態欄は「未着手」のままで、実装と食い違っている**（この欄の「上限 3pt には未達 → 残課題 24」も、そのぶん古い）。この欄の数字は手で書いているので古くなる。現況は必ず `coverage.md` の末尾を見ること** | 完了（判定方法の見直しのみ残る） |
| REQ-TS11 | 仕様章（`system-spec/*.md`）のコード塊が**開いてから閉じるまでで完結**し、章の本文や見出しを飲み込んでいないこと。**フェンスの本数が偶数であることでは判定しない**（backend.md は壊れていたときも偶数 2 本だった。行き場の無い閉じフェンス 2 本が互いに対になり、あいだの 169 行を丸ごとコード塊として飲み込んでいた） | `system-spec/` の 8 章と `index.md` / `00-requirements-definition.md`。これらは `spec-state.json` の `qa_log` から生成されるため、生成元が壊れていれば再生成で同じ形が戻る | — | — | — | — | — | `tests/architecture/spec-chapter-fences.test.ts`（3 件）。実測（2026-08-19、`pnpm exec vitest run tests/architecture/spec-chapter-fences.test.ts`）: 3 件が緑。**壊して測った 3 通りとも赤**（`system-spec/index.md` に対して ①開きフェンスを落とす → 「開いたまま終わっている章が無い」と「見出しがコード塊の中」の 2 件が赤 ②本文の先頭に開きフェンスを足す → 同じ 2 件が赤 ③既存の 2 本を外して章全体を 1 つの塊にする → 「1 つのコード塊が章の本文を飲み込んでいない」が `5〜70 行 (65 行)` で赤）。**宣言のほうも壊して測った** — `@req REQ-TS11` の 1 行を外すと `node scripts/traceability.mjs --check` が NG（由来不明 29 > 上限 28）。ただしこの測定は**この欄にテストのパスを書く前**に取ったもので、いまはパスを書いたぶん表からも引けるため、印だけを外しても由来不明にはならない（`traceability.mjs` は印と表のどちらかがあれば「由来が分かる」と数える）。壊した 2 ファイルはどちらも複製から書き戻し、sha256 の一致を確認済み（`index.md` = `409add2d…`）。**必須種別は `has-known-breakage`（→ `regression`）を宣言した** — 「一度実際に壊れていて、直したあとも生成元が直っておらず、同じ形で戻ってくる」という性質そのもの。`regression` は一覧にありながらどの性質からも指されていなかった種別で、ここが初めての指し先である。宣言のほうも壊して測り、`@types regression` を外すと **NG（`REQ-TS11: regression` が欠ける）** | 完了 |
| REQ-TS12 | ログイン不要の「静止した写し」（`pnpm run preview:static` が焼く 1 枚）が、**本物の CSS を読まずには書き出せない**こと。写しは見た目を見て判断してもらうために渡すので、実物からずれると**ずれた見た目のほうで判断が決まる**。しかもずれは開いた人には見えない（トークンが読めていなければ、素の見た目の 1 枚が「これが実物です」という顔で出るだけ）。あわせて、焼いた 1 枚を**アプリが配る場所（`public/`）へは置かない** — そこへ置くと入口の門を通さずにアプリ自身が配ってしまい、「別に作った静止画」ではなく門に開けた穴になる（門そのものは REQ-S10 / `tests/architecture/open-doors.test.ts` の側で測る） | `scripts/lib/static-preview.mjs`（組み立てと空の判定）、`scripts/write-static-preview.tsx`（描画と書き出し）、`scripts/lib/css-module-hook.cjs`（`.module.css` の名前をそのまま通す）。見本帳の 22 節は `src/app/admin/ui-catalog/density-samples.tsx` へ出してあり、焼く側と画面側が**同じ部品を描く**（写しを作らない） | — | — | — | — | — | `tests/architecture/static-preview-writer.test.ts`（12 件）。実測（2026-08-19、`pnpm exec vitest run tests/architecture/static-preview-writer.test.ts`）: 12 件が緑。**通る例と止まる例を同じ検査に入れてある** — 「常に投げる」へ化けても「常に通す」へ化けても赤になる。**壊して測った 5 通りとも赤**（①書き出し側の `tailwindCss()` を空文字を返す形にする → 検査ではなく `pnpm run preview:static` そのものが「トークンの CSS が空です」で止まり、終了コード 1 ②`buildDocument` から空の判定 4 つを外す → 「止まる例」5 件が赤、「通る例」7 件は緑のまま ③断り書きの背景に `var(--color-surface-raised, …)` を書いてトークンの写しを置く → 「焼く側にトークンの写しが置かれていない」が赤 ④`OUT` を `public/preview/…` に変える → 「アプリが配る場所へは置かない」が赤 ⑤`findModuleCss` のさがす先を `src/presentation` に狭める → 「手で書かずに src からさがして作る」が赤。狭めても「0 件ではない」は通るので、別々の枝にある 2 枚が両方入っていることを見ている）。**宣言のほうも壊して測った** — この行を書く前は `node scripts/traceability.mjs --check` が **NG（要件表に無い ID: REQ-TS12）**。必須種別は `has-input`（→ `equivalence`, `boundary`）を宣言した。空か空でないかが同値の分かれ目、空文字がその境目そのもので、この検査が見ているのはまさにそこである。宣言のほうも壊して測り、`@types` の 1 行を外すと `node scripts/required-test-types.mjs --check` が **NG（`REQ-TS12: boundary, equivalence` が欠ける）**。壊した 3 ファイルはいずれも複製から書き戻し、sha256 の一致を確認済み（`static-preview.mjs` = `1b171aa7…` / `write-static-preview.tsx` = `351e5661…` / テスト = `40fff626…`） | 完了 |
| REQ-TS13 | 確定 8 章（`system-spec/*.md`）の要件文に、上流指針（doctrine anchor）の条項が**引かれていないこと**を固定する。**これは塞ぐ要件ではなく、塞げていないことを検査にする要件である** — `docs/spec/08-仕様の未修正点.md` ② に「未解消」と書いてあるが、本文の「未解消」は解消した日にも古く見えないまま残る。検査にしておけば、**引かれた日に赤くなって知らせる**。なぜ塞げないかは「難しいから」ではなく「この作業場所の約束と両立しないから」である: ①条項を引くには authority の内部位置（節番号・章名）が要るが、それを取りに行くコマンドは**権限で断られた。迂回していない** ②取得済みの `system-spec/retrieval-evidence/*.json` は `content_sha256` と `page_title` しか持たず、節名を 1 つも持っていない ③ローカルの出典カード（`ref-system-design-knowledge/`）には条項らしき名前が並ぶが、`system-spec/security.md` 自身が「**非規範・取得証跡なし・実装根拠に使用不可**」と規定しており、そこから借りるのは**この課題が直そうとしている欠陥（名前を借りているだけで条項は当たっていない）の再生産**にあたる ④`docs/spec/` 側の書面入力にも条項番号は無い（grep 0 件）。確かめずに条項名を書けばこの検査は緑になり C05 も通るかもしれないが、それは指標が目的化した状態そのものなので書いていない | `system-spec/` の確定 8 章（`auth` / `backend` / `database` / `frontend` / `infrastructure` / `maintenance-ops` / `security` / `ui-ux`）。生成元は `spec-state.json` の `qa_log` で、確定章は hook（`guard-confirmed-chapter-overwrite.py`）が Edit を遮断する | — | — | — | — | — | `tests/architecture/doctrine-citation-gap.test.ts`（11 件）。実測（2026-08-19、`pnpm exec vitest run tests/architecture/doctrine-citation-gap.test.ts`）: 11 件が緑。**語ではなく文で数えた** — 確定 8 章の To-Be / 規範契約の要件文は **40 文**、うち authority 名を含む文は **0 文**（auth 4 / backend 4 / database 8 / frontend 4 / infrastructure 4 / maintenance-ops 7 / security 5 / ui-ux 4）。**通る例と止まる例を同じ検査に入れてある** — 4 authority を引いた合成文が引用として数えられること（4 件）と、実在の `SEC-REQ-001` が数えられないことを両方見ている。これが無いと「0 文」が**引用が無いから 0 なのか、見つけられないから 0 なのか**を区別できない。**壊し方は要件の文がそのまま禁じている行為（確かめずに条項名を要件文へ書く）にした。実体への Edit は確定章ガードで遮断されたので迂回せず、scratchpad の複製に対して測った**（`security.md` の実体は `131a0cde…` のまま無傷）。**壊して測った 3 通りとも赤**（①複製の `SEC-REQ-001` へ「OWASP ASVS V2.1 に従い」を書く → 引用文 0 → 1 で「authority を引いている文は 0 文」が赤 ②複製から `SEC-REQ-005` の行を落とす → 要件文 5 → 4 で「合計 40 文」が赤 ③証跡 JSON へ `sections` の欄を足す → 「取得証跡は節名を持っていない」が赤）。**宣言のほうも壊して測った** — `@req REQ-TS13` を書く前は `node scripts/traceability.mjs --check` が **NG（由来不明 29 > 上限 28）**。必須種別は `has-input`（→ `equivalence`, `boundary`）を宣言した。引用あり／なしが同値の分かれ目、**0 文と 1 文がその境目そのもの**で、この検査が見ているのはまさにそこである。`has-enumerated-input` 側（4 つの authority という有限の列挙）も見たが、それが要求する `decision-table` を満たしていないので**名乗らなかった** | 未解決（穴として固定中。取得手段が得られたら検査ごと書き直す） |
| REQ-TS14 | 確定 8 章の「最新ドキュメント出典」表の欄が、**欄名どおりの値を持っていないこと**を固定する。**これも塞ぐ要件ではなく、塞げていないことを検査にする要件である**（`ah-a4c`）。当てどころは 2 つ: ①**バージョン欄が取得日で埋まっている章が 4 つある** — `cloudflare-d1` / `cloudflare-workers` / `google-sre` / `apple-hig` は版番号を公表していないため、生成側が取得日 `2026-08-16` を版として書いた。**日付は版ではない。欄は埋まっているが、埋めている値が意味しているものが違う**（`qa_log` の `source.sha256` が `answer` の指紋だった `ah-84i` と同じ族）②**「最新確認」が独立した再確認になっていない** — 8 件とも「取得」との差が 17〜25 秒で、同じ 1 回の取得の中で書かれている。「最新確認」という欄名は「あとで確かめ直した日」を約束するが、実際は取得と同じ瞬間であり、**古くなってもこの欄は古く見えない**。なぜ塞げないか: 公式の表明値を得るには外部取得が要るが、**利用者が外部取得を行わないと決めた**（`ah-ejn` と同じ壁）。私が打たないだけでなく、他のセッションに取ってもらう形も取らない。確かめずに版番号を書けばこの検査は緑になるが、それは**いま在る誤りを、より見えにくい誤りに置き換えるだけ**である | 確定 8 章の `## 最新ドキュメント出典` の表（各章 1 行、計 8 行）。生成元は `spec-state.json` の `targets`（`target_id` と `category` しか持たず、版も更新日も持っていない）と `system-spec/retrieval-evidence/*.json` | — | — | — | — | — | `tests/architecture/doc-source-version-gap.test.ts`（12 件）。実測（2026-08-19、`pnpm vitest run tests/architecture/doc-source-version-gap.test.ts`）: 12 件が緑。**通る例と止まる例を同じ検査に入れてある** — 版が日付である 4 件を名指しで固定するだけでなく、**残る 4 件が本物の版（`1.6.29` / `0.45.2` / `16.3.1` / `5.0`）を持っていること**も同じ検査で見ている。これが無いと「4 つ」が**日付だから 4 つなのか、判定が何も当たらずたまたま 4 つなのか**を区別できない。加えて `looksLikeDate` 自体を 2 件（日付）+ 6 件（版番号・`v` 付き・年月のみ）で両方向から確かめている。**壊して測ったのは 12 件中 10 件**（2026-08-19、C05 完了後に実施）。壊し方は要件の文がそのまま禁じている行為——**確かめずに版番号を書く**（`cloudflare-d1` の版を `2026-08-16` → `4.20`）——にし、判定式は触っていない。**対の両側が同時に赤になった**（日付の章 4→3 で上、版を持つ章 4→5 で下）。これが対を張った目的で、片側だけでは「4 つ」が空振りでも通る。実体への Edit は確定章ガードが遮断したので、迂回せず scratchpad の複製で測った。**残る 2 件（「確定 8 章がそれぞれ出典を 1 本ずつ持っている」「『最新確認』は取得と同じ実行の中にある」）は緑だが未検証で、固定済みとして数えない** — 複製を作り直してから書く形の Bash 2 本が、**書込先のパスが変数で `system-spec/` を含む**ことを理由に確定章ガードに遮断された（書込先が scratchpad でも止まる）。**3 通り目の書き方は試していない。**この 2 件が未検証であることはテスト本文の冒頭にも書いてあり、解けたらそちらの囲みごと消す | 未解決（穴として固定中。外部取得が行えるようになったら検査ごと向きを反転させて書き直す） |
| REQ-TS15 | 章を再生成しても**痩せないこと**を、走らせる前に数で固定する。**これは穴の固定でも塞ぎでもなく、これから行う変更の床である。**`completeness-report.json` gaps[0] は 8 章 + `00-requirements-definition.md` の再生成を求めているが、前に一度、この種の再生成が **892 行の削除**を伴い、**gaps が引用している当の節を消す形**になった。走らせてからでは、消えたものが「元から無かった」と読めてしまう。想定を文書にも書くと数の正本が 2 つできる（残課題 78 ⑰ の型を自分で作る）ため、**数はテスト 1 箇所にだけ置いた** | **確定 8 章すべて**（`auth` / `backend` / `database` / `frontend` / `infrastructure` / `maintenance-ops` / `security` / `ui-ux`）。**最初は `auth.md` 1 章だけだった** — まとめて測ると想定が外れたときにどの想定が外れたのか分からないため、構造が最小の auth で形を作った。**2026-08-19 に 8 章へ広げた。守られているのが 1 章だけということは、残り 7 章が今日と同じ状態だということでもある。**床は**章ごとに実測して置いてある。auth の 153 行を他章へ写していない**（写すと 8 章のうち 7 章で床が実態とずれ、ずれた分だけ緑の意味が変わる） | — | — | — | — | — | `tests/architecture/chapter-regeneration-floor.test.ts`（16 件）。実測（2026-08-19）: 16 件が緑。床は現在値そのもの（153 行 / 見出し 21 個 / 必須の節 11 個を名前と順序ごと / 表の本文行 To-Be 5・受入 6・収集状態 7・上流指針 3・出典 2 / 確定回答 321 字を逐語 / 原則 2 件 / 非規範注記）で、**等号ではなく「以上」で置いた** — 再生成の目的が decisions[] の追記＝増える方向だからで、**減るところだけを止める**。上限は 1 つだけ（+150 行）。目的の `decision-auth-method` 1 件は options 3 件 × 12 項目 + 推奨 + 確定で 50〜80 行と見積もり、倍を超えたら載せる対象を取り違えている。**通る例と止まる例を同じ検査に入れてある** — 痩せた章を 5 通り合成して、同じ測り方が落とすことを見ている（節を 1 つ落とす / 対象外 5 行を消す / 確定回答を要約に置き換える / 非規範注記を消す / 原則を 1 件に減らす）。これが無いと、床を満たす 8 件は測る側が壊れていても同じ緑を返す。**再生成中に判明したこと**: gaps[0] は「decisions[] 6 件を本文へ載せる」と言うが、**`00-requirements-definition.md` には 6 件とも既に載っている**（L80）。載っていないのは 8 章の側で、しかも 00 での載り方は `{'category': 'free', ...}` という **Python の dict をそのまま文字列にした形**である。残課題 78 ⑫ の 3 例目。**8 章へ広げたときの実測（2026-08-19）**: `tests/architecture/chapter-regeneration-floor.test.ts` は **112 件**（うち 1 件は測定用の口の見張り）。**章の形は 1 通りではなかった** — 5 章（auth / frontend / maintenance-ops / security / ui-ux）は 11 節、3 章（backend / database / infrastructure）は 6 節で、後者は `As-Is` 〜 `Acceptance evidence` の代わりに `状態の意味と実装差分` 1 節を持つ。**必須節の一覧を 1 本にできない** — 1 本にすると 3 章が今日から赤になるか、5 章の 5 節が床から外れるかのどちらかで、どちらも「守っているつもり」を作る。**節数が揃っていないこと自体を記録しておく** — 床は「**いまの形を保つ**」ものであって「**この形でよい**」とは言っていない。**保つ床を張ると、保たれていること自体が正しさに見え始める。**5 章 11 節 / 3 章 6 節という不揃いは床を張った結果として固定されただけで、揃えるべきかどうかは別に判断が要る（残課題 78 ㉚）。**行数の床では捕まらない章がある（これが実測でいちばん効いた）** — 再生成後の行数は **backend 292 → 329 行・frontend 172 → 177 行**と**増え**、見出しの数も **backend 35 → 35 個・frontend 21 → 21 個**で変わらない。それでも節と非規範注記は失われる。**行数と見出しの床だけを置いていたら、この 2 章は緑のまま中身を失っていた。**だから「断りが 1 つ残っていること」は行数とは別の 1 件として 8 章分持たせてある（残課題 78 ㉕）。**実際に止まることを、再生成の結果に同じ床を当てて測った** — 確定章への書き込みは hook が遮断するので実体は壊さず（迂回していない）、**読む先だけを差し替える口**（`CHAPTER_FLOOR_PROBE_DIR`）を開けて scratchpad の再生成結果へ当てた。**赤は 39 件**（内訳: 測定用の口の見張り **1 件** + 床 **38 件**）。**非規範注記は 8 章すべてで赤**（true → false、8/8）。**この口自体が残課題 78 の族 II（自分で満たせる条件）である** — 太った別のフォルダを指せば床は通る。そのため「口が開いていない」を検査 1 件で見張り、測定のときはその 1 件も一緒に赤くなるようにした。赤を数えるときに床の赤と混ぜないこと。**当てどころが無いものは宣言していない** — `backend.md` は `**回答**: ` が **0 件**で確定回答の逐語の床を張る先が無く、0 件に「0 件以上」を置くと壊しようのない緑が 1 件増えるだけなので張っていない（残課題 78 ㉗ と同じ理由） | 未着手（8 章に床を置いた段階。再生成はまだ走らせていない） |
| REQ-TS16 | **書き手の側の欠落**を 2 つ固定する。値の中身ではなく、**その値を書いた／書けるはずの経路**を見る要件である。㉑（埋められない欄を手元の値で埋める）と ⑪（器はあるのに渡す側がいない）は**値を見ても見分けられない** — どちらも「欄が埋まっている」「同じ値が並ぶ」という同じ見え方をする。見分けは**別の値を書く経路が何件あるか**で、1 件以上なら ㉑（書き手を直す）、0 件なら ⑪（書き手を作る）。**直し方が正反対**で、間違えると居ない書き手を直そうとして永久に終わらない。**A**: `hearing_progress` が `loop_count`(7) > `max_loops`(5) かつ `complete: true`。`run_chunk` はループ前に `loop_count = 0` を代入し `processed >= max_loops` で break し最後に両方を書くので、**この経路を通る限り `loop_count <= max_loops` は構造的に成立する**（契約 `spec-state-contract.md` §hearing_progress も「直近 1 invocation の turn 数。累計ではない」と定める）。よって 7/5 は「上限が緩い」ではなく **writer を通らずに書かれた痕跡**である。C05 gaps[7] は「超過した状態の扱いを定義せよ」と読んでいるが、定義すべきは扱いではなく**通っていないという事実のほう**。これは C05 の新規 medium（`recorded_with` の自己申告「`schema_version` を検査しない writer で書いた」）と**同じ 1 つの欠陥を別経路から見たもの**で、効くのは**申告は消せるが矛盾した数値は消せない**から（申告を消しても 7/5 は残り同じ結論に到達できる）。当てどころは `ah-4l5` / 残課題 94。**B**: `design_applications.applicability` が **70/70 `applied`**。採否を記録する欄が一度も「不採用」を持ったことがなく、**採否を数える門はこの欄を見ているかぎり構造的に必ず全件採用と答える（壊しようがない緑）**。経路を数えた結果、schema の enum（`spec-state.schema.json` `$defs.designApplication`）も writer の検証集合（`state_transition_matrix.py:16` `APPLICATION_STATES`）も 2 値を知っているのに、**`not_applicable` を値として書く本番コードは 0 件**（本番側の登場はすべて検証集合の要素かエラー文言で、実際に書いているのは compiler のテスト fixture `test_compile_spec_doc_knowledge.py:83` の 1 箇所だけ）。値は呼び出し側の turns JSON から来るので**コードの側に書き手が居ない**。よって (f) は ㉑ ではなく **⑪**。同じ理由で (d)（`latest_checked_at` が `confirmed_at` と同値 5/5）も ⑪ で、`latest_checked_at` を別の値で書く経路もコード上 0 件（呼び出し側 JSON をそのまま検証して格納するだけで、確認し直す経路が無い） | `system-spec/spec-state.json` の `hearing_progress` と `qa_log[].design_applications`、および `.claude/plugins/system-spec-harness/schemas/spec-state.schema.json` | — | — | — | — | — | `tests/architecture/writer-absence.test.ts`（8 件）。実測（2026-08-19）: 8 件が緑。**向きは②の形** — 固定しているのは**違反している状態そのもの**である。不変則 `loop_count <= max_loops` を直接書くと今日から赤で入り見張り全体が止まるため、「いま違反していること」を緑で固定し、**検査を持つ writer を通して書き直された日に赤くなる**ようにした。その日に `toBeLessThanOrEqual` へ**反転させて残す（消さない）**。B も同様で、`not_applicable` を書く側が現れた日に `{applied: 70}` が赤くなり、そのとき「不採用が 1 件以上ある」へ反転させる。**通る例と止まる例を同じ検査に入れてある** — A は不変則の判定を 3 通り（3/5=成立・**5/5=境目そのもの**・6/5=違反）で両方向から確かめ、B は `not_applicable` を 1 件混ぜた合成 qa_log が `{applied: 70, not_applicable: 1}` と数えられることを見ている。これが無いと A の `false` は**違反しているから false なのか判定が常に false なのか**、B の 70 は**全件 applied だから 70 なのか数える側が壊れているのか**を区別できない | 未解決（穴として固定中。A は writer を通す道が、B は不採用を判断して書く側が、それぞれ作られた日に赤くなる） |
| REQ-TS17 | **「0 件である」と主張している検査に、その 0 の母集団の件数の床が同居していること**を、対の数で固定する。**これは ② の形の検査そのものを見張る要件である。**② は「塞げていない穴を、いま 0 件だと固定し、塞がった日に赤くなる」形だが、**0 は 2 通りの理由で出る** — 悪さが消えたときと、**数える対象そのものが消えたとき**。後者では検査は緑のまま黙る。実測（2026-08-19、node で走らせて確かめた）: `spec-state-writer-gap.test.ts` の走査論理は、走査対象が 5 件のときも 0 件に減らしたときも同じ `[]` を返す。**この 1 件だけでは区別できない。**同じ日に C03 を再生成したとき、`doctrine-citation-gap.test.ts` だけが「穴が塞がった」と「母集団が消えた」を見分けられたのは、40 文・8 章の床が同居していたからである（残課題 102）。**対で置く理由**: 上限（床を持たないもの ≤ 24、下げる向きのみ）だけでは抜けられる — 床を足す代わりに**検査そのものを消せば**上限は下がる。下限（族の件数 ≥ 47、上げる向きのみ）がその道を塞ぐ。**逆向きであることが仕掛けの本体で、揃えると抜け道が開く** | `quality-gates.config.mjs` の `FORM2_MAX_WITHOUT_FLOOR` / `FORM2_MIN_FAMILY`、および `tests/` 配下のテスト全体（族の判定対象）。床を足した先は `spec-state-writer-gap.test.ts` 2 件 / `generated-docs.test.ts` 2 件 / `test-honesty.test.ts` 2 件 / `guard-inline-python-hole.test.ts` 1 件 | — | — | — | — | — | `tests/architecture/form2-population-floor.test.ts`（3 件）。実測（2026-08-19、機械で数えた。読んで判断していない）: 族 **32 件**、うち床を持つもの **7 件**、持たないもの **25 件**。族に入らなかったもの（母集団がリテラル配列で、テストの外から集めていないもの）**262 件** — この境界が無いと「族」は「0 を主張する検査すべて」に膨らみ、上限も下限も意味を失う。**数える条件を 3 通り試して、条件ごとの数も残した**（ファイル単位 → 別の `it` の床を誤って貸す／`it` 単位＋ファイル頭の②印 → リテラル配列のドメインテスト 20 件超を巻き込み 35/32／**採用**: 実行時にテストの外から母集団を集めているもの → 32/31）。**気に入る数が出るまで条件を回した形になりかけたので、動かす前の条件とそのとき出た数を全部残してある**（残課題 78 ㉗）。**壊して測った 3 通りとも、狙った側だけが赤になった**（①床を 1 つ外す → 「床を持たないものが増えていない」だけ赤 ②`toStrictEqual([])` を `toBeLessThan(1)` に変えて族から 1 件抜く → 「族そのものが減っていない」だけ赤（`expected 31 to be greater than or equal to 32`）。**このとき上限は緑のままで、これが対を張った目的そのもの** ③`it(` の切り出しを壊す → 検査 1 と下限が赤、**上限は 0 件なので緑のまま**＝⑳ の形そのもの）。6 つの床も 1 つずつ壊して測り、**赤は 6 件で床と 1 対 1**（`WRITER_DIR`→`docs` / `dirs`→`["__none__"]` / `.dev.vars.example`→`.gitattributes` / `scripts`→`docs` / 見張りの生存確認コマンド→`echo hi`）。壊した 7 ファイルは scratchpad の複製から node の `writeFileSync` で書き戻した（シェルの `cp` は使っていない）。**測り方の限界を先に書いておく（数字より重要）**: 床を「`.length` に対する `toBeGreaterThan` 系」で見つけるので別の形の床は見えない。`guard-inline-python-hole.test.ts` は止まる例を同居させる形（`toBe(2)`）で床を張っているが機械には見えず、逆に `copy-dictionary.test.ts:125` は床を持つと判定されるが**張り先が走査対象ではなく辞書のほう**である。**この 2 つの誤りは逆向きで、いまはたまたま相殺している。25 という数が合っているのは、測れているからではない**。**同じ日に、数える条件を 4 度目に動かした（前後を両方残す。残課題 78 ㉗）** — 「0 件である」の判別を `toStrictEqual\(\[\]\)` と **1 行で**書いていたため、整形器が `toStrictEqual(\n  [],\n)` へ折った `it` を族から落としていた。**㉓（行を単位に測ると外れる）そのもので、下限の側で 1 度やった誤りを上限の側で繰り返している。前: 族 32 / 床なし 25 / 族外 262。後: 族 34 / 床なし 27 / 族外 266。**新しく見えた 2 件（`spec-compiler-fence-seal.test.ts` の「経路が 2 つとも関数を通っている」／`test-honesty.test.ts` の「プラグマでカバレッジから外している場所が無い」）には**床を足して 25 へ戻し、上限 25 は上げていない**。下限は実測に合わせて `32 → 34`（上げる向きのみ）。**足した床は数合わせではない** — 前者はキット配布物がスタブへ置き換わった日に、後者は `src` を歩けなくなった日に、どちらも同じ 0 件を緑として返す。**もう 1 つ、族が過小に出ていることも分かった（未修正）** — `test-honesty.test.ts` の `ALL` は `testFiles(...).map(...)` で作られていて上位変数の検出に掛からず、`.skip` とコメントアウトの 2 件が族外へ落ちている。**この過小計上は同じ日に直した（5 度目の条件変更）** — 走査を含む関数の名前を先に集め、その関数を呼んでいる変数も母集団と見なす 2 段にした。**前: 族 34 / 床なし 25 / 族外 266。後: 族 47 / 床なし 37 / 族外 253。**増えた 12 件（`test-honesty` 7 / `single-definition` 2 / `site-routes` 2 / `page-render` 1）**すべてに床を足して 25 へ戻し、上限 25 は上げていない。理由つき除外も 1 件も増やしていない。**下限は 34 → 47。**予想を先に外へ出してから直した**（残課題 78 ㉛）: 予想は族 41 / 床なし 32 で、**2 つとも外れた**。外した理由は「集める処理は関数に切り出されるのが普通だ」と直しの理由に書きながら、**その理由を自分の予想には当てていなかった**こと。**途中で 1 度、誤った数（床なし 29 件）も出している** — 初期化式を `([\s\S]{0,300})` と捕捉で書いたため `lastIndex` が 300 字進み、その中の次の `const` を飛ばしていた。先読みへ直した。**そのうえで ㉙ の 2 件（(a) `guard-inline-python-hole.test.ts:54` / (b) `copy-dictionary.test.ts:125`）を同じ日に決着させた。ただし直した先は測り方ではなく検査 2 本の側である。**測り方を直すには (b) の「辞書」と「走査対象」を変数名で見分けるほかなく当てにならない。(a) の `toBe(2)` を床と認めるのは **0 以外の等値をすべて床と認める**ことで、測る側を緩めるのと同じである。そこで (a) には見張りの行数の床（> 300 行。止まる例はそのまま残置）、(b) には走査対象そのもの（`screenFiles` / `banned`）へ床を足した。**実測 族 47 / 床なし 25 → 24 / 族外 253。上限も 25 → 24 へ下げた（下げる向き）。****(b) の見積もり「25 → 26」は外れた**（正確には、方針を変えたので起こらなかった。(b) は元から床ありと数えられており、直しても数は動かない。動いたのは判定の中身が正しくなったことのほうである）。**測り方は直っていない** — 床の張り先を見ない数え方はそのまま残り、同じ形（走査対象でないものにだけ床がある）はいまも見つけられない。この限界は検査本体の doc comment に残してある。**そして「下げる向きだけ」という約束自体の穴を、この回に見つけた（残課題 78 ㉝）** — 定義を広げれば実態を 1 つも直さずに上限を満たせ、しかも向きは「下げる」なので約束に違反しない。**由来不明 28・未宣言 7・除外 7 も同じ抜け方をされる。**抜け道になるのは 2 種類の定義のうち片方だけで、(i) 母集団の定義を広げると族も床なしも増えて上限に当たる（抜けられない）／(ii) **床の認定を広げると床なしが減る（これだけが抜け道）**。**取り扱いを 2 つ決めた: 定義を変えた回は新旧両方の定義で数えて両方を報告する／上限を下回ったら認めすぎの徴候として報告する。**実測（3 版で数え直した）: 83722dc で D1 床なし 2 / D2 床なし 25 / D3 床なし 25、(a)(b) を直したあとで **2 → 1 / 25 → 24 / 25 → 24**。**床の認定（`.length` への `toBeGreaterThan` 系）は一度も触っていないので、どの定義でも下がった。これが 24 を実態の改善と呼べる根拠である。**<br>**——ただし、この読みは 1 段階甘い（残課題 78 ㉞）。**下げ方は 3 通りあり、(i) 実態を直す / (ii) 定義を広げる のほかに **(iii) 実態を変えずに書き方を機械に見える形にする** がある。**25 → 24 で動いた 1 件は (iii) だった。**足した床だけを消して見張りをスタブ化しても赤 2 件のままで、床を足す前から同じ `it` の `alive.code === 2` が同じ壊れを拾っていた。**実態は 1 つも良くなっていない。****確かめ方をここで 1 段足した: 壊して赤を見るだけでは足りない。足した床だけを消して緑に戻ることまで確かめる。**前者は「検査が生きている」、後者は「その床が生きている」の確認で別物である。ただし「他の検査」は**同じ `it` の中にあるものだけ**を数える——族は `it` 単位なので、隣の `it` は代わりにならない。この限定で (a) は落ち、(b) は落ちない（(b) は床だけ消すと狙った `it` が実際に緑へ戻る）。**限定を足さずに読むと (b) も落ちる。自分に有利に働く限定なので、根拠を先に書いた。****足した 2 つの床は壊して赤を見た**（複製を scratchpad へ取り、書き戻しは複製から）: 見張りを 4 行のスタブへ → (a) が `expected 4 to be greater than 300`、辞書の見出しを変える → (b) が `expected 0 to be greater than 5`。**ただし (a) はこの壊し方なら床が無くても同じ `it` の `alive.code === 2` が拾う。(a) の床は新しい検出ではなく、既にあった検出を機械から見える形にしたものである**（数が動いたのはそのためで、見張りの強さは変わっていない） | **`contract` の名乗りを外した**（2026-08-19）。`contract` は語彙上「API 契約（3 入口）」＝同じことが画面・REST・WebMCP の 3 入口から同じに使えること、であり、`REQ-TS17` / `REQ-TS18` のどちらの検査も入口を 1 つも通っていない。**要件の側（`has-input` / `has-known-breakage, has-input`）も `contract` を求めていない。**つまり対応表の穴ではなく、**飾りの名乗り**だった。**外した。**外しても未宣言 7 / 除外 7 は動かない（`contract` はどの性質からも指されていない 15 種のうちの 1 つだから）。**見分けの決め手は、名乗りに根拠が書いてなかったこと** — 同じヘッダの `boundary` と `equivalence` には根拠の段落があり、`contract` だけ無かった。**同じ形が他に 4 件残っている**（`tenant-scoped-ports` / `generated-docs` / `llm-connectivity` / `llm-provider-catalog`）。いずれも「インターフェイスの形」の意味で `contract` を使っており、語彙の定義（3 入口）とはずれている。**一括では外さない** — 都度その検査に触るときに決める。 未解決（穴として固定中。族 47 件のうち 24 件は床を持たない。**一括で足さない** — 24 件を ② と見なすかどうかは、その検査に触るときに都度決める） |
| REQ-TS18 | 章のコード塊が本文を飲み込む壊れを、**生成物ではなく生成側**で見る。`REQ-TS11` は出来上がった章を見るが、**原因は生成側にある** — `spec-state.json` の `qa_log[].answer` に**開きフェンスを失った閉じフェンス**が混ざっており、コンパイラがそれを本文へそのまま実体描画するため、**1 つの欄の壊れが章全体へ広がる**。実測（2026-08-19、C03 を scratchpad へ再生成）: `backend.md` で**見出し 28 個・192 行**が 1 つのコード塊に飲まれ、`## 上流指針` `## 適用された設計知識` `## 最新ドキュメント出典` の 3 節が丸ごとその中に入った。**向きは ③（戻ったら赤）である** — 直したのはコンパイラの側で、**原因である正本の欠落フェンスは残っている**。③ の 2 条件（(a) 実際に壊れた事実を見た (b) 直したが原因が残っている）が揃っている | `.claude/plugins/system-spec-harness/lib/spec_docset_chapters.py`（`seal_code_fences` と、answer を本文へ描く 2 つの経路 `render_confirmed_qa` / 本章での適用）、および `system-spec/spec-state.json` の `qa_log[].answer`。**このファイルはキット配布物で、次回のキット更新で上書きされる** — 上書きされたらこの検査が赤くなる（追跡下なので `git status` にも出るが、静かに戻らないようにするのが検査を生成側へ向けている理由。残課題 102・78 ㉔） | — | — | — | — | — | `tests/architecture/spec-compiler-fence-seal.test.ts`（5 件）。実測（2026-08-19）: 5 件が緑。**直し方は「捏造しない」側に寄せた** — 内容は変えず、回答の境目で閉じフェンスを足すだけにし、**足したこと自体を章に注記として出す**（`- (注記: 正本 qa_log[…].answer のコードフェンスが閉じていないため、章の構造を守るためコンパイラが閉じた。正本側の修正が要る)`）。**効いたことを再生成で測った**（実体は触らず `--out-dir` を scratchpad にした）: 飲まれた見出し **28 個 → 2 個**、**末尾で開いたまま終わる章 1 → 0**、注記 **2 件**。残る 2 個は回答の本文内にある `###` で、`## ` の節は 1 つも飲まれていない（節の数 5 個は再生成前後で不変）。**片方だけ塞ぐと漏れることを、途中の実測で見た** — `render_confirmed_qa` だけ塞いだ時点では「本章での適用」側から漏れて飲まれた見出しが **3 個**残り、末尾も開いたままだった（**28 → 3 → 2**）。この経路が 2 つとも `seal_code_fences` を通っていることを検査に入れてある。**これは「緑を支えている経路を先に数える」の裏返しである** — `REQ-TS11` で宣言経路が 2 系統（`@req` の印と要件表の行）あり、1 本壊しても赤くならなかったのと同じ形で、こちらは**漏れ方が何通りか**を数えている。**塞ぐときも、支えを数えるときと同じだけ経路を数える必要がある。**「1 箇所直したから塞がった」は、経路が 1 本であることを確かめていない限り言えない。**母集団の床を同居させた** — `qa_log` が 20 件以上読めていること。0 件は「壊れが消えた」でも「読めていない」でも出る（残課題 78 ㉗）。**通る例と止まる例を同じ検査に入れてある** — フェンス 0 本 / 1 本 / 2 本 / 行中の ``` の 4 通りで数え方を両方向から確かめている。正本が直った日にこの行は赤くなる。**そのとき消さず「0 件」へ反転させて残すこと**（残課題 78 ⑤） | 未解決（コンパイラ側で防波堤を作った段階。**正本 `qa_log[].answer` の欠落フェンス 2 件は残っている**。確定状態の書き換えになるため、直すなら R4-reopen 経由） |
| REQ-TS19 | **確定セルの裏付けが「どの論点なのか」を機械が読めること**を固定する。`qa_ref` は 1 件しか持てない（決定論ゲートが文字列で照合する）ため、複数回の質疑の回答本文を 1 entry へ統合して裏付けの範囲を保つ運用になっている。C05 はこれを「どの論点がどのセルの裏付けか読めない」と挙げたが、**評価者の gap 文面は実物と 2 箇所で違っていた** — 対象を「6 entry」と書いたが実物は **7 件**（`uiux` が抜けていた）、直接原因を「schema の単一 `qa_ref` 制約」と書いたが **schema に `qa_ref` は 0 件**で、制約は validator 21 箇所 / writer 12 箇所 / 契約散文 4 箇所の側にあった。**評価者が挙げた原因が、実物と違う場所を指していた。私たちの検査は自分の主張を実物で裏取りする規律を持っているが、評価レポートの側にはその門が無い。**さらに、gap が求めた「回答本文の統合」は**既に実行済み**で、対象 entry の本文には節ごとの元 qa id と出典がすでに書かれていた。足りなかったのは**それを機械が読める形にすること**だけだった。**やってあることが、やってあると読めない形で置かれていると、次の人は同じ作業を最初からやり直す。**当てどころは 4 つ: ①確定 8 セルそれぞれに、その論点を名乗る注記があること（母集団の床 8 を同じ `it()` に置く。被覆漏れ 0 件は確定セルが消えたときにも出る。REQ-TS17 の形） ②注記は正規 writer `set-qa-scope-notes` を通っており、`answer_span` が本文に **1 箇所だけ**あること（床が無いと `。` 1 文字でも部分文字列は成立し、**逐語引用したという主張だけが門を通る**。床 20 字は実測: 対象 8 entry の節見出し 19 件の最短が 23 字、遊び 3。**上げる方向にしか動かさない**） ③**注記を足しても束ねは解消していない**こと — `bundled=true` の entry は理由欄を持ち、その文面が束ねの残存を明言していること（**注記を足したことで束ねが消えたと読める形にしない**） ④確定セルから指されていない束ね entry が 1 件以下であること（実測 1 = `qa-uiux-web-spec-intake`。R4-reopen で ui-ux×web の `qa_ref` が `qa-uiux-web-screen-priority` へ移り、指す者を失った。**指されていないものは注記されず、注記されないものは見えなくなる。**上限は下げる方向にしか動かさない） | `.claude/plugins/system-spec-harness/skills/run-system-spec-elicit/scripts/state_transition_matrix.py` の `set_qa_scope_notes` / `normalize_scope_notes`、`apply-spec-transition.py` の `set-qa-scope-notes` op、`system-spec/spec-state.json` の `qa_log[].scope_notes` | — | — | — | — | — | `tests/architecture/qa-scope-notes-coverage.test.ts`（4 件）、`.claude/plugins/system-spec-harness/tests/test_set_qa_scope_notes.py`（22 件）。**壊して両方向で確認した**（2026-08-20）: 注記を 1 件外す → 被覆側が赤 / 確定セルを 1 件増やす → 床が赤（`expected 9 to be 8`）。writer 側は 5 つの門を 1 つずつ潰し、**いずれも対応する検査だけが赤**（床・実在・一意・`bundled=false` の 2 条件・`covers_cell` 全 null）。**このうち床の検査は最初 1 度緩めても緑のままだった** — 短い例を `SCOPE_NOTE_SPAN_MIN_LEN - 1` から作っていたため、床を 20 → 1 に下げると例も一緒に縮んだ。**測る側が測られる側を参照していると、緩めたことを検出できない。**長さを実物の文字列で固定し、床の値そのものは別の検査（`>= 20`）で縛る 2 本立てに割った | 解決（注記は 8 entry すべてに入っている。**ただし束ねそのものは解消していない** — 解消は entry 分割か `qa_ref` の複数化を要し、前者は「当時 1 問で聞いた事実を後から複数問だったことにする」記録の偽造、後者は確定 8 章の全書き直しを伴う。**束ねが残っている事実は注記の `bundling_reason` に持たせてある**） |

**この節の行に画面を作らない理由**: テストは製品の機能ではなく、製品が壊れていないことの確認手段である。
画面を作ると「テストの画面が最新か」を人が見張ることになり、確認手段自体が確認対象になる。
確認は `pnpm verify` の出力（機械が毎回作り直すもの）に一本化する。

---

## S. 自動チェックと公開（`docs/spec/11-CI-CD・品質ゲート仕様.md`）

利用者の追加要件。**「CI/CD が通るようにし、こちらで管理できるようにしておく」**。

「管理できる」を、確かめられる 4 つに分解してある（仕様 §1）。

| REQ | 要件 | 実装 | 画面 | 導線 | 状態 | RWD | a11y | test | 結果 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-CI01 | `pnpm verify` が CI とまったく同じ検査を再現する（機械の上でしか試せない状態を作らない） | `scripts/verify.mjs`、`package.json` の `verify` | — | — | — | — | — | PASS（`tests/architecture/ci-config.test.ts`）。**2026-08-19 に、この欄は事実と違っていた**——「検査ステップは `pnpm run verify` の 1 行のみ」と書いてあったが、実際には「マイグレーション未生成の検出」という独自のステップが `ci.yml` にあり、`pnpm run verify` には含まれていなかった。**この要件そのものが破れていた。** 文章ではなく実装を直し、`scripts/migration-generated.mjs` として `verify` の `CHECKS`（1 段）へ移した。いまは `ci.yml` の `run:` が 3 行（`pnpm install` / `verify --tier 1` / `verify`）で、それ以外の検査ステップと複数行シェルが無いことを機械が見る。**壊して確認済**（検査ステップを外す・`deploy.yml` の中身で丸ごと上書きする、いずれも赤） | **実装済** |
| REQ-CI02 | 閾値と検査項目を**1 箇所**に集め、CI 設定と手元の設定が別々に育たないようにする | `quality-gates.config.mjs`（読み手は `vitest.config.mts` / `scripts/verify.mjs` / `scripts/run-tests.mjs` / `scripts/tier-audit.mjs` / `scripts/coverage-report.mjs` / `tests/architecture/quality-gates.test.ts` の 6 つ） | — | — | — | — | — | PASS（`tests/architecture/quality-gates.test.ts` 13 件）。`.github/workflows/` に閾値が書き写されていないことも同テストが機械的に検査する | **実装済** |
| REQ-CI03 | 検査の順番を固定する（型 → 静的検査 → 単体 → 結合 → 画面/読み上げ → カバレッジ閾値 → ビルド → 公開） | `quality-gates.config.mjs` の `CHECKS` が唯一の正本（`ci.yml` は順番を持たない） | — | — | — | — | — | PASS（`tests/architecture/ci-config.test.ts`）。順番の固定は `quality-gates.config.mjs` 側にある。**「`ci.yml` は呼ぶだけなのでずれようがない」と書いてあったが、これは事実ではなかった**（REQ-CI01 参照。独自のステップが 1 つあった）。「ずれない作りだから見なくてよい」ではなく、**ずれていないことを機械が毎回見る**形にした（`ci.yml` / `deploy.yml` に検査名が 1 つも書き写されていないこと、段の指定漏れがテストより前にあること）。ビルドは検査では行わず公開時に 1 回だけ（型の確認は `next typegen` で足りる。理由は ci-cd-guide ②） | **実装済** |
| REQ-CI04 | ワークフローは 3 本だけ（検査 / 公開 / データの形の変更）。重複を残さない。**段の追加で 5 本になった**（夜間の深い門・AI 評価セット。どちらも壊すものが違うので分けている） | `.github/workflows/{ci,deploy,migrate,nightly,ai-eval}.yml` | — | — | — | — | — | PASS（`tests/architecture/ci-config.test.ts`）。旧 `deploy-dev.yml` / `deploy-prod.yml` は削除済み。出し先は枝で決まる（`dev`→試し場 / `main`→本番）。**5 本ちょうどであること・名前・`push` で動くのが `ci.yml` と `deploy.yml` の 2 本だけであることを機械が見る**（`nightly.yml` に `push` を足すと赤くなることを実測） | **実装済** |
| REQ-CI05 | データの形の変更を自動で走らせない。手動起動＋確認文字列 `APPLY` を必須にし、順番は「形の変更 → 公開」 | `.github/workflows/migrate.yml` | — | — | — | — | — | PASS（`tests/architecture/ci-config.test.ts`）。`workflow_dispatch` のみ。`confirm != 'APPLY'` で最初のステップが失敗する。適用前に `wrangler d1 export` で控えを取り、成果物として 30 日保管。`deploy.yml` にマイグレーションは 1 行も無い。**この 4 つを機械が見る**（`APPLY` の判定を外す・`deploy.yml` に適用の行を足す・保管日数を 29 にする・控えを適用より後ろへ動かす、いずれも赤になることを実測） | **実装済** |
| REQ-CI06 | 公開後のスモークテストを**間隔を空けて 2 回**行い、落ちたら緑で通さない | `.github/scripts/smoke.sh`（30 秒 → 1 回目 → 90 秒 → 2 回目） | — | — | — | — | — | 構文は確認済（`bash -n`）。判定は 2 回目で行い、落ちたら `exit 1`。**この形を `tests/architecture/ci-config.test.ts` が機械で見る**（待ちを 1 回に減らす・2 回目の判定の枝から `exit 1` を外す、どちらも赤。なお「`exit 1` がある」だけを見る書き方では、APP_URL 未設定用の別の `exit 1` があるため緑のまま通ってしまう——実測で見つけて直した）。2026-08-21 に**本番 URL で初めて実行**し、`/admin` の期待値 200 が誤りだと分かった（middleware が未ログインを `/signin` へ送るため 307 が正しい）。期待値を `307 + 送り先` に直し、送り先は末尾一致ではなく `${ORIGIN}${expected_location}` と丸ごと比べる（末尾一致では外部のアドレスへの差し替えを通してしまう）。この 2 点も同テストが見る（200 期待に戻す・末尾一致に緩める、どちらも赤になることを実測） | **実装済**（本番で実行済） |
| REQ-CI07 | 秘密情報は GitHub Secrets と Cloudflare の環境変数にだけ置く。**登録は利用者本人が行い、代行しない** | `.dev.vars.example`（値を書かない）、`docs/product/ci-cd-guide.md` §8 に本人が実行する手順、`tests/architecture/test-honesty.test.ts`（鍵らしい形の文字列の検出と、見本に値を書いていないことの検査） | — | — | — | — | — | PASS。導入時に `.dev.vars.example` に値（`local-development-token`）が入っていたのを検出して空欄化。鍵らしい文字列を混ぜて赤くなることも確認済み | 完了 |
| REQ-CI08 | 非エンジニアが読める運用説明（何を見ているか / 落ちたらどうするか / どう公開し、どう戻すか） | `docs/product/ci-cd-guide.md` | — | — | — | — | — | 文書のため自動検査の対象外。`docs/spec/00-README.md` からの参照切れは既存の文書検査で見る | **実装済** |
| REQ-CI09 | 検査を重さで 3 段に分け、**重いテストを足す前に置き場所を先に作る** | `quality-gates.config.mjs` の `TIERS` / `checksForTiers`、`scripts/tier-scan.mjs` / `tier-audit.mjs` / `run-tests.mjs`、`.github/workflows/{ci,nightly,ai-eval}.yml` | — | — | — | — | — | PASS（`tests/architecture/quality-gates.test.ts` の「検査の段」8 件）。実測: 1 段 80 ファイル 11 秒 / 2 段 35 ファイル 31 秒 / 3 段のテストは 0 ファイル。**3 段の検査（全体ミューテーション）は CI 相当の並列度で 27 分 0 秒**（2026-08-17）。**2026-08-18 に定例を廃止**し、3 段は `workflow_dispatch` のみになった（`cron` / 「予算の門」/ `PRIVATE_RUN_DOW` を削除）。打つ場面は仕様 §8-2 に人の手順として定めてある（必須は「本番へ公開すると判断する日」で、`docs/product/open-doors.md` を見る回と同じ回） | **実装済**（3 段の**テスト**は未着手。検査は稼働中） |
| REQ-CI10 | **段の印が無いテストがあると CI が落ちる**（どの段でも走らないまま緑になるのを防ぐ） | `scripts/tier-audit.mjs`（`CHECKS` の `test` より前に置く） | — | — | — | — | — | PASS。**わざと段指定の無いテストを追加して実測**（`pnpm run verify` が「段の指定漏れ」で終了コード 1、後続 4 件は未実行）。削除後に再度緑を確認 | **実装済** |
| REQ-CI11 | 段の割り当ては設定 1 か所で切り替えられ、テスト側は段の印しか持たない（非公開化したときに**消すのではなく移す**） | `TIERS[].runOn`（`ci` / `local` / `manual`） | — | — | — | — | — | PASS（同テスト「マージを止める段は、機械の上で走る段と一致する」） | **実装済** |
| REQ-CI12 | 目標時間の超過は**警告**であり、検査を落とさない | `TIERS[].targetMinutes`、`scripts/verify.mjs` の `judgeBudget` / `readElapsedOverride` / `describeOverride` / `judgeRun` | — | — | — | — | — | `tests/architecture/ci-budget.test.ts`（19 件）。実測（2026-08-19）。**ここは長らく「未実測」だった**——判定は前から書いてあったが、1・2 段の実測 46 秒に対して目標 20 分なので**超過の枝を誰も踏まなかった**。時間だけを外から渡せるようにして測った。テストは 19 件。壊し方 4 通り（時間を exit code に混ぜる／超過を `blocking: true` にする／外から渡したことを黙る／境目を 1 秒ずらす）はすべて実装側で、**4 通りとも赤**。実物でも `VERIFY_ELAPSED_SECONDS=99999 pnpm run verify --tier 1` で警告が出たうえ **exit 0** を確認。必須種別を宣言済（`has-input`） | 完了 |
| REQ-CI13 | AI 評価セットは手動起動のみ・確認文字列必須で、上限が**走行の途中で止まる** | `AI_EVAL_BUDGET`、`scripts/ai-eval-budget.mjs`、`scripts/ai-eval.mjs`、`.github/workflows/ai-eval.yml` | — | — | — | — | — | PASS（`tests/architecture/ai-eval-budget.test.ts` 6 件。上限 3 件のとき 4 件目の手前で止まり、計上が 3 件で終わることを確認）。**提供元への問い合わせ本体は作らないと決めた**（2026-08-17・`ah-gzq`）。理由は、生成された文章の良し悪しを機械で判定するには結局 AI をもう一度呼ぶことになり、**判定する側が正しいかを確かめる手段が無いまま従量課金だけが発生する**ため。上限で走行を止める見張りは将来の枠として残す。**`--run` は 0 件で緑にならず、終了コード 1 で落ちる**（0 件・0 円の緑を「評価セットが通った」と読まれるのを防ぐため。実測で確認済み）。AI を呼ばない構造検証（`tests/evals/generation-eval-set.test.ts`、51 ケースの定義が仕様項目を覆っているかを見る）は**残す** | **対象外（意図的・2026-08-17）**（見張りのみ残置） |

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
| REQ-FB01 | ループの種類の登録表へ 2 件目として `product_improvement` を足す。歯止め 5 本は自動で付く（定義側で書き忘れられない） | `src/domain/analytics/loop-kinds.ts`（受け取る画面が揃ったので `readiness: "implemented"`。判定規則は「1 件届いたら扱いを決める」で、**必要件数の判定には乗せない**） | — | — | — | — | — | PASS（`tests/domain/loop-kinds.test.ts`／`tests/domain/improvement.test.ts`：歯止めが自動で付く・統計の判定に乗っていない・動くのは 2 種類だけ。決め方 × 見る指標の**全通り**を登録表から作って当てる）。**赤を実測済み**（2026-08-19）: 判定規則を素通しにすると全通りの表が落ちる | 実装済 |
| REQ-FB02 | どの画面の右下にも同じ「改善」ボタンが出る。押せるのは管理者だけ | `src/presentation/ui/patterns/feedback-button.tsx`（共通UIの型）。差し込み口は `src/presentation/ui/templates/app-shell.tsx` の 1 箇所（`AdminShell` は素通し） | 管理側の全画面（共通レイアウト 1 箇所） | 画面右下に固定。キーボードでも到達できる | 権限なし=非表示 / 通常 / 送信中 / 送信済み | 対応（375px でも本文に重ならない） | 対応（`aria-label`、44px 最小、フォーカス可視） | PASS（`tests/ui/feedback-button.test.tsx`：4状態 + axe + 全配色 × 明暗 + **役割 11 個すべての出す／出さない**（役割を足すと型検査が落ちる形）+ 出し分けの判断が 1 箇所しか無いことの確認）、`tests/presentation/nav-permissions.test.ts`。**赤を実測済み**（2026-08-19）: 出し分けを素通しにする／権限名を変える、どちらでも落ちる | 実装済 |
| REQ-FB03 | 押すと出る書き込み欄。画面名が自動で入る。種類は 3 つ。「改善したいこと」は必須、「どうなってほしいですか」は任意 | `feedback-button.tsx`（ボタンと書き込み欄は**同じ 1 ファイル**。開閉の状態が 2 つに割れないため）、`src/domain/feedback/report.ts` | 同上（重ねて出す） | ボタン → 書き込み欄 → 送信 → 一覧へ | 未入力 / 入力中 / 送信中 / 失敗 / 送信済み | 対応 | 対応（Esc で閉じる、フォーカスを閉じ込める、必須は色以外でも示す。**この欄は 2026-08-18 まで嘘だった**——Esc もフォーカスの閉じ込めも実装に無く、2026-08-19 に書いてあるほうへ実装を合わせた） | PASS（`tests/ui/feedback-button.test.tsx`、`tests/domain/feedback.test.ts`：必須の空欄・本文 4000 文字の境界・「どうなってほしいか」200 文字の境界・種類は 3 つだけ・Esc で閉じる・開くとフォーカスが中へ入る・Tab が両端で折り返す）。**赤を実測済み**（2026-08-19）: Esc / 折り返し / 開いたときの移動をそれぞれ外すと落ちる。端も別に当てた（4000 と 200 を 1 ずつ動かすと落ちる） | 実装済 |
| REQ-FB04 | 画面の写しを撮る。撮れなかったときは**撮れていないことをその場で伝える**。貼り付け・ファイル選択でも足せる | `src/presentation/ui/patterns/capture-canvas.tsx`、`src/domain/feedback/capture-policy.ts` | 書き込み欄の中 | 「画面を撮る」／貼り付け／ファイル | 未取得 / 取得中 / 取得済み / 一部撮れず / 失敗 | 対応 | 対応（画像に代わる説明を必ず持つ） | PASS（`tests/ui/capture-canvas.test.tsx`：撮れなかったときの文言が出る + axe）。**赤を実測済み**（2026-08-19） | 実装済 |
| REQ-FB05 | 写しへ書き込める（手書き・四角・矢印・文字・黒塗り／赤・茶・青・黒、黒塗りは色を選べない）。**元に戻す・撮り直す・画像を外して文章だけで送る**ができる | 同上 + `src/domain/feedback/capture-policy.ts` | 同上 | 道具を選ぶ → 描く → 戻す／撮り直す／外す | 道具ごとの選択状態、履歴の有無で「元に戻す」の可否が変わる | 対応（指でも操作できる） | 対応（道具の選択を色だけで示さない。道具・色・逃げ道に加え、**描く操作そのものもキーボードだけで完了できる**——矢印キーで位置、Enter で始点と確定、Esc で取り消し、Shift で 1 画素刻み。位置と段は `aria-live` で読み上げる。**「対応」に戻した根拠はこの 1 文ではなく、`tests/ui/capture-canvas.test.tsx` の describe「キーボードだけで印を置ける」9 件が緑であること**。2026-08-19 に、9 件のうち先に書いた 7 件で実装前の赤 6 件を実測し（残り 1 件は退行の見張りなので実装前から緑）、あとから足した 2 件は壊して赤を実測した） | PASS（`tests/ui/capture-canvas.test.tsx`：道具・元に戻す・画像を外す・道具と色は素の `<button>`・選択は `aria-pressed` が運ぶ・道具の並びと色の並びはそれぞれ名前を持つ・正の `tabindex` を使わない）。加えて**キーボードだけで印を 1 つ確定できる**（矢印＋Enter で黒塗り／四角／文字、Esc で取り消し、確定した印が写しの申告に入る、位置の目印は外へ出す 1 枚へ焼き込まない）。**赤を実測済み**（2026-08-19）: `aria-pressed` を外す／まとまりの名前を外す／外へ出す 1 枚に目印を焼き込む／目印を常に描く、いずれでも落ちる | 実装済 |
| REQ-FB06 | 黒塗りは**画像そのものを塗り替える**。元画像を残して上に重ねる作りにしない | `src/domain/feedback/capture-policy.ts` の 5 手順（4 で元画像を捨てる） | — | — | — | — | — | PASS（`tests/domain/feedback.test.ts`：保存された値から元画像を取り出せない・受け取ってよい種類と大きさ・保存 180 日の境目）。**赤を実測済み**（2026-08-19）: 4MiB ちょうど / 種類 / 180 日を 1 つずつ動かすと落ちる | 実装済 |
| REQ-FB07 | 届いた要望の一覧。状態ごとの件数、重ねられる絞り込み、払い出しの状態・回数・最終日時の列、**まとめて払い出す**、空のときの案内文 | `src/app/admin/feedback/page.tsx`、`src/presentation/admin/feedback-forms.tsx`（`FeedbackHandoffForm`）、`src/application/usecases/feedback/list-feedback.ts` | `/admin/feedback`（「使い勝手を直す」の下） | 左メニュー → 一覧 → 詳細 | 空 / 一覧あり / 絞り込みで 0 件 / 失敗 | 対応（狭い幅では表を積む） | 対応（表の見出しを読み上げられる） | PASS（`tests/ui/page-render.test.tsx`：4状態 + axe、`tests/ui/keyboard-operation.test.tsx`：キーボードだけで通せる。孤立ページ禁止は `tests/presentation/nav-permissions.test.ts`）、`tests/application/feedback.test.ts` | 実装済 |
| REQ-FB08 | 詳細画面 10 区画。「どうなってほしいか」が無いときは**無いと書く**。作業場所・ブランド・サイトも記録。技術情報は件数つきで畳む。状態の切り替え・メモ・扱いの決定（対応しない／重複／廃棄／元に戻す）は**やり直せる**。操作の記録は消さずに積む | `src/app/admin/feedback/[report]/page.tsx`、`src/presentation/admin/feedback-forms.tsx`（`FeedbackStatusForm` / `FeedbackDispositionForm`）、`src/domain/feedback/status.ts` / `disposition.ts` | `/admin/feedback/[report]` | 一覧 → 詳細 → 払い出し | 空欄あり / 通常 / 更新中 / 失敗 / 廃棄済み | 対応 | 対応（畳んだ区画の開閉を読み上げ、件数を文字で持つ） | PASS（`tests/presentation/feedback-actions.test.ts`：決めた扱いが取り消しで戻る・見送りは理由が要る、`tests/ui/feedback-admin-forms.test.tsx`、`tests/ui/page-render.test.tsx`） | 実装済 |
| REQ-FB09 | 作業する側へ渡す方法は 2 つだけ（人が写して渡す／鍵で取りに来る）。**何度渡しても結果が変わらない**ことを画面に書き、渡した記録に「誰が・どの鍵で」を残す | `src/domain/feedback/handoff.ts`、`src/application/usecases/feedback/hand-off-feedback.ts`、`src/app/api/feedback/pending/route.ts`、鍵の判定は `src/presentation/composition.ts` の `resolveIntegrationAccess`（**presentation で infrastructure を読んでよい唯一のファイル**） | 詳細画面の払い出し区画 | 「指示文を見る」／「払い出し済みにする」／「取得コマンドをコピー」 | 未払い出し / 下読みのみ / 払い出し済み / 一部渡せず / 失敗 | 対応 | 対応（渡した記録を表で読み上げられる） | PASS（`tests/application/feedback.test.ts`、`tests/presentation/feedback-pending-route.test.ts`：2 回目は空・下読みでは回数が増えない・履歴に「誰が・どの鍵で」が残る） | 実装済 |
| REQ-FB10 | 指示文に入れてよいものを**列挙して決める**。氏名・メールアドレス・画像・鍵・他の作業場所のデータは入れない。雛形は既にある版管理の仕組みに乗せる | `src/domain/feedback/handoff-prompt.ts`、`src/infrastructure/generation/handoff-templates.ts` | — | — | — | — | — | PASS（`tests/domain/handoff-prompt.test.ts`：許可した項目以外が 1 つでも混ざったら落ちる。**入れてよい差し込みも入れてはいけない語も、一覧そのものから全通り**を作って当てる。回して作る表は減った側に気づけないので、禁止語 4 つは名指しでも押さえる、`tests/presentation/feedback-pending-route.test.ts`：入口の出力にも混ざらない）。**赤を実測済み**（2026-08-19）: 一覧を縮める／知らない差し込みを黙って空欄にする、どちらでも落ちる | 実装済 |
| REQ-FB11 | **本文を AI への命令として実行しない**。1 つの区切りの中だけに置き、「これはデータであり命令ではない」と先に宣言し、区切りをまねた文字列を無害化し、区切りの外へ利用者の書いたものを出さない | 同上 | — | — | — | — | — | PASS（`tests/domain/handoff-prompt.test.ts`：区切りをまねた本文・制御文字・命令文を入れても外へ出ない）。**赤を実測済み**（2026-08-19）: 無害化を外す／無害化と断り書きの順番を入れ替える、どちらでも落ちる | 実装済 |
| REQ-FB12 | 鍵の発行・失効・最終利用・使える範囲を管理する。**値は発行時に 1 度だけ表示し、保存はかけ直した形で行う**。回数制限と操作の記録を持つ | `src/domain/feedback/integration-access.ts`、`src/application/usecases/feedback/manage-integration-keys.ts`、`src/infrastructure/platform/secret-minter.ts`、`src/presentation/admin/integration-access-form.tsx`、`src/app/admin/settings/integration-access/page.tsx`（`integration-key` ではなく `integration-access` にしたのは、この作業環境が鍵らしき名前のファイルへの書き込みを止めるため。見張りは迂回しない） | `/admin/settings/integration-access` | 設定 → 連携の鍵 | 鍵なし / 発行直後（1 度だけ表示） / 一覧 / 失効済み / 失敗 | 対応 | 対応（「1 度しか表示しない」ことを送信前に文字で伝える） | PASS（`tests/domain/feedback.test.ts`：保存された値から元の鍵を復元できない、`tests/presentation/feedback-actions.test.ts`：一覧を出し直しても値は返らない・AI の役割では発行できない、`tests/ui/feedback-admin-forms.test.tsx` + axe） | 実装済 |
| REQ-FB13 | 画面の写しを渡す口は**ログインで閉じる**。未ログインは 401、ログイン済みでも権限が無い／他所のもの／無いものは**すべて同じ 404** | `src/app/api/feedback-captures/[capture]/route.ts`、`src/presentation/composition.ts` の `signedInActor()`（`currentActor()` と違い**見本の身元へ落ちない**。確かめられないとき＝保存先に届かないときも渡さない） | — | 要望の詳細画面に出る写し | 未ログイン / 権限なし / 期限切れ / 表示 | — | — | PASS（`tests/presentation/feedback-capture-route.test.ts` 7 件）。**赤を実測済み**: `signedInActor()` を `currentActor()` に戻すと 2 件が落ちる（401 のはずが 404） | **完了** |

**送信前に「何が一緒に送られるか」を見せる。** 封筒（送信者欄・添付）に氏名・メールアドレス・画像を
入れないことは仕組みで保証できるが、**本文に利用者自身が書いたものは機械的に取り除けない**。
「取り除きました」とは書かない（仕様 §10-1）。取りこぼしたときに誤った安心を与えるためである。

**Beads との二重管理をしない。** 届いた声はこの機能の保存先が持ち、作業単位は Beads が持つ。
1 件の要望が持つ Beads の課題番号は最大 1 つで、**着手・完了の状態は Beads を正とし、要望側へ写さない**（仕様 §12）。

---

## V. 管理画面の UI/UX 全面改善（`feat-uiux-overhaul`）

受入条件 A1〜A10 の正本は `docs/spec/feat-uiux-overhaul/requirements-baseline.md`。
そこでは 10 件それぞれを**観測可能な述語**へ書き下してある。ここはその裏返しで、
述語を確かめているテストを要件番号から引けるようにしたものである。

**A4 だけ test 列の形が違う。** 「新しい配信先の追加が記述の追加だけで済む」は、
できあがったコードを見ても分からない。分かるのは**追加したときの差分**なので、
判定は git の差分のパス集合で行う（`src/app/**` と `src/presentation/ui/**` が 0 行）。
2026-08-22 に Facebook を 1 件足して実際に通してある。

| REQ | 要件 | 実装 | test | 結果 |
| --- | --- | --- | --- | --- |
| REQ-UX01 | A1 各管理画面が単一用途で、1 画面に複数の主要タスクが混在しない | `src/app/admin/**` を用途ごとに分割。業務の状態を変えるフォームは 1 画面 1 つ | PASS（`tests/ui/uiux-screen-single-purpose.test.ts`） | 実装済 |
| REQ-UX02 | A2 管理対象 4 種すべてに一覧・新規作成・編集・削除の操作と対応 API がある | 道具を `src/presentation/tools/catalog.ts` へ足すと REST・WebMCP・MCP の 3 入口へ同時に出る。管理画面用の REST route は書かない（`docs/spec/feat-uiux-overhaul/admin-api-contract.md`） | PASS（`tests/ui/uiux-admin-api-contract.test.ts`） | 実装済 |
| REQ-UX03 | A3 各サイト・SNS への投稿状態が管理画面の一覧・詳細に反映される | `get_content_channel_status` を一覧と詳細の両方が使う | PASS（`tests/ui/uiux-channel-status.test.tsx`） | 実装済 |
| REQ-UX04 | A4 新しい SNS の追加が記述の追加だけで完了し、既存画面の改修を要しない | `src/domain/distribution/channel.ts` の能力表に 1 エントリ、`src/infrastructure/channels/channel-registry.ts` に 1 行 | PASS（`tests/ui/uiux-channel-status.test.tsx` + 実際の追加差分。Facebook で実証） | 実装済 |
| REQ-UX05 | A5 1 商品から複数ブログへコンセプト別の文章を作成する導線が動作する | 切り口はブログの設計図が持つ 10 軸から引く。人が毎回入力しない | PASS（`tests/ui/uiux-concept-matrix.test.tsx`） | 実装済 |
| REQ-UX06 | A6 同等 UI の重複実装が 0 件で、共通部品は共有コンポーネント経由で使われる | `src/presentation/ui/{primitives,patterns,templates}`。同じ役割の要素が 3 つ以上同じ並びで 2 か所に出たら重複と数える | PASS（`tests/ui/uiux-duplicate-implementation.test.ts`） | 実装済 |
| REQ-UX07 | A7 新規ブログ構築時のブログ別コンポーネント作成仕様が文書化され、実際に scaffold できる | 既定では固有ファイルを作らない（データで表現する）。例外の 2 条件を満たすときだけ `pnpm run scaffold:blog`（`scripts/scaffold-blog-components.ts`） | PASS（`tests/ui/uiux-blog-scaffold.test.ts`） | 実装済 |
| REQ-UX08 | A8 カード間隔・文章量・サイドバー構成が規則として文書化され、全画面へ適用されている | 余白は意味の段（`src/presentation/ui/tokens/semantic.css`）だけを読む。導入文 40 字・`Callout` 2 個の上限 | PASS（`tests/ui/uiux-spacing-and-copy.test.ts` / `tests/ui/design-tokens.test.ts`） | 実装済 |
| REQ-UX09 | A9 サイドバーの全項目にアイコンが付き、アイコンで折りたたみ／展開が切り替わり、折りたたみ時もアイコンで項目を識別できる | `ADMIN_NAV` の型が `icon` を必須にする。畳んでも読み上げの名前は消さない | PASS（`tests/ui/uiux-sidebar-icons.test.tsx`） | 実装済 |
| REQ-UX10 | A10 各画面の表示情報がタスク遂行に必要な項目だけに絞られ、不要な文章・説明が非表示になっている | 残す・落とす・畳むの判断は `docs/spec/feat-uiux-overhaul/information-priority-map.json` | PASS（`tests/ui/uiux-spacing-and-copy.test.ts`） | 実装済 |

---

## 集計（2026-08-17 時点）

### 全機能

| 区分 | 件数 |
| --- | --- |
| **全要件数 N** | **240** |
| 実装済・完了 X | 206（実装済 196 + 完了 10） |
| スタブ Y | 33 |
| 未着手 Z | **0** |
| 対象外（意図的） | 1（REQ-CI13） |

**全要件数が 235 から 240 に増えたのは、要件が増えたからではなく、数え落としを直したからである。**
内訳は、区分の言葉に当たらず落ちていた REQ-CI13 が 1 件と、
その後に足した行が 4 件（数え上げのコマンド自体を更新していなかった）。
数字を良く見せる向きの修正ではない（スタブは 34 → 33 に減ったが、
これも実測の結果であって、書き換えて減らしたものではない）。

**未着手は 0 になった。** 最後まで残っていた T 節（改善要望フィードバック）12 件は、
送る口・一覧・詳細・払い出し・取りに来る入口・鍵の管理まで作り、
走らせたテストの名前を各行の `test` 欄に書いてある。
**先回りで「実装済」と書かない。** 走らせた結果が出た行だけを書き換える。

**残る要件スタブ 33 件は「作っていない」ではなく「本物の保存先につないでいない」である。**
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
**記事の本文（`published_articles`）も 2026-08-17 につないだ**（マイグレーション 0011）。
このときも順番は同じで、**入れる口を先に作ってから**保存先を本物にした。
入れる口は配信の画面の「いまサイトに出す」で、
`application/usecases/site/publish-article.ts` を画面・REST・MCP の 3 経路が同じように呼ぶ。

**`own_site` のコネクタは本実装にしなかった。** コネクタの口
（`publish` / `unpublish`）は「外部サービスへ投げて相手先の ID を受け取る」形で、
自分のブログへ出すときの判定（書き手・広告表記・次に見直す日・根拠）を載せると
**判定が infrastructure に降りる**。降ろすと画面と AI で別の判定が育つ。
コネクタは予約投稿と取り下げのために据え置き、台帳の解除条件をその内容に直した。

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
grep -E '^\| REQ-' $T | grep -cE '\| \**実装済'            # → 196
grep -E '^\| REQ-' $T | grep -cE '\| \**完了'              # → 10
grep -E '^\| REQ-' $T | grep -cE '\| \**スタブ'            # → 33
grep -E '^\| REQ-' $T | grep -cE '\| \**未着手'            # → 0
grep -E '^\| REQ-' $T | grep -cE '\| \**対象外'            # → 1
# 合計（下の「画面を持たないことが正しい行」の表も `| REQ-` で始まるため、
# 単純な行数ではなく結果の欄で分類した 5 つの和を全要件数とする）
grep -E '^\| REQ-' $T | grep -cE '\| \**(実装済|完了|スタブ|未着手|対象外)'   # → 240
```

**「未着手 0」を名乗る前に、必ずこれも走らせる。**

```bash
# 要件行だけを取り出す（欄が 5 つ以上ある行。下記の 2 つの表は欄が 2〜3 つなので外れる）
grep -E '^\| REQ-' $T | awk -F'|' 'NF-1>=5' | wc -l                              # → 240

# どの区分にも当たらない要件行。**0 でなければ集計は壊れている。**
grep -E '^\| REQ-' $T | awk -F'|' 'NF-1>=5' \
  | grep -vcE '\| \**(実装済|完了|スタブ|未着手|対象外)'                          # → 0
```

欄の数で切っているのは、**表の見出し語で切ると、見出しを書き換えた瞬間に検査が黙る**ためである
（`| REQ-` で始まる行は、要件表のほかに「画面を持たないことが正しい行」の表＝欄 2 つと、
U 節の性質テスト対応表＝欄 3 つにもある）。

この検査を足した理由を書いておく。**区分の言葉を増やしたときに壊れるのは合計ではなく「未着手 0」の意味**である。
実際 2026-08-17 に REQ-CI13 の欄が「一部実装」と書かれており、**どの言葉にも当たらないまま
合計から静かに落ちていた**（全要件が 240 ではなく 239 と表示されていた）。
落ちた行は未着手にも数えられないので、**「未着手 0」は正しいまま、覆えていない要件が 1 件隠れる**。
合計だけを見張っても気づけない（合計もいっしょに 1 減るので、辻褄が合ってしまう）。だから
**どこにも当たらない行を数える検査**を正式な数え上げ手順に含める。

**この検査を「除外を足して 0 にする」ことを禁じる。** 足してよいのは区分の言葉のほうだけで、
その場合は上の数え上げと合計にも同じ言葉を足す。

「実装済」と「完了」を分けているのは、**確かめ方が違う**ためである。
「実装済」は製品の機能が動くこと、「完了」はその機能を確かめる仕組み自体が
**わざと壊して赤くなるところまで**確認できていることを指す（R 節・S 節）。

節ごとの内訳（全要件 / 実装済・完了 / スタブ / 未着手 / 対象外）:

| 節 | 内容 | 全 | 実装済・完了 | スタブ | 未着手 | 対象外 |
| --- | --- | --- | --- | --- | --- | --- |
| A | プラットフォーム層 機能モジュール | 10 | 10 | 0 | 0 | 0 |
| B | プラットフォーム層 主要画面 | 10 | 9 | 1 | 0 | 0 |
| C | ブログ層 情報アーキテクチャ（18ルート） | 18 | 15 | 3 | 0 | 0 |
| D | 記事構成・文章 | 12 | 12 | 0 | 0 | 0 |
| E | 生成基盤 | 11 | 10 | 1 | 0 | 0 |
| F | データモデル（32エンティティ） | 32 | 23 | 9 | 0 | 0 |
| G | API とイベント（イベント16種を1行ずつに分解済み） | 18 | 9 | 9 | 0 | 0 |
| H | WebMCP | 12 | 10 | 2 | 0 | 0 |
| I | バックエンドMCP | 3 | 2 | 1 | 0 | 0 |
| J | 権限（10ロール + 追加1） | 12 | 12 | 0 | 0 | 0 |
| K | セキュリティ・コンプライアンス | 10 | 6 | 4 | 0 | 0 |
| L | 品質検査（QC-01〜QC-17） | 12 | 11 | 1 | 0 | 0 |
| M | 禁止依存 | 6 | 5 | 1 | 0 | 0 |
| N | 受け入れ条件（§30.1〜§30.8） | 8 | 8 | 0 | 0 | 0 |
| O | 見た目の切り替え（配色 × 明暗） | 5 | 5 | 0 | 0 | 0 |
| P | 計測（AI の利用と費用 / 読まれ方 / 同意） | 13 | 13 | 0 | 0 | 0 |
| Q | 改善ループ（測る → 比べる → 直す） | 13 | 12 | 1 | 0 | 0 |
| R | テストの網羅 | 10 | 10 | 0 | 0 | 0 |
| S | 自動チェックと公開 | 13 | 12 | 0 | 0 | 1 |
| T | 改善要望フィードバック | 12 | 12 | 0 | 0 | 0 |
| | **合計** | **240** | **206** | **33** | **0** | **1** |

この表も手で数えない。次の 1 本で作り直せる（上の全体集計と合計が一致することが、表が古びていない証拠になる）。

```bash
awk -F'|' '
/^## [A-U]\. / { split($0,h," "); sec=substr(h[2],1,1) }
/^\| REQ-/ {
  if (NF-1 < 5) next
  tot[sec]++
  if      ($0 ~ /\| \**(実装済|完了)/) ok[sec]++
  else if ($0 ~ /\| \**スタブ/)        st[sec]++
  else if ($0 ~ /\| \**未着手/)        ns[sec]++
  else if ($0 ~ /\| \**対象外/)        ex[sec]++
}
END { for (s in tot) printf "%s\t%d\t%d\t%d\t%d\t%d\n", s, tot[s], ok[s], st[s], ns[s], ex[s] }
' docs/product/traceability.md | sort
```


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
| 保存先 | 9 | D1 への差し替え。見本データと同じ形を返す実装を書けば、画面もドメインも触らずに済む（**計測の記録先・受信箱・改善要望・ブログ設定・配信は接続済み**。残りは記事・商品・順位・報酬・改善ループ・作業場所設定と、クリックの記録） |
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

---

## U. 性質（プロパティ）テストと要件の対応

例で書くテストは、**書いた人が思いついた入力しか試されない**。
ここに挙げた 5 ファイル・48 件は、入力を `fast-check` に作らせて
「どんな入力でも成り立つはず」の側を確かめる（規範は `docs/spec/10-テスト戦略仕様.md` §11）。

| REQ | 何が壊れたら落ちるか | test |
| --- | --- | --- |
| REQ-P02 | URL の正規化と重複判定が、順序・重複適用で結果を変える | `tests/property/normalization.property.test.ts` |
| REQ-P03 | 商品の同一判定（JAN/ASIN/型番）が対称でなくなる | `tests/property/normalization.property.test.ts` |
| REQ-TH01 | 何を渡しても外観が 1 組決まる、が崩れる（色の無い画面が出る） | `tests/property/normalization.property.test.ts` |
| REQ-TH03 | 知らない外観名が素通しされる／本人の選択がブログ既定に負ける | `tests/property/normalization.property.test.ts` |
| REQ-P04 | 重み付き点数の最大・最小と、順位表の最強・最弱がずれる | `tests/property/ranking.property.test.ts` |
| REQ-SEC04 | 報酬の情報が順位付けに混ざる | `tests/property/ranking.property.test.ts` |
| REQ-B12 | 入力の並び順で順位が変わる（並べ替えが安定でない） | `tests/property/ranking.property.test.ts` |
| REQ-QC12 | 公開の門が、必要な条件を 1 つ落としても通る | `tests/property/publish-gate.property.test.ts` |
| REQ-QC09 | 広告表記が空でも公開できてしまう | `tests/property/publish-gate.property.test.ts` |
| REQ-SEC06 | `rel="sponsored"` の付与条件が組合せで抜ける | `tests/property/publish-gate.property.test.ts` |
| REQ-P01 | 別テナントの値が、どこかの経路で混ざる | `tests/property/tenancy.property.test.ts` |
| REQ-API02 | 入口（REST / MCP / WebMCP）ごとにテナント判定がずれる | `tests/property/tenancy.property.test.ts` |
| REQ-R11 | できてはいけない側（権限なし）が通る | `tests/property/tenancy.property.test.ts` |
| REQ-R12 | 役割の組合せで権限判定が反転する | `tests/property/tenancy.property.test.ts` |
| REQ-IM05 | 出し分け指定の書き出しと読み戻しで内容が変わる | `tests/property/variant-spec.property.test.ts` |
| REQ-E14 | 情報源・信頼度・有効期限が往復で欠ける | `tests/property/variant-spec.property.test.ts` |

**この 5 ファイルは実際に不具合を 1 件見つけた。** `normalizeAffiliateUrl` が
組み立て直しで符号化しておらず、`?x=b%26y%3Dz` と `?x=b&y=z` が同じ正規形になっていた。
**別の成果リンクが互いの重複として弾かれる**状態で、
利用者から見ると「貼ったのに受信箱に出てこない」になる（`docs/product/mutation.md` §6）。
最小の反例は `tests/domain/link-ingestion.test.ts` に例として写してある
（性質テストは毎回違う入力を試すので、同じ壊れ方の再現を保証しない）。

### この表と `docs/product/test-traceability.md` の関係

この表は**要件 → テスト**の向きしか持っていない。逆向き（テスト → 要件）は
`node scripts/traceability.mjs` が `@req` 印から作り、`docs/product/test-traceability.md` に出す。
**2026-08-17 の実測で、115 テストファイルのうち 37 件がどちらの向きにも出てこない。**
由来の無いテストは実装をなぞっているだけなので、実装が間違っていても緑になる。
上限は `quality-gates.config.mjs` の `TRACEABILITY_MAX_UNLINKED` に実測値で置いてあり、
**上げて緑にすることを禁じている**（残課題 44 / Beads `ah-8jh`）。
