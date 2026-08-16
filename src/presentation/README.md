# presentation 層 — 入口

利用者と AI が触れる面。ここには **業務の判断を書かない**。

## 入口は 4 つ、手順は 1 つ

| 入口 | 置き場所 | 状態 |
| --- | --- | --- |
| REST API | `tools/rest-adapter.ts` + `src/app/api/` | 骨格あり |
| バックエンド MCP | `tools/mcp-adapter.ts` | 骨格あり |
| WebMCP（ページ内 AI） | `tools/webmcp-adapter.ts` | 骨格あり |
| 画面（管理・読者） | `src/app/` | 未着手 |

4 つとも `tools/catalog.ts` の**同じ定義**を読み、**同じユースケース**を呼ぶ。

```
                 ┌─→ rest-adapter   → HTTP のレスポンス
catalog.ts ──────┼─→ mcp-adapter    → JSON-RPC の応答
（1つの定義）     └─→ webmcp-adapter → document.modelContext
                        │
                        └─ どれも application のユースケースを呼ぶだけ
```

ツールを 1 つ増やすときに触るのは `catalog.ts` の配列 1 行だけ。
入口ごとの登録作業は無い。「画面にはあるが AI からは使えない」が起きない。

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
