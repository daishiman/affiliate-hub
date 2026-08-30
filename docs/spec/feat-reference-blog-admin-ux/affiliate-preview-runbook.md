# アフィリエイトURLプレビュー runbook

## 契約

| 項目 | 内容 |
|---|---|
| owner | 収益リンク運用担当 |
| trigger | URL previewの `partial` / `failed` / `rejected`、価格・画像の陳腐化、重複警告、掲載先差替え |
| command | 下記のfocused Vitestと、`/admin/inbox` → `/admin/affiliate/links` の画面確認 |
| evidence | previewの状態/理由/取得時刻、対象link ID、placement ID、監査イベント。取得HTMLやURL全文はlogへ残さない |
| escalation | 内部アドレス取得、許可外hostへのredirect、権利不明画像の表示、tenant越境を観測したら機能を停止しsecurity ownerへ連絡 |

## retryと手入力fallback

1. `partial`: 取得できた値と時刻を確認し、未取得項目だけを手入力する。価格は必ず「現在価格を保証しない」と併記する。
2. `failed`: URLを変えず1回だけ再試行する。再失敗時は本文を取得せず、商品名・販売元・表示名を手入力する。
3. `rejected`: provider allowlist外なので再試行しない。短縮URLを勝手に展開せず、提携管理画面で正式URLを確認する。
4. `duplicate`: 候補IDを開き、既存リンクの再利用または旧リンク停止後の新規登録を選ぶ。

## 価格・画像の確認

- 価格は取得時刻とセットで参考表示し、購入時の価格を保証しない。期限切れは再確認対象にする。
- 画像は `imageDisplayAllowed` と固定image host allowlistを両方満たす場合だけremote URLを表示する。取得・proxy・保存・再配信はしない。
- 条件を満たさない画像は独自の `DiagramFallback` にする。写真URLを手入力で迂回させない。

## 掲載先の差替え

1. `/admin/affiliate/links` で対象リンクの掲載数を選び、サイト・ページ・ブロックを確認する。
2. 新リンクのpreviewを確認・登録し、対象placementを新リンクへ切り替える。CAS競合時は再読込して最新配置からやり直す。
3. 旧リンクを停止し、逆引き一覧が0件、または意図した残件だけになったことを確認する。

## 検証command

```bash
pnpm vitest run tests/domain/affiliate-preview.test.ts tests/domain/link-ingestion.test.ts tests/application/preview-affiliate-url.test.ts tests/infrastructure/guarded-fetch.test.ts tests/infrastructure/affiliate-preview-fetcher.test.ts tests/ui/affiliate-preview-card.test.tsx
```
