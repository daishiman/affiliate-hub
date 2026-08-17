# ports — 外側とのつなぎ目の宣言

ここにあるのは**インターフェースだけ**です。実装は `src/infrastructure/` に置きます。

## なぜ分けるか

ユースケース (`src/application/usecases/`) は「何をするか」を書く場所です。
「どこから取るか」(D1 なのか API なのか) を知ってしまうと、
保存先を変えるたびに業務の手順まで書き直すことになります。

ポートを間に挟むと、次のような差し替えが**業務ロジックに触れずに**できます。

| やりたいこと | 触るファイル |
|---|---|
| ASP を 1 つ増やす | `infrastructure/asp/` に adapter を 1 つ足す |
| LLM を別社に替える | `infrastructure/llm/` の実装を差し替える |
| DB を D1 から替える | `infrastructure/persistence/` を差し替える |

## 書いてよいもの / 書いてはいけないもの

書いてよい:
- `interface` / `type` によるメソッド定義
- `src/domain` の型の参照
- ポートが返す失敗の型 (`DomainError`)

書いてはいけない:
- `fetch` / SDK / Drizzle / Next.js の import
- 実装本体 (1 行でも書いたら infrastructure へ移す)
- 特定サービス名を含む型名 (`AmazonProductPort` ではなく `ProductCatalogPort`)

## Editorial / Commercial の印

ランキングに関わるポートには `Editorial<T>` の印を付けます。
報酬に関わるポートには `Commercial<T>` を付けます。
ランキングのユースケースは `Editorial<T>` しか受け取らないため、
報酬のポートを渡すとコンパイルが通りません。

詳細は `src/domain/shared/data-classification.ts` を参照してください。
