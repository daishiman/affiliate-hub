# 最終レビュー — ブログトップページ構成 MVP

- 実施日: 2026-09-08
- feature: `feat-blog-top-page-composition`
- Beads: `ah-v2xx`
- dev-graph node: `feat-blog-top-page-composition`
- 判定: **MVP の実装済み部分はレビュー合格。feature 全体は未完了**

## 結論

公開トップには、おすすめ記事、最新・人気の切り替え、カテゴリー索引、全記事への導線、
空状態、検索可能な追従ヘッダー、`WebSite + SearchAction + ItemList` の JSON-LD が実装されている。
参照サイトの文章・画像・ブランド資産をコピーせず、情報の並べ方だけを抽象化している。

一方、feature 正本の受入 A4・A7・A8 を完了とするために必要な、フッター7導線の実測、
axe-core / light-dark コントラスト、実ブラウザ CLS、全カードのサムネイル fallback の証跡は
揃っていない。したがって `ah-v2xx` と P01〜P13 は close せず、PR も draft とする。

## レビュー対象

今回の作業ツリーにある本変更は、次の4群へ分けてレビューした。

| 群 | Beads | 主な対象 | 判定 |
|---|---|---|---|
| ブログトップ MVP | `ah-v2xx` / P01〜P13 | トップページ構成、URL切替、推薦、カテゴリー、JSON-LD、非模倣 | 部分 PASS・feature は open |
| Drizzle snapshot 系譜 | `ah-9tx5` | `0062` snapshot / journal / migration helper | PASS |
| spec-state 安全合流 | `ah-2ann` | append-only log の和集合と競合時停止 | PASS |
| 型付きテスト factory | `ah-t1df` | 痩せた domain mock の共通 factory 化 | PASS |

`git status` で確認した既存差分のうち、`feat-uiux-overhaul`、prose 実装、scheduled maintenance、
system-spec harness の別作業、scratch ファイルは本変更に含めない。

## 検証結果

| 検証 | 結果 |
|---|---|
| ブログトップ対象テスト | 11 files / 67 tests PASS |
| 型検査 | `pnpm typecheck` PASS |
| 型付き factory 対象 | 15 files / 138 tests PASS |
| spec-state merge | 16 tests PASS |
| Drizzle snapshot | `drizzle-kit check` = `Everything's fine` |
| exact-13 task 仕様ゲート | PASS、digest `sha256:a3ead33cd3c445dbd86ac6bb7b301323862bd442b445d6160e30036b75f9f680` |
| exact-13 promotion readiness | INCOMPLETE。completeness producer検証とsource plugin manifestが見つからない |
| system-spec matrix 独立監査 | PASS、48セル・未収集0・dangling 0 |
| system-spec hearing 独立監査 | FAIL、既存の誘導質問3件 |
| system-spec doc freshness 独立監査 | 29/29を確認。SQLite FTS5 / WebMCP に既存の鮮度差分を検出（本変更の仕様影響ではない） |
| system-spec harness 全体テスト | 118 passed / 3 failed。別作業中の compiler/golden 差分 |
| `git diff --check`（対象差分） | PASS |

MVP のため、全 Vitest は既存の system-spec/compiler 差分を検出した時点で完走させず、
変更対象の検査へ絞った。本番 build・Cloudflare への deploy は実行していない。

## 仕様・設計への影響

製品仕様の新規変更はない。実装は既存の `features/feat-blog-top-page-composition.md`、
`system-spec/ui-ux.md`、`system-spec/frontend.md`、`architecture/arch-two-layer-platform.md` の境界内である。

したがって `system-spec/spec-state.json` の製品要件、`specs/` の正本、既存 architecture の
決定を変更する writeback は不要と判断した。最終監査で見つかった射程外 QA 参照、foundation
参照節、SQLite FTS5 / WebMCP の鮮度差分は本変更が生んだものではなく、混在している別作業の
compiler/golden 差分と一緒に commit しない。判断と独立監査結果は
[仕様反映の受領書](./spec-writeback-receipt.md) と
`system-spec/review-receipts/feat-blog-top-page-composition-final-review.json` に記録した。

## 残課題

- フッター7導線と JavaScript 無効時の全導線を実ブラウザで確認する
- axe-core 重大違反0、light/dark コントラスト、CLS 0.1未満を証跡化する
- サムネイル fallback を `feat-thumbnail-visual-system` の担当面まで含めて確認する
- system-spec の既存誘導質問3件を、中立な個別質問として正規に再確認する
- system-spec の射程外 QA 参照、foundation 参照節、SQLite FTS5 / WebMCP の鮮度差分を別変更として正規化する
- exact-13 の旧世代メタデータを再生成し、readiness producer/manifest 解決後にatomic promotionする
- development deploy、smoke、rollback 確認は P13 で実施する
