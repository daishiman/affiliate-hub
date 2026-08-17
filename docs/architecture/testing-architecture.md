# テストと自動検査の構成 — どこに何を置くか

規範（何をテストしなければならないか）は `docs/spec/10-テスト戦略仕様.md`。
この文書は**置き場所と部品**の正本であり、規範を繰り返さない。

**テストを構成図の外に置かない。** テストは後から足す付属物ではなく、
層構造と同じ図の中に住む。置き場所が決まっていないと、
同じ検査が 3 か所に書かれ、どれが正かを誰も言えなくなる。

---

## 1. 全体の形

```
リポジトリ直下
├── quality-gates.config.mjs   閾値と検査の一覧（唯一の正本）
├── vitest.config.mts          閾値を読むだけ。数値を持たない
├── scripts/
│   ├── verify.mjs             CI と同じ検査を手元で回す（pnpm verify）
│   └── coverage-report.mjs    層別に集計して docs/product/coverage.md を書く
├── .github/workflows/
│   ├── ci.yml                 PR のたび：pnpm verify + ビルド
│   ├── deploy.yml             dev / main への push：公開 + スモーク 2 回
│   └── migrate.yml            手動起動のみ：DB の構造変更
└── tests/
    ├── support/               テストの土台（本体コードではない）
    ├── domain/                業務の決まりごと
    ├── application/           手順
    ├── infrastructure/        道具
    ├── presentation/          入口（REST / WebMCP / MCP / 画面の配線）
    ├── ui/                    画面と部品（描画・操作・読み上げ・色）
    ├── integration/           層をまたぐ 1 周
    ├── architecture/          設計の約束（依存方向・商業データ遮断ほか）
    ├── acceptance/            要求仕様 §30 の受け入れ条件
    └── evals/                 生成物の評価セット
```

`tests/` の下は **`src/` の層と同じ名前**にする。
「この関数のテストはどこか」を考えなくてよくするため。
`integration` と `architecture` だけが層をまたぐので別名になっている。

---

## 2. `tests/support/` — 土台（ここが変更容易性の要）

テストが変更容易性を殺す原因は、ほぼすべて「各テストが自前で組み立てている」ことにある。
組み立ての責務をここへ集める。

| ファイル | 持つもの | これが無いと起きること |
| --- | --- | --- |
| `factories.ts` | エンティティの組み立て（既定値つきビルダー） | 項目を 1 つ足すと全テストを書き換える |
| `doubles.ts` | **ポート単位**のテストダブル | ポートに関数を 1 つ足すと全テストが型エラーになる |
| `actors.ts` | 担当者（権限別・テナント別） | 権限テストのたびに担当者を手で作る |
| `clock.ts` | 時刻・乱数・ID の固定 | たまに落ちるテストになり、やがて無視される |
| `render.tsx` | 画面と部品を描く補助 | 画面ごとに描画の作法が分かれる |
| `a11y.ts` | axe を当てる補助 | 画面ごとに検査の強さが変わる |

### 2-1. ファクトリの約束

```ts
// 呼ぶ側は「今回関係のある項目だけ」を書く。
const product = aProduct({ name: "Alpha Studio 15" });
```

- 既定値はそれ自体で妥当（そのまま保存できる状態）にする
- 上書きは浅い結合でよい。深い入れ子が必要になったら、それは型の設計が重い合図
- **ファクトリの中に業務判断を書かない**。判断は domain にあり、テストはそれを呼ぶ

### 2-2. テストダブルの約束

ポート 1 つにつき既定の偽物を 1 つ。各テストは差分だけ渡す。

```ts
const deps = testDeps({ products: { list: async () => [aProduct()] } });
```

**呼び出し回数を検証しない。** 見るのは戻り値と、利用者から見える結果だけ。
回数を見た瞬間、実装の内部構造がテストに固定される。

### 2-3. 決定的にする

時刻は `Clock` を注入する（domain に `Date.now()` を書かないのはこのため）。
ID と乱数も同じ。固定できない要素が 1 つでも残ると、
「たまに落ちるテスト」が生まれ、それは 1 件でもあると全体が信用されなくなる。

---

## 3. 検査の種類と置き場所の対応

| 種類（仕様 §3） | 置き場所 | 反復の作り方 |
| --- | --- | --- |
| ドメイン単体 | `tests/domain/` | 手で書く（意図が 1 件ずつ違うため） |
| ユースケース単体 | `tests/application/` | 手で書く。ダブルは `support/doubles.ts` |
| API 単体 | `tests/presentation/` | **ツールカタログから反復**。手で 1 件ずつ書かない |
| 画面単体 | `tests/ui/` | **ルート表 / 部品一覧から反復** |
| 結合 | `tests/integration/` | 手で書く（1 周を通す筋書きは数本でよい） |
| 境界値・異常系 | 各層に併置 | 端の値を表で持ち、反復する |
| 契約・境界 | `tests/architecture/` | ファイル走査で全件 |

### 3-1. 「反復して作る」ものは登録表から作る

道具・ルート・配色・改善の軸・計測イベントは、いずれもコード側に**登録表**がある。
テストはその登録表を読んで `it` を生成する。

こうすると、道具を 1 つ足した日から検査対象に入る。
**手で 1 件ずつ書くと、足した人がテストを書き忘れたことに誰も気づけない。**

---

## 4. 契約検査（`tests/architecture/`）

設計の約束を、規約ではなくコードで守る場所。

| ファイル | 守るもの |
| --- | --- |
| `dependency-direction.test.ts` | 層の依存方向 |
| `commercial-isolation.test.ts` | 順位づけに報酬が入らない（型と実行時の二重） |
| `server-action-exports.test.ts` | `"use server"` の形 |
| `quality-gates.test.ts` | 閾値の設定と文書がずれていない |
| `single-definition.test.ts` | 1 概念 1 定義（同じ意味の型が 2 か所に無い） |
| `no-empty-tests.test.ts` | アサーションの無いテストが存在しない |

`tests/infrastructure/stub-ledger.test.ts` と `stub-registry.test.ts` も
性質としては契約検査だが、スタブ台帳の生成と一体なので現在地に残す。
`tests/presentation/composition-wiring.test.ts` も同じく契約検査だが、
見ている対象が入口ファイル 1 つなので presentation 側に置く。

### 4-1. 「つないだつもり」を見張る検査

2026-08-17、改善要望の保存先を D1 につないだあと、Workers 上で確認したら
画面には見本データが出続けていた。組み立て（`createDeps`）側は正しく、
**入口（`src/presentation/composition.ts`）が接続を渡していなかった**。
同じ抜け方が鍵の照合・AI から使う道具・ホームの数字にもあり、4 か所が
まとめて見本のままだった。

このとき既存の 2390 件は全部通っていた。統合検査が `createDeps({ db })` を
直に組み立てており、**入口を一度も通っていなかった**ため。
つまり「保存先の実装が正しいこと」は測れていたが、
「その実装が画面まで届いていること」は誰も測っていなかった。

`composition-wiring.test.ts` はこの隙間だけを見る。
組み立て側から「接続があれば本物に切り替わる依存」の名前を読み取り、
入口のうちその依存を使うものが `createDeps` に接続を渡しているかを、
コードの形として確かめる。**保存先を新しく D1 化したときは、
検査の対象が自動で増える**（対象表を人が書き足さなくてよい）。

---

## 5. カバレッジの測り方

```
vitest --coverage
  ↓ coverage-summary.json
scripts/coverage-report.mjs
  ↓ 層別に集計（src/domain, src/application, src/infrastructure, src/presentation, src/app）
docs/product/coverage.md
```

- 閾値は `quality-gates.config.mjs`。**vitest.config.mts は数値を持たない**
- 層別の閾値も同じファイルで指定し、vitest の `thresholds` の
  ファイル単位指定へそのまま渡す
- 「スタブを除いた実質カバレッジ」は、同じ設定ファイルの `stubPaths` を使って
  `coverage-report.mjs` が併記する（仕様 §2-1）

---

## 6. CI/CD の流れ

```
              手元                                CI（GitHub Actions）
   ┌──────────────────────┐          ┌──────────────────────────────┐
   │  pnpm verify         │  同じ    │  ci.yml                      │
   │   1. 型検査          │ ◀──────▶ │   - pnpm verify              │
   │   2. 静的検査        │  検査    │   - 本番ビルド                │
   │   3. テスト+カバレッジ│          │   - マイグレーション未生成検出 │
   │   4. 契約検査        │          └──────────────────────────────┘
   └──────────────────────┘                       │ 緑ならマージ
                                                  ▼
                                   ┌──────────────────────────────┐
                          （先に） │  migrate.yml  手動 + APPLY   │
                                   └──────────────────────────────┘
                                                  │
                                                  ▼
                                   ┌──────────────────────────────┐
                                   │  deploy.yml                  │
                                   │   ビルド → 公開              │
                                   │   → 30秒待って 1 回目        │
                                   │   → 90秒待って 2 回目        │
                                   └──────────────────────────────┘
```

**`pnpm verify` と CI の検査が同じであること**が、この図の要点である。
CI 側にだけ検査を足すと、手元で直せない状態が生まれる。
同じであることは `tests/architecture/quality-gates.test.ts` が確かめる
（ワークフローが `pnpm verify` 以外の検査を直接呼んでいないこと）。

---

## 7. 検査を 1 つ足すとき

1. `quality-gates.config.mjs` の `checks` に 1 行足す
2. 対応するスクリプトまたはテストを置く
3. `pnpm verify` を回す

`ci.yml` は触らない。**触る必要がある時点で、集約に失敗している。**
実測は `changeability-scenarios.md` ⑯。

---

## 8. 画面テストの実行環境

- 既定は Node。ドメインと手順はブラウザを必要としない
- 画面と部品のテストだけ `jsdom` を使う（`tests/ui/**` と `tests/presentation/**` の描画分）
- サーバ側の部品（`async` な画面）は、呼んで待ってから描く。
  `support/render.tsx` がこの作法を 1 か所に閉じ込める
- Workers ランタイム上の確認は `pnpm run preview`（この環境では `localhost:8788`）で別に行う。
  jsdom は Workers ではないので、ここを混同しない
