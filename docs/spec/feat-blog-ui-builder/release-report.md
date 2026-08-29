# リリース報告（feat-blog-ui-builder / P13 相当）

記録日: 2026-08-24
graph_node_id: `feat-blog-ui-builder`
宛先ブランチ: `dev`
作業ブランチ: `devgraph/feat-blog-ui-builder`
draft PR: https://github.com/daishiman/affiliate-hub/pull/28

## 目的

SEO / AI 検索 MVP を開発ブランチへ載せる。テンプレート・配色・sticky・固定ページ・アフィリエイト配置 UI は後続スライス。

## デプロイ

本レビューでは `pnpm run deploy:dev` を実行しない。PR マージ後、既存の開発環境デプロイ手順に従う。migration `0022_neat_virginia_dare` は 6 テーブル追加のみ。既存 `disclosures` 行は触らない。

## 書き戻し

[`spec-writeback-receipt.md`](./spec-writeback-receipt.md)

## 公開後に必要な環境変数

- `INDEXNOW_KEY`（任意。未設定なら通知は skip され、公開自体は通る）
