# いま何が開いているか（入口の台帳）

このファイルは `tests/architecture/open-doors.test.ts` が作る。手で書き換えない。
更新は `UPDATE_OPEN_DOORS=1 pnpm vitest run tests/architecture/open-doors.test.ts`。
末尾の指紋がその見張りで、手で 1 文字でも書くと、内容が合っていてもテストが赤くなる。

**「本来」は人が宣言した意図、「いま」はコードから測った実測**である。
この 2 つが違う行が、いま誰でも通れてしまう扉。

画面を一括で守る門: **ある（`src/middleware.ts`）**

適用範囲: `/admin` 以下（読者のページとログインの往復は通す）

開いている扉: **0 件** / 全 208 件

「誰でも」と宣言してある行: **41 件**
（宣言すればその扉は差の数から消える。だから宣言の件数そのものにも上限がある）

- `src/app/page.tsx` — 入口の案内
- `src/app/s/[site]/[fixedPage]/page.tsx` — 読者向けの公開ページ
- `src/app/s/[site]/advertising-policy/page.tsx` — 読者向けの公開ページ
- `src/app/s/[site]/ai-policy/page.tsx` — 読者向けの公開ページ
- `src/app/s/[site]/authors/[author]/page.tsx` — 読者向けの公開ページ
- `src/app/s/[site]/best/[topic]/page.tsx` — 読者向けの公開ページ
- `src/app/s/[site]/blog/[article]/page.tsx` — 読者向けの公開ページ
- `src/app/s/[site]/blog/page.tsx` — 読者向けの公開ページ
- `src/app/s/[site]/categories/[category]/page.tsx` — 読者向けの公開ページ
- `src/app/s/[site]/compare/[comparison]/page.tsx` — 読者向けの公開ページ
- `src/app/s/[site]/contact/page.tsx` — 読者向けの公開ページ
- `src/app/s/[site]/corrections/page.tsx` — 読者向けの公開ページ
- `src/app/s/[site]/editorial-policy/page.tsx` — 読者向けの公開ページ
- `src/app/s/[site]/experts/[expert]/page.tsx` — 読者向けの公開ページ
- `src/app/s/[site]/guides/[topic]/page.tsx` — 読者向けの公開ページ
- `src/app/s/[site]/measurement/page.tsx` — 読者向けの公開ページ
- `src/app/s/[site]/methodology/page.tsx` — 読者向けの公開ページ
- `src/app/s/[site]/operator/page.tsx` — 読者向けの公開ページ
- `src/app/s/[site]/page.tsx` — 読者向けの公開ページ
- `src/app/s/[site]/privacy/page.tsx` — 読者向けの公開ページ
- `src/app/s/[site]/reviews/[product]/page.tsx` — 読者向けの公開ページ
- `src/app/s/[site]/search/page.tsx` — 読者向けの公開ページ
- `src/app/s/[site]/shortlist/page.tsx` — 読者向けの公開ページ
- `src/app/s/[site]/terms/page.tsx` — 読者向けの公開ページ
- `src/app/s/[site]/tokushoho/page.tsx` — 読者向けの公開ページ
- `src/app/s/[site]/tools/[tool]/page.tsx` — 読者向けの公開ページ
- `src/app/signin/page.tsx` — サインイン画面
- `src/app/api/auth/[...all]/route.ts` — ログインの入口（Google との往復）
- `src/app/api/dev-signin/route.ts` — 手元で画面を確かめるための入口（積んだ環境には存在しない）
- `src/app/api/reader-events/route.ts` — 公開ブログの読者行動の記録（未ログインの読者が送るので、門は置けない）
- `src/app/api/telemetry/route.ts` — 読者の画面から届く計測（未ログインの読者が送るので、門は置けない）
- `src/app/go/[code]/route.ts` — 成果リンクの転送（読者がクリックする先）
- `src/app/indexnow.txt/route.ts` — IndexNow 鍵ファイル（公開配信が所有権証明の仕組みそのもの。鍵未設定なら 404）
- `src/app/s/[site]/feed.xml/route.ts` — RSS（新着記事の配信）
- `src/app/s/[site]/llms.txt/route.ts` — llms.txt（AI 向けサイト要約。設計図の任意項目で出し分け）
- `src/app/s/[site]/robots.txt/route.ts` — クローラー方針（AI クローラーを明示許可し sitemap の場所を知らせる）
- `src/app/s/[site]/sitemap.xml/route.ts` — サイトマップ（公開記事の一覧を検索エンジン・AI へ配る）
- `removeFromShortlistAction()` — 読者が自分の「気になる商品」から 1 件外す（src/presentation/site/shortlist-action.ts）
- `saveToShortlistAction()` — 読者が自分の「気になる商品」へ 1 件保存する（src/presentation/site/shortlist-action.ts）
- `submitContactAction()` — 読者からの問い合わせ（公開フォーム）（src/presentation/site/contact-action.ts）
- `submitReaderRatingAction()` — 記事に点を付ける（公開フォーム。押し直すと上書きされる）（src/presentation/site/reader-rating-action.ts）

うち、**誰でも実行できて取り返しがつかない操作: 0 件**
（公開・配信・鍵の失効・削除。塞ぐ順を決めるときはここから読む）


## この数字の読み方

**この 0 件は「攻撃された」ではなく「守りが無い」である。**

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
**2026-08-19 に、改善ループの 4 操作がそれを使った。**ここが最初の 4 件で、
残りは同じ形へ直せば同じように外れる（上限は下げる方向にだけ動かす）。

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
| `src/app/admin/affiliate/accounts/new/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/affiliate/links/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/affiliate/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/affiliate/programs/new/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/ai-usage/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/analytics/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/blog/articles/[article]/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/blog/articles/deleted/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/blog/articles/new/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/blog/articles/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/blog/delivery/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/blog/evaluate/[article]/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/blog/evaluate/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/blog/layout/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/blog/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/blog/pages/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/blog/tags/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/contact/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/content/[variant]/edit/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/content/[variant]/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/content/[variant]/progress/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/content/matrix/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/content/new/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/content/packages/new/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/content/packages/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/content/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/content/published/[site]/[slug]/edit/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/content/published/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/distribution/[publication]/edit/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/distribution/[publication]/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/distribution/calendar/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/distribution/new/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/distribution/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/evidence/claims/new/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/evidence/new/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/evidence/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/evidence/test-runs/new/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/feedback/[report]/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/feedback/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/generation/inputs/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/generation/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/generation/prompt/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/improvement/dimensions/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/improvement/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/inbox/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/personas/audiences/new/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/personas/audiences/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/personas/new/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/personas/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/products/[product]/edit/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/products/[product]/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/products/compare/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/products/new/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/products/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/rankings/criteria/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/rankings/models/new/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/rankings/models/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/rankings/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/rankings/scores/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/settings/appearance/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/settings/audit/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/settings/brands/[brand]/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/settings/brands/new/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/settings/compliance/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/settings/integration-access/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/settings/llm/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/settings/members/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/settings/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/settings/roles/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/settings/seo/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/settings/workspaces/edit/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/settings/workspaces/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/site-network/[node]/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/site-network/deleted/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/site-network/new/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/site-network/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/sites/[site]/aeo/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/sites/[site]/appearance/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/sites/[site]/audience/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/sites/[site]/documents/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/sites/[site]/domains/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/sites/[site]/edit/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/sites/[site]/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/sites/[site]/placements/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/sites/[site]/revenue/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/sites/[site]/seo/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/sites/new/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/sites/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/tools/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/ui-catalog/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/admin/writing/page.tsx` | 管理画面 | ログイン | ログイン | — |
| `src/app/page.tsx` | 入口の案内 | 誰でも | 誰でも | — |
| `src/app/s/[site]/[fixedPage]/page.tsx` | 読者向けの公開ページ | 誰でも | 誰でも | — |
| `src/app/s/[site]/advertising-policy/page.tsx` | 読者向けの公開ページ | 誰でも | 誰でも | — |
| `src/app/s/[site]/ai-policy/page.tsx` | 読者向けの公開ページ | 誰でも | 誰でも | — |
| `src/app/s/[site]/authors/[author]/page.tsx` | 読者向けの公開ページ | 誰でも | 誰でも | — |
| `src/app/s/[site]/best/[topic]/page.tsx` | 読者向けの公開ページ | 誰でも | 誰でも | — |
| `src/app/s/[site]/blog/[article]/page.tsx` | 読者向けの公開ページ | 誰でも | 誰でも | — |
| `src/app/s/[site]/blog/page.tsx` | 読者向けの公開ページ | 誰でも | 誰でも | — |
| `src/app/s/[site]/categories/[category]/page.tsx` | 読者向けの公開ページ | 誰でも | 誰でも | — |
| `src/app/s/[site]/compare/[comparison]/page.tsx` | 読者向けの公開ページ | 誰でも | 誰でも | — |
| `src/app/s/[site]/contact/page.tsx` | 読者向けの公開ページ | 誰でも | 誰でも | — |
| `src/app/s/[site]/corrections/page.tsx` | 読者向けの公開ページ | 誰でも | 誰でも | — |
| `src/app/s/[site]/editorial-policy/page.tsx` | 読者向けの公開ページ | 誰でも | 誰でも | — |
| `src/app/s/[site]/experts/[expert]/page.tsx` | 読者向けの公開ページ | 誰でも | 誰でも | — |
| `src/app/s/[site]/guides/[topic]/page.tsx` | 読者向けの公開ページ | 誰でも | 誰でも | — |
| `src/app/s/[site]/measurement/page.tsx` | 読者向けの公開ページ | 誰でも | 誰でも | — |
| `src/app/s/[site]/methodology/page.tsx` | 読者向けの公開ページ | 誰でも | 誰でも | — |
| `src/app/s/[site]/operator/page.tsx` | 読者向けの公開ページ | 誰でも | 誰でも | — |
| `src/app/s/[site]/page.tsx` | 読者向けの公開ページ | 誰でも | 誰でも | — |
| `src/app/s/[site]/privacy/page.tsx` | 読者向けの公開ページ | 誰でも | 誰でも | — |
| `src/app/s/[site]/reviews/[product]/page.tsx` | 読者向けの公開ページ | 誰でも | 誰でも | — |
| `src/app/s/[site]/search/page.tsx` | 読者向けの公開ページ | 誰でも | 誰でも | — |
| `src/app/s/[site]/shortlist/page.tsx` | 読者向けの公開ページ | 誰でも | 誰でも | — |
| `src/app/s/[site]/terms/page.tsx` | 読者向けの公開ページ | 誰でも | 誰でも | — |
| `src/app/s/[site]/tokushoho/page.tsx` | 読者向けの公開ページ | 誰でも | 誰でも | — |
| `src/app/s/[site]/tools/[tool]/page.tsx` | 読者向けの公開ページ | 誰でも | 誰でも | — |
| `src/app/signin/page.tsx` | サインイン画面 | 誰でも | 誰でも | — |

## REST・転送

| 入口・操作 | 何ができるか | 本来 | いま | 差 |
|---|---|---|---|---|
| `src/app/api/auth/[...all]/route.ts` | ログインの入口（Google との往復） | 誰でも | 誰でも | — |
| `src/app/api/dev-signin/route.ts` | 手元で画面を確かめるための入口（積んだ環境には存在しない） | 誰でも | 誰でも | — |
| `src/app/api/feedback-captures/[capture]/route.ts` | 指摘に添えた画面の写しの取り出し | ログイン | ログイン | — |
| `src/app/api/feedback/pending/route.ts` | 未処理の指摘の取り出し | 鍵 | 鍵 | — |
| `src/app/api/mcp/route.ts` | 操作の実行（MCP） | 鍵 | 鍵 | — |
| `src/app/api/reader-events/route.ts` | 公開ブログの読者行動の記録（未ログインの読者が送るので、門は置けない） | 誰でも | 誰でも | — |
| `src/app/api/telemetry/route.ts` | 読者の画面から届く計測（未ログインの読者が送るので、門は置けない） | 誰でも | 誰でも | — |
| `src/app/api/tools/[tool]/route.ts` | 操作の実行（REST） | 鍵 | 鍵 | — |
| `src/app/api/tools/route.ts` | 使える操作の一覧（REST） | 鍵 | 鍵 | — |
| `src/app/indexnow.txt/route.ts` | IndexNow 鍵ファイル（公開配信が所有権証明の仕組みそのもの。鍵未設定なら 404） | 誰でも | 誰でも | — |
| `src/app/s/[site]/feed.xml/route.ts` | RSS（新着記事の配信） | 誰でも | 誰でも | — |
| `src/app/s/[site]/llms.txt/route.ts` | llms.txt（AI 向けサイト要約。設計図の任意項目で出し分け） | 誰でも | 誰でも | — |
| `src/app/s/[site]/robots.txt/route.ts` | クローラー方針（AI クローラーを明示許可し sitemap の場所を知らせる） | 誰でも | 誰でも | — |
| `src/app/s/[site]/sitemap.xml/route.ts` | サイトマップ（公開記事の一覧を検索エンジン・AI へ配る） | 誰でも | 誰でも | — |
| `src/app/go/[code]/route.ts` | 成果リンクの転送（読者がクリックする先） | 誰でも | 誰でも | — |

## 変更を起こす操作（`"use server"`）

操作は独立した URL を持たず、それを使っている画面への POST として届く。
管理画面の操作は門の内側にあるが、**その対応はこの検査では測れない**ので、
ここでは守られていない側に数えてある（実際より危ない方に倒してある）。
そこから先は権限で断られる。2026-08-18 に見本の身元を `analyst`（読むだけ）に
したので、いまはここに並ぶ操作のうち書き込むものは通らない。
**これは操作の側に門ができたということではない。** 見本へ役を 1 つ足せば元へ戻る。
操作の側が数から外れるのは、各操作が `signedInActor()` を使った日である。
**2026-08-19 に、改善ループの 4 操作がそれを使った。**ここが最初の 4 件で、
残りは同じ形へ直せば同じように外れる（上限は下げる方向にだけ動かす）。

「取り返し」の物差しは公開・配信・失効・削除。外の世界（読者・ASP・提供元）へ
出てしまうもの、消えて元に戻せないものを「つかない」とする。**迷ったら「つかない」に倒す。**
取り返しがつかない操作を先に頭出しにしてある。

| 入口・操作 | 何ができるか | 本来 | いま | 差 | 取り返し |
|---|---|---|---|---|---|
| `advanceLoopRunAction()` | 比較に観測値を書く・判定する・打ち切る（判定は採用した見せ方を残す）（src/presentation/admin/observe/improvement-action.ts） | ログイン | ログイン | — | **つかない** |
| `cancelPublicationAction()` | 予定していた配信を取りやめる（取りやめた先は終点で、予定へは戻せない）（src/presentation/admin/delete-form-action.ts） | ログイン | ログイン | — | **つかない** |
| `checkBlogDeliveryAction()` | 配信物を組み立て直して、結果を履歴に積む（src/presentation/admin/publish/blog-layout-action.ts） | ログイン | ログイン | — | **つかない** |
| `createSiteFromDraftAction()` | 下書きからサイトを作る（消す口が無い）（src/presentation/admin/publish/site-wizard-action.ts） | ログイン | ログイン | — | **つかない** |
| `deleteContentVariantAction()` | 記事を消す（本文を後から確かめる手段が残らない）（src/presentation/admin/delete-form-action.ts） | ログイン | ログイン | — | **つかない** |
| `deleteManagedSiteAction()` | ブログを消す（記事ごと消える）（src/presentation/admin/delete-form-action.ts） | ログイン | ログイン | — | **つかない** |
| `deleteProductAction()` | 商品を消す（順位表と比較表の入力が消える）（src/presentation/admin/delete-form-action.ts） | ログイン | ログイン | — | **つかない** |
| `disableAffiliateLinkAction()` | 登録済みの成果リンクを止める（記事に貼ったままでも読者へ出なくなる。戻すには新しいリンクとして登録し直す）（src/presentation/admin/delete-form-action.ts） | ログイン | ログイン | — | **つかない** |
| `manageBlogDomainAction()` | ブログの住所を登録・確認・切り替え・取り下げする（提供元に実物が作られ、読者の入口が変わる）（src/presentation/admin/publish/blog-domain-action.ts） | ログイン | ログイン | — | **つかない** |
| `manageBlogTagAction()` | タグを作る・直す・消す（消したタグの説明は残らない）（src/presentation/admin/publish/blog-tag-action.ts） | ログイン | ログイン | — | **つかない** |
| `manageIntegrationAccessAction()` | 外部連携の鍵を作る・失効させる（src/presentation/admin/feedback-action.ts） | ログイン | ログイン | — | **つかない** |
| `manageLlmCredentialAction()` | 生成 AI の API キーを預ける・消す（預けた鍵で課金が発生する）（src/presentation/admin/maintain/llm-credential-action.ts） | ログイン | ログイン | — | **つかない** |
| `manageMemberAction()` | 担当者を招く・役割を変える・担当から外す（入ってよい人の一覧が変わる）（src/presentation/admin/maintain/member-action.ts） | ログイン | ログイン | — | **つかない** |
| `publishArticleAction()` | 記事を公開する（src/presentation/admin/publish/publish-article-action.ts） | ログイン | ログイン | — | **つかない** |
| `registerBlueskyConnectionAction()` | Blueskyへ実認証し、workspace共通の配信先DIDを固定する（src/presentation/admin/publish/bluesky-connection-action.ts） | ログイン | ログイン | — | **つかない** |
| `reschedulePublicationAction()` | 投稿予定日を変える（前倒しにすれば今日出せる）（src/presentation/admin/publish/reschedule-action.ts） | ログイン | ログイン | — | **つかない** |
| `saveSiteDocumentAction()` | ブログの固定ページを書き換える（運営者情報・特定商取引法に基づく表記を含む）（src/presentation/admin/publish/site-document-action.ts） | ログイン | ログイン | — | **つかない** |
| `schedulePublicationAction()` | 投稿を予定に入れる（時刻が来たら外へ出る）（src/presentation/admin/schedule-publication-action.ts） | ログイン | ログイン | — | **つかない** |
| `startLoopRunAction()` | 見せ方の比較を始める（2 通りが読者へ配られ始める）（src/presentation/admin/observe/improvement-action.ts） | ログイン | ログイン | — | **つかない** |
| `updatePublicationAction()` | 配信の予定を直す（前倒しにすれば今日出せる）（src/presentation/admin/publish/publication-form-action.ts） | ログイン | ログイン | — | **つかない** |
| `adjustConversionAction()` | 成果の実績を手で直す（src/presentation/admin/earn/adjust-conversion-action.ts） | ログイン | ログイン | — | つく |
| `advanceContentStateAction()` | 記事の作業段階を進める（src/presentation/admin/write/content-progress-action.ts） | ログイン | ログイン | — | つく |
| `advanceLinkIngestionAction()` | 成果リンクの取り込みを進める（src/presentation/admin/earn/inbox-action.ts） | ログイン | ログイン | — | つく |
| `approveContentAction()` | 記事を承認する（src/presentation/admin/write/content-progress-action.ts） | ログイン | ログイン | — | つく |
| `approveVariantSpecAction()` | 見せ方の試作を承認する（比較に出せる状態にする）（src/presentation/admin/observe/improvement-action.ts） | ログイン | ログイン | — | つく |
| `archivePublishedArticleAction()` | 公開済み記事を非表示にする（データは残す）（src/presentation/admin/publish/published-article-action.ts） | ログイン | ログイン | — | つく |
| `changeFeedbackStatusAction()` | 指摘の状態を変える（src/presentation/admin/feedback-action.ts） | ログイン | ログイン | — | つく |
| `checkFactBoundaryAction()` | 書ける範囲の判定を試す（src/presentation/admin/write/fact-boundary-action.ts） | ログイン | ログイン | — | つく |
| `createAudiencePersonaAction()` | 読者像（誰に向けて書くか・何を比べたいか）を登録する（src/presentation/admin/write/persona-form-action.ts） | ログイン | ログイン | — | つく |
| `createAuthorPersonaAction()` | 書き手（記事をどの立場・文体で書かせるか）を登録する（src/presentation/admin/write/persona-form-action.ts） | ログイン | ログイン | — | つく |
| `createClaimAction()` | 商品について記事に書ける 1 文と、その裏付けを登録する（確認待ちで入る）（src/presentation/admin/material/evidence-form-action.ts） | ログイン | ログイン | — | つく |
| `createConceptDraftsAction()` | 1 つの商品から、ブログごとの切り口で下書きをまとめて作る（src/presentation/admin/write/concept-drafts-action.ts） | ログイン | ログイン | — | つく |
| `createContentPackageAction()` | 企画（どの商品を・誰が・誰に向けて・何のために書くか）を立てる（src/presentation/admin/write/content-package-form-action.ts） | ログイン | ログイン | — | つく |
| `createContentVariantAction()` | 記事の枠を作る（src/presentation/admin/write/content-form-action.ts） | ログイン | ログイン | — | つく |
| `createEvidenceAction()` | 記事に書くことの出所になる資料を 1 つ登録する（src/presentation/admin/material/evidence-form-action.ts） | ログイン | ログイン | — | つく |
| `createProductAction()` | 商品を登録する（src/presentation/admin/material/product-form-action.ts） | ログイン | ログイン | — | つく |
| `createRankingModelAction()` | 順位づけの基準（何をどれだけ重く見るか・どう測るか）を立てる（src/presentation/admin/material/ranking-form-action.ts） | ログイン | ログイン | — | つく |
| `createTestRunAction()` | いつ・誰が・どの方法で測ったかの記録を登録する（src/presentation/admin/material/evidence-form-action.ts） | ログイン | ログイン | — | つく |
| `draftVariantSpecAction()` | 見せ方の試作を登録する（src/presentation/admin/observe/improvement-action.ts） | ログイン | ログイン | — | つく |
| `editDisclosureAction()` | 広告であることの断り書きを登録・変更する（読者に出る文が変わる）（src/presentation/admin/maintain/compliance-action.ts） | ログイン | ログイン | — | つく |
| `editPolicyRuleAction()` | 表記のきまりを足す・止める・効かせ直す（止めている間は記事の表現が確認されない）（src/presentation/admin/maintain/compliance-action.ts） | ログイン | ログイン | — | つく |
| `handOffFeedbackAction()` | 指摘を引き継ぐ（src/presentation/admin/feedback-action.ts） | ログイン | ログイン | — | つく |
| `manageBlogAeoAction()` | AEO の構えの保存と、引用できる答えの取り直し（読者側は変わらない）（src/presentation/admin/publish/blog-improvement-action.ts） | ログイン | ログイン | — | つく |
| `manageBlogAppearanceAction()` | ブログの見せ方と配色を決める（ページ単位の例外を含む）（src/presentation/admin/publish/blog-appearance-action.ts） | ログイン | ログイン | — | つく |
| `manageBlogArticleAction()` | 記事を作る・直す・論理削除し、本文・タグ・評価ごと同じURLへ復元する（src/presentation/admin/publish/blog-article-action.ts） | ログイン | ログイン | — | つく |
| `manageBlogDeliveryAction()` | 配信部品を出し入れする（src/presentation/admin/publish/blog-layout-action.ts） | ログイン | ログイン | — | つく |
| `manageBlogLayoutAction()` | 版面の枠と帯を並べ替える・出し入れする（src/presentation/admin/publish/blog-layout-action.ts） | ログイン | ログイン | — | つく |
| `manageBlogPlacementAction()` | 記事のどこに成果リンクを出しているかを台帳へ記録する・外す（src/presentation/admin/publish/blog-placement-action.ts） | ログイン | ログイン | — | つく |
| `manageBlogRatingAction()` | 読者が付けた評価を伏せる・戻す（票は消えず、平均と件数から外れるだけ）（src/presentation/admin/publish/blog-rating-action.ts） | ログイン | ログイン | — | つく |
| `manageBlogSeoAction()` | SEO の診断・直しの下書き・指摘の見送り（読者側は変わらない）（src/presentation/admin/publish/blog-improvement-action.ts） | ログイン | ログイン | — | つく |
| `manageGuidelineReferenceAction()` | SEO/AI 指針の出典を登録する・確認日を更新する（一覧に残り、後から直せる）（src/presentation/admin/maintain/guideline-reference-action.ts） | ログイン | ログイン | — | つく |
| `manageSiteNetworkAction()` | サイト網の枝を足す・直す・論理削除し、削除済み一覧から同じURLへ復元する（src/presentation/admin/publish/site-network-action.ts） | ログイン | ログイン | — | つく |
| `markContactHandledAction()` | 読者からの問い合わせに対応済みの印を付ける・外す（src/presentation/admin/maintain/contact-action.ts） | ログイン | ログイン | — | つく |
| `previewAffiliateUrlAction()` | 成果リンクを保存する前に、安全な接続先から取得できる情報だけを確認する（保存はしない）（src/presentation/admin/earn/inbox-action.ts） | ログイン | ログイン | — | つく |
| `rebuildDailyMetricsAction()` | 日ごとの集計を、日付を指定して作り直す（読者側は変わらない）（src/presentation/admin/observe/metrics-rebuild-action.ts） | ログイン | ログイン | — | つく |
| `removeFromShortlistAction()` | 読者が自分の「気になる商品」から 1 件外す（src/presentation/site/shortlist-action.ts） | 誰でも | 誰でも | — | つく |
| `sampleAction()` | 見本帳のボタンの見本（何もしない）（src/app/admin/ui-catalog/sample-action.ts） | ログイン | ログイン | — | つく |
| `saveAffiliateAccountAction()` | 提携先（ASP のアカウント）を登録・変更する（src/presentation/admin/earn/affiliate-form-action.ts） | ログイン | ログイン | — | つく |
| `saveAffiliateProgramAction()` | 提携条件（広告主と報酬の決め方）を登録・変更する（src/presentation/admin/earn/affiliate-form-action.ts） | ログイン | ログイン | — | つく |
| `saveBrandAction()` | 読者から見た書き手（名前・問い合わせ先・文体）を 1 つ作る・直す（src/presentation/admin/maintain/settings-form-action.ts） | ログイン | ログイン | — | つく |
| `saveScoreCardAction()` | 決めた基準で測った商品 1 つの点と、その根拠を登録する（src/presentation/admin/material/ranking-form-action.ts） | ログイン | ログイン | — | つく |
| `saveSiteDraftStepAction()` | サイトの下書きを保存する（src/presentation/admin/publish/site-wizard-action.ts） | ログイン | ログイン | — | つく |
| `saveToShortlistAction()` | 読者が自分の「気になる商品」へ 1 件保存する（src/presentation/site/shortlist-action.ts） | 誰でも | 誰でも | — | つく |
| `startSiteDraftAction()` | サイトの下書きを始める（src/presentation/admin/publish/site-wizard-action.ts） | ログイン | ログイン | — | つく |
| `submitAffiliateUrlAction()` | 成果リンクを登録する（src/presentation/admin/earn/inbox-action.ts） | ログイン | ログイン | — | つく |
| `submitContactAction()` | 読者からの問い合わせ（公開フォーム）（src/presentation/site/contact-action.ts） | 誰でも | 誰でも | — | つく |
| `submitFeedbackAction()` | 指摘を登録する（src/presentation/admin/feedback-action.ts） | ログイン | ログイン | — | つく |
| `submitReaderRatingAction()` | 記事に点を付ける（公開フォーム。押し直すと上書きされる）（src/presentation/site/reader-rating-action.ts） | 誰でも | 誰でも | — | つく |
| `updateContentVariantAction()` | 記事の題名・本文・要約を直す（src/presentation/admin/write/content-form-action.ts） | ログイン | ログイン | — | つく |
| `updateManagedSiteAction()` | ブログの設定を直す（src/presentation/admin/publish/site-form-action.ts） | ログイン | ログイン | — | つく |
| `updateProductAction()` | 商品の内容を直す（src/presentation/admin/material/product-form-action.ts） | ログイン | ログイン | — | つく |
| `updatePublishedArticleAction()` | 公開済み記事を訂正する（src/presentation/admin/publish/published-article-action.ts） | ログイン | ログイン | — | つく |
| `updateWorkspaceAction()` | 作業場所の名前・契約の区分・時間帯・通貨を直す（src/presentation/admin/maintain/settings-form-action.ts） | ログイン | ログイン | — | つく |
<!-- 生成物の指紋 sha256:c436eee7a08cc09445cf2dfe162f75b2062db253140eb75bac00acd8e620a012 -->
