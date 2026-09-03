# Route / 表現監査証跡

## 再現コマンド

```bash
pnpm exec vitest run tests/acceptance/feat-admin-cognitive-load-ui/ledger-contract.test.ts --coverage.enabled=false
```

## 記録

- `src/app/admin` route: 86
- `screen-information-ledger.json`: 86
- 未判定: 0
- 規則表にない表現: 0
- 素の admin `<table>`: 0（共通 DataTable / RankingTable を利用）
- primary表現→実共通rendererの未結線: 0
- 表現内訳: table 44 / graph 4 / card 36 / comparison 1 / summary 1
- table主表現: 44 route（実DataTable / RankingTable未結線0）
- card主表現: 36 route（route全体wrapper 0、判断単位renderer contractとの集合差分0、実Card 1、Card入れ子0）
- Foldable: 3 route（種類+件数、初期open 0）/ dedicated-route 7 / none 76
- operational states: 86 route × 6状態、空event/safeData/nextAction 0
- keyboard primary action: 86 route × role / accessible name / occurrence / completion。internal navigation 26、external navigation 1、form submit 43、form entry 4、review complete 11、local activation 1。全86 routeで実Tab到達後に、Enterでの移動・native submit発火・keyboard入力値変更・確認領域scroll・局所状態変更のいずれかを観測する。

台帳の各行は route、主目的、主要 action 1 件、権限、残す情報、削る情報、理由、表現、6 状態、200%相当で照合する主要対象のrole / accessible name / 同名時の順番 / keyboard完了種別を持つ。
