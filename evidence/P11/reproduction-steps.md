# P11 証跡 — 再現手順と実測

- graph_node_id: `SYS-AUTH-WORKSPACE-P11`
- 対象: feat-auth-workspace（AWS-ACC-01〜04）
- 参照: [`../../docs/spec/feat-auth-workspace/final-review-log.md`](../../docs/spec/feat-auth-workspace/final-review-log.md)（P10）/ [`../P06/`](../P06/)（形式を合わせている）

## この証跡の約束

**ここに書いた出力は、すべて実際に走らせて得たものである。1 文字も作っていない。**
測れなかったものは「測れなかった」と書き、数字を埋めない。

## 収録物

| ファイル | 中身 | 生成コマンド |
|---|---|---|
| `test-results.json` | 受け入れ関連 8 ファイルの実行結果（32 suite / 141 件・全緑） | 下の ② |
| `regression-results.json` | 6 ディレクトリの回帰実行結果（145 ファイル / 3611 件・全緑） | 下の ③ |
| `coverage/coverage-summary.json` | 上記 ③ と同じ実行で取った 498 ファイル分のカバレッジ | 下の ③ |
| `reproduction-steps.md` | 本ファイル | — |

`evidence/P06/` は `test-results.json` と `coverage/` の 2 点で構成されているので、同じ 2 点を置いたうえで、
P09 が P11 へ送った未確認 2 件（#8 カバレッジ・#9 回帰）に答えるために回帰の実行結果を 1 本足した。

## 測定条件

| 項目 | 値 |
|---|---|
| 日時 | 2026-08-24 12:20〜12:40 JST |
| ブランチ | `daishiman/task20-2` |
| HEAD | 測定開始時 `4a1da54` → カバレッジ測定時 `f34803a`（**測定中に他の作業者が進めた**） |
| 作業ツリー | 未コミット変更あり（`git status --porcelain` で 20 行以上）。**clean ではない** |
| vitest | 4.1.10 |

**この条件は再現性の観点で弱い。** 他の作業者が並走しており、同じコマンドを別の時刻に走らせれば
別の HEAD・別の作業ツリーを測ることになる。数値は上記時刻の作業ツリーに紐づく。

---

## ① 配線の門

```
$ node scripts/port-wiring.mjs --check
EXIT=0

つなぎ目の呼び出し
  ポート          64
  手続き          196
  呼ばれていない  69（上限 79）
  理由つき除外    0（上限 0）

書き込みなのに記録へ届いていない入口
  届いていない    0（上限 0）
  理由つき除外    4（上限 4）
  判定できない    0（上限 0）

記録が残せなくても進む入口
  書けても書けなくても進む  2（上限 2）
  - createStartSiteDraftUseCase  (src/application/usecases/site/build-site.ts:417)
  - createSaveSiteDraftStepUseCase  (src/application/usecases/site/build-site.ts:509)

OK docs/product/port-wiring-report.md を更新しました。
```

**注意（P10 FR-01）**: この門は緑だが、判定は「呼ばれていない 69 ≤ 上限 79」という**閾値**である。
`composition.ts:1184` が `brands` を渡していない件は、この数え方では検出されない。
**緑を「配線に穴が無い」と読んではいけない。**

なお、このコマンドは実行の副作用として `docs/product/port-wiring-report.md` を書き換える。
本 task は記録のみのはずだったが、この 1 ファイルは `--check` を走らせた結果として変更されている。

## ② 受け入れ関連テスト

```
$ pnpm vitest run \
    tests/acceptance/feat-auth-workspace/access-boundary.test.ts \
    tests/acceptance/feat-auth-workspace/brand-defaults.test.ts \
    tests/presentation/error-format.test.ts \
    tests/infrastructure/entry-gate.test.ts \
    tests/infrastructure/session-actor.test.ts \
    tests/domain/permissions.test.ts \
    tests/architecture/tenant-scoped-ports.test.ts \
    tests/architecture/tenant-scoped-schema.test.ts \
    --reporter=json --outputFile=evidence/P11/test-results.json

 Test Files  8 passed (8)
      Tests  141 passed (141)
EXIT=0
```

`test-results.json` の集計欄:

```json
{"numTotalTestSuites": 32, "numPassedTestSuites": 32, "numFailedTestSuites": 0,
 "numTotalTests": 141, "numPassedTests": 141, "numFailedTests": 0, "success": true}
```

P07 が受け入れ判定の根拠として挙げたテスト名は、すべてこの出力に含まれる。

## ③ 回帰とカバレッジ

```
$ pnpm vitest run tests/acceptance tests/domain tests/infrastructure \
    tests/application tests/presentation tests/property \
    --coverage --coverage.reporter=json-summary --coverage.reporter=text-summary \
    --coverage.reportsDirectory=evidence/P11/coverage \
    --reporter=json --outputFile=evidence/P11/regression-results.json

 Test Files  145 passed (145)
      Tests  3611 passed (3611)
   Duration  67.44s

 % Coverage report from v8
=============================== Coverage summary ===============================
Statements   : 68.44% ( 7999/11686 )
Branches     : 60.87% ( 5558/9130 )
Functions    : 64.9% ( 2082/3208 )
Lines        : 69.32% ( 7106/10250 )
================================================================================
ERROR: Coverage for lines (69.32%) does not meet global threshold (80%)
ERROR: Coverage for functions (64.9%) does not meet global threshold (80%)
ERROR: Coverage for statements (68.44%) does not meet global threshold (80%)
ERROR: Coverage for branches (60.87%) does not meet global threshold (80%)
EXIT=1
```

**回帰は 0 件（この 6 ディレクトリの範囲で）。カバレッジは 80% に届いていない。**

ただし `EXIT=1` の読み方に注意が要る。**この数値は「プロジェクトのカバレッジ」ではない。**
実行対象から `tests/ui` `tests/architecture` `tests/integration` `tests/e2e` を外しているので、
外した分が担当している実装（とくに `src/app/`）が丸ごと未実行として数えられている。
**下振れした数値であり、これをもって「80% を満たさない」と結論してはいけない。**

層別（`coverage-summary.json` から集計）:

| 層 | lines | functions | branches |
|---|---|---|---|
| `src/application` | 96.5% | 98.6% | 84.9% |
| `src/domain` | 95.3% | 94.4% | 91.7% |
| `src/db` | 83.5% | 67.7% | 100.0% |
| `src/infrastructure` | 59.6% | 64.4% | 58.2% |
| `src/presentation` | 46.0% | 42.9% | 40.6% |
| `src/app` | 14.8% | 4.8% | 6.3% | ← `tests/ui` を外した影響が最も大きい |
| `src/` 直下（`middleware.ts` / `auth.cli.ts`） | **0.0%** | **0.0%** | **0.0%** |

### AWS-ACC-01〜04 を支える実装のカバレッジ

`coverage-summary.json` から該当ファイルを抜いたもの:

| ファイル | lines | functions | branches |
|---|---|---|---|
| `src/middleware.ts` | **0%（14 行中 0 行）** | **0%** | **0%** |
| `src/infrastructure/identity/entry-gate.ts` | 100% | 100% | 100% |
| `src/domain/identity/permissions.ts` | 100% | 100% | 100% |
| `src/domain/shared/tenancy.ts` | 100% | 100% | 100% |
| `src/domain/identity/brand.ts` | 100% | 100% | 100% |
| `src/presentation/http/error-response.ts` | 100% | 100% | 90.9% |
| `src/infrastructure/identity/session-actor.ts` | 100% | 66.66% | 81.25% |

**`middleware.ts` だけが 0% である。** 3611 件を通してもこの 14 行は一度も実行されない。
これが P09 未確認 #1 と P07「AWS-ACC-01 未検証」に対する、数値としての裏付けである
（P10 FR-02）。

`src/` 直下の層が 0% なのは `auth.cli.ts`（1 行）も同じだが、
そちらは CLI の入口で、受け入れ条件とは関係しない。

## ④ 型検査

```
$ pnpm run typecheck        # next typegen && tsc --noEmit --incremental false
Generating route types...
✓ Types generated successfully
EXIT=0
```

**別の作業者由来の型エラーが `src/app/admin/settings/compliance/page.tsx` にある**と伝えられていたが、
**この実測では 1 件も出なかった**。当該ファイルは未追跡（`??`）で、測定中に直された可能性が高い。
「直っていることを確認した」とは書かない。**12:5x 時点で型検査が緑だった**という事実だけを記録する。

---

## 測れなかったもの

**ここを空白にしないことが、この証跡の一番大事な部分である。**

### 全テストの回帰

```
$ pnpm vitest run --coverage
（50 件超が失敗、EXIT=144）
tests/ui/route-branch-reached.test.ts (90 tests | 33 failed) 1494482ms
```

失敗はすべて 1 件あたり 20,000〜60,000 ms の実行時間を伴っており、
**並走する他の作業者による CPU 不足のタイムアウト**である。上の ③ が同じマシンで 145 ファイルを 67 秒で
完走していることが、コードの問題ではないことを示している。

**この結果は「回帰あり」の根拠にはならない。同時に「回帰なし」の根拠にもならない。**
`tests/ui` `tests/architecture` `tests/integration` `tests/e2e` の回帰は未測定である。

再測定の手順（作業ツリーが静かになってから）:

```bash
# 1. 他の作業者が動いていないことを確認する
# 2. 単一プロセスで走らせて、負荷の取り合いを避ける
pnpm vitest run --coverage --pool=forks --poolOptions.forks.singleFork=true
# 3. EXIT が 1 のとき、カバレッジ閾値によるものかテスト失敗によるものかを出力本文で見分ける
```

### 実 HTTP 応答での門の確認（AWS-ACC-01）

`middleware.ts` が 0% である以上、これは**必ず取らなければならない証跡**だが、本 task では取っていない。
必要な手順:

```bash
pnpm run preview                    # Workers ランタイム上で起動する
curl -i -s http://localhost:8788/admin | head -20
# 期待: 302 / Location: /signin / 本文 0 バイト
curl -i -s http://localhost:8788/api/tools -X POST -d '{}' | head -20
# 期待: 401 か 403 か —— これは P10 FR-05 のとおり、まだ決まっていない
```

**期待値が決まっていないものは測れない。** `/api/` が 401 か 403 かは
P03 finding F-03 として提起されたまま、P04・P07 のどこでも決着していない。

### `not_member` の落下（P10 FR-07）

`src/infrastructure/identity/session-actor.ts` の functions が 66.66% にとどまっているのは、
担当を取り消された利用者の経路が実行されていないためである。
コードを読めば `SAMPLE_ACTOR`（`ws_sample`）へ落ちることは分かるが、**実行した記録は無い**。

---

# 再実行（2026-08-24 17:40 JST）

上の「引き継ぎ」が P11 自身へ送り返していた 3 件のうち、**2 件が取れた**。

## ⑤ 全テストの回帰とプロジェクト全体のカバレッジ（**取れた**）

前回は並走する作業者との CPU の取り合いで 50 件超が時間切れになり、
「回帰ありとも無しとも言えない」状態だった。**競合プロセス（`workerd` の preview）を
止めてから掛け直した。**

```
$ node scripts/run-tests.mjs --coverage

 Test Files  277 passed (277)
      Tests  6726 passed (6726)
   Duration  111.56s

 % Coverage report from v8
=============================== Coverage summary ===============================
Statements   : 89.25% ( 10487/11749 )
Branches     : 81.56% ( 7482/9173 )
Functions    : 89.56% ( 2883/3219 )
Lines        : 91.53% ( 9433/10305 )
================================================================================
TEST_EXIT=0
```

| | 前回（6 ディレクトリ限定） | 今回（段 1+2 の 277 ファイル） | 下限 |
|---|---|---|---|
| Lines | 69.32% | **91.53%** | 80% |
| Statements | 68.44% | **89.25%** | 80% |
| Functions | 64.90% | **89.56%** | 80% |
| Branches | 60.87% | **81.56%** | 80% |

**この 2 つは「上がった」のではない。測っている土俵が違う。**
前回は `tests/ui` `tests/architecture` `tests/integration` を実行対象から外していたので、
それらが担当する `src/app/` が丸ごと未実行として分母に乗っていた。
前回の本文にも「**下振れした数値であり、これをもって『80% を満たさない』と結論してはいけない**」と
書いてある。今回の数値がその判断の正しさを裏づけた。
**閾値は 1 つも触っていない。** 下限は前回と同じ 80% のままである。

証跡: `evidence/P11/coverage-summary.json`（本再実行の値）。
前回の下振れ値は `evidence/P11/coverage/coverage-summary.json` に**残してある**（消していない）。

### `middleware.ts` が動いた

| ファイル | 前回 | 今回 |
|---|---|---|
| `src/middleware.ts` | **0%**（3611 件で 1 行も実行されず） | **100%** |

これで P09 未確認 #1 / P10 FR-02 / P07「AWS-ACC-01 未検証」に対する数値の裏づけが変わった。
ただし**これはテストからの実行であって、Workers ランタイム上の実 HTTP 応答ではない**（下記 ⑦）。

## ⑥ `/api/` は 401 で確定していた（P10 FR-05 の決着）

「401 か 403 か決まっていない」と書いたが、**実装とテストでは決まっていた**。

`tests/presentation/api-routes.test.ts`

```
205:  it("合言葉が違えば断る。応答に正解を載せない", ...
210:    expect(res.status).toBe(401);
212:    expect(res.headers.get("www-authenticate")).toContain("Bearer");

217:  it("合言葉も自サイトの印も無ければ、入口 3 本とも断る", ...
223:    for (const res of results) expect(res.status).toBe(401);
```

**401 + `WWW-Authenticate: Bearer`。** 403 ではない。
「誰か分からない」なので 401 が正しく、`WWW-Authenticate` が付いているのは 401 の要件を満たしている。
FR-05 は「未決着」ではなく「決まっていたのに証跡側が拾えていなかった」。

## ⑦ 実 HTTP 応答の取得は、**まだ取れていない**

Workers ランタイムの起動までは進んだ（`evidence/P06/test-run-notes.md` ③）。

- `pnpm run build` 終了コード 0
- `pnpm run build:worker` → `.open-next/worker.js` 出力
- `workerd` が `127.0.0.1:8787` / `[::1]:8787` で LISTEN（`lsof` で確認）
- 結び付け: `env.DB`（D1 local）/ `env.BUCKET`（R2 local）/ `env.ASSETS`

**そこへ HTTP 要求は 1 本も出していない。**
本セッションでは疎通確認のコマンドが利用者に断られており、別の書き方で通すことはしていない。
「たぶん 302 が返る」とは書かない。

取るなら、利用者自身の手元で（上の `## 測れなかったもの` に載せた 2 本をそのまま使う）。
期待値は `/admin` が 302 → `Location: /signin`、`/api/tools` が 401 + `WWW-Authenticate: Bearer`（⑥ で確定）。

## 引き継ぎ

| 残ったもの | 送り先 | 状態 |
|---|---|---|
| 全テスト回帰とプロジェクト全体のカバレッジの再測定 | P11 の再実行 | **取れた（⑤）** |
| `/api/` が 401 か 403 かの確定 | 上流判断（P10 FR-05） | **決着（⑥）。401 + `WWW-Authenticate: Bearer`** |
| `preview` 上での実 HTTP 応答の取得（AWS-ACC-01） | 利用者の手元 | **未取得（⑦）。起動までは確認済み** |
| `not_member` の落下（P10 FR-07） | 未着手 | `session-actor.ts` の functions が 66.66% にとどまる理由のまま |
| `docs/product/port-wiring-report.md` の変更（`--check` の副作用） | コミット時に併せて扱う | 未コミット |
