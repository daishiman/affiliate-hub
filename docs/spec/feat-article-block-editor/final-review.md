# 最終レビューと残課題 (P10)

- feature: `feat-article-block-editor`
- phase: P10
- レビュー日: 2026-09-06

> 以下は先行フェーズの記録。30観点による再検証でデータ保持・公開認可・画像回収の追加問題が判明したため、現在の判定は [elegant-review.md](./elegant-review.md) に一本化する。本書の「一致」を最新の全条件PASSとして引用しない。

## 1. 成果物間の整合

| 対 | 確認したこと | 結果 |
| --- | --- | --- |
| requirements-baseline ↔ acceptance | A1–A7 の検証可能化と判定が 1 対 1 で対応 | 一致 |
| block-catalog-decisions ↔ 実装 | 19 種の名称が `prose-node.ts` と一致 | 一致 (実測 19) |
| block-catalog-decisions ↔ prose-format | 記法が `case` 群と一致 | 一致 (19 `case`) |
| data-model ↔ schema.ts | 列・索引・制約が一致 | 一致 |
| data-model ↔ drizzle/ | マイグレーション 2 本が journal に登録 | 一致 (idx 47, 48) |
| api-contract ↔ route 実装 | 状態コードと応答形が一致 | 一致 |
| test-design ↔ test-run | 設計した検証が全件存在し通過 | 一致 |
| image-upload-decisions ↔ design-decisions §5 | 経路の判断が上位判断と矛盾しない | 一致 |

## 2. 意図的に仕様と違えた点 (1 件)

| 項目 | 仕様 | 実装 | 根拠 |
| --- | --- | --- | --- |
| 画像の転送経路 | presigned PUT (ブラウザ→R2 直送) | Worker 経由 | `design-decisions.md` §5 |

受入 A5 の判定には影響しない (A5 が求めるのは URL 手入力欄の不在)。
利用者確認済み。**P13 で `system-spec/` へ書き戻す。**
書き戻すまでは、仕様と実装が食い違ったままである。

## 3. 実装中に見つけて直した設計上の欠陥 (3 件)

いずれも「動くが、時間が経ってから静かに壊れる」種類だった。

| # | 欠陥 | 気づき方 | 直し方 |
| --- | --- | --- | --- |
| 1 | 参照が外れると `last_referenced_at` が null に戻り、30 日の猶予が 24 時間へ縮む | 猶予の起点を書き出したとき | 関数を 2 本に分割 |
| 2 | 回収索引 (`referenced`, `created_at`) では、外れた画像を拾い直せない | 索引の列順と問い合わせの絞りを突き合わせたとき | (`created_at`) 単独へ (`0048`) |
| 3 | 台帳 insert が R2 put より先で、実体の無い参照が生まれうる | 失敗時に何が残るかを列挙したとき | 順を入れ替え |

3 件に共通するのは、**正常系では現れない**ことである。
どれも「失敗したとき」「時間が経ったとき」にだけ差が出る。

## 4. follow-up 候補 (本 feature には足さない)

| 候補 | 理由 | 既存 issue |
| --- | --- | --- |
| 本文画像の CLS 対策 (寸法を持たせる) | 画像断片に幅・高さを持たせる話で、本 feature の受入に含まれない | `ah-a8bc` |
| `system-spec/**` の digest 検査 9 件の回復 | 直前の仕様編纂セッション由来。本 feature の write scope 外 | `ah-670` / `ah-8h2.2` |
| 公開バケット + 固定 URL への移行 | 帯域が問題になったときの選択肢。いま必要ない | (未起票) |
| `prose-node.ts` の文書が存在しないテストを指す | `tests/domain/blogops/prose-catalog.test.ts` は無く、構造検証は `prose-format.test.ts` にある | 本 phase で修正 |

**4 行目は本 phase で直す** (文書の中の壊れた参照であり、放置すると
次に読む人が存在しないファイルを探す)。

## 5. 未了として明示するもの

| 項目 | 状態 |
| --- | --- |
| commit / push / PR | **行っていない** (利用者の指示による) |
| dev 環境へのリリース | 未実施 (P13 は文書と書き戻しのみ) |
| リモート D1 への `0047`/`0048` 適用 | 未実施。`ah-6lf.15` 系の運用と合わせる |
