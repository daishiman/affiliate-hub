# 仕様反映の受領書 — feat-site-scoped-authoring-ia

- 記録日: 2026-09-09
- 対象: 本 feature (Beads epic `ah-ro3w` / dev-graph `SYS-SITE-SCOPED-AUTHORING-IA-P01..P13`) の全変更
- 判定: **仕様・設計への影響は「有り」。3 箇所へ反映済み、2 箇所は反映不要 (理由付き)。**

---

## 0. この文書が答えること

「実装しただけで、仕様書は放っておかれていないか」に機械が答えられる形で答える。

影響の有無を **文書ごとに** 判定する。「影響なし」と書く場所には
**なぜ無いのかを書く。** 書かないと、次に読む人は
「調べた上で無かった」のか「調べていない」のかを区別できない。

---

## 1. 判定一覧

| 反映先 | 影響 | 状態 | 根拠 |
|---|---|---|---|
| `system-spec/ui-ux.md` | **有り** | 反映済み | §2 |
| `system-spec/frontend.md` | **有り** | 反映済み | §2 |
| `system-spec/spec-state.json` | **有り** (上 2 章の正本) | 反映済み | §2 |
| `architecture/arch-blog-operations-console.md` | **有り** | 反映済み | §3 |
| `architecture/` の他ノード | 無し | 反映不要 | §4-1 |
| `specs/` | 無し | 反映不要 | §4-2 |
| `features/feat-site-scoped-authoring-ia.md` | 有り (受入判定の確定) | 反映済み | §5 |
| `tasks/feat-site-scoped-authoring-ia/` | 無し | 反映不要 | §4-3 |

---

## 2. system-spec への反映 (P13 で実施済み)

経路は `set-chapter-note` + `compile-spec-doc.py compile --only`。
`R4-reopen` を使っていない。理由は `release-report.md` §2-1 にある —
reopen が動かすのは `qa_log[].answer` = **利用者本人の逐語**であり、
今回書き戻すのは「実装しなければ決まらなかったこと」で利用者が言ったことではない。
reopen で再確定すると、**利用者が言っていないことが利用者の声の顔で正本に残る。**

確定章は C11 hook が直接 Edit を塞いでいるので、章を変える唯一の経路は
正本 (`spec-state.json`) を変えることである。よって `spec-state.json` も
変更対象に入る。宣言 write scope が「生成される側」だけを挙げていて
「生成する側」を落としていた申し送りは `release-report.md` §3 にある。

実測 (追加のみ・削除 0 行):

```
82  0  system-spec/frontend.md
12  0  system-spec/spec-state.json
60  0  system-spec/ui-ux.md
```

書き戻した内容の要約は `release-report.md` §2-2。

---

## 3. architecture への反映 (本受領書と同時に実施)

### 何を足したか

`architecture/arch-blog-operations-console.md` の Cross-cutting contracts へ
「**提示層の住所と、データの所有単位は別である**」節を新設し、
禁止依存へ 1 行を足した。

### なぜ必要だったか — 既存の記述だけでは読み違えられる

このノードは「全層が `site_slug` を唯一の結合キーとする」と書いている。
本 feature は書き手・読者像の画面を `/admin/sites/[site]/` の下へ移したが、
**`author_personas` / `audience_personas` は `workspace_id` で持たれたままである。**

既存の記述だけを読むと、`/admin/sites/[site]/authors` の下にある物は
site 単位で持たれていると読める。実際は違う。この読み違いは
「別のブログで読者像を 1 つ消したら、こちらからも消えて初めて気付く」形で表に出る。

したがって足したのは新しい決定ではなく、
**既存の決定が及ばない範囲の明示**である。禁止依存に足した

> 住所がブログ単位の画面が、`site_slug` の実在確認より先に workspace のデータを読むこと

も同じで、順序を書いておかないと「存在しない slug で開いても中身が出る」実装が書ける。
これは「404 が出ない」ではなく **「中身が見える」** 形の壊れ方になる。

---

## 4. 反映しない箇所と、その判断理由

### 4-1. `architecture/` の他ノード

| ノード | なぜ影響しないか |
|---|---|
| `arch-two-layer-platform.md` | 作成者面 / 閲覧者面の二層境界を定める。本 feature は作成者面の**中**の住所を動かしただけで、二層の境界を越えていない |
| `arch-spec-governance.md` | 仕様文書の確定・再生成の規律。本 feature は既存経路 (`set-chapter-note`) をそのまま通しており、規律そのものを変えていない |
| `arch-system-spec-overview.md` | 章立ての索引。章の**中身**は変えたが、章の構成は変えていない |
| `architecture/graph.json` | ノードの新設・削除が 0 件 |

**機械確認**: `grep -rn "admin/personas\|admin/writing\|/admin/content" architecture/` が 0 件。
旧住所を名指ししているノードは無かったので、住所の移設で腐る記述も無い。

### 4-2. `specs/`

`specs/` は 5 ファイル — `spec-analytics-foundation` / `spec-gap-ledger` /
`spec-product-requirements` / `spec-reader-surface` / `system-spec-index`。

いずれも **本 feature の変更範囲と交わらない**:

- `spec-reader-surface` は閲覧者面 (`/s/...`)。本 feature は `/admin/...` だけを触った
- `spec-analytics-foundation` は指標の定義。本 feature は **新しい集計表を 1 件も足していない**
  (受入 A10。`drizzle/` への migration 追加 0 件で機械確認済み)
- `spec-product-requirements` / `system-spec-index` は上位の要求と索引。
  要求そのもの (「サイトごとに管理したい」) は変わっておらず、その**実現手段**が確定しただけ
- `spec-gap-ledger` は未充足の台帳。本 feature の残課題 (A6 / A8 / `/admin/content/*`) は
  台帳ではなく `final-review.md` と `features/feat-site-scoped-authoring-ia.md` の
  「実装状況」表で追っている。**同じ事実を 2 か所に置かない**

新しい spec ノードも作っていない。作ると
「site 配下の住所」という 1 つの事実が `system-spec/frontend.md` と
`specs/` の両方に載り、片方だけ直される形ができる。
**それは本 feature が無くそうとしている形そのものである。**

### 4-3. `tasks/feat-site-scoped-authoring-ia/`

13 枚の task spec は system-dev-planner が生成した **計画時点の記録**で、
`confirmation_evidence.evaluated_digest` と `source_lineage.source_digest` が
生成物の bytes に結び付いている。事後に本文を書き換えると、
**digest が指す物と現物が食い違う。**

実行して分かったこと (P13 の write scope が `spec-state.json` を落としていた等) は
task spec ではなく `release-report.md` / `final-review.md` の申し送りへ書いている。
計画は計画のまま残し、実績は実績の場所に置く。

---

## 5. features への反映

`features/feat-site-scoped-authoring-ia.md`:

- 受入 10 件のチェックボックスを実測の判定 (7 PASS / 2 PARTIAL / 1 BLOCKED) へ更新
- 「実装状況 (2026-09-09)」節を追加し、残 3 件の**再開条件**を書いた
- `status` は **`active` のまま**。`done` にすると
  「測っていない A6」と「受け皿待ちの `/admin/content/*`」が完了の中に埋まる

---

## 6. この受領書の検証可能性

| 主張 | 確かめ方 |
|---|---|
| system-spec への反映が追加のみ | `git diff system-spec/ \| grep -c '^-[^-]'` = 0 |
| architecture に旧住所の記述が無かった | `grep -rn "admin/personas\|admin/writing\|/admin/content" architecture/` = 0 件 |
| 新しい集計表を足していない | `git status --short drizzle/` = 0 件 |
| 証跡の digest が現物と一致 | `verify_evidence_index.py` の `stale` / `duplicates` / `invalid` が全て空 |
