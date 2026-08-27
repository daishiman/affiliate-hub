# 受入報告 (P07)

更新日: 2026-08-27  
execution status: **revalidation_pending (A1〜A14 全体)**  
targeted execution status: **A1 public lifecycle revalidated (2026-08-27)**

- canonical acceptance registry: `features/feat-blog-ops-crud.md#frontmatter.acceptance`
- acceptance source digest: `sha256:7d03855a6d54fdd216e92734e92d4ff5e6baf89dd094c6a4fcd9904c515603e5`

本文の実測は 2026-08-26 の historical snapshot である。現行 worktree は P08 の記事正本統合とライフサイクル変更後のため、以下の判定を現行 A1–A14 の PASS 証明に使用しない。各見出しは canonical ID の証跡セクションであり、受入文言の別定義ではない。

対象: `features/feat-blog-ops-crud.md` の受入条文 A1〜A14。
実行日: 2026-08-26。数値の出どころは [`test-run-report.md`](./test-run-report.md)。

## この表の読み方 — 「緑」と「守られている」は別である

各条文に **満たし方** を 3 段で付けてある。**「PASS」の一語で並べない。**
並べた瞬間、次に読む人は 14 行ぜんぶを同じ強さで信じるが、実際の強さは違う。

| 段 | 意味 | 戻ったときに何が起きるか |
|---|---|---|
| **機械** | 条文の主張を、失敗する検査が直接見ている | 壊すと赤になる |
| **部分** | 条文の一部だけを検査が見ている。残りは実装は在るが見張りが無い | 見張りの無い側は黙って壊れる |
| **手** | 検査が無い。実装と手元確認だけ | 誰も見ていない |

**部分と手を「あとで足す」と書いて緑扱いにしない。** ここに正直な段が並んでいることが、
P09 (qa-report) と P10 (final-review) が判断できる唯一の材料である。

## A1〜A14

### A1

**部分。**

- 機械が見ている: 一覧 (権限・作業場所の隔離・既存の不整合節点の可視化)、追加・変更・復元
  (URL 名の重複・親の存在・役割・循環の全体検証)、削除 (理由必須・配下があれば全体拒否) —
  `tests/domain/blog-ops.test.ts` / `tests/application/blog-ops-usecases.test.ts`
  「サイト網の一覧 / への追加 / の変更 / からの削除」。
- 機械が見ている: URL 名の規則と親子の決まり、網を木に並べる順序 —
  `tests/domain/blog-ops.test.ts`「URL の名前」「親子の決まり」「網を木に並べる」。
- 機械が見ている: request-scoped な公開 identity は削除後に `null`（全 `/s/{site}` が404）、
  復元後に同じ URL で再び reader を開ける — `tests/integration/d1-blog-ops-tenancy.test.ts`。
- 機械が見ている: desktop/mobile で別々のサイトを使い、実previewへのブラウザ遷移で
  `/s/{site}`、ブログ一覧、記事詳細、固定ページが active なら200、hidden/論理削除なら404、
  復元後は同じURL・同じ題名・lead・本文で200へ戻る。Server Actionのpending表示を完了扱いせず、
  公開URLの事後条件までpollする — `tests/e2e/public-site-lifecycle.spec.ts`。2026-08-27に
  fresh previewでdesktop/mobile並列2件を2回連続実行し、各回2/2 PASS。

### A2

**部分。**

- 機械が見ている: 帯の件数の境目 — `tests/application/blog-ops-usecases.test.ts`
  「帯の件数 ${bad} は断る」「${good} は通る（境目）」。上限の数字が画面ではなく
  ユースケース側で決まっていることまで固定してある。
- 機械が見ている: 配信部品 9 種と枠の冪等保存 (「2 度保存しても枠が 2 行に増えない」)。
- **見張りが無い**: **描画の順序。** 設定した順序が公開面の並びに出ることを見る検査が無い。
  順序を保存する側 (`blog_layout_bands`) は在るが、読む側の並びは手で見た。

### A3

**部分。**

- 機械が見ている: サブサイト別の feed / sitemap / llms.txt がサイトごとの base path で
  出ること — `tests/presentation/seo-route-handlers.test.ts`、`tests/application/seo/feeds.test.ts`。
- 機械が見ている: 共通部品がブログ名で分岐していないこと (= ヘッダーが網で共有される形に
  なっていること) — `tests/ui/uiux-blog-scaffold.test.ts`「共通部品にブログ名の分岐が無い」。
  **これは「共有されている」の裏返しを見ている**: 分岐が入った瞬間に共有が崩れるので、
  分岐 0 件を固定すれば共有は保たれる。
- **見張りが無い**: 「サブサイト 2 件で同一ヘッダー / 異なるサイドバー」を実際に 2 件並べて
  比べる検査。条文が名指しで 2 件を要求しているのに、比較は手で行った。

### A4

**部分。**

- 機械が見ている: 記事型ごとの必須部品の表そのもの、欠け 1 つに対して 1 つだけ返すこと、
  T4 が T1 より少ないこと (型を選ぶ意味が残っていること) — `tests/domain/blog-ops.test.ts`
  「記事型ごとの必須部品」。
- 機械が見ている: 下書き→公開の遷移 (部品が欠けたままの公開だけを断る / 2 度目の公開で
  公開日を書き換えない)、理由なしの削除を断ること、削除に記録が残ること —
  `tests/application/blog-ops-usecases.test.ts`「記事の作成・変更・削除」。
- 機械が見ている: 画面から見た同じ断り — `tests/e2e/blog-ops-crud.spec.ts` 5 本。
- **見張りが弱い**: 条文は検証エラーを **AT-01..05 / BP-01..06 の符号** で返せと書いている。
  検査は**断りが出ること**と**欠けた部品の名前**を見ているが、**符号そのものは照合していない。**
  符号を付け替えても検査は緑のまま通る。
- **見張りが無い**: 「監査イベントに **1 件ずつ**」の件数。記録が残ることは見ているが、
  遷移 1 回につき 1 件であることは数えていない。

### A5

**機械が見ている。**

- 実装: 記事の本文部品は位置の順に並ぶ (`tests/application/blog-ops-usecases.test.ts`
  「本文の部品は位置の順に並ぶ」が並び順そのものは機械で見ている)。
- **並びのずれを、運営者が直せる形にした** (この回)。規則は domain の
  `blocksOutOfTemplateOrder()` 1 か所で、読み出し (`GetBlogArticleOutput.outOfOrder`) と
  管理画面が同じ関数を呼ぶ。管理画面は**保存を待たずに数え直す**ので、
  「動かす → 保存 → まだ言われる」を繰り返さずに済む。
  **「足りない」と「並びが違う」は別の枠・別の言葉で出す** — 直し方が違う (足す / 動かす)。
  並びのずれで**公開は止めない** (`tone="info"`)。読みやすさの問題で、欠落とは重さが違う。
  動かす手段 (「1 つ上へ / 1 つ下へ」) を同時に入れた。手段が無いまま警告だけ出すと、
  運営者は部品を消して入れ直すしかなくなり、そのたびに本文を書き写すことになる。
- **公開面の脇の欄を入れた** (この回)。`SiteShell` に差し込み口、`blogSidebar()` が
  管理画面の保存どおりに枠を描く。**既定の並びを持たない** — 持たせると管理画面で
  消したのに消えない枠が生まれる。段組みは**置くものがあるときだけ出す**
  (`tests/ui/site-aside.test.tsx`)。空の脇を出すと、画面は壊れて見えないまま
  本文だけが狭くなり、誰も故障として報告しない。
- **product-card の 3 箇所再掲と階層目次を入れた** (この回)。対応の正本は
  `src/domain/blogops/article-outline.ts` の 2 つの表 — どの部品が目次の何段目に載るか
  (`ARTICLE_BLOCK_TOC_LEVEL`) と、記事型ごとにカードをどこへ再掲するか
  (`PRODUCT_CARD_PLACEMENTS`)。**画面には置かない。**記事の画面が増えた日
  (印刷用・要約表示) に対応が枝分かれし、どの枝が正しいか誰も言えなくなる。
  目次の番号は**数え上げで作る** — 運営者に打たせると、途中に節を足した日に
  以降を全部打ち直すことになり、打ち忘れた番号が読者に見える。
- 機械が見ている: 画面が表どおりに描くこと — `tests/ui/blog-article-view.test.tsx`。
  **期待値に表そのものを使う。**表の中身を検査へ書き写すと、表を直した日に
  画面の検査が古い表を守り続ける。

### A6

**部分。**

- 機械が見ている: 通常枠が 8 種あること (「設計図の数を画面が減らせない」)、領域に無い枠名を
  保存で断ること — `tests/application/blog-ops-usecases.test.ts`「版面の設定」。
- 実装: 追従枠 2 種は `SIDEBAR_STICKY_SLOT_KEYS` (`src/domain/blogops/blueprint-parts.ts`) に在る。
- 機械が見ている: **`custom-html-slot` の除去。**`<script>` `<style>` `<iframe>` `<object>`
  `<embed>` は中身ごと落ちる・閉じ忘れた `<script>` は末尾まで落ちる・一覧に無いタグは
  タグとして消えて文字だけ残る・`on...` 属性はどのタグでも落ちる・`href`/`src` は
  http・https・mailto と相対だけ通る (`java\tscript:` のような分割も通さない)・
  二度削っても結果が変わらない — `src/domain/blogops/custom-html.ts` /
  `tests/domain/custom-html-sanitize.test.ts`。
  **削る場所は保存の直前** (`src/application/usecases/blog-ops/manage-blog-layout.ts:246`)。
  描画の直前ではないので、あとから描く場所が増えても穴が開かない。
  検査は許可一覧を写さず「一覧に無いものは必ず落ちる／在るものは必ず残る」という
  **一覧との関係**を当てているので、一覧を増やしても 2 か所を直さずに済む。
- **見張りが無い**: 狭幅での折りたたみ。

### A7

**部分。**

- 機械が見ている: 8 種を必ず並べ無いものに印を立てること、**無いページを既定文で埋めないこと**、
  8 種が揃えば公開を止める理由が消えること、同じ種類を 2 度保存しても 2 枚に増えないこと、
  論理削除後の本文・公開状態保持、暗黙復活の拒否、所有者による明示復元 —
  `tests/application/blog-ops-usecases.test.ts`「固定ページ」。
- 機械が見ている: published かつ未削除の正本語彙だけを legal-nav/footer へ投影する —
  `tests/ui/public-site-projection.test.ts` / `tests/integration/d1-blog-ops-tenancy.test.ts`。

### A8

**機械が見ている。**

- 種類そのもの: `blog_tag.kind` (`brand` / `topic`、既定 `topic`、migration
  `0025_careless_goliath`)。**既定を `topic` にしたのは、間違え方が軽い側だから。**
  種類を足す前からあるタグはどちらとも分からない。既定を `brand` にすると枠が
  「これは作り手だ」と嘘を言い、`topic` にすると枠が寂しくなるだけで済む。
- **絞る条件は 1 か所**: `brandTagCloud()` (`src/domain/blogops/blog-tag.ts`) だけが
  `kind === "brand"` を知る。画面ごとに `filter` を書くと、書き忘れた画面から
  非ブランドが漏れ、**しかもその画面は正しく見える**ので気づく機会が無い。
  公開面の帯 (`src/presentation/site/blog-top-bands.tsx` の `navigator`) は
  この関数を通す。
- 機械が見ている (否定側): **ブランド以外は 1 件も出ない**・ブランドは上限に余りがあれば
  1 件も落とさない・上限 0 を無制限と読み替えない・保存順で枠が日替わりにならない・
  元の配列を書き換えない・知らない種類の文字列は通さない —
  `tests/domain/blog-tag-cloud.test.ts`。見本に両方の種類が入っていることを
  同じ `describe` の中で先に当てている (母集団の床)。片方しか無いと
  「ブランドだけを出す」のか「たまたま全部出しているだけ」なのかが区別できない。
- 機械が見ている (入口側): **種類を送らない保存は断る**(`field: "kind"`)。
  省略を許すと、画面が送り忘れた日に保存だけが通り、枠の中身が静かに変わる。
  運営側の一覧は総数と別に `brandCount` を返し、ブランド 0 件のときは
  「枠は空のまま」と言葉で返す — `tests/application/blog-ops-usecases.test.ts`「タグ」。
- 機械が見ている (従来分): タグの CRUD (URL 名の重なり・自分自身は重なりに数えない・
  表示名の空・理由つき削除)。
- **置き場所ができた** (この回): 公開面の脇の欄 (`src/presentation/site/blog-sidebar.tsx`) の
  `brand-tag-cloud` も `brandTagCloud()` を通す。**枠の中で `filter` を書かない。**
  枠が増えた日に書き忘れても画面は正しく見えるので、気づく機会が無い。
- **見張りが弱い**: 枠に出る件数の上限 (`SIDEBAR_TAG_LIMIT = 12`) は枠側の定数で、
  管理画面から変えられない。帯 (`itemLimit`) と揃っていないことを見る検査が無い。

### A9

**部分。**（記録の欠落は塞いだ。残るのは検査ではなく点検の届く範囲）

- 機械が見ている (厚い): sitemap は新着 20 件で切らない・読み取り失敗を空 sitemap にせず 503・
  50,000 件超も黙って切らない。RSS は明示した 20 件方針で配る。robots は AI クローラー 4 種を
  Allow し遮断を 1 行も書かない。llms.txt は無いブログを空文字 200 にせず 404。
  canonical はサイト直下と子ページを 1 つの規則で合成し、host が無ければ誤った相対 URL を配らない
  — `tests/presentation/seo-route-handlers.test.ts` / `site-metadata.test.ts` /
  `tests/application/seo/feeds.test.ts` / `tests/architecture/open-doors.test.ts`。
- **点検結果の表を入れた** (この回)。`blog_delivery_snapshot` (`src/db/schema.ts`) は
  設定表 `blog_delivery_part` と**別の表**である。1 つに畳むと、設定を保存したときに
  結果まで書き換わり、「いつの結果か」が言えなくなる。
  記録は**上書きせず積む** (`onConflictDoUpdate` を付けない)。上書きにすると
  「いつ壊れたか」が 1 件ずつ静かに消える。一覧は部品ごとに最新 1 件だけを採る。
- **状態は 4 値で、`unchecked` を `ok` に畳まない**
  (`src/domain/blogops/delivery-snapshot.ts`)。見ていないことは、良いことでも
  悪いことでもなく**見ていない**としか言えない。言い方 (`DELIVERY_HEALTH_LABEL`) も
  domain 側に置く — 画面が独自に言い換えると「まだ点検していない」が
  「問題なし」と読める言葉になりやすい。
- **点検の口は保存と分けてある** (`checkBlogDeliveryAction`)。保存のついでに点検すると
  「保存したから緑」になり、点検が保存の言い換えになる。
- 機械が見ている: 押すと 9 種ぶん積まれる・二度押しても履歴が消えない・一覧は最新 1 組・
  下書きで sitemap を緑にしない・住所の起点が無いまま点検させない・権限の無い人は点検できない・
  点検が監査に残る — `tests/application/blog-ops-usecases.test.ts`「配信物の点検 (A9)」8 本、
  `tests/domain/blog-delivery-snapshot.test.ts` 7 本、
  `tests/application/blog-delivery-check.test.ts` 9 本。
- **点検の深さが部品で違う** (意図的)。sitemap と robots は**本当に組み立てて**
  結果を数える。残る 7 種は**材料の有無を見る**。RSS と llms.txt の組み立て器は
  `ArticleSummary` (記事型・分類・要約を持つ別の読み型) を要求するが、`BlogArticle` は
  それを持たない。**持たないものをそれらしく埋めて渡さない** — 埋めた瞬間、点検は
  「自分が作った嘘」を検査することになり、緑が何の保証にもならなくなる。
  どちらで見たかは各行の「見たこと」に日本語で残る。
- **見張りが無い**: 残り 7 種を実際に組み立てて突き合わせること。
  そのためには `BlogArticle` から `ArticleSummary` への対応が要る。

### A10

**部分。**

- 機械が見ている: 鮮度の境目 (日数の境界・これから先の日付を古い印にしない) —
  `tests/domain/blog-ops.test.ts`「鮮度の境目」。境目の日数が**画面ではなくドメインで
  決まる**ことまで固定してある。
- 機械が見ている: 適合の材料 (1 本を開くと足りない部品を名前で返す)、古い記事の数を数えること
  — `tests/application/blog-ops-usecases.test.ts`「記事の一覧と閲覧」。
- **見張りが無い**: **並べ替えと絞り込みの操作そのもの。**列が在ることと、列で並べ替えられる
  ことは別で、後者を見ていない。

### A11

**部分。**

- 機械が見ている (厚い): 1〜5 の外は断る・読者の鍵が空なら断る (二重投票を止められないため)・
  公開していない記事には付けられない・空の一言を空文字ではなく null にする・押した後の件数と
  平均を返す・**記事を書き換える口を渡していない** — `tests/application/blog-ops-usecases.test.ts`
  「読者の評価の受け取り」。
- 機械が見ている: 0 件の平均は 0 ではなく null、全員最低点と 0 件は別物、票が 5 件に満たない
  うちは目安を出さない — 同「記事の評価の一覧」/ `tests/domain/blog-ops.test.ts`「読者の評価」。
- 機械が見ている: 画面から点を付けられること・点を選ばずに送ると断られること —
  `tests/e2e/blog-ops-crud.spec.ts`。
- 機械が見ている: **非表示。**伏せる／戻すの両方に理由が要ること (どちらも
  `REASON_REQUIRED` に載せてある)、**行は消えず印だけが付け替わること**、伏せた票が
  読者側の平均と件数から外れること、運営側の一覧には伏せた票も出ること、
  **記録が書けなかったときに印を巻き戻さないこと** —
  `tests/application/blog-ops-usecases.test.ts`「読者の評価を伏せる」。
- 実装: `src/application/usecases/blog-ops/evaluate-blog-articles.ts`
  (`createSetArticleRatingHiddenUseCase` / `createListArticleRatingsUseCase`)、
  画面は `/admin/blog/evaluate/[article]`
  (`src/app/admin/blog/evaluate/[article]/page.tsx` + `blog-rating-form.tsx`)、
  監査の語は `blog_rating.hidden` / `blog_rating.shown`、列は `blog_article_rating.hidden`
  (migration `0024_black_vargas`)。
  **消す口は作っていない。**消せる形にすると「伏せた」と「最初から無かった」が
  同じ姿になり、伏せた判断そのものを後から確かめられなくなる。
- **見張りが弱い**: 公開面の描画そのものを見る検査は、読者向けの集計
  (`summarizeRating`) の水準で当てている。画面の HTML に伏せた一言が出ないことを
  直接見る検査は無い。

### A12

**部分。**

- 機械が見ている: 記録が残ること (削除の記録) — `tests/application/blog-ops-usecases.test.ts`。
- 実装: 公開面の反映は TTL の満了待ちではなく `revalidatePath()` による明示の失効で行っている
  (`src/presentation/admin/blog-article-action.ts` ほか)。**条文の「10 分以内」より速い側に
  外れているが、条文が指定した機構ではない。**
- **見張りが無い**: TTL の値そのもの。10 分という数字を見る検査は無い。

### A13

**部分。CI ゲートは PASS だが、片方の検査が走っていない。**

実行 (2026-08-26): `node scripts/check-reference-site-reuse.mjs` → exit 0。

```
検査したファイル: 49 件
構造で見る検査: 実行
名前で見る検査: 見送り (.reference-ban.local がありません)
転用の疑いは 0 件です。
```

**「名前で見る検査: 見送り」を PASS の一語に畳まない。** 禁止する固有名そのものを
リポジトリに書けない (書いた時点で転用になる) ため、名前の一覧は追跡されない
`.reference-ban.local` に置く設計になっている。**手元にその file が無い環境では、
名前側は一度も照合されないまま緑になる。**構造側 49 件の検査だけが実際に走った。

### A14

**部分。**

- 機械が見ている: 読み上げの自動検査は全画面走査に組み込まれており
  (`tests/ui/page-render.test.tsx` ほか axe 系 10 ファイル)、重大違反が出れば赤になる。
- **見張りが弱い**: 条文が名指しした **6 画面 (サイト網一覧 / トップ構成 / レイアウト /
  記事編集 / 固定ページ / 評価一覧) を 6 件として数える検査が無い。**全体走査に含まれてはいるが、
  **6 画面のうち 1 枚が走査の表から抜け落ちた日に、それを教えるものが無い。**

## まとめ — 何が残っているか

| 段 | 条文 |
|---|---|
| 機械 | A5, A6, A8, A11 |
| 部分 | A1, A2, A3, A4, A7, A9, A10, A12, A13, A14 |
| 手 | (無し) |

**実装が条文に達していないもの** (検査を足せば済む話ではないもの):

- **無し。**この回で A5 の欠落 (3 箇所再掲・階層目次) と A9 の欠落 (点検結果の表) を
  両方塞いだ。A9 に残るのは**点検の届く範囲**であり、記録の仕組みの不足ではない
  (9 種のうち 2 種を組み立て、7 種は材料を見る。理由は A9 の節に書いた)。

**塞いだもの** (この回):

- **A5** — 並びのずれを運営者が直せる形 (規則は domain 1 か所・保存を待たない
  数え直し・動かす手段つき)、公開面の脇の欄、そして **product-card の 3 箇所再掲と
  階層目次** (対応は `article-outline.ts` の 2 つの表が正本)。
- **A9** — 設定と結果を別表にし、結果を積む形で `blog_delivery_snapshot` を入れた。
  状態は 4 値で `unchecked` を `ok` に畳まない。点検の口は保存と分けた。

- **A6** — 保存の直前で削る `sanitizeSlotHtml` と、一覧との関係を当てる検査を入れた。
- **A11** — 消さずに伏せる操作・運営側の 1 件ずつの画面・理由必須の監査語を入れた。
- **A8** — `blog_tag.kind` と `brandTagCloud()` を入れ、否定側 (非ブランドは出ない) を
  一覧との関係として当てた。残るのは枠の**置き場所**で、それは A5 の穴である。

**検査だけが足りないもの**: A2 の描画順序、A3 の 2 件比較、
A4 の符号照合と監査 1 件ずつ、A7 の legal-nav/footer 反映、A10 の並べ替え・絞り込み、
A12 の TTL、A13 の名前側、A14 の 6 画面の数え。

A1 の公開ライフサイクル部分は、主要4公開URLについて active→hidden→active→論理削除→復元の
HTTP status と表示内容をfresh previewで2回連続機械検査済み。これはA1のtargeted再検証であり、
A1〜A14全体のexecution statusは引き続き `revalidation_pending` である。feed/sitemap/llms.txtを含む
全 `/s/{site}` 子routeの同じ往復は、このE2Eの直接検査範囲外である。

この一覧をそのまま P09 (qa-report) の是正対象と P10 (final-review) の判断材料にする。
**「概ね満たした」と書いて 14 行を平らにしない。**
