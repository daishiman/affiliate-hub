# P07 受入判定

## 総合判定

受入 12 件は **12 / 12 PASS、未充足 0 件**。表示層のみを変更し、認証・API・書込の契約は変更していない。

| ID | 判定 | 根拠 |
| --- | --- | --- |
| AC-01 全 route の情報監査 | PASS | `screen-information-ledger.json` は `src/app/admin` の 86 route を全件収録し、未判定 0。`ledger-contract.test.ts` |
| AC-02 規則表への所属 | PASS | 全 86 route の主表現と実 page の共通 renderer を機械突合。table 44 / graph 4 / card 36 / comparison 1 / summary 1、規則外 0。table は実 `DataTable` / `RankingTable`、graph は実データ `BarChart` へ結線 |
| AC-03 長い表の文脈保持 | PASS | `DataTable` と `RankingTable` の column header / primary key を sticky 化。Playwright の sticky 検査 PASS |
| AC-04 カード主 1 従 n | PASS | route全体をCardで包む実装を廃止（`routeWrapper: false`）。card主表現36 routeを `ADMIN_CARD_CONTRACTS` へ1対1登録し、判断単位はCard / borderless Section / Formに限定。実Cardは公開記事編集の現在状態1件だけで、入れ子0、主張1・主情報1・補助4以下・主操作1以下・主張120字以下を検査 |
| AC-05 ホームの内部 API 除去 | PASS | `/admin` からツール名・API 名・endpoint 列挙を削除。設定・専用画面の既存導線は維持。UI test |
| AC-06 sidebar spacing | PASS | `--layout-nav-icon-label-gap` を全 nav item の単一 token に適用。icon-only の accessible label は既存 shell で維持 |
| AC-07 要約から詳細へ | PASS | 全86 routeを `none / foldable / dedicated-route` へ正確に分類。実 `Foldable` 3 routeは種類+件数を示し初期 `open` 0。専用7 routeは自己参照を禁止し、実リンクと親子routeを検査 |
| AC-08 危険操作の明示承認 | PASS | 成果リンクは決定的seedから旧行停止→広告主/商品選択→新行登録→旧=停止・新=読者に出ている状態の影響まで検査。公開・削除と通常操作undoも実画面E2Eで維持 |
| AC-09 6 状態 | PASS | 86 route × ideal / empty / loading / partial / error / slow の event, safeData, nextAction を型付き結線。`AdminShell` / `AppShell` の実runtime DOMで全6枝をrender検査し、loading / error boundaryも実装 |
| AC-10 色以外の識別 | PASS | `DecisionStatus` の暫定・確定・母数不足を型、可視label、accessible nameで区別し、順位・分析・改善とcatalogへ実結線。summary / chartも正確な文字値を保持 |
| AC-11 keyboard / 200% | PASS | 全86管理routeを375 / 768 / 1280 / 1600pxと384px（768pxの200%相当）で実走。台帳のrole・accessible name・同名時の順番まで照合し、skip linkから指定主要対象へ実Tabで到達。内部GETはEnter完了、書込系は当該submit/entry境界へ到達し、隔離fixtureのpreview / confirm / undo E2Eへ接続。86 / 86 PASS、`no-control` 成功扱い0 |
| AC-12 非退行 | PASS | feature integrationでowner/AI ownerの公開権限、未認証 `/api/tools` の401本文、同意済みpage_viewの1回書込を実契約として固定。domain/API/repository/migration変更0 |

## 自動突合

台帳・規則 JSON は機械検査し、画面数、許可表現、必須フィールドを突合する。既存 `acceptance:reconcile` は `feat-uiux-overhaul` A1〜A10 専用であり、本 feature の 12 件は上記 feature 固有テストで突合した。
