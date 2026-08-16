# run-publisher-publish criteria coverage

| Criterion | Automated evidence | Review evidence |
|---|---|---|
| IN1 | `apps/publisher/src/__tests__/pt5-plugin-surface-structure.test.ts` PT5-A/PT5-B confirms the manifest, slash command, script, and single `exec` delegation; `make plugin-package-check` validates the distributable package. | `eval-log/harness-hub-publisher/run-publisher-publish/content-review/elegance-verdict.json` confirms the one-way command → Skill → CLI ownership. |
| IN2 | `apps/publisher/src/cli/index.test.ts` and `publish-command.test.ts` cover required options and fail-closed command handling; `python3 scripts/validate-frontmatter.py --skills-dir plugins/harness-hub-publisher/skills` validates the Skill contract. | `rubric-verdict.json` checks the argument agreement across command, Skill, and CLI. |
| OUT1 | `docs/features/feat-publisher-plugin/acceptance-record.md` records A1/A3 as not met and distinguishes fake I/O from actual services. | Both content-review verdicts verify that the interaction and residual risk are communicated without claiming unexecuted E2E success. |
| OUT2 | `pnpm --filter @harness-hub/publisher check:plaintext-secret-storage`, `pt3-inspection-client-parity.test.ts`, and `pt5-plugin-surface-structure.test.ts` verify credential handling, inspection delegation, and no duplicate runtime logic. | `rubric-verdict.json` verifies the release remains fail-closed until external acceptance evidence exists. |
