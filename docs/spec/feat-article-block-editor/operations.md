# 運用手順 (P12)

- feature: `feat-article-block-editor`
- 現在のローカル実装を対象とする。方式の承認状況と公開状況は[release.md](./release.md)。

## 1. 日次の画像回収

Workerのscheduledから`runArticleImageReclaim`を呼ぶ。DB・BUCKETがなければ回収を実行しない。
参照判定と状態遷移の正本は[data-model.md](./data-model.md)、実測結果は[elegant-review.md](./elegant-review.md)。

### 台帳の循環

1. 作成から24時間を超えた、deleted以外の画像を最大500件選ぶ。未点検を先に、last_checked_at・created_at・id順で循環する。
2. 同workspaceの本文・公開JSONを照合する。生文字列と復号JSON文字列の画像IDを保守的に照合し、他記事コピー・下書き・復元用本文も保護する。
3. 参照ありは参照状態と確認時刻を更新。参照なしはreferencedをfalseにするが、last_referenced_atを消さない。
4. 所有キーが正規形と一致する候補だけを扱う。猶予と現参照を同一UPDATEで判定し、不可逆のdeletingをclaimする。
5. claim後にR2 deleteを実行する。成功後はdeleted墓標へ進め、台帳の行は削除しない。

### 猶予と保存との排他

| 状態 | 猶予・扱い |
| --- | --- |
| 参照あり | 回収しない |
| 一度も参照されていないpending / ready | 作成から24時間 |
| 参照された後に外れた | last_referenced_atから30日。本文／公開JSONを外す保存処理も時刻を記録する |
| deleting | readyには戻さず、R2削除を再試行 |
| deleted | 墓標を保持。遅延putの実体はR2巡回で再回収 |

保存時triggerが非ready画像への再参照を拒否するため、claim後の再保存や遅延deleteで参照済み画像を壊さない。
台帳のreferencedフラグだけを根拠に削除しない。記事参照の確認に失敗したworkspaceの画像は、その回では削除しない。
成功・失敗とも点検時刻を進めることで、特定の画像やworkspaceが後続候補を塞ぐことを避ける。

### R2孤児・遅延putの循環

- prefixは`article-images/`だけ。1回100件を取得し、`article_image_sweep_state`の永続cursorで次回へ進む。
- cursor更新はversionによるCAS。二重cronの古いページ結果でcursorを巻き戻さない。末尾では先頭へ戻る。
- 台帳のない旧孤児は、正規のキー構造・形式・正の容量・24時間経過を確認してpending予約として採用する。
  既存ID／キーとの競合では上書きしない。参照があるものは回収claimできない。
- pending / deleting / deletedに対応する実体を再点検し、削除後に遅れて完了したputも回収する。
- 不正キー、別用途prefix、猶予内の未知オブジェクトは削除しない。
- 個別失敗でcursorを止めず次の周回で再試行する。cursor無効やページ取得失敗では削除せず、次回を先頭へ戻す。

アップロード失敗時に即時補償deleteはしない。finalizeの応答だけ失われたready画像を消さないためである。
回収後の画像を使いたい場合は新しいIDで再アップロードし、墓標やclaimを手で取り消さない。

### ログと切り分け

```text
[article-image] 画像の参照を点検しました
  { scanned, reclaimed, kept, failed, deferred, orphanScanned, orphanReclaimed, orphanFailed }
[article-image] 画像の回収に失敗しました
[article-image] 置き場か保存先がつながっていないので、回収を行いませんでした
```

本文・画像バイト・R2キーはログへ出さない。scannedは点検数であり削除数ではない。

| 症状 | 確認 |
| --- | --- |
| reclaimedが0 | 現参照または猶予内かを確認。0だけで障害とはしない |
| failedが増える | D1/R2障害とdeletingの再試行状況 |
| deferredが増える | 台帳の所有情報とobject_keyの不一致。全物理回収の保留を意味しない |
| orphanFailedが増える | list/cursor・旧孤児の採用・個別削除の失敗 |
| 接続警告が続く | DB・BUCKET binding |

必要な診断は読み取りから始める。

```sql
SELECT lifecycle, COUNT(*) AS count
FROM article_image
GROUP BY lifecycle;

SELECT id, lifecycle, referenced, created_at, last_referenced_at, last_checked_at, deleted_at
FROM article_image
ORDER BY last_checked_at, created_at, id
LIMIT 50;

SELECT id, cursor, version FROM article_image_sweep_state;
```

## 2. 画像が表示／保存できないとき

| 症状 | 確認 |
| --- | --- |
| 送信503 | binding、D1の所属記事確認 |
| 送信502 | pending予約、R2 put、finalize。失敗応答だけを根拠にR2を消さない |
| 送信400 / 413 | フィールド、形式・先頭バイト、画像容量／リクエスト全体上限 |
| 送信403 | workspace全体content.writeと同一Origin |
| 画像404 | readyか、公開参照または下書き閲覧権限、所属記事、実体、状態確認の失敗 |
| 記事保存の画像エラー | pending / deleting / deletedの既知画像が含まれていないか。画像を選び直す |

404の理由は外から区別させない。公開停止・認可変更へ追従するため画像応答はprivate, no-store。

## 3. 商品配置の変更

配置の保存・削除は既存saveArticleで本文・タグ・revision・公開JSON・台帳を一括確定する。
並行本文更新のCONFLICTでは再読込して差分を確認し、古い集約で再試行し続けない。
物理記事のない孤児台帳以外は単独で書き換えない。削除済記事は復元後に配置を変更する。
復元のCONFLICTも最新状態を再読込して判断する。並行復元や復元直後の配置更新が先に確定した場合、古い復元を強制再適用しない。
確定後の監査追記だけが失敗した場合は、画面の案内どおり保存結果を確認する。

## 4. 適用・互換性

0047〜0050は隔離テストDBで検証済み。remote適用・デプロイは未実施で、利用者の通常ローカルDBへ適用したかは別途確認する。
適用は前方向のみ。0050には参照・状態triggerがあるため、migrationなしの新コード投入や無検証の旧コード復帰をしない。
運用の承認後、既存のdev→production手順でバックアップ、migration、smoke、回収ログを確認する。

本文列の一括移行はないが、fixtureの往復成功は全記事の互換保証ではない。重要な実記事を退避し、読取・無操作保存・編集後保存を確認する。
検証コマンド例は次のとおり。件数は本書へ複製しない。

```bash
pnpm exec vitest run tests/domain/blogops/prose-format.test.ts
```

## 5. 読み出し口を増やすとき

公開画像GETは認証不要でも、公開参照による認可を要求する。同種の口を増やす場合は
`tests/architecture/open-doors.test.ts`のROUTE_INTENTと既存品質ゲートを確認する。
上限を引き上げて検査を通すのではなく、公開理由と許可範囲を先にレビューする。
