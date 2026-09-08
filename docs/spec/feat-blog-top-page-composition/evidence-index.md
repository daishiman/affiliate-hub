# 証跡索引 — ブログトップページ構成 MVP

更新日: 2026-09-08

| 対象 | 再実行方法 | 2026-09-08 の結果 |
|---|---|---|
| トップページ構成 | `pnpm vitest run tests/blog-top-page tests/application/blog-home-featured-articles.test.ts tests/ui/blog-top-bands.test.tsx tests/ui/public-site-projection.test.ts tests/ui/reader-discovery.test.tsx` | 対象11 files / 67 tests PASS |
| TypeScript | `pnpm typecheck` | PASS |
| exact-13 task 仕様 | `python3 /Users/dm/.codex/plugins/cache/harness-dev/system-dev-planner/0.1.11/scripts/validate-system-plan.py --repo-root . --staging .dev-graph/staging/run-20260908-final-review-blog-top` | PASS / `sha256:a3ead33cd3c445dbd86ac6bb7b301323862bd442b445d6160e30036b75f9f680` |
| Drizzle snapshot | `pnpm exec drizzle-kit check` | PASS / collision なし |
| spec-state merge | `python3 -m pytest .claude/plugins/system-spec-harness/tests/test_spec_state_merge.py` | 16 passed |
| 型付き factory | 対象15テストファイルを `pnpm vitest run` | 138 passed |
| matrix 完全性 | `validate-coverage-matrix.py` の全6 opt-in | PASS |

## 未取得の証跡

- axe-core のブラウザ結果
- light/dark のコントラスト測定
- Core Web Vitals の CLS 測定
- development 環境の smoke / rollback

これらが無いため、本索引は feature 完了証明ではなく、draft PR の再現手順である。
