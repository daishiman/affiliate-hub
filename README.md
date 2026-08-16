# affiliate-hub

アフィリエイト案件と成果データを一元管理するための個人開発プロジェクト。

| 環境 | URL | ブランチ |
| --- | --- | --- |
| 本番 | https://affiliate-hub.daishimanju.workers.dev | `main` |
| 開発 | https://affiliate-hub-dev.daishimanju.workers.dev | `dev` |

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
| `CLOUDFLARE_API_TOKEN` | 下記スクリプトで自動発行（権限: Workers Scripts / D1 / R2 の編集 + Account Settings 読み取り） |
| `CLOUDFLARE_ACCOUNT_ID` | `npx wrangler whoami` で確認 |

```bash
# 1) 通常のターミナル (TTY あり) — 対話で入力
pnpm setup:cf-token

# 2) TTY が無い環境 (エディタ内シェル等) — ファイル経由
#    1 行目にメールアドレス、2 行目に Global API Key を書く
pnpm setup:cf-token < .cf-credentials && rm .cf-credentials
```

トークンを必要最小の権限で発行し、そのまま `gh secret set` まで行います。値は画面にも出しません。
`.cf-credentials` は `.gitignore` 済みですが、使い終わったら消してください。

> **なぜ Global API Key を聞かれるのか:** wrangler の OAuth トークンでは API トークンを発行できません。
> `wrangler login --scopes-list` に「API トークンの管理」に相当するスコープが存在せず、
> 実際に `GET /user/tokens` を叩くと `403 / code 9109` で拒否されます。
> トークンを作れるのは **Global API Key** か **User API Tokens: Edit を持つ既存トークン**だけです。
> Global API Key はアカウント全権なので、このスクリプト以外では使わず、GitHub には保存しないでください。

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
