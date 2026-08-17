# 要件ごとの必須テスト種別（自動生成）

`node scripts/required-test-types.mjs` が書き換える。**手で編集しない。**
宣言は `docs/product/required-test-types.md`、語彙と上限は `quality-gates.config.mjs` が正本。

- 最終更新: 2026-08-17
- 要件表の要件: 240 件
- 性質を宣言済: 12 件
- **未宣言: 228 件**（上限 228 件）
- 理由つきの除外: 13 件（上限 13 件）

未宣言とは「必須種別をまだ決めていない」という意味で、
テストが無いという意味ではない。**新しい要件は宣言しないと CI が落ちる。**

## 宣言済の要件

| REQ | 性質 | 必須種別 | 満たしている | 理由つき除外 |
| --- | --- | --- | --- | --- |
| REQ-P01 | has-tenant, has-permission, has-screen | `a11y` `keyboard` `permission-matrix` `screen-states` `tenant-isolation` | `a11y` `permission-matrix` `screen-states` `tenant-isolation` | `keyboard` | 
| REQ-P02 | has-input, has-external, has-screen | `a11y` `boundary` `equivalence` `fault-injection` `idempotency` `keyboard` `screen-states` | `a11y` `equivalence` `idempotency` `screen-states` | `boundary` `fault-injection` `keyboard` | 
| REQ-P03 | has-calculation, has-screen | `a11y` `boundary` `keyboard` `mutation` `screen-states` | `a11y` `mutation` `screen-states` | `boundary` `keyboard` | 
| REQ-P04 | has-calculation, has-screen | `a11y` `boundary` `keyboard` `mutation` `screen-states` | `a11y` `boundary` `mutation` `screen-states` | `keyboard` | 
| REQ-P08 | has-state, has-external, has-screen | `a11y` `fault-injection` `idempotency` `keyboard` `screen-states` `state-transition` | `a11y` `screen-states` `state-transition` | `fault-injection` `idempotency` `keyboard` | 
| REQ-P10 | has-input, has-screen | `a11y` `boundary` `equivalence` `keyboard` `screen-states` | `a11y` `boundary` `equivalence` `screen-states` | `keyboard` | 
| REQ-API02 | has-permission, has-tenant | `permission-matrix` `tenant-isolation` | `permission-matrix` `tenant-isolation` | — | 
| REQ-R11 | has-permission | `permission-matrix` | `permission-matrix` | — | 
| REQ-R12 | has-permission | `permission-matrix` | `permission-matrix` | — | 
| REQ-QC12 | has-calculation | `boundary` `mutation` | `mutation` | `boundary` | 
| REQ-IM05 | has-state | `state-transition` | `state-transition` | — | 
| REQ-TH01 | has-screen | `a11y` `keyboard` `screen-states` | `a11y` `screen-states` | `keyboard` | 

## 理由つき除外の中身

- **REQ-P01**
  - `keyboard`: 操作順とフォーカス移動の検査が無い。いまあるのはフォーカス輪郭の色の検査だけで、これは a11y 側で数えている（残課題 45）
- **REQ-P02**
  - `boundary`: 入力が URL 文字列で長さ上限を設けていないため、端が存在しない。上限を入れる時に同時に書く
  - `fault-injection`: 取込元のうち API と拡張機能がまだスタブで、落とす外部接続が実在しない（残課題 45）
  - `keyboard`: REQ-P01 と同じ
- **REQ-P03**
  - `boundary`: 同一判定は識別子の一致・不一致だけで、大小の端が無い
  - `keyboard`: REQ-P01 と同じ
- **REQ-P04**
  - `keyboard`: REQ-P01 と同じ
- **REQ-P08**
  - `fault-injection`: 各媒体への実送信がスタブで、失敗・遅延・一部成功を注入する先が無い（残課題 45）
  - `idempotency`: 冪等キーの二重実行は `tests/integration/d1-distribution.test.ts` で見ているが `@types` 印を付けていない。印を付ける作業を残課題 45 に含める
  - `keyboard`: REQ-P01 と同じ
- **REQ-P10**
  - `keyboard`: REQ-P01 と同じ
- **REQ-QC12**
  - `boundary`: 公開ゲートの 13 項目は真偽の組合せで、大小の端が無い。組合せ側は性質テストが生成して当てている
- **REQ-TH01**
  - `keyboard`: REQ-P01 と同じ

## 未宣言の要件

`REQ-A01` `REQ-A02` `REQ-A03` `REQ-A04` `REQ-A05` `REQ-A06` `REQ-A07` `REQ-A08` `REQ-API01` `REQ-B01` `REQ-B02` `REQ-B03` `REQ-B04` `REQ-B05` `REQ-B06` `REQ-B07` `REQ-B08` `REQ-B09` `REQ-B10` `REQ-B11` `REQ-B12` `REQ-B13` `REQ-B14` `REQ-B15` `REQ-B16` `REQ-B17` `REQ-B18` `REQ-CI01` `REQ-CI02` `REQ-CI03` `REQ-CI04` `REQ-CI05` `REQ-CI06` `REQ-CI07` `REQ-CI08` `REQ-CI09` `REQ-CI10` `REQ-CI11` `REQ-CI12` `REQ-CI13` `REQ-E01` `REQ-E02` `REQ-E03` `REQ-E04` `REQ-E05` `REQ-E06` `REQ-E07` `REQ-E08` `REQ-E09` `REQ-E10` `REQ-E11` `REQ-E12` `REQ-E13` `REQ-E14` `REQ-E15` `REQ-E16` `REQ-E17` `REQ-E18` `REQ-E19` `REQ-E20` `REQ-E21` `REQ-E22` `REQ-E23` `REQ-E24` `REQ-E25` `REQ-E26` `REQ-E27` `REQ-E28` `REQ-E29` `REQ-E30` `REQ-E31` `REQ-E32` `REQ-EV01` `REQ-EV02` `REQ-EV03` `REQ-EV04` `REQ-EV05` `REQ-EV06` `REQ-EV07` `REQ-EV08` `REQ-EV09` `REQ-EV10` `REQ-EV11` `REQ-EV12` `REQ-EV13` `REQ-EV14` `REQ-EV15` `REQ-EV16` `REQ-FB01` `REQ-FB02` `REQ-FB03` `REQ-FB04` `REQ-FB05` `REQ-FB06` `REQ-FB07` `REQ-FB08` `REQ-FB09` `REQ-FB10` `REQ-FB11` `REQ-FB12` `REQ-FD01` `REQ-FD02` `REQ-FD03` `REQ-FD04` `REQ-FD05` `REQ-FD06` `REQ-G01` `REQ-G02` `REQ-G03` `REQ-G04` `REQ-G05` `REQ-G06` `REQ-G07` `REQ-G08` `REQ-G09` `REQ-G10` `REQ-G11` `REQ-IM01` `REQ-IM02` `REQ-IM03` `REQ-IM04` `REQ-IM06` `REQ-IM07` `REQ-IM08` `REQ-IM09` `REQ-IM10` `REQ-IM11` `REQ-IM12` `REQ-IM13` `REQ-M01` `REQ-M02` `REQ-M03` `REQ-P05` `REQ-P06` `REQ-P07` `REQ-P09` `REQ-QC01` `REQ-QC02` `REQ-QC03` `REQ-QC04` `REQ-QC05` `REQ-QC06` `REQ-QC07` `REQ-QC08` `REQ-QC09` `REQ-QC10` `REQ-QC11` `REQ-R01` `REQ-R02` `REQ-R03` `REQ-R04` `REQ-R05` `REQ-R06` `REQ-R07` `REQ-R08` `REQ-R09` `REQ-R10` `REQ-S01` `REQ-S02` `REQ-S03` `REQ-S04` `REQ-S05` `REQ-S06` `REQ-S07` `REQ-S08` `REQ-S09` `REQ-S10` `REQ-SEC01` `REQ-SEC02` `REQ-SEC03` `REQ-SEC04` `REQ-SEC05` `REQ-SEC06` `REQ-SEC07` `REQ-SEC08` `REQ-SEC09` `REQ-SEC10` `REQ-TH02` `REQ-TH03` `REQ-TH04` `REQ-TH05` `REQ-TM01` `REQ-TM02` `REQ-TM03` `REQ-TM04` `REQ-TM05` `REQ-TM06` `REQ-TM07` `REQ-TM08` `REQ-TM09` `REQ-TM10` `REQ-TM11` `REQ-TM12` `REQ-TM13` `REQ-TS01` `REQ-TS02` `REQ-TS03` `REQ-TS04` `REQ-TS05` `REQ-TS06` `REQ-TS07` `REQ-TS08` `REQ-TS09` `REQ-TS10` `REQ-W01` `REQ-W02` `REQ-W03` `REQ-W04` `REQ-W05` `REQ-W06` `REQ-W07` `REQ-W08` `REQ-W09` `REQ-W10` `REQ-W11` `REQ-W12` `REQ-WA01` `REQ-WA02` `REQ-WB01` `REQ-WB02` `REQ-WC01` `REQ-WC02` `REQ-WC03` `REQ-WC04` `REQ-WC05` `REQ-WC06` `REQ-WC07` `REQ-WC08`
