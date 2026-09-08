import { and, eq, isNull } from "drizzle-orm";
import type { PublishedArticle } from "@/application/read-models/published-article";
import { publishedArticles } from "@/db/schema";
import type { SeoCheckKind, SeoFinding, SeoSeverity } from "@/domain/seo/assessment";
import type { SeoAnalyzer } from "../persistence/d1/seo-assessment-repository";
import type { DrizzleD1 } from "../persistence/d1/link-inbox-repository";

/**
 * 公開済みの記事を読んで、SEO の指摘を作る側（改善層の協力者）。
 *
 * --- 出す指摘の条件 ---
 * **現物の値を根拠として書けるものだけ**を出す。文字数、重複、空欄、
 * 節の数のように、機械が数えて真偽を言えるものに限る。「もっと魅力的に」
 * のような指摘を混ぜると、運用者はどれを信じてよいか分からなくなり、
 * 一覧そのものを見なくなる（`src/domain/seo/assessment.ts` の doc）。
 *
 * --- 出していない観点と、その理由 ---
 * `image-alt` と `canonical` は 1 件も出さない。公開記事の投影
 * (`PublishedArticle`) に画像の欄が無く、正規 URL はこの層ではなく
 * 住所層 (`site_custom_domains`) が決めているためである。**根拠を
 * 持てない観点は、観点の一覧にあっても出さない。** 空で出すと
 * 「調べた結果 問題なし」と読まれるが、実際は調べていない。
 *
 * --- なぜ LLM を使わないか ---
 * 診断は毎日回る。回すたびに答えが変わると、前回消えた指摘が
 * 記事を直したからなのか、たまたま出なかったからなのか区別できない。
 * 同じ記事からは必ず同じ指摘が出る、という性質のほうが価値が高い。
 */

/** 検索結果でタイトルが省略され始める目安（全角）。 */
const TITLE_MAX = 60;
/** 一文の結論として長すぎる目安。 */
const SUMMARY_MAX = 120;
/** 一文の結論として短すぎる目安。これ未満だと一覧で何の記事か分からない。 */
const SUMMARY_MIN = 20;
/** 本文がこれ未満の記事は、検索の答えとして扱われにくい。 */
const THIN_BODY_CHARS = 800;
/** 節がこれ未満だと、記事というより断片に近い。 */
const THIN_SECTION_COUNT = 2;

type Raw = Omit<SeoFinding, "id" | "state" | "assessedAt">;

function finding(
  article: PublishedArticle,
  checkKind: SeoCheckKind,
  severity: SeoSeverity,
  detail: string,
  evidence: string,
  suggestion: string | null,
): Raw {
  return {
    siteSlug: article.siteSlug,
    articleSlug: article.slug,
    checkKind,
    severity,
    detail,
    evidence,
    suggestion,
  };
}

function bodyLength(article: PublishedArticle): number {
  return article.sections.reduce(
    (total, section) =>
      total + section.heading.length + section.paragraphs.reduce((n, p) => n + p.length, 0),
    0,
  );
}

/** 記事 1 本ぶんの検査。他の記事を見ないで言えることだけをここに置く。 */
function checkArticle(article: PublishedArticle): readonly Raw[] {
  const found: Raw[] = [];

  const title = article.title.trim();
  if (title === "") {
    found.push(
      finding(article, "title", "critical", "タイトルが空です。", "title が空文字", "記事の結論が分かる見出しを入れてください。"),
    );
  } else if (title.length > TITLE_MAX) {
    found.push(
      finding(
        article,
        "title",
        "warning",
        `タイトルが ${title.length} 文字あります。検索結果では途中で切れます。`,
        `title の文字数 ${title.length} > ${TITLE_MAX}`,
        `${TITLE_MAX} 文字までに収め、大事な語を前半へ寄せてください。`,
      ),
    );
  }

  const summary = article.summary.trim();
  if (summary === "") {
    found.push(
      finding(article, "description", "critical", "一文の結論が空です。", "summary が空文字", "この記事の結論を 1 文で書いてください。"),
    );
  } else if (summary.length > SUMMARY_MAX) {
    found.push(
      finding(
        article,
        "description",
        "warning",
        `一文の結論が ${summary.length} 文字あります。`,
        `summary の文字数 ${summary.length} > ${SUMMARY_MAX}`,
        "結論だけを残し、理由は本文へ移してください。",
      ),
    );
  } else if (summary.length < SUMMARY_MIN) {
    found.push(
      finding(
        article,
        "description",
        "info",
        `一文の結論が ${summary.length} 文字しかありません。一覧で何の記事か分かりません。`,
        `summary の文字数 ${summary.length} < ${SUMMARY_MIN}`,
        "誰向けの何についての結論かを足してください。",
      ),
    );
  }

  // --- 見出しの階層 ---
  const headings = article.sections.map((s) => s.heading.trim());
  const emptyHeadings = headings.filter((h) => h === "").length;
  if (emptyHeadings > 0) {
    found.push(
      finding(
        article,
        "heading-structure",
        "critical",
        `見出しが空の節が ${emptyHeadings} 個あります。`,
        `sections[].heading が空: ${emptyHeadings} / ${headings.length}`,
        "その節で何を述べているかを見出しにしてください。",
      ),
    );
  }
  const duplicated = headings.filter((h, i) => h !== "" && headings.indexOf(h) !== i);
  if (duplicated.length > 0) {
    const sample = [...new Set(duplicated)].slice(0, 3).join(" / ");
    found.push(
      finding(
        article,
        "heading-structure",
        "warning",
        "同じ見出しが複数の節に付いています。目次から節を指せません。",
        `重複した見出し: ${sample}`,
        "節ごとに違う見出しを付けてください。",
      ),
    );
  }
  const emptySections = article.sections.filter(
    (s) => s.heading.trim() !== "" && s.paragraphs.every((p) => p.trim() === ""),
  );
  if (emptySections.length > 0) {
    found.push(
      finding(
        article,
        "heading-structure",
        "warning",
        `見出しだけで本文が無い節が ${emptySections.length} 個あります。`,
        `本文が空の節: ${emptySections.map((s) => s.heading).slice(0, 3).join(" / ")}`,
        "本文を書くか、その節を消してください。",
      ),
    );
  }

  // --- 内容の薄さ ---
  const chars = bodyLength(article);
  if (article.stub === undefined && chars < THIN_BODY_CHARS) {
    found.push(
      finding(
        article,
        "thin-content",
        chars === 0 ? "critical" : "warning",
        `本文が ${chars} 文字しかありません。`,
        `sections の総文字数 ${chars} < ${THIN_BODY_CHARS}`,
        "読者が判断するのに要る材料（条件・根拠・例）を足してください。",
      ),
    );
  } else if (article.stub === undefined && article.sections.length < THIN_SECTION_COUNT) {
    found.push(
      finding(
        article,
        "thin-content",
        "info",
        `節が ${article.sections.length} 個しかありません。`,
        `sections.length ${article.sections.length} < ${THIN_SECTION_COUNT}`,
        "話の切れ目で節を分けてください。",
      ),
    );
  }

  // --- サイト内リンク ---
  // 商品を扱っているのに、個別レビューへ辿れる道が 1 本も無い記事だけを見る。
  // 読み物記事に「内部リンクが無い」と言っても直しようがないため。
  const cards = article.productCards ?? [];
  const entries = article.ranking?.entries ?? [];
  const hasProducts = cards.length > 0 || entries.length > 0;
  const linked =
    cards.some((c) => c.reviewSlug !== undefined) ||
    entries.some((e) => e.reviewSlug !== undefined);
  if (hasProducts && !linked) {
    found.push(
      finding(
        article,
        "internal-link",
        "warning",
        "扱っている商品から、詳しいレビュー記事へ辿れません。",
        `商品 ${cards.length + entries.length} 件のうち reviewSlug を持つものが 0 件`,
        "レビュー記事があるものは reviewSlug を繋いでください。",
      ),
    );
  }

  // --- 構造化データ ---
  const faq = article.faq ?? [];
  const brokenFaq = faq.filter((f) => f.question.trim() === "" || f.answer.trim() === "");
  if (brokenFaq.length > 0) {
    found.push(
      finding(
        article,
        "structured-data",
        "critical",
        `問いか答えが空の FAQ が ${brokenFaq.length} 件あります。この記事の FAQ 構造化データは出せません。`,
        `faq[] の空欄 ${brokenFaq.length} / ${faq.length}`,
        "空の項目を埋めるか、その項目を消してください。",
      ),
    );
  }
  if (article.ranking !== undefined && article.ranking.criteria.length === 0) {
    found.push(
      finding(
        article,
        "structured-data",
        "warning",
        "順位記事に評価の基準がありません。順位の根拠を機械にも読者にも示せません。",
        "ranking.criteria.length === 0",
        "何をどう測って順位にしたのかを基準として入れてください。",
      ),
    );
  }

  return found;
}

/** サイト全体を見ないと言えないこと（記事どうしの重複）。 */
function checkAcrossArticles(articles: readonly PublishedArticle[]): readonly Raw[] {
  const byTitle = new Map<string, PublishedArticle[]>();
  for (const article of articles) {
    const key = article.title.trim();
    if (key === "") continue;
    const bucket = byTitle.get(key);
    if (bucket === undefined) byTitle.set(key, [article]);
    else bucket.push(article);
  }

  const found: Raw[] = [];
  for (const [title, bucket] of byTitle) {
    if (bucket.length < 2) continue;
    // 重複は関係する記事すべてに出す。片方だけに出すと、もう片方を
    // 開いた運用者には理由の分からない順位下落だけが残る。
    for (const article of bucket) {
      found.push(
        finding(
          article,
          "title",
          "critical",
          "同じタイトルの記事がこのブログに複数あります。検索側でどちらを出すか決められません。",
          `同一タイトル「${title}」の記事: ${bucket.map((a) => a.slug).join(", ")}`,
          "記事ごとに違う切り口をタイトルへ出してください。",
        ),
      );
    }
  }
  return found;
}

/**
 * 公開記事を読む診断器を作る。
 *
 * 読むのは `archived_at` が null の行だけ。取り下げた記事の指摘を出すと、
 * 直しようのない指摘が一覧に溜まり続ける。
 */
export function createArticleSeoAnalyzer(db: DrizzleD1): SeoAnalyzer {
  return async (workspaceId, target) => {
    const rows = await db
      .select({
        slug: publishedArticles.slug,
        articleJson: publishedArticles.articleJson,
      })
      .from(publishedArticles)
      .where(
        and(
          eq(publishedArticles.workspaceId, String(workspaceId)),
          eq(publishedArticles.siteSlug, target.siteSlug),
          isNull(publishedArticles.archivedAt),
          target.kind === "article" ? eq(publishedArticles.slug, target.articleSlug) : undefined,
        ),
      );

    const articles = rows.map((row) => JSON.parse(row.articleJson) as PublishedArticle);
    const findings = articles.flatMap(checkArticle);

    /*
     * 重複の検査はブログ全体を見たときだけ行う。記事 1 本を指定した
     * 診断でサイト全体を読み直すと、記事を保存するたびに全件走査が
     * 走る。1 本の診断で重複が出ないことは「重複が無い」ではないので、
     * 既存の重複指摘を消さない（保存側が観点ごとに置き換える範囲は
     * 診断した記事に限られる）。
     */
    const crossFindings = target.kind === "site" ? checkAcrossArticles(articles) : [];

    return {
      findings: [...findings, ...crossFindings],
      assessedArticles: articles.length,
    };
  };
}
