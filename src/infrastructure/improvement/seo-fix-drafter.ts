import { and, eq, isNull } from "drizzle-orm";
import { articles, publishedArticles } from "@/db/schema";
import type { SeoDrafter } from "../persistence/d1/seo-assessment-repository";
import type { DrizzleD1 } from "../persistence/d1/link-inbox-repository";

/**
 * 指摘から「直す場所」を特定する側。
 *
 * --- この関数は記事を書き換えない ---
 * 返すのは、その指摘が指している記事の**編集実体の id** である。
 * 本文を機械が書き換えて下書きにする作りにはしていない。指摘は
 * 「タイトルが 74 文字ある」までは機械が確かに言えるが、**では何と
 * 書くべきか**は言えない。そこを機械が埋めると、根拠のある指摘と
 * 根拠のない書き換えが 1 つの操作に混ざり、運用者は結果だけを見て
 * 承認することになる (AD-3 が避けたい形そのもの)。
 *
 * だからここは「編集画面をどこで開けばよいか」を返すところで止める。
 * 指摘の状態が `drafted` になる意味は「直す場所が特定できた」であって、
 * 「文面ができた」ではない。
 *
 * --- 特定できない記事がある ---
 * `published_articles.source_article_id` が null の記事は、編集実体を
 * 通さずに公開されたもの (旧 AI 公開経路) である。この場合は開く場所が
 * 無いので、黙って別の id を返さず失敗させる。存在しない編集画面へ
 * 運用者を送るほうが、断られるより始末が悪い。
 */
export function createSeoFixDrafter(db: DrizzleD1): SeoDrafter {
  return async (workspaceId, finding) => {
    const rows = await db
      .select({ sourceArticleId: publishedArticles.sourceArticleId })
      .from(publishedArticles)
      .where(
        and(
          eq(publishedArticles.workspaceId, String(workspaceId)),
          eq(publishedArticles.siteSlug, finding.siteSlug),
          eq(publishedArticles.slug, finding.articleSlug),
          isNull(publishedArticles.archivedAt),
        ),
      )
      .limit(1);

    const sourceArticleId = rows[0]?.sourceArticleId ?? null;
    if (sourceArticleId === null) {
      throw new Error(
        `記事「${finding.articleSlug}」には編集実体がありません。編集画面から直せないため、下書きを作れません。`,
      );
    }

    // 編集実体が現存し、消されていないことまで確かめる。行が消えていた
    // 場合に id だけ返すと、開いた先が 404 になる。
    const target = await db
      .select({ id: articles.id })
      .from(articles)
      .where(
        and(
          eq(articles.workspaceId, String(workspaceId)),
          eq(articles.id, sourceArticleId),
          isNull(articles.deletedAt),
        ),
      )
      .limit(1);

    if (target[0] === undefined) {
      throw new Error(
        `記事「${finding.articleSlug}」の編集実体が見つかりません。すでに削除された可能性があります。`,
      );
    }

    return { draftRevisionId: target[0].id };
  };
}
