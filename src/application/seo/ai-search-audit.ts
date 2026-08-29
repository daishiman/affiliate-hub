import type { PublishedArticle } from "@/application/read-models/published-article";
import type { ExpressionBlockKind } from "@/domain/authoring/blog-template";
import { expressionBlocksOf } from "./expression-blocks";

/**
 * AI 検索（AI による引用）への備えの点検（feat-blog-ui-builder）。
 *
 * Google の AI 最適化ガイドは追加の技術要件を求めない。効くのは
 * 「結論が先にある」「いつの情報か分かる」「誰が言っているか分かる」
 * 「根拠が示されている」という**内容の構造**であり、これは
 * `EXPRESSION_BLOCK_KINDS` の前半 5 つ（answer / key_points / faq /
 * sources / freshness）と同じ考え方。ここでは公開済みの記事に対して
 * その構造が実際に入っているかを機械で見る。純関数。
 *
 * --- なぜ代理指標をやめたか ---
 * 以前は「冒頭に結論がある」を `sections[0].paragraphs.length > 0` で、
 * 「出典がある」を `claims[].evidence.length > 0` で見ていた。どちらも
 * **点検が独自に数え直した数**であって、読者や検索エンジンに届いた形とは
 * 別物だった。射影（`expressionBlocksOf`）が出典の重複をまとめたり
 * 名前の無い証跡を落としたりしても、点検だけは「ある」と言い続ける。
 *
 * いまは画面・JSON-LD・この点検が**同じ 1 本の射影**を読む。
 * 合格印は「読者に実際に出たもの」に対して付く。
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
  const summaryLength = [...article.summary].length;
  // 記事に**実際に出た**ブロックの種類。画面と JSON-LD が読むものと同じ。
  const present = new Set<ExpressionBlockKind>(expressionBlocksOf(article).map((b) => b.kind));

  return [
    {
      check: "冒頭に結論がある",
      ok: present.has("answer"),
      hint: "一文の結論（summary）を書く。AI は冒頭から答えを拾う。結論を最後に置くと引用されない。",
    },
    {
      /*
       * 要点。`EXPRESSION_BLOCK_KINDS` の `key_points` にあたる。
       *
       * 10 種のうち、読み取りモデルに他の置き場が無い唯一のブロック。
       * 箇条書きは AI が「この記事が何を言っているか」を数行で取り出せる形で、
       * 本文の段落からは同じ抜き出しができない。
       */
      check: "要点がある",
      ok: present.has("key_points"),
      hint: "記事の要点を 3〜5 行、1 行に 1 つ書く。結論の直後に箇条書きで出る。",
    },
    {
      check: "更新日がある",
      ok: present.has("freshness"),
      hint: "updatedAt を入れる。いつの情報か分からない記事は、鮮度を重んじる質問で選ばれない。",
    },
    {
      check: "著者情報がある",
      // 書き手は表現ブロックではない（記事の構造ではなく記事の出どころ）。
      ok: article.author.bio.trim() !== "",
      hint: "著者の bio を書く。資格・経歴（credentials）があればなお良い。誰が言っているか不明な記事は根拠として弱い。",
    },
    {
      check: "出典がある",
      ok: present.has("sources"),
      hint: "言い切り（claims）に出典の名前と確認日を付ける。名前の無い証跡は出典欄にも JSON-LD にも出ない。",
    },
    {
      /*
       * よくある質問。`EXPRESSION_BLOCK_KINDS` の `faq` にあたる。
       *
       * 問いと答えが対になっている文は、AI が「その問いへの答え」として
       * そのまま引ける形になっている。本文の中に同じ内容が散らばっていても、
       * どこが答えなのかは読み取り側には分からない。
       */
      check: "よくある質問がある",
      ok: present.has("faq"),
      hint: "読者から実際に来る問いを 2〜3 件、問いと答えの対で足す。対で書いた分だけ FAQPage としても出る。",
    },
    {
      check: `説明文が ${SUMMARY_MIN_CHARS}〜${SUMMARY_MAX_CHARS} 字に収まっている`,
      ok: summaryLength >= SUMMARY_MIN_CHARS && summaryLength <= SUMMARY_MAX_CHARS,
      hint: "summary を 50〜160 字にする。短すぎると内容が伝わらず、長すぎると検索結果で途中で切れる。",
    },
  ];
}
