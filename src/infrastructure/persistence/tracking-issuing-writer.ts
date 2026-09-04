import type { TrackingLinkIssuerPort } from "@/application/ports/analytics";
import type { EditorialPublishedArticleWriterPort } from "@/application/ports/site";
import {
  applyTrackingCodes,
  collectOutboundLinks,
} from "@/application/read-models/article-tracking";
import { markEditorial, type WorkspaceId } from "@/domain/shared";
import type { PublishedArticle } from "@/application/read-models/published-article";

/**
 * 記事を出すときに、成果リンクぶんの合言葉を発行してから保存する。
 *
 * --- なぜ公開の手続き（use case）ではなくここに置くのか ---
 * 記事を出す口は `PublishedArticleWriterPort.save(workspaceId, article)` の
 * **1 つだけ**で、公開の手続きも配信の画面もそこを通る。ここで包むと、
 * 出す経路が増えても合言葉の発行が漏れない。手続き側に書くと、
 * 別の経路から出したときだけ合言葉が無い記事ができ、
 * その記事のクリックだけが数えられなくなる（画面は正常に見える）。
 *
 * --- 作業場所の取り違えを、構造で起こらなくする ---
 * 写しに書く作業場所は `save` の引数の `workspaceId` をそのまま使う。
 * これは**そのブログを持っている側**のものである。この関数は身元を作らないので、
 * 読者の身元（所属なし = `ws_public`）が写しへ入る経路が存在しない。
 *
 * 残課題 25 と 56 で 2 回起きたのは「記録は貯まるのに管理画面が 0」で、
 * 画面が正常に見えるぶん、いちばん切り分けにくい壊れ方だった。
 * **3 回目は、条件式ではなく引数の出どころで止める。**
 *
 * --- 発行に失敗しても公開は止めない ---
 * 計測は記事より後から足せるが、公開できない記事は取り返しがつかない。
 * 失敗したときは合言葉の無いまま保存し、順位表は ASP の URL を出す
 * （読者の買う導線は消えない）。**黙って消えないよう**、
 * 発行できていない件数は `TrackingCoveragePort` から数えられる。
 */
export function withTrackingLinkIssuance(
  writer: EditorialPublishedArticleWriterPort,
  issuer: TrackingLinkIssuerPort,
): EditorialPublishedArticleWriterPort {
  return markEditorial({
    async save(workspaceId: WorkspaceId, article: PublishedArticle) {
      const links = collectOutboundLinks(article).filter((l) => l.trackingCode === null);
      if (links.length === 0) return writer.save(workspaceId, article);

      const issued = await issuer.issue(workspaceId, links);
      // 失敗をここで握りつぶすのは、上のコメントに書いた 1 点のためだけである。
      // 握りつぶした事実は数え上げ（未発行の件数）に必ず現れる。
      if (!issued.ok) return writer.save(workspaceId, article);
      return writer.save(workspaceId, applyTrackingCodes(article, issued.value));
    },
    unpublish(workspaceId: WorkspaceId, siteSlug: string, slug: string) {
      return writer.unpublish(workspaceId, siteSlug, slug);
    },
  });
}
