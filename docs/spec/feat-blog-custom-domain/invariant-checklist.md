# 不変条件 — 住所層

| id | 不変条件 | 施行する場所 | 検査 |
|---|---|---|---|
| INV-1 | 既定住所 `/s/<URL名>` は住所表の行に依存せず常に存在する | `defaultHostPath` は引数だけから作る | `d1-custom-domain.test.ts` 「1 件も登録していないブログは行を持たない」 |
| INV-2 | 生きている hostname は世界に 1 つ | 部分ユニーク索引 + `register` の CONFLICT 変換 | 同上「同じ住所を生きたまま 2 度登録することはできない」 |
| INV-3 | 取り下げた hostname は新しい行として再登録できる | 部分ユニーク索引が `revoked` を除外 | 同上「新しい行として登録し直せる」 |
| INV-4 | `revoked` からはどの状態へも戻れない | `ALLOWED_TRANSITIONS.revoked = []` を `applySnapshot` が通る | 同上「取り下げた後に外部が active を運んできても復活しない」 |
| INV-5 | 正規の住所はブログごとに高々 1 つ | 部分ユニーク索引 + `resolveCanonicalHost` が複数なら既定へ倒す | 同上「切り替えると前の行の canonical が降りる」 |
| INV-6 | `active` でない行は正規の住所になれない | `setCanonical` が状態を確認 / `resolveCanonicalHost` が状態を見る | 同上「配信中でない住所は正規にできない」 |
| INV-7 | `active` から落ちた行は canonical も同時に降りる | `applySnapshot` | 同上「active から落ちると canonical も同時に降りる」 |
| INV-8 | 公開側の照会は `active` の行だけを返す | `resolveSiteSlugByHost` / `findActiveByHostname` の述語 | 同上「配信中の住所だけがブログへ解決する」 |
| INV-9 | 他 workspace の行に id 指定で触れない | 全クエリが `workspace_id` を述語に持つ | 同上「他の workspace の id を指しても触れない」 + `tenant-scoped-schema.test.ts` |
| INV-10 | ホスト名は小文字へ正規化されてから保存される | `validateHostname` (ユースケースと保存側の両方で通る) | `manage-custom-domains.test.ts` 「大文字も末尾のドットも同じ住所として受け取る」 |
| INV-11 | 監査記録が書けなければ操作は成功として返らない | `record()` の戻りを毎回確認 | 同上「監査に書けないと失敗として返る」 |
| INV-12 | 取り下げは外部の可用性に依存しない | D1 を先に落とす順序 | 同上「外部の取り消しが落ちても、読者への配信は止まっている」 |
