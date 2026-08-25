# テスト設計: feat-uiux-overhaul

- graph node: `SYS-UIUX-OVERHAUL-P04`
- 前提: `design-review.md` / `component-contract.md` / `admin-api-contract.md`
- 方針: 受入 10 件それぞれに、**実装前に赤くなる**テストを対応させる

## 置き場所の決定 (write_scope からの逸脱・要報告)

task spec の write_scope は `src/presentation/ui/__tests__/` と `src/app/api/admin/__tests__/` を指定するが、**このリポジトリのテスト機構 3 つすべてと衝突する**。

| 機構 | 設定 | `src/**/__tests__/` に置くと |
|---|---|---|
| `vitest.config.mts` の `include` | `["tests/**/*.test.ts", "tests/**/*.test.tsx"]` | **1 件も走らない** |
| `scripts/tier-scan.mjs` | `tests/` 以下だけを走査 | 段の印が読まれず `tier-audit` に見えない |
| coverage の `include` | `["src/**/*.ts", "src/**/*.tsx"]` | テストファイル自身が分母に入り数字が壊れる |

設定 3 つを変える案もあるが、`vitest.config.mts` も `tier-scan.mjs` も write_scope 外であり、変更は既存 60 本超のテストの前提を動かす。**より小さい逸脱を選び、既存慣習どおり `tests/ui/` へ置く。**

置いただけで走らないテストは、緑に見えて何も検査していない。それは受入条件を守るどころか、守っているという嘘をつく。

## 段の割り当て

全 8 本を **tier 2 (広い門)** とする。`quality-gates.config.mjs` の tier 2 は「結合 / API 契約 / 画面 / 読み上げ / 境界値 / カバレッジ閾値」を含み、既存の `app-shell-nav.test.tsx` `layout-density.test.ts` と同じ段。

## 赤くなり方の規約

実装前のテストは **collect error ではなく assertion failure** で赤くする。

```
✗  存在しない部品を静的 import する  → ファイルごと収集に失敗し、原因が読めない
✓  動的 import を try/catch で包む   → 「まだ無い」が 1 件の失敗として出る
✓  ファイル走査で存在を確かめる      → 同上
```

収集に失敗すると、**同じファイル内の他のテストまで一緒に消える**。実装が進むにつれ赤が減っていく様子が見えなくなるので、この規約を崩さない。

## 受入条件とテストの対応

| 受入 | テストファイル | 何を確かめるか | 実装前の赤 |
|---|---|---|---|
| A1 | `uiux-screen-single-purpose.test.ts` | 各画面が業務状態を変えるフォームを 2 つ以上持たない / 分割後 49 route が存在する | 17 route 不在 |
| A2 | `uiux-admin-api-contract.test.ts` | catalog に 16 tool 名が揃う / 削除 3 件が `requiresHumanApproval` / 入口が両スコープから拒否する | 10 tool 不在 |
| A3 | `uiux-channel-status.test.tsx` | `ChannelStatusList` が 5 状態を能力表の言い方で描く / 失敗理由を必ず併記する | 部品不在 |
| A4 | `uiux-channel-status.test.tsx` | 能力表に架空エントリを足すと、画面部品が分岐なしで描ける / `ChannelKind` が表から導出される | 型が手書き union |
| A5 | `uiux-concept-matrix.test.tsx` | 商品 1 件 × 複数ブログで、切り口が設計図から自動で入る | 部品不在 |
| A6 | `uiux-duplicate-implementation.test.ts` | 同じ import 群 + 同じ JSX タグ列 (深さ 2) が 2 か所以上ない | 現状の重複 |
| A7 | `uiux-blog-scaffold.test.ts` | 共通部品にブログ名の分岐がない / 固有部品を読む口がある / 管理画面に露出する | 口が未実装 |
| A8 | `uiux-spacing-and-copy.test.ts` | カード内 padding が `--space-5` / カード間 gap が `--space-4` / lead 40 字 / Callout 2 個 | 21 画面 + 14 画面 |
| A9 | `uiux-sidebar-icons.test.tsx` | 全項目に `icon` / 折りたたみが操作できる / 折りたたみ時もアイコンで識別できる | `icon` 不在 |
| A10 | `uiux-spacing-and-copy.test.ts` | `information-priority-map.json` の drop 対象が画面から消えている | 未実施 |

A4 と A3 を同じファイルに置くのは、どちらも `ChannelStatusList` の同じ描画を見ているため。別ファイルにすると、同じ描画を 2 回組み立てることになる。

## 各テストの判定基準

### A1: 単一用途

「主要タスク」を機械が数える形にする。**業務状態を変えるフォーム** = `ToolForm` を使っている箇所の数。検索・絞り込みは業務状態を変えないので数えない。

- 1 画面あたり `ToolForm` は 1 つまで
- `screen-architecture.md` が定めた 49 route がすべて実在する

### A2: CRUD 16 組

`buildToolCatalog()` の結果を名前で引く。3 点セットのうち tool 層と権限層をここで見る。画面層 (route の実在) は A1 が見る。

- 16 tool 名がすべて存在する
- `delete_managed_site` / `delete_content_variant` / `delete_product` が `requiresHumanApproval: true`
- その 3 件が `isToolAllowedForScope` で `bearer` からも `same-origin` からも false
- 作成・更新 7 件は `requiresHumanApproval: false` (承認の形骸化を防ぐ)

### A3 / A4: 配信状態と拡張性

- 5 状態すべてが `statusLabels` から引かれる (画面側に `switch` がない)
- `failed` のとき理由が必ず出る
- 能力表に架空の 1 エントリを足して `ChannelBadge` を描くと、既存部品の変更なしに描ける
- `ChannelKind` が `keyof typeof CHANNEL_CAPABILITIES` である (手書き union でない)

`iconName` は `design-review.md` の重大 10 に従い、**投稿方式ごとの 3 種**であることを確かめる。プロバイダごとの絵柄名になっていたら赤にする。

### A5: 1 商品 → 複数ブログ

- ブログを 2 つ以上選ぶと、選んだ数だけ生成対象が並ぶ
- 各対象の切り口が、そのブログの `differentiation` から入っている (人が入力していない)
- 上書きできるが、既定は設計図のまま

### A6: 重複 0 件

`design-review.md` の 2 段構えのうち**一次検査**を実装する。

1. `src/app/**/*.tsx` を読む
2. 各ファイルの JSX タグ名を出現順に並べ、深さ 2 までの連続 3 タグの窓を作る
3. 同じ窓が 2 ファイル以上に現れたら候補
4. `@/presentation/ui` の部品呼び出しだけで構成された窓は除外する (共通化の結果)

属性値は見ない。二次検査は人が行う。

### A7: ブログ別 scaffold

- 共通部品に `slug === "..."` の分岐がない
- `src/presentation/sites/<slug>/` があれば `index.ts` と `README.md` を伴う
- ディレクトリ名が `SiteBlueprint.id` の形である (表示名でない)
- `src/presentation/sites/index.ts` が `hasSiteOverrides(slug)` と `siteOverrideReason(slug)` を出す
- `/admin/sites/[site]` がそのどちらかを呼び、固有部品の有無と理由を画面に出す

最後の 2 つを足した理由。契約 (`blog-scaffold-contract.md`) が「既定ではファイルを生成しない」と決めているため、`src/presentation/sites/` は**空が正常**である。ディレクトリの中身だけを見る検査は、実装が 1 行も無い状態で緑になる (実際に初版はそうなった)。A7 が問うているのは「実際に scaffold できる」であり、それは**足したときに読まれる口があるか**で決まる。口の名前をここで確定させる。

管理画面への露出を条件に入れるのは、`README.md` がコードを読む人にしか見えないため。例外が積み上がっていることに気付ける場所が、運用する人の側にも要る。

### A8 / A10: 間隔・文章量・情報削減

- `ui.module.css` のカード内 padding がすべて `--space-5`
- カード間 gap がすべて `--space-4`
- 全 page.tsx の `lead` が 40 字以内 (`design-review.md` の改稿表が正解)
- 常時表示 `Callout` が 1 画面 2 個以内 (`/admin/ui-catalog` は `exempt_from` で除外)
- `information-priority-map.json` の `drop` (`method: "remove"`) が画面から消えている

### A9: サイドバー

- `ADMIN_NAV` 全 19 項目に `icon` がある
- 折りたたみの操作点にアクセシブル名がある
- 折りたたみ時、各項目のアクセシブル名が残る (アイコンだけでも読み上げで識別できる)
- 折りたたみ時も 19 項目すべてが到達可能
- 子画面 (`/admin/settings/appearance`) にいるとき、親 (`/admin/settings`) が現在地になる

**折りたたみ時に読み上げ名が消えないこと**が要点。見える文字が消えても、見えない人には何も変わらない状態を保つ。

## カバレッジ

`quality-gates.config.mjs` の `GLOBAL_COVERAGE` を変えない。新規実装は tier 2 のカバレッジ判定に自動的に入る。

## この設計が決めていないこと

- 実装の具体形 — P05 が所有する
- 既存画面の移行順 — P08 が所有する
- 一次検査で挙がった候補の引き上げ先 — P08 が判断する
