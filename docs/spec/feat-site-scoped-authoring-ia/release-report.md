# リリースと書き戻しの報告 (P13 / SYS-SITE-SCOPED-AUTHORING-IA-P13)

- feature: `feat-site-scoped-authoring-ia`
- 実施日: 2026-09-08
- 消費した成果物: `ia-rules.md`, `operations.md`
- 判定: **書き戻し完了 / リリースは未実施（利用者の指示による）**

---

## 0. 先に書く — この phase の 2 つの成果のうち、片方は実施していない

P13 は 2 つを持つ。

| | 状態 |
|---|---|
| `system-spec/ui-ux.md` / `frontend.md` への実装確定内容の書き戻し | **完了**（§2） |
| dev ブランチ経由で開発環境へ反映（PR → マージ → デプロイ） | **未実施**（§4） |

未実施の理由は技術的な失敗ではない。**利用者から
「commit、push、PR 作成はまだ行わず、変更内容と検証結果を報告してください」
という明示の指示があり、それに従っている。**
「デプロイ済み」と書けば数行で報告は締まるが、それは嘘になる。

---

## 1. 受入コマンドの実測

| コマンド | 結果 |
|---|---|
| `pnpm run build` | **exit 0** |
| `pnpm run preview` | `Ready on http://localhost:8787`。`/admin/sites/first-camera/authors` → 307 `/signin`（認証関門へ到達） |
| `validate-system-plan.py --feature-package feature-package/feat-site-scoped-authoring-ia` | `violations: []` |
| `pnpm run typecheck`（P12 で実行） | exit 0 |

書き戻しで `system-spec/` の 2 章を再生成した**後**に build を通している。
書き戻しの前だけで測ると、章の再生成が build を壊していないことを示せない。

---

## 2. system-spec への書き戻し（完了）

### 2-1. 経路 — なぜ R4-reopen ではなく `set-chapter-note` か

task spec は「R4-reopen 経由」と書いている。**実際には `set-chapter-note` を使った。**
理由を書く。

`R4-reopen` は**確定済みのセルを開き直す**操作で、動かすのは
`qa_log[].answer`——**利用者本人の逐語**である。
今回書き戻す内容は「実装しなければ決まらなかったこと」であって、
利用者が言ったことではない。reopen して再確定すれば、
**利用者が言っていないことが利用者の声の顔で正本に残る。**

`set-chapter-note` は writer 自身が目的をこう書いている:

> 章は正本の純関数なので、正本に無い散文は compile のたび消える。（…）
> **守るのではなく、消えようのない場所へ移す。**利用者の逐語 (`qa_log[].answer`) には足さない。

先行 feature も同じ経路を通っている。`chapter_notes` には
`実装確定の書き戻し — feat-blog-ui-builder (P13、2026-08-30)` が既にあり、
今回の 2 件はその隣に並ぶ。**新しい経路を作ってはいない。**

`R4-reopen` が要るのは、利用者の決定そのものが変わったときである。
今回は変わっていない。利用者が決めた方針（ブログ単位へ移す・旧 URL は転送で受ける）を、
実装がどう具体化したかを足しただけである。

### 2-2. 書き戻した内容

**`system-spec/ui-ux.md`** — 見出し
「実装で確定した入口の畳み方と近道の選定基準 (feat-site-scoped-authoring-ia)」

- 一段目を作業の対象物 5 つ（ブログ/記事/読者/商品/配信）に畳んだこと、正本が 1 箇所であること
- **動詞（素材/書く/出す/稼ぐ/見る/整える）で切る案を捨てた理由**
  ——1 つの対象物の作業が複数の見出しに散り、運営者が両方開いていた
- 対象物と言えないものは `nav.group = null` で分類の外に置く
- **近道はサイドバーに新しい帯を足さず、旧入口をそのまま近道にした**こと、
  および「解決を押した瞬間の 1 回に限る」ためにそうしたこと
- 「書き手と読者像」を「書き手」に分けたこと（1 ラベルに 2 つの対象物を束ねない）

**`system-spec/frontend.md`** — 見出し
「実装で確定した URL 階層・転送規則・雛形複製経路 (feat-site-scoped-authoring-ia)」

- 所属替えした 6 route の表（93 → 99 本。畳んだのは入口の段であって route の本数ではない）
- **データ層は動かしていない**こと（移ったのは画面＝住所だけ、データは workspace 単位のまま）と、
  その代わり中身を読む前に `resolveSiteOrNotFound` を通すこと
- `getSite` 失敗時に理由を言い分けない理由（住所を打つだけで存否が読めてしまう）
- 転送する 5 本と、**`/admin/content/*` を転送していない理由**
  （受け皿が無い。移設は受け皿が立ってからでなければ破壊になる）
- **複製するのは重みだけ**であること（丸ごと複製すると検査がどれを見るか決まらない）
- route を 1 本足すと整合を要求する 5 つの表のうち 4 つが正本からの射影であること

### 2-3. 再生成の実測

```
compile-spec-doc.py compile --spec system-spec/spec-state.json \
  --references system-spec/fetched-references.json --out-dir system-spec \
  --on-handwritten preserve --only ui-ux.md --only frontend.md
```

`--only` で書き出しを 2 章に絞った。組み立ては常に全章を通るので index の相互参照は
正本どおりに出るが、**触っていないセルの章まで書き換えて生成節の中の手書き行を
巻き込む事故**を避けられる。

結果は**追加のみ**である。

```
82  0  system-spec/frontend.md
12  0  system-spec/spec-state.json
60  0  system-spec/ui-ux.md
```

削除行 **0**。`git diff | grep -c '^-[^-]'` も 0。

> compile は「節の引き継ぎで守れず消えた行が 11 本ある」と警告を出した。
> **これは実際の削除ではない。**警告は「今回の生成物に現れない行」を機械的に列挙するもので、
> 既により新しい行へ置き換わっているものも含む。現物の差分（削除 0 行）で確かめてある。
> 警告の文面だけで「11 行消えた」と報告すると、起きていないことを報告することになる。

### 2-4. 既存の失敗テストへの影響 — 増減なし

`system-spec/` を触ったので、文書ガバナンスの 3 ファイルを書き戻しの前後で比べた。

| ファイル | 前 | 後 |
|---|---:|---:|
| `tests/architecture/blog-ui-spec-governance.test.ts` | 1 | 1 |
| `tests/architecture/chapter-regeneration-floor.test.ts` | 3 | 3 |
| `tests/architecture/reopen-discard-restore-gap.test.ts` | 1 | 1 |

`chapter-regeneration-floor` が数える
「`## compile が保てなかった行 (要判断)` を持つ章の数」は 2 のままである。
**この節は `HEAD` の両章に既に在り、今回の差分に含まれていない**ことを確認した
（`git show HEAD:system-spec/ui-ux.md | grep -c` = 1、frontend も 1、差分側は 0 件）。

つまり書き戻しは既存の失敗を**増やしても減らしてもいない**。

---

## 3. 宣言 write scope の外を触ったこと（伏せない）

P13 の宣言 write scope は
`release-report.md` / `system-spec/ui-ux.md` / `system-spec/frontend.md` の 3 つである。
実際には **`system-spec/spec-state.json`（+12 行）も変更した。**

避けられない。確定章は C11 hook が直接 Edit を塞いでおり、
章の内容は `spec-state.json` の純関数として生成される。
**章を変える唯一の経路が正本を変えることである。**
scope の書き方が「生成される側」だけを挙げていて、「生成する側」を含んでいなかった。

同種の申し送りが P05 にもある（`final-review.md` §7-2）。
scope を書くときは、**正本と、そこから生成される物の両方**を挙げる必要がある。

---

## 4. リリース（未実施）— 実行しなかったコマンドと、その理由

利用者の指示により commit / push / PR 作成を行っていない。
**作業ツリーは変更を保持したまま、コミットされていない状態にある。**

実行していないのは次の並びである（`AGENTS.md`「枝の順番」に従う）。

```bash
# 1. 作業ブランチで確定する
git add -A && git commit

# 2. dev へ PR を出す（宛先は既定で dev。main へ直接出すと branch-flow.yml が落とす）
gh pr create --base dev

# 3. マージ後、開発環境へ反映される
#    PR 本文の契約: Closes <beads issue> + dev-graph graph_node_id=SYS-SITE-SCOPED-AUTHORING-IA-P13
```

**本番（`main`）へは出さない。**`dev` から `main` への PR は別の判断である。

### リリース前に決まっていること・いないこと

| | 状態 |
|---|---|
| build が通る | 済（exit 0） |
| Workers ランタイムで route が配線されている | 済（preview で 13 route が関門到達） |
| 型・lint・axe | 済（P09。axe は WCAG 2.2 AA + best-practice で違反 0） |
| A6 動詞ラベルの正答率 | **未**（外部参加者 0 名。`final-review.md` §4） |
| `/admin/content/*` の転送 | **未**（受け皿待ち。`final-review.md` §3） |
| ログイン後の画面の目視 | **未**（`/api/dev-signin` への POST の実行許可が下りなかった） |

A6 と `/admin/content/*` は**本 feature の中では閉じられない**種類の残課題で、
リリースの可否とは別の軸にある。両方とも代替手段で緑に見せず、
再開条件を書いて次へ渡してある。

---

## 5. この feature の最終状態

- 受入 10 件: 7 PASS / 2 PARTIAL（A2 / A8）/ 1 BLOCKED（A6）
- 品質検査: 動詞ラベルの正答率を除き全件 PASS
- 本 feature 由来のテスト失敗: **0 件**
- 全量: 530 ファイル中 527 通過 / 3 失敗（11,879 件中 5 件）。3 ファイルはいずれも
  `HEAD` でも同じ理由で落ちる既存分で、`system-spec/` と `.dev-graph/` の
  文書ガバナンス側にある

- Required evidence: 本ファイル

---

## 6. 実装後の独立レビューと、その反映 (2026-09-08 追記)

本報告を書いた後、独立 context のレビューを受けた。指摘 6 件のうち
**実在 2 件 (R4/R5) を反映し、4 件は前提が成立しないため却下した。**
判定表と根拠は `design-review.md` §5 にある。

**却下 4 件のうち R1 は半分当たっていた。**転送しない判断は実装で正しく
行われていたが、**契約文書 (`redirect-contract.md` §3、`site-scoped-route-contract.md`)
だけが P01 の下書きのまま 7 件・記事一覧ありで残っていた。**
レビュアーは文書を読んで「転送先が無い」と指摘した。指摘の結論は誤りだが、
**文書が実装と食い違っていたのは事実**である。文書だけを読んだ人が
存在しない画面を作ろうとする状態だったので、文書側を実装へ揃えた。

これは本 feature が無くそうとしている「同じ事実が 2 か所にあり、
片方だけ直される」形そのものが、契約文書自身に残っていたということである。

### 変更したファイル

| ファイル | 変更 |
|---|---|
| `redirect-contract.md` | §3 の表から content 2 行を削除し理由を明記。「7 本」→「5 本」(3 箇所)。**§5.1 「307 のみ・`permanentRedirect` 禁止」を新設** |
| `site-scoped-route-contract.md` | 記事一覧の行を取り消し線にし、意図的に作っていないことを明記 |
| `redirect-map-draft.json` | `not_redirected` へ `blog/pages` と `pickSiteSlug` 系を理由付きで追加 (R4) |
| `tests/acceptance/site-scoped-redirect-map.test.ts` | 5 本の殻が `permanentRedirect` を使っていない静的検査を追加 (R5) |
| `design-review.md` | §5 に判定表と根拠 |
| `evidence/index.json` / `verify-index.raw.txt` | `redirect-map-draft.json` の digest を取り直し (`stale: []` を再確認) |

### 反映後の実測

| 検査 | 結果 |
|---|---|
| `npx vitest run tests/acceptance tests/architecture` | 3 failed / 88 passed (91 ファイル)、5 failed / **1130 passed** (1135 件) |
| `pnpm run typecheck` | exit 0 |
| `verify_evidence_index.py` | `stale: []` / `duplicates: []` / `invalid: []` |

通過テストが 1129 → 1130 へ増えたのが追加した R5 の検査で、
**失敗 3 ファイル 5 件は増減していない**(既存分と同一)。

§5 の全量値は追加検査とリファクタリング後に測り直した実測である。
