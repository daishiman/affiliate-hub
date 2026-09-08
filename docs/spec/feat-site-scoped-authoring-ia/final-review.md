# 通しレビューと残課題の確定 (P10 / SYS-SITE-SCOPED-AUTHORING-IA-P10)

- feature: `feat-site-scoped-authoring-ia`
- 実施日: 2026-09-08
- 消費した成果物: `acceptance-report.md`, `quality-report.md`
- 総合判定: **条件付き完了（A2・A8 が PARTIAL、A6 が BLOCKED）**

## 1. この feature が何を変えたか（1 段落）

管理画面の読者像（`/admin/personas/*`）と書き方の決めごと（`/admin/writing`）は、
これまで**作業場所ごとに 1 組**しか持てなかった。ブログを 5 本運営していても、
「誰の立場で書くか」「誰に向けて書くか」は 5 本まとめて 1 つだった。
書き手・読者像の保存実体は従来どおりワークスペース単位のまま、画面の住所を
`/admin/sites/[site]/` 配下へ移し、そのブログの文脈で参照できる形にした。
所有範囲の正本は `site-scoped-route-contract.md` §1 で、一覧・作成画面にも常時表示する。
併せて、機能ごとに並んでいた一段目の入口を、**作業の対象物 5 つ**
（ブログ / 記事 / 読者 / 商品 / 配信）に畳んだ。旧 URL は 404 にせず転送で受ける。

## 2. A1–A10 の最終判定

| ID | 判定 | 根拠 |
|---|---|---|
| A1 読者像・書き方が site 配下に在る | **PASS** | 新設 6 画面が build の route 表に載る |
| A2 旧 URL が site 配下へ転送される | **PARTIAL** | personas 4 本 + writing 1 本は殻化済み。`/admin/content/*` は未着手（§3） |
| A3 特定できない旧 URL がブログ選択へ | **PASS** | 4 通りの外部不調すべてで `/admin/sites` |
| A4 site 未解決で notFound、他ブログを漏らさない | **PASS** | 全新設画面が `resolveSiteOrNotFound` を先に通す。not-found は AppShell を描かない |
| A5 一段目が対象物の数まで畳まれている | **PASS** | 5 グループ。ホームのボードはサイドバーと同じ表からの射影 |
| A6 動詞ラベルの正答率 90% 以上 | **BLOCKED** | 外部参加者 0 名（§4） |
| A7 共通の雛形から複製する経路 | **PASS** | `cloneWritingMethodForSite`（被覆 100%） |
| A8 近道の到達クリック数が畳む前以下 | **PARTIAL** | 旧入口は残したが、複数ブログ時に使う `ah_last_site` の書込経路が無く、実到達クリック数は未確認 |
| A9 危険操作の確認分岐 | **PASS** | 新設 5 枚は危険操作を持たない |
| A10 新しい集計表を追加していない | **PASS** | `drizzle/*.sql` は 51 本のまま |

品質側（P09）は typecheck / lint / axe（WCAG 2.2 AA + best-practice で違反 0）すべて PASS。

## 3. 残課題 1: `/admin/content/*` の転送（A2 を PARTIAL に留める要因）

**状況**: 転送先の `/admin/sites/[site]/articles` が存在しない。正本は `feat-blog-scoped-admin-console`。

**判断（P10 として確定する）**: **待つ**。暫定転送を置かない。

理由。暫定で「記事はとりあえずブログ選択へ送る」形にすると、住所は壊れないが
**`/admin/content/*` を今すぐ使っている人の作業が確実に 1 手増える**。
受け皿が立つまでの利得は「転送表の見た目が揃う」だけで、払う対価は実際の作業の遅延である。
移設は、受け皿が立ってからでなければ移設ではなく破壊になる。

`redirect-map-draft.json` の `not_redirected` に理由付きで載せてある。黙って落としてはいない。
`feat-blog-scoped-admin-console` の記事画面が入った時点で、転送 5 本と同じ
`legacyAdminRedirect` の形で足せる（対応表 `LEGACY_SITE_SCOPED_ROUTES` に 1 行足すだけ）。

## 4. 残課題 2: A6 の正答率調査（外部参加者が必要）

初見の運営者にラベル一覧だけを見せ、各入口で何ができるかを言わせる調査。参加者 0 名。

自動テストで代用していない。この基準が測るのは「実装がラベルを出しているか」ではなく
**「読んだ人が意味を取れるか」**で、前者を緑にして 90% と書けば数字の捏造になる。
規則の正本 `feat-reference-blog-admin-ux` の A6 も同じ理由で BLOCKED のままである。
手順は `docs/spec/feat-reference-blog-admin-ux/usability-test-protocol.md`。

## 5. 残課題 3: ブログごとの書き方の上書き

いま `/admin/sites/[site]/writing` が出しているのは、
**全ブログ共通の雛形を、そのブログの型（比較・順位・レビュー…）で重み付けした複製**である
（`cloneWritingMethodForSite`）。読むことはできるが、**そのブログ固有の決めごとを足す口は無い**。

これは意図した範囲である。上書きを持たせるには「上書きの保存先」と
「共通の雛形が変わったとき上書きをどう扱うか」の 2 つを決める必要があり、
どちらも本 feature の受入（A7 = 複製する経路が在ること）を超える。

**次に着手するなら決めるべきこと**は 3 つ。

1. 上書きの単位（節ごとか、型ごとか、ブログまるごとか）
2. 共通の雛形が更新されたとき、上書き済みのブログをどうするか（追随 / 据え置き / 差分の提示）
3. 上書きを消したとき共通へ戻るか（＝上書きは差分か、コピーか）

3 を「コピー」にすると、雛形を直しても古い内容が残るブログが静かに増える。
本 feature が無くそうとしている形と同じなので、**差分として持つ**ことを勧める。

## 6. 文書ガバナンスのテスト失敗 3 ファイル — 解消済み（判定を訂正した）

| ファイル | 失敗 | 領域 |
|---|---:|---|
| `tests/architecture/blog-ui-spec-governance.test.ts` | 1 | `feat-blog-ui-builder` の feature node lineage |
| `tests/architecture/chapter-regeneration-floor.test.ts` | 3 | `system-spec/` の `frontend` / `ui-ux` 章の再生成 |
| `tests/architecture/reopen-discard-restore-gap.test.ts` | 1 | `ui-ux/web: required_info_checks` の復帰 |

**最初「本 feature 由来ではない」と書いたのは誤りだった。**
`HEAD`（`ed98785a`）の worktree で走らせて同じ 5 件が落ちたことを根拠にしたが、
`ed98785a` は**本 PR の書き戻し commit そのもの**である。基準点が PR の中にあった。

PR の base（`origin/dev` = `b6f0e24b`）と、main 側を取り込んだマージ commit
（`3146ca37`）では **3 ファイルとも通る**。落としたのは `ed98785a` である。

CI（PR #56）が赤くなったのは正しい。3 件とも直して 91 ファイル / 1136 件 全通過にした。
何を直したかは `release-report.md` §2-4 にある。閾値は 1 つも動かしていない。

## 7. 実行中に判明した申し送り（伏せない）

1. **P01 の upstream gate が、上流 4 feature の未完了を素通しした**。
   `ah-85cn`（open）、`ah-q4dt`・`ah-z8x6`（in_progress）が閉じていない状態で P01 が通っている。
   gate の判定条件が「文書の readiness」であって「上流 issue の状態」ではないためで、
   本 feature の瑕疵ではないが、**gate がそう読める形になっている**ことは記録しておく。
2. **P05 の宣言 `resource_scope` の外にあるファイルを触った**。
   `admin-route-metadata.ts`（route の正本）・`screen-information-ledger.json`（情報台帳）・
   `admin-disclosure-contract.ts`・`admin-card-contract.ts` など。
   これらは route を 1 本足すと必ず整合を要求してくる**正本側**で、触らずに新設画面を足すことはできない。
   scope の書き方が「新設する画面のディレクトリ」に寄っていて、正本側を含んでいなかった。
3. **P05 の produced artifact に書かれた `layout.tsx (…近道ナビゲーション)` に従わなかった**。
   `src/app/admin/layout.tsx` は `AppShell` を描いていないので、そこへ近道を足しても出ない。
   実際に近道が出る場所（サイドバーの `ADMIN_NAV`）を触った。
4. **P04 が設計したテストのうち、新規モジュール分は P05 で書いた**。
   実装より先にテストだけを置くと、その時点では import 先が無い。意図的に P05 へ寄せた。
5. **P03 の design review は fork ではなく main context で行った**。
   `p03-design-reviewer` の fork が 2 度とも無応答だったため。`design-review.md` §0 に記録済み。
6. **`/api/dev-signin` への POST の実行許可が下りなかった**。
   したがって**ログイン後の画面を本執筆者は 1 枚も開いていない**。
   A2 の転送先の中身・A5 のボード表示・A7 の複製導線の押下は、コードと自動テストによる判定である。
   live 画面の確認手順は `acceptance-report.md` §4 に置いた。
7. **切り分けに使った `/tmp/ah-base` の git worktree が残置してある**。
   撤去コマンドの実行許可が下りなかった。不要になり次第、手元で撤去すること。

## 8. 結論

受入 10 件のうち 7 件 PASS、2 件 PARTIAL（A2 / A8）、1 件 BLOCKED（A6）。
品質検査は動詞ラベルの正答率を除き全件 PASS。既存テストの回帰 0 件。

**A2・A6・A8 は、この時点で閉じていない残課題**である。
A2 は別 feature の受け皿待ち、A6 は外部参加者待ち。
A8 は active site の書込経路と複数ブログでの実測待ちである。いずれも代替手段で
緑に見せることをせず、理由と再開条件を明記して次へ渡す。

- Required evidence: 本ファイル
