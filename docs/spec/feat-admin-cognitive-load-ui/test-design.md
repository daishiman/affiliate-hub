# P04 テスト設計（TDD）

## 方針

仕様を「静的契約」「部品描画」「境界非退行」「実ブラウザ」の 4 層へ分ける。P05 の実装前に feature 専用テストを実行し、ホームの内部名、sticky 主キー、sidebar gap token、borderless Section の未実装を RED として確認する。

## ケース

| ID | 層 | 対象 | 失敗時に示すこと |
|---|---|---|---|
| P04-01 | acceptance | 台帳 86 route と実 page 86 の一対一 | 監査漏れまたは古い台帳 |
| P04-02 | acceptance | 表現 5 種、未決 0、6 状態 | 表現判断・状態契約の欠落 |
| P04-03 | UI | 管理ホームに API/endpoint/tool 名を出さない | 内部実装情報の再露出 |
| P04-04 | UI | 共通表の sticky column header / first row header | 長い表で文脈を失う |
| P04-05 | UI | sidebar gap が semantic token 1 本 | 画面ごとの間隔ずれ |
| P04-06 | UI | Section は章、Card は個体 | 全章カード化の再発 |
| P04-07 | integration | route capability / API / write source 非変更 | presentation 変更の境界越え |
| P04-08 | E2E | 375/768/1280/1600、200%、keyboard focus | はみ出し・操作不能 |
| P04-09 | E2E | sticky header / first key の computed style | CSS が実ブラウザで効かない |
| P04-10 | E2E | ホーム本文の内部語非露出 | server render 後の再混入 |

## TDD 記録

- RED: P05 前に feature 専用 Vitest を実行。期待する失敗は P04-03〜06。
- GREEN: 共通 token / shell / table / section とホームを最小変更し、同じテストを再実行。
- REFACTOR: 画面固有の表・カードを共通部品へ寄せ、全 UI / acceptance / integration / E2E を再実行。

## 品質ゲート

`pnpm typecheck`、`pnpm lint`、feature tests、全 Vitest、`pnpm build`、Playwright。既存 fail と今回 fail を区別し、今回差分による fail は 0 にする。
