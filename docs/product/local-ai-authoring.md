# 手元の AI（Claude Code / Codex）から記事を書く

手元のターミナルで動かしている AI に、このシステムの記事を**直接**書かせるための手順です。
ファイルを書いて `git push` するのではなく、**AI が管理用の入口を叩いて記事を作ります。**

なぜファイル経由にしなかったかというと、記事の正本は D1（データベース）にあり、
ファイルを正本にすると**同じ記事が 2 つの場所にある**ことになるからです。
片方だけ直した日に、どちらが本物か誰にも分からなくなります。

---

## 先に決まっていること

- **AI は記事を書けますが、公開はできません。**
  `set_blog_article_status`（公開・確認待ちへ移す）と `delete_blog_article`（消す）は
  `requiresHumanApproval` が立っていて、AI の身元で呼ぶと必ず `FORBIDDEN` になります。
  読者に出す判断と、後から確かめられなくなる操作は、人が画面から押します。
- **作られる記事は必ず下書きです。** `create_blog_article` にはそもそも公開状態の引数がありません。
- **報酬額は AI に渡りません。** ブログ運用の道具には商業データのポートを繋いでいません
  （繋ぐと組み立ての時点で例外になります）。報酬額を記事の並び順や書き分けの入力に
  できないようにするためです。

---

## 1. 合言葉を 2 つ用意する（ご本人の作業）

**この作業はご本人が行ってください。私（AI）は代行しませんし、値も受け取りません。**
値をチャットやファイルへ貼ると、貼った時点で実行履歴に残り、消したつもりでも残り続けます。

必要なのは 2 つで、**役割がまったく違います。**

| 名前 | 何を名乗るもの | 例えるなら |
| --- | --- | --- |
| `MCP_TOKEN` | この入口を叩いてよい相手か（**門**） | 建物の入口の鍵 |
| 連携の鍵 | どの作業場所の誰か（**身元**） | 中で見せる社員証 |

見出しを 1 つにまとめていないのは、**1 回の呼び出しが 2 つの別のことを名乗る必要がある**ためです。
門しか名乗れないと、身元の分からない呼び出しに管理用のデータが出ます。

- `MCP_TOKEN` … ご自身のターミナルで `wrangler secret put MCP_TOKEN` を実行して登録します。
- 連携の鍵 … 管理画面の「連携の鍵」から発行します。**発行直後の 1 回しか表示されません。**

---

## 2. AI に見えない形でターミナルへ読み込む

**AI が動いているのとは別のターミナル**を開いて、次を実行します。

```bash
read -rs MCP_TOKEN        && export MCP_TOKEN
read -rs AH_INTEGRATION_KEY && export AH_INTEGRATION_KEY
```

`read -rs` は打った文字を画面に出さず、シェルの履歴にも残しません。
`export` した環境変数は、そのターミナルから起動したコマンドだけが読めます。

> **`-H "Authorization: Bearer $MCP_TOKEN"` と直接書かないでください。**
> 展開後の値がプロセス一覧 (`ps`) に見えます。同じ端末の別の人からも読めるということです。

呼び出しは、見出しを**標準入力から**渡します。

```bash
ah_call() {  # ah_call <ツール名> <JSON>
  printf 'header = "Authorization: Bearer %s"\nheader = "X-Integration-Key: %s"\n' \
    "$MCP_TOKEN" "$AH_INTEGRATION_KEY" |
  curl --silent --show-error --config - \
    --header "Content-Type: application/json" \
    --data "$2" \
    "${AH_BASE_URL:?公開先の URL を入れてください}/api/tools/$1"
}
```

`curl --config -` は設定を標準入力から読むので、値が引数にも履歴にも残りません。

---

## 3. AI に渡す道具

| ツール名 | できること | AI から呼べるか |
| --- | --- | --- |
| `list_blog_articles` | 記事の一覧（下書き含む）と鮮度 | ○ |
| `get_blog_article` | 記事 1 本と、記事型に対する部品の過不足 | ○ |
| `list_blog_tags` | 話題・作り手のタグ一覧 | ○ |
| `create_blog_article` | 記事の枠を作る（必ず下書き） | ○ |
| `update_blog_article` | 題名・書き出し・記事型・タグ・本文の節を書き換える | ○ |
| `set_blog_article_status` | 公開・確認待ちへ移す | **×**（人が画面から） |
| `delete_blog_article` | 記事を消す | **×**（人が画面から） |

一覧の正本は `buildToolCatalog()` 1 つで、画面・REST・WebMCP・MCP がすべて同じものを見ます。
**この表が古くなっても、実際に呼べるものは変わりません。**

### 本文の書き方

`update_blog_article` の `blocks[].body` は**拡張 Markdown の 1 本の文字列**です。

```
段落        そのまま（空行で区切る）
小見出し    ### text  /  #### text
箇条書き    - item
番号付き    1. item
引用        > text
区切り線    ---
画像        ![alt](src)
比較表      | 見出し | 見出し |
            | --- | --- |
            | 値 | 値 |
注意書き    :::callout tone=info title="題"
            本文
            :::
商品カード  :::product-card id="pc_xxx"
            :::
```

**独自の記法はこの 2 つ（`:::callout` と `:::product-card`）だけです。**
覚えることが増えるほど、AI が書いた本文は崩れます。
記法を 1 つも使っていない素の文章は、そのまま段落として読まれます。

書いたものは管理画面のエディタでそのまま編集できます。描き方が 1 か所
(`src/presentation/prose`) にあるので、**AI が書いた形と、人が画面で見る形は必ず一致します。**

---

## 4. 手順の全体

1. AI に `list_blog_articles` と `list_blog_tags` を呼ばせて、いまの状態を読ませる
2. `create_blog_article` で枠を作る（返る `requiredBlocks` が、その記事型で公開までに要る部品）
3. `update_blog_article` で節と本文を入れる（`blocks` を渡すと節はまるごと置き換わります）
4. `get_blog_article` の `missing` / `outOfOrder` が空になるまで直させる
   - `missing` は**足す**部品、`outOfOrder` は**動かす**部品で、直し方が違います
5. **人が** `/admin/blog/articles/<id>` を開いて読み、確認待ち／公開へ移す

5 を AI に飛ばさせることはできません。飛ばせないようにしてあります。
