import { and, eq, isNull } from "drizzle-orm";
import type {
  PublishedArticle,
  PublishedSection,
} from "@/application/read-models/published-article";
import { publishedArticles } from "@/db/schema";
import type { AnswerUnit, AnswerUnitKind } from "@/domain/aeo";
import type { AnswerUnitExtractor } from "../persistence/d1/seo-assessment-repository";
import type { DrizzleD1 } from "../persistence/d1/link-inbox-repository";

/**
 * 公開済みの記事から、回答エンジンに引かれうる単位を切り出す側。
 *
 * --- 切り出すもの ---
 * 記事の中で「問いと、それへの答え」の対になっている場所だけを取る。
 * 具体的には、一文の結論、FAQ、問いの形の見出し、語義の見出し、
 * 手順の見出し、根拠付きの言い切り (claim) の 6 か所である。
 * 段落を機械的に刻んで並べないのは、**問いの分からない断片は
 * 引用されても意味が変わる**ためで、これは領域側の
 * `validateAnswerUnit` が問いを必須にしているのと同じ理由である。
 *
 * --- 位置 (positionRatio) の付け方 ---
 * 節から取った単位は「何番目の節か」を比率にする。答えが記事の奥に
 * あるほど引かれにくいので、この値が埋もれ判定 (`BURIED_ANSWER_THRESHOLD`)
 * の入力になる。
 *
 * **FAQ と一文の結論は 0 を入れる。** どちらも記事の後ろに描かれるが、
 * 構造化データとして単体で名指しできる塊なので、本文の奥にある段落とは
 * 事情が違う。ここを節と同じ扱いにすると、正しく作った FAQ が
 * 毎回「埋もれている」と指摘され、本当に埋もれている答えが埋もれる。
 */

type Raw = Omit<AnswerUnit, "id" | "extractedAt">;

/** 問いの形をしている見出し。 */
const QUESTION_HEADING = /[?？]\s*$/;
/** 語義を説明している見出し。 */
const DEFINITION_HEADING = /(とは|の意味|の定義)/;
/** 手順を並べている見出し。 */
const STEP_HEADING = /(手順|ステップ|やり方|方法|の流れ)/;

/** 引用に耐える長さへ詰める。切るのではなく、超えるものは捨てる。 */
function usable(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  /*
   * 途中で切って収めない。切った文は、書き手が書いていない文になる。
   * 長すぎることは領域側が `answer-too-long` の隙間として指摘するので、
   * ここで隠すと、直すべき記事が「問題なし」に見える。
   */
  return trimmed;
}

function unitOf(
  article: PublishedArticle,
  kind: AnswerUnitKind,
  question: string,
  answer: string,
  positionRatio: number,
  sourceRef: string | null,
): Raw | null {
  const q = question.trim();
  const a = usable(answer);
  if (q === "" || a === null) return null;
  return {
    siteSlug: article.siteSlug,
    articleSlug: article.slug,
    kind,
    question: q,
    answer: a,
    positionRatio,
    sourceRef,
  };
}

function kindOfHeading(heading: string): AnswerUnitKind | null {
  if (QUESTION_HEADING.test(heading)) return "direct-answer";
  if (DEFINITION_HEADING.test(heading)) return "definition";
  if (STEP_HEADING.test(heading)) return "step-list";
  return null;
}

/** 節から取る。見出しが問いの形をしているものだけを対象にする。 */
function fromSection(
  article: PublishedArticle,
  section: PublishedSection,
  index: number,
  total: number,
): readonly Raw[] {
  const heading = section.heading.trim();
  const ratio = total <= 1 ? 0 : index / (total - 1);
  const units: Raw[] = [];

  const kind = kindOfHeading(heading);
  if (kind !== null) {
    const first = section.paragraphs.find((p) => p.trim() !== "");
    if (first !== undefined) {
      const unit = unitOf(article, kind, heading, first, ratio, null);
      if (unit !== null) units.push(unit);
    }
  }

  /*
   * 根拠の付いた言い切りは、見出しの形に関係なく取る。数値や事実は
   * 回答エンジンがそのまま引く典型で、出どころが無い断定は領域側が
   * `unsourced-claim` として指摘する。だから根拠の有無で捨てず、
   * 出どころの欄を埋めた上で渡す。
   */
  for (const claim of section.claims ?? []) {
    if (claim.kind !== "fact") continue;
    const evidence = claim.evidence[0];
    const sourceRef = evidence === undefined ? null : (evidence.url ?? evidence.sourceLabel);
    const unit = unitOf(article, "fact", heading === "" ? article.title : heading, claim.statement, ratio, sourceRef);
    if (unit !== null) units.push(unit);
  }

  return units;
}

function extractFrom(article: PublishedArticle): readonly Raw[] {
  const units: Raw[] = [];

  // 一文の結論。記事全体が答えている問いはタイトルだとみなす。
  const lead = unitOf(article, "direct-answer", article.title, article.summary, 0, null);
  if (lead !== null) units.push(lead);

  for (const item of article.faq ?? []) {
    const unit = unitOf(article, "direct-answer", item.question, item.answer, 0, null);
    if (unit !== null) units.push(unit);
  }

  const total = article.sections.length;
  article.sections.forEach((section, index) => {
    units.push(...fromSection(article, section, index, total));
  });

  if (article.comparison !== undefined && article.comparison.rows.length > 0) {
    const labels = article.comparison.rows.map((r) => r.label).join("、");
    const unit = unitOf(
      article,
      "comparison",
      `${article.title}では何を比べているか`,
      `${article.comparison.caption}（${labels}）`,
      0,
      null,
    );
    if (unit !== null) units.push(unit);
  }

  /*
   * 同じ問いが 2 つ以上できたら先に出たほうを残す。保存側は問いを鍵に
   * 置き換えるので、重複を渡すと最後に書かれたものが残る。記事の前の
   * ほうにある答えを優先するほうが、引用されたときに意図に近い。
   */
  const seen = new Set<string>();
  return units.filter((unit) => {
    if (seen.has(unit.question)) return false;
    seen.add(unit.question);
    return true;
  });
}

export function createAnswerUnitExtractor(db: DrizzleD1): AnswerUnitExtractor {
  return async (workspaceId, siteSlug, articleSlug) => {
    const rows = await db
      .select({ articleJson: publishedArticles.articleJson })
      .from(publishedArticles)
      .where(
        and(
          eq(publishedArticles.workspaceId, String(workspaceId)),
          eq(publishedArticles.siteSlug, siteSlug),
          eq(publishedArticles.slug, articleSlug),
          isNull(publishedArticles.archivedAt),
        ),
      )
      .limit(1);

    const row = rows[0];
    // 取り下げた記事・未公開の記事からは 1 件も取らない。0 件は失敗ではなく
    // 「引用できる形になっていない」という結果である (ポートの doc)。
    if (row === undefined) return [];

    return extractFrom(JSON.parse(row.articleJson) as PublishedArticle);
  };
}
