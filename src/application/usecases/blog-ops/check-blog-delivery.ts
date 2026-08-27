import { auditWriteFailure, buildAuditEntry } from "@/application/audit";
import type { BlogOpsRepositoryPort } from "@/application/ports/blog-ops";
import type { IdGeneratorPort } from "@/application/ports/common";
import type { AuditLogPort } from "@/application/ports/compliance";
import { buildRobotsTxt, buildSitemapXml } from "@/application/seo/feeds";
import {
  DELIVERY_PARTS,
  type DeliveryPart,
  type DeliverySnapshot,
  missingDeliveryParts,
  deliveryHealth,
} from "@/domain/blogops";
import { requireCapability } from "@/domain/identity";
import {
  type ActorContext,
  type DomainError,
  type Result,
  err,
  ok,
  validationError,
} from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * 配信物の点検 (受入 A9)。
 *
 * **「出す設定になっている」と「実際に出せる」は別のこと。**
 * `blog_delivery_part` は前者しか持っていない。切り替えを入にしたまま
 * 材料が欠けていても、設定の一覧は何も言わない。ここはその差を埋める。
 *
 * 点検の中身は部品ごとに 2 通りある。**混ぜて 1 語にしない。**
 *
 * 1. **本当に組み立てる**（sitemap・robots）。blogops が持っている
 *    材料だけで最後まで作れるので、作った結果を数えて確かめる。
 * 2. **材料が揃っているかを見る**（残り 7 種）。RSS と llms.txt の
 *    組み立て器は `ArticleSummary`（記事型・分類・要約を持つ別の読み型）を
 *    要求するが、`BlogArticle` はそれを持たない。**持たないものを
 *    それらしく埋めて渡さない。**埋めた瞬間、点検は「自分が作った嘘」を
 *    検査することになり、緑であることが何の保証にもならなくなる。
 *
 * どちらで見たかは `detail` に日本語で残す。一覧を見た運営者が
 * 「何をもって緑なのか」を読めるようにするため。
 */

/** 点検が見る記事 1 本分。`BlogArticle` から必要なぶんだけ写したもの。 */
export type DeliveryCheckArticle = {
  readonly slug: string;
  readonly title: string;
  readonly authorName: string;
  readonly updatedAt: Date;
};

export type DeliveryCheckInput = {
  readonly siteName: string;
  readonly purpose: string;
  readonly origin: string;
  readonly basePath: string;
  readonly emitLlmsTxt: boolean;
  /** 公開済みのものだけ。下書きを数えると sitemap の件数が実物と合わない。 */
  readonly articles: readonly DeliveryCheckArticle[];
};

/** 点検 1 件の結果。`DeliverySnapshot` から時刻を抜いた形（時刻は保存側が付ける）。 */
export type DeliveryCheckResult = {
  readonly part: DeliveryPart;
  readonly ok: boolean;
  readonly detail: string;
};

/** `YYYY-MM-DD`。sitemap の `lastmod` はこの形でないと読み手が日付として扱えない。 */
function isoDate(at: Date): string {
  return at.toISOString().slice(0, 10);
}

function countOf(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

/**
 * 9 種すべてを点検する。**返す件数は必ず 9。**
 *
 * 見られなかった部品を配列から落とすと、一覧の「欠落 0 件」が
 * 「見た範囲では 0 件」に化ける。落とさず `ok: false` で残す。
 */
export function checkDeliveryParts(input: DeliveryCheckInput): readonly DeliveryCheckResult[] {
  const published = input.articles;
  const results = new Map<DeliveryPart, DeliveryCheckResult>();
  const put = (part: DeliveryPart, passed: boolean, detail: string): void => {
    results.set(part, { part, ok: passed, detail });
  };

  // --- 1. 本当に組み立てるもの ---

  const sitemap = buildSitemapXml(
    input.origin,
    input.basePath,
    published.map((a) => ({ path: `/blog/${a.slug}`, updatedAt: isoDate(a.updatedAt) })),
  );
  const urlCount = countOf(sitemap, "<loc>");
  put(
    "sitemap_index",
    urlCount === published.length && published.length > 0,
    published.length === 0
      ? "公開記事が 1 本もないため、住所を 1 つも載せられません。"
      : `組み立てた結果に住所が ${urlCount} 件（公開記事 ${published.length} 本）。`,
  );

  const robots = buildRobotsTxt(input.origin, input.basePath, {
    emitLlmsTxt: input.emitLlmsTxt,
  });
  const hasSitemapLine = robots.includes("Sitemap: ");
  put(
    "robots",
    hasSitemapLine,
    hasSitemapLine
      ? "組み立てた結果に Sitemap の行があります。"
      : "組み立てた結果に Sitemap の行がありません。",
  );

  // --- 2. 材料が揃っているかを見るもの ---

  const hasOrigin = input.origin.trim() !== "";
  put(
    "canonical",
    hasOrigin,
    hasOrigin ? `住所の起点は ${input.origin}${input.basePath} です。` : "住所の起点がありません。",
  );

  const duplicated = published.length - new Set(published.map((a) => a.slug)).size;
  if (duplicated > 0) {
    put("canonical", false, `同じ合言葉の記事が ${duplicated} 本重なっています。`);
  }

  const hasName = input.siteName.trim() !== "";
  const hasPurpose = input.purpose.trim() !== "";
  put(
    "og_twitter_meta",
    hasName && hasPurpose,
    hasName && hasPurpose
      ? "共有時に出すサイト名と説明文が揃っています。"
      : `材料が足りません（${hasName ? "" : "サイト名 "}${hasPurpose ? "" : "説明文"}）。`,
  );

  put(
    "jsonld_website",
    hasName && hasOrigin,
    hasName && hasOrigin
      ? "サイト名と住所の起点が揃っています。"
      : "サイト名か住所の起点が足りません。",
  );

  const namelessAuthors = published.filter((a) => a.authorName.trim() === "").length;
  put(
    "jsonld_article",
    published.length > 0 && namelessAuthors === 0,
    published.length === 0
      ? "公開記事が 1 本もありません。"
      : namelessAuthors === 0
        ? `公開記事 ${published.length} 本すべてに書き手の名前があります。`
        : `書き手の名前が無い記事が ${namelessAuthors} 本あります。`,
  );

  put(
    "jsonld_collection",
    published.length > 0,
    published.length === 0
      ? "一覧に載せる公開記事がありません。"
      : `一覧に載せる公開記事が ${published.length} 本あります。`,
  );

  const untitled = published.filter((a) => a.title.trim() === "").length;
  put(
    "rss_feeds",
    published.length > 0 && untitled === 0,
    published.length === 0
      ? "配る新着がありません。"
      : untitled === 0
        ? `配れる新着が ${published.length} 本あります。`
        : `見出しの無い記事が ${untitled} 本あります。`,
  );

  put(
    "llms_txt",
    input.emitLlmsTxt ? hasPurpose && published.length > 0 : true,
    input.emitLlmsTxt
      ? hasPurpose && published.length > 0
        ? "案内文に載せるサイトの目的と記事が揃っています。"
        : "サイトの目的か記事が足りません。"
      : "この設計図では案内文を出さない設定です。",
  );

  return DELIVERY_PARTS.map((part) => {
    const found = results.get(part);
    // ここに来るのは `DELIVERY_PARTS` に部品が増えて `put` を書き忘れたとき。
    // 黙って緑にすると、増えた部品だけ誰も見ていない状態が一覧では見えない。
    return found ?? { part, ok: false, detail: "この部品の点検はまだ書かれていません。" };
  });
}

export type ManageBlogDeliveryDeps = {
  readonly repository: BlogOpsRepositoryPort;
  readonly ids: IdGeneratorPort;
  readonly auditLog: AuditLogPort;
  readonly now: () => Date;
};

export type CheckBlogDeliveryInput = {
  readonly siteSlug: string;
  readonly siteName: string;
  readonly purpose: string;
  readonly origin: string;
  readonly basePath: string;
  readonly emitLlmsTxt: boolean;
};

export type CheckBlogDeliveryOutput = {
  readonly checked: number;
  readonly missing: readonly DeliveryPart[];
};

export function createCheckBlogDeliveryUseCase(
  deps: ManageBlogDeliveryDeps,
): UseCase<CheckBlogDeliveryInput, CheckBlogDeliveryOutput> {
  return {
    async execute(
      actor: ActorContext,
      input: CheckBlogDeliveryInput,
    ): Promise<Result<CheckBlogDeliveryOutput, DomainError>> {
      const allowed = requireCapability(actor, "site.manage", "配信物の点検");
      if (!allowed.ok) return allowed;
      if (input.origin.trim() === "") {
        /*
          **欄の名前を付けない。**`origin` は運営者が書く欄ではなく、
          届いたリクエストの `host` から作る値である。欄の名前を付けると
          画面は「その欄を赤くする」ことを求められるが、赤くする欄が無い。
          名前の無い断りとして出せば、画面は文をそのまま見せられる。
        */
        return err(validationError("配信物の点検には住所の起点が要ります。"));
      }

      const articles = await deps.repository.listArticles(actor.workspaceId, input.siteSlug);
      if (!articles.ok) return articles;

      const results = checkDeliveryParts({
        siteName: input.siteName,
        purpose: input.purpose,
        origin: input.origin,
        basePath: input.basePath,
        emitLlmsTxt: input.emitLlmsTxt,
        articles: articles.value
          .filter((a) => a.status === "published")
          .map((a) => ({
            slug: a.slug,
            title: a.title,
            authorName: a.authorName,
            updatedAt: a.updatedAt,
          })),
      });

      const checkedAt = deps.now();
      for (const result of results) {
        const saved = await deps.repository.saveDeliverySnapshot(actor.workspaceId, {
          id: `bds_${deps.ids.newId()}`,
          siteSlug: input.siteSlug,
          part: result.part,
          ok: result.ok,
          detail: result.detail,
          checkedAt,
        });
        if (!saved.ok) return saved;
      }

      const snapshots: readonly DeliverySnapshot[] = results.map((r) => ({
        part: r.part,
        ok: r.ok,
        checkedAt,
        detail: r.detail,
      }));
      const parts = await deps.repository.listDeliveryParts(actor.workspaceId, input.siteSlug);
      if (!parts.ok) return parts;
      const missing = missingDeliveryParts(deliveryHealth(parts.value, snapshots));

      const entry = buildAuditEntry(deps, actor, {
        action: "blog_delivery.checked",
        targetType: "blog_delivery_snapshot",
        targetId: input.siteSlug,
        before: null,
        after: { checked: results.length, missing: missing.length },
      });
      if (!entry.ok) return entry;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(
          auditWriteFailure("配信物を点検しました", { siteSlug: input.siteSlug }),
        );
      }

      return ok({ checked: results.length, missing });
    },
  };
}
