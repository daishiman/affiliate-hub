import type { TrackingCoveragePort } from "@/application/ports/analytics";
import type {
  EditorialPublishedArticleAdminPort,
  EditorialPublishedArticleWriterPort,
  EditorialPublishedContentPort,
  EditorialSiteDocumentRepositoryPort,
} from "@/application/ports/site";
import { countTrackingCoverage } from "@/application/read-models/article-tracking";
import { SITE_DOCUMENT_KEYS, type SiteDocumentKey } from "@/domain/authoring";
import { markEditorial, ok, type WorkspaceId } from "@/domain/shared";
import { stubCall } from "../../stub-registry";
import {
  CONTENT_SAMPLE_STUB,
  SAMPLE_ARTICLES,
  SAMPLE_CORRECTIONS,
  SAMPLE_PEOPLE,
  resolveSampleSiteDocument,
  sampleArticleSummaries,
  sampleArticlesBySite,
} from "./content-sample-data";
import { SAMPLE_WORKSPACE_ID } from "./sample-identity";

/** 見本の記事であることを画面に出すための一文。 */
export function sampleContentNotice(): string {
  return `${CONTENT_SAMPLE_STUB.label}で表示しています（${CONTENT_SAMPLE_STUB.blockedBy}が済むまでの仮です）。`;
}

/**
 * 記事を出す口の、保存先が無いとき用。
 *
 * **成功を返さない。** 出したのに読者ページに出ない状態を「公開しました」と
 * 言うのが、いちばん取り返しのつかない壊れ方になる。
 */
/**
 * 突合できるリンクの数え上げ（保存先が無い実行での控え）。
 *
 * **ここは失敗させず、実際の見本記事から数える。** 見本の記事は読者ページに
 * そのまま出ており、一部だけが合言葉を持っている。つまり保存先が無い実行では
 * 「順位表に出ている成果リンクのうち、まだ突合できないものが何件あるか」に
 * 正しい答えが出る。失敗を返すと、その事実が「確認できません」に化けて見えなくなる。
 *
 * 記事の一覧（`SAMPLE_ARTICLES`）を入力にするので、見本記事を足したときに
 * 数え上げだけ古いままにならない。
 */
export function createSampleTrackingCoverage(): TrackingCoveragePort {
  return {
    async summarize() {
      return ok(countTrackingCoverage(SAMPLE_ARTICLES));
    },
  };
}

/**
 * 固定文書の見本。
 *
 * 読むほうは本物と同じ形で返す（見本の実行でも法定ページが読める）。
 * **書くほうは「保存できない」と名乗る。** ここで成功を返すと、
 * 運営者情報を書き換えたつもりの人が、次に開いたとき元の文を見ることになる。
 */
export function createSampleSiteDocumentRepository(): EditorialSiteDocumentRepositoryPort {
  return markEditorial({
    async listBySite(_workspaceId: WorkspaceId, siteSlug: string) {
      return ok(
        SITE_DOCUMENT_KEYS.map((key) => ({
          key,
          ...resolveSampleSiteDocument(siteSlug, key),
          // 見本に「いつ直したか」は無い。作り話の日付を入れない。
          updatedAt: null,
        })),
      );
    },
    async save() {
      return stubCall<true>(CONTENT_SAMPLE_STUB, "固定ページの保存");
    },
  });
}

export function createSamplePublishedArticleWriter(): EditorialPublishedArticleWriterPort {
  return markEditorial({
    async save() {
      return stubCall<true>(CONTENT_SAMPLE_STUB, "記事の公開");
    },
    async unpublish() {
      return stubCall<true>(CONTENT_SAMPLE_STUB, "記事の取り下げ");
    },
  });
}

/** D1 が無い開発実行で、公開済みを書き換えたふりをしない口。 */
export function createSamplePublishedArticleAdminRepository(): EditorialPublishedArticleAdminPort {
  return markEditorial({
    async list(workspaceId) {
      return ok(
        workspaceId === SAMPLE_WORKSPACE_ID
          ? SAMPLE_ARTICLES.map((article) => ({ article, archivedAt: null }))
          : [],
      );
    },
    async find(workspaceId, siteSlug, slug) {
      if (workspaceId !== SAMPLE_WORKSPACE_ID) return ok(null);
      const article = SAMPLE_ARTICLES.find(
        (item) => item.siteSlug === siteSlug && item.slug === slug,
      );
      return ok(article === undefined ? null : { article, archivedAt: null });
    },
    async replace() {
      return stubCall<boolean>(CONTENT_SAMPLE_STUB, "公開済み記事の訂正");
    },
    async archive() {
      return stubCall<boolean>(CONTENT_SAMPLE_STUB, "公開済み記事の非表示化");
    },
  });
}

export function createSampleContentRepository(): EditorialPublishedContentPort {
  return markEditorial({
    async listRecent(siteSlug: string, limit: number) {
      const sorted = [...sampleArticlesBySite(siteSlug)].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      );
      return ok(sampleArticleSummaries(sorted.slice(0, limit)));
    },
    async listByCategory(siteSlug: string, categorySlug: string) {
      return ok(
        sampleArticleSummaries(
          sampleArticlesBySite(siteSlug).filter((a) => a.categorySlug === categorySlug),
        ),
      );
    },
    async findArticle(siteSlug: string, slug: string) {
      return ok(sampleArticlesBySite(siteSlug).find((a) => a.slug === slug) ?? null);
    },
    async search(siteSlug: string, query: string, limit: number) {
      // 見本なので単純な部分一致。全文検索は保存先ができてから差し替える。
      const q = query.toLowerCase();
      const hit = sampleArticlesBySite(siteSlug).filter(
        (a) => a.title.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q),
      );
      return ok(sampleArticleSummaries(hit.slice(0, limit)));
    },
    async findPerson(siteSlug: string, kind: "author" | "expert", slug: string) {
      return ok(
        SAMPLE_PEOPLE.find(
          (p) => p.siteSlug === siteSlug && p.kind === kind && p.person.slug === slug,
        )?.person ?? null,
      );
    },
    async listByPerson(
      siteSlug: string,
      kind: "author" | "expert",
      personSlug: string,
    ) {
      return ok(
        sampleArticleSummaries(
          sampleArticlesBySite(siteSlug).filter(
            (a) =>
              (kind === "author" ? a.author.slug : a.reviewedBy?.slug) === personSlug,
          ),
        ),
      );
    },
    async listCorrections(siteSlug: string) {
      return ok(SAMPLE_CORRECTIONS.filter((c) => c.siteSlug === siteSlug));
    },
    async findPolicyDocument(siteSlug: string, key: string) {
      // ルート表に無い鍵は、上書きも既定も引かずに「無い」と答える。
      // 既定側を任意の文字列で引けるままにすると、綴り違いが黙って null になり、
      // 「画面はあるのに文書が出ない」の原因がルート表かデータか分からなくなる。
      if (!(SITE_DOCUMENT_KEYS as readonly string[]).includes(key)) return ok(null);
      const documentKey = key as SiteDocumentKey;
      return ok(resolveSampleSiteDocument(siteSlug, documentKey));
    },
  });
}
