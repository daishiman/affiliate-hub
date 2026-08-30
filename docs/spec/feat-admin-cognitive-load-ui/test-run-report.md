# P06 テスト実行報告

## 判定

機能固有ゲートは **PASS**。機能固有と関連ゲートは6 files・41 tests PASS。最終 `pnpm verify` は401 files・9,663 testsを含む全ゲートがPASSし、全体E2Eは492 passed / 2 intentional skip / 0 failedで完走した。全86管理routeの実Tab・200%相当・4 viewport監査も86 / 86 PASS。mobileの差し替えとundoは共有ローカルD1へ同じmutationを二重実行しないためskipし、desktopで旧リンク停止→新規登録→影響確認と、通常操作の実書込→復元まで検査した。

## TDD 記録

| 段階 | コマンド / 結果 |
| --- | --- |
| RED | `pnpm exec vitest run tests/acceptance/feat-admin-cognitive-load-ui/ledger-contract.test.ts tests/ui/admin-cognitive-load-ui.test.tsx tests/integration/admin-cognitive-load-ui-nonregression.test.ts --coverage.enabled=false` / sticky 見出し、特殊表の sticky 主キー、ホームの内部ツール除去、sidebar token の 4 件が意図どおり失敗 |
| GREEN | UI、台帳/binding、認証/API/write非退行、seed・母集団floor検査を加えた6 files・41 tests PASS |
| REFACTOR | `pnpm exec tsc --noEmit --pretty false` と feature Playwright を再実行。型error 0、feature差分の失敗0 |

## 実行結果

| ゲート | 結果 | 注記 |
| --- | --- | --- |
| `pnpm typecheck` | PASS | exit 0、Next typegen + TypeScript error 0 |
| 機能固有+関連 Vitest | PASS | 6 files・41 tests |
| 全体Vitest + coverage | PASS | 401 files・9,663 tests。Statements 89.55 / Branches 81.42 / Functions 90.57 / Lines 92.21 |
| 変更箇所mutation | PASS | 209 mutants、199 killed、10 survived、no coverage 0、95.22%（下限65%） |
| 層別coverage | PASS | domain / application / presentation / app / infrastructure / 全体の全列が下限以上 |
| 全体Playwright（最終静止状態） | PASS | 492 passed / 2 intentional skip / 0 failed（494 total） |
| AC11全管理route Playwright（強化後） | PASS | 86 / 86。375/768/1280/1600、200%相当、台帳指定primary targetまで実Tab、内部GETはEnter完了 |
| `tests/e2e/blog-ops-crud.spec.ts` 対象走行 | PASS | desktop/mobileの削除preview→理由→明示confirm→実削除を含む16件がPASS |
| `pnpm visual` | PASS | 5 baseline。意図した変更は理由付きで更新後、差分 0 |
| `pnpm check:reference-reuse` | PASS | 72 files、転用疑い 0 |
| system plan validator | PASS | exact-13、violations 0、現行 generation digest `a147e7417c03117ac52563f77f0dc71a210cd0fe496feaefdf51eb0318a4545f` |

`pnpm verify` は型・lint・tier・migration・content・acceptance・全体Vitest/coverage・mutation・層別・traceability・必須テスト種別・port wiring・仕様鮮度・取得証跡・依存脆弱性まで773秒で全件PASSした。全体E2Eで通常状態だけ主要リンクが本文から消える2 routeを検出したため、本文内の次操作を常設して対象2件を再検査し、その後に引数なしPlaywright全494件を再走して失敗0を確定した。

## カバレッジ対象

- 情報監査台帳と表現規則: `tests/acceptance/feat-admin-cognitive-load-ui/ledger-contract.test.ts`
- 共通 UI と表示契約: `tests/ui/admin-cognitive-load-ui.test.tsx`
- 認証・API・書込非退行: `tests/integration/admin-cognitive-load-ui-nonregression.test.ts`
- 実ブラウザ: `tests/e2e/admin-cognitive-load-ui.spec.ts`
- 既存保護: `tests/ui/table-through-component.test.ts`、管理 route rendering / axe / state tests
