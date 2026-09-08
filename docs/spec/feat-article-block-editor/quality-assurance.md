# 品質保証と非機能検査 (P09)

- feature: `feat-article-block-editor`
- phase: P09
- 検査日: 2026-09-06

## 1. 許可リストの網羅性

`src/domain/blogops/prose-allowlist.ts` (`SEC-REQ-009`)

### 前提の整理 — 何は既に守られているか

本文は React の部品として描く。したがって:

- **要素そのものが既に許可リストである。** `ProseNode` の 19 種以外は組み立てられない
- **属性は部品が決めた分しか付かない。** 任意の属性を差し込む経路が無い

`custom-html.ts` のように HTML 文字列を解く必要が無い。
ここが「文字列を受け取って削る」設計との決定的な違いである。

### 残る入口は 3 つ

| # | 入口 | 守り方 |
| --- | --- | --- |
| 1 | 行き先 URL (`href` / `src`) | `http:` `https:` と自サイト内の相対のみ。`javascript:` `data:` を通さない |
| 2 | 埋め込みの宛先ホスト | 5 ホストの数え上げ。ワイルドカードなし |
| 3 | 色 | 名前付きの値のみ。任意文字列を `style` へ渡さない |

許可ホスト: `www.youtube-nocookie.com` / `www.youtube.com` /
`player.vimeo.com` / `open.spotify.com` / `www.google.com`

`iframe` は「宛先ホストへ読者の画面の一区画を明け渡す操作」なので、
増やすときは個別に判断する。

`mailto:` は**あえて入れていない**。本文中の連絡先は文字で書けば足りる。
要らないものを入れないのが一番安い。

### 抜け道の潰し方

判定の前に大文字小文字・空白・制御文字を潰す。
`java\tscript:` のような書き方で `javascript:` 判定を割れないようにするため。
`custom-html.ts` と同じ潰し方を使っている (守り方を 2 通り持たない)。

### 削るのではなく止める

通せない URL は**通さないだけ**で、文字は本文に残す。
`custom-html.ts` は保存の入口で削るが、本文はそうしない。

> 本文は運営者が書いた文章そのもので、削った結果しか残らないと書き直せない。

削ると復元できない。止めるだけなら運営者が見て直せる。
**同じ「守る」でも、対象によって削るか止めるかを変えている。**

検証: `prose-allowlist.test.ts` (6 件) / `prose-inline.test.ts` (10 件)

## 2. RBAC 境界

| 口 | 認証 | 権限 | 意図 |
| --- | --- | --- | --- |
| `POST /api/article-images` | 必要 | `content.write` | 書き込みは絞る |
| `GET /api/article-images/:id` | **不要** | — | 読者に挿絵を見せるため |
| `GET /api/article-products` | 必要 | — | 商品名を無認証で引かせない |

### 読み出しが無認証であることの担保

`open-doors.test.ts` の `ROUTE_INTENT` へ `intent: "誰でも"` として
理由つきで登録した。公開している口の総数は台帳で数え上げられており、
上限 (`OPEN_DOORS_MAX_PUBLIC_BY_DECLARATION`) を 42 → 43 へ上げた際に
3 点の理由を残してある。

読める範囲は**台帳が数え上げた id の集合に限られる**。
R2 のキーを直接指定する口は存在しない。
URL に workspace id も article id も出さないので、
URL から他人の資源へ歩けない。

### 書き込みと読み出しをファイルで分けた理由

`route.ts` (POST) と `[image]/route.ts` (GET) は別ファイルである。
同じファイルに置くと、読み出しを無認証にする変更が
書き込み側の認証にも影響しうる。物理的に分ける。

### workspace 非スコープの問い合わせ

画像台帳には workspace で絞らない問い合わせが 5 本ある。
`tenant-scoped-schema.test.ts` の `QUERY_EXEMPT` へ、
1 本ずつ理由を書いて登録した。

| 関数 | 理由 |
| --- | --- |
| `findArticleImage` | 公開読み出し。呼び出し時点で作業場所の文脈が存在しない |
| `listArticleImagesForSweep` | 日次回収は全作業場所を横断する |
| `markArticleImagesReferenced` | id 指定。id は台帳の主キー |
| `markArticleImagesUnreferenced` | 同上 |
| `forgetArticleImage` | 同上 |

「workspace_id を足せば通る」からといって足していない。
公開読み出しには本当に作業場所の文脈が無く、
足すと**嘘の絞り込み**になる。

## 3. アクセシビリティ

| 観点 | 状態 |
| --- | --- |
| 編集面の操作にアクセシブル名 | `prose-editor.tsx` に 37 箇所、`rich-text.tsx` に 8 箇所 |
| 画像の代替文 | 必須。「画像は alt を必ず持つ」 |
| 代替文が空でも属性は落とさない | 「代替文が空でも、属性そのものは落とさない」 |
| 注意書きの読み上げ | 「記事の中の注意書きなので、読み上げに割り込ませない」 |
| 埋め込みの名前 | `title` を別欄で持たせる (読み上げに使う) |
| 自動検査 | 「断片が並んでいても、自動検査に違反がない」 |

検証は**可視ラベルとアクセシブル名**で行い、DOM 構造には依存しない。

`prose-body.tsx` に `aria-label` が 0 なのは意図的である。
公開面は意味の正しい要素 (`p` `h3` `ul` `blockquote` `hr` `figure`) で描くので、
補助のラベルを足す必要が無い。**ラベルで補うより、正しい要素を使う。**

## 4. 非機能 — バンドル重量

`runArticleImageReclaim` は `createDeps()` を呼ばない。
`worker-entry.js` から届く経路に依存を丸ごと引くとバンドルが重くなるため、
必要な `drizzle(binding, { schema })` だけを自前で組む。

検証: `tests/architecture/worker-entry-weight.test.ts` (既存・PASS)

## 5. 定期処理の独立性

8 本目の仕事を足したことで `scheduled-maintenance.test.ts` が落ちた。
数を 8 に直すだけでなく、次の 3 点を検証へ足した:

1. 独立した Promise として登録される
2. 同じ起動時刻を受け取る (`DB`, `BUCKET`, `now` の 3 引数)
3. binding が欠けたら `[article-image]` の名札で見送り、他へ波及しない

消す側の仕事なので、2 の「置き場と台帳の両方を受け取る」ことが特に重い。
片方だけで走ると、判断材料が欠けたまま削除する。
