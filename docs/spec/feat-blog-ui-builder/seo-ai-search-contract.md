# SEO / AI 検索 実装契約（feat-blog-ui-builder / P02）

記録日: 2026-08-30
graph_node_id: `SYS-BLOG-UI-BUILDER-P02`
Beads: `ah-45ba.2`
受入: **A10**（メタ・正規 URL・OGP）、**A11**（sitemap / robots / feed / llms.txt）、**A12**（JSON-LD と標準ブロック）、**A13**（IndexNow）、**A14**（ガイドライン参照レジストリ）

## 0. この feature における位置づけ

A10〜A14 は **PR #28（Beads epic `ah-6lf`）で先行実装済み**である。
本 phase の役割は、実装済みの契約を**文書として固定**し、
**残っている穴 1 つ**を次 phase へ渡すことである。

| 受入 | 状態 |
|---|---|
| A10 | `published_articles` 経路（reviews/compare/best/guides/tools）は充足。**`/s/[site]/blog/[article]` に穴** |
| A11 | 充足（sitemap / robots / feed / llms.txt すべて実装） |
| A12 | 標準ブロック 5 種の語彙・JSON-LD 生成関数は実装。**ブログ記事経路に未接続** |
| A13 | 充足（鍵配信・送信・スキップ） |
| A14 | 充足（レジストリ・90 日判定・原典指紋） |

**穴は 1 つ。** `/s/[site]/blog/[article]` に `generateMetadata` と JSON-LD が無い
（P01 `screen-inventory.md` §2、N7）。

## 1. 記事が 2 系統あることの扱い

| 経路 | ルート | メタ | JSON-LD |
|---|---|---|---|
| `published_articles` | `/reviews/[product]` 他 5 種 | あり | あり |
| `blog-ops` | `/s/[site]/blog/[article]` | **無し** | **無し** |

**A10・A12 は両方を対象とする。** 受入文の「記事ページの HTML に…」は
読者が記事として読むページを指し、ブログ記事を除く読みは成り立たない。

### 1.1 生成経路を 2 つ作らない

穴を埋めるとき、**既存の生成関数を再利用する**。

| 使うもの | 場所 |
|---|---|
| `createArticlePageMetadata` | `src/presentation/site/article-page.tsx` 系 |
| `buildBlogPosting` | `src/application/seo/structured-data.ts:58` |
| `buildBreadcrumbList` | 同 `:155` |
| `buildFaqPage` | 同 `:176` 付近 |

ブログ記事用に別の生成関数を書かない。書くと、
schema.org の仕様が変わったとき片方だけ直る。

必要なのは**アダプタ 1 本**である。
`blog-ops` の記事読み取りモデルを、既存生成関数が受ける形へ写す。

## 2. メタデータ契約（A10）

記事ページの `generateMetadata` が必ず出すもの:

| 項目 | 契約 |
|---|---|
| `title` | 記事タイトル + サイト名。**空文字を許さない** |
| `description` | 記事の要約。無ければ `answer` ブロックの先頭から作る |
| `alternates.canonical` | 正規 URL。**絶対 URL** |
| `openGraph` | `type=article`, `title`, `description`, `url`, `siteName` |
| `openGraph.publishedTime` / `modifiedTime` | ISO 8601 |

- **`canonical` を相対 URL にしない。** 相対だと配信元が変わったとき
  自己参照が崩れ、重複コンテンツとして扱われる。
- description が作れないときは**出さない**（空文字を出さない）。
  空の description は「説明の無い記事」ではなく「壊れた記事」に見える。

## 3. JSON-LD 契約（A12）

### 3.1 出すもの

| 型 | 条件 |
|---|---|
| `BlogPosting` | 記事ページで常に |
| `BreadcrumbList` | 記事ページで常に |
| `FAQPage` | **`faq` ブロックが 1 件以上あるときだけ** |

`buildFaqPage` は既に「空の FAQPage を出さない」を実装している
（`structured-data.ts:173` のコメント: *空の FAQPage を出すと
「質問の無い FAQ」という嘘の構造になる*）。この判断を呼び出し側で覆さない。

### 3.2 可視テキストと JSON-LD は 1 つの値から出す

| JSON-LD の項目 | 可視の出どころ | 契約 |
|---|---|---|
| `dateModified` | `freshness` ブロックの「〜時点」表示 | **同じ 1 つの値** |
| `mainEntity`（FAQ） | `faq` ブロックの表示 | 同じ 1 つの配列 |
| `citation` / 出典 | `sources` ブロックの表示 | 同じ 1 つの配列 |

**2 経路で別々に組み立てない。** 別々にすると片方だけ更新される。
構造化データと本文が食い違うのは、検索側から見て
「本文に無いことを構造化データで主張している」状態であり、
善意の実装ミスでも同じ見え方になる。

これは P04 が「JSON-LD の `dateModified` と可視テキストの日付が一致」で固定する。

### 3.3 標準ブロック 5 種と受入の対応

| ブロック | 効くもの |
|---|---|
| `answer` | description の生成元、AI 引用時の答え |
| `key_points` | 要約の構造 |
| `faq` | `FAQPage` |
| `sources` | `citation`、A14 のレジストリと接続 |
| `freshness` | `dateModified`、可視の最終更新 |

**「これを入れると順位が上がる」という主張はしない。**
Google の AI 機能ガイドは追加の技術要件を求めていない
（`src/domain/authoring/blog-template.ts:38-41`）。
入れる理由は**引用されやすい構造**であることに限る。

## 4. sitemap / robots / feed / llms.txt 契約（A11）

すべて `src/app/s/[site]/` 配下の `route.ts`。生成は
`src/application/seo/feeds.ts` の純関数が持ち、route は配るだけ。

| ファイル | 契約 |
|---|---|
| `sitemap.xml` | 公開記事のみ。下書き・削除済みを含めない |
| `robots.txt` | AI クローラー（GPTBot / ClaudeBot / PerplexityBot / Google-Extended）を**明示許可**し、sitemap の場所を知らせる |
| `feed.xml` | 更新の配信 |
| `llms.txt` | **設計図の `emitLlmsTxt` で出し分ける。出さない設定なら 404** |

### 4.1 「黙って空を配らない」

`llms.txt` は正式標準ではないため任意項目である。
出さない設定のとき、**空の 200 ではなく 404 を返す**
（`src/app/s/[site]/llms.txt/route.ts:26-31`）。

空を 200 で配ると、「出しているが中身が無い」に見える。
出していないことと、出したが空であることは違う事実であり、
HTTP のステータスで区別できるものを本文で潰さない。

同じ原則が `indexnow.txt`（§5.1）にも適用されている。

## 5. IndexNow 契約（A13）

### 5.1 鍵の環境変数分離 — **必須ポリシー**

| # | 契約 | 場所 |
|---|---|---|
| K1 | 鍵は **`INDEXNOW_KEY` サーバー環境変数からのみ**読む | `worker-env` 経由 |
| K2 | 鍵をコード・設定ファイル・migration・シードに置かない | — |
| K3 | 鍵を戻り値・ログ・例外メッセージに入れない | `indexnow-client.ts` |
| K4 | 未設定は **404**（`indexnow.txt`）/ **`skipped`**（送信）。故障として扱わない | 同 |
| K5 | `NEXT_PUBLIC_` 接頭辞を付けない | クライアントへ配られる |

**K3 は「期待」ではなく「手当て」で守る。**
`indexnow-client.ts` のコメントが記録している通り、
2026-08-25 に一度、捕まえた例外の文をそのまま戻り値へ入れていた。
それは fetch の実装への期待であって、このファイルが守れる約束ではない。
要求本文を理由文へ写す実装が 1 つ挟まれば、鍵は呼び出し元が
ログへ書く値の中へ自分で歩いていく。

**外へ出す前に鍵を伏せ字へ置き換える。**
「たぶん入らない」を根拠に置く秘密は、入った日に誰も気づけない。

### 5.2 送信の契約

| # | 契約 | 理由 |
|---|---|---|
| N1 | 失敗しても **throw しない** | 通知は公開の条件ではない。通知先の障害で記事の公開が道連れになる |
| N2 | URL が 0 件なら送らない（`buildIndexNowSubmission` が `null`） | 何も更新していないのに通知だけ飛ぶ経路を型の外に出す |
| N3 | `origin` が URL として読めなければ送らない | 壊れた設定で半端な本文を作らない |
| N4 | 行き先は `https://api.indexnow.org/indexnow` に固定 | 外から渡された URL を取りに行く形にしない（SSRF） |
| N5 | `keyLocation` は `https://<origin>/indexnow.txt` に固定 | 決まりをドメインが持つ |

### 5.3 Q5 の決着 — スキップの記録先

P01 が P02 へ委ねた Q5（スキップを `console.info` のままにするか `audit_log` へ書くか）を決着させる。

**決定: `console.info` のまま。`audit_log` へ書かない。**

理由:

1. `audit_log` は**誰が何をしたか**の記録である。
   鍵の未設定によるスキップは**人の操作ではなく設定の状態**であり、
   ここに混ぜると監査ログが状態の通知で薄まる。
2. スキップは記事の公開 1 回ごとに起きうる。設定が未了の期間、
   `audit_log` が同じ行で埋まる。
3. 鍵が未設定であることは `/admin/settings/seo` から**状態として見える**べきで、
   過去のログを遡って知るものではない。
   → **P06 が `/admin/settings/seo` に「IndexNow 鍵: 未設定 / 設定済み」の表示を足す**
   （鍵の値そのものは出さない。K3）。

## 6. ガイドライン参照レジストリ契約（A14）

正本: `src/domain/seo/guideline-reference.ts`、表は `guideline_references`。

### 6.1 90 日再確認ポリシー — **必須**

```ts
export const REVIEW_INTERVAL_DAYS = 90;
```

| # | 契約 |
|---|---|
| G1 | `checked_at` から **90 日**を超えた行は「再確認対象」として表示する |
| G2 | 90 日は四半期に 1 度、原典を読み直す間隔として選んでいる |
| G3 | 期限切れを**自動で消さない・自動で更新しない**。表示するだけ |
| G4 | 境界は「90 日**超**」。ちょうど 90 日は対象外 |

G3 が重要である。自動更新すると、
「誰も読んでいないのに確認日が新しい行」ができる。
確認日は**人が原典を読んだ事実**を指す。

### 6.2 「要旨を読んだ」と「原典を取得した」の区別

| 状態 | 表現 |
|---|---|
| `summary_only` | `source_fetched_at` が NULL |
| `source_fetched` | `source_fetched_at` と `source_sha256` が非 NULL |

区別が無いと、要旨しか読んでいない行が原典確認済みと同じ見た目で並び、
**日付が新しいほど確かに見えるという逆さま**が起きる。

但し書き（`note`）に書いても、それは人が読む文であって機械は判定に使えない。

### 6.3 再取得と再評価を分ける

| 列 | 意味 |
|---|---|
| `source_sha256` | 最後に取得した本文の指紋 |
| `previous_source_sha256` | 1 つ前の指紋。**これと違えば指針が書き換わっている** |
| `re_evaluated_sha256` | この本文版で**仕様の再評価を完了**した指紋 |

**再取得だけで `re_evaluated_sha256` を動かさない。**
動かすと、本文が変わった警告を確認しないまま消せる。

「前回の指紋」を別の表に置かない。指針の変化に気づけるかは
2 つの指紋が**同じ行に並んでいるか**だけで決まり、離すと片方だけ消える。

### 6.4 出典の本文を保存しない

保存すると、古くなった写しが正本の顔で残る。持つのは指紋だけである。

## 7. 残っている穴と埋め方

| # | 穴 | 埋め方 | 担当 |
|---|---|---|---|
| H1 | `/s/[site]/blog/[article]` に `generateMetadata` が無い | `createArticlePageMetadata` を再利用するアダプタ 1 本 | P06 |
| H2 | 同ページに JSON-LD が無い | `buildBlogPosting` / `buildBreadcrumbList` / `buildFaqPage` を再利用 | P06 |
| H3 | `/admin/settings/seo` に IndexNow 鍵の設定状態表示が無い | 真偽 1 つの表示（値は出さない） | P06 |

**H1 と H2 は同じ 1 つのアダプタで埋まる。** 別々に作らない。

## 8. 次 phase への引き継ぎ

| 項目 | 引き継ぎ先 |
|---|---|
| §1.1 のアダプタの型定義 | P03 |
| §3.2 の「1 つの値から 2 経路」の検査 | P04 |
| §5.1 K1〜K5 の検査（鍵が応答・ログに出ない） | P04 |
| §6.1 G4 の 90 日境界値（89 / 90 / 91 日） | P04 |
| H1〜H3 の実装 | P06 |
| 鍵の登録手順（**利用者がブラウザまたは別ターミナルで設定する**） | P12 |
