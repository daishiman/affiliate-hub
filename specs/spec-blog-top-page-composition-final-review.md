# ブログトップページ構成 MVP — 最終レビュー仕様

## 目的

トップページを、読者が「最初に読むもの」「新しいもの・よく読まれるもの」「分野」「すべての記事」の
順で迷わず辿れる入口にする。

## 実装済み契約

- おすすめ → 最新/人気 → カテゴリー → 全記事の順序を保つ
- 最新/人気はURL入力で選べ、JavaScriptが無くても到達できる
- 区画にデータが無い場合は、空白ではなく理由を示す
- 人に見える記事順と `ItemList` の順を同じ入力から作る
- 参照サイトから借りるのは情報階層であり、文章・画像・ロゴ・固有色は転用しない

## 未完了の契約

- フッター7導線の実ブラウザ確認
- axe-core、light/darkコントラスト、CLSの測定
- 画像なし記事の全画面fallback。トップページ外は `feat-thumbnail-visual-system` が所有する
- development環境でのsmokeとrollback

この文書は新しい正本を作らない。acceptance の正本は
`features/feat-blog-top-page-composition.md#frontmatter.acceptance`、詳細な判定は
`docs/spec/feat-blog-top-page-composition/final-review.md` を参照する。
