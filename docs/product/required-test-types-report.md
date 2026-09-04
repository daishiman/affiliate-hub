# 要件ごとの必須テスト種別（自動生成）

`node scripts/required-test-types.mjs` が書き換える。**手で編集しない。**
末尾の指紋がその見張りで、手で 1 文字でも書くと次の実行が**上書きせずに止まる**（書いた行は残る）。
宣言は `docs/product/required-test-types.md`、語彙と上限は `quality-gates.config.mjs` が正本。

- 最終更新: 2026-09-04
- 要件表の要件: 295 件
- 性質を宣言済: 290 件
- **未宣言: 5 件**（上限 5 件）
- 理由つきの除外: 5 件（上限 7 件）

未宣言とは「必須種別をまだ決めていない」という意味で、
テストが無いという意味ではない。**新しい要件は宣言しないと CI が落ちる。**

## 宣言済の要件

| REQ | 性質 | 必須種別 | 満たしている | 理由つき除外 |
| --- | --- | --- | --- | --- |
| REQ-P01 | has-tenant, has-permission, has-screen | `a11y` `keyboard` `permission-matrix` `screen-states` `tenant-isolation` | `a11y` `keyboard` `permission-matrix` `screen-states` `tenant-isolation` | — |
| REQ-P02 | has-input, has-external, has-screen, has-user-supplied-url, has-recorded-operation | `a11y` `audit-log` `boundary` `equivalence` `fault-injection` `idempotency` `keyboard` `screen-states` `ssrf` | `a11y` `audit-log` `boundary` `equivalence` `idempotency` `keyboard` `screen-states` `ssrf` | `fault-injection` |
| REQ-P03 | has-calculation, has-screen | `a11y` `boundary` `keyboard` `mutation` `screen-states` | `a11y` `keyboard` `mutation` `screen-states` | `boundary` |
| REQ-P04 | has-calculation, has-screen | `a11y` `boundary` `keyboard` `mutation` `screen-states` | `a11y` `boundary` `keyboard` `mutation` `screen-states` | — |
| REQ-P05 | has-input, has-screen | `a11y` `boundary` `equivalence` `keyboard` `screen-states` | `a11y` `boundary` `equivalence` `keyboard` `screen-states` | — |
| REQ-P06 | has-input, has-screen, has-ai-text | `a11y` `boundary` `equivalence` `keyboard` `prompt-injection` `screen-states` | `a11y` `boundary` `equivalence` `keyboard` `prompt-injection` `screen-states` | — |
| REQ-P07 | has-input, has-state, has-screen | `a11y` `boundary` `equivalence` `keyboard` `screen-states` `state-transition` | `a11y` `boundary` `equivalence` `keyboard` `screen-states` `state-transition` | — |
| REQ-P08 | has-state, has-external, has-screen, has-db-table, has-recorded-operation | `a11y` `audit-log` `db-migration` `fault-injection` `idempotency` `keyboard` `screen-states` `state-transition` | `a11y` `audit-log` `db-migration` `idempotency` `keyboard` `screen-states` `state-transition` | `fault-injection` |
| REQ-P09 | has-input, has-tenant, has-external, has-screen, has-db-table, has-recorded-operation | `a11y` `audit-log` `boundary` `db-migration` `equivalence` `fault-injection` `idempotency` `keyboard` `screen-states` `tenant-isolation` | `a11y` `audit-log` `boundary` `db-migration` `equivalence` `idempotency` `keyboard` `screen-states` `tenant-isolation` | `fault-injection` |
| REQ-P10 | has-input, has-screen | `a11y` `boundary` `equivalence` `keyboard` `screen-states` | `a11y` `boundary` `equivalence` `keyboard` `screen-states` | — |
| REQ-B01 | has-screen | `a11y` `keyboard` `screen-states` | `a11y` `keyboard` `screen-states` | — |
| REQ-B02 | has-screen | `a11y` `keyboard` `screen-states` | `a11y` `keyboard` `screen-states` | — |
| REQ-B03 | has-screen | `a11y` `keyboard` `screen-states` | `a11y` `keyboard` `screen-states` | — |
| REQ-B04 | has-screen | `a11y` `keyboard` `screen-states` | `a11y` `keyboard` `screen-states` | — |
| REQ-B05 | has-screen | `a11y` `keyboard` `screen-states` | `a11y` `keyboard` `screen-states` | — |
| REQ-B06 | has-screen | `a11y` `keyboard` `screen-states` | `a11y` `keyboard` `screen-states` | — |
| REQ-B07 | has-screen | `a11y` `keyboard` `screen-states` | `a11y` `keyboard` `screen-states` | — |
| REQ-B08 | has-screen | `a11y` `keyboard` `screen-states` | `a11y` `keyboard` `screen-states` | — |
| REQ-B09 | has-screen | `a11y` `keyboard` `screen-states` | `a11y` `keyboard` `screen-states` | — |
| REQ-B10 | has-screen | `a11y` `keyboard` `screen-states` | `a11y` `keyboard` `screen-states` | — |
| REQ-B11 | has-screen | `a11y` `keyboard` `screen-states` | `a11y` `keyboard` `screen-states` | — |
| REQ-B12 | has-screen | `a11y` `keyboard` `screen-states` | `a11y` `keyboard` `screen-states` | — |
| REQ-B13 | has-screen | `a11y` `keyboard` `screen-states` | `a11y` `keyboard` `screen-states` | — |
| REQ-B14 | has-screen | `a11y` `keyboard` `screen-states` | `a11y` `keyboard` `screen-states` | — |
| REQ-B15 | has-screen | `a11y` `keyboard` `screen-states` | `a11y` `keyboard` `screen-states` | — |
| REQ-B16 | has-screen | `a11y` `keyboard` `screen-states` | `a11y` `keyboard` `screen-states` | — |
| REQ-B17 | has-screen | `a11y` `keyboard` `screen-states` | `a11y` `keyboard` `screen-states` | — |
| REQ-B18 | has-screen | `a11y` `keyboard` `screen-states` | `a11y` `keyboard` `screen-states` | — |
| REQ-S01 | has-screen | `a11y` `keyboard` `screen-states` | `a11y` `keyboard` `screen-states` | — |
| REQ-S02 | has-screen | `a11y` `keyboard` `screen-states` | `a11y` `keyboard` `screen-states` | — |
| REQ-S03 | has-screen | `a11y` `keyboard` `screen-states` | `a11y` `keyboard` `screen-states` | — |
| REQ-S04 | has-screen | `a11y` `keyboard` `screen-states` | `a11y` `keyboard` `screen-states` | — |
| REQ-S05 | has-screen | `a11y` `keyboard` `screen-states` | `a11y` `keyboard` `screen-states` | — |
| REQ-S06 | has-screen | `a11y` `keyboard` `screen-states` | `a11y` `keyboard` `screen-states` | — |
| REQ-S07 | has-screen | `a11y` `keyboard` `screen-states` | `a11y` `keyboard` `screen-states` | — |
| REQ-S08 | has-screen | `a11y` `keyboard` `screen-states` | `a11y` `keyboard` `screen-states` | — |
| REQ-S09 | has-screen, has-permission, has-shared-visual-form | `a11y` `keyboard` `permission-matrix` `screen-states` `visual` | `a11y` `keyboard` `permission-matrix` `screen-states` `visual` | — |
| REQ-S10 | has-screen, has-permission | `a11y` `keyboard` `permission-matrix` `screen-states` | `a11y` `keyboard` `permission-matrix` `screen-states` | — |
| REQ-API02 | has-permission, has-tenant | `permission-matrix` `tenant-isolation` | `permission-matrix` `tenant-isolation` | — |
| REQ-R01 | has-permission | `permission-matrix` | `permission-matrix` | — |
| REQ-R02 | has-permission | `permission-matrix` | `permission-matrix` | — |
| REQ-R03 | has-permission | `permission-matrix` | `permission-matrix` | — |
| REQ-R04 | has-permission | `permission-matrix` | `permission-matrix` | — |
| REQ-R05 | has-permission | `permission-matrix` | `permission-matrix` | — |
| REQ-R06 | has-permission | `permission-matrix` | `permission-matrix` | — |
| REQ-R07 | has-permission | `permission-matrix` | `permission-matrix` | — |
| REQ-R08 | has-permission | `permission-matrix` | `permission-matrix` | — |
| REQ-R09 | has-permission | `permission-matrix` | `permission-matrix` | — |
| REQ-R10 | has-permission | `permission-matrix` | `permission-matrix` | — |
| REQ-R11 | has-permission | `permission-matrix` | `permission-matrix` | — |
| REQ-R12 | has-permission | `permission-matrix` | `permission-matrix` | — |
| REQ-QC01 | has-enumerated-input | `decision-table` `equivalence` | `decision-table` `equivalence` | — |
| REQ-QC02 | has-input, has-enumerated-input | `boundary` `decision-table` `equivalence` | `boundary` `decision-table` `equivalence` | — |
| REQ-QC03 | has-enumerated-input | `decision-table` `equivalence` | `decision-table` `equivalence` | — |
| REQ-QC04 | has-enumerated-input | `decision-table` `equivalence` | `decision-table` `equivalence` | — |
| REQ-QC05 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-QC06 | has-input, has-enumerated-input | `boundary` `decision-table` `equivalence` | `boundary` `decision-table` `equivalence` | — |
| REQ-QC07 | has-enumerated-input | `decision-table` `equivalence` | `decision-table` `equivalence` | — |
| REQ-QC08 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-QC09 | has-enumerated-input | `decision-table` `equivalence` | `decision-table` `equivalence` | — |
| REQ-QC10 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-QC11 | has-enumerated-input | `decision-table` `equivalence` | `decision-table` `equivalence` | — |
| REQ-QC12 | has-calculation | `boundary` `mutation` | `mutation` | `boundary` |
| REQ-W01 | has-enumerated-input | `decision-table` `equivalence` | `decision-table` `equivalence` | — |
| REQ-W02 | has-enumerated-input | `decision-table` `equivalence` | `decision-table` `equivalence` | — |
| REQ-W03 | has-enumerated-input | `decision-table` `equivalence` | `decision-table` `equivalence` | — |
| REQ-W04 | has-enumerated-input | `decision-table` `equivalence` | `decision-table` `equivalence` | — |
| REQ-W05 | has-enumerated-input | `decision-table` `equivalence` | `decision-table` `equivalence` | — |
| REQ-W06 | has-enumerated-input | `decision-table` `equivalence` | `decision-table` `equivalence` | — |
| REQ-W07 | has-enumerated-input | `decision-table` `equivalence` | `decision-table` `equivalence` | — |
| REQ-W08 | has-input, has-enumerated-input | `boundary` `decision-table` `equivalence` | `boundary` `decision-table` `equivalence` | — |
| REQ-W09 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-W10 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-W11 | has-enumerated-input | `decision-table` `equivalence` | `decision-table` `equivalence` | — |
| REQ-W12 | has-enumerated-input | `decision-table` `equivalence` | `decision-table` `equivalence` | — |
| REQ-TM01 | has-enumerated-input | `decision-table` `equivalence` | `decision-table` `equivalence` | — |
| REQ-TM02 | has-enumerated-input, has-calculation, has-screen | `a11y` `boundary` `decision-table` `equivalence` `keyboard` `mutation` `screen-states` | `a11y` `boundary` `decision-table` `equivalence` `keyboard` `mutation` `screen-states` | — |
| REQ-TM03 | has-calculation, has-screen | `a11y` `boundary` `keyboard` `mutation` `screen-states` | `a11y` `boundary` `keyboard` `mutation` `screen-states` | — |
| REQ-TM04 | has-enumerated-input | `decision-table` `equivalence` | `decision-table` `equivalence` | — |
| REQ-TM05 | has-enumerated-input, has-screen | `a11y` `decision-table` `equivalence` `keyboard` `screen-states` | `a11y` `decision-table` `equivalence` `keyboard` `screen-states` | — |
| REQ-TM06 | has-enumerated-input, has-screen | `a11y` `decision-table` `equivalence` `keyboard` `screen-states` | `a11y` `decision-table` `equivalence` `keyboard` `screen-states` | — |
| REQ-TM07 | has-enumerated-input | `decision-table` `equivalence` | `decision-table` `equivalence` | — |
| REQ-TM08 | has-enumerated-input | `decision-table` `equivalence` | `decision-table` `equivalence` | — |
| REQ-TM09 | has-enumerated-input, has-input, has-tenant | `boundary` `decision-table` `equivalence` `tenant-isolation` | `boundary` `decision-table` `equivalence` `tenant-isolation` | — |
| REQ-TM10 | has-screen | `a11y` `keyboard` `screen-states` | `a11y` `keyboard` `screen-states` | — |
| REQ-TM11 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-TM13 | has-db-table | `db-migration` | `db-migration` | — |
| REQ-FD02 | has-enumerated-input, has-code-placement-rule | `code-boundary` `decision-table` `equivalence` | `code-boundary` `decision-table` `equivalence` | — |
| REQ-FD03 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-FD01 | has-code-placement-rule | `code-boundary` | `code-boundary` | — |
| REQ-FD04 | has-code-placement-rule | `code-boundary` | `code-boundary` | — |
| REQ-FD05 | has-code-placement-rule | `code-boundary` | `code-boundary` | — |
| REQ-FD06 | has-code-placement-rule | `code-boundary` | `code-boundary` | — |
| REQ-TM12 | has-code-placement-rule | `code-boundary` | `code-boundary` | — |
| REQ-E01 | has-input, has-enumerated-input | `boundary` `decision-table` `equivalence` | `boundary` `decision-table` `equivalence` | — |
| REQ-E02 | has-secret | `secrets` | `secrets` | — |
| REQ-E03 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-E04 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-E05 | has-state | `state-transition` | `state-transition` | — |
| REQ-E06 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-E07 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-E08 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-E09 | has-secret | `secrets` | `secrets` | — |
| REQ-E10 | has-input, has-secret | `boundary` `equivalence` `secrets` | `boundary` `equivalence` `secrets` | — |
| REQ-E11 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-E12 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-E13 | has-input, has-state, has-user-supplied-url | `boundary` `equivalence` `ssrf` `state-transition` | `boundary` `equivalence` `ssrf` `state-transition` | — |
| REQ-E14 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-E15 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-E16 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-E17 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-E18 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-E19 | has-input, has-state | `boundary` `equivalence` `state-transition` | `boundary` `equivalence` `state-transition` | — |
| REQ-E20 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-E21 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-E22 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-E23 | has-enumerated-input | `decision-table` `equivalence` | `decision-table` `equivalence` | — |
| REQ-E24 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-E25 | has-input, has-state | `boundary` `equivalence` `state-transition` | `boundary` `equivalence` `state-transition` | — |
| REQ-E26 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-E27 | has-input, has-state | `boundary` `equivalence` `state-transition` | `boundary` `equivalence` `state-transition` | — |
| REQ-E28 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-E29 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-E30 | has-input, has-state | `boundary` `equivalence` `state-transition` | `boundary` `equivalence` `state-transition` | — |
| REQ-E31 | has-enumerated-input | `decision-table` `equivalence` | `decision-table` `equivalence` | — |
| REQ-E32 | has-enumerated-input, has-secret, has-recorded-operation | `audit-log` `decision-table` `equivalence` `secrets` | `audit-log` `decision-table` `equivalence` `secrets` | — |
| REQ-IM01 | has-enumerated-input | `decision-table` `equivalence` | `decision-table` `equivalence` | — |
| REQ-IM02 | has-enumerated-input | `decision-table` `equivalence` | `decision-table` `equivalence` | — |
| REQ-IM03 | has-enumerated-input | `decision-table` `equivalence` | `decision-table` `equivalence` | — |
| REQ-IM04 | has-enumerated-input | `decision-table` `equivalence` | `decision-table` `equivalence` | — |
| REQ-IM05 | has-state | `state-transition` | `state-transition` | — |
| REQ-IM06 | has-state, has-permission | `permission-matrix` `state-transition` | `permission-matrix` `state-transition` | — |
| REQ-IM07 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-IM08 | has-calculation | `boundary` `mutation` | `boundary` `mutation` | — |
| REQ-IM09 | has-state, has-screen, has-permission | `a11y` `keyboard` `permission-matrix` `screen-states` `state-transition` | `a11y` `keyboard` `permission-matrix` `screen-states` `state-transition` | — |
| REQ-IM10 | has-enumerated-input | `decision-table` `equivalence` | `decision-table` `equivalence` | — |
| REQ-IM11 | has-enumerated-input | `decision-table` `equivalence` | `decision-table` `equivalence` | — |
| REQ-IM12 | has-enumerated-input | `decision-table` `equivalence` | `decision-table` `equivalence` | — |
| REQ-IM13 | has-db-table, has-tenant, has-state, has-enumerated-input | `db-migration` `decision-table` `equivalence` `state-transition` `tenant-isolation` | `db-migration` `decision-table` `equivalence` `state-transition` `tenant-isolation` | — |
| REQ-TH01 | has-screen, has-color-scheme-variants | `a11y` `keyboard` `screen-states` | `a11y` `keyboard` `screen-states` | — |
| REQ-TH02 | has-enumerated-input, has-color-scheme-variants | `a11y` `decision-table` `equivalence` | `a11y` `decision-table` `equivalence` | — |
| REQ-TH03 | has-enumerated-input | `decision-table` `equivalence` | `decision-table` `equivalence` | — |
| REQ-FB08 | has-state, has-recorded-operation | `audit-log` `state-transition` | `audit-log` `state-transition` | — |
| REQ-FB09 | has-secret, has-recorded-operation | `audit-log` `secrets` | `audit-log` `secrets` | — |
| REQ-FB12 | has-secret, has-recorded-operation | `audit-log` `secrets` | `audit-log` `secrets` | — |
| REQ-FB13 | has-permission, has-tenant | `permission-matrix` `tenant-isolation` | `permission-matrix` `tenant-isolation` | — |
| REQ-SEC01 | has-tenant | `tenant-isolation` | `tenant-isolation` | — |
| REQ-SEC02 | has-input, has-user-supplied-url, has-code-placement-rule | `boundary` `code-boundary` `equivalence` `ssrf` | `boundary` `code-boundary` `equivalence` `ssrf` | — |
| REQ-SEC03 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-SEC04 | has-calculation, has-code-placement-rule | `boundary` `code-boundary` `mutation` | `boundary` `code-boundary` `mutation` | — |
| REQ-SEC05 | has-ai-text | `prompt-injection` | `prompt-injection` | — |
| REQ-SEC06 | has-enumerated-input | `decision-table` `equivalence` | `decision-table` `equivalence` | — |
| REQ-SEC07 | has-enumerated-input | `decision-table` `equivalence` | `decision-table` `equivalence` | — |
| REQ-SEC08 | has-screen | `a11y` `keyboard` `screen-states` | `a11y` `keyboard` `screen-states` | — |
| REQ-SEC09 | has-input, has-secret, has-db-table, has-recorded-operation | `audit-log` `boundary` `db-migration` `equivalence` `secrets` | `audit-log` `boundary` `db-migration` `equivalence` `secrets` | — |
| REQ-SEC10 | has-secret, has-runtime-config | `infra-config` `secrets` | `infra-config` `secrets` | — |
| REQ-SEC11 | has-runtime-config | `infra-config` | `infra-config` | — |
| REQ-A01 | has-input, has-state, has-user-supplied-url | `boundary` `equivalence` `ssrf` `state-transition` | `boundary` `equivalence` `ssrf` `state-transition` | — |
| REQ-A02 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-A03 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-A04 | has-input, has-ai-text | `boundary` `equivalence` `prompt-injection` | `boundary` `equivalence` `prompt-injection` | — |
| REQ-A05 | has-state | `state-transition` | `state-transition` | — |
| REQ-A06 | has-state, has-tenant | `state-transition` `tenant-isolation` | `state-transition` `tenant-isolation` | — |
| REQ-A07 | has-permission | `permission-matrix` | `permission-matrix` | — |
| REQ-A08 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-G01 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-G02 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-G03 | has-input, has-ai-text | `boundary` `equivalence` `prompt-injection` | `boundary` `equivalence` `prompt-injection` | — |
| REQ-G04 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-G05 | has-state | `state-transition` | `state-transition` | — |
| REQ-G06 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-G07 | has-permission | `permission-matrix` | `permission-matrix` | — |
| REQ-G08 | has-state, has-permission | `permission-matrix` `state-transition` | `permission-matrix` `state-transition` | — |
| REQ-G09 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-G10 | has-state | `state-transition` | `state-transition` | — |
| REQ-G11 | has-input, has-ai-text, has-external, has-secret | `boundary` `equivalence` `fault-injection` `idempotency` `prompt-injection` `secrets` | `boundary` `equivalence` `fault-injection` `idempotency` `prompt-injection` `secrets` | — |
| REQ-API01 | has-permission, has-tenant | `permission-matrix` `tenant-isolation` | `permission-matrix` `tenant-isolation` | — |
| REQ-EV01 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-EV02 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-EV03 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-EV04 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-EV05 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-EV06 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-EV07 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-EV08 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-EV09 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-EV10 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-EV11 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-EV12 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-EV13 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-EV14 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-EV15 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-EV16 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-M01 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-M02 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-M03 | has-input, has-permission, has-tenant | `boundary` `equivalence` `permission-matrix` `tenant-isolation` | `boundary` `equivalence` `permission-matrix` `tenant-isolation` | — |
| REQ-TS04 | has-permission, has-tenant, has-enumerated-input | `decision-table` `equivalence` `permission-matrix` `tenant-isolation` | `decision-table` `equivalence` `permission-matrix` `tenant-isolation` | — |
| REQ-TS05 | has-screen | `a11y` `keyboard` `screen-states` | `a11y` `keyboard` `screen-states` | — |
| REQ-TS07 | has-db-table | `db-migration` | `db-migration` | — |
| REQ-TS01 | has-code-placement-rule | `code-boundary` | `code-boundary` | — |
| REQ-TS06 | has-color-scheme-variants | `a11y` | `a11y` | — |
| REQ-TS08 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-TS09 | has-code-placement-rule | `code-boundary` | `code-boundary` | — |
| REQ-TS11 | has-known-breakage | `regression` | `regression` | — |
| REQ-TS12 | has-input, has-shared-visual-form | `boundary` `equivalence` `visual` | `boundary` `equivalence` `visual` | — |
| REQ-TS13 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-TS14 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-TS15 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-TS16 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-TS17 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-TS18 | has-known-breakage, has-input | `boundary` `equivalence` `regression` | `boundary` `equivalence` `regression` | — |
| REQ-TS19 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-TS20 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-TS21 | has-known-breakage, has-input | `boundary` `equivalence` `regression` | `boundary` `equivalence` `regression` | — |
| REQ-SEO01 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-SEO02 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-SEO03 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-SEO04 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-SEO05 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-BLOG01 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-BLOG02 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-BLOG03 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-BLOG04 | has-state, has-permission, has-tenant, has-recorded-operation | `audit-log` `permission-matrix` `state-transition` `tenant-isolation` | `audit-log` `permission-matrix` `state-transition` `tenant-isolation` | — |
| REQ-BLOG05 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-BLOG06 | has-permission | `permission-matrix` | `permission-matrix` | — |
| REQ-BOPS01 | has-input, has-state, has-permission, has-tenant, has-screen, has-db-table, has-recorded-operation | `a11y` `audit-log` `boundary` `db-migration` `equivalence` `keyboard` `permission-matrix` `screen-states` `state-transition` `tenant-isolation` | `a11y` `audit-log` `boundary` `db-migration` `equivalence` `keyboard` `permission-matrix` `screen-states` `state-transition` `tenant-isolation` | — |
| REQ-BOPS02 | has-input, has-state, has-tenant, has-screen, has-db-table | `a11y` `boundary` `db-migration` `equivalence` `keyboard` `screen-states` `state-transition` `tenant-isolation` | `a11y` `boundary` `db-migration` `equivalence` `keyboard` `screen-states` `state-transition` `tenant-isolation` | — |
| REQ-BOPS03 | has-enumerated-input, has-state, has-tenant, has-screen, has-db-table | `a11y` `db-migration` `decision-table` `equivalence` `keyboard` `screen-states` `state-transition` `tenant-isolation` | `a11y` `db-migration` `decision-table` `equivalence` `keyboard` `screen-states` `state-transition` `tenant-isolation` | — |
| REQ-BOPS04 | has-input, has-state, has-permission, has-tenant, has-screen, has-db-table, has-recorded-operation | `a11y` `audit-log` `boundary` `db-migration` `equivalence` `keyboard` `permission-matrix` `screen-states` `state-transition` `tenant-isolation` | `a11y` `audit-log` `boundary` `db-migration` `equivalence` `keyboard` `permission-matrix` `screen-states` `state-transition` `tenant-isolation` | — |
| REQ-BOPS05 | has-state, has-permission, has-tenant, has-screen, has-db-table, has-recorded-operation, has-code-placement-rule | `a11y` `audit-log` `code-boundary` `db-migration` `keyboard` `permission-matrix` `screen-states` `state-transition` `tenant-isolation` | `a11y` `audit-log` `code-boundary` `db-migration` `keyboard` `permission-matrix` `screen-states` `state-transition` `tenant-isolation` | — |
| REQ-BOPS06 | has-enumerated-input, has-state, has-tenant, has-screen, has-db-table | `a11y` `db-migration` `decision-table` `equivalence` `keyboard` `screen-states` `state-transition` `tenant-isolation` | `a11y` `db-migration` `decision-table` `equivalence` `keyboard` `screen-states` `state-transition` `tenant-isolation` | — |
| REQ-BOPS07 | has-input, has-tenant, has-screen, has-db-table | `a11y` `boundary` `db-migration` `equivalence` `keyboard` `screen-states` `tenant-isolation` | `a11y` `boundary` `db-migration` `equivalence` `keyboard` `screen-states` `tenant-isolation` | — |
| REQ-BOPS08 | has-enumerated-input, has-state, has-permission, has-tenant, has-screen, has-db-table, has-recorded-operation | `a11y` `audit-log` `db-migration` `decision-table` `equivalence` `keyboard` `permission-matrix` `screen-states` `state-transition` `tenant-isolation` | `a11y` `audit-log` `db-migration` `decision-table` `equivalence` `keyboard` `permission-matrix` `screen-states` `state-transition` `tenant-isolation` | — |
| REQ-BOPS09 | has-input, has-state, has-permission, has-tenant, has-screen, has-db-table, has-recorded-operation | `a11y` `audit-log` `boundary` `db-migration` `equivalence` `keyboard` `permission-matrix` `screen-states` `state-transition` `tenant-isolation` | `a11y` `audit-log` `boundary` `db-migration` `equivalence` `keyboard` `permission-matrix` `screen-states` `state-transition` `tenant-isolation` | — |
| REQ-BOPS10 | has-enumerated-input, has-screen | `a11y` `decision-table` `equivalence` `keyboard` `screen-states` | `a11y` `decision-table` `equivalence` `keyboard` `screen-states` | — |
| REQ-BOPS11 | has-state, has-tenant, has-screen, has-db-table | `a11y` `db-migration` `keyboard` `screen-states` `state-transition` `tenant-isolation` | `a11y` `db-migration` `keyboard` `screen-states` `state-transition` `tenant-isolation` | — |
| REQ-BOPS12 | has-enumerated-input, has-screen | `a11y` `decision-table` `equivalence` `keyboard` `screen-states` | `a11y` `decision-table` `equivalence` `keyboard` `screen-states` | — |
| REQ-BOPS13 | has-code-placement-rule | `code-boundary` | `code-boundary` | — |
| REQ-BOPS14 | has-tenant, has-screen, has-code-placement-rule | `a11y` `code-boundary` `keyboard` `screen-states` `tenant-isolation` | `a11y` `code-boundary` `keyboard` `screen-states` `tenant-isolation` | — |
| REQ-BOPC01 | has-input, has-state, has-permission, has-tenant, has-external, has-screen, has-db-table, has-recorded-operation | `a11y` `audit-log` `boundary` `db-migration` `equivalence` `fault-injection` `idempotency` `keyboard` `permission-matrix` `screen-states` `state-transition` `tenant-isolation` | `a11y` `audit-log` `boundary` `db-migration` `equivalence` `fault-injection` `idempotency` `keyboard` `permission-matrix` `screen-states` `state-transition` `tenant-isolation` | — |
| REQ-BOPC02 | has-input, has-enumerated-input, has-tenant | `boundary` `decision-table` `equivalence` `tenant-isolation` | `boundary` `decision-table` `equivalence` `tenant-isolation` | — |
| REQ-BOPC03 | has-input, has-enumerated-input, has-permission, has-tenant, has-screen, has-db-table | `a11y` `boundary` `db-migration` `decision-table` `equivalence` `keyboard` `permission-matrix` `screen-states` `tenant-isolation` | `a11y` `boundary` `db-migration` `decision-table` `equivalence` `keyboard` `permission-matrix` `screen-states` `tenant-isolation` | — |
| REQ-BOPC04 | has-input, has-state, has-permission, has-tenant, has-screen, has-db-table, has-recorded-operation | `a11y` `audit-log` `boundary` `db-migration` `equivalence` `keyboard` `permission-matrix` `screen-states` `state-transition` `tenant-isolation` | `a11y` `audit-log` `boundary` `db-migration` `equivalence` `keyboard` `permission-matrix` `screen-states` `state-transition` `tenant-isolation` | — |
| REQ-WA01 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-WA02 | has-input, has-permission | `boundary` `equivalence` `permission-matrix` | `boundary` `equivalence` `permission-matrix` | — |
| REQ-WB01 | has-input, has-permission | `boundary` `equivalence` `permission-matrix` | `boundary` `equivalence` `permission-matrix` | — |
| REQ-WB02 | has-permission | `permission-matrix` | `permission-matrix` | — |
| REQ-WC02 | has-state | `state-transition` | `state-transition` | — |
| REQ-WC04 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-WC01 | has-enumerated-input | `decision-table` `equivalence` | `decision-table` `equivalence` | — |
| REQ-WC03 | has-enumerated-input | `decision-table` `equivalence` | `decision-table` `equivalence` | — |
| REQ-WC05 | has-enumerated-input | `decision-table` `equivalence` | `decision-table` `equivalence` | — |
| REQ-WC06 | has-permission | `permission-matrix` | `permission-matrix` | — |
| REQ-WC07 | has-enumerated-input | `decision-table` `equivalence` | `decision-table` `equivalence` | — |
| REQ-WC08 | has-enumerated-input | `decision-table` `equivalence` | `decision-table` `equivalence` | — |
| REQ-CI01 | has-runtime-config | `infra-config` | `infra-config` | — |
| REQ-CI02 | has-runtime-config | `infra-config` | `infra-config` | — |
| REQ-CI03 | has-runtime-config | `infra-config` | `infra-config` | — |
| REQ-CI04 | has-runtime-config | `infra-config` | `infra-config` | — |
| REQ-CI05 | has-runtime-config | `infra-config` | `infra-config` | — |
| REQ-CI06 | has-runtime-config | `infra-config` | `infra-config` | — |
| REQ-CI07 | has-runtime-config, has-secret | `infra-config` `secrets` | `infra-config` `secrets` | — |
| REQ-CI08 | has-code-placement-rule | `code-boundary` | `code-boundary` | — |
| REQ-CI09 | has-runtime-config | `infra-config` | `infra-config` | — |
| REQ-CI10 | has-runtime-config | `infra-config` | `infra-config` | — |
| REQ-CI11 | has-runtime-config | `infra-config` | `infra-config` | — |
| REQ-CI12 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-CI13 | has-runtime-config | `infra-config` | `infra-config` | — |
| REQ-CI14 | has-runtime-config, has-input, has-secret | `boundary` `equivalence` `infra-config` `secrets` | `boundary` `equivalence` `infra-config` `secrets` | — |
| REQ-CI15 | has-runtime-config, has-input | `boundary` `equivalence` `infra-config` | `boundary` `equivalence` `infra-config` | — |
| REQ-CI16 | has-runtime-config, has-input, has-code-placement-rule | `boundary` `code-boundary` `equivalence` `infra-config` | `boundary` `code-boundary` `equivalence` `infra-config` | — |
| REQ-FB01 | has-enumerated-input | `decision-table` `equivalence` | `decision-table` `equivalence` | — |
| REQ-FB02 | has-screen, has-permission | `a11y` `keyboard` `permission-matrix` `screen-states` | `a11y` `keyboard` `permission-matrix` `screen-states` | — |
| REQ-FB03 | has-input, has-screen | `a11y` `boundary` `equivalence` `keyboard` `screen-states` | `a11y` `boundary` `equivalence` `keyboard` `screen-states` | — |
| REQ-FB04 | has-screen | `a11y` `keyboard` `screen-states` | `a11y` `keyboard` `screen-states` | — |
| REQ-FB05 | has-screen | `a11y` `keyboard` `screen-states` | `a11y` `keyboard` `screen-states` | — |
| REQ-FB06 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-FB07 | has-screen | `a11y` `keyboard` `screen-states` | `a11y` `keyboard` `screen-states` | — |
| REQ-FB10 | has-enumerated-input, has-secret | `decision-table` `equivalence` `secrets` | `decision-table` `equivalence` `secrets` | — |
| REQ-FB11 | has-ai-text | `prompt-injection` | `prompt-injection` | — |
| REQ-UX01 | has-code-placement-rule | `code-boundary` | `code-boundary` | — |
| REQ-UX02 | has-enumerated-input | `decision-table` `equivalence` | `decision-table` `equivalence` | — |
| REQ-UX03 | has-enumerated-input | `decision-table` `equivalence` | `decision-table` `equivalence` | — |
| REQ-UX04 | has-code-placement-rule | `code-boundary` | `code-boundary` | — |
| REQ-UX05 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |
| REQ-UX06 | has-code-placement-rule | `code-boundary` | `code-boundary` | — |
| REQ-UX07 | has-code-placement-rule | `code-boundary` | `code-boundary` | — |
| REQ-UX08 | has-code-placement-rule, has-input, has-shared-visual-form | `boundary` `code-boundary` `equivalence` `visual` | `boundary` `code-boundary` `equivalence` `visual` | — |
| REQ-UX09 | has-screen | `a11y` `keyboard` `screen-states` | `a11y` `keyboard` `screen-states` | — |
| REQ-UX10 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — |

## 理由つき除外の中身

- **REQ-P02**
  - `fault-injection`: 取込元のうち API と拡張機能がまだスタブで、落とす外部接続が実在しない（残課題 45）
- **REQ-P03**
  - `boundary`: 同一判定は識別子の一致・不一致だけで、大小の端が無い
- **REQ-P08**
  - `fault-injection`: 各媒体への実送信がスタブで、失敗・遅延・一部成功を注入する先が無い（残課題 45）
- **REQ-P09**
  - `fault-injection`: ASP への実接続がスタブで、落とす外部接続が実在しない
- **REQ-QC12**
  - `boundary`: 公開ゲートの 13 項目は真偽の組合せで、大小の端が無い。組合せ側は `tests/property/publish-gate.property.test.ts` の手書きの決定表（13 項目 × 単独違反 18 行）が当てている（2026-08-21 に理由を差し替え。§4 参照）

## 未宣言の要件

`REQ-TH04` `REQ-TH05` `REQ-TS02` `REQ-TS03` `REQ-TS10`
<!-- 生成物の指紋 sha256:05f39464f90b92aff0a54f29b132ba3ed9ae0d128d4c521424942d3e2b5aff08 -->
