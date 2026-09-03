# Migration report

- 実施日: 2026-08-30 JST
- 対象: local D1 (`--env dev --local`)
- 判定: **PASS**（本番・remote D1は未変更）

## 適用内容

| migration | 目的 | 互換性 |
|---|---|---|
| `0039_daily_masque.sql` | `articles.revision` と内部CAS用 `save_token` を追加 | default 1 / nullable。既存記事ID・URL・本文を変更しない |
| `0040_outgoing_valkyrie.sql` | affiliate snapshot 7列、placement逆引き列とworkspace先頭索引を追加 | 追加列はnullableまたはdefault付き。link IDなしの旧placementも保持 |

`pnpm db:migrate:local` を実行し、続けて `pnpm seed:local` を2回実行した。2回目も成功し、固定seed IDは増殖しなかった。実D1 integration test `tests/integration/local-seed-idempotency.test.ts` では、seed対象外の手入力linkが残ることも確認した。

## 件数照合

ローカルD1で、seed linkは usable / expired / disabled が各1件、providerは2件、placementは active 2件（うちlegacy-null 1件）/ removed 1件だった。再実行前後の対象ID件数差は0。既存article/affiliate IDを変更するbackfillは行っていない。

共有中の `.wrangler` 状態とは別に、OSの一時ディレクトリを `--persist-to` へ指定した空のD1でも全41 migrationを適用し、252文のseedを2回連続で適用した。2回目も成功し、記事11件、affiliate link 3件、placement 3件、site 2件、固定・policy page 24件へ収束した。機械可読結果は `test-results/reference-blog-admin-ux/p08/isolated-d1-rehearsal.json` に保存した。

## 正本と互換入口

- 記事保存: 既存 `manageBlogArticles().update` の1経路。`workspace + article + expectedRevision` のCASを使う。
- URL preview: `previewAffiliateUrl` の非更新経路。登録actionとは分離する。
- affiliate一覧: 既存 `manageAffiliateLinks().list` をsnapshot・filter・placement付きに拡張した。
- 既存routeを削除していないため、redirect/互換adapterの追加は不要。

## rollback rehearsal

両migrationは削除・上書きbackfillを含まないため、旧codeへ戻して追加列を読まない論理rollbackを採用する。ローカルD1を適用前スナップショットから作り直せること、migrationとseedを空のlocal D1へ再適用できることを確認した。remote rollbackは、適用前backupを別DBへrestoreしてbindingを切り替える。remoteへの適用・切替は今回の権限範囲外であり実行していない。

## 再現コマンド

```bash
pnpm db:migrate:local
pnpm seed:local
pnpm seed:local
pnpm vitest run tests/integration/local-seed-idempotency.test.ts
```

隔離した空DBからの再現では、同等のコマンドへ `--persist-to <temporary-directory>` を付ける。remote DBは使用しない。
