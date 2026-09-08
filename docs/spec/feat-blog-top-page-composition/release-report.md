# リリース報告 — ブログトップページ構成 MVP

- 更新日: 2026-09-08
- 状態: **draft PR 準備済み / development deploy 未実施**
- base branch: `dev`
- head branch: `devgraph/feat-blog-top-page-composition`

## このPRで確認できるもの

- おすすめ、最新/人気、カテゴリー、全記事への導線を順序立てたトップページ
- URLで到達できる最新/人気切り替え
- おすすめと通常記事の重複抑止、0件時の説明
- `WebSite + SearchAction + ItemList` のサーバー生成 JSON-LD
- 参照ブログの表現をコピーしない静的ゲート
- Drizzle snapshot の系譜修復、spec-state の安全な枝合流、型付きテスト factory

## リリースしない理由

フッター全導線、ブラウザ a11y、コントラスト、CLS、サムネイル fallback、development smoke の
証跡が未取得である。PR はレビュー可能な MVP 差分として出すが、feature 完了・本番公開とは扱わない。

## 配信前チェック

- [ ] A4 フッター7導線
- [ ] A7 axe-core / light-dark コントラスト
- [ ] A8 width/height / CLS / OGP fallback
- [ ] development deploy と smoke
- [ ] rollback 手順の実測
