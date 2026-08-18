# いま何が開いているか（入口の台帳）

このファイルは `tests/architecture/open-doors.test.ts` が作る。手で書き換えない。
更新は `UPDATE_OPEN_DOORS=1 pnpm vitest run tests/architecture/open-doors.test.ts`。

**「本来」は人が宣言した意図、「いま」はコードから測った実測**である。
この 2 つが違う行が、いま誰でも通れてしまう扉。

画面を一括で守る `middleware.ts`: **無い**

開いている扉: **49 件** / 全 79 件

この検査が言えるのは「門を通す形になっている」ところまでで、
「守られている」ではない。門の中身は各入口の単体テストが見る。

## 画面

`middleware.ts` が無いので、管理画面は URL を知っていれば誰でも開ける。
`currentActor()` が身元を解決できないと**見本の身元**へ落ちるため、
画面の中身も空にならず、実在するデータが表示される。

| 入口・操作 | 何ができるか | 本来 | いま | 差 |
|---|---|---|---|---|
| `src/app/admin/affiliate/[conversion]/page.tsx` | 管理画面 | ログイン | 誰でも | **開いている** |
| `src/app/admin/affiliate/page.tsx` | 管理画面 | ログイン | 誰でも | **開いている** |
| `src/app/admin/ai-usage/page.tsx` | 管理画面 | ログイン | 誰でも | **開いている** |
| `src/app/admin/analytics/page.tsx` | 管理画面 | ログイン | 誰でも | **開いている** |
| `src/app/admin/content/[variant]/page.tsx` | 管理画面 | ログイン | 誰でも | **開いている** |
| `src/app/admin/content/matrix/page.tsx` | 管理画面 | ログイン | 誰でも | **開いている** |
| `src/app/admin/content/page.tsx` | 管理画面 | ログイン | 誰でも | **開いている** |
| `src/app/admin/distribution/[publication]/page.tsx` | 管理画面 | ログイン | 誰でも | **開いている** |
| `src/app/admin/distribution/calendar/page.tsx` | 管理画面 | ログイン | 誰でも | **開いている** |
| `src/app/admin/distribution/page.tsx` | 管理画面 | ログイン | 誰でも | **開いている** |
| `src/app/admin/evidence/page.tsx` | 管理画面 | ログイン | 誰でも | **開いている** |
| `src/app/admin/feedback/[report]/page.tsx` | 管理画面 | ログイン | 誰でも | **開いている** |
| `src/app/admin/feedback/page.tsx` | 管理画面 | ログイン | 誰でも | **開いている** |
| `src/app/admin/generation/page.tsx` | 管理画面 | ログイン | 誰でも | **開いている** |
| `src/app/admin/improvement/dimensions/page.tsx` | 管理画面 | ログイン | 誰でも | **開いている** |
| `src/app/admin/improvement/page.tsx` | 管理画面 | ログイン | 誰でも | **開いている** |
| `src/app/admin/inbox/page.tsx` | 管理画面 | ログイン | 誰でも | **開いている** |
| `src/app/admin/page.tsx` | 管理画面 | ログイン | 誰でも | **開いている** |
| `src/app/admin/personas/page.tsx` | 管理画面 | ログイン | 誰でも | **開いている** |
| `src/app/admin/products/[product]/page.tsx` | 管理画面 | ログイン | 誰でも | **開いている** |
| `src/app/admin/products/compare/page.tsx` | 管理画面 | ログイン | 誰でも | **開いている** |
| `src/app/admin/products/page.tsx` | 管理画面 | ログイン | 誰でも | **開いている** |
| `src/app/admin/rankings/page.tsx` | 管理画面 | ログイン | 誰でも | **開いている** |
| `src/app/admin/settings/integration-access/page.tsx` | 管理画面 | ログイン | 誰でも | **開いている** |
| `src/app/admin/settings/llm/page.tsx` | 管理画面 | ログイン | 誰でも | **開いている** |
| `src/app/admin/settings/page.tsx` | 管理画面 | ログイン | 誰でも | **開いている** |
| `src/app/admin/sites/[site]/page.tsx` | 管理画面 | ログイン | 誰でも | **開いている** |
| `src/app/admin/sites/new/page.tsx` | 管理画面 | ログイン | 誰でも | **開いている** |
| `src/app/admin/sites/page.tsx` | 管理画面 | ログイン | 誰でも | **開いている** |
| `src/app/admin/tools/page.tsx` | 管理画面 | ログイン | 誰でも | **開いている** |
| `src/app/admin/ui-catalog/page.tsx` | 管理画面 | ログイン | 誰でも | **開いている** |
| `src/app/admin/writing/page.tsx` | 管理画面 | ログイン | 誰でも | **開いている** |
| `src/app/page.tsx` | 入口の案内 | 誰でも | 誰でも | — |
| `src/app/s/[site]/advertising-policy/page.tsx` | 読者向けの公開ページ | 誰でも | 誰でも | — |
| `src/app/s/[site]/ai-policy/page.tsx` | 読者向けの公開ページ | 誰でも | 誰でも | — |
| `src/app/s/[site]/authors/[author]/page.tsx` | 読者向けの公開ページ | 誰でも | 誰でも | — |
| `src/app/s/[site]/best/[topic]/page.tsx` | 読者向けの公開ページ | 誰でも | 誰でも | — |
| `src/app/s/[site]/categories/[category]/page.tsx` | 読者向けの公開ページ | 誰でも | 誰でも | — |
| `src/app/s/[site]/compare/[comparison]/page.tsx` | 読者向けの公開ページ | 誰でも | 誰でも | — |
| `src/app/s/[site]/contact/page.tsx` | 読者向けの公開ページ | 誰でも | 誰でも | — |
| `src/app/s/[site]/corrections/page.tsx` | 読者向けの公開ページ | 誰でも | 誰でも | — |
| `src/app/s/[site]/editorial-policy/page.tsx` | 読者向けの公開ページ | 誰でも | 誰でも | — |
| `src/app/s/[site]/experts/[expert]/page.tsx` | 読者向けの公開ページ | 誰でも | 誰でも | — |
| `src/app/s/[site]/guides/[topic]/page.tsx` | 読者向けの公開ページ | 誰でも | 誰でも | — |
| `src/app/s/[site]/measurement/page.tsx` | 読者向けの公開ページ | 誰でも | 誰でも | — |
| `src/app/s/[site]/methodology/page.tsx` | 読者向けの公開ページ | 誰でも | 誰でも | — |
| `src/app/s/[site]/page.tsx` | 読者向けの公開ページ | 誰でも | 誰でも | — |
| `src/app/s/[site]/privacy/page.tsx` | 読者向けの公開ページ | 誰でも | 誰でも | — |
| `src/app/s/[site]/reviews/[product]/page.tsx` | 読者向けの公開ページ | 誰でも | 誰でも | — |
| `src/app/s/[site]/search/page.tsx` | 読者向けの公開ページ | 誰でも | 誰でも | — |
| `src/app/s/[site]/shortlist/page.tsx` | 読者向けの公開ページ | 誰でも | 誰でも | — |
| `src/app/s/[site]/terms/page.tsx` | 読者向けの公開ページ | 誰でも | 誰でも | — |
| `src/app/s/[site]/tools/[tool]/page.tsx` | 読者向けの公開ページ | 誰でも | 誰でも | — |
| `src/app/signin/page.tsx` | サインイン画面 | 誰でも | 誰でも | — |

## REST・転送

| 入口・操作 | 何ができるか | 本来 | いま | 差 |
|---|---|---|---|---|
| `src/app/api/feedback-captures/[capture]/route.ts` | 指摘に添えた画面の写しの取り出し | ログイン | ログイン | — |
| `src/app/api/feedback/pending/route.ts` | 未処理の指摘の取り出し | 鍵 | 鍵 | — |
| `src/app/api/mcp/route.ts` | 操作の実行（MCP） | 鍵 | 鍵 | — |
| `src/app/api/telemetry/route.ts` | 読者の画面から届く計測（未ログインの読者が送るので、門は置けない） | 誰でも | 誰でも | — |
| `src/app/api/tools/[tool]/route.ts` | 操作の実行（REST） | 鍵 | 鍵 | — |
| `src/app/api/tools/route.ts` | 使える操作の一覧（REST） | 鍵 | 鍵 | — |
| `src/app/go/[code]/route.ts` | 成果リンクの転送（読者がクリックする先） | 誰でも | 誰でも | — |

## 変更を起こす操作（`"use server"`）

画面を開けた人は、この操作をそのまま実行できる。
**公開だけは通らない**（見本の身元に `publisher` と `owner` の役が無いため）。

| 入口・操作 | 何ができるか | 本来 | いま | 差 |
|---|---|---|---|---|
| `adjustConversionAction()` | 成果の実績を手で直す（src/presentation/admin/adjust-conversion-action.ts） | ログイン | 誰でも | **開いている** |
| `advanceContentStateAction()` | 記事の作業段階を進める（src/presentation/admin/content-progress-action.ts） | ログイン | 誰でも | **開いている** |
| `advanceLinkIngestionAction()` | 成果リンクの取り込みを進める（src/presentation/admin/inbox-action.ts） | ログイン | 誰でも | **開いている** |
| `approveContentAction()` | 記事を承認する（src/presentation/admin/content-progress-action.ts） | ログイン | 誰でも | **開いている** |
| `changeFeedbackStatusAction()` | 指摘の状態を変える（src/presentation/admin/feedback-action.ts） | ログイン | 誰でも | **開いている** |
| `checkFactBoundaryAction()` | 書ける範囲の判定を試す（src/presentation/admin/fact-boundary-action.ts） | ログイン | 誰でも | **開いている** |
| `createSiteFromDraftAction()` | 下書きからサイトを作る（src/presentation/admin/site-wizard-action.ts） | ログイン | 誰でも | **開いている** |
| `handOffFeedbackAction()` | 指摘を引き継ぐ（src/presentation/admin/feedback-action.ts） | ログイン | 誰でも | **開いている** |
| `manageIntegrationAccessAction()` | 外部連携の鍵を作る・消す（src/presentation/admin/feedback-action.ts） | ログイン | 誰でも | **開いている** |
| `manageLlmCredentialAction()` | 生成 AI の API キーを預ける・消す（src/presentation/admin/llm-credential-action.ts） | ログイン | 誰でも | **開いている** |
| `publishArticleAction()` | 記事を公開する（src/presentation/admin/publish-article-action.ts） | ログイン | 誰でも | **開いている** |
| `reschedulePublicationAction()` | 投稿予定日を変える（src/presentation/admin/reschedule-action.ts） | ログイン | 誰でも | **開いている** |
| `saveSiteDraftStepAction()` | サイトの下書きを保存する（src/presentation/admin/site-wizard-action.ts） | ログイン | 誰でも | **開いている** |
| `schedulePublicationAction()` | 投稿を予定に入れる（src/presentation/admin/schedule-publication-action.ts） | ログイン | 誰でも | **開いている** |
| `startSiteDraftAction()` | サイトの下書きを始める（src/presentation/admin/site-wizard-action.ts） | ログイン | 誰でも | **開いている** |
| `submitAffiliateUrlAction()` | 成果リンクを登録する（src/presentation/admin/inbox-action.ts） | ログイン | 誰でも | **開いている** |
| `submitContactAction()` | 読者からの問い合わせ（公開フォーム）（src/presentation/site/contact-action.ts） | 誰でも | 誰でも | — |
| `submitFeedbackAction()` | 指摘を登録する（src/presentation/admin/feedback-action.ts） | ログイン | 誰でも | **開いている** |
