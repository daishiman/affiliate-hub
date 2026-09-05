# 証跡索引 — ブログ独自ドメイン

## 実装

| 層 | ファイル |
|---|---|
| domain | `src/domain/domains/custom-domain.ts` (226 行) |
| ports | `src/application/ports/blog-domains.ts` |
| usecase | `src/application/usecases/blog-ops/manage-custom-domains.ts` (334 行) |
| infrastructure (外部) | `src/infrastructure/domains/cloudflare-custom-hostname.ts` (313 行) |
| infrastructure (保存) | `src/infrastructure/persistence/d1/custom-domain-repository.ts` |
| schema | `src/db/schema.ts` (`siteCustomDomains`) |
| migration | `drizzle/0044_funny_groot.sql` |
| 画面 | `src/app/admin/sites/[site]/domains/page.tsx` (153 行) |
| 画面部品 | `src/presentation/admin/publish/blog-domain-form.tsx` |
| 入口 (関連) | `src/middleware.ts` / `src/domain/authoring/site-host-routing.ts` |

## 試験

| ファイル | 件数 |
|---|---|
| `tests/application/manage-custom-domains.test.ts` | 22 |
| `tests/integration/d1-custom-domain.test.ts` (workerd 実機) | 13 |
| `tests/domain/entity-invariants.test.ts` (一部) | — |
| `tests/architecture/tenant-scoped-schema.test.ts` (一部) | — |
| `tests/architecture/tenant-scoped-ports.test.ts` (一部) | — |

該当 3 ファイルの実行: 83 passed / exit 0。全件: 479 files / 10865 tests / exit 0。

## 文書

`requirements-baseline.md` / `domain-state-machine.md` / `screen-inventory.md` /
`data-model.md` / `admin-api-contract.md` / `host-resolution-design.md` /
`design-review-findings.md` / `invariant-checklist.md` / `test-plan.md` / `test-cases.md` /
`test-run-report.md` / `acceptance-report.md` / `migration-notes.md` / `quality-report.md` /
`final-review.md` / `evidence-index.md` / `operations-runbook.md` / `release-notes.md`

## 上流

- `features/feat-blog-custom-domain.context.json` (受入条件の正本)
- `architecture/arch-blog-operations-console.md` (住所層 / AD-1 / AD-5)
- `system-spec/infrastructure.md` (`qa-infra-web-custom-hostname`)
- `tasks/feat-blog-custom-domain/sys-blog-custom-domain-p01..p13.md`
