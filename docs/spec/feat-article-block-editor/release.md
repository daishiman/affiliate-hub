# リリース記録と切り戻し手順 (P13)

- feature: `feat-article-block-editor`
- 記録日: 2026-09-06

最新の検証結果・件数は[elegant-review.md](./elegant-review.md)へ集約する。
ローカル実装やテスト成功を、画像転送方式の採用承認・remote適用・本番公開と混同しない。

## 1. 現在の状態

| 項目 | 状態 |
| --- | --- |
| ローカル実装 | 画像lifecycle・保存と回収の排他・孤児回収、商品配置の原子的公開同期を実装 |
| production相当build | 隔離出力先で成功。リモートへ公開した意味ではない |
| 実ブラウザE2E | 最終差分を隔離した実Worker/D1/R2でdesktop・375pxとも成功。編集→別context再取得→公開→匿名記事/画像取得→取り下げを確認 |
| commit / push / PR | 未実施 |
| dev / productionデプロイ | 未実施 |
| remote D1の0047〜0050適用 | 未実施 |
| 画像方式 | 2026-09-06の本人回答「ok」により`opt-worker-proxy-upload`へ統一。旧直接PUT承認は履歴として保持 |
| 正規状態への反映 | 新承認によりdecisionとinfrastructure.web / security.webを正規writerで確定 |
| canonical章への反映 | 現行方式を反映済み。2026-09-08に章構造・引用・出典・指紋を含むformal completenessとC19取込までPASS |

旧QA・承認履歴は保持し、新承認`approval-article-image-upload-path-worker-20260906`で現行decisionを更新した。
採用根拠は今回の本人回答であり、実装観察やテスト成功を承認へ読み替えたものではない。

## 2. 切り戻しと復旧

### コード

未コミットの作業ツリーには他の作業も含まれる。全体破棄はせず、diffで対象を特定して退避・レビューする。
commit/push/deployや外部DBへの適用は別途権限が必要。今回の画像転送方式への承認は、リリースや外部適用への許可ではない。

### DB・R2

0047〜0050は前方向migrationである。0050の状態・参照triggerと墓標を削除して旧コードを動かすことは通常の切り戻し手順にしない。
旧コードはpending予約や不可逆claimを前提としないため、単なるコード復帰では整合しない。
台帳・cursor・墓標とR2のバックアップ／復旧条件を確認し、必要な書込・回収処理を止める手順を運用担当者が判断する。

deleting / deletedをreadyへ手で戻さず、ID・キーを再利用しない。物理回収済み画像は台帳だけでは復元できない。
再利用が必要ならバックアップの実体を確認した上で、新しい画像IDとしてアップロードする。
商品配置は台帳だけ戻さず、記事・revision・公開JSONと一緒に整合を確認する。

### 記事本文

列型は文字列のままでも、新しい境界エスケープを旧parserが同じ意味で読めるとは限らない。
書込済み本文を一括変換・削除せず保持し、戻す対象版で実記事の読取・無操作保存・編集後保存を確認する。
[migration-compatibility.md](./migration-compatibility.md)の過去fixture成功は、全記事・全旧版への切り戻し保証ではない。

## 3. 正規仕様反映の履歴と現在地

### 過去の遮断記録

P13で確定済みのsystem-spec/infrastructure.mdを直接編集しようとした際、
`guard-confirmed-chapter-overwrite`がR4-reopen経由での変更を要求して遮断した。
当時は迂回せず、feature文書へ差分を退避した。これは過去の記録であり、現在も再オープン不能という意味ではない。

### 再オープン時の記録（回答前）

継続指示を根拠に、正規writerでinfrastructure.web / security.webを再オープンし、
実装観察をchapter_notesへ追加した。この時点ではQA原文、既存承認、画像直接PUTのdecisionは書き換えていなかった。
章の候補生成は行ったが、旧スナップショットとQAの重複を含むため、この時点ではcanonical章へ適用しなかった。

R4を使う際は出力先を明示する。次は履歴にある手順の書式であり、現在の確定済みセルを再オープンする指示ではない。

```bash
python3 .claude/plugins/system-spec-harness/skills/run-system-spec-elicit/scripts/apply-spec-transition.py \
  apply --state system-spec/spec-state.json \
  --op '{"action":"reopen","category":"<category>","platform":"<platform>","reason":"<根拠>"}' \
  --out system-spec/spec-state.json
```

### 本人承認後の反映と依存確認

2026-09-06の本人回答「ok」を新承認として記録し、Worker経由のdecisionとinfrastructure.web / security.webを確定した。
canonical章にも現行方式を反映済み。旧直接PUTと回答待ちの記録は履歴として保持する。
反映したことだけで残る仕様検査をPASSにしない。実測値は[elegant-review.md](./elegant-review.md)を参照する。

| 領域 | 再確認する内容 |
| --- | --- |
| infrastructure / security | Worker経由、資格情報をブラウザへ渡さない境界、保存前の認可・容量・形式検査。署名付きPUT URL・R2用CORSは現行対象外 |
| backend / API | 予約・put・finalize、失敗時の扱い、方式に対応する入出力 |
| database / operations | 0050のlifecycle、保存trigger、detachment時刻、墓標、孤児cursor巡回 |
| frontend | URL手入力なし、完了・失敗表示、非ready画像を選び直す案内 |
| 公開・配置 | 同workspace認可、記事revision、配置／本文／公開JSONの一括確定 |

旧文書の「署名URLやCORSは不要になる」「Workerを通るので直接PUT要件を置換する」という提案自体は採用決定ではなかった。
今回の新しい本人承認を根拠として、直接PUT固有の条件を現行対象から外し、旧承認とともに履歴へ位置づけた。

## 4. 引継ぎ境界

方式回答、canonical章への反映、仕様・根拠系検査の整合は完了。実記事の運用データ変更、remote migration、デプロイは未実施の別リリース工程。
履歴と現在の検証範囲は[elegant-review.md](./elegant-review.md)を参照する。
本文画像のCLS対策など既存の追跡事項は、対応するBeads（例: ah-a8bc）を正本として確認する。
