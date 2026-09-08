# ブログトップページ構成 MVP — アーキテクチャ最終確認

## 判定

新しいアーキテクチャ決定はない。実装は既存の二層構造と所有境界を維持している。

## 境界

- 公開トップは `PublicSiteProjection` を読み、記事を別経路で再取得しない
- 記事・カテゴリー・推薦の正本を表示部品へ重複して持たせない
- 最新/人気はURLを入力契約とし、クライアント状態だけを正本にしない
- JSON-LDは画面に出す同じ記事列から派生させる
- sticky header / footer 部品は `feat-blog-ui-builder` の所有
- トップページ以外のthumbnail表示・生成・保存・配信は `feat-thumbnail-visual-system` の所有
- 検索indexと結果面は `feat-reader-search-quality` の所有

## 補助タスクの影響

- `ah-9tx5`: migration内容ではなくDrizzleのsnapshot系譜を前進させる。適用済みSQLは変更しない
- `ah-2ann`: spec-stateのappend-onlyログを三方合流し、非ログ競合は自動解決しない
- `ah-t1df`: production codeを変えず、テスト入力をdomain型の正本へ追随させる

いずれもアプリのruntime依存方向・権限境界・外部APIを変更しない。
