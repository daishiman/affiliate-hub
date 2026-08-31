# 層の責務 — 何をどこに書くか（1ページ）

この 1 枚だけ読めば、次に書くコードをどのフォルダへ置くか決められることを目指す。

## 依存の向き

```
presentation ──┐
               ├──→ application ──→ domain
infrastructure ┘
```

矢印の向きにしか依存できない。**domain は誰にも依存しない。**

この向きが守られているかは人が見張らない。次の 2 つが機械的に落とす。

- `pnpm run lint` — 編集中に気づける（`eslint.config.mjs` の `no-restricted-imports`）
- `pnpm test` — 取りこぼしなく全ファイルを走査（`tests/architecture/dependency-direction.test.ts`）

## 4 つの層

### 1. `src/domain/` — 業務の決まりごと

**置くもの**: エンティティ、値オブジェクト、集約、不変条件、業務計算の純関数。

**置いてはいけないもの**:

- `next` / `react` / `drizzle-orm` / `better-auth` / `cloudflare:*` の import
- `fetch`、DB アクセス、ファイル I/O、`Date.now()`（時刻は `Clock` を注入する）
- `throw`（業務上ありうる失敗は `Result<T, DomainError>` で返す）

**判断のしかた**: 「保存先が D1 から別の DB に変わったら、この処理は変わるか？」
変わらないなら domain。変わるなら infrastructure。

### 2. `src/application/` — 手順

**置くもの**:

- `ports/` — 外側とのつなぎ目の**宣言だけ**（interface / type）
- `usecases/` — 「権限を確認し、取り出し、domain に計算させ、保存し、記録する」手順

**置いてはいけないもの**: 実装。`fetch` や SDK が 1 行でも出てきたら infrastructure へ移す。

**判断のしかた**: 「業務の手順」なら application。「その手順を実現する道具」なら infrastructure。

### 3. `src/infrastructure/` — 道具の実装

**置くもの**: D1 + Drizzle のリポジトリ、ASP アダプタ、LLM アダプタ、SNS コネクタ、
R2 ストレージ、KV キャッシュ、ID 生成、秘密の取り出し。

**置いてはいけないもの**: 業務の判断。「この商品は上位か」「公開してよいか」を書き始めたら domain へ戻す。

### 4. `src/presentation/` — 入口

**置くもの**: Next.js の画面、Route Handler、WebMCP アダプタ、バックエンド MCP アダプタ。

**置いてはいけないもの**: 業務計算。とくに**順位の計算と品質の判定を画面側に書かない**。
仕様が明確に禁じている（ブログ層 §27 禁止依存）。

## 入口は 5 つ、手順は 1 つ

見出しの数と下の表の行数は `tests/architecture/architecture-doc-consistency.test.ts`
が突き合わせている。**入口を足したら、見出しの数も直さないと検査が落ちる。**
文書が実装から静かに遅れるのを止めるためで、数を合わせる作業そのものが目的ではない。

| 入口 | 置き場所 | 呼ぶもの |
| --- | --- | --- |
| 管理画面 | `src/presentation/admin/` | application のユースケース |
| 読者向けブログ | `src/presentation/site/` | 同じユースケース |
| REST API | `src/app/api/` | 同じユースケース |
| WebMCP（ページ内 AI） | `src/presentation/webmcp/` | 同じユースケース |
| バックエンド MCP | `src/presentation/mcp/` | 同じユースケース |

**入口ごとにロジックを書き直さない。** 画面・WebMCP・MCP・REST は同じユースケースの別のアダプタである。

## よくある迷いどころ

| 書きたいもの | 置き場所 | 理由 |
| --- | --- | --- |
| 「価格が 24 時間以上古ければ『確認中』と表示する」 | domain | 何時間で古いとするかは業務の決まり |
| 「価格を D1 から取る」 | infrastructure | 保存先の都合 |
| 「価格を取ってから表示を決める」 | application | 手順 |
| 「『確認中』のバッジを黄色で出す」 | presentation | 見た目 |
| 「報酬率」 | domain/monetization | 業務の概念。ただし Commercial 区分 |
| 「報酬率でランキングを並べ替える」 | **どこにも置かない** | 仕様で禁止されている |
| 「測ってよい項目の一覧」 | domain/analytics | 何を測らないかは業務（と法令）の決まり |
| 「同意が無いときに何を測るか」 | domain/analytics | 同上。画面ごとに判断させない |
| 「この行は比較表の行である」 | presentation/ui（部品の名乗り） | 見た目の側にしか無い情報 |
| 「まとめて 15 秒ごとに送る」 | presentation/telemetry | 送り方の都合。業務とは無関係 |
| 「計測をどこに貯めるか」 | infrastructure | 保存先の都合。`TelemetrySinkPort` の裏 |
| 「変えて試してよいものの一覧」 | domain/analytics | 何を変えないかは業務（と法令）の決まり。画面に書き起こさない |
| 「何件たまるまで差があると言わないか」 | domain/analytics | 判定の緩さは業務の決まり。画面ごとに変えさせない |
| 「軸を並べる順番・見出しの付け方」 | presentation | 見た目。並べ替えても判定は変わらない |
| 「配色の実験を配色に効かせる」 | presentation（既にある配色の仕組みへ流す） | 効かせ方は層ごとに違うので、軸の登録側には持たせない |

## 計測をどこに書くか（横断の例）

計測は 4 層すべてに顔を出すため、混ざりやすい。分け方は 1 つだけ覚えればよい。

```
domain          何を測ってよいか・同意・保存期間        telemetry-events.ts / consent.ts
  ↑
application     記録する手順・数える手順                usecases/analytics/ + ports/telemetry.ts
  ↑
infrastructure  どこに貯めるか                          persistence/…/telemetry-sample-sink.ts
  ↑
presentation    どの要素が何かの名乗り／拾って送る       ui/telemetry-attrs.ts / telemetry/collector.tsx
```

**共通UIの部品は名乗るだけで、送らない。** 部品が送信を持つと、部品ごとに
送り方（まとめ方・同意の見方）が分かれ、どれが正しいか分からなくなる。
`tests/ui/ui-layers.test.ts` が UI の中に `fetch(` を書けないようにしている。

## 改善ループをどこに書くか

測った数字をもとに直す側も、同じ 4 層に分かれる。
**分析・比較・提案は軸の中身を知らない**のが要点で、ここが崩れると
軸を足すたびにループ本体が枝分かれする。

```
domain          変えてよいものの一覧・比べ方・止め方      optimization.ts / improvement.ts /
  ↑                                                     variant-spec.ts / loop-run.ts / loop-kinds.ts
application     一覧を作る手順・判定を並べる手順          usecases/improvement/ + ports/improvement.ts
  ↑
infrastructure  設定と記録をどこに貯めるか                persistence/…/improvement-sample-repository.ts
  ↑
presentation    軸の一覧・判定の見せ方                    app/admin/improvement/
```

`improvement.ts` / `loop-run.ts` / `loop-kinds.ts` は**軸の名前を 1 つも持たない**。
入ってくるのは「設定の差」と「観測値」だけなので、
配色の実験も見出し順の実験も同じ 1 本の道を通る。
実測は `changeability-scenarios.md` ⑭（軸を 1 つ足して 1 ファイル）。

## テストをどこに書くか

テストも層の外にあるものではない。`tests/` の下は **`src/` の層と同じ名前**にする。

```
tests/support/        テストの土台（ファクトリ・テストダブル・担当者・時刻固定・描画補助）
tests/domain/         業務の決まりごと
tests/application/    手順（ポートはテストダブルに差し替える）
tests/infrastructure/ 道具
tests/presentation/   入口（REST / WebMCP / MCP / 画面の配線）
tests/ui/             画面と部品（描画・操作・読み上げ・色）
tests/integration/    層をまたぐ 1 周
tests/architecture/   設計の約束（依存方向・商業データ遮断・1 概念 1 定義）
```

**組み立ては `tests/support/` に集める。** 各テストが自前でエンティティやモックを
組み立てると、型に項目を 1 つ足したときに全テストを書き換えることになる。
これはテストが変更容易性を殺す最も多い原因である。

置き場所と部品の詳細は `testing-architecture.md`、
何をテストしなければならないかは `docs/spec/10-テスト戦略仕様.md`。

## Editorial と Commercial

ランキングに報酬を入れないことは、規約ではなく**型**で守る。

- `Editorial<T>` の印が付いたポートしか、ランキングのユースケースへ渡せない
- `Commercial<T>` を渡すとコンパイルが通らない
- 型を `as any` で外しても、組み立て時に実行時の印で落ちる

実装は `src/domain/shared/data-classification.ts`、
検査は `tests/architecture/commercial-isolation.test.ts`。
