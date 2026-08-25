import type { PublishedArticle } from "@/application/read-models/published-article";

/**
 * AI 検索（AI による引用）への備えの点検（feat-blog-ui-builder）。
 *
 * Google の AI 最適化ガイドは追加の技術要件を求めない。効くのは
 * 「結論が先にある」「いつの情報か分かる」「誰が言っているか分かる」
 * 「根拠が示されている」という**内容の構造**であり、これは
 * `EXPRESSION_BLOCK_KINDS` の前半 5 つ（answer / key_points / faq /
 * sources / freshness）と同じ考え方。ここでは公開済みの記事に対して
 * その構造が実際に入っているかを機械で見る。純関数。
 */

export type AiSearchCheck = {
  readonly check: string;
  readonly ok: boolean;
  /** ok でないときに何をすればよいか。落ちた理由を人に調べさせない。 */
  readonly hint: string;
};

/** 一覧・検索結果に出す 1 文（summary）の適正な長さ。 */
export const SUMMARY_MIN_CHARS = 50;
export const SUMMARY_MAX_CHARS = 160;

export function auditArticleForAiSearch(article: PublishedArticle): readonly AiSearchCheck[] {
  const firstSection = article.sections[0];
  const summaryLength = [...article.summary].length;

  return [
    {
      check: "冒頭に結論がある",
      ok: firstSection !== undefined && firstSection.paragraphs.length > 0,
      hint: "先頭の節に本文が要る。AI は冒頭から答えを拾う。結論を最後に置くと引用されない。",
    },
    {
      check: "更新日がある",
      ok: article.updatedAt.trim() !== "",
      hint: "updatedAt を入れる。いつの情報か分からない記事は、鮮度を重んじる質問で選ばれない。",
    },
    {
      check: "著者情報がある",
      ok: article.author.bio.trim() !== "",
      hint: "著者の bio を書く。資格・経歴（credentials）があればなお良い。誰が言っているか不明な記事は根拠として弱い。",
    },
    {
      check: "出典がある",
      ok: article.sections.some((section) =>
        (section.claims ?? []).some((claim) => claim.evidence.length > 0),
      ),
      hint: "言い切り（claims）に evidence を付ける。出典の無い主張は AI にも読者にも検証できない。",
    },
    {
      check: `説明文が ${SUMMARY_MIN_CHARS}〜${SUMMARY_MAX_CHARS} 字に収まっている`,
      ok: summaryLength >= SUMMARY_MIN_CHARS && summaryLength <= SUMMARY_MAX_CHARS,
      hint: "summary を 50〜160 字にする。短すぎると内容が伝わらず、長すぎると検索結果で途中で切れる。",
    },
  ];
}
