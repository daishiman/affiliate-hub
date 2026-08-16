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

## 入口は 4 つ、手順は 1 つ

| 入口 | 置き場所 | 呼ぶもの |
| --- | --- | --- |
| 管理画面 | `src/presentation/admin/` | application のユースケース |
| 読者向けブログ | `src/presentation/reader/` | 同じユースケース |
| REST API | `src/app/api/` | 同じユースケース |
| WebMCP（ページ内 AI） | `src/presentation/webmcp/` | 同じユースケース |
| バックエンド MCP | `src/presentation/mcp/` | 同じユースケース |

**ロジックを 3 回書かない。** WebMCP・MCP・REST は同じユースケースの別のアダプタである。

## よくある迷いどころ

| 書きたいもの | 置き場所 | 理由 |
| --- | --- | --- |
| 「価格が 24 時間以上古ければ『確認中』と表示する」 | domain | 何時間で古いとするかは業務の決まり |
| 「価格を D1 から取る」 | infrastructure | 保存先の都合 |
| 「価格を取ってから表示を決める」 | application | 手順 |
| 「『確認中』のバッジを黄色で出す」 | presentation | 見た目 |
| 「報酬率」 | domain/monetization | 業務の概念。ただし Commercial 区分 |
| 「報酬率でランキングを並べ替える」 | **どこにも置かない** | 仕様で禁止されている |

## Editorial と Commercial

ランキングに報酬を入れないことは、規約ではなく**型**で守る。

- `Editorial<T>` の印が付いたポートしか、ランキングのユースケースへ渡せない
- `Commercial<T>` を渡すとコンパイルが通らない
- 型を `as any` で外しても、組み立て時に実行時の印で落ちる

実装は `src/domain/shared/data-classification.ts`、
検査は `tests/architecture/commercial-isolation.test.ts`。
