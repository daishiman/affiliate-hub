# 運用・復旧・監査

## 役割と判断点

| 運用 | owner | trigger | command / procedure | evidence | escalation |
|---|---|---|---|---|---|
| 保存競合の復元 | 編集担当 | `conflict` 表示 | 記事を2タブで開く → 後着保存で競合 → 下記3段階で復元 | article ID、expected/current revision、復元結果 | 同じ競合が3回続く、または入力欠落がある場合は編集を止めbackend ownerへ |
| migration/backfill | database owner | schema変更・development展開前 | `pnpm db:migrate:local`、`pnpm seed:local`、`pnpm db:drift` | dry-run件数、apply件数、再実行差分0、rollback件数 | 件数差、ID/URL/本文/placement欠落が1件でもあればrollback |
| preview障害 | 収益リンク担当 | failed/rejected急増 | `affiliate-preview-runbook.md` のfocused Vitestとmanual fallback | provider別statusと理由の集計 | SSRF/権利/tenant疑いは即時停止 |
| placement差替え | 収益リンク担当 | URL変更・期限切れ | `/admin/affiliate/links` の逆引きから差替え、feature E2Eを再実行 | old/new link ID、placement ID、監査event | 逆引き件数不一致なら公開を進めない |
| 監査確認 | workspace owner | 日次異常、release前 | audit/tenant/security testと対象監査行の照合 | actor、action、entity ID、at、結果。本文/URL全文なし | 不明actor・越境・欠落eventはsecurity ownerへ |
| rollback | release owner | smoke失敗、error budget超過、重大a11y/security finding | 対象環境の直前backupへbindingを戻し、development smokeを再実行 | deploy version、rollback command/result、post-rollback smoke | 復旧しない場合はdeploymentを停止し直前のknown-goodへ |

## 保存競合の復元

1. `conflict` では手元の入力とサーバーの最新版をどちらも保持する。自動上書きしない。
2. 差分を開き、サーバー版を土台に手元の変更を反映するか、手元版を新revisionとして保存するかを明示選択する。
3. CASのexpected revisionを最新へ更新して再保存し、「保存済み」と時刻を確認する。ブラウザー内draftは成功後だけ消す。

## migration / rollback rehearsal

1. 空のlocal D1へ全migrationを適用し、seedを投入する。
2. 同じmigrationとseedを再実行し、ID・URL・記事本文・affiliate placementの件数差が0であることを確認する。
3. DBを一時コピーして対象migration前後の件数を記録する。rollback SQLまたは直前DB snapshotへの復帰後、一覧・保存・preview・placementのsmokeを行う。

```bash
pnpm db:migrate:local
pnpm seed:local
pnpm db:migrate:local
pnpm seed:local
pnpm db:drift
```

## development smoke

1. ログインして記事新規作成→編集→保存→競合復旧を確認する。
2. 許可provider URLと拒否URLでpreviewし、登録前に9項目、登録後にledger/placement逆引きを確認する。
3. 公開記事をdesktop/mobile/200% zoom/keyboardで確認し、図解fallback・header/body/sidebar/footerの欠落がないことを確認する。

## rollback trigger

- save/preview/placementの5xxまたはデータ欠落が1件でもある。
- private/loopback/link-local/metadataへの接続、tenant越境、無許可画像表示が1件でもある。
- axe重大違反、キーボード不能、200% zoomで主操作欠落が1件でもある。
- A1–A12証跡のdigestがrelease対象と一致しない。

本番releaseは別承認であり、このfeatureのdevelopment検証だけでは実行しない。
