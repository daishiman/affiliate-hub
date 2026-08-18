# テストから要件を引く表（自動生成）

`node scripts/traceability.mjs` が書き換える。**手で編集しない。**
末尾の指紋がその見張りで、手で 1 文字でも書くと次の実行が**上書きせずに止まる**（書いた行は残る）。
要件 → テストの向きは `docs/product/traceability.md` が正本で、ここはその裏返しに
テスト側の `@req` 印を重ねたもの。

- 最終更新: 2026-08-18
- テストファイル: 165 件
- 由来の要件が分かる: 138 件
- **由来不明: 27 件**（上限 28 件）

由来不明とは「どの要件のために書いたのか、機械から辿れない」という意味で、
テストが無駄という意味ではない。要件から書いたなら `@req` を 1 行足せば消える。

## 由来不明のテスト

- `tests/acceptance/acceptance-criteria.test.ts`
- `tests/application/manage-workspace.test.ts`
- `tests/application/read-site.test.ts`
- `tests/application/reader-interaction.test.ts`
- `tests/application/review-loop-runs.test.ts`
- `tests/architecture/single-definition.test.ts`
- `tests/architecture/spec-freshness.test.ts`
- `tests/architecture/worker-entry.test.ts`
- `tests/domain/loop-kinds.test.ts`
- `tests/domain/metrics-from-telemetry.test.ts`
- `tests/infrastructure/d1-link-inbox.test.ts`
- `tests/infrastructure/db-binding.test.ts`
- `tests/infrastructure/llm-provider-catalog-config.test.ts`
- `tests/infrastructure/session-actor.test.ts`
- `tests/infrastructure/stub-registry.test.ts`
- `tests/integration/d1-feedback.test.ts`
- `tests/integration/d1-site-draft.test.ts`
- `tests/integration/r2-feedback-capture.test.ts`
- `tests/presentation/composition-wiring.test.ts`
- `tests/presentation/contact-action.test.ts`
- `tests/presentation/storage-notice.test.ts`
- `tests/support/support.test.ts`
- `tests/ui/article-frame.test.tsx`
- `tests/ui/copy-dictionary.test.ts`
- `tests/ui/disclosure-text.test.ts`
- `tests/ui/site-wizard-form.test.tsx`
- `tests/ui/telemetry-collector.test.tsx`

## テスト → 要件

| テスト | 要件 | 由来 |
| --- | --- | --- |
| `tests/application/affiliate.test.ts` | REQ-A07, REQ-P09 | 印と表 |
| `tests/application/article-tracking.test.ts` | REQ-E13, REQ-P09 | 印 |
| `tests/application/build-site.test.ts` | REQ-A05, REQ-P07, REQ-S06 | 印と表 |
| `tests/application/dashboard.test.ts` | REQ-S01 | 表 |
| `tests/application/draft-content-variant.test.ts` | REQ-G11 | 印と表 |
| `tests/application/feedback.test.ts` | REQ-FB07, REQ-FB08, REQ-FB09, REQ-FB12 | 印と表 |
| `tests/application/filter-metrics.test.ts` | REQ-P10, REQ-S08 | 印と表 |
| `tests/application/generation-matrix.test.ts` | REQ-A04, REQ-P06, REQ-S05 | 印と表 |
| `tests/application/link-inbox.test.ts` | REQ-P02, REQ-S02 | 印 |
| `tests/application/list-selectable-models.test.ts` | REQ-G11 | 印 |
| `tests/application/manage-content.test.ts` | REQ-QC11, REQ-R11, REQ-SEC07, REQ-SEC09 | 印と表 |
| `tests/application/manage-distribution.test.ts` | REQ-A06 | 印と表 |
| `tests/application/manage-llm-credentials.test.ts` | REQ-SEC01, REQ-SEC05 | 印 |
| `tests/application/manage-personas.test.ts` | REQ-A03, REQ-P05, REQ-S04, REQ-W12 | 印と表 |
| `tests/application/outbound-href.test.ts` | REQ-E13 | 印 |
| `tests/application/publication-calendar.test.ts` | REQ-P08, REQ-S07 | 印と表 |
| `tests/application/publish-article.test.ts` | REQ-P08, REQ-R11 | 印と表 |
| `tests/application/read-llm-usage.test.ts` | REQ-SEC01 | 印 |
| `tests/application/read-product.test.ts` | REQ-A02, REQ-A08 | 印と表 |
| `tests/application/schedule-publication.test.ts` | REQ-P08 | 印と表 |
| `tests/application/writing-method.test.ts` | REQ-W06 | 表 |
| `tests/architecture/ai-eval-budget.test.ts` | REQ-CI13 | 表 |
| `tests/architecture/audit-action-emitters.test.ts` | REQ-SEC09 | 印 |
| `tests/architecture/commercial-isolation.test.ts` | REQ-FD02 | 表 |
| `tests/architecture/dependency-direction.test.ts` | REQ-FD01, REQ-SEC02 | 表 |
| `tests/architecture/generated-docs.test.ts` | REQ-TS09 | 印 |
| `tests/architecture/llm-credential-leak.test.ts` | REQ-SEC01, REQ-SEC05 | 印 |
| `tests/architecture/open-doors.test.ts` | REQ-S10 | 印と表 |
| `tests/architecture/quality-gates.test.ts` | REQ-CI02, REQ-CI09 | 表 |
| `tests/architecture/secrets-not-in-repo.test.ts` | REQ-SEC10 | 印と表 |
| `tests/architecture/server-action-exports.test.ts` | REQ-FD06 | 表 |
| `tests/architecture/tenant-scoped-ports.test.ts` | REQ-P01, REQ-SEC01 | 印と表 |
| `tests/architecture/test-honesty.test.ts` | REQ-CI07 | 表 |
| `tests/architecture/worker-env-wiring.test.ts` | REQ-SEC01 | 印 |
| `tests/domain/article-type-sections.test.ts` | REQ-W02, REQ-W03, REQ-W04, REQ-W05 | 印と表 |
| `tests/domain/authored-sections.test.ts` | REQ-P08 | 表 |
| `tests/domain/boundaries-platform.test.ts` | REQ-P04, REQ-P08, REQ-SEC03, REQ-TS08 | 印と表 |
| `tests/domain/boundaries.test.ts` | REQ-P09, REQ-P10, REQ-QC05, REQ-TS08 | 印と表 |
| `tests/domain/brand-and-disclosure.test.ts` | REQ-SEC06 | 印 |
| `tests/domain/domain-events.test.ts` | REQ-EV01, REQ-EV02, REQ-EV03, REQ-EV04, REQ-EV05, REQ-EV06, REQ-EV07, REQ-EV08, REQ-EV09, REQ-EV10, REQ-EV11, REQ-EV12, REQ-EV13, REQ-EV14, REQ-EV15, REQ-EV16 | 印と表 |
| `tests/domain/entity-guards.test.ts` | REQ-E09, REQ-E10, REQ-E11, REQ-E15 | 印と表 |
| `tests/domain/entity-invariants.test.ts` | REQ-E02, REQ-E05, REQ-E22, REQ-E24, REQ-E26, REQ-E30 | 印 |
| `tests/domain/feedback.test.ts` | REQ-FB03, REQ-FB12 | 表 |
| `tests/domain/generation-plan.test.ts` | REQ-A04, REQ-G01, REQ-G02, REQ-G03, REQ-G04, REQ-G05, REQ-G06, REQ-G07, REQ-G08, REQ-P06, REQ-SEC05 | 印と表 |
| `tests/domain/handoff-prompt.test.ts` | REQ-FB11 | 表 |
| `tests/domain/improvement.test.ts` | REQ-IM01, REQ-IM02, REQ-IM03, REQ-IM04, REQ-IM06, REQ-IM07, REQ-IM08, REQ-IM09, REQ-IM10, REQ-IM11, REQ-IM12 | 印と表 |
| `tests/domain/invariants.test.ts` | REQ-QC02, REQ-QC05, REQ-QC06, REQ-QC08, REQ-QC09, REQ-SEC07, REQ-W08 | 印と表 |
| `tests/domain/link-ingestion.test.ts` | REQ-A01, REQ-P02, REQ-S02 | 印と表 |
| `tests/domain/llm-credential.test.ts` | REQ-SEC01 | 印 |
| `tests/domain/permissions.test.ts` | REQ-API02, REQ-R01, REQ-R02, REQ-R03, REQ-R04, REQ-R05, REQ-R06, REQ-R07, REQ-R08, REQ-R09, REQ-R10, REQ-R11, REQ-R12 | 印 |
| `tests/domain/planning.test.ts` | REQ-E23, REQ-SEC07 | 印と表 |
| `tests/domain/policy-channel-scope.test.ts` | REQ-SEC07 | 印と表 |
| `tests/domain/policy-rule-seed.test.ts` | REQ-QC11, REQ-SEC07 | 印と表 |
| `tests/domain/quality-check-tables.test.ts` | REQ-QC02, REQ-QC03, REQ-QC06, REQ-QC07, REQ-W12 | 印 |
| `tests/domain/records-and-metrics.test.ts` | REQ-SEC09 | 印 |
| `tests/domain/redirect-resolution.test.ts` | REQ-E13 | 印 |
| `tests/domain/site-routes.test.ts` | REQ-B01, REQ-B02, REQ-B03, REQ-B04, REQ-B05, REQ-B06, REQ-B07, REQ-B08, REQ-B09, REQ-B10, REQ-B11, REQ-B13, REQ-B14, REQ-B15, REQ-B16, REQ-B17, REQ-B18, REQ-TM10 | 表 |
| `tests/domain/telemetry-tables.test.ts` | REQ-TM01, REQ-TM04, REQ-TM07, REQ-TM09 | 印と表 |
| `tests/domain/telemetry.test.ts` | REQ-TM02, REQ-TM03, REQ-TM07, REQ-TM08 | 印と表 |
| `tests/domain/writing-rules.test.ts` | REQ-QC01, REQ-QC08, REQ-QC10, REQ-W01, REQ-W09, REQ-W10 | 印と表 |
| `tests/evals/generation-eval-set.test.ts` | REQ-CI13, REQ-G09, REQ-G10 | 印と表 |
| `tests/infrastructure/anthropic-llm.test.ts` | REQ-SEC01, REQ-SEC05 | 印 |
| `tests/infrastructure/better-auth-gate.test.ts` | REQ-S10 | 印 |
| `tests/infrastructure/channel-connector.test.ts` | REQ-P08 | 表 |
| `tests/infrastructure/d1-conversion-repository.test.ts` | REQ-P09 | 表 |
| `tests/infrastructure/entry-gate.test.ts` | REQ-S10 | 印 |
| `tests/infrastructure/guarded-fetch.test.ts` | REQ-SEC02 | 印と表 |
| `tests/infrastructure/llm-connectivity.test.ts` | REQ-SEC01 | 印 |
| `tests/infrastructure/llm-credential-vault.test.ts` | REQ-SEC01, REQ-SEC05 | 印 |
| `tests/infrastructure/llm-provider-catalog.test.ts` | REQ-SEC01 | 印 |
| `tests/infrastructure/llm-providers.test.ts` | REQ-G11, REQ-SEC01, REQ-SEC05 | 印と表 |
| `tests/infrastructure/llm-usage-repository.test.ts` | REQ-SEC01 | 印 |
| `tests/infrastructure/membership-reader.test.ts` | REQ-S10 | 印 |
| `tests/infrastructure/prompt-assembly.test.ts` | REQ-P06 | 表 |
| `tests/infrastructure/session-issuer.test.ts` | REQ-S10 | 印 |
| `tests/infrastructure/stub-ledger.test.ts` | REQ-TS09 | 表 |
| `tests/integration/d1-audit-log.test.ts` | REQ-SEC09 | 印と表 |
| `tests/integration/d1-content.test.ts` | REQ-SEC09 | 印と表 |
| `tests/integration/d1-conversion.test.ts` | REQ-P09 | 印と表 |
| `tests/integration/d1-distribution.test.ts` | REQ-P08 | 印と表 |
| `tests/integration/d1-link-inbox.test.ts` | REQ-S02, REQ-TS07 | 印と表 |
| `tests/integration/d1-published-article.test.ts` | REQ-P08 | 表 |
| `tests/integration/d1-telemetry.test.ts` | REQ-TS07 | 表 |
| `tests/integration/d1-tracking-issuance.test.ts` | REQ-E13, REQ-P09 | 印と表 |
| `tests/integration/full-loop.test.ts` | REQ-TS07 | 表 |
| `tests/presentation/admin-actions.test.ts` | REQ-P08 | 表 |
| `tests/presentation/admin-routes.test.ts` | REQ-P09, REQ-S02, REQ-S03, REQ-S10 | 表 |
| `tests/presentation/api-routes.test.ts` | REQ-M03, REQ-WA02, REQ-WC06 | 印 |
| `tests/presentation/api-scope-actor.test.ts` | REQ-API02, REQ-FB13 | 印 |
| `tests/presentation/composition.test.ts` | REQ-FD04, REQ-S09 | 表 |
| `tests/presentation/entry-points.test.ts` | REQ-API01, REQ-TS04, REQ-WC07, REQ-WC08 | 印と表 |
| `tests/presentation/error-format.test.ts` | REQ-WC07 | 印 |
| `tests/presentation/feedback-actions.test.ts` | REQ-FB08, REQ-FB12 | 表 |
| `tests/presentation/feedback-capture-route.test.ts` | REQ-FB13 | 印と表 |
| `tests/presentation/feedback-pending-route.test.ts` | REQ-FB09 | 表 |
| `tests/presentation/feedback-tools.test.ts` | REQ-WB02 | 印 |
| `tests/presentation/go-route.test.ts` | REQ-E13 | 印 |
| `tests/presentation/llm-credential-actions.test.ts` | REQ-SEC01 | 印 |
| `tests/presentation/llm-credential-entry.test.ts` | REQ-SEC01 | 印 |
| `tests/presentation/nav-permissions.test.ts` | REQ-FB02, REQ-FB07 | 表 |
| `tests/presentation/one-usecase-three-adapters.test.ts` | REQ-API01, REQ-FD04 | 印と表 |
| `tests/presentation/reader-tools.test.ts` | REQ-WB01 | 印 |
| `tests/presentation/readonly-honesty.test.ts` | REQ-WC04 | 印 |
| `tests/presentation/spec-contract.test.ts` | REQ-M01, REQ-M02, REQ-WA01, REQ-WA02 | 印 |
| `tests/presentation/tool-catalog-adapters.test.ts` | REQ-M03, REQ-TS04 | 印と表 |
| `tests/presentation/webmcp-policy.test.ts` | REQ-WC03, REQ-WC04, REQ-WC06 | 印と表 |
| `tests/presentation/webmcp-registration.test.ts` | REQ-WC01, REQ-WC02 | 印 |
| `tests/property/normalization.property.test.ts` | REQ-P02, REQ-P03, REQ-TH01, REQ-TH02, REQ-TH03 | 印と表 |
| `tests/property/publish-gate.property.test.ts` | REQ-QC09, REQ-QC12, REQ-SEC06 | 印と表 |
| `tests/property/ranking.property.test.ts` | REQ-B12, REQ-P04, REQ-SEC04 | 印と表 |
| `tests/property/tenancy.property.test.ts` | REQ-API02, REQ-P01, REQ-R11, REQ-R12, REQ-SEC01 | 印と表 |
| `tests/property/variant-spec.property.test.ts` | REQ-E14, REQ-IM05, REQ-IM06 | 印と表 |
| `tests/ui/adjust-conversion-form.test.tsx` | REQ-P09 | 表 |
| `tests/ui/audit-log-notice.test.tsx` | REQ-SEC09 | 印 |
| `tests/ui/blueprint-theme.test.ts` | REQ-P07, REQ-TH02 | 表 |
| `tests/ui/capture-canvas.test.tsx` | REQ-FB04, REQ-FB05 | 表 |
| `tests/ui/content-progress-form.test.tsx` | REQ-R11 | 印 |
| `tests/ui/design-tokens.test.ts` | REQ-S09, REQ-SEC08, REQ-TS09 | 表 |
| `tests/ui/fact-source.test.ts` | REQ-QC04, REQ-W07 | 印と表 |
| `tests/ui/feedback-admin-forms.test.tsx` | REQ-FB08, REQ-FB12 | 表 |
| `tests/ui/feedback-button.test.tsx` | REQ-FB02, REQ-FB03 | 表 |
| `tests/ui/keyboard-operation.test.tsx` | REQ-B01, REQ-B02, REQ-B03, REQ-B04, REQ-B05, REQ-B06, REQ-B07, REQ-B08, REQ-B09, REQ-B10, REQ-B11, REQ-B12, REQ-B13, REQ-B14, REQ-B15, REQ-B16, REQ-B17, REQ-B18, REQ-P01, REQ-P02, REQ-P03, REQ-P04, REQ-P05, REQ-P06, REQ-P07, REQ-P08, REQ-P09, REQ-P10, REQ-S01, REQ-S02, REQ-S03, REQ-S04, REQ-S05, REQ-S06, REQ-S07, REQ-S08, REQ-S09, REQ-S10, REQ-SEC08, REQ-TH01, REQ-TS05 | 印 |
| `tests/ui/llm-credential-forms.test.tsx` | REQ-SEC01 | 印 |
| `tests/ui/llm-credential-page.test.tsx` | REQ-SEC01 | 印 |
| `tests/ui/model-picker.test.tsx` | REQ-G11 | 印 |
| `tests/ui/page-degraded.test.tsx` | REQ-B01, REQ-B02, REQ-B03, REQ-B04, REQ-B05, REQ-B06, REQ-B07, REQ-B08, REQ-B09, REQ-B10, REQ-B11, REQ-B12, REQ-B13, REQ-B14, REQ-B15, REQ-B16, REQ-B17, REQ-B18, REQ-P01, REQ-P02, REQ-P03, REQ-P04, REQ-P05, REQ-P06, REQ-P07, REQ-P08, REQ-P09, REQ-P10, REQ-S01, REQ-S02, REQ-S03, REQ-S04, REQ-S05, REQ-S06, REQ-S07, REQ-S08, REQ-S09, REQ-S10, REQ-TH01 | 印 |
| `tests/ui/page-empty.test.tsx` | REQ-B01, REQ-B02, REQ-B03, REQ-B04, REQ-B05, REQ-B06, REQ-B07, REQ-B08, REQ-B09, REQ-B10, REQ-B11, REQ-B12, REQ-B13, REQ-B14, REQ-B15, REQ-B16, REQ-B17, REQ-B18, REQ-P01, REQ-P02, REQ-P03, REQ-P04, REQ-P05, REQ-P06, REQ-P07, REQ-P08, REQ-P09, REQ-P10, REQ-S01, REQ-S02, REQ-S03, REQ-S04, REQ-S05, REQ-S06, REQ-S07, REQ-S08, REQ-S09, REQ-S10, REQ-TH01 | 印 |
| `tests/ui/page-render-privileged.test.tsx` | REQ-S10 | 印 |
| `tests/ui/page-render-restricted.test.tsx` | REQ-S09, REQ-S10 | 印 |
| `tests/ui/page-render.test.tsx` | REQ-B01, REQ-B02, REQ-B03, REQ-B04, REQ-B05, REQ-B06, REQ-B07, REQ-B08, REQ-B09, REQ-B10, REQ-B11, REQ-B12, REQ-B13, REQ-B14, REQ-B15, REQ-B16, REQ-B17, REQ-B18, REQ-FB07, REQ-FB08, REQ-P01, REQ-P02, REQ-P03, REQ-P04, REQ-P05, REQ-P06, REQ-P07, REQ-P08, REQ-P09, REQ-P10, REQ-S01, REQ-S02, REQ-S03, REQ-S04, REQ-S05, REQ-S06, REQ-S07, REQ-S08, REQ-S09, REQ-S10, REQ-SEC08, REQ-TH01, REQ-TS05 | 印と表 |
| `tests/ui/patterns-render.test.tsx` | REQ-SEC08 | 表 |
| `tests/ui/publish-article-form.test.tsx` | REQ-P08 | 表 |
| `tests/ui/publish-article-result.test.tsx` | REQ-P08 | 表 |
| `tests/ui/schedule-publication-form.test.tsx` | REQ-P08 | 表 |
| `tests/ui/site-not-found.test.tsx` | REQ-B01 | 表 |
| `tests/ui/theme-contrast.test.ts` | REQ-TH02, REQ-TS06 | 表 |
| `tests/ui/tool-form.test.tsx` | REQ-WC05 | 印と表 |
| `tests/ui/ui-layers.test.ts` | REQ-S09, REQ-TM05, REQ-TM06 | 表 |
<!-- 生成物の指紋 sha256:854bdca652e303b0b7341bef366ad5c897a21e0f458200414d660b3474c38d61 -->
