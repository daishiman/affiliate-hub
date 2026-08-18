# 要件ごとの必須テスト種別（自動生成）

`node scripts/required-test-types.mjs` が書き換える。**手で編集しない。**
宣言は `docs/product/required-test-types.md`、語彙と上限は `quality-gates.config.mjs` が正本。

- 最終更新: 2026-08-18
- 要件表の要件: 241 件
- 性質を宣言済: 88 件
- **未宣言: 153 件**（上限 153 件）
- 理由つきの除外: 7 件（上限 7 件）

未宣言とは「必須種別をまだ決めていない」という意味で、
テストが無いという意味ではない。**新しい要件は宣言しないと CI が落ちる。**

## 宣言済の要件

| REQ | 性質 | 必須種別 | 満たしている | 理由つき除外 |
| --- | --- | --- | --- | --- |
| REQ-P01 | has-tenant, has-permission, has-screen | `a11y` `keyboard` `permission-matrix` `screen-states` `tenant-isolation` | `a11y` `keyboard` `permission-matrix` `screen-states` `tenant-isolation` | — | 
| REQ-P02 | has-input, has-external, has-screen, has-user-supplied-url | `a11y` `boundary` `equivalence` `fault-injection` `idempotency` `keyboard` `screen-states` `ssrf` | `a11y` `boundary` `equivalence` `idempotency` `keyboard` `screen-states` `ssrf` | `fault-injection` | 
| REQ-P03 | has-calculation, has-screen | `a11y` `boundary` `keyboard` `mutation` `screen-states` | `a11y` `keyboard` `mutation` `screen-states` | `boundary` | 
| REQ-P04 | has-calculation, has-screen | `a11y` `boundary` `keyboard` `mutation` `screen-states` | `a11y` `boundary` `keyboard` `mutation` `screen-states` | — | 
| REQ-P05 | has-input, has-screen | `a11y` `boundary` `equivalence` `keyboard` `screen-states` | `a11y` `boundary` `equivalence` `keyboard` `screen-states` | — | 
| REQ-P06 | has-input, has-screen, has-ai-text | `a11y` `boundary` `equivalence` `keyboard` `prompt-injection` `screen-states` | `a11y` `boundary` `equivalence` `keyboard` `prompt-injection` `screen-states` | — | 
| REQ-P07 | has-input, has-state, has-screen | `a11y` `boundary` `equivalence` `keyboard` `screen-states` `state-transition` | `a11y` `equivalence` `keyboard` `screen-states` `state-transition` | `boundary` | 
| REQ-P08 | has-state, has-external, has-screen, has-db-table | `a11y` `db-migration` `fault-injection` `idempotency` `keyboard` `screen-states` `state-transition` | `a11y` `db-migration` `idempotency` `keyboard` `screen-states` `state-transition` | `fault-injection` | 
| REQ-P09 | has-input, has-tenant, has-external, has-screen, has-db-table | `a11y` `boundary` `db-migration` `equivalence` `fault-injection` `idempotency` `keyboard` `screen-states` `tenant-isolation` | `a11y` `boundary` `db-migration` `equivalence` `idempotency` `keyboard` `screen-states` `tenant-isolation` | `fault-injection` | 
| REQ-P10 | has-input, has-screen | `a11y` `boundary` `equivalence` `keyboard` `screen-states` | `a11y` `boundary` `equivalence` `keyboard` `screen-states` | — | 
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
| REQ-QC12 | has-calculation | `boundary` `mutation` | `mutation` | `boundary` | 
| REQ-IM05 | has-state | `state-transition` | `state-transition` | — | 
| REQ-TH01 | has-screen | `a11y` `keyboard` `screen-states` | `a11y` `keyboard` `screen-states` | — | 
| REQ-FB13 | has-permission, has-tenant | `permission-matrix` `tenant-isolation` | `permission-matrix` `tenant-isolation` | — | 
| REQ-SEC01 | has-tenant | `tenant-isolation` | `tenant-isolation` | — | 
| REQ-SEC02 | has-input, has-user-supplied-url | `boundary` `equivalence` `ssrf` | `boundary` `equivalence` `ssrf` | — | 
| REQ-SEC03 | has-input | `boundary` `equivalence` | `boundary` `equivalence` | — | 
| REQ-SEC04 | has-calculation | `boundary` `mutation` | `boundary` `mutation` | — | 
| REQ-SEC05 | has-ai-text | `prompt-injection` | `prompt-injection` | — | 
| REQ-SEC06 | has-enumerated-input | `decision-table` `equivalence` | `decision-table` `equivalence` | — | 
| REQ-SEC07 | has-enumerated-input | `decision-table` `equivalence` | `decision-table` `equivalence` | — | 
| REQ-SEC08 | has-screen | `a11y` `keyboard` `screen-states` | `a11y` `keyboard` `screen-states` | — | 
| REQ-SEC09 | has-input, has-secret, has-db-table | `boundary` `db-migration` `equivalence` `secrets` | `db-migration` `equivalence` `secrets` | `boundary` | 
| REQ-SEC10 | has-secret, has-runtime-config | `infra-config` `secrets` | `infra-config` `secrets` | — | 
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

## 理由つき除外の中身

- **REQ-P02**
  - `fault-injection`: 取込元のうち API と拡張機能がまだスタブで、落とす外部接続が実在しない（残課題 45）
- **REQ-P03**
  - `boundary`: 同一判定は識別子の一致・不一致だけで、大小の端が無い
- **REQ-P07**
  - `boundary`: ウィザードの入力は選択肢と自由記述で、長さ上限を設けていないため端が無い。上限を入れる時に同時に書く
- **REQ-P08**
  - `fault-injection`: 各媒体への実送信がスタブで、失敗・遅延・一部成功を注入する先が無い（残課題 45）
- **REQ-P09**
  - `fault-injection`: ASP への実接続がスタブで、落とす外部接続が実在しない
- **REQ-QC12**
  - `boundary`: 公開ゲートの 13 項目は真偽の組合せで、大小の端が無い。組合せ側は性質テストが生成して当てている
- **REQ-SEC09**
  - `boundary`: 監査記録の入力は操作内容と差分で、大小の端が無い。見ているのは消す / 消さないの分かれ目だけ

## 未宣言の要件

`REQ-B01` `REQ-B02` `REQ-B03` `REQ-B04` `REQ-B05` `REQ-B06` `REQ-B07` `REQ-B08` `REQ-B09` `REQ-B10` `REQ-B11` `REQ-B12` `REQ-B13` `REQ-B14` `REQ-B15` `REQ-B16` `REQ-B17` `REQ-B18` `REQ-CI01` `REQ-CI02` `REQ-CI03` `REQ-CI04` `REQ-CI05` `REQ-CI06` `REQ-CI07` `REQ-CI08` `REQ-CI09` `REQ-CI10` `REQ-CI11` `REQ-CI12` `REQ-CI13` `REQ-E01` `REQ-E02` `REQ-E03` `REQ-E04` `REQ-E05` `REQ-E06` `REQ-E07` `REQ-E08` `REQ-E09` `REQ-E10` `REQ-E11` `REQ-E12` `REQ-E13` `REQ-E14` `REQ-E15` `REQ-E16` `REQ-E17` `REQ-E18` `REQ-E19` `REQ-E20` `REQ-E21` `REQ-E22` `REQ-E23` `REQ-E24` `REQ-E25` `REQ-E26` `REQ-E27` `REQ-E28` `REQ-E29` `REQ-E30` `REQ-E31` `REQ-E32` `REQ-FB01` `REQ-FB02` `REQ-FB03` `REQ-FB04` `REQ-FB05` `REQ-FB06` `REQ-FB07` `REQ-FB08` `REQ-FB09` `REQ-FB10` `REQ-FB11` `REQ-FB12` `REQ-FD01` `REQ-FD02` `REQ-FD03` `REQ-FD04` `REQ-FD05` `REQ-FD06` `REQ-IM01` `REQ-IM02` `REQ-IM03` `REQ-IM04` `REQ-IM06` `REQ-IM07` `REQ-IM08` `REQ-IM09` `REQ-IM10` `REQ-IM11` `REQ-IM12` `REQ-IM13` `REQ-QC01` `REQ-QC02` `REQ-QC03` `REQ-QC04` `REQ-QC05` `REQ-QC06` `REQ-QC07` `REQ-QC08` `REQ-QC09` `REQ-QC10` `REQ-QC11` `REQ-S01` `REQ-S02` `REQ-S03` `REQ-S04` `REQ-S05` `REQ-S06` `REQ-S07` `REQ-S08` `REQ-S09` `REQ-S10` `REQ-TH02` `REQ-TH03` `REQ-TH04` `REQ-TH05` `REQ-TM01` `REQ-TM02` `REQ-TM03` `REQ-TM04` `REQ-TM05` `REQ-TM06` `REQ-TM07` `REQ-TM08` `REQ-TM09` `REQ-TM10` `REQ-TM11` `REQ-TM12` `REQ-TM13` `REQ-TS01` `REQ-TS02` `REQ-TS03` `REQ-TS04` `REQ-TS05` `REQ-TS06` `REQ-TS07` `REQ-TS08` `REQ-TS09` `REQ-TS10` `REQ-W01` `REQ-W02` `REQ-W03` `REQ-W04` `REQ-W05` `REQ-W06` `REQ-W07` `REQ-W08` `REQ-W09` `REQ-W10` `REQ-W11` `REQ-W12`
