# 自動テスト証跡

## feature 固有

```text
pnpm exec vitest run \
  tests/acceptance/feat-admin-cognitive-load-ui/ledger-contract.test.ts \
  tests/ui/admin-cognitive-load-ui.test.tsx \
  tests/integration/admin-cognitive-load-ui-nonregression.test.ts \
  tests/ui/table-through-component.test.ts \
  tests/ui/nav-collapse-toggle-interaction.test.tsx \
  tests/ui/field-keyboard-interaction.test.tsx \
  --coverage.enabled=false

Test Files  6 passed (6)
Tests      41 passed (41)
```

```text
pnpm exec playwright test tests/e2e/admin-cognitive-load-ui.spec.ts --workers=1
22 passed / 2 skipped / 0 failed
2 skippedは mobileの共有D1差し替えとundo。desktopで実書込・差し替え影響・復元をPASS。
```

## 静的・視覚

```text
pnpm typecheck                     PASS (exit 0)
pnpm check:reference-reuse          PASS (72 files, finding 0)
pnpm visual                         PASS (5 baselines)
git diff --check                    PASS
validate-system-plan.py             PASS (13 tasks, violations 0)
```

## リポジトリ全体

```text
Vitest + coverage: 401 files / 9,663 tests PASS
Statements 89.55% / Branches 81.42% / Functions 90.57% / Lines 92.21%
Mutation: 95.22% (199 killed / 10 survived / no coverage 0)
Layer coverage: 全6対象の全列が下限以上
Full Playwright: 492 passed / 2 intentional skipped / 0 failed（最終静止状態、494 total）
AC11 enhanced all-admin run: 86 / 86 PASS
Visual: 5 / 5 PASS（darwin-arm64-chrome151、陽性対照 105,377画素差を検出）
```

`pnpm verify` は773秒で全15ゲートPASS。引数なしPlaywrightは通常状態の主要導線2件を修正後に全494件を再走し、失敗0を確定した。

## dev 反映

```text
pnpm deploy:dev
  build / TypeScript / OpenNext / assets upload: PASS
  first Worker version upload: FAIL（Cloudflare 3 MiB、code 10027、version作成前）

pnpm exec wrangler deploy --env dev --dry-run --outdir <temporary> --minify
  gzip: 2,637.46 KiB、上限内

pnpm exec opennextjs-cloudflare deploy -- --env dev --minify
  PASS
  URL: https://affiliate-hub-dev.daishimanju.workers.dev
  Version: e5d96696-b166-4091-8a1b-daefa4cf934d
  Startup: 40 ms
```

反映後は `/` 200、`/signin` 200、未認証 `/admin` 307→`/signin` 200。root HTMLの内部API列挙は0件。production、Git、PRは変更していない。
