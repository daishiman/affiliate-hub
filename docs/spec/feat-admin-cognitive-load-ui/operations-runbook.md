# P12 情報設計運用 Runbook

## 新規 admin route を追加するとき

1. `screen-information-ledger.json` と `.md` に route、主目的、主要 action 1 件、権限、keep / remove / rationale、6 状態、keyboard対象のrole / accessible name / occurrence / completionを追加する。
2. **先に `PRIMARY_TASK_BY_ROUTE_ID` へ具体的な動詞で目的を書く。**
   「◯◯を確認する」と書くと表現は必ず table になる。動詞が
   「見つける / 選ぶ / 決める / 対処する」なら board が該当する。
3. `representation-rule-table.json` の許可表現 8 種
   (summary / graph / comparison / table / card / board / list / timeline)
   から決定順に従って選び、`primary`（実装した表現）と
   `plannedPrimary`（あるべき表現）の両方を台帳へ宣言する。
   2 つがずれる場合は `plannedPrimaryGapRouteIds` へ route id を足す。
4. `ADMIN_ROUTE_METADATA` と台帳の route 集合が一致することを feature acceptance test で確認する。
5. Section / SummaryStrip / BarChart / DataTable / Card / WorkBoard / ListView / StepList /
   ScheduleCalendar / state views の既存部品を再利用する。独自 table、同形 metric card、
   画面固有 sidebar gap は作らない。
6. ideal / empty / loading / partial / error / slow を定義し、error は「事象・データ安全性・次の行動」を伝える。
   分岐を部分コンポーネントへ括り出した画面は、`AdminShell` に `screenState` を明示で渡す
   (`screenStateOfResults` が値を作る)。要素ツリーを歩く推定は部分コンポーネントの中を見られない。
7. 375 / 768 / 1280 / 1600、200%、keyboard、focus、色以外の識別を検査する。
8. 認証、API response、書込結果に変更がないことを contract / integration test で確認する。

## 規則からの逸脱を見つけたとき

まず利用者の判断目的へ戻り、既存規則のどれに該当するかを決める。共通規則で扱えるなら画面の独自実装を共通部品へ移す。扱えない場合だけ、理由、影響 route、accessibility、mobile、rollback を design review に記録し、規則表と test を先に更新する。

## 定期監査

```bash
pnpm exec vitest run tests/acceptance/feat-admin-cognitive-load-ui/ledger-contract.test.ts tests/ui/admin-cognitive-load-ui.test.tsx --coverage.enabled=false
pnpm check:reference-reuse
pnpm visual
```

route 未収録、規則外表現、admin の素 table、sidebar gap の固定値、API 情報の home 再露出を 0 に保つ。
