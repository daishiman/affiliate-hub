# 現行画面 gap ledger

| GAP | 対象 | 現行根拠 | 再利用 | 不足/対応 |
|---|---|---|---|---|
| G01 | 公開header/body/sidebar/footer | `src/presentation/site/page-frame.tsx`, `blog-article-view.tsx` | 公開shellと2カラムは実装済み | 参照元非依存のtoken/component対応表がない |
| G02 | 図解block | `src/presentation/site/blog-article-view.tsx` | figure/comparison/summary系blockを再利用 | 写真なし時の一貫fallback表示を追加 |
| G03 | 新規記事 | `/admin/blog/articles/new` | template→最小下書きは実装済み | 主操作を「下書きを作る」1つに固定し端末下書きを配線 |
| G04 | 記事保存 | `blog-article-form.tsx`, `blog-ops-state.ts` | `useActionState`, `use-draft.ts`, `FormResult` | 5状態、revision、保存時刻、競合、復元が不足 |
| G05 | 改善 | `/admin/improvement` | 実験loopはそのまま保持 | article block単位のbefore/after、個別適用、preview、undoが不足 |
| G06 | affiliate URL受付 | `/admin/inbox`, `manage-link-inbox.ts` | URL正規化、重複claim、state machine、audit | 貼付直後のrich previewが不足 |
| G07 | preview security | `src/infrastructure/http/guarded-fetch.ts` | redirect毎検査、private deny、timeout、2MB上限を再利用 | HTML/JSON-LD解析、content-type制限、失敗理由表示が不足 |
| G08 | affiliate list | `/admin/affiliate/links` | snapshot付き一覧、state、disable | merchant/price/retrieved/source/last checked/filter/placement countが不足 |
| G09 | placement | `blog_affiliate_placement` | 既存tableとsite/article/position列 | affiliate link FK、block、status、workspace-first index、repo/usecase/UIが不足 |
| G10 | seed/auth | `scripts/seed/local-seed-data.ts`, `/api/dev-signin` | 11記事と `owner@local.test` を再利用 | preview metadataとplacementの検証data、`.dev.vars`の明示手順が不足 |

