# 転送契約 (P02)

feature: `feat-site-scoped-authoring-ia` / phase: P02 / 受入: A2, A3

旧 URL を、どういう規則で新しい住所へ送るかを決める。実装は
`src/presentation/admin/site-scoped-redirect.ts` の純粋関数 1 つに集約する。

## 1. なぜ関数 1 つに寄せるか

転送先の組み立てを各ページの `page.tsx` に散らすと、
「`/admin/personas` は送れているのに `/admin/personas/new` だけ送られない」
のような**片肺の状態**が作れる。作れるものはいつか作られる。

転送の判断は次の 2 つに分かれる。

1. **どのブログか** (`resolveSiteSlug`) — 副作用のある入力 (cookie・DB) を読む
2. **どこへ送るか** (`siteScopedRedirectTarget`) — 入力が揃っていれば決まる純粋関数

2 だけを純粋にしておくと、対応表の全件を単体テストで一度に検査できる。

## 2. どのブログかを決める (`resolveSiteSlug`)

```
resolveSiteSlug({ pathSite, querySite, cookieSite, siteSlugs }) -> string | null
```

| 順 | 入力 | 採用条件 |
|---|---|---|
| 1 | `pathSite` | 非 null かつ `siteSlugs` に含まれる |
| 2 | `querySite` | 非 null かつ `siteSlugs` に含まれる |
| 3 | `cookieSite` | 非 null かつ `siteSlugs` に含まれる |
| 4 | `siteSlugs` | 要素がちょうど 1 件 |
| — | それ以外 | `null` |

**`siteSlugs` に含まれることを毎回確かめる。**
確かめないと、消したブログの slug が cookie に残っている人だけが
存在しない住所へ送られ、そこで `notFound()` に当たる。
入口で弾けば、その人はブログ選択へ出る。

## 3. どこへ送るか (`siteScopedRedirectTarget`)

```
siteScopedRedirectTarget(legacyPath, siteSlug | null, query) -> string | null
```

- 対応表に無い旧 URL → `null` (転送しない)
- 対応表にあり `siteSlug` が `null` → `/admin/sites` (A3)
- 対応表にあり `siteSlug` がある → 表の `to` の `[site]` を差し替えた URL (A2)

対応表 (`LEGACY_SITE_SCOPED_ROUTES`):

| 旧 URL | 新 URL |
|---|---|
| `/admin/personas` | `/admin/sites/[site]/authors` |
| `/admin/personas/new` | `/admin/sites/[site]/authors/new` |
| `/admin/personas/audiences` | `/admin/sites/[site]/audience/personas` |
| `/admin/personas/audiences/new` | `/admin/sites/[site]/audience/personas/new` |
| `/admin/writing` | `/admin/sites/[site]/writing` |

**`/admin/content` と `/admin/content/published` はこの表に入れない。**
P01 の下書き段階では入れていたが、行き先の `/admin/sites/[site]/articles` は
本 feature の scope_out (正本は `feat-blog-scoped-admin-console`) で、
着手時点で存在しない。存在しない先へ送る殻を先に置くと、旧 URL は
**転送しない今より確実に壊れる**。移設は、受け皿が立ってからでなければ移設ではない。
非転送の理由は `redirect-map-draft.json` の `not_redirected` に残してある。

同じ理由で、`/admin/content` は複数ブログをまたぐ唯一の進行ボードでもある。
1 本のブログの下へ無条件に送ると、複数ブログの運営者は横断の一覧を失う。
受け皿が立った時点で、**横断ボードを残すか畳むかを別途決める**。
表に 1 行足せば転送になるが、足すだけでは決めたことにならない。

slug は `encodeURIComponent` を通す。通さないと、slug に `/` を含む値を
作れた日に、転送先が別の画面になる。

### 3.1 クエリ文字列の引継ぎ

決めておかないと、5 本の殻それぞれで実装者が別々に決める。
それは §1 が避けようとした片肺の状態そのものである (`design-review.md` F-03)。

| 鍵 | 扱い | 理由 |
|---|---|---|
| `site` | **引き継がない** | ブログの解決に使い切った。行き先の path に既に入っている。 |
| 表の `to` が持つ鍵 (`state`) | **表が勝つ** | 行き先の意味を決めているのは表であって、旧 URL のクエリではない。 |
| それ以外 | **そのまま引き継ぐ** | 絞り込みや検索語を捨てると、転送された人は毎回やり直す。 |

同じ鍵が複数値で来た場合は全値を保つ。1 つに畳むと、
複数選択の絞り込みが黙って 1 件に減る。

## 4. 転送しないもの

`redirect-map-draft.json` の `not_redirected` が正本。理由を必ず添える。
理由の無い非転送は「漏れ」と区別がつかない。

## 5. 転送の実装形

旧 URL の `page.tsx` は**転送だけを行う殻**にする (P08 で旧実装を撤去する)。

```tsx
export default async function LegacyPersonasPage({ searchParams }) {
  redirect(await legacyAdminRedirect("/admin/personas", await searchParams));
}
```

`legacyAdminRedirect` が cookie と DB を読み、上の 2 関数を順に呼ぶ。
`page.tsx` に条件分岐を書かない。書くと、5 本の殻それぞれで規則がずれる。

### 5.1 種別は 307 のみ。`permanentRedirect` を使わない

**`redirect()` (307) を使う。`permanentRedirect()` (308) は禁止する。**

この 5 本の行き先は cookie とブログ一覧から**その都度**決まる。308 は恒久移動の
宣言なので、ブラウザは行き先を覚えてしまう。すると site-a を開いた人の
`/admin/personas` は、その後 site-b へ切り替えても site-a へ飛び続け、
**site-a を消した後も飛ぶ**。`resolveSiteSlug` が `siteSlugs` を毎回確かめる
仕掛け (§2) は、要求がサーバーまで届かないので効かない。

明示しておく理由は、このリポジトリの隣に 308 の前例があることである
(`src/app/admin/blog/pages/page.tsx`)。あちらは行き先が `?site=` だけで決まり
cookie を見ないので 308 で壊れない。**前例を読んで真似ると壊れる**という形なので、
「真似てよい前例か」を各自の判断に委ねず、ここで種別を固定する。

## 6. 検証

- 単体: 対応表 5 件 × 解決できる/できない の 10 通りで行き先を確かめる
- 静的: 5 本の殻が `permanentRedirect` を import していないこと (§5.1)
- 単体: `?site=` が引き継がれず、他の鍵が引き継がれ、`state` は表の値が勝つ
- 単体: 解決順序 5 段すべてを、上位が空のときに下位が採られる形で確かめる
- 単体: `siteSlugs` に無い cookie が採られないことを確かめる
- 結合: 旧 URL へのアクセスが新 URL の描画に到達すること
