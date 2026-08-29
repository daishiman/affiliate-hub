# 書いたことが、画面のどこに出るか

「この項目を入れたら、読者に何が見えるか」の対応表。
**書かない**ことで消えるものが多いので、消える側も書いた。

## ブログ全体

| 書くところ | 読者に見えるもの |
| --- | --- |
| `name` | ヘッダーのブログ名、タブの窓のタイトル |
| `categories[]` | ヘッダーのタブ。並びは書いた順 |
| `categories[].oneLine` | カテゴリーページの冒頭 1 行 |
| `pattern` + `extraPages` | フッターの固定ページ一覧 |
| `theme.brandTheme` | 配色。名札から画面側が色を決める |
| `theme.density` | 余白の詰まり方 |
| `differentiation` | 読者には直接出ない。**書き手が迷ったときの判断基準** |
| `emitLlmsTxt` | `/llms.txt`（AI 向けの目次）が出るかどうか |

`categories` を空にするとタブが消える。タブが 1 つのブログはタブが出ない。

## 記事に共通

| 書くところ | 読者に見えるもの |
| --- | --- |
| `title` | 見出しとタブの窓のタイトル |
| `summary` | 見出しの下の 1〜2 行 |
| `publishedAt` / `updatedAt` | 「公開」「更新」の日付。同じ日なら更新は出ない |
| `author` | 記事末尾の書き手欄 |
| `author.credentials` | 書き手欄の経歴。**空配列にすると経歴欄ごと消える**（名前と紹介文だけ残る） |
| `reviewedBy` | 監修者欄。**丸ごと省くと監修者欄が出ない**（「監修なし」とは出ない） |
| `disclosureRequired` | 記事冒頭の広告表記。`false` だと出ない |
| `sections[].claims` | 本文の下に、主張と根拠の一覧 |

### 主張と根拠

| 書き方 | 見えるもの |
| --- | --- |
| `kind: "fact"` + `evidence` あり | 「確かめた」印と、出典名・確認日 |
| `evidence[].url` あり | 出典名がリンクになる |
| `evidence[].url` 無し | 出典名が文字のまま出る（自社検証など） |
| `evidence[].expired: true` | 「確認から時間が経っています」の注意 |
| `kind: "inference"` | 「考えたこと」印 |
| `kind: "opinion"` | 「書き手の考え」印 |

## 商品カード（`productCards`）

| 書き方 | 見えるもの |
| --- | --- |
| `affiliateUrl` + `trackingCode` | 購入ボタン。`/go/<trackingCode>` を通る |
| `affiliateUrl` だけ | 購入ボタン。ASP の URL へ直接飛ぶ |
| **両方とも書かない** + `blockedReason` | ボタンの代わりに理由の文 |
| 片方でも残して `blockedReason` を書く | **理由は黙って消える**。ボタンが出る |
| `specs[].value: null` | 「未計測」と出る。行は残る |
| `specs` からその行ごと省く | 行が消える。**商品ごとに並びが変わり、横に見比べられなくなる** |
| `reviewSlug` あり | 商品名が個別レビューへのリンクになる |
| `reviewSlug` 無し | 商品名は文字のまま |

「まだ測っていない」を伝えたいときは、**省略ではなく `null`**。
省略は「その項目は存在しない」の意味になる。

## 順位表（`ranking`）

| 書くところ | 読者に見えるもの |
| --- | --- |
| `criteria[].label` + `weight` | 「何を何割で見たか」の内訳 |
| `criteria[].measurement` | 「どう測ったか」。ここが書けない基準は基準にしない |
| `entries[].criterionScores` | 基準ごとの点。`criteria` と同じ数・同じ並びで並ぶ |
| `entries[].totalScore` | 総合点 |
| `excluded[]` | 「今回外したもの」と理由 |
| `excluded: []`（空） | 除外欄ごと消える |

`excluded` を空にすると、読者からは
「都合の悪い商品を黙って外した」と区別が付かない。外したものがあるなら必ず書く。

## 比較表（`comparison`）

| 書き方 | 見えるもの |
| --- | --- |
| `columns[].numeric: true` | 並べ替えできる列になる。`value` に数だけ、単位は `unit` へ |
| 単位を `value` に混ぜる | 並べ替えが効かなくなる |
| `rows[].cells` からキーを省く | 「埋まっていない欄」として出る |
| `cells[].checkedAt` | いつ測ったかが欄に出る |

## 会話（`conversation`）

`reader` は質問、`writer` は答え、`expert` は釘を刺す、`assistant` は要約。
話者が 1 人だけの会話は会話にならない。**2 人以上**にする。

## 訂正履歴

記事側ではなくブログ側の持ち物。0 件のときは「訂正はありません」ではなく、
訂正一覧そのものが空のページとして出る。
