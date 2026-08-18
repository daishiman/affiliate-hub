# いま何が開いているか（入口の台帳）

このファイルは `tests/architecture/open-doors.test.ts` が作る。手で書き換えない。
更新は `UPDATE_OPEN_DOORS=1 pnpm vitest run tests/architecture/open-doors.test.ts`。

**「本来」は人が宣言した意図、「いま」はコードから測った実測**である。
この 2 つが違う行が、いま誰でも通れてしまう扉。

画面を一括で守る門: **ある（`src/middleware.ts`）**

適用範囲: `/admin` 以下（読者のページとログインの往復は通す）

開いている扉: **17 件** / 全 80 件

「誰でも」と宣言してある行: **26 件**
（宣言すればその扉は差の数から消える。だから宣言の件数そのものにも上限がある）

- `src/app/page.tsx` — 入口の案内
- `src/app/s/[site]/advertising-policy/page.tsx` — 読者向けの公開ページ
- `src/app/s/[site]/ai-policy/page.tsx` — 読者向けの公開ページ
- `src/app/s/[site]/authors/[author]/page.tsx` — 読者向けの公開ページ
- `src/app/s/[site]/best/[topic]/page.tsx` — 読者向けの公開ページ
- `src/app/s/[site]/categories/[category]/page.tsx` — 読者向けの公開ページ
- `src/app/s/[site]/compare/[comparison]/page.tsx` — 読者向けの公開ページ
- `src/app/s/[site]/contact/page.tsx` — 読者向けの公開ページ
- `src/app/s/[site]/corrections/page.tsx` — 読者向けの公開ページ
- `src/app/s/[site]/editorial-policy/page.tsx` — 読者向けの公開ページ
- `src/app/s/[site]/experts/[expert]/page.tsx` — 読者向けの公開ページ
- `src/app/s/[site]/guides/[topic]/page.tsx` — 読者向けの公開ページ
- `src/app/s/[site]/measurement/page.tsx` — 読者向けの公開ページ
- `src/app/s/[site]/methodology/page.tsx` — 読者向けの公開ページ
- `src/app/s/[site]/page.tsx` — 読者向けの公開ページ
- `src/app/s/[site]/privacy/page.tsx` — 読者向けの公開ページ
- `src/app/s/[site]/reviews/[product]/page.tsx` — 読者向けの公開ページ
- `src/app/s/[site]/search/page.tsx` — 読者向けの公開ページ
- `src/app/s/[site]/shortlist/page.tsx` — 読者向けの公開ページ
- `src/app/s/[site]/terms/page.tsx` — 読者向けの公開ページ
- `src/app/s/[site]/tools/[tool]/page.tsx` — 読者向けの公開ページ
- `src/app/signin/page.tsx` — サインイン画面
- `src/app/api/auth/[...all]/route.ts` — ログインの入口（Google との往復）
- `src/app/api/telemetry/route.ts` — 読者の画面から届く計測（未ログインの読者が送るので、門は置けない）
- `src/app/go/[code]/route.ts` — 成果リンクの転送（読者がクリックする先）
- `submitContactAction()` — 読者からの問い合わせ（公開フォーム）（src/presentation/site/contact-action.ts）

うち、**誰でも実行できて取り返しがつかない操作: 6 件**
（公開・配信・鍵の失効・削除。塞ぐ順を決めるときはここから読む）

- `createSiteFromDraftAction()` — 下書きからサイトを作る（消す口が無い）（src/presentation/admin/site-wizard-action.ts）
- `manageIntegrationAccessAction()` — 外部連携の鍵を作る・失効させる（src/presentation/admin/feedback-action.ts）
- `manageLlmCredentialAction()` — 生成 AI の API キーを預ける・消す（預けた鍵で課金が発生する）（src/presentation/admin/llm-credential-action.ts）
- `publishArticleAction()` — 記事を公開する（src/presentation/admin/publish-article-action.ts）
- `reschedulePublicationAction()` — 投稿予定日を変える（前倒しにすれば今日出せる）（src/presentation/admin/reschedule-action.ts）
- `schedulePublicationAction()` — 投稿を予定に入れる（時刻が来たら外へ出る）（src/presentation/admin/schedule-publication-action.ts）

## この数字の読み方

**この 17 件は「攻撃された」ではなく「守りが無い」である。**

危険の度合いは **「守りが無い」×「誰かが URL を知っている」** で決まる。
いまこのアプリは本番で公開されておらず、URL を知っている人もいない。
後者がまだ 0 に近いから、順番を組んで直せている。
ここを読み違えると、一番大きい穴だけ慌てて塞いで、残りを忘れる。

**逆に、本番へ公開する前にこの数字が 0 でなければ公開してはいけない。**
公開の判断をする日にこの台帳を見る理由が、この 1 行である。
その同じ回に `node scripts/llm-live-proof.mjs --stage P --check` も通す
（自動の検査からは呼べないものなので、見る場面を人の手順として決めてある。
決めた 2 つの場面は `docs/product/stub-ledger.md` に書いた）。

**同じ回に、深い門（3 段）も 1 回打つ。** GitHub の Actions で「深い門」を選び
`Run workflow`。2026-08-18 に定例（毎晩の自動実行）を廃止したので、
**打たなければ一度も走らない**。公開の判断に要るものを 1 回で揃えるため、
この台帳を見る回に含める。日を分けると「今日はどれを見る日か」を
覚えている人が要ることになり、覚えている人が居なくなった日に静かに抜ける。
打つ場面の全部は `docs/spec/11-CI-CD・品質ゲート仕様.md` §8-2。

**2026-08-18 に、画面の入口へ門を置いた（`src/middleware.ts`）。**
見るのは「ログインしているか」だけで、役は見ない。通行証が無い・偽物・
期限切れ・**保存先へ届かず確かめられない**のいずれでもログイン画面へ戻す。
これで管理画面 32 枚が数から外れた。

**ただし、変更を起こす操作はまだこの数に残っている。**
操作は独立した URL を持たず、それを使っている画面への POST として届くので、
実際には門の内側にある。しかし**どの操作がどの画面から呼ばれるか**は
この検査では測れない。測れないものを「守られている」と書かない方に倒してある。
操作の側が数から外れるのは、各操作が `signedInActor()` を使った日である。

**2026-08-18 に、見本の身元から書き込みの役をすべて外した。**
それまで「公開だけは通らない」と書いていたが、それは門が止めていたのではなく、
見本に `publisher` と `owner` が無かっただけで、**役を 1 つ足した日に**
**黙って通るようになる**状態だった。いま見本が持つのは `analyst`（読むだけ）で、
記事の承認も、鍵の発行も、下書きの保存も通らない。
**ここへ役を 1 つ足すと、その瞬間に「誰でもできること」が増える。**

この検査が言えるのは「門を通す形になっている」ところまでで、
「守られている」ではない。門の中身は各入口の単体テストが見る
（入口の門は `tests/infrastructure/entry-gate.test.ts`）。

## 画面

`/admin` 以下は門の内側にあり、通行証が無ければログイン画面へ戻る。
門の外（読者のページ・ログイン画面）は誰でも開けるが、そこは意図どおりである。

| 入口・操作 | 何ができるか | 本来 | いま | 差 |
|---|---|---|---|---|
| `src/app/admin/affiliate/[conversion]/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/affiliate/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/ai-usage/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/analytics/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/content/[variant]/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/content/matrix/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/content/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/distribution/[publication]/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/distribution/calendar/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/distribution/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/evidence/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/feedback/[report]/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/feedback/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/generation/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/improvement/dimensions/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/improvement/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/inbox/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/personas/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/products/[product]/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/products/compare/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/products/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/rankings/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/settings/integration-access/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/settings/llm/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/settings/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/sites/[site]/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/sites/new/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/sites/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/tools/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/ui-catalog/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/writing/page.tsx` | 管理画面 | ログイン | ログイン | — |
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
| `src/app/api/auth/[...all]/route.ts` | ログインの入口（Google との往復） | 誰でも | 誰でも | — |
| `src/app/api/feedback-captures/[capture]/route.ts` | 指摘に添えた画面の写しの取り出し | ログイン | ログイン | — |
| `src/app/api/feedback/pending/route.ts` | 未処理の指摘の取り出し | 鍵 | 鍵 | — |
| `src/app/api/mcp/route.ts` | 操作の実行（MCP） | 鍵 | 鍵 | — |
| `src/app/api/telemetry/route.ts` | 読者の画面から届く計測（未ログインの読者が送るので、門は置けない） | 誰でも | 誰でも | — |
| `src/app/api/tools/[tool]/route.ts` | 操作の実行（REST） | 鍵 | 鍵 | — |
| `src/app/api/tools/route.ts` | 使える操作の一覧（REST） | 鍵 | 鍵 | — |
| `src/app/go/[code]/route.ts` | 成果リンクの転送（読者がクリックする先） | 誰でも | 誰でも | — |

## 変更を起こす操作（`"use server"`）

操作は独立した URL を持たず、それを使っている画面への POST として届く。
管理画面の操作は門の内側にあるが、**その対応はこの検査では測れない**ので、
ここでは守られていない側に数えてある（実際より危ない方に倒してある）。
そこから先は権限で断られる。2026-08-18 に見本の身元を `analyst`（読むだけ）に
したので、いまはここに並ぶ操作のうち書き込むものは通らない。
**これは操作の側に門ができたということではない。** 見本へ役を 1 つ足せば元へ戻る。
操作の側が数から外れるのは、各操作が `signedInActor()` を使った日である。

「取り返し」の物差しは公開・配信・失効・削除。外の世界（読者・ASP・提供元）へ
出てしまうもの、消えて元に戻せないものを「つかない」とする。**迷ったら「つかない」に倒す。**
取り返しがつかない操作を先に頭出しにしてある。

| 入口・操作 | 何ができるか | 本来 | いま | 差 | 取り返し |
|---|---|---|---|---|---|
| `createSiteFromDraftAction()` | 下書きからサイトを作る（消す口が無い）（src/presentation/admin/site-wizard-action.ts） | ログイン | 誰でも | **開いている** | **つかない** |
| `manageIntegrationAccessAction()` | 外部連携の鍵を作る・失効させる（src/presentation/admin/feedback-action.ts） | ログイン | 誰でも | **開いている** | **つかない** |
| `manageLlmCredentialAction()` | 生成 AI の API キーを預ける・消す（預けた鍵で課金が発生する）（src/presentation/admin/llm-credential-action.ts） | ログイン | 誰でも | **開いている** | **つかない** |
| `publishArticleAction()` | 記事を公開する（src/presentation/admin/publish-article-action.ts） | ログイン | 誰でも | **開いている** | **つかない** |
| `reschedulePublicationAction()` | 投稿予定日を変える（前倒しにすれば今日出せる）（src/presentation/admin/reschedule-action.ts） | ログイン | 誰でも | **開いている** | **つかない** |
| `schedulePublicationAction()` | 投稿を予定に入れる（時刻が来たら外へ出る）（src/presentation/admin/schedule-publication-action.ts） | ログイン | 誰でも | **開いている** | **つかない** |
| `adjustConversionAction()` | 成果の実績を手で直す（src/presentation/admin/adjust-conversion-action.ts） | ログイン | 誰でも | **開いている** | つく |
| `advanceContentStateAction()` | 記事の作業段階を進める（src/presentation/admin/content-progress-action.ts） | ログイン | 誰でも | **開いている** | つく |
| `advanceLinkIngestionAction()` | 成果リンクの取り込みを進める（src/presentation/admin/inbox-action.ts） | ログイン | 誰でも | **開いている** | つく |
| `approveContentAction()` | 記事を承認する（src/presentation/admin/content-progress-action.ts） | ログイン | 誰でも | **開いている** | つく |
| `changeFeedbackStatusAction()` | 指摘の状態を変える（src/presentation/admin/feedback-action.ts） | ログイン | 誰でも | **開いている** | つく |
| `checkFactBoundaryAction()` | 書ける範囲の判定を試す（src/presentation/admin/fact-boundary-action.ts） | ログイン | 誰でも | **開いている** | つく |
| `handOffFeedbackAction()` | 指摘を引き継ぐ（src/presentation/admin/feedback-action.ts） | ログイン | 誰でも | **開いている** | つく |
| `saveSiteDraftStepAction()` | サイトの下書きを保存する（src/presentation/admin/site-wizard-action.ts） | ログイン | 誰でも | **開いている** | つく |
| `startSiteDraftAction()` | サイトの下書きを始める（src/presentation/admin/site-wizard-action.ts） | ログイン | 誰でも | **開いている** | つく |
| `submitAffiliateUrlAction()` | 成果リンクを登録する（src/presentation/admin/inbox-action.ts） | ログイン | 誰でも | **開いている** | つく |
| `submitContactAction()` | 読者からの問い合わせ（公開フォーム）（src/presentation/site/contact-action.ts） | 誰でも | 誰でも | — | つく |
| `submitFeedbackAction()` | 指摘を登録する（src/presentation/admin/feedback-action.ts） | ログイン | 誰でも | **開いている** | つく |
