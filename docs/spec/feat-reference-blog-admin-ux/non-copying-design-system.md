# 非模倣デザインシステム

## 採用するもの

- 情報階層: header、breadcrumb、main/sidebar、article rhythm、related/footer。
- 操作原則: 1画面1目的、主操作1つ、段階的開示、状態常時表示。
- ページ型: home、article、index、taxonomy、author、navigator、fixed-page。

## 採用しないもの

参照元の文章、見出し文言、写真、ロゴ、似顔絵、固有名、色値、font、CSS class名、theme/plugin asset、広告カードの見た目を転用しない。

## 独自 token

既存 `jp-web-design` Mode A Graphite×Amberの semantic token を維持する。primary=操作/骨格、accent=実行中のみ、success/warning/danger/neutral=状態。参照元の色を測定または復元しない。写真代替は独自の図解、比較表、flow、icon、data table とする。

## gate

1. repository に参照元画像/本文/theme assetが無い。
2. source host・実URL・固有名が出るのは `evidence/` 配下だけ。仕様文書と
   `sitemap-snapshot.json` / `reference-url-inventory.json` は抽象パス表記
   （`/<article-slug>/` など）と digest だけを持つ。収集 script も host を持たず、
   `--site-profile` で `evidence/reference-site-profile.json` から受け取る。
3. 公開componentは独自のトークンとdomain block名で構成。
4. 参照URLを外しても情報階層と操作が説明できる。

**gate 2 が「inventory も可」から `evidence/` 限定へ狭まった理由。**
inventory は仕様の一部として読まれる文書であり、読む人はそこに書かれた URL を
そのまま設計の入力として扱う。隔離先が 2 か所あると、どちらが正本か決まらない。
1 か所に寄せたうえで、抽象側に `url_digest` を残した。**件数と分類の証明能力は
落ちていない**——1,072 件の分類も未分類 0 も抽象側だけで検算でき、
個別ページの同定が必要になったときだけ digest で evidence を引く。

