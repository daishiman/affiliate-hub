# 公開ページ種別の詳細解析

- 上位文書 (正本): [`../13-参考サイト全体構成解析-抽象ブループリント.md`](../13-参考サイト全体構成解析-抽象ブループリント.md)。
  参考サイト解析の**正本はあちら**で、本書はその §2 のページ種別目録を、
  代表ページの実測 (landmark / 並び / desktop・mobile 差) まで降ろした下位文書である。
  食い違ったときは 13 を正とし、本書を直す。ページ種別の定義・件数・命名を変えるときは
  13 側に CHG を立ててから本書へ反映する。
- 語彙: 13 の §10 に従い「**ページ種別**」を使う (v1.1 まで本書は「画面型」と呼んでいた。
  理由は 13 の CHG-13-10)。「画面」は管理面の 1 画面を指す語として別に使う。

観測は sitemap 全数の分類と、各種別の代表ページの landmark/class/order 確認で行った。本文、画像、色値、固有文言は記録しない。

代表証跡は**抽象パス表記**と `url_digest` の先頭 16 桁で示す。ホストと slug をこの文書へ書かないためである。
どの実ページを見たのかは、digest を `evidence/reference-url-inventory.raw.json` の
`url_digest`（= `sha256(canonical_url)`）と突き合わせれば 1 件に定まる。
**証跡を消したのではなく、参照の向きを変えた。** 実URLを読みたい人は evidence を開く。
それ以外の読者は、URL を知らないまま構成だけを読める。

| ページ種別 | 数 | 代表証跡（抽象パス / url_digest 先頭16桁） | desktop | mobile | 独自実装への抽象化 |
|---|---:|---|---|---|---|
| home | 1 | `/` `3c6bf84be5e9a4ea` | ロゴ/検索→主nav→推奨群→新着カード→footer。広い主カラム | navを折り畳み、カード1列 | 「最初に探索起点、次に新着」の階層だけを採用 |
| article | 968 | `/<article-slug>/` `76a938bb52bb5a96`（商品レビュー記事1件） | header/nav→2カラム。main内は breadcrumb→title/meta→開示/導入→商品要約→比較→目次→H2/H3本文→会話/注意/表/CTA→editor→関連→comment。右に検索/category/tag/追従目次 | 1カラム。sidebarは本文後へ、表と比較は内部scroll、CTAは44px以上 | 写真を diagram/comparison/flow/spec table へ置換。開示→結論→根拠→選択のリズムだけ採用 |
| article-index | 2 | `/<article-index-slug>/` `befb3d9789767481`（全記事カード一覧）, `27b23f86ba1350b3`（HTML索引） | breadcrumb/title→カードまたは階層索引→sidebar→pagination | 1列、カードは題名/更新/状態の主3項目 | カードとテキスト索引を別用途として保持 |
| taxonomy | 64 | `/category/<category-slug>/` `3a0237601058839c`, `/tag/<tag-slug>/` `e23f7c082f870a9b` | breadcrumb→taxonomy title/description→記事カード一覧→sidebar | 1列、説明とカードを先行 | category=topic hierarchy、tag=brand/topic の違いを明示 |
| author | 23 | `/author/<author-slug>/` `5a14922811cb419d` | プロフィール/方針→投稿一覧→sidebar | profileを先頭に集約し投稿1列 | 信頼情報と投稿探索だけを採用 |
| navigator | 6 | `/<navigator-slug>/` `4ffd177c4bc9cedb`（条件比較型）, `aaa9717fe3a52a75`（誘導診断型） | 問い/条件→比較または選択→推奨結果→根拠/注記 | 条件を1ステップずつ、結果は主1件+代替 | 互いに独立した問いと選択の順序だけ採用 |
| fixed-page | 8 | `/<fixed-page-slug>/` `5233fe29869df9d9`（発行者プロフィール）, `6ebb09ec1f08a986`（個人情報方針）, `80c147317e983656`（問い合わせ） | breadcrumb→title→本文/定義→関連導線→footer | 1カラム、法務文の階層を維持 | 独自文面を管理CRUDから公開。参照文面は使わない |

## 共通レイアウトと表示条件

1. header: home link、主要category、検索。mobileは項目数を減らす。
2. body: desktopは `main 5/7 + sidebar 2/7`相当、mobileはmain先行1カラム。
3. article: disclosure、intro/summary、TOC、本文ブロック、比較/図解、CTA、author、related、feedbackの順を基本とする。ブロックが無ければ空枠を出さない。
4. sidebar: desktopだけ並置。検索/category/tag/TOCのうち実dataがあるものだけ。
5. footer: publisher、site navigation、policy/contact。公開済み固定ページだけを出す。
