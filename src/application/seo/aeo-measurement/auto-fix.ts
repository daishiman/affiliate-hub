import type { PublishedArticle } from "@/application/read-models/published-article";
import {
  DESCRIPTION_MAX_CHARS,
  type Finding,
  type FindingCode,
  isArticleAutoFixable,
} from "@/domain/seo/aeo-measurement";

/**
 * 所見にもとづいて記事を書き換える、ただ 1 つの関数（受入 A6）。
 *
 * ==========================================================================
 * ここが「実際に何が変わるか」の全体である
 * ==========================================================================
 *
 * 自動反映は、判定（`decideAutoApply`）と保存（リポジトリ）と
 * この書き換えの 3 つでできている。判定が「してよい」と言っても、
 * **この関数が何も返さなければ何も起きない。** 逆に言えば、
 * 記事に起きうる変化はここに書いてあるものが全部である。
 *
 * 読む人が「勝手に何をされるのか」を知りたくなったとき、
 * 3 つのファイルを行き来せずにここだけを読めば分かるようにしてある。
 *
 * ==========================================================================
 * 埋める値は「別の欄から持ってくる」ものだけ
 * ==========================================================================
 *
 * 題名も要約も、**この関数は文章を作らない。** 記事の中に既にある文を
 * 移すだけである。文章を作ってしまうと、それは記事を書いたのが
 * 誰なのかという話になり、書き手の名前で出ている記事に
 * 誰も書いていない文が載る。
 *
 * `missing_title` は最初の節の見出しを、`missing_meta_description` は
 * 本文の冒頭を持ってくる。どちらも「記事の中で最も要約に近い文」であり、
 * 選び方に迷いが無い。
 */

/** 埋めた結果 1 件分。空なら「変えるものが無かった」。 */
export type ArticleAutoFix = {
  readonly next: PublishedArticle;
  /** 何を変えたか。人が読む 1 行。反映ログの `diffSummary` になる。 */
  readonly diffSummary: string;
  /** 実際に効いた所見。**判定が渡した所見のうち、変化を起こした分だけ。** */
  readonly appliedCodes: readonly FindingCode[];
};

/**
 * 記事へ所見を反映する。**変わらなければ `null` を返す。**
 *
 * `null` を返すことに意味がある。呼び出し側はこのとき反映ログを書かない。
 * 「変えていないのに反映した記録が残る」を防ぐのはここでしか出来ない ——
 * 判定の側は記事の中身を見ていないので、埋める材料があるかを知らない。
 */
export function applyFindingsToArticle(
  article: PublishedArticle,
  findings: readonly Finding[],
): ArticleAutoFix | null {
  const codes = new Set(
    findings.filter((finding) => isArticleAutoFixable(finding.code)).map((finding) => finding.code),
  );

  let next = article;
  const applied: FindingCode[] = [];
  const changes: string[] = [];

  if (codes.has("missing_title") && article.title.trim() === "") {
    const heading = article.sections[0]?.heading.trim() ?? "";
    if (heading !== "") {
      next = { ...next, title: heading };
      applied.push("missing_title");
      changes.push(`題名を最初の見出しから補いました（「${heading}」）`);
    }
  }

  if (codes.has("missing_meta_description") && article.summary.trim() === "") {
    const lead = leadSentence(article);
    if (lead !== "") {
      next = { ...next, summary: lead };
      applied.push("missing_meta_description");
      changes.push(`要約を本文の冒頭から補いました（「${lead}」）`);
    }
  }

  if (applied.length === 0) return null;
  return { next, diffSummary: changes.join("／"), appliedCodes: applied };
}

/**
 * 本文の冒頭から、要約に使える 1 文を取り出す。
 *
 * 句点で切るのは、途中で切れた文が検索結果に出ると
 * 「壊れているページ」に見えるためである。1 文が上限を超えるときだけ
 * 字数で切り、末尾に「…」を付けて**切ったことを隠さない**。
 */
function leadSentence(article: PublishedArticle): string {
  const paragraph = article.sections
    .flatMap((section) => section.paragraphs)
    .map((text) => text.trim())
    .find((text) => text !== "");
  if (paragraph === undefined) return "";

  const [first = ""] = paragraph.split("。");
  const sentence = first === paragraph ? paragraph : `${first}。`;

  const chars = [...sentence];
  if (chars.length <= DESCRIPTION_MAX_CHARS) return sentence;
  return `${chars.slice(0, DESCRIPTION_MAX_CHARS - 1).join("")}…`;
}
