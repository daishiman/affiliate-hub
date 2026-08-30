# テストから要件を引く表（自動生成）

`node scripts/traceability.mjs` が書き換える。**手で編集しない。**
末尾の指紋がその見張りで、手で 1 文字でも書くと次の実行が**上書きせずに止まる**（書いた行は残る）。
要件 → テストの向きは `docs/product/traceability.md` が正本で、ここはその裏返しに
テスト側の `@req` 印を重ねたもの。

- 最終更新: 2026-08-30
- テストファイル: 413 件
- 由来の要件が分かる: 413 件
- **由来不明: 0 件**（上限 2 件）

由来不明とは「どの要件のために書いたのか、機械から辿れない」という意味で、
テストが無駄という意味ではない。要件から書いたなら `@req` を 1 行足せば消える。

## 由来不明のテスト

なし。

## テスト → 要件

| テスト | 要件 | 由来 |
| --- | --- | --- |
| `tests/acceptance/acceptance-criteria.test.ts` | REQ-A01, REQ-A02, REQ-A03, REQ-A04, REQ-A05, REQ-A06, REQ-A07, REQ-A08 | 印 |
| `tests/acceptance/feat-auth-workspace/access-boundary.test.ts` | REQ-API02, REQ-P01, REQ-R07, REQ-R11, REQ-S10, REQ-SEC01 | 印 |
| `tests/acceptance/feat-auth-workspace/admin-entry-middleware.test.ts` | REQ-API02, REQ-S10, REQ-SEC01 | 印 |
| `tests/acceptance/feat-auth-workspace/brand-defaults-wiring.test.ts` | REQ-E04, REQ-G02, REQ-P01 | 印 |
| `tests/acceptance/feat-auth-workspace/brand-defaults.test.ts` | REQ-E04, REQ-G02, REQ-P01 | 印 |
| `tests/acceptance/feat-auth-workspace/denial-audit.test.ts` | REQ-P01, REQ-R08, REQ-SEC01, REQ-SEC09 | 印 |
| `tests/application/access-denial-recording.test.ts` | REQ-SEC01, REQ-SEC09 | 印 |
| `tests/application/affiliate.test.ts` | REQ-A07, REQ-P09 | 印と表 |
| `tests/application/ai-usage-report.test.ts` | REQ-TM03 | 印と表 |
| `tests/application/article-tracking.test.ts` | REQ-E13, REQ-P09 | 印 |
| `tests/application/audit-actor-identity.test.ts` | REQ-SEC09 | 印 |
| `tests/application/audit-entry-build.test.ts` | REQ-P01, REQ-R08 | 印 |
| `tests/application/blog-delivery-check.test.ts` | REQ-BLOG04, REQ-BOPS08 | 印と表 |
| `tests/application/blog-ops-storage-failures.test.ts` | REQ-BOPS01, REQ-BOPS02, REQ-BOPS03, REQ-BOPS04, REQ-BOPS06, REQ-BOPS07, REQ-BOPS08, REQ-BOPS09, REQ-BOPS10 | 印 |
| `tests/application/blog-ops-usecases.test.ts` | REQ-BLOG04, REQ-BOPS01, REQ-BOPS02, REQ-BOPS03, REQ-BOPS04, REQ-BOPS05, REQ-BOPS06, REQ-BOPS07, REQ-BOPS08, REQ-BOPS09, REQ-BOPS10 | 印と表 |
| `tests/application/build-site.test.ts` | REQ-A05, REQ-P07, REQ-S06 | 印と表 |
| `tests/application/capacity.test.ts` | REQ-P01 | 印 |
| `tests/application/concept-drafts.test.ts` | REQ-UX02 | 印 |
| `tests/application/dashboard.test.ts` | REQ-S01 | 表 |
| `tests/application/draft-content-variant.test.ts` | REQ-G11 | 印と表 |
| `tests/application/edit-content.test.ts` | REQ-UX02 | 印 |
| `tests/application/edit-product.test.ts` | REQ-UX02 | 印 |
| `tests/application/edit-sites.test.ts` | REQ-UX03 | 印 |
| `tests/application/execute-due-publications.test.ts` | REQ-A06 | 印 |
| `tests/application/explain-telemetry.test.ts` | REQ-TM10 | 印と表 |
| `tests/application/feedback.test.ts` | REQ-FB07, REQ-FB08, REQ-FB09, REQ-FB12 | 印と表 |
| `tests/application/filter-metrics.test.ts` | REQ-P10, REQ-S08 | 印と表 |
| `tests/application/generation-matrix.test.ts` | REQ-A04, REQ-P06, REQ-S05 | 印と表 |
| `tests/application/link-inbox.test.ts` | REQ-P02, REQ-S02 | 印と表 |
| `tests/application/list-improvement-dimensions.test.ts` | REQ-FD02, REQ-P10 | 印 |
| `tests/application/list-selectable-models.test.ts` | REQ-G11 | 印 |
| `tests/application/manage-affiliate-links.test.ts` | REQ-E13 | 印 |
| `tests/application/manage-compliance.test.ts` | REQ-QC09, REQ-QC11, REQ-SEC06, REQ-SEC07, REQ-SEC09 | 印と表 |
| `tests/application/manage-contact.test.ts` | REQ-B18 | 印 |
| `tests/application/manage-content-packages.test.ts` | REQ-A03, REQ-P05 | 印 |
| `tests/application/manage-content.test.ts` | REQ-QC11, REQ-R11, REQ-SEC07, REQ-SEC09 | 印と表 |
| `tests/application/manage-distribution.test.ts` | REQ-A06 | 印と表 |
| `tests/application/manage-evidence.test.ts` | REQ-B01, REQ-P05 | 印 |
| `tests/application/manage-guideline-references.test.ts` | REQ-SEC01, REQ-SEO05 | 印と表 |
| `tests/application/manage-llm-credentials.test.ts` | REQ-SEC01, REQ-SEC05 | 印 |
| `tests/application/manage-members.test.ts` | REQ-P01 | 印 |
| `tests/application/manage-personas.test.ts` | REQ-A03, REQ-P05, REQ-S04, REQ-W12 | 印と表 |
| `tests/application/manage-rankings.test.ts` | REQ-B01, REQ-P05 | 印 |
| `tests/application/manage-site-documents.test.ts` | REQ-S06, REQ-W10 | 印 |
| `tests/application/manage-sites.test.ts` | REQ-S06, REQ-W10 | 印 |
| `tests/application/manage-workspace.test.ts` | REQ-E03, REQ-P01, REQ-R10 | 印 |
| `tests/application/outbound-href.test.ts` | REQ-E13 | 印 |
| `tests/application/preview-affiliate-url.test.ts` | REQ-A07, REQ-P02 | 印 |
| `tests/application/publication-calendar.test.ts` | REQ-P08, REQ-S07 | 印と表 |
| `tests/application/publish-article.test.ts` | REQ-P08, REQ-R11, REQ-SEO03 | 印と表 |
| `tests/application/rank-products.test.ts` | REQ-FD02, REQ-P04 | 印 |
| `tests/application/read-generation-plan.test.ts` | REQ-G01 | 印 |
| `tests/application/read-llm-usage.test.ts` | REQ-SEC01 | 印 |
| `tests/application/read-metrics.test.ts` | REQ-E28, REQ-FD02, REQ-P10 | 印と表 |
| `tests/application/read-product.test.ts` | REQ-A02, REQ-A08 | 印と表 |
| `tests/application/read-site.test.ts` | REQ-B01, REQ-B02, REQ-B08, REQ-B10, REQ-B11, REQ-B16, REQ-B17 | 印 |
| `tests/application/reader-interaction.test.ts` | REQ-TS01 | 表 |
| `tests/application/record-telemetry.test.ts` | REQ-P10 | 印 |
| `tests/application/register-affiliate-link.test.ts` | REQ-A07, REQ-E13 | 印 |
| `tests/application/register-channel-connection.test.ts` | REQ-A06 | 印 |
| `tests/application/review-loop-runs.test.ts` | REQ-IM01, REQ-IM08, REQ-IM09 | 印 |
| `tests/application/run-improvement-loop.test.ts` | REQ-IM06, REQ-IM09 | 印 |
| `tests/application/save-affiliate.test.ts` | REQ-A07, REQ-P09 | 印 |
| `tests/application/schedule-publication.test.ts` | REQ-P08 | 印と表 |
| `tests/application/seo/ai-search-audit.test.ts` | REQ-SEO03 | 印と表 |
| `tests/application/seo/expression-blocks.test.ts` | REQ-SEO03 | 印と表 |
| `tests/application/seo/feeds.test.ts` | REQ-SEO02 | 印と表 |
| `tests/application/seo/structured-data.test.ts` | REQ-SEO01 | 印と表 |
| `tests/application/writing-method.test.ts` | REQ-W01, REQ-W02, REQ-W05, REQ-W06, REQ-W07, REQ-W08, REQ-W09 | 印と表 |
| `tests/architecture/acceptance-reconciliation.test.ts` | REQ-UX01, REQ-UX02, REQ-UX03, REQ-UX04, REQ-UX05, REQ-UX06, REQ-UX07, REQ-UX08, REQ-UX09, REQ-UX10 | 印 |
| `tests/architecture/actions-usage.test.ts` | REQ-CI14 | 印と表 |
| `tests/architecture/admin-component-orphans.test.ts` | REQ-UX06 | 印 |
| `tests/architecture/affiliate-content-harness.test.ts` | REQ-QC03, REQ-QC05, REQ-QC12 | 印 |
| `tests/architecture/affiliate-placement-schema.test.ts` | REQ-A07, REQ-FD06 | 印 |
| `tests/architecture/ai-eval-budget.test.ts` | REQ-CI13 | 表 |
| `tests/architecture/appearance-single-source.test.ts` | REQ-TH03, REQ-TH04 | 印と表 |
| `tests/architecture/architecture-doc-consistency.test.ts` | REQ-TS09 | 印 |
| `tests/architecture/audit-action-emitters.test.ts` | REQ-SEC09 | 印と表 |
| `tests/architecture/backlog-item-floor.test.ts` | REQ-TS17 | 印 |
| `tests/architecture/blog-ops-content-separation.test.ts` | REQ-BOPS05, REQ-BOPS14, REQ-FD06 | 印と表 |
| `tests/architecture/blog-ops-spec-governance.test.ts` | REQ-BOPS13, REQ-BOPS14, REQ-FD06 | 印と表 |
| `tests/architecture/blog-ui-spec-governance.test.ts` | REQ-SEO01, REQ-SEO02, REQ-SEO03 | 印 |
| `tests/architecture/chapter-normative-body-unreproducible.test.ts` | REQ-TS15 | 印 |
| `tests/architecture/chapter-regeneration-floor.test.ts` | REQ-TS15 | 印と表 |
| `tests/architecture/ci-budget.test.ts` | REQ-CI12 | 印と表 |
| `tests/architecture/ci-config.test.ts` | REQ-CI01, REQ-CI02, REQ-CI03, REQ-CI04, REQ-CI05, REQ-CI06, REQ-CI07, REQ-CI09, REQ-CI10, REQ-CI11, REQ-CI13 | 印と表 |
| `tests/architecture/commercial-isolation.test.ts` | REQ-FD02 | 印と表 |
| `tests/architecture/component-contract-identity.test.ts` | REQ-UX06 | 印 |
| `tests/architecture/dependency-direction.test.ts` | REQ-FD01, REQ-FD02, REQ-SEC02, REQ-SEC04, REQ-TM12, REQ-TS09 | 印と表 |
| `tests/architecture/doc-source-version-gap.test.ts` | REQ-TS14 | 印と表 |
| `tests/architecture/doctrine-citation-gap.test.ts` | REQ-TS13 | 印と表 |
| `tests/architecture/doctrine-clause-citation.test.ts` | REQ-TS13 | 印 |
| `tests/architecture/documentation-links.test.ts` | REQ-TS09 | 印 |
| `tests/architecture/entity-domain-types.test.ts` | REQ-E01, REQ-E16, REQ-E32 | 印 |
| `tests/architecture/feat-auth-workspace-artifact-boundaries.test.ts` | REQ-SEC01 | 印 |
| `tests/architecture/form2-population-floor.test.ts` | REQ-TS17 | 印と表 |
| `tests/architecture/generated-doc-freshness.test.ts` | REQ-TS09 | 印 |
| `tests/architecture/generated-docs.test.ts` | REQ-TS09 | 印 |
| `tests/architecture/guard-inline-python-hole.test.ts` | REQ-FD06 | 印 |
| `tests/architecture/guideline-reevaluation-migration.test.ts` | REQ-SEO05 | 印と表 |
| `tests/architecture/llm-credential-leak.test.ts` | REQ-SEC01, REQ-SEC05 | 印 |
| `tests/architecture/mutation-config-alias.test.ts` | REQ-CI09, REQ-TS09 | 印 |
| `tests/architecture/native-dependencies.test.ts` | REQ-CI01 | 印 |
| `tests/architecture/open-doors.test.ts` | REQ-S10, REQ-TS12 | 印と表 |
| `tests/architecture/package-manager-source.test.ts` | REQ-CI01 | 印と表 |
| `tests/architecture/qa-scope-notes-coverage.test.ts` | REQ-TS19 | 印と表 |
| `tests/architecture/qa-source-digest-meaning.test.ts` | REQ-TS20 | 印と表 |
| `tests/architecture/quality-gates.test.ts` | REQ-CI02, REQ-CI03, REQ-CI09, REQ-TS09, REQ-TS10 | 印 |
| `tests/architecture/reference-reuse-gate.test.ts` | REQ-BOPS13 | 印 |
| `tests/architecture/refusal-field-wiring.test.ts` | REQ-FD06 | 印 |
| `tests/architecture/reopen-discard-restore-gap.test.ts` | REQ-TS21 | 印と表 |
| `tests/architecture/required-test-types-registry-scope.test.ts` | REQ-TS09 | 印 |
| `tests/architecture/schema-drift.test.ts` | REQ-CI15 | 印と表 |
| `tests/architecture/schema-version-prose-drift.test.ts` | REQ-TS16 | 印 |
| `tests/architecture/screen-budget-single-source.test.ts` | REQ-TS09 | 印 |
| `tests/architecture/secrets-not-in-repo.test.ts` | REQ-CI07, REQ-SEC10 | 印と表 |
| `tests/architecture/seed-and-sample-agree.test.ts` | REQ-FD06 | 印 |
| `tests/architecture/seed-covers-cases.test.ts` | REQ-FD06 | 印 |
| `tests/architecture/server-action-exports.test.ts` | REQ-FD06 | 印と表 |
| `tests/architecture/single-definition.test.ts` | REQ-FD05, REQ-TS09 | 印と表 |
| `tests/architecture/spec-chapter-fences.test.ts` | REQ-TS11 | 印と表 |
| `tests/architecture/spec-compiler-fence-seal.test.ts` | REQ-TS18 | 印と表 |
| `tests/architecture/spec-doc-links.test.ts` | REQ-CI08 | 印と表 |
| `tests/architecture/spec-freshness.test.ts` | REQ-FD06 | 印 |
| `tests/architecture/spec-state-writer-gap.test.ts` | REQ-TS16 | 印 |
| `tests/architecture/static-preview-writer.test.ts` | REQ-TS12 | 印と表 |
| `tests/architecture/tenant-scoped-ports.test.ts` | REQ-P01, REQ-SEC01 | 印と表 |
| `tests/architecture/tenant-scoped-schema.test.ts` | REQ-P01, REQ-SEC01 | 印 |
| `tests/architecture/test-foundation.test.ts` | REQ-TS01 | 印と表 |
| `tests/architecture/test-honesty.test.ts` | REQ-CI07, REQ-CI14 | 表 |
| `tests/architecture/webmcp-reachability.test.ts` | REQ-FD04 | 印と表 |
| `tests/architecture/worker-entry.test.ts` | REQ-FB04 | 印 |
| `tests/architecture/worker-env-wiring.test.ts` | REQ-SEC01 | 印 |
| `tests/architecture/writer-absence.test.ts` | REQ-TS16 | 印と表 |
| `tests/architecture/written-source-quotation.test.ts` | REQ-TS18 | 印 |
| `tests/domain/affiliate-preview.test.ts` | REQ-A07, REQ-P02 | 印 |
| `tests/domain/article-outline.test.ts` | REQ-BLOG04 | 印 |
| `tests/domain/article-type-sections.test.ts` | REQ-W02, REQ-W03, REQ-W04, REQ-W05 | 印と表 |
| `tests/domain/authored-sections.test.ts` | REQ-P08 | 印と表 |
| `tests/domain/authoring/blog-template.test.ts` | REQ-BLOG01, REQ-BLOG02 | 印と表 |
| `tests/domain/blog-delivery-snapshot.test.ts` | REQ-BLOG04, REQ-BOPS08 | 印と表 |
| `tests/domain/blog-ops.test.ts` | REQ-BLOG03, REQ-BOPS01, REQ-BOPS04, REQ-BOPS06, REQ-BOPS09, REQ-BOPS10 | 印と表 |
| `tests/domain/blog-tag-cloud.test.ts` | REQ-BLOG04, REQ-BOPS07 | 印と表 |
| `tests/domain/blogops/operational-health.test.ts` | REQ-BOPS10 | 印と表 |
| `tests/domain/blogops/prose-format.test.ts` | REQ-BLOG05 | 印と表 |
| `tests/domain/boundaries-platform.test.ts` | REQ-P04, REQ-P08, REQ-SEC03, REQ-TS01, REQ-TS08 | 印と表 |
| `tests/domain/boundaries.test.ts` | REQ-P09, REQ-P10, REQ-QC05, REQ-TS08 | 印と表 |
| `tests/domain/brand-and-disclosure.test.ts` | REQ-SEC06 | 印 |
| `tests/domain/custom-html-sanitize.test.ts` | REQ-BLOG04 | 印 |
| `tests/domain/differentiation-paraphrase.test.ts` | REQ-W10 | 印 |
| `tests/domain/domain-events.test.ts` | REQ-EV01, REQ-EV02, REQ-EV03, REQ-EV04, REQ-EV05, REQ-EV06, REQ-EV07, REQ-EV08, REQ-EV09, REQ-EV10, REQ-EV11, REQ-EV12, REQ-EV13, REQ-EV14, REQ-EV15, REQ-EV16 | 印と表 |
| `tests/domain/entity-enumerations.test.ts` | REQ-E01, REQ-E31, REQ-E32 | 印 |
| `tests/domain/entity-guards.test.ts` | REQ-E09, REQ-E10, REQ-E11, REQ-E15, REQ-E16 | 印と表 |
| `tests/domain/entity-inputs.test.ts` | REQ-E01, REQ-E03, REQ-E04, REQ-E06, REQ-E07, REQ-E08, REQ-E12, REQ-E14, REQ-E17, REQ-E18, REQ-E19, REQ-E20, REQ-E21, REQ-E25, REQ-E27, REQ-E28, REQ-E29 | 印 |
| `tests/domain/entity-invariants.test.ts` | REQ-E02, REQ-E05, REQ-E22, REQ-E24, REQ-E26, REQ-E30 | 印と表 |
| `tests/domain/entity-states.test.ts` | REQ-E19, REQ-E25, REQ-E27 | 印 |
| `tests/domain/external-publication-gate.test.ts` | REQ-A06 | 印 |
| `tests/domain/feedback-retention.test.ts` | REQ-FB08, REQ-FB10, REQ-TM09 | 印と表 |
| `tests/domain/feedback.test.ts` | REQ-FB03, REQ-FB06, REQ-FB12, REQ-TS01 | 印と表 |
| `tests/domain/generation-plan.test.ts` | REQ-A04, REQ-G01, REQ-G02, REQ-G03, REQ-G04, REQ-G05, REQ-G06, REQ-G07, REQ-G08, REQ-P06, REQ-SEC05 | 印と表 |
| `tests/domain/handoff-prompt.test.ts` | REQ-FB10, REQ-FB11 | 印と表 |
| `tests/domain/improvement.test.ts` | REQ-IM01, REQ-IM02, REQ-IM03, REQ-IM04, REQ-IM06, REQ-IM07, REQ-IM08, REQ-IM09, REQ-IM10, REQ-IM11, REQ-IM12 | 印と表 |
| `tests/domain/invariants.test.ts` | REQ-FD03, REQ-QC02, REQ-QC05, REQ-QC06, REQ-QC08, REQ-QC09, REQ-QC12, REQ-SEC07, REQ-W08 | 印と表 |
| `tests/domain/link-ingestion.test.ts` | REQ-A01, REQ-P02, REQ-S02 | 印と表 |
| `tests/domain/llm-credential.test.ts` | REQ-SEC01 | 印 |
| `tests/domain/loop-kinds.test.ts` | REQ-FB01 | 印 |
| `tests/domain/loop-record.test.ts` | REQ-IM13 | 印 |
| `tests/domain/membership-write.test.ts` | REQ-P01 | 印 |
| `tests/domain/metrics-from-telemetry.test.ts` | REQ-P10, REQ-TM01, REQ-TM04 | 印 |
| `tests/domain/permissions.test.ts` | REQ-API02, REQ-R01, REQ-R02, REQ-R03, REQ-R04, REQ-R05, REQ-R06, REQ-R07, REQ-R08, REQ-R09, REQ-R10, REQ-R11, REQ-R12 | 印と表 |
| `tests/domain/planning.test.ts` | REQ-E23, REQ-P06, REQ-SEC07 | 印と表 |
| `tests/domain/policy-channel-scope.test.ts` | REQ-SEC07 | 印と表 |
| `tests/domain/policy-rule-seed.test.ts` | REQ-QC11, REQ-SEC07 | 印と表 |
| `tests/domain/quality-check-tables.test.ts` | REQ-QC02, REQ-QC03, REQ-QC05, REQ-QC06, REQ-QC07, REQ-W08, REQ-W12 | 印 |
| `tests/domain/reader-tool-formula.test.ts` | REQ-B07 | 印 |
| `tests/domain/records-and-metrics.test.ts` | REQ-E32, REQ-SEC09 | 印 |
| `tests/domain/redirect-resolution.test.ts` | REQ-E13 | 印 |
| `tests/domain/seo/guideline-reference.test.ts` | REQ-SEO05 | 印と表 |
| `tests/domain/seo/indexnow.test.ts` | REQ-SEO04 | 印と表 |
| `tests/domain/site-routes.test.ts` | REQ-B01, REQ-B02, REQ-B03, REQ-B04, REQ-B05, REQ-B06, REQ-B07, REQ-B08, REQ-B09, REQ-B10, REQ-B11, REQ-B13, REQ-B14, REQ-B15, REQ-B16, REQ-B17, REQ-B18, REQ-FB07, REQ-TM10 | 表 |
| `tests/domain/telemetry-tables.test.ts` | REQ-TM01, REQ-TM04, REQ-TM07, REQ-TM09 | 印と表 |
| `tests/domain/telemetry.test.ts` | REQ-TM02, REQ-TM03, REQ-TM07, REQ-TM08 | 印と表 |
| `tests/domain/tenancy-boundary-wording.test.ts` | REQ-SEC01, REQ-SEC09 | 印 |
| `tests/domain/writing-rules.test.ts` | REQ-QC01, REQ-QC08, REQ-QC10, REQ-S06, REQ-W01, REQ-W09, REQ-W10 | 印と表 |
| `tests/domain/writing-style-tables.test.ts` | REQ-W06, REQ-W08, REQ-W11 | 印と表 |
| `tests/domain/zz-probe-forbidden.test.ts` | REQ-TM01, REQ-TM09 | 印 |
| `tests/evals/generation-eval-set.test.ts` | REQ-CI13, REQ-G09, REQ-G10 | 印と表 |
| `tests/infrastructure/affiliate-preview-fetcher.test.ts` | REQ-P02 | 印 |
| `tests/infrastructure/anthropic-llm.test.ts` | REQ-SEC01, REQ-SEC05 | 印 |
| `tests/infrastructure/better-auth-gate.test.ts` | REQ-S10 | 印 |
| `tests/infrastructure/bluesky-connector.test.ts` | REQ-A06 | 印 |
| `tests/infrastructure/cache-kv.test.ts` | REQ-TS03, REQ-TS08 | 印 |
| `tests/infrastructure/channel-connector.test.ts` | REQ-P08 | 印と表 |
| `tests/infrastructure/d1-affiliate-link-offers.test.ts` | REQ-E12, REQ-E13 | 印 |
| `tests/infrastructure/d1-affiliate-program-repository.test.ts` | REQ-A07 | 印 |
| `tests/infrastructure/d1-contact-repository.test.ts` | REQ-B18 | 印 |
| `tests/infrastructure/d1-content-package-repository.test.ts` | REQ-B01, REQ-P05 | 印 |
| `tests/infrastructure/d1-conversion-repository.test.ts` | REQ-P09 | 表 |
| `tests/infrastructure/d1-evidence-repository.test.ts` | REQ-B01, REQ-P05 | 印 |
| `tests/infrastructure/d1-guideline-reference-repository.test.ts` | REQ-SEO05 | 印と表 |
| `tests/infrastructure/d1-link-inbox.test.ts` | REQ-P02, REQ-S02 | 印 |
| `tests/infrastructure/d1-persona-repository.test.ts` | REQ-B01, REQ-P05 | 印 |
| `tests/infrastructure/d1-product-repository.test.ts` | REQ-B01 | 印 |
| `tests/infrastructure/d1-ranking-repository.test.ts` | REQ-B01, REQ-P05 | 印 |
| `tests/infrastructure/d1-reader-shortlist-repository.test.ts` | REQ-B09 | 印 |
| `tests/infrastructure/d1-reader-tool-repository.test.ts` | REQ-B07 | 印 |
| `tests/infrastructure/d1-settings-repository.test.ts` | REQ-B01, REQ-P05 | 印 |
| `tests/infrastructure/d1-site-repository.test.ts` | REQ-B01 | 印 |
| `tests/infrastructure/db-binding.test.ts` | REQ-TS09 | 印 |
| `tests/infrastructure/dev-signin.test.ts` | REQ-S10 | 印 |
| `tests/infrastructure/entry-gate.test.ts` | REQ-S10 | 印 |
| `tests/infrastructure/guarded-fetch.test.ts` | REQ-SEC02 | 印と表 |
| `tests/infrastructure/indexnow-client.test.ts` | REQ-SEO04 | 印 |
| `tests/infrastructure/llm-connectivity.test.ts` | REQ-SEC01 | 印 |
| `tests/infrastructure/llm-credential-vault.test.ts` | REQ-SEC01, REQ-SEC05 | 印 |
| `tests/infrastructure/llm-provider-catalog-config.test.ts` | REQ-G11, REQ-TM03 | 印 |
| `tests/infrastructure/llm-provider-catalog.test.ts` | REQ-SEC01 | 印 |
| `tests/infrastructure/llm-providers.test.ts` | REQ-G11, REQ-SEC01, REQ-SEC05 | 印と表 |
| `tests/infrastructure/llm-usage-repository.test.ts` | REQ-SEC01 | 印 |
| `tests/infrastructure/manual-export.test.ts` | REQ-P08 | 印 |
| `tests/infrastructure/membership-reader.test.ts` | REQ-S10 | 印 |
| `tests/infrastructure/page-by-id.test.ts` | REQ-P01 | 印 |
| `tests/infrastructure/product-sample-repository.test.ts` | REQ-B01 | 印 |
| `tests/infrastructure/prompt-assembly.test.ts` | REQ-P06 | 表 |
| `tests/infrastructure/sample-blog-ops-repository.test.ts` | REQ-BOPS01, REQ-BOPS02, REQ-BOPS03, REQ-BOPS06, REQ-BOPS07, REQ-BOPS08, REQ-BOPS09 | 印 |
| `tests/infrastructure/sample-blog-ops-tenancy.test.ts` | REQ-BOPS01, REQ-BOPS04, REQ-BOPS05, REQ-BOPS06, REQ-BOPS08, REQ-BOPS09, REQ-BOPS12, REQ-BOPS14 | 印と表 |
| `tests/infrastructure/sample-catalog-consistency.test.ts` | REQ-B07, REQ-P03, REQ-P07 | 印 |
| `tests/infrastructure/sample-distribution-pagination.test.ts` | REQ-P08 | 印 |
| `tests/infrastructure/sample-feedback-repository.test.ts` | REQ-FB04, REQ-FB06, REQ-FB07, REQ-FB08 | 印 |
| `tests/infrastructure/sample-integration-keys.test.ts` | REQ-FB07, REQ-FB08 | 印 |
| `tests/infrastructure/secret-minter.test.ts` | REQ-FB12 | 印と表 |
| `tests/infrastructure/session-actor.test.ts` | REQ-S10 | 印 |
| `tests/infrastructure/session-issuer.test.ts` | REQ-S10 | 印 |
| `tests/infrastructure/settings-sample-repository.test.ts` | REQ-P01 | 印 |
| `tests/infrastructure/stub-ledger.test.ts` | REQ-TS09 | 表 |
| `tests/infrastructure/stub-registry.test.ts` | REQ-TS09 | 印 |
| `tests/infrastructure/turnstile.test.ts` | REQ-B18 | 印 |
| `tests/integration/d1-affiliate-link.test.ts` | REQ-E13, REQ-TS07 | 印 |
| `tests/integration/d1-audit-log.test.ts` | REQ-SEC09 | 印と表 |
| `tests/integration/d1-blog-ops-tenancy.test.ts` | REQ-BOPS01, REQ-BOPS02, REQ-BOPS03, REQ-BOPS04, REQ-BOPS05, REQ-BOPS06, REQ-BOPS07, REQ-BOPS08, REQ-BOPS09, REQ-BOPS11, REQ-BOPS14 | 印と表 |
| `tests/integration/d1-capacity-atomicity.test.ts` | REQ-P01 | 印 |
| `tests/integration/d1-compliance.test.ts` | REQ-QC09, REQ-QC11, REQ-SEC06, REQ-SEC07 | 印と表 |
| `tests/integration/d1-contact-atomicity.test.ts` | REQ-B18, REQ-SEC01, REQ-TS07 | 印 |
| `tests/integration/d1-content.test.ts` | REQ-SEC09 | 印と表 |
| `tests/integration/d1-conversion.test.ts` | REQ-P09 | 印と表 |
| `tests/integration/d1-distribution.test.ts` | REQ-P08 | 印と表 |
| `tests/integration/d1-feedback.test.ts` | REQ-FB07, REQ-FB08, REQ-FB09, REQ-FB10, REQ-FB12, REQ-TM09, REQ-TS07 | 印と表 |
| `tests/integration/d1-improvement.test.ts` | REQ-E14, REQ-IM05, REQ-IM13 | 印と表 |
| `tests/integration/d1-link-inbox.test.ts` | REQ-S02, REQ-TS07 | 印と表 |
| `tests/integration/d1-membership.test.ts` | REQ-P01 | 印 |
| `tests/integration/d1-migration-0035.test.ts` | REQ-P08, REQ-TS07 | 印 |
| `tests/integration/d1-provider-delivery-boundary.test.ts` | REQ-A06 | 印 |
| `tests/integration/d1-published-article.test.ts` | REQ-P08 | 表 |
| `tests/integration/d1-site-draft.test.ts` | REQ-P07, REQ-S06, REQ-TS07, REQ-W10 | 印 |
| `tests/integration/d1-telemetry.test.ts` | REQ-TM13, REQ-TS07 | 印と表 |
| `tests/integration/d1-tracking-issuance.test.ts` | REQ-E13, REQ-P09 | 印と表 |
| `tests/integration/full-loop.test.ts` | REQ-TS07 | 表 |
| `tests/integration/local-seed-idempotency.test.ts` | REQ-FD06 | 印 |
| `tests/integration/r2-feedback-capture.test.ts` | REQ-FB04, REQ-FB06, REQ-TS07 | 印 |
| `tests/presentation/admin-action-result.test.ts` | REQ-UX02 | 印 |
| `tests/presentation/admin-actions.test.ts` | REQ-P08, REQ-SEO03 | 印と表 |
| `tests/presentation/admin-crud-actions.test.ts` | REQ-UX02 | 印 |
| `tests/presentation/admin-edit-actions.test.ts` | REQ-UX02 | 印 |
| `tests/presentation/admin-routes.test.ts` | REQ-FB07, REQ-P09, REQ-S02, REQ-S03, REQ-S10, REQ-TS05 | 表 |
| `tests/presentation/affiliate-form-action.test.ts` | REQ-E10, REQ-E11, REQ-P09 | 印 |
| `tests/presentation/api-routes.test.ts` | REQ-M03, REQ-TM11, REQ-WA02, REQ-WC06 | 印と表 |
| `tests/presentation/api-scope-actor.test.ts` | REQ-API02, REQ-FB13 | 印 |
| `tests/presentation/blog-action-input.test.ts` | REQ-BOPS01, REQ-BOPS02, REQ-BOPS03, REQ-BOPS04, REQ-BOPS05, REQ-BOPS08 | 印 |
| `tests/presentation/blog-ops-actions.test.ts` | REQ-BOPS03, REQ-BOPS04, REQ-BOPS05, REQ-BOPS06, REQ-BOPS08, REQ-BOPS12 | 印 |
| `tests/presentation/blog-ops-tools.test.ts` | REQ-BLOG06 | 印と表 |
| `tests/presentation/blog-rating-actions.test.ts` | REQ-BOPS09 | 印 |
| `tests/presentation/blog-tag-and-member-actions.test.ts` | REQ-BOPS07, REQ-BOPS12, REQ-UX02 | 印 |
| `tests/presentation/bluesky-connection-action.test.ts` | REQ-P08 | 印 |
| `tests/presentation/composition-wiring.test.ts` | REQ-API01, REQ-TS09 | 印 |
| `tests/presentation/composition.test.ts` | REQ-S09 | 表 |
| `tests/presentation/contact-action.test.ts` | REQ-B18, REQ-R06 | 印 |
| `tests/presentation/contact-rate-key.test.ts` | REQ-B18 | 印 |
| `tests/presentation/content-package-form-action.test.ts` | REQ-P06 | 印 |
| `tests/presentation/delete-form-action.test.ts` | REQ-E12, REQ-P08 | 印 |
| `tests/presentation/entry-points.test.ts` | REQ-API01, REQ-M03, REQ-TS04, REQ-WB02, REQ-WC08 | 印と表 |
| `tests/presentation/error-format.test.ts` | REQ-WC07 | 印と表 |
| `tests/presentation/evidence-form-action.test.ts` | REQ-E19, REQ-E21 | 印 |
| `tests/presentation/feedback-actions.test.ts` | REQ-FB08, REQ-FB12 | 表 |
| `tests/presentation/feedback-capture-route.test.ts` | REQ-FB13 | 印と表 |
| `tests/presentation/feedback-pending-route.test.ts` | REQ-FB09 | 表 |
| `tests/presentation/feedback-tools.test.ts` | REQ-WB02 | 印 |
| `tests/presentation/flag-decisions-separated.test.ts` | REQ-M03, REQ-WB02, REQ-WC04 | 印と表 |
| `tests/presentation/go-route.test.ts` | REQ-E13 | 印 |
| `tests/presentation/guideline-reference-actions.test.ts` | REQ-SEO05 | 印と表 |
| `tests/presentation/improvement-action.test.ts` | REQ-IM06, REQ-IM09 | 印 |
| `tests/presentation/improvement-actions.test.ts` | REQ-IM06, REQ-IM09 | 印と表 |
| `tests/presentation/llm-credential-actions.test.ts` | REQ-SEC01 | 印 |
| `tests/presentation/llm-credential-entry.test.ts` | REQ-SEC01 | 印 |
| `tests/presentation/member-action.test.ts` | REQ-P01, REQ-R01 | 印 |
| `tests/presentation/nav-grouping.test.ts` | REQ-S09 | 印 |
| `tests/presentation/nav-permissions.test.ts` | REQ-FB02, REQ-FB07 | 表 |
| `tests/presentation/non-empty-lines.test.ts` | REQ-UX02 | 印 |
| `tests/presentation/one-usecase-three-adapters.test.ts` | REQ-API01, REQ-API02 | 印と表 |
| `tests/presentation/persona-form-action.test.ts` | REQ-P05 | 印 |
| `tests/presentation/publish-article-indexnow.test.ts` | REQ-SEO04 | 印 |
| `tests/presentation/quality-check-labels.test.ts` | REQ-P06 | 印 |
| `tests/presentation/ranking-form-action.test.ts` | REQ-P04 | 印 |
| `tests/presentation/reader-tools.test.ts` | REQ-WB01 | 印 |
| `tests/presentation/readonly-honesty.test.ts` | REQ-WC04 | 印 |
| `tests/presentation/seo-route-handlers.test.ts` | REQ-SEO02 | 印 |
| `tests/presentation/settings-form-action.test.ts` | REQ-E04, REQ-P01 | 印 |
| `tests/presentation/shortlist-action.test.ts` | REQ-P10, REQ-UX02 | 印 |
| `tests/presentation/site-contact-action.test.ts` | REQ-B18, REQ-SEC02 | 印 |
| `tests/presentation/site-document-action.test.ts` | REQ-P07 | 印 |
| `tests/presentation/site-metadata.test.ts` | REQ-SEO01 | 印 |
| `tests/presentation/spec-contract.test.ts` | REQ-M01, REQ-M02, REQ-WA01, REQ-WA02 | 印と表 |
| `tests/presentation/storage-notice.test.ts` | REQ-BOPS12, REQ-TS09 | 印と表 |
| `tests/presentation/tool-catalog-adapters.test.ts` | REQ-M03, REQ-TS04, REQ-WC01 | 印と表 |
| `tests/presentation/tool-catalog-denial-audit.test.ts` | REQ-E13, REQ-M03, REQ-SEC09 | 印 |
| `tests/presentation/tool-declaration-truth.test.ts` | REQ-M03 | 印 |
| `tests/presentation/webmcp-policy.test.ts` | REQ-WC03, REQ-WC04 | 印と表 |
| `tests/presentation/webmcp-registration.test.ts` | REQ-WC01, REQ-WC02 | 印と表 |
| `tests/property/generator-floor.property.test.ts` | REQ-API02, REQ-B12, REQ-E14, REQ-IM05, REQ-P01, REQ-P02, REQ-P03, REQ-P04, REQ-QC09, REQ-QC12, REQ-R11, REQ-R12, REQ-SEC04, REQ-SEC06, REQ-TH01, REQ-TH03 | 印 |
| `tests/property/normalization.property.test.ts` | REQ-P02, REQ-P03, REQ-TH01, REQ-TH02, REQ-TH03 | 印と表 |
| `tests/property/publish-gate.property.test.ts` | REQ-QC09, REQ-QC12, REQ-SEC06 | 印と表 |
| `tests/property/ranking.property.test.ts` | REQ-B12, REQ-P04, REQ-SEC04 | 印と表 |
| `tests/property/tenancy.property.test.ts` | REQ-API02, REQ-P01, REQ-R10, REQ-R11, REQ-R12, REQ-SEC01 | 印と表 |
| `tests/property/variant-spec.property.test.ts` | REQ-E14, REQ-IM05, REQ-IM06 | 印と表 |
| `tests/support/support.test.ts` | REQ-TS01 | 印 |
| `tests/ui/adjust-conversion-form.test.tsx` | REQ-P09 | 表 |
| `tests/ui/admin-edit-forms.test.tsx` | REQ-UX02 | 印 |
| `tests/ui/affiliate-preview-card.test.tsx` | REQ-A07, REQ-P02 | 印 |
| `tests/ui/ai-usage-page.test.tsx` | REQ-TM02, REQ-TM03 | 印と表 |
| `tests/ui/app-shell-nav.test.tsx` | REQ-S09, REQ-SEC08 | 印 |
| `tests/ui/appearance-picker.test.tsx` | REQ-TH03 | 印 |
| `tests/ui/article-faq.test.tsx` | REQ-SEO03, REQ-TM06 | 印 |
| `tests/ui/article-layout-suggestion-panel.test.tsx` | REQ-BOPS05, REQ-IM09 | 印 |
| `tests/ui/article-save-status.test.tsx` | REQ-BOPS04, REQ-BOPS05 | 印 |
| `tests/ui/audit-log-notice.test.tsx` | REQ-SEC09 | 印 |
| `tests/ui/axe-blind-spots.test.ts` | REQ-TS06 | 印と表 |
| `tests/ui/axe-rule-coverage.test.ts` | REQ-SEC08, REQ-TS06 | 印と表 |
| `tests/ui/blog-article-view.test.tsx` | REQ-BLOG03 | 印 |
| `tests/ui/blog-enabled-marker.test.tsx` | REQ-BOPS02, REQ-BOPS03, REQ-BOPS08 | 印 |
| `tests/ui/blog-ops-a11y-floor.test.tsx` | REQ-BLOG04, REQ-BOPS03, REQ-BOPS04, REQ-BOPS05, REQ-BOPS06, REQ-BOPS07, REQ-BOPS08, REQ-BOPS09, REQ-BOPS10, REQ-BOPS11, REQ-BOPS14 | 印と表 |
| `tests/ui/blog-ops-restore.test.tsx` | REQ-BOPS01, REQ-BOPS05, REQ-BOPS06, REQ-UX02 | 印と表 |
| `tests/ui/blog-tag-form.test.tsx` | REQ-BOPS07, REQ-UX02 | 印と表 |
| `tests/ui/blueprint-theme.test.ts` | REQ-P07, REQ-TH02, REQ-TS06 | 表 |
| `tests/ui/bluesky-connection-form.test.tsx` | REQ-P08 | 印 |
| `tests/ui/capture-canvas.test.tsx` | REQ-FB04, REQ-FB05 | 印と表 |
| `tests/ui/catalog-and-signin-clients.test.tsx` | REQ-UX01 | 印 |
| `tests/ui/checkbox-group.test.tsx` | REQ-UX02 | 印 |
| `tests/ui/consent-banner.test.tsx` | REQ-TM07 | 印と表 |
| `tests/ui/contact-form.test.tsx` | REQ-B18 | 印 |
| `tests/ui/content-progress-form.test.tsx` | REQ-R11 | 印 |
| `tests/ui/copy-dictionary.test.ts` | REQ-QC09, REQ-TS09 | 印 |
| `tests/ui/delete-confirm.test.tsx` | REQ-BOPS07, REQ-UX02 | 印 |
| `tests/ui/design-tokens.test.ts` | REQ-S09, REQ-SEC08, REQ-TS09, REQ-UX08 | 表 |
| `tests/ui/disclosure-text.test.ts` | REQ-QC09, REQ-SEC07 | 印 |
| `tests/ui/fact-source.test.ts` | REQ-QC04, REQ-W07 | 印と表 |
| `tests/ui/feedback-admin-forms.test.tsx` | REQ-FB08, REQ-FB12 | 表 |
| `tests/ui/feedback-button.test.tsx` | REQ-FB02, REQ-FB03, REQ-FB04 | 印と表 |
| `tests/ui/flex-row-shape.test.ts` | REQ-S09 | 印 |
| `tests/ui/grid-stretch-align.test.ts` | REQ-S09 | 印 |
| `tests/ui/guideline-reference-page.test.tsx` | REQ-SEO05 | 印と表 |
| `tests/ui/header-wrap-shape.test.ts` | REQ-S09 | 印 |
| `tests/ui/heading-is-visible.test.ts` | REQ-S09, REQ-TS06 | 印 |
| `tests/ui/improvement-forms.test.tsx` | REQ-IM09 | 印と表 |
| `tests/ui/keyboard-operation.test.tsx` | REQ-B01, REQ-B02, REQ-B03, REQ-B04, REQ-B05, REQ-B06, REQ-B07, REQ-B08, REQ-B09, REQ-B10, REQ-B11, REQ-B12, REQ-B13, REQ-B14, REQ-B15, REQ-B16, REQ-B17, REQ-B18, REQ-BOPS01, REQ-BOPS02, REQ-BOPS03, REQ-BOPS04, REQ-BOPS05, REQ-BOPS06, REQ-BOPS07, REQ-BOPS08, REQ-BOPS09, REQ-BOPS10, REQ-BOPS11, REQ-BOPS12, REQ-BOPS14, REQ-FB07, REQ-IM09, REQ-P01, REQ-P02, REQ-P03, REQ-P04, REQ-P05, REQ-P06, REQ-P07, REQ-P08, REQ-P09, REQ-P10, REQ-S01, REQ-S02, REQ-S03, REQ-S04, REQ-S05, REQ-S06, REQ-S07, REQ-S08, REQ-S09, REQ-S10, REQ-SEC08, REQ-TH01, REQ-TM02, REQ-TM03, REQ-TM05, REQ-TM06, REQ-TM10, REQ-TS05 | 印と表 |
| `tests/ui/layout-density.test.ts` | REQ-S09, REQ-SEC08 | 印と表 |
| `tests/ui/llm-credential-forms.test.tsx` | REQ-SEC01 | 印 |
| `tests/ui/llm-credential-page.test.tsx` | REQ-SEC01 | 印 |
| `tests/ui/matrix-empty-reached.test.ts` | REQ-S05 | 印 |
| `tests/ui/measurement-page.test.tsx` | REQ-TM10 | 印と表 |
| `tests/ui/model-picker.test.tsx` | REQ-G11 | 印 |
| `tests/ui/note-role.test.ts` | REQ-S09, REQ-TS06 | 印 |
| `tests/ui/operational-health-view.test.tsx` | REQ-BOPS10, REQ-UX02 | 印 |
| `tests/ui/page-degraded.test.tsx` | REQ-B01, REQ-B02, REQ-B03, REQ-B04, REQ-B05, REQ-B06, REQ-B07, REQ-B08, REQ-B09, REQ-B10, REQ-B11, REQ-B12, REQ-B13, REQ-B14, REQ-B15, REQ-B16, REQ-B17, REQ-B18, REQ-P01, REQ-P02, REQ-P03, REQ-P04, REQ-P05, REQ-P06, REQ-P07, REQ-P08, REQ-P09, REQ-P10, REQ-S01, REQ-S02, REQ-S03, REQ-S04, REQ-S05, REQ-S06, REQ-S07, REQ-S08, REQ-S09, REQ-S10, REQ-TH01 | 印 |
| `tests/ui/page-diagnostics.test.ts` | REQ-S09 | 印 |
| `tests/ui/page-empty.test.tsx` | REQ-B01, REQ-B02, REQ-B03, REQ-B04, REQ-B05, REQ-B06, REQ-B07, REQ-B08, REQ-B09, REQ-B10, REQ-B11, REQ-B12, REQ-B13, REQ-B14, REQ-B15, REQ-B16, REQ-B17, REQ-B18, REQ-P01, REQ-P02, REQ-P03, REQ-P04, REQ-P05, REQ-P06, REQ-P07, REQ-P08, REQ-P09, REQ-P10, REQ-S01, REQ-S02, REQ-S03, REQ-S04, REQ-S05, REQ-S06, REQ-S07, REQ-S08, REQ-S09, REQ-S10, REQ-TH01 | 印 |
| `tests/ui/page-render-privileged.test.tsx` | REQ-S10 | 印 |
| `tests/ui/page-render-restricted.test.tsx` | REQ-S09, REQ-S10 | 印 |
| `tests/ui/page-render.test.tsx` | REQ-B01, REQ-B02, REQ-B03, REQ-B04, REQ-B05, REQ-B06, REQ-B07, REQ-B08, REQ-B09, REQ-B10, REQ-B11, REQ-B12, REQ-B13, REQ-B14, REQ-B15, REQ-B16, REQ-B17, REQ-B18, REQ-BOPS01, REQ-BOPS02, REQ-BOPS03, REQ-BOPS04, REQ-BOPS05, REQ-BOPS06, REQ-BOPS07, REQ-BOPS08, REQ-BOPS09, REQ-BOPS10, REQ-BOPS11, REQ-BOPS12, REQ-BOPS14, REQ-FB07, REQ-FB08, REQ-IM09, REQ-P01, REQ-P02, REQ-P03, REQ-P04, REQ-P05, REQ-P06, REQ-P07, REQ-P08, REQ-P09, REQ-P10, REQ-S01, REQ-S02, REQ-S03, REQ-S04, REQ-S05, REQ-S06, REQ-S07, REQ-S08, REQ-S09, REQ-S10, REQ-SEC08, REQ-TH01, REQ-TM02, REQ-TM03, REQ-TM05, REQ-TM06, REQ-TM10, REQ-TS05 | 印と表 |
| `tests/ui/patterns-render.test.tsx` | REQ-S09, REQ-SEC08 | 表 |
| `tests/ui/prose-body.test.tsx` | REQ-BOPS04, REQ-BOPS05 | 印 |
| `tests/ui/prose-editor.test.tsx` | REQ-BOPS04, REQ-BOPS05, REQ-UX02 | 印 |
| `tests/ui/public-shell-appearance.test.tsx` | REQ-TH03, REQ-TH04 | 印 |
| `tests/ui/public-site-projection.test.ts` | REQ-BLOG02, REQ-BOPS02, REQ-BOPS03, REQ-BOPS06, REQ-BOPS11 | 印と表 |
| `tests/ui/publish-article-form.test.tsx` | REQ-P08 | 印と表 |
| `tests/ui/publish-article-result.test.tsx` | REQ-P08 | 印と表 |
| `tests/ui/ranking-model-form.test.tsx` | REQ-P05, REQ-SEC09 | 印 |
| `tests/ui/resource-not-found.test.tsx` | REQ-B01 | 印と表 |
| `tests/ui/route-branch-reached.test.ts` | REQ-S09 | 印 |
| `tests/ui/schedule-publication-form.test.tsx` | REQ-P08 | 印と表 |
| `tests/ui/screen-hit-and-current.test.tsx` | REQ-P02, REQ-S01, REQ-S08, REQ-S09, REQ-S10 | 印と表 |
| `tests/ui/site-aside.test.tsx` | REQ-TM06 | 印 |
| `tests/ui/site-not-found.test.tsx` | REQ-B01 | 表 |
| `tests/ui/site-wizard-form.test.tsx` | REQ-P07, REQ-S06 | 印 |
| `tests/ui/surface-outline-count.test.ts` | REQ-S09 | 印 |
| `tests/ui/table-through-component.test.ts` | REQ-S09, REQ-TS06 | 印 |
| `tests/ui/tap-target-floor.test.ts` | REQ-P01 | 印 |
| `tests/ui/telemetry-attrs.test.tsx` | REQ-TM05, REQ-TM06 | 印と表 |
| `tests/ui/telemetry-collector.test.tsx` | REQ-TM06, REQ-TM11 | 印と表 |
| `tests/ui/theme-contrast.test.ts` | REQ-S08, REQ-TH01, REQ-TH02, REQ-TS06 | 印と表 |
| `tests/ui/tool-form.test.tsx` | REQ-WC05 | 印と表 |
| `tests/ui/tool-page-identity.test.tsx` | REQ-B01, REQ-S06 | 印 |
| `tests/ui/ui-layers.test.ts` | REQ-S09, REQ-TM05 | 表 |
| `tests/ui/uiux-admin-api-contract.test.ts` | REQ-UX02 | 印と表 |
| `tests/ui/uiux-blog-scaffold.test.ts` | REQ-UX07 | 印と表 |
| `tests/ui/uiux-channel-status.test.tsx` | REQ-UX03, REQ-UX04 | 印と表 |
| `tests/ui/uiux-concept-matrix.test.tsx` | REQ-UX05 | 印と表 |
| `tests/ui/uiux-duplicate-implementation.test.ts` | REQ-UX06 | 印と表 |
| `tests/ui/uiux-form-declaration.test.ts` | REQ-UX06 | 印 |
| `tests/ui/uiux-screen-single-purpose.test.ts` | REQ-UX01 | 印と表 |
| `tests/ui/uiux-sidebar-icons.test.tsx` | REQ-UX09 | 印と表 |
| `tests/ui/uiux-spacing-and-copy.test.ts` | REQ-UX08, REQ-UX10 | 印と表 |
| `tests/ui/use-draft.test.tsx` | REQ-BOPS04, REQ-BOPS05 | 印 |
| `tests/ui/zz-probe-tone.test.tsx` | REQ-TM07 | 表 |
| `tests/visual/visual-regression.test.ts` | REQ-S09, REQ-TS12, REQ-UX08 | 印 |
<!-- 生成物の指紋 sha256:1f5c29ae5f0c61302aac58564a66ef8cbabb610156990000de6f8b993e37e2d2 -->
