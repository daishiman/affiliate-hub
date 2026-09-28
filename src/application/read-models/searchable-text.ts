/**
 * 検索の索引に載せる文字列を、公開の瞬間に確定させる。
 *
 * ==========================================================================
 * なぜ本文を SQL の側で取り出さないのか
 * ==========================================================================
 *
 * 記事の本体は `published_articles.article_json` に入れ子で入っている。
 * SQLite の trigger から `json_tree` で拾うことはできるが、拾えるのは
 * 「文字列である葉」であって、**それが読者に読まれる文かどうか**は区別できない。
 * slug も URL も画像パスも同じ「文字列の葉」なので、索引に混ざる。
 *
 * 混ざった索引は壊れて見えない。検索が動き、ただ関係ない記事が上位に出る。
 * 気づく手段が「読者が変だと言う」しか無くなる。
 *
 * だから**何を検索できることにするか**は、記事の形を知っている
 * この層が決める。決めた結果を列に置き、索引はその列から張る。
 *
 * ==========================================================================
 * なぜ「読み上げられる文」だけなのか
 * ==========================================================================
 *
 * 読者は「読んだ言葉」で探す。画面に出ない語（slug・分類コード・
 * 画像のファイル名）で当たっても、当たった理由が読者に説明できない。
 * 説明できない一致は、検索結果を読者にとって不気味なものにする。
 *
 * 逆に、画面に出ていて索引に無い語があると「確かに書いてあるのに出ない」
 * になる。だから**画面に出る文は残らず入れる**方針を取り、
 * 節の本文・要点・FAQ・会話・商品名まで拾う。
 */

import type { PublishedArticle } from "./published-article";

/**
 * 検索用テキストの上限（文字数）。
 *
 * 上限を置くのは、1 行が長くなるほど D1 の 1 行あたりの読み書きが重くなり、
 * 公開のたびに全文をもう 1 部書き込むことになるためである。
 *
 * 32,000 字は、日本語の記事としては長い部類（原稿用紙 80 枚相当）を
 * 丸ごと収めた上でなお余る。ここに当たる記事は、検索よりも先に
 * **記事を分けたほうがよい**という別の問題を抱えている。
 * 切り捨てるより、当たったことが分かるほうが役に立つので、
 * 切った事実は `searchableTextTruncated` で見えるようにする。
 */
export const SEARCHABLE_TEXT_LIMIT = 32_000;

/**
 * 記事から検索用テキストを作る。**この関数だけが「何を検索できるか」を決める。**
 *
 * 題名と要約は含めない。あちらは列として独立に索引へ渡すので、
 * ここに混ぜると同じ語が二重に数えられ、題名に語がある記事と
 * 本文に 2 回ある記事の順位が入れ替わる。
 */
export function searchableTextOf(article: PublishedArticle): string {
  const parts: string[] = [];

  // 節: 見出しも入れる。読者は見出しの言葉で探すことがある。
  for (const section of article.sections) {
    parts.push(section.heading, ...section.paragraphs);
  }

  // 要点・FAQ・会話。どれも画面に文として出る。
  parts.push(...(article.keyPoints ?? []));
  for (const item of article.faq ?? []) parts.push(item.question, item.answer);
  for (const line of article.conversation ?? []) parts.push(line.text);

  /*
    商品カードは、画面に文として出る欄（名前・ブランド・一言）だけ入れる。
    `affiliateUrl` と `productId` は入れない。読者が読める言葉ではないし、
    転送用の合言葉が索引経由で外から見えるようになる。

    `priceNote` も入れない。書き写した価格は必ず古くなるので、
    索引に残すと**もう正しくない数字**で記事に当たれてしまう。
  */
  for (const card of article.productCards ?? []) {
    parts.push(card.name, card.brand, card.oneLine);
  }

  const joined = parts
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    // 改行は空白に潰す。trigram は文字の並びだけを見るので、
    // 改行が語をまたいで偽の 3 文字並びを作るのを避ける。
    .join(" ")
    .replace(/\s+/g, " ");

  return joined.slice(0, SEARCHABLE_TEXT_LIMIT);
}

/** 上限で切られたか。切られたことに気づけるようにしておく。 */
export function searchableTextTruncated(text: string): boolean {
  return text.length >= SEARCHABLE_TEXT_LIMIT;
}

/**
 * FTS5 の trigram が当たる最小の長さ。
 *
 * trigram は「3 文字の並び」で索引を張るので、**2 文字以下の語には
 * 当たらない。** 「AI」「炊飯」のような短い語は日本語では珍しくないので、
 * その場合だけ別の当て方（部分一致）へ落とす必要がある。
 * その分岐をする側が、この値をここから読む。
 */
export const TRIGRAM_MIN_LENGTH = 3;
