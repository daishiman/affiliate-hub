# 記事画像の方式判断と実装観察 (P01)

- feature: `feat-article-block-editor`
- 関連受入: A5（ファイル選択、画像URLの手入力なし）
- 更新: 2026-09-06

## 1. 判断状況 — Worker経由への統一を本人承認済み

2026-09-06、利用者は画像送信を「Workerで認可・容量・形式を検査して保存」へ統一する確認に「ok」と回答した。
`dec-article-image-upload-path`の現行決定は`opt-worker-proxy-upload`（confirmed）、根拠は
`approval-article-image-upload-path-worker-20260906`である。現在のローカル実装のPOST経路と採用方式は一致している。

2026-09-05の`opt-r2-direct-put`（ブラウザからCloudflare R2へ直接PUT）の承認は、
`approval-article-image-upload-path`に履歴として保持する。再オープン中の「回答待ち」も当時の記録であり、現状ではない。
UIの受入、方式の本人承認、実環境への適用はそれぞれ別に判定する。

### 旧文書の位置づけ

旧版は`docs/product/design-decisions.md` §5を理由に「署名付きURLを使わない」と確定事項として記載した。
その記載自体は、2026-09-05の直接PUT承認を上書きする根拠ではなかった。
今回の変更根拠は2026-09-06の新しい本人回答であり、過去の実装観察を承認へ読み替えたものではない。
署名付きPUT URLの発行・ブラウザからの直接PUT・R2用CORSは現行の実装対象に含めず、旧方式の条件として履歴を残す。

承認に付随する条件は、8 MiB上限・許可形式・圧縮または再選択の案内、保存前のストリーム／認可／形式検査、
アップロード失敗率・処理時間・拒否理由の監視である。上限が実利用を妨げる場合に限り、multipartや直接送信を再検討する。

## 2. 現在のローカル実装

```text
ブラウザ → POST /api/article-images → D1 pending予約 → R2 put → D1 ready確定
読者     → GET /api/article-images/:id → ready・公開参照／閲覧権限 → R2
```

- POSTはworkspace全体content.write、所属する未削除記事、同一Origin、stream上限を検査する。
- PNG / JPEG / WebP / GIF、1バイト以上8 MiB以下。申告MIMEと先頭バイトを照合する。画像デコーダによる完全検証とは区別する。
- 成功URLはready確定後だけ返す。確定応答不明でも保存済みの可能性があるため、失敗時に即R2補償deleteをしない。
- URLは`/api/article-images/<id>`。実体のキーは`article-images/<workspaceId>/<articleId>/<imageId>.<ext>`。
  URLから所有者・記事・R2キーを直接露出しない。

HTTPの詳細は[api-contract.md](./api-contract.md)に置く。実装の確認結果と、§1の本人承認を区別して記録する。

## 3. 読み出しの境界

画像がreadyでも、それだけでは匿名取得を許可しない。
同workspaceの有効サイト・未取り下げ公開記事に参照がある場合に公開する。
下書きは同workspaceのworkspace全体content.read権限と未削除の所属記事を必要とする。
UUIDを知っていることは認可ではない。状態を確認できないときも404を返す。

応答はprivate, no-store、記録済みContent-Type、nosniff、sandbox付きCSPを使う。
これらは画像取得経路の保護であり、送信方式の承認だけを理由に緩めない。

## 4. 保存と回収の契約

D1とR2を一つのtransactionとはせず、永続状態と再試行で連携する。

- pendingを先に予約し、put後にreadyへ進める。readyだけが取得・本文保存に利用できる。
- 一度も参照されなかった画像には24時間、参照後に外した画像には最終参照記録から30日の猶予を設ける。
  本文／公開JSONの更新・削除時にも旧参照の時刻を記録し、外した直後の猶予を守る。
- 回収は不可逆のdeleting claim後にR2 delete、成功後にdeleted墓標を残す。状態をreadyへ戻さずID・キーも再利用しない。
- 本文と公開JSONの保存triggerで非ready画像への再参照を拒否する。回収側は復号JSONも含む同workspaceの画像IDを保守的に照合する。
- 台帳は500件ずつ公平に循環し、R2 prefixは100件ずつ永続cursor・version CASで巡回する。旧孤児と削除後の遅延putも対象とする。

列・状態・DB制約は[data-model.md](./data-model.md)、故障時の再試行と診断は[operations.md](./operations.md)に集約する。
これは0050を含むローカル実装の観察であり、remote適用済みという意味ではない。

## 5. 正規仕様への反映状況

正規writerで新しい本人回答・承認を記録し、decisionとinfrastructure.web / security.webを確定した。
新しいQAは`qa-infrastructure-web-worker-image-upload-confirmed-20260906`と
`qa-security-web-worker-image-upload-confirmed-20260906`である。旧QA・承認・再オープンの記録は履歴として保持する。

canonical章にも現行方式を反映済み。[インフラ章](../../../system-spec/infrastructure.md)と
[セキュリティ章](../../../system-spec/security.md)の「画像…の確定（2026-09-06）」が現在の境界を示す。
旧直接PUTや回答待ちの記述は履歴として読み分ける。正規反映済みであることと、章構造・引用・承認参照等の検査がすべて通ることは同一ではない。
残る検証と実環境への適用条件は[release.md](./release.md)・[elegant-review.md](./elegant-review.md)を参照する。
