# 管理 API 契約（feat-blog-ui-builder / P02）

記録日: 2026-08-30
更新日: 2026-08-31（固定文書・見た目・掲載の現行 Action へ同期）
graph_node_id: `SYS-BLOG-UI-BUILDER-P02`
Beads: `ah-45ba.2`
受入: **A1**（テンプレート選択）、**A2**（配色設定と解除）、**A4**（固定ページ）、**A6**（掲載一覧）、**A7**（逆引き）

## 0. 前提 —「API」は REST route ではない

本リポジトリの管理操作は **Server Actions**（`src/presentation/admin/*-action.ts`）で実装されている。
`src/app/api/admin` は**存在しない**（`src/app/api` 配下は `auth` / `mcp` / `tools` /
`telemetry` / `feedback` 系のみ）。

**本 feature は REST エンドポイントを新設しない。**
新設すると、認可の入口が 2 系統になり、既存の `signedInActor()` を
通らない経路が生まれる。以下「API」は Server Action を指す。

## 1. すべての Action が守る形

現行の `manageBlogArticleAction` / `manageBlogAppearanceAction` /
`saveSiteDocumentAction` と同じ、認証 → 入力検証 → UseCase → 再検証の形に揃える。

```ts
"use server";

export async function <name>Action(
  _prev: <State>,
  formData: FormData,
): Promise<<State>> {
  const actor = await signedInActor();
  if (actor === null) return notSignedInFailure("<操作名>");

  const entry = await <feature>Entry();
  if (!entry.ready) return { status: "failed", message: entry.reason };

  // 1. FormData を parse*OrFailure で読む（例外を投げない）
  // 2. intent を parseIntentOrFailure で確定する
  // 3. UseCase を execute する
  // 4. revalidatePath(PATH)
}
```

| # | 契約 | 理由 |
|---|---|---|
| C1 | 未ログインは `notSignedInFailure` を返す。例外を投げない | 画面が白くならず、何が足りないか出る |
| C2 | 入力の検証は `parse*OrFailure` 系で行い、**失敗を値で返す** | throw すると Next の error boundary へ飛び、フォームの状態が消える |
| C3 | 語彙の検証は `parseEnumOrFailure(値, <domain の as const 配列>)` | 語彙の正本を Action 側に写さない |
| C4 | 記事など対象そのものの削除は理由を必須にし、関連の解除は before/after を監査記録へ残す | 後から「何を消したか」を再現できるようにする |
| C5 | 成功時に `revalidatePath(PATH)` する | 一覧が古いまま残る |
| C6 | 作業場所（workspace）は `actor` から採る。FormData から採らない | 利用者が書き換えられる値を権限の根拠にしない |

**C6 は本 feature で特に重要である。**
`blog_template` / `blog_theme` / `page_theme_override` / `legal_page` /
`blog_affiliate_placement` / `guideline_references` は `workspace_id` を持ち、
これを FormData 由来にすると作業場所をまたいだ書き込みが成立する。

## 2. テンプレート（A1）

### 2.1 `manageBlogAppearanceAction` — `select_template`

| | |
|---|---|
| 置き場所 | `src/presentation/admin/publish/blog-appearance-action.ts` |
| PATH | `/admin/sites/[site]/appearance` |
| intent | `select_template` |
| 入力 | `siteSlug`, `templateId` |
| 検証 | `templateId` ∈ `BLOG_TEMPLATE_IDS`（`parseEnumOrFailure`） |
| 権限 | 既存 admin RBAC の範囲。ブログの編集権を持つこと |

- **`blog_template` の行が無い状態を正常とする。** 行が無い＝既定
  （`review_focus`）。初回選択で `INSERT`、以降 `UPDATE`（`site_slug` 一意）。
- **記事への副作用を持たない。** この Action は `blog_article_block` を
  1 行も触らない。触ったらテンプレート差し替えで記事が壊れる（`component-contract.md` §1.1）。
  P04 はこれを「Action 実行前後で記事ブロック集合が同一」で検査する。

### 2.2 読み取り

`/admin/sites/[site]/appearance` は `BLOG_TEMPLATES`（DB を読まない定義）と、
`manage.execute({ action: "read", siteSlug })` の現在値を使う。

テンプレート定義そのものは `src/domain/authoring/blog-template.ts` にあり、DB に無い。
**定義を DB に置かない。** 置くと 6 種を増やすのに migration が要る。

## 3. 配色（A2）

### 3.1 `manageBlogAppearanceAction` — `save_theme`（ブログ既定）

| | |
|---|---|
| 置き場所 | `src/presentation/admin/publish/blog-appearance-action.ts` |
| PATH | `/admin/sites/[site]/appearance` |
| intent | `save_theme` |
| 入力 | `siteSlug`, `brandTheme`, `colorMode` |
| 検証 | `brandTheme` ∈ `BRAND_THEMES`, `colorMode` ∈ `COLOR_MODES` |

### 3.2 `manageBlogAppearanceAction` — `save_override` / `clear_override`

| | |
|---|---|
| 置き場所 | 同上 |
| PATH | `/admin/sites/[site]/appearance` |
| intent | `save_override` \| `clear_override` |
| 入力 | `siteSlug`, `pagePath`, `brandTheme?`, `colorMode?` |

| # | 契約 | 理由 |
|---|---|---|
| O1 | `intent=clear_override` は **`DELETE`**。NULL 行を残さない | 解除したのに一覧から消えない（`theme-contract.md` §3.3） |
| O2 | `intent=save_override` で両軸とも空のとき、`DELETE` へ倒す | 「上書きしていない上書き行」を作らせない（不変条件 I2） |
| O3 | 片方だけ空は**許す** | 配色だけ変えて明暗は既定、が正当な要求 |
| O4 | `pagePath` は先頭 `/`・末尾スラッシュ無しへ正規化してから保存 | `/about` と `/about/` が別行になる |
| O5 | `pagePath` が公開面に実在するかは**確かめない** | 予定のページに先に設定したい、が正当。実在検査は一覧側の警告で出す |

**O2 は UseCase と永続 adapter の契約である。**Action は空欄を欠測として渡し、
保存境界が両軸とも空なら削除へ倒す。D1 の制約だけでは書けない。

### 3.3 読み取り

- `/admin/sites/[site]/appearance` の 1 画面でブログ既定と上書き行を読む。
- **上書きしていないページは一覧へ出さない。**既存行は同じ画面で編集・解除する。

## 4. 固定ページ（A4）

canonical な操作口は `saveSiteDocumentAction`
（`src/presentation/admin/site-document-action.ts`）1 本である。
`SITE_ROUTES` から導く `SITE_DOCUMENT_KEYS` 8 種を
`/admin/sites/[site]/documents` で保存する。

| # | 契約 | 理由 |
|---|---|---|
| D1 | key は UseCase が `SiteDocumentKey` として検証する | Action 側へ route catalog の写しを作らない |
| D2 | workspace は actor と所有サイトから解決する | FormData を認可根拠にしない |
| D3 | 保存時に `status='published'`、`deleted_at=NULL` とする | 保存成功なのに読者側が 404 のまま、を作らない |
| D4 | 読者向け取得は owner workspace・published・`deleted_at IS NULL` をすべて要求する | 下書き・削除済み・別 workspace の漏出を止める |
| D5 | `/admin/blog/pages` と `/s/[site]/[fixedPage]` は canonical URL へ転送するだけ | legacy URL に CRUD/read-model を復活させない |

`FixedPageKind` は legacy URL の入力を識別する adapter にだけ残る。
`legal_page.kind`、管理画面、canonical 公開ページの正本ではない。

## 5. アフィリエイト掲載（A6 / A7）

### 5.1 `manageBlogPlacementAction`

| | |
|---|---|
| 置き場所 | `src/presentation/admin/publish/blog-placement-action.ts` |
| PATH | `/admin/sites/[site]/placements` |
| intent | `save` \| `remove` |
| 入力 | `siteSlug`, `articleSlug`, `placement`, `trackingCode?`, `position?` |
| 権限 | ブログの編集権 |

- `delete` は**物理削除**でよい。この表は所在の記録であり、
  消した配置の履歴を保つ要求は無い（記録が要るなら `audit_log` が持つ）。
- `position` の既定は `0`。同一 `placement` 内で重複してよい
  （並びの厳密性より、入力の軽さを採る）。

### 5.2 読み取り — A6（ブログ → 掲載一覧）

```
review.execute(actor, { action: "by_site", siteSlug })
  → 記事ごとに [{ articleSlug, placement, trackingCode, position }]
```

- 索引 `blog_affiliate_placement_site_article_idx` が効く。
- **導出して見せる**: 掲載 0 件の記事の数（掲載漏れ）。
  一覧の目的は「どこに出ているか」より「どこに**出ていないか**」に効く
  （P01 `information-priority-map.json` N5）。
- **見せない**: `workspace_id`、行 ID、報酬額
  （報酬は `/admin/affiliate` の担当。ここは所在を見る画面）。

### 5.3 読み取り — A7（アフィリエイト → 逆引き）

```
review.execute(actor, { action: "by_affiliate", trackingCode? })
  → [{ siteSlug, articleSlug, articleStatus, placement }]
```

- **`blog_affiliate_placement` 1 表だけで実現する。**
  `affiliate_links` に記事参照列を足さない（`data-model.md` §5、Q6 決着）。
- 索引が `(site_slug, article_slug)` 始まりのため、逆引きは
  作業場所での絞り込み後の走査になる。
  **現時点の行数（数千規模）では走査で足りる。**
  遅くなったら索引を足す — 遅くなる前に足さない。
- 記事の公開状態は `blog_article` 側との結合で採る。
  **下書き記事の掲載も出す。** 隠すと「公開したのに出ない」の原因が見えない。

### 5.4 A7-3 の「3 面一致」

受入 A7 は作成画面・保存後・公開面の 3 面で同じ集合が出ることを求める。
**3 面が同じ 1 つの読み取り関数を使うことで満たす。**
面ごとに別のクエリを書かない。書いた瞬間に一致が偶然になる。

ただし**公開面はこの表を読まない**（`data-model.md` §5、不変条件 I4）。
公開面での「同じ集合」は、記事の `cta` ブロックが持つリンク集合と
この表の集合が一致することを指す。一致の検査は P04 が持つ。

## 6. 権限

| 操作 | 要求 |
|---|---|
| テンプレート選択・配色設定・上書き | ブログの編集権 |
| 固定ページの保存 | `site.manage`。削除・復元の別 Action は持たない |
| 掲載の保存・削除 | ブログの編集権 |
| 掲載一覧・逆引きの閲覧 | ブログの閲覧権 |

**新しい役割を作らない。** 既存 admin RBAC の範囲で表す。
役割を足すと、既存の 87 画面すべての権限表を見直すことになる。

## 7. 次 phase への引き継ぎ

| 項目 | 引き継ぎ先 |
|---|---|
| 各 Action に対応する Port / UseCase の定義 | P03 |
| §2.1 の「記事への副作用が無い」検査 | P04 |
| §3.2 O1〜O5 の境界値 | P04 |
| §4 D1〜D5 の canonical 保存・公開条件・legacy redirect 検査 | P04 |
| §5.4 の 3 面一致検査 | P04 |
| Action 本体の実装 | P06 |
| `tests/e2e/app-routes.spec.ts:224` の画面数更新（N1〜N6 で 6 増） | P04 |
