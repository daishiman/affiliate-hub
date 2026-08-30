# presentation 層 — 入口

利用者と AI が触れる面。ここには **業務の判断を書かない**。

## 入口が増えても、手順は 1 つ

| 入口 | 置き場所 | 責務 |
| --- | --- | --- |
| REST API | `tools/rest-adapter.ts` + `src/app/api/` | HTTP とユースケースの入出力を変換する |
| バックエンド MCP | `tools/mcp-adapter.ts` | MCP とユースケースの入出力を変換する |
| WebMCP（ページ内 AI） | `tools/webmcp-adapter.ts` | 読み取り専用ツールをブラウザへ公開する |
| 管理画面 | `src/app/admin/` | 運営者の操作をユースケースへ渡す |
| 読者向けブログ | `src/app/s/` | 公開済みの読み取りをユースケースへ渡す |

ツール系の入口は `tools/catalog.ts` の**同じ定義**を読み、画面を含む全入口が
application の**同じユースケース**を呼ぶ。入口の登録表と画面の経路は責務が違うため、
無理に 1 つの一覧へ混ぜない。

```
                 ┌─→ rest-adapter   → HTTP のレスポンス
catalog.ts ──────┼─→ mcp-adapter    → JSON-RPC の応答
（1つの定義）     └─→ webmcp-adapter → document.modelContext
                        │
                        └─ どれも application のユースケースを呼ぶだけ
```

ツールを 1 つ増やすときの公開先は `catalog.ts` が正本になる。
対応する画面操作と同じユースケースを呼ぶため、「AI だけ別の判断」が起きない。

## 守っていること

- **WebMCP に載せるのは読み取り専用のツールだけ。** ページ内の AI に状態を変えさせない。
- **WebMCP のツールには必ず対応する画面操作がある。** AI からしかできない機能を作らない。
- **ブラウザに業務処理を持たせない。** WebMCP の呼び出しはサーバーの MCP 入口へ送る。
- **人の承認が要る操作は AI サービスアカウントから呼べない**（`requiresHumanApproval`）。
- **エラー文言は 1 箇所。** `http/error-response.ts` がドメインのエラーを HTTP に写す。
  MCP 向けの言い換えも同じエラーから作る。

## 書いてはいけないもの

- 順位の計算（`domain/ranking/`）
- 品質の判定（`domain/authoring/quality-check.ts`）
- 公開してよいかの判定（`domain/compliance/publish-gate.ts`）

これらを書くと `tests/architecture/dependency-direction.test.ts` が落ちる。
