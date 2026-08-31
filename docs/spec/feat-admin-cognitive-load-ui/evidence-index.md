# P11 証跡索引

## 対象識別子

- feature: `feat-admin-cognitive-load-ui`
- base HEAD: `1c36171972301001e24043e815c580736c51b1bc`
- commit: 未作成（利用者指示どおり commit / push / PR なし）
- working-tree digest: 最終差分を `git diff --binary -- src/app/admin src/presentation/ui src/presentation/admin/admin-shell.tsx 'src/presentation/admin/*-form.tsx' 'src/presentation/admin/*-forms.tsx' src/presentation/admin/delete-confirm.tsx scripts/seed/local-seed-data.ts scripts/visual-regression.tsx scripts/write-static-preview.tsx tests docs/spec/feat-admin-cognitive-load-ui system-spec features/feat-admin-cognitive-load-ui.context.json | shasum -a 256` で照合する。`src/presentation/admin` は P05/P08 の明示許可ファイルだけを含め、既存の `docs/product/**` とそれ以外の共有dirty差分は本featureへ帰属させない

## 受入 12 件の索引

| AC | 検査コマンド | 出力 / 根拠 |
| --- | --- | --- |
| 01 | feature Vitest | `evidence/route-ledger-audit.md`、`screen-information-ledger.json` |
| 02 | feature Vitest | `evidence/route-ledger-audit.md`、`representation-rule-table.json` |
| 03 | feature Playwright | `evidence/browser-evidence.md`、`table-readability-contract.md` |
| 04 | visual + UI test | `design-review-report.md`、`card-hierarchy-contract.md` |
| 05 | UI test + Playwright | `evidence/browser-evidence.md`、`acceptance-report.md` |
| 06 | UI test | `sidebar-spacing-contract.md`、`evidence/test-evidence.md` |
| 07 | feature Vitest | `progressive-disclosure-contract.md`、`migration-report.md` |
| 08 | full Playwright / approval contract tests | `acceptance-report.md`、`evidence/test-evidence.md` |
| 09 | UI test | `state-matrix.md`、`quality-assurance-report.md` |
| 10 | visual + UI test | `quality-assurance-report.md`、`evidence/test-evidence.md` |
| 11 | feature Playwright | `evidence/browser-evidence.md` |
| 12 | integration test | `non-regression-contract.md`、`evidence/test-evidence.md` |

## 再現順

1. `pnpm install --frozen-lockfile`
2. `pnpm db:migrate:local && pnpm seed:local`
3. `pnpm typecheck && pnpm lint`
4. `pnpm exec vitest run tests/acceptance/feat-admin-cognitive-load-ui/ledger-contract.test.ts tests/ui/admin-cognitive-load-ui.test.tsx tests/integration/admin-cognitive-load-ui-nonregression.test.ts tests/ui/table-through-component.test.ts tests/ui/nav-collapse-toggle-interaction.test.tsx tests/ui/field-keyboard-interaction.test.tsx --coverage.enabled=false`
5. `pnpm exec playwright test tests/e2e/admin-cognitive-load-ui.spec.ts`
6. `pnpm test:e2e`
7. `pnpm visual`
8. `pnpm verify`
9. `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-admin-cognitive-load-ui`
10. `pnpm exec opennextjs-cloudflare deploy -- --env dev --minify`（外部変更の明示確認後、devのみ）

## 反映先

- local: `http://localhost:3002`（PID 13897、`owner@local.test`、passwordなし）
- dev: `https://affiliate-hub-dev.daishimanju.workers.dev`
- dev version: `e5d96696-b166-4091-8a1b-daefa4cf934d`
- production / commit / push / PR: 変更なし
