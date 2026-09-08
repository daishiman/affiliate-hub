# 既存画面の共通部品への移行 — 報告 (P08)

対象 feature: `feat-uiux-overhaul` / 対応 bd issue: `ah-geg`
測定日: 2026-08-22

---

## 1. 仕様書との差 — 移行対象は「画面」ではなかった

phase-08 の仕様書は「既存画面の共通部品への移行」と書いてある。実測すると、
`src/app/admin` の実画面には移行すべき生タグが既に残っていなかった。残っていた生タグは
すべて見本帳 (`/admin/ui-catalog`) が「悪い例」として描いているもので、意図的なものである。

真の未移行は `src/presentation/admin` にあった。画面 (`src/app/admin/**/page.tsx`) が
薄くなった分、フォームの実体はこちらへ移っており、**そこが検査の走査範囲から外れていた**。

| 場所 | 移行前の生 `<form>` | 移行後 |
|---|---:|---:|
| `src/app/admin/**` | 1 | 0 |
| `src/app/**` (admin 外) | 0 | 0 |
| `src/presentation/admin/**` | 14 | 0 |
| `src/presentation/ui/**` | 7 | 5 (すべて根拠あり・§4) |

`src/app/admin` の 1 件は `products/product-search-form.tsx`。

---

## 2. 移行の中身

### 2.1 決定的な証拠 — 届いていなかった宣言

`src/presentation/admin/inbox-forms.tsx` の生 `<form>` の中の `Select` に、
`toolParamDescription="このリンクが属する提携プログラムの ID"` が書かれていた。
欄は AI へ自己紹介しているのに、包む `<form>` が道具として名乗っていない。
**この説明文はどこにも届いていなかった。** しかも同じファイルの
`SubmitAffiliateUrlForm` は `ToolForm` を使っている。移行漏れの動かぬ証拠である。

同じ形が `src/app/admin/products/product-search-form.tsx` にもあった
(`toolParamDescription="商品を絞り込むための言葉。空のときはすべての商品を返す。"`)。

### 2.2 分類と処置

| 分類 | 件数 | ファイル | 処置 |
|---|---:|---|---|
| A: 移行漏れ | 3 | `inbox-forms.tsx` (3 intent を 3 つへ分割) | `ToolForm` |
| A: 移行漏れ | 3 | `feedback-forms.tsx` (Status / Disposition の undo・dispose) | `ToolForm` |
| A: 移行漏れ | 1 | `products/product-search-form.tsx` | `ToolForm` (`filter_products`) |
| B: 人専用 (意図的) | 1 | `feedback-forms.tsx` (Handoff) | `HumanOnlyForm` |
| B: 人専用 (意図的) | 4 | `improvement-forms.tsx` | `HumanOnlyForm` |
| B: 人専用 (意図的) | 2 | `integration-access-form.tsx` | `HumanOnlyForm` |
| B: 人専用 (意図的) | 3 | `llm-credential-form.tsx` | `HumanOnlyForm` |
| B: 人専用 (意図的) | 1 | `ui/patterns/concept-matrix.tsx` | `HumanOnlyForm` |

`inbox-forms.tsx` の 3 分割は、1 つの `<form>` が `intent` で 3 つの操作へ分かれていたため。
`ToolForm` は道具を 1 つしか名乗れない。`name="intent"` は submit ボタンから隠し欄へ移した。

`concept-matrix.tsx` を人専用にした根拠は目録の側にある。`get_generation_matrix` の説明に
「**表を見て決めるのは人**で、AI は表を作るところまで。どの組み合わせを作るかは
編集方針そのものなので、AI に決めさせない」と既に書いてあった。

---

## 3. 抽出した共通部品 — `HumanOnlyForm`

`src/presentation/ui/primitives/human-only-form.tsx` を新設した。

### なぜ必要だったか

素の `<form>` は 2 つの意味を同時に持つ。「AI へは渡さないと決めた」と
「`ToolForm` へ移し忘れた」である。この 2 つは `<form>` の行からは見分けが付かない。
だから**後者が前者の顔をして残り続ける** (§2.1 がまさにそれ)。

意図をコメントで書いても足りない。`improvement-forms.tsx` は冒頭に
「ここが `ToolForm` ではない理由」を丁寧に書いていたが、**コメントは 4 つの `<form>` の
行からは見えない**。意図は型で残すしかない。

```
readonly reason: string;   // 必須。消せば型が通らない
```

空文字は型を通ってしまうので、開発時 (`NODE_ENV !== "production"`) に throw する。

### `ActionButton` も同じ穴だった

`ActionButton` は生 `<form>` を持つ既存の共通部品で、説明文に「画面だけの操作に使う」と
書いてあった。だが**呼ぶ側の 1 行からはそれが見えない**。楽に書けるほうへ手が伸びるので、
`ToolForm` で名乗るべき操作がここへ流れ込む。流れ込んだ結果は素の `<form>` と同じである。

`reason` を必須引数に上げ、中身を `HumanOnlyForm` へ委ねた
(同じ約束の実装が 2 箇所にあると、片方だけ直る日が来る)。呼び出し 4 箇所すべてに理由を書いた。

### 見本帳への掲載

`ui-layers.test.ts` が「見本帳に載っていない部品」として即座に赤くなった。
`/admin/ui-catalog` の「11. 入力欄」へ `ToolForm` の見本と**対で**置いた。
片方しか見本に無いと、無いほうは素の `<form>` で書かれる。

---

## 4. 重複検査の結果

### 4.1 新設した検査 — `tests/ui/uiux-form-declaration.test.ts`

移行しただけでは、次に誰かが素の `<form>` を書けば元に戻る。機械に見張らせた。

規則は 3 つで、許可リストを持たない。

1. 生 `<form>` を書いてよいのは 2 つの根 (`tool-form.tsx` / `human-only-form.tsx`) だけ
2. 例外は `method="get"` を**その場に**持つもの。何も変えないことがタグの行から見える
3. 検査が空振りしていない

`method={...}` のように値が式なら許さない。式の中身はタグからは読めないため。

3 の内訳 (すべて床)。0 件を主張する検査には、0 でないはずの数の床が同居していないと、
**走査に失敗して 0 件を返す実装でも緑になる**。

| 床 | 値 | 何が壊れたら赤くなるか |
|---|---:|---|
| 走査 `.tsx` 数 | ≥ 100 (実測 144) | 走査範囲の消失 |
| `ToolForm` 使用 | ≥ 20 (実測 28) | 移行の巻き戻し |
| `HumanOnlyForm` + `ActionButton` 使用 | ≥ 8 (実測 17) | 同上 |
| 取り出し器が拾う生 `<form>` | ≥ 5 (実測 5) | 取り出し器そのものの故障 |

### 4.2 残る 5 件の生 `<form>` の根拠

| ファイル | 根拠 |
|---|---|
| `primitives/tool-form.tsx` | 根。AI へ渡す側の中身 |
| `primitives/human-only-form.tsx` | 根。渡さない側の中身 |
| `patterns/filter-bar.tsx` | `method="get"`。絞り込みは URL を変えるだけ |
| `patterns/model-picker.tsx` | `method="get"`。選ぶだけ |
| `patterns/material-review.tsx` | `method="get"`。確かめるだけ |

### 4.3 既存の A6 検査 (`uiux-duplicate-implementation.test.ts`) は範囲が狭い

A6 は `src/app` の `.tsx` しか見ていない。`src/presentation/admin` を見ていない。
§1 で見つかった 14 件が長く残った理由と同じ形の穴である。範囲拡大は P09 の課題として残す
(本 phase の write scope 外)。

---

## 5. 検証

| 検査 | 結果 |
|---|---|
| `npx tsc --noEmit` | エラー 0 |
| `npx vitest run tests/ui tests/presentation` | 77 ファイル / 2468 件すべて通過 |
| `node scripts/required-test-types.mjs` | OK (未宣言 7・上限 7 のまま。上限は動かしていない) |
| A1 `uiux-screen-single-purpose` | 影響なし (`page.tsx` の `toolName=` を数えるため) |

WebMCP の登録は目録 (`registerWebMcpTools`) から行われ、DOM の form 属性からではない。
そのため同名 `toolName` の `ToolForm` が同一画面に 2 つあっても登録数は変わらない
(`feedback-forms.tsx` の Disposition が該当)。

床・閾値は一切上げていない。

---

## 6. 動かしていないもの

- 実ブラウザでの動作確認。移行後のフォームが実際に送信できることは型と単体検査までしか見ていない。
- `HumanOnlyForm` の開発時 throw が実際に発火する経路の確認 (空文字を渡す呼び出しが 1 つも無いため)。
- A6 検査の走査範囲拡大 (§4.3)。

## 7. write scope からの逸脱

phase-08 の write scope は `src/app/admin/`、`src/presentation/ui/`、本ファイルの 3 つ。
以下はその外へ書いている。

- `src/presentation/admin/{inbox,feedback,improvement}-forms.tsx`、
  `integration-access-form.tsx`、`llm-credential-form.tsx` — §1 の通り、移行対象の実体がここにあった
- `src/app/signin/page.tsx` — `ActionButton` の `reason` 必須化に伴う呼び出し側の追従
- `tests/ui/uiux-form-declaration.test.ts` — §4.1
- `docs/product/required-test-types-report.md` — `required-test-types.mjs` が自動更新
