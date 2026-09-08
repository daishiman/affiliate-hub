# Bluesky 予約配信の接続・実機確認

Bluesky は公式 AT Protocol の `createSession` と `putRecord` で直接投稿します。
接続登録は `createSession` の実認証で返った DID と handle を正本として保存します。
予約workerは `Publication` に固定した DID・TID・provider record時刻を再利用するため、
応答を受け取る前にworkerが止まっても、再試行で別投稿を増やしたり、
即時投稿の `createdAt` を後刻の再試行時刻へ書き換えたりしません。

予約時には、公開前確認を通した本文の `content_variants.revision` も
`publications.variant_revision` へ固定します。本文・広告表記・書き手・主張・根拠などを
予約後に保存すると本文版が進み、workerはPublicationの全列CASと現在本文版の照合を
同じD1 `UPDATE` 条件で行います。版が違う場合と、0037以前の版を持たない配信は
外部へ送らず、再承認・再予約が必要な状態で止まります。

外部投稿の成功・失敗状態と `publication.delivery_changed` 監査は、0039の
transactional outboxで同時に確定します。監査表が一時的に書けなくてもPublicationを
送信前へ戻さず、別のcron処理が保存済みの同一監査ID・完全payloadだけを再送します。
これにより、監査の復旧を理由にBluesky投稿をもう一度実行しません。

コード内の見本記事はD1実表に版が無いため、外部自動配信の予約には使えません。
読み取り時に暗黙保存はせず、自分の記事として本文を保存してから人が承認します。
同じ制約は既存の手動配信をBlueskyへ変更する入口にも適用し、接続を選ぶ前に
保存済みの現在版・予約版・公開前確認を照合します。

## 本番へ出す前の必須条件

2026-08-27 にdevはmigration 0039までの適用と現worktreeのdeployを完了しました。ただし
Bluesky用SecretとDIDを固定した接続行はまだ無いため、dev / productionとも実送信は未完了です。
残りを含め、環境ごとに次の順序でご本人または公開権限を持つ担当者が実施してください。

1. remote D1へ、少なくとも `0035_workable_titania.sql` から
   `0039_sudden_luckman.sql` までを番号順に適用する
2. Blueskyで配信用アカウントのアプリパスワードを発行する
3. 認証情報をCloudflare Secretへ対話入力で登録する
4. 変更をdevへdeployする
5. ownerまたはworkspace adminが接続参照を登録する
6. devで承認済み記事を未来時刻へ1件だけ予約し、cron後の状態と監査を確認する
7. dev確認後にproductionへ同じ順序で適用する

devでは1と4が完了済みです。2・3・5・6は未実施で、productionは1を含め未着手です。

マイグレーションより先に新workerをdeployすると、新しい列を読めず予約処理が失敗します。

## 認証情報の登録

例として参照名を `channel/conn_bluesky/credentials` にすると、Secret名は
`SECRET_CHANNEL__CONN_BLUESKY__CREDENTIALS` です。値をコマンドの引数やファイルへ
書かず、次のコマンドを実行したあとに表示される入力欄へJSONを貼り付けます。

```sh
pnpm exec wrangler secret put SECRET_CHANNEL__CONN_BLUESKY__CREDENTIALS --env dev
pnpm exec wrangler secret put SECRET_CHANNEL__CONN_BLUESKY__CREDENTIALS --env production
```

入力するJSONの形は `identifier`（ハンドル）と `appPassword` が必須です。
独自PDSを使う場合だけ、HTTPSの `service` を追加できます。値そのものをチャット、
issue、監査ログ、`.dev.vars.example`へ貼らないでください。

その後、ownerまたはworkspace admin本人が、`register_channel_connection` を
人の承認つきで呼びます。ブランド限定担当者・AIサービスアカウントからは登録できません。

```json
{
  "channelKind": "bluesky",
  "accountLabel": "@publisher.example",
  "credentialRef": "channel/conn_bluesky/credentials"
}
```

`accountLabel` は入力値をそのまま保存せず、実認証応答のhandleへ置き換えます。
実認証できない場合は接続行を作りません。成功時は `usable=true` となり、DIDは
`provider_identity` に固定されます。登録後に同じsecret参照の中身を別DIDへ差し替えると、
readiness・投稿・取り下げのすべてが外部変更前に停止します。認証情報を変える場合は、
既存参照を上書きせず、新しい参照名で別接続として登録してください。

Secret名、参照名、アプリパスワード、JWT、providerの応答本文は、応答・監査へ返しません。
接続行の保存後に監査が一時失敗しても、同じDIDと参照名で再試行すれば既存行へ収束し、
`connector.connected` の監査だけを回復します。

## dev実機の合格条件

- 予定時刻より前は `QUEUED` のまま、時刻後は `PUBLISHED` になる
- `attempts` が増え、`external_id` に期待DID・collection・TIDが完全一致するAT URI、
  `provider_identity` にDID、`provider_delivery_key` に13文字TIDが残る
- 同じ配信を再処理しても同じTIDへ `putRecord` され、Bluesky上の投稿が1件だけである
- 日時未指定の即時配信も、応答喪失後の再試行で最初のprovider record時刻を維持する
- 予約後に本文を保存し直すと外部投稿されず、再承認・再予約の案内で止まる
- 版を持たない旧配信と、D1へ保存していない見本記事は外部投稿されない
- 同じDIDの複数配信を複数Workerが拾っても、取得ごとのtokenを持つ期限付きD1 leaseにより
  認証確認を含むprovider通信は1件ずつ進む。期限後の新leaseを旧workerは解放できず、
  同じDIDとTIDの組は保存先の一意境界で外部送信前に拒否される
- 一時失敗は `RETRY_SCHEDULED` になり、5回で停止する
- `publication.delivery_changed` の監査主体が
  `system:distribution-scheduler`、`identified=false` として残る
- `audit_logs` を一時的に利用不能にしてもPublicationは`PUBLISHED`のままoutboxが残り、
  復旧後はBluesky投稿件数を増やさず監査1件だけが配送される
- Bluesky失敗時も、画面写しと技術診断の保持期限処理が同じcronで継続する
- Workerログと監査に認証情報・Authorization・provider応答本文が無い

Cron TriggersはUTCで動き、設定反映に時間がかかる場合があります。dev実機の結果は
remote migration・deploy・Secret登録が済んだあとに確認し、ローカルテストのPASSで
代用しません。
