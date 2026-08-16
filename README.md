# affiliate-hub

アフィリエイト案件と成果データを一元管理するための個人開発プロジェクト。

| 環境 | URL | ブランチ |
| --- | --- | --- |
| 本番 | https://affiliate-hub.daishimanju.workers.dev | `main` |
| 開発 | https://affiliate-hub-dev.daishimanju.workers.dev | `dev` |

## 仕様

構築の指針は [`docs/spec/`](./docs/spec/) にあります。

| ドキュメント | 内容 |
| --- | --- |
| [00-README.md](./docs/spec/00-README.md) | 正本の優先順位と文書状態の読み方 |
| [01-要求仕様書-v1.0.md](./docs/spec/01-要求仕様書-v1.0.md) | プロダクト全体の目的と要求 |
| [02-補充仕様-ギャップと追加要件.md](./docs/spec/02-補充仕様-ギャップと追加要件.md) | ギャップと未決事項 |
| [03-分析・解析基盤仕様.md](./docs/spec/03-分析・解析基盤仕様.md) | 計測・成果・KPI の詳細正本 |
| [ai-first-webmcp.md](./docs/spec/ai-first-webmcp.md) | 読者向け比較メディアと WebMCP の Phase 0 契約 |
| [data-model-gap.md](./docs/spec/data-model-gap.md) | 運営者ドメインと読者ドメインの差分 |
| [completion-criteria.md](./docs/spec/completion-criteria.md) | Phase 0 完了条件の検証分解 |

実装投影は [`system-spec/`](./system-spec/) にある。関心ごとの正本は [00-README.md](./docs/spec/00-README.md) を優先する。

> **現在の実装は仕様の完成形ではない。** 運営者向けの案件・成果管理（既存3テーブル）と、
> 読者向け比較メディア（Phase 1 の記事・商品スキーマと公開ゲート）が同居している。
> 混ぜて使ってはいけない。差分は [data-model-gap.md](./docs/spec/data-model-gap.md) を参照。

## 概要（既存実装）

- 複数 ASP にまたがる案件情報と成果データを 1 か所に集約する
- 収益の推移を確認できるダッシュボードを提供する
- 同じデータを **MCP 経由で AI エージェントからも操作できる**

## 技術スタック

| 領域 | 採用 |
| --- | --- |
| フレームワーク | Next.js 16 (App Router) |
| デプロイ先 | Cloudflare Workers (`@opennextjs/cloudflare`) |
| データベース | Cloudflare D1 + Drizzle ORM |
| オブジェクトストレージ | Cloudflare R2 |
| AI 連携 | Remote MCP (`/api/mcp`) + WebMCP (`navigator.modelContext`) |

## セットアップ

```bash
git clone git@github.com:daishiman/affiliate-hub.git
cd affiliate-hub
pnpm install

# ローカル D1 にスキーマを適用
pnpm db:migrate:local

# 開発サーバー (Node.js ランタイム / 高速リロード)
pnpm dev

# Workers ランタイム(workerd)での動作確認 — 本番に近い
pnpm preview
```

## 環境とデプロイフロー

```
feature/xxx ──PR──▶ dev ──自動デプロイ──▶ 開発環境で確認
                     │
                     └──PR──▶ main ──自動デプロイ──▶ 本番
```

インフラは環境ごとに完全に分離しています。

| | 開発環境 | 本番 |
| --- | --- | --- |
| Worker | `affiliate-hub-dev` | `affiliate-hub` |
| D1 | `affiliate-hub-db-dev` | `affiliate-hub-db` |
| R2 | `affiliate-hub-assets-dev` | `affiliate-hub-assets` |
| Secret | `MCP_TOKEN` (dev 用) | `MCP_TOKEN` (本番用・別の値) |

ローカル開発 (`pnpm dev` / `pnpm preview`) は **dev 側のリソース**を指します。
事故ったときに壊れるのが dev 側になるようにするためです。

> **Wrangler の落とし穴:** v4 ではトップレベルのバインディングが `env` に継承されません。
> `wrangler.jsonc` の各 env に D1・R2 を明示しています。新しいバインディングを足すときは
> **3 か所すべて**（トップレベル / `env.dev` / `env.production`）に書いてください。
>
> 同じ理由で、`wrangler d1 ...` にも **`--env` が必須**です。付け忘れるとトップレベル
> （＝ dev のリソース）を見に行き、本番の DB 名を渡しても "Couldn't find a D1 DB" になります。
> `db:migrate:*` はバインディング名 `DB` + `--env` で指定しています。

## スクリプト

| コマンド | 用途 |
| --- | --- |
| `pnpm dev` | Next.js 開発サーバー |
| `pnpm preview` | workerd 上でビルド成果物を確認 |
| `pnpm deploy:dev` / `deploy:prod` | 各環境へデプロイ（通常は CI が実行） |
| `pnpm cf-typegen` | バインディングの型 (`cloudflare-env.d.ts`) を生成 |
| `pnpm db:generate` | スキーマ変更からマイグレーション SQL を生成 |
| `pnpm db:migrate:local` | ローカル D1 に適用 |
| `pnpm db:migrate:dev` / `:prod` | 各環境の D1 に適用 |

## CI/CD

| ワークフロー | トリガー | 内容 |
| --- | --- | --- |
| `ci.yml` | `dev` / `main` への PR | lint → build → typecheck → マイグレーション未生成の検出 |
| `deploy-dev.yml` | `dev` へ push | dev D1 にマイグレーション → dev へデプロイ |
| `deploy-prod.yml` | `main` へ push | 本番 D1 にマイグレーション → 本番へデプロイ |

**マイグレーションは必ずデプロイの前**に走ります。逆順だと新しいコードが存在しないカラムを
参照する瞬間が生まれるためです。つまり後方互換なマイグレーション（カラム追加は可、
削除は 2 段階）が前提です。

### ブランチ保護

`main` / `dev` の両方に設定済みです。フローを口約束ではなく仕組みで担保します。

- 直 push 禁止（PR 必須。レビュー承認数は 0 — 個人開発なので自分の PR を承認できないため）
- `verify` ジョブ（`ci.yml`）の成功が必須
- `strict: true` — base ブランチが進んだら再テストしないとマージできない
- force push / ブランチ削除の禁止

### 必要な GitHub Secrets

| Secret | 取得元 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare ダッシュボードで手動発行（下記） |
| `CLOUDFLARE_ACCOUNT_ID` | `npx wrangler whoami` で確認 |

#### `CLOUDFLARE_API_TOKEN` の発行手順

1. [API Tokens](https://dash.cloudflare.com/profile/api-tokens) → **Create Token** → **Create Custom Token**
2. Name は `affiliate-hub-deploy`
3. Permissions に次の 4 つを追加する

   | Type | リソース | レベル | 用途 |
   | --- | --- | --- | --- |
   | Account | Workers Scripts | Edit | Worker 本体のデプロイ |
   | Account | Workers R2 Storage | Edit | R2 バインディング |
   | Account | D1 | Edit | マイグレーション適用 |
   | Account | Account Settings | Read | wrangler のアカウント解決 |

4. Account Resources は `Include` → 自分のアカウント 1 つだけ
   （`All accounts` にすると、漏れたときに他プロジェクトの Worker まで巻き込む）
5. 作成後に表示される値を [Actions secrets](../../settings/secrets/actions) に
   `CLOUDFLARE_API_TOKEN` として登録する

> **なぜ手動なのか:** 以前はこれを自動発行する `pnpm setup:cf-token` がありましたが削除しました。
> Cloudflare の API でトークンを発行できるのは **Global API Key** か
> **User API Tokens: Edit を持つ既存トークン**だけで、wrangler の OAuth トークンでは
> `GET /user/tokens` が `403 / code 9109` になり不可能です
> （`wrangler login --scopes-list` に相当スコープが無い）。
> つまり自動化には常にアカウント全権の Global API Key をローカルへ置く必要があり、
> AI エージェントと同じ環境で開発する以上、その値が読み取れる状態になります。
> 5 分で終わる手作業のために全権の資格情報を晒す取引は割に合いません。
>
> **トークン値は絶対にコマンドライン引数やファイルに置かないでください。**
> CLI で登録する場合は AI エージェントの動いていないターミナルで
> `gh secret set CLOUDFLARE_API_TOKEN` を実行し、プロンプトに貼り付けます。

## MCP 連携

案件・成果データを操作するツールを **1 か所** (`src/lib/mcp/specs.ts`) に定義し、
2 つの経路から同じツールを公開しています。実処理はすべてサーバー側 (`src/lib/mcp/tools.ts`) にあります。

| 経路 | 入口 | 用途 |
| --- | --- | --- |
| Remote MCP | `POST /api/mcp` (Streamable HTTP / stateless) | Claude などの MCP クライアントから接続 |
| WebMCP | `navigator.modelContext` | このページを開いているブラウザ内 AI エージェント |

### 公開ツール

| ツール | 説明 | ブラウザ公開 |
| --- | --- | --- |
| `list_programs` | 案件一覧の取得 | ✅ |
| `get_revenue_summary` | 期間指定の収益集計（確定/見込みを分離） | ✅ |
| `record_conversion` | 成果を 1 件登録 | ❌ (サーバー経由のみ) |

### 認証

`/api/mcp` は 2 つの経路を認証で分けています。**トークン未設定なら全拒否 (fail-closed)** です。

| 経路 | 条件 | 実行できるツール |
| --- | --- | --- |
| 外部 MCP クライアント | `Authorization: Bearer <MCP_TOKEN>` | すべて |
| 自サイトのブラウザ (WebMCP) | `Sec-Fetch-Site: same-origin` | 読み取り専用のみ |

`Sec-Fetch-Site` はブラウザの fetch からは偽装できませんが curl 等からは付けられます。
したがってこれは書き込みの防御ではなく「公開ページと同じ読み取り範囲を許すもの」で、
**書き込みツールは必ず Bearer を要求します**（サーバー側でも二重に判定）。

```bash
# ローカル
cp .dev.vars.example .dev.vars   # MCP_TOKEN を設定

# 本番
openssl rand -hex 32 | npx wrangler secret put MCP_TOKEN
```

### Claude Code から接続する

```bash
claude mcp add --transport http affiliate-hub https://<your-worker>.workers.dev/api/mcp \
  --header "Authorization: Bearer <MCP_TOKEN>"
```

### 疎通確認

```bash
TOKEN=$(grep MCP_TOKEN .dev.vars | cut -d'"' -f2)
curl -s localhost:8787/api/mcp -H "authorization: Bearer $TOKEN" | jq
curl -s localhost:8787/api/mcp -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | jq
```

## ディレクトリ構成

```
src/
├── app/
│   ├── api/mcp/route.ts    # Remote MCP エンドポイント (JSON-RPC)
│   └── page.tsx            # ダッシュボード
├── components/
│   └── webmcp-provider.tsx # WebMCP 登録 (描画なし)
├── db/
│   ├── schema.ts           # Drizzle スキーマ (asps / programs / conversions)
│   └── index.ts            # リクエストスコープの DB / R2 取得
└── lib/
    ├── mcp/
    │   ├── specs.ts        # ツール仕様 (DB非依存・ブラウザからも import 可)
    │   ├── tools.ts        # サーバー実装 (server-only)
    │   ├── auth.ts         # Bearer / same-origin の認証
    │   └── types.ts        # 共通型
    └── webmcp/             # ブラウザ側の登録処理
```

## 設計メモ

- **収益は確定(`approved`)と見込み(`pending`)を合算しない。** ASP は事後に成果を却下するため、
  合算するとダッシュボードも AI も楽観的な数字を報告してしまう。
- **書き込み系ツールはブラウザに公開しない。** WebMCP からの実行も `/api/mcp` を経由させ、
  認可と集計ロジックをサーバー 1 か所に集約する。
- **DB インスタンスはモジュールトップレベルで作らない。** Workers はリクエストごとに
  バインディングを供給するため、`getDb()` で都度取得する。
- **MCP_TOKEN 未設定時は 503 で閉じる。** 設定漏れで書き込み口が開くより、動かないほうがよい。
- **ツールの JSON Schema は `io: "input"` で出す。** 既定の `"output"` だと `.default()` 付きの
  引数が required 扱いになり、AI が省略可能な引数を必須だと誤解する。

## ライセンス

MIT
