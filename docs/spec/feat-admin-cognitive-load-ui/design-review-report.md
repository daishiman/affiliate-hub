# P03 設計レビュー報告

## 結論

**PASS — 12 / 12 要件を設計へ割り当て済み。未決 0 件。**

## レビュー記録

| # | 観点 | 判定 | 設計上の根拠 |
|---:|---|---|---|
| 1 | 全管理画面の台帳 | PASS | 86 route、実 `page.tsx` 86、未決 0 |
| 2 | 表現方式の宣言 | PASS | 5 種の許容値と route ごとの主/補助表現 |
| 3 | sticky header / primary key | PASS | table readability contract |
| 4 | カードの主従階層 | PASS | card hierarchy contract |
| 5 | ホームの内部情報除去 | PASS | home は業務操作だけ、専用画面は維持 |
| 6 | sidebar icon/text spacing | PASS | semantic token 1 本へ集約 |
| 7 | 要約→明示開示 | PASS | progressive disclosure contract |
| 8 | 破壊操作の影響確認 | PASS | 非退行契約と既存確認 UI を維持 |
| 9 | 6 状態 | PASS | state matrix |
| 10 | 色以外の状態識別 | PASS | 可視文字 + accessible name |
| 11 | viewport / zoom / keyboard | PASS | 4 幅 + 200% + focus を品質ゲート化 |
| 12 | auth/API/write 非退行 | PASS | presentation 限定、既存境界試験を必須化 |

## 設計判断

- 86 画面を個別装飾せず、`AppShell`、`Section`、`DataTable`、共通 pattern へ変更を集中する。
- 章カードの濫用を止め、カードは「1 件を判断する単位」に限定する。
- グラフは実データに時系列・分布がある画面だけで使い、架空の可視化は作らない。
- モバイルでも sticky header を無効化しない。主キー列と列名の対応を保つことを優先する。

## 次ゲート

P04 で契約を検査へ写し、意図した未実装箇所が RED になることを確認してから P05 の共通部品実装へ進む。
