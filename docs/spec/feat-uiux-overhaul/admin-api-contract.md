# 管理 API の契約: feat-uiux-overhaul

- graph node: `SYS-UIUX-OVERHAUL-P02`
- 受入条件: A2 — 管理対象 4 種すべてに一覧・新規作成・編集・削除の操作と対応 API が存在する / A3 — 投稿状態が一覧・詳細に反映される
- 現行の正本: `src/presentation/tools/catalog.ts`, `define-tool.ts`, `src/presentation/http/tool-scope.ts`

## 前提: API を足すとは tool を足すこと

この system に「管理画面用の REST route を書く」という作業は無い。

```
catalog.ts に tool を 1 つ足す
   ├─▶ REST      /api/tools/[tool]     (rest-adapter)
   ├─▶ WebMCP    ページ内の AI          (webmcp-adapter, readOnly のみ)
   └─▶ MCP       /api/mcp              (mcp-adapter)
```

`defineTool` は zod スキーマ 1 本から JSON Schema を作り、3 入口へ同じものを配る。**画面用の呼び出し口を別に作らない** — 作った時点で画面と AI で違う結果が出る余地ができる。

したがって A2 の「対応 API が存在する」は、**tool が catalog に載っていること**で満たされる。

## 現状の充足 (tool 層)

| 対象 | 一覧 | 作成 | 更新 | 削除 |
|---|---|---|---|---|
| ブログ | `list_managed_sites` ✅ | `create_site_from_draft` ✅ | ❌ | ❌ |
| 記事 | `list_content_board` ✅ | ❌ | ❌ | ❌ |
| 商品 | `filter_products` ✅ | ❌ | ❌ | ❌ |
| SNS 投稿 | `list_publications` ✅ | `schedule_publication` ✅ | `reschedule_publication` ⚠️ | `cancel_publication` ✅ |

**未充足は 8 組**。`requirements-baseline.md` が「12 組未充足」としたのは*画面上の操作*の数で、tool 層では 8 組。両者の差 4 組は「API はあるが画面に操作が無い」もの (SNS 投稿の 4 操作) にあたる。A2 は (a) 画面操作・(b) API・(c) 権限宣言の 3 つすべてを要求するので、**どちらも埋める必要がある**。

⚠️ `reschedule_publication` は日時だけを変える。本文・配信先の変更は現状できない。

## 新設する tool (10 件)

### ブログ

| tool | readOnly | requiresHumanApproval | 備考 |
|---|---|---|---|
| `update_managed_site` | false | false | 設計図を直す。10 軸を変えると `differentiationGap()` が再判定される |
| `delete_managed_site` | false | **true** | 記事・配信が残っていれば件数を返して拒否する |

### 記事

| tool | readOnly | requiresHumanApproval | 備考 |
|---|---|---|---|
| `create_content_variant` | false | false | 空の記事枠を作る。本文生成 (`draft_content_variant`) とは別 |
| `update_content_variant` | false | false | 本文・題名を直す。承認済みを直すと承認が外れる |
| `delete_content_variant` | false | **true** | 公開済みは拒否する (取り下げが先) |

### 商品

| tool | readOnly | requiresHumanApproval | 備考 |
|---|---|---|---|
| `create_product` | false | false | 仕様と根拠を伴わない商品は作れない |
| `update_product` | false | false | 根拠を消す変更は、参照している記事の件数を返す |
| `delete_product` | false | **true** | 記事から参照されていれば件数を返して拒否する |

### SNS 投稿

| tool | readOnly | requiresHumanApproval | 備考 |
|---|---|---|---|
| `update_publication` | false | false | 本文・配信先を直す。送信済みは拒否する |

### 投稿状態の参照 (A3)

| tool | readOnly | requiresHumanApproval | 備考 |
|---|---|---|---|
| `get_content_channel_status` | **true** | false | 1 記事の配信先ごとの状態と失敗理由。一覧・詳細の両方が使う |

**状態の取得元は `feat-distribution-hub`。** 本 tool はその読み取り投影で、送信は行わない。

## 権限の決め方

`isToolAllowedForScope` の規則は 2 つだけ。

1. 自サイトの画面から (`same-origin`) 呼べるのは読み取りだけ
2. `requiresHumanApproval` の操作は、トークンを持っていても入口からは実行させない

### 削除だけ `requiresHumanApproval: true` にする理由

削除は取り消せない。`requiresHumanApproval: true` にすると、**REST でトークンを持っていても、MCP 経由の AI からも実行できなくなり、画面で人が押すことでしか起きなくなる**。

作成・更新を false にするのは、これらが取り消せるため。間違えたら直せる操作に人の承認を要求すると、承認そのものが形骸化する。

### 「拒否する」を返す設計

削除の多くは条件付きで拒否される (参照が残っている・公開済み)。**拒否は例外ではなく通常の戻り値**とし、`DomainError` で理由と件数を返す。

```
delete_product(id) ─▶ 参照している記事が 3 件 ─▶ err("この商品は 3 件の記事から参照されています")
```

画面 (`DeleteConfirm`) はこの件数を確認の中に出す。**押す前に分かる**ようにするのが本来で、押してから断られるのは二番目に良い形。

## 命名の規則

既存 tool は `動詞_対象` で揃っている (`list_`, `get_`, `create_`, `update_`, `delete_`, `check_`)。新設もこれに従う。

**同じ対象に別の名前を作らない。** ブログは `managed_site` (管理側) と `site` (読者側) で既に別名だが、これは対象が違う (管理する設計図 / 公開されているサイト) ため許す。新設分は `managed_site` に揃える。

## 入力スキーマの方針

`defineTool` の `declaredSchema` (宣言する形) は、`schema` (受け付ける形) と**同じか、より狭く**する。広い宣言は「呼べると言っておいて必ず断る」嘘になる。

作成 tool では、**必須項目を宣言に正しく出す**。商品作成で `evidence` を必須にしておきながら宣言で任意にすると、AI は根拠なしで呼んで毎回断られる。

## 画面との対応 (A2 の 3 点セット)

| 対象 | 操作 | 画面 | tool | 権限 |
|---|---|---|---|---|
| ブログ | 一覧 | `/admin/sites` | `list_managed_sites` | 読み取り |
| | 作成 | `/admin/sites/new` | `create_site_from_draft` | 要トークン |
| | 更新 | `/admin/sites/[site]/edit` | `update_managed_site` | 要トークン |
| | 削除 | `/admin/sites/[site]` の確認 | `delete_managed_site` | 画面のみ |
| 記事 | 一覧 | `/admin/content` | `list_content_board` | 読み取り |
| | 作成 | `/admin/content/new` | `create_content_variant` | 要トークン |
| | 更新 | `/admin/content/[variant]/edit` | `update_content_variant` | 要トークン |
| | 削除 | `/admin/content/[variant]` の確認 | `delete_content_variant` | 画面のみ |
| 商品 | 一覧 | `/admin/products` | `filter_products` | 読み取り |
| | 作成 | `/admin/products/new` | `create_product` | 要トークン |
| | 更新 | `/admin/products/[product]/edit` | `update_product` | 要トークン |
| | 削除 | `/admin/products/[product]` の確認 | `delete_product` | 画面のみ |
| SNS 投稿 | 一覧 | `/admin/distribution` | `list_publications` | 読み取り |
| | 作成 | `/admin/distribution/new` | `schedule_publication` | 要トークン |
| | 更新 | `/admin/distribution/[publication]/edit` | `update_publication` | 要トークン |
| | 削除 | `/admin/distribution/[publication]` の取り下げ | `cancel_publication` | 要トークン |

**16 組すべてが埋まる。** SNS 投稿の取り下げだけ `requiresHumanApproval` を false のままにするのは、予約の取り下げが取り消せる操作 (再予約できる) であるため。

P06 が 16 組の経路で確認する。1 組でも欠ければ FAIL。

## 検査できる形

| 条件 | 検査 |
|---|---|
| A2-b | `buildToolCatalog()` の結果に上記 16 tool 名がすべて存在する |
| A2-c | 16 tool すべてが `readOnly` と `requiresHumanApproval` を宣言している (型で保証済み) |
| A2-a | 上記の画面 route がすべて存在し、サイドバーまたは親画面から到達できる |
| A3 | `/admin/content` と `/admin/content/[variant]` の両方が `get_content_channel_status` を使う |

`tests/presentation/tool-catalog-adapters.test.ts` が既に「宣言どおりに組み立てた入力が入力不備で断られない」を総当たりで検査している。新設 tool も自動的にその対象になる。

## この文書が決めていないこと

- 各 tool の入出力の具体的なスキーマ — P04/P05 の実装が決める
- usecase 層の実装 — 同上
- 状態の取得処理 — `feat-distribution-hub` が所有する
