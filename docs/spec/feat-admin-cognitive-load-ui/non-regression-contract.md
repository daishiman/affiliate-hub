# 認証・API・書き込み 非退行契約

- 本変更は presentation の情報階層と共通表示だけを変更する。domain/application/infrastructure/API の入出力を変更しない。
- route ごとの capability、未認証時の redirect、403/404 の意味を維持する。
- form action、CSRF、公開、削除、外部リンク差し替えの write path と副作用回数を維持する。
- MCP/WebMCP/REST の機能は削除しない。管理ホームの可視説明から内部名を外すだけで、専用の `/admin/tools` と既存入口は維持する。
- 既存 auth / API / write テストと feature 専用 integration test が緑であることを変更受け入れの条件にする。

## 固定した代表 baseline

1. 認証: human ownerは `content.publish` 可、同じroleでもAI service accountは不可。
2. API: 未認証の `GET /api/tools` は status 401、本文 `{ "error": "認証が必要です。" }`。
3. 書込: 同意済み `page_view` 1件は同じworkspaceへ1回だけ記録し、accepted=1、consent drop=0、invalid=0。

単なる変更pathの文字列検索ではなく、`tests/integration/admin-cognitive-load-ui-nonregression.test.ts` が同じ実関数・route handlerを呼び、結果を比較する。
