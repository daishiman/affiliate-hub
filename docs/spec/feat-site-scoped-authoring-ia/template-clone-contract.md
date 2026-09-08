# 雛形複製契約 (P02)

feature: `feat-site-scoped-authoring-ia` / phase: P02 / 受入: A7, A10

書き方の決め事を、共通の雛形から 1 本のブログぶんへ複製する経路を決める。

## 1. 前提 — 保存先が無い

`createReadWritingMethodUseCase()` (`src/application/usecases/authoring/read-writing-method.ts`)
は依存を 1 つも取らない。返しているのは `@/domain/authoring/*` の定数そのものである。
`src/db/schema.ts` に書き方の決め事の表は無い。

本 feature は新しいデータモデルを作らない (A10 / P05 Workstream: Data = N/A)。
したがって「複製」は**保存する操作ではなく、読み出しのたびに雛形から作る計算**にする。

保存する複製を作ると、雛形を直したときにブログ側が古いまま残る。
いま `/admin/writing` の冒頭が言っている
「この画面と公開前の検査は同じ決めごとを見ています」が成り立たなくなる。
成り立たなくなった瞬間、この画面は手引きに堕ちる。

## 2. 雛形の住所

| 画面 | URL | 役割 |
|---|---|---|
| 共通の雛形 | `/admin/writing/template` | ワークスペース共通。複製元。 |
| ブログの決め事 | `/admin/sites/[site]/writing` | 雛形をこのブログの文脈で見たもの |
| 旧 URL | `/admin/writing` | site 配下へ転送する殻 (`redirect-contract.md`) |

`/admin/writing/template` は転送表 (`LEGACY_SITE_SCOPED_ROUTES`) の**鍵に無い**ので
転送されない。表は完全一致で引く。

## 3. 複製の関数

```
cloneWritingMethodForSite(
  template: WritingMethod,
  site: { slug, name, pattern },
) -> SiteWritingMethod
```

純粋関数。DB もクロックも読まない。同じ入力で常に同じ出力を返す。

```
SiteWritingMethod = WritingMethod & {
  readonly site: { readonly slug: string; readonly name: string };
  readonly origin: { readonly href: "/admin/writing/template"; readonly label: string };
  readonly emphasis: readonly { readonly point: string; readonly why: string }[];
}
```

- `template` は `readMethod` の出力をそのまま渡す。**中身を書き換えない。**
  節の並びも文体の決まりも雛形と 1 文字も違わない。違えたら公開前の検査と食い違う。
- `emphasis` はブログパターン (`SITE_PATTERNS` の 10 種) から引く読みどころ。
  決め事を足すのではなく、雛形のどこをこのブログでは特に見るかを言うだけ。
- `origin` が複製元へ戻る導線。A7 が要求する「戻れること」はこれで満たす。

`emphasis` の対応表 (`PATTERN_WRITING_EMPHASIS`) は
`src/domain/authoring/` に置く。パターンは domain の語彙なので、
表示層に置くと同じ表が 2 つになる。

## 4. 画面が言うこと

`/admin/sites/[site]/writing` の冒頭で 2 つを明示する。

1. これは共通の雛形から作られていること (`origin` へのリンク付き)
2. **このブログだけの上書きはまだ保存できないこと**

2 を書かないと、運営者はこの画面で決め事を変えられると読む。
変えられないと分かるのは、変えようとして手が止まったときになる。

## 5. 対象外 (P10 の残課題へ送るもの)

ブログごとの上書きを**保存する**経路。表の追加が要るので A10 と衝突する。
本 feature では作らない。P10 の `final-review.md` に残課題として明記する。

## 6. 検証

- 単体: `cloneWritingMethodForSite` が同じ入力で同じ出力を返す
- 単体: 出力の `sections` / `styleRules` / `factRules` が入力の雛形と一致する
- 単体: `SITE_PATTERNS` 10 種すべてに `emphasis` がある
- 単体: 出力の `origin.href` が `/admin/writing/template`
- 機械検査: `drizzle/` への migration 追加が 0 件
