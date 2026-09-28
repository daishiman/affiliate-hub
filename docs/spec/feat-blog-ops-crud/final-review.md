# 最終レビュー（feat-blog-ops-crud / P10）

更新日: 2026-09-08（再検証。前回 2026-08-30 / その前 2026-08-27）
execution status: **judgment_recorded (2026-09-08)**  
promotion: **blocked**

> **最新の判定は下の [「# 現行の再検証（2026-09-08）」](#現行の再検証2026-09-08)。**
> その下の 2026-08-30 節と 2026-08-26 節は**履歴**であり、判定に使わない。
> 止めている理由は 2026-08-30 から**入れ替わっている**（1 件は解消し、2 件が新たに立った）。

- canonical acceptance registry: `features/feat-blog-ops-crud.md#frontmatter.acceptance`
- acceptance source digest: `sha256:7d03855a6d54fdd216e92734e92d4ff5e6baf89dd094c6a4fcd9904c515603e5`
- canonical DAG gate: P07 + P09 → P10
- graph completion authority: `completion_evidence.status`

現行 worktree で P08 の記事正本統合、論理削除・復元、public read 境界、仕様 namespace に変更が入った。そのため、2026-08-26 の P07/P09 証跡と P10 判定は現行ダイジェストの完了証明に使えない。P07 と P09 の再検証、P08 migration/backfill の実測、全スイートの GREEN が揃うまで P10 は fail-closed で停止する。

A1–A14 の二重定義は解消し、P01 の派生実装要件は `REQ-BOPS01`–`REQ-BOPS14` へ分離した。以下の過去記録に現れる別意味の A1–A14 は、現行仕様として参照しない。

---

# 現行の再検証（2026-09-08）

**判定は blocked のまま。ただし止めている理由が 2026-08-30 から入れ替わっている。**

| 2026-08-30 に止めていた理由 | 2026-09-08 の実測 |
|---|---|
| R3 全体スイートの赤（`pnpm test` 1 failed / E2E 41 failed） | **解消**。`npx vitest run` 514 ファイル / 11392 件 全緑、E2E 542 件通過 / 失敗 0 |
| R2 受入 E2E が flaky | **未解消**。この回も 4 回走らせて 1 回落ちた（下の C1） |
| （新）A4 が実装未達 | **新たに判明**。`acceptance-report.md` の 2026-09-08 節 |

## C1. 🔴 受入 E2E は依然として flaky — 8 日経っても直っていない

`tests/e2e/blog-ops-crud.spec.ts` を**同じコード・同じコマンドで 4 回**走らせた実測（2026-09-08）。

| 回 | 結果 | 落ちた検査 |
|---|---|---|
| 1 | **1 failed** / 15 passed (43.7s) | `[desktop] 管理側: 記事の CRUD › 下書きを作れて、一覧に出る` |
| 2 | 🟢 16 passed (38.9s) | — |
| 3 | 🟢 16 passed (38.4s) | — |
| 4 | 🟢 16 passed (37.3s) | — |

**2026-08-30 の R2 と同じ形である。** 落ちたのは**書き込みを伴う検査**（下書きの作成）で、
読み取りだけの検査は 4 回とも一度も落ちていない。R2 が状況証拠として挙げた
「同じ spec の desktop と mobile が同時に同じローカル D1 へ書く」という筋は、
8 日を隔てた別の測定でも同じ側に外れた。**偶然の一致とは考えにくい。**

### この回の全体 E2E 542 件緑を、根拠として使わない

この回は §Q のとおり `npx playwright test` の全体が **542 件通過 / 失敗 0** で終わっている。
**それでもこれを promotion の根拠に使わない。**

上の 4 回が示しているのは「16 件の spec が 4 回に 1 回落ちる」ことである。
542 件を 1 回走らせて緑だったことは、**落ちる回を引かなかった**という以上を意味しない。
1 度の緑を completion の証明に使えない、という 2026-08-30 の判断はそのまま生きている。

**むしろ全体 542 件が緑だったことは、この問題を見えにくくする方向に働く。**
「前は 41 件落ちていたのが全部緑になった」という大きな改善の隣で、
4 回に 1 回の赤は「たまたま」と読まれる。R2 を書き残していなければ、
この回はそのまま promotion していた。

### 直し方は本 feature の範囲を超える（2026-08-30 の判断を維持）

R2 が並べた 3 案（`workers: 1` / mobile を desktop の後続に / リトライ）のうち、
**リトライは採らない**（問題を隠す）。残る 2 案はどちらも E2E 全体の実行時間に効くので、
`feat-blog-ops-crud` の P10 が単独で決めてよい範囲ではない。

`playwright.config.ts` は 2026-09-08 時点でも `workers: 2` / `fullyParallel: false` のままで、
**8 日間、誰もこの判断をしていない。** ここに名指しして残す。

## C2. 🔴 受入 A4 が実装未達 — 検査を足しても緑にならない

2026-08-26 の `acceptance-report.md` は「実装が条文に達していないもの: **無し**」と書いていた。
**この行は誤りである。** 2026-09-08 に条文を 1 件ずつ当て直した結果:

- A4 が要求する符号 `AT-01`〜`AT-05` / `BP-01`〜`BP-06` は、
  **`src/` にも `tests/` にも 1 件も存在しない。**
- 符号の規則そのものは `docs/spec/06-サイトブループリント-記事構成テンプレート.md` にあるが、
  その実装は `feat-site-blueprint` へ `scope_out` されている。
- その `feat-site-blueprint` は `readiness: complete` を宣言しているにもかかわらず、
  `src/domain/blueprint*` が存在しない。**宣言と実態が食い違っている。**

**これは「見張りが足りない」ではなく「見張る対象が無い」である。**
テストを足すと赤が 1 件増えるだけで、緑にはならない。

### fail-closed 条件に正面から当たる

task spec `sys-blog-ops-crud-p10.md` の goal-seek は
「**A1-A14 のいずれかが FAIL の場合は fail-closed で promotion しない**」と明記している。
A4 は FAIL である。**したがって promotion は開かない。**

2026-08-26 の判定（下の Historical snapshot §1）は、失敗した条文は 1 件も無く
promotion してよい、と書いていた。**この判定は前提が誤っていたので取り消す。**

**取り消し文にその主張の字面を再掲していない。** 現行判定部に
「失敗 0 件」と読める文字列が残っていると、機械が読む側は
取り消しなのか主張なのかを区別できない
(`tests/architecture/blog-ops-spec-governance.test.ts` がここを見ている)。
引用ではなく言い換えで打ち消すのは、そのためである。

## C3. 条文ごとの現状（2026-09-08 実測）

| 段 | 条文 | 数 |
|---|---|---|
| 機械が見ている | A2, A3, A5, A6, A7, A8, A10, A11, A14 | 9 |
| 部分 | A1, A9, A13 | 3 |
| **実装が条文に達していない** | **A4** | **1** |
| **条文と機構が食い違っている** | **A12** | **1** |

A3 はこの回の P07 で新しい検査
（`tests/acceptance/feat-blog-ops-crud/subsite-shared-header.test.ts`、3 件）を足して塞いだ。
A2 / A7 / A10 / A14 は**既に塞がっていた**（報告が古かっただけ）。
根拠は [`acceptance-report.md` の「2026-09-08 の再確認」](./acceptance-report.md)。

## C4. P08 の「開発環境 migration 適用」は引き続き未実施

2026-08-30 の R4 から変化なし。push / deploy を伴い、
**利用者から「まだコミット・プッシュ・PR 作成をしない」との明示指示がある。**
できなかったのではなく、行わないと決まっている。

## Q. この回に走らせた全ゲート（P09 実測の再掲）

| ゲート | 結果 |
|---|---|
| 型検査 `npx tsc --noEmit` | 🟢 0 件 |
| 静的解析 `npx biome check src/ tests/ scripts/` | 🟢 0 件 |
| 回帰 `npx vitest run` | 🟢 514 ファイル / 11392 件 / 失敗 0 |
| a11y（A14 の 6 画面） | 🟢 7/7 / 重大違反 0 |
| E2E `npx playwright test` | 🟡 542 件通過 / 失敗 0 — **ただし C1 のとおり根拠にしない** |
| 転用禁止（構造） | 🟢 137 件 / 疑い 0（名前で見る検査は見送り） |
| 計画妥当性 | 🟢 `"violations": []` |
| 要件対応 | 🟢 507 ファイル / 由来不明 2（上限 2 のまま） |

証跡: [`evidence/2026-09-08/`](./evidence/2026-09-08/) の 8 ファイル。

## R. 判定（2026-09-08）

| 軸 | 判定 | 根拠 |
|---|---|---|
| 全体スイートの回帰 | 🟢 全緑 | Q（2026-08-30 の R3 は解消） |
| 受入 E2E の信頼性 | 🔴 **flaky（4 回に 1 回赤）** | C1 |
| 受入条文 A1〜A14 | 🔴 **A4 が FAIL** | C2 |
| 条文と機構の一致 | 🟡 A12 が食い違い | C3 |
| 開発環境 migration 適用 | ⬜ 未実施（指示により） | C4 |
| **readiness** | **incomplete** | C2 |
| **promotion** | **blocked** | C1 と C2 |

**fail-closed を維持する。**

2026-08-30 との違いは、**止めている理由が「他 feature の赤」から
「この feature 自身の条文が 1 件満たされていない」へ移った**ことである。
外の赤は消えた。**残ったのは内側の穴で、こちらの方が重い。**

## S. P10 の受入条件そのものに照らす

task spec `tasks/feat-blog-ops-crud/sys-blog-ops-crud-p10.md` の `acceptance` は 3 項目。
**判定を出すことと、判定が可であることは別**なので、分けて実測する。

| # | 受入条件（task spec 原文の要旨） | 実測 | 判定 |
|---|---|---|---|
| 1 | `pnpm test`（最終判定前の回帰 0 件を再確認する） | 514 ファイル / 11392 件 / 失敗 0 | 🟢 |
| 2 | `validate-system-plan.py --feature-package feature-package/feat-blog-ops-crud` | `"violations": []` / contract 1.3.0 | 🟢 |
| 3 | Required evidence: `final-review.md` のパス | 本文書 | 🟢 |

**3 件とも緑なので、P10 という task は閉じる。**
2026-08-30 に #1 が赤で閉じられなかったのは解消した。

**ただし P10 が閉じることと promotion が開くことは別である。**
P10 の仕事は「受入と QA を突き合わせて可否を確定させること」であって、
「可と書くこと」ではない。**可否が blocked と確定したなら、それが P10 の成果物である。**

ここを混ぜると、判定する側が判定を出せなくなる（blocked と書いた瞬間に
自分の task が閉じられなくなるので、書きたくなくなる）。分けてあるのはそのためである。

## T. 先に片付けるもの（順序つき）

1. **A4 の実装** — `AT-01..05` / `BP-01..06` の検証ロジックが存在しない（C2）。
   置き場は `feat-site-blueprint` で、そちらは `readiness: complete` を宣言しながら
   `src/domain/blueprint*` が無い。**まずこの宣言と実態の食い違いを直すのが先。**
   本 feature の P11/P12 で埋められる穴ではない。
2. **E2E の並行度を決める**（C1）。決まらない限り、何度緑を見ても根拠にならない。
   `playwright.config.ts` の `workers` と project の直列化に関わり、E2E 全体に効く。
3. **A12 の条文と機構の食い違い**（C3）。条文は TTL を言い、実装は `revalidatePath` である。
   条文を機構に合わせるか、機構を条文に合わせるかは仕様側の判断。
4. コミット以降（C4）は利用者の指示待ち。

---

# 履歴: 2026-08-30 の再検証（判定に使わない）

**判定は blocked のまま。ただし止めている理由が変わった。**
本 feature が持つ検査は**すべて緑**である。止めているのは本 feature の外にある。

## R1. 本 feature 直属の検査 — 🟢 412 件すべて緑

| 対象 | 結果 |
| --- | --- |
| `tests/domain/blog-ops.test.ts` ほか 12 ファイル | 🟢 382 passed / 0 failed |
| `tests/integration/d1-blog-ops-tenancy.test.ts` | 🟢 30 passed / 0 failed |
| `npx tsc --noEmit` | 🟢 0 件 |
| `npx biome check .` | 🟢 0 件 |

内訳は a11y の床・復元・内容分離・仕様統治・保管庫の失敗系・ユースケース・
テナンシー・道具・アクション・ドメインの 13 ファイル。
**P09 が測った軸はいずれも退行していない。**

## R2. 🔴 受入 E2E が flaky で、緑が偶然になっている

`tests/e2e/blog-ops-crud.spec.ts` を同じコード・同じコマンドで 4 回走らせた実測。

| 走らせ方 | 結果 |
| --- | --- |
| desktop + mobile | **3 failed** / 13 passed |
| desktop 単独 | 🟢 8 passed / 0 failed |
| desktop + mobile（再） | **1 failed** / 15 passed |
| desktop + mobile（再々） | 🟢 16 passed / 0 failed |

**これが P10 にとって決定的である。** 解除条件は「全スイートの GREEN」だが、
**走るたびに結果が変わる spec がある限り、緑が出てもそれは偶然であって根拠にならない。**
1 度の緑を completion の証明に使えない。

### 落ちるのは書き込みを伴うテストだけである

3 failed のときの内訳:

```
管理側: 記事の CRUD › 理由と復元可能性の確認が揃うまで消せず、揃えば消える   （削除＝書込）
読者側 › 公開済みの記事は読めて、点を付けられる                          （評価＝書込）
読者側 › 点を選ばずに送ると断られる                                     （評価＝書込）
```

**読み取りだけのテスト（「下書きは一覧にも記事の場所にも出ない」）は 4 回とも一度も落ちていない。**
`playwright.config.ts` は `workers: 2` / `fullyParallel: false` なので、
同じ spec の desktop と mobile が同時に走り、同じローカル D1 へ同時に書く。

**原因はここまでの状況証拠で「同時書き込みの競合」を指しているが、断定していない。**
断定には D1 側のエラー（`SQLITE_BUSY` 等）を捕まえる必要があり、そこまで詰めていない。

### 直し方に選択肢があり、本 feature の範囲を超える

| 案 | 効果 | 代償 |
| --- | --- | --- |
| `workers: 1` | 確実 | E2E 全体が約 2 倍遅くなる |
| mobile を `dependencies: ["desktop"]` で後続に | 同じ spec の同時実行が消える | プロジェクトが直列化して遅くなる |
| リトライを入れる | 緑にはなる | **問題を隠す。採らない** |

`public-site-lifecycle-fixture.ts` は `e2e-public-lifecycle-mobile` のように
**プロファイル別のサイトを作って分離している。**
`blog-ops-crud.spec.ts` は seed の固定サイト（`SEED_HUB_SLUG`）と
固定記事（`SEED_ARTICLE_SLUGS.published`）を両プロファイルで共有しており、
**分離の方針が spec 間で揃っていない。**

「E2E の並行度をどう決めるか」は spec 全体に関わる設計判断なので、
**本 feature の P10 が単独で決めてよい範囲ではない。**別作業として残す。

## R3. 全体スイートの赤は、本 feature の外にある

| 対象 | 結果 | 赤の出どころ |
| --- | --- | --- |
| `pnpm test` | 🟡 10022 passed / **1 failed** | `blog-ui-spec-governance.test.ts` の lineage。`feat-blog-ui-builder` 側 |
| E2E 全体 | 🟡 437 passed / **41 failed** | 記事本文が空・固定ページ 404。いずれも `feat-blog-ui-builder` 側 |

E2E 41 failed の内訳と根拠は [`docs/spec/ah-ijwb/README.md`](../../ah-ijwb/README.md) §2。
lineage の 1 件は
[`feat-blog-ui-builder/release-report.md`](../feat-blog-ui-builder/release-report.md) §4.1。

**この 2 つは本 feature の受入条文に触れていない。**
ただし解除条件が「全スイートの GREEN」である以上、
**他 feature の赤でも P10 は開かない。**条件をそう書いたのは、
「自分のところだけ緑なら出してよい」を作らないためである。

## R4. P08 の「開発環境 migration 適用」は構造的に未実施

`migration-report.md` は完了条件に「開発環境 migration 適用」を挙げている。
これは push / deploy を伴う。

**利用者から「まだコミット・プッシュ・PR 作成をしない」との明示指示があり、
実行していない。できなかったのではなく、行わないと決まっている。**

局所の検証（migration canonical SSOT / `PRAGMA foreign_key_check` /
D1 テナンシー 30 件）は R1 のとおり緑である。

## R5. 判定

| 軸 | 判定 | 根拠 |
| --- | --- | --- |
| 本 feature 直属の検査 | 🟢 412 件緑 | R1 |
| 受入 E2E の信頼性 | 🔴 **flaky** | R2（4 回で 3/0/1/0 failed） |
| 全体スイート | 🟡 他 feature 由来の赤 | R3 |
| 開発環境 migration 適用 | ⬜ 未実施（指示により） | R4 |
| **promotion** | **blocked** | R2 と R3 |

**fail-closed を維持する。**

前回（2026-08-27）との違いは、**止めている理由が「再検証していないから」から
「再検証した結果、根拠が信用できないと分かったから」へ変わった**ことである。
R2 は再検証しなければ見つからなかった。**1 度走らせて緑を見ていたら、
そのまま promotion していた。**

## R6. 先に片付けるもの（順序つき）

1. **E2E の並行度を決める**（R2）。これが決まらない限り、何度緑を見ても根拠にならない
2. 記事本文が空・固定ページ 404（R3。`feat-blog-ui-builder` 側）
3. lineage の意味を決める（R3）
4. コミット以降（R4）は利用者の指示待ち

## R7. P10 の受入条件そのものに照らす（task spec `tasks/feat-blog-ops-crud/sys-blog-ops-crud-p10.md`）

本文書を書いたこと自体では P10 は閉じない。task spec の `acceptance` は 3 項目である。
**判定を出すことと、判定を出せる状態であることは別**なので、1 項目ずつ実測した。

| # | 受入条件（task spec 原文の要旨） | 実測 | 判定 |
|---|---|---|---|
| 1 | `pnpm test`（最終判定前の回帰 0 件を再確認する） | 1 failed（`blog-ui-spec-governance.test.ts` の `source_lineage`） | 🔴 |
| 2 | `validate-system-plan.py --feature-package feature-package/feat-blog-ops-crud`（C12 決定論検証を世代非依存に再実行） | `"violations": []` / `contract_version 1.3.0` / P01〜P13 全 phase 検出 | 🟢 |
| 3 | Required evidence: `docs/spec/feat-blog-ops-crud/final-review.md` のパス | 本文書 | 🟢 |

**#1 が赤なので P10 は close しない。**

赤の中身は本 feature の外にある（R3）。`feat-blog-ui-builder` の `source_lineage`
宣言と `system-spec/ui-ux.md` の実バイト列がずれている、という 1 件だけである。
本 feature 直属の 412 件は緑（R1）。

**それでも「外の赤だから数えない」とはしない。**受入条文は `pnpm test` と書いており、
本 feature 直属とは書いていない。ここで「実質は緑」と読み替えると、
**受入条文を判定する側が受入条文を書き換えている**ことになる。
P10 は突合ゲートであって、条文の解釈を緩める場所ではない。

したがって `ah-85cn.10` は **in_progress のまま残す**。
閉じるのに要るのは 2 つだけで、どちらもこの feature の外の判断である。

1. `source_lineage` の意味を決める（生成元の記録か、最後に追従した版か）→ #1 が緑になる
2. E2E の並行度を決める（R2）→ R5 の promotion 判定が偶然でなくなる

**#2 は P10 の受入条文には無い。**条文は `pnpm test` しか要求しておらず、E2E は
要求していない。だが R2 のとおり受入 E2E は走るたび結果が変わる。
**条文を満たしても promotion してよいことにはならない**ので、両方を並べて残す。

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
