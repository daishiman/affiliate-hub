# P06 テスト実行レポート

- 実施日: 2026-08-30 JST
- 検証判定: **PASS**
- Beads lifecycle: P05以前の依存がclosedになるまでcloseしない
- 機械可読結果: `test-results/reference-blog-admin-ux/p06/summary.json`

## 品質ゲート

| gate | command | exit / result | artifact |
|---|---|---|---|
| exact-13 plan | `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-reference-blog-admin-ux` | 0 / P01–P13、違反0 | `.dev-graph/published/generations/feature-package-feat-reference-blog-admin-ux/` |
| lint | `pnpm lint` | 0 / error 0 | summary.json |
| type | `pnpm typecheck` | 0 / error 0 | summary.json |
| content | `pnpm content:validate` | 0 / blocker 0、既存の未執筆記事に関するadvisory 1 | summary.json |
| unit・contract・DB integration・a11y・worker | `pnpm test` | 410 files / 9,821 tests PASS、failure 0 | summary.json |
| feature E2E | `PLAYWRIGHT_PORT=8801 pnpm exec playwright test tests/e2e/reference-blog-admin-ux.spec.ts` | 18 PASS / 2 skip / failure 0 | `test-results/playwright/.last-run.json` |
| 全E2E | `PLAYWRIGHT_PORT=8801 pnpm exec playwright test --reporter=dot` | 480 PASS / 2 skip / failure 0（全482） | `test-results/reference-blog-admin-ux/p06/e2e-summary.json`、`test-results/playwright/.last-run.json` |
| focused a11y | `pnpm vitest run --project a11y tests/ui/blog-ops-a11y-floor.test.tsx tests/ui/affiliate-preview-card.test.tsx --reporter=dot` | 11/11 PASS | summary.json |
| focused security | `pnpm vitest run tests/domain/affiliate-preview.test.ts tests/application/preview-affiliate-url.test.ts tests/infrastructure/affiliate-preview-fetcher.test.ts tests/infrastructure/guarded-fetch.test.ts tests/architecture/affiliate-placement-schema.test.ts --reporter=dot` | 26/26 PASS | summary.json |
| 分析再現 | `python3 -m unittest discover -s scripts/reference-site-analysis -p 'test_*.py' -v` | 10/10 PASS | summary.json |
| 非転用 | `pnpm check:reference-reuse` | 83 files、違反0 | summary.json |

E2Eのskip 2件は、mobile projectでの「1280pxを200%で見た相当幅」と「768px/1600px」である。前者はdesktopで640 CSS pxとして、後者はdesktop projectでそれぞれ1回測定した。通常mobile 375pxはほかの全flowで実行済み。同じ条件を二重計測しない明示skipで、未検証の失敗を隠したものではない。

## 性能予算

`docs/spec/feat-reference-blog-admin-ux/test-design.md` の PF-001 に対し、Workers preview のwarm routeで次を確認した。

| project | TTFB | DOMContentLoaded | load | document transfer | result |
|---|---:|---:|---:|---:|---|
| desktop | 63ms | 110ms | 139ms | 14,954 bytes | PASS |
| mobile | 39ms | 64ms | 112ms | 14,954 bytes | PASS |

実測値は `test-results/reference-blog-admin-ux/p06/performance-desktop.json` と `performance-mobile.json` に保存した。これはP06のroute performance gateであり、P09が要求する独立Core Web Vitals監査を代替しない。

## 警告

- jsdomのCanvas未実装警告が出るが、Canvasを必須にしない図解fallbackの試験経路でありfailureではない。
- Next.jsはmiddleware conventionの非推奨を警告する。今回の受け入れ失敗ではないが、別migrationでproxy conventionへ移す余地がある。
- Apple Silicon上でx86 Nodeを使うRosetta警告がある。性能値はこの不利な条件でも予算内だった。
