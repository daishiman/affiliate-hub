# 仕様反映の受領書 — ブログトップページ構成 MVP

- 記録日: 2026-09-08
- graph node: `feat-blog-top-page-composition`
- Beads: `ah-v2xx`, `ah-9tx5`, `ah-2ann`, `ah-t1df`
- 受領状態: **製品仕様・設計への変更なし / writeback 不要 / 総合監査は条件付き**

## 影響判断

ブログトップの製品挙動は、すでに確定している feature A1〜A8 と ui-ux/frontend/database の
契約内にある。新しい外部API、権限境界、データ所有者、画面スコープは追加していないため、
製品仕様・アーキテクチャへの新規決定はない。

実装差分と既存 acceptance を突き合わせた結果、仕様正本へ追加・変更すべき挙動は無かった。
そのため `spec-state.json` や既存の確定章を本変更として書き換えない。

## 記録したもの

| 対象 | 内容 | 理由 |
|---|---|---|
| `docs/spec/feat-blog-top-page-composition/spec-writeback-receipt.md` | 人が読む影響判断 | 製品仕様への新規影響が無い理由を残す |
| `system-spec/review-receipts/feat-blog-top-page-composition-final-review.json` | 機械可読な受領記録 | graph node / Beads / gate 結果を結び付ける |
| `specs/spec-blog-top-page-composition-final-review.md` | 最終レビューの参照境界 | acceptance 正本を複製せず参照先を固定する |
| `architecture/arch-blog-top-page-composition-final-review.md` | runtime 境界の確認 | 外部API・権限・永続化責務を増やしていないことを残す |

## 独立監査

- matrix: PASS（48セル、未収集0、dangling 0、全6 opt-in PASS）
- hearing: FAIL（既存の誘導質問3件）
- doc freshness: 29 target / 29 evidence を確認し、SQLite FTS5 / WebMCP に既存の鮮度差分を検出

誘導質問は `qa-seo-approved-diff-20260906` と画像uploadに関する2件で、本変更が作った質問ではない。
加えて射程外 QA 参照、foundation 参照節、SQLite FTS5 / WebMCP の鮮度差分も本変更由来ではない。
履歴を消したり別作業の正本を混ぜたりせず、それぞれ別の正規確認が必要である。
したがって本受領書は system-spec 総合 PASS の証明には使わない。

## 受領

- 製品仕様への新規影響: **なし**
- 判断理由: 既存 acceptance / owner boundary の範囲内で、外部契約・権限・永続化責務を増やしていない
- 仕様管理への本変更由来の影響: **なし**。既存の監査所見は残課題として分離
- feature 完了: **未受領**。A4/A7/A8 と P13 の証跡が残る
- task package promotion: **未実施**。再評価はPASSだが、C08 readinessが completeness producer検証とsource plugin manifest欠落で停止した

## 追記 — 2026-09-10 分の差分について

9/8 の受領後に 2 件のコミットが加わった。いずれも**製品仕様・設計への影響なし**と判断する。

| コミット | 内容 | 判断 |
|---|---|---|
| `1338e8b2` | next 16.3.1 → 16.3.4 | パッチ版上げ。API 契約は変わらない |
| `8668b4cf` | 記録の同期 | 挙動を足していない。下記の理由による |

`8668b4cf` が触ったのは、features の digest 再導出、生成レポートの作り直し、
`.dev-graph/state/graph.json` の突合結果、Chrome 152 用の見た目の見本 5 枚である。
**確定章は 1 つも書き換えておらず、`spec-state.json` の状態遷移も行っていない。**
新しい外部 API・権限境界・データ所有者・画面スコープを増やしていないため、A1〜A8 は動いていない。

つまりこの差分は「仕様が変わったので記録を直した」のではなく、
**評価した時点と仕様書の時点がずれていたのを、同じ時点へ揃え直した**ものである。
9/8 以降 PR 側の CI が落ち続けていた原因もこのずれ（仕様レポートの鮮度 STALE）であり、
揃え直したことで解消した。

### この追記時点のゲート結果

| 検査 | 結果 |
|---|---|
| `pnpm run verify` 全段 | 16 件すべて OK（依存の脆弱性のみ警告・blocking なし） |
| テストとカバレッジ | 573 files / 12743 tests PASS、全層が下限充足 |
| 全体ミューテーション | 70.39%（下限 65%） |
| 見た目の回帰 | 陽性対照 + 5 枚とも PASS |
| CI push (34419785216) | PASS |
| CI pull_request (34419783219) | **PASS**（9/8 以来はじめて緑） |

閾値・天井・除外表はいずれも動かしていない。

なお A4 / A7 / A8 と P13 の未取得証跡は**この追記でも解消していない**。
feature 完了の受領は引き続き行わず、PR は draft のままとする。

## 追記 — 2026-09-10 後半: 仕様正本の修復と、下流ドキュメントの追従

前段の追記は「評価の時点と仕様書の時点を揃え直した」だけだったが、
そのあと独立監査 C06 が **確定 5 セルの裏付け `qa-seo-approved-diff-20260906` を
5 論点を 1 問へ束ねた誘導質問**と判定した。回答は「つづけて」の一語で、
承認記録の note 自身が「これは提示内容の要約で、利用者の逐語回答ではない」と書いていた。

利用者の判断を受けて、5 論点を 1 件ずつ問い直し、正本を直した（`spec-state.json` の
`qa_log` に `qa-seo-apply-*-20260910` の 5 件）。**この追記は「仕様が変わった」側の記録である。**

| 論点 | 問い直しの結果 | 旧契約 |
|---|---|---|
| 反映の承認 | 機械が反映し事後に通知する | 「承認した対象だけ反映」を取り下げ |
| 対象範囲 | 全ての記事（作成日時を問わない） | 「導入前を除外」を取り下げ |
| 途中失敗 | 同一確定単位で保存し、失敗したら 1 つも変えない | 新規 |
| 同時編集 | 読み出した版と一致しなければ書かずに止める | 新規 |
| 実績の見せ方 | 観測時刻付きの推移。因果とは呼ばない | 新規 |

上位制約 `constraints[4]` にも、差分記録・1 操作での復元・同一確定単位での通知の
3 条件をすべて満たす反映に限る事前承認免除を足した（承認
`approval-foundation-seo-auto-apply-exemption-20260910`）。
**免除は SEO 反映だけに及ぶ。新規記事の外部公開と予約投稿は従来どおり承認を要する。**

### 下流ドキュメントの追従

`system-spec/` を直したあと、そこから派生する文書が 2026-09-06 の旧契約のまま残っていた。
同じ言葉が二か所で違うことを言う状態にしないため、次を揃えた。

- `features/feat-seo-aeo-measurement-loop.md` と `.context.json`、dev-graph の feature node
- `tasks/feat-seo-aeo-measurement-loop/sys-…-p01..p13.md` 13 件と、対応する task node 13 件
  （受入 A6、NFR2 のラベルを「時間範囲限定」→「対象範囲」、`scope_out` の旧文言）
- `docs/requirements/feat-seo-aeo-measurement-loop-implementation-requirements.md` の反映契約節
- `docs/product/traceability.md` の REQ-SEO14
- `src/infrastructure/persistence/d1/seo-article-revision-repository.ts` の利用者向け文言 3 か所
  （振る舞いは変えていない。実装の適合は P05 / P11 の責務）

### 完成度評価が指摘して、実際に直したこと

再評価は **総合 FAIL のまま**で、緑にするための書き換えはしていない。ただし指摘のうち
2 件は「記録が事実と違う」という種類のもので、これは直した。

1. `constraints[4]` の来歴 note が「3 条件が answer に逐語で在る」と主張していたが、
   実際の answer は `自動反映＋事後通知（推奨）` の 1 行だった。3 条件のうち (3) と
   免除の適用範囲はそこに無い。**「来歴が無い」が「実在しない逐語を利用者の声として
   名乗る来歴」に置き換わっていた。** どこまでが利用者の選択で、どこからが起草者の
   設計判断かを分けた記述へ書き直し、封をし直した（書面 36 件の指紋は不変）。
2. `better-auth` の版記録が「npm registry の最新版 1.7.3」だったが、registry の
   dist-tags を直接取得すると latest は **1.6.31** で、1.7.3 はどのチャネルにも無かった
   （1.7 系は beta / rc のみ）。WebSearch の要約を版の根拠に使ったことが誤りの出所である。
   実測値へ訂正し、何がどう違ったかを証跡の note に残した。

### なお残っている赤

- `sqlite-fts5` の更新日を機械で確認できない（本文が長く応答が末尾へ届かず、直接取得は
  external-mutation guard が塞ぐ）。**`MAX_UNVERIFIED_FRESHNESS` は引き上げていない。**
- 2026-09-10 の問い直し 5 問が、片側の選択肢にだけ推奨ラベルを付けて提示された。
  根本解決には推奨ラベル無しでの再質問が要る。
- `package.json` が `better-auth ^1.7.0` を要求しているが、安定版チャネルに 1.7.x が無い。

A4 / A7 / A8 と P13 の未取得証跡はこの追記でも解消していない。feature 完了は受領しない。
