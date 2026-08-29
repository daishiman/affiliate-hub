# 最終レビュー（feat-blog-ops-crud / P10）

更新日: 2026-08-27  
execution status: **in_progress**  
promotion: **blocked**

- canonical acceptance registry: `features/feat-blog-ops-crud.md#frontmatter.acceptance`
- acceptance source digest: `sha256:7d03855a6d54fdd216e92734e92d4ff5e6baf89dd094c6a4fcd9904c515603e5`
- canonical DAG gate: P07 + P09 → P10
- graph completion authority: `completion_evidence.status`

現行 worktree で P08 の記事正本統合、論理削除・復元、public read 境界、仕様 namespace に変更が入った。そのため、2026-08-26 の P07/P09 証跡と P10 判定は現行ダイジェストの完了証明に使えない。P07 と P09 の再検証、P08 migration/backfill の実測、全スイートの GREEN が揃うまで P10 は fail-closed で停止する。

A1–A14 の二重定義は解消し、P01 の派生実装要件は `REQ-BOPS01`–`REQ-BOPS14` へ分離した。以下の過去記録に現れる別意味の A1–A14 は、現行仕様として参照しない。

## Historical snapshot (invalidated; audit only)

> 以下は 2026-08-26 時点の判定記録を監査用に保持したものである。現行の completion / promotion 判定に使用しない。

判定日: 2026-08-26
対象: P01 〜 P09 の成果を通して見た、feature 全体としての目的達成。

phase ごとの判定は、その phase の中でだけ辻褄が合っていれば通ってしまう。
ここでは **feature の goal に対して**、成果を並べて判定する。

入力:
[`features/feat-blog-ops-crud.md`](../../../features/feat-blog-ops-crud.md)（受入条文 A1〜A14 の正本）/
[`acceptance-report.md`](./acceptance-report.md)（P07 の受入判定）/
[`migration-report.md`](./migration-report.md)（P08 の移行実測）/
[`qa-report.md`](./qa-report.md)（P09 の品質実測）/
[`evidence/`](./evidence/)（実行ログ）

---

## 1. 判定

| 軸 | 判定 |
|---|---|
| 実装受入（A1〜A14 に FAIL があるか） | **FAIL 0 件** |
| readiness | **complete** |
| promotion（P11 へ進めてよいか） | **可** |
| release（公開） | **未実施 — §6 のとおり blocked** |

**fail-closed の条件は「A1〜A14 のいずれかが FAIL」である。** 該当なし。
ただし §3 のとおり **10 条文が「部分」**であり、これを PASS と同じ強さで読まない。

## 2. 通しの再実行

P09 完了後の木で全部を回し直した。P07 の判定以降に退行していない。

```
pnpm test          → 288 files / 7235 tests passed / 0 failed
npx playwright test → 364 passed (4.3m) / 0 failed
npx tsc --noEmit   → 0
npx biome check    → 0
```

## 3. goal に対する判定

feature の goal を 6 つの述語に割って、それぞれ何で確かめたかを並べる。

| goal の述語 | 判定 | 何で確かめたか |
|---|---|---|
| 管理画面から作成・一覧・更新・削除が一通りできる | 達成 | 7 対象（サイト網 / 帯 / 枠 / 記事 / 固定ページ / タグ / 配信部品）。E2E `blog-ops-crud.spec.ts` が画面から通す |
| 削除が壊さない（論理削除・理由必須・監査） | 達成 | 参照中の子がある節点の削除は断られる（A1）。削除は理由必須で監査に 1 件（A4） |
| 公開面が抽象ブループリントのパラメータどおりに描かれる | 達成 | 部品列・カード再掲・目次の階層は `domain/blogops/article-outline.ts` の 2 表が正本。画面は表どおりに描く（A5・機械） |
| 出したものが本当に出ているか運営者が確かめられる | **条件付き達成** | 点検の口と履歴（`blog_delivery_snapshot`）を入れた。ただし点検の深さは部品で違う（§4） |
| 読者の評価を受けて、管理側で伏せられる | 達成 | 伏せた評価は公開面に出ない（A11・機械） |
| 参考サイトの転用が 0 件である | **条件付き達成** | 構造で見る検査は疑い 0 件。名前で見る検査は回していない（§5） |

## 4. 条件付き達成 その1 — 配信の点検（A9）

**入れたもの:** 設定（`blog_delivery_part`）とは別の表 `blog_delivery_snapshot` に、
点検した結果を**履歴として積む**。`onConflictDoUpdate` は付けていない。
上書きにすると「前は出ていたのに、いつから出なくなったか」が消えるためである。

**状態は 4 値** — `ok` / `missing` / `unchecked` / `off`。
**`unchecked` を `ok` に畳んでいない。**「まだ点検していない」と「点検して問題なし」は
運営者にとって別の意味で、畳むと点検していない部品が緑に見える。

**残る限界:** 点検の深さが部品によって違う。
「組み立てられること」までしか見ない部品と、中身の欠落まで見る部品がある。
条文は「欠落 0 件で一覧に表示される」と言っており、**一覧と記録は満たしている**が、
**点検そのものの網羅性はこの回の範囲を超える。**「部分」と書いたのはそのためで、
「あとで足す」と書いて緑扱いにはしていない。

## 5. 条件付き達成 その2 — 転用禁止（A13）

qa-report §6 のとおり、このゲートは 2 段ある。

- **構造で見る検査**（実行済み・61 ファイル・疑い 0 件）
- **名前で見る検査**（未実行 — 禁止語リスト `.reference-ban.local` はリポジトリに入れない）

2 段目を入れないのは意図的である。**禁止したい固有名をリポジトリへ書けば、
禁止した対象がリポジトリの中に文字列として残る。** 手元にファイルを置いた人だけが
回せる設計にしてある。

したがって A13 は **「CI の grep ゲートが PASS する」を満たしている**（構造側は exit 0）が、
**「0 件であること」の全証明ではない。** ここを混ぜて書かない。

## 6. release が blocked である理由

P13（`release-report.md`）は `pnpm run deploy:dev` と PR 作成を伴う。
この回は **commit / push / PR 作成が明示的に禁止**されているため、実行していない。

**「デプロイしていないが問題ない」とは書かない。** 未実施は未実施である。
`release-report.md` に blocked として、止まった位置と必要なコマンドを記録する。

## 7. 申し送り — 受入条文の番号が二重にある

**`A1`〜`A14` という記号が、この feature に 2 セット存在する。**

| 出どころ | A14 の中身 |
|---|---|
| `features/feat-blog-ops-crud.md`（**正本**） | 主要 6 画面が axe-core の重大違反 0 件 |
| `docs/spec/feat-blog-ops-crud/requirements-baseline.md`（P01 成果物） | `pnpm verify` の既存ゲートを破らない |

A13（転用 0 件）だけは偶然どちらも同じ意味だが、**A1〜A12 と A14 は別の述語である。**
`acceptance-report.md` と本文書は**正本（feature node）側**で判定している。

読む人がどちらの A5 の話をしているか取り違える。**この回では番号を振り直していない** —
振り直すと P01〜P09 の全文書の相互参照が同時に狂うためで、
別作業として切り出すのが正しい。ここに名指しして残す。

## 8. 品質ゲート一覧（P09 実測の再掲）

| ゲート | 結果 |
|---|---|
| 型検査 | 0 件 |
| 静的解析 | 0 件 |
| 回帰 7235 件 | 0 失敗 |
| a11y（A14 の 6 画面） | 重大 0 件 |
| E2E 364 件 | 0 失敗 |
| 転用禁止（構造） | 疑い 0 件 |
| 計画妥当性 | violations 0 件 |
| 要件対応 | 由来不明 2（上限 2） |

**この回で緩めた検査は無い。**

## 9. 結論

**readiness = complete。P11（証跡集約）へ進めてよい。**

release は §6 のとおり blocked。promotion と release を分けて判定しているのは、
**「動くこと」と「出したこと」を同じ緑にしないため**である。
