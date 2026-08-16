# affiliate-hub

アフィリエイト案件と成果データを一元管理するための個人開発プロジェクト。

**本番:** https://affiliate-hub.daishimanju.workers.dev

> **Note:** 要件は暫定です。目的・スコープは今後更新します。

## 概要

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

## スクリプト

| コマンド | 用途 |
| --- | --- |
| `pnpm dev` | Next.js 開発サーバー |
| `pnpm preview` | workerd 上でビルド成果物を確認 |
| `pnpm deploy` | Cloudflare Workers にデプロイ |
| `pnpm cf-typegen` | バインディングの型 (`cloudflare-env.d.ts`) を生成 |
| `pnpm db:generate` | スキーマ変更からマイグレーション SQL を生成 |
| `pnpm db:migrate:local` / `:remote` | マイグレーション適用 |

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
