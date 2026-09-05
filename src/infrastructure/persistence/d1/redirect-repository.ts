import { and, eq, isNull } from "drizzle-orm";
import type {
  ClickTrackingPort,
  RedirectResolverPort,
  TrackingCoveragePort,
  TrackingLinkIssuerPort,
} from "@/application/ports/analytics";
import type { TelemetrySinkPort } from "@/application/ports/telemetry";
import {
  type OutboundLink,
  countTrackingCoverage,
} from "@/application/read-models/article-tracking";
import type { PublishedArticle } from "@/application/read-models/published-article";
import { buildTelemetryEvent } from "@/domain/analytics/telemetry-events";
import { type RedirectResolution, isSafeDestination } from "@/domain/monetization";
import { asAffiliateLinkId, asWorkspaceId, ok } from "@/domain/shared";
import {
  type RedirectResolutionRow,
  publishedArticles,
  redirectResolutions,
} from "@/db/schema";
import type { DrizzleD1 } from "./link-inbox-repository";
import { storageFailure } from "./storage-failure";

/**
 * 転送の写しの読み口と、クリックの記録先（D1）。
 *
 * **これはスタブではない。** `/go/<合言葉>` が実際に読む実装である。
 *
 * --- 読みと記録を同じファイルに置いている理由 ---
 * どちらも `redirect_resolutions` の 1 行から作られる。別ファイルにすると、
 * 列を 1 つ変えたときに片方だけ直り、「転送はできるのに記録が空」になる。
 * これは画面からは正常に見えるため、気づくのは月次を見たときになる。
 *
 * --- クリックを専用の表に貯めない ---
 * 記録先は `telemetry_events` の `affiliate_click` である。画面から送るクリックが
 * すでに同じ表へ入っているので、専用の表を足すと同じ「クリック数」が 2 つでき、
 * 食い違ったときにどちらが正しいか決められない
 * （残課題 25「事実だけを貯め、指標は毎回導く」）。
 *
 * 規範: docs/spec/03-分析・解析基盤仕様.md §1.1 / §1.2
 */

/** 行 → ドメイン。転送先が https でない行は**転送に使わせない**。 */
function toDomain(row: RedirectResolutionRow): RedirectResolution {
  return {
    code: row.code,
    workspaceId: asWorkspaceId(row.workspaceId),
    affiliateLinkId: asAffiliateLinkId(row.affiliateLinkId),
    destinationUrl: row.destinationUrl,
    siteSlug: row.siteSlug,
    articlePath: row.articlePath,
    placement: row.placement,
    productId: row.productId,
    state: row.state,
    expiresAt: row.expiresAt,
  };
}

export function createD1RedirectResolver(db: DrizzleD1): RedirectResolverPort {
  return {
    async resolve(code) {
      try {
        const rows = await db
          .select()
          .from(redirectResolutions)
          .where(eq(redirectResolutions.code, code))
          .limit(1);
        const row = rows[0];
        // 知らない合言葉は失敗ではなく null。古いリンクや打ち間違いは
        // 転送経路にとって普通のことで、保存先の障害と区別する必要がある。
        if (row === undefined) return ok(null);
        return ok(toDomain(row));
      } catch (cause) {
        return storageFailure("転送先の読み取り", cause);
      }
    },
  };
}

/**
 * 合言葉を作る。
 *
 * **推測できない値にする。** 連番や商品 ID から作ると、少し変えるだけで
 * 他人のリンクを引ける。`/go/` 側の形の検査（`^[a-z0-9]{6,32}$`）に
 * 収まる範囲で、乱数から作る。
 */
function newCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let out = "";
  for (const b of bytes) out += (b % 36).toString(36);
  return out;
}

/**
 * 転送先 URL から、その成果リンクを指す ID を作る。
 *
 * **`affiliate_links` の表がまだ無いための、はっきりした仮置きである。**
 * 表ができたらその ID に差し替える。URL そのものを ID にすると、
 * 計測の記録（`linkId`）に ASP の URL が丸ごと入り、集計の鍵として長すぎる。
 * 同じ URL からは必ず同じ値が出るので、記事をまたいで同じ商品リンクを
 * 束ねて数えられる。
 */
function linkIdForUrl(url: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < url.length; i += 1) {
    hash ^= url.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `lnk_${hash.toString(16).padStart(8, "0")}`;
}

/**
 * 公開のときに、記事に載る外向きリンクぶんの写しを作る。
 *
 * --- 同じ位置・同じ転送先なら作り直さない ---
 * 記事を出し直すたびに合言葉を作ると、**同じリンクのクリックが版ごとに割れ**、
 * どの数字も実数より少なく出る。位置（記事の道・置き場所・商品）が同じで
 * 転送先も同じなら、すでにある合言葉をそのまま返す。
 *
 * --- 転送先が変わったときだけ新しく発行する ---
 * 写しを上書きすると、古い合言葉が新しい転送先へ飛ぶ。過去に配った URL の
 * 行き先が黙って変わることになるので、上書きせず**古い写しを停止**にして
 * 新しい合言葉を発行する（仕様 §1.1「転送先原本は不変。差し替え時は新規発行」）。
 */
export function createD1TrackingLinkIssuer(db: DrizzleD1): TrackingLinkIssuerPort {
  /** その記事のその位置に、いま何が置かれているか。 */
  async function findSlot(
    workspaceId: string,
    link: OutboundLink,
  ): Promise<RedirectResolutionRow | undefined> {
    const rows = await db
      .select()
      .from(redirectResolutions)
      .where(
        and(
          eq(redirectResolutions.workspaceId, workspaceId),
          eq(redirectResolutions.siteSlug, link.siteSlug),
          eq(redirectResolutions.articlePath, link.articlePath),
          eq(redirectResolutions.placement, link.placement),
          link.productId === null
            ? isNull(redirectResolutions.productId)
            : eq(redirectResolutions.productId, link.productId),
          eq(redirectResolutions.state, "active"),
        ),
      )
      .limit(1);
    return rows[0];
  }

  return {
    async issue(workspaceId, links) {
      const issued = new Map<string, string>();
      try {
        const owner = String(workspaceId);
        for (const link of links) {
          // 保存する前に確かめる。ここを通すと、押した読者だけが気づく形で
          // 使えない転送先が貯まる（転送の直前でも同じ検査をしている）。
          if (!isSafeDestination(link.destinationUrl)) continue;

          const existing = await findSlot(owner, link);
          if (existing !== undefined && existing.destinationUrl === link.destinationUrl) {
            issued.set(link.slotKey, existing.code);
            continue;
          }
          if (existing !== undefined) {
            await db
              .update(redirectResolutions)
              .set({ state: "disabled" })
              .where(eq(redirectResolutions.code, existing.code));
          }
          const code = newCode();
          await db.insert(redirectResolutions).values({
            code,
            // ★ ここが「持ち主側の作業場所」。読者の身元は届かない
            //   （引数で受け取り、この関数の中では作らない）。
            workspaceId: owner,
            affiliateLinkId: linkIdForUrl(link.destinationUrl),
            destinationUrl: link.destinationUrl,
            siteSlug: link.siteSlug,
            articlePath: link.articlePath,
            placement: link.placement,
            productId: link.productId,
            state: "active",
          });
          issued.set(link.slotKey, code);
        }
        return ok(issued as ReadonlyMap<string, string>);
      } catch (cause) {
        return storageFailure("転送の写しの発行", cause);
      }
    },
  };
}

/**
 * 突合できるようになっている割合を、**実際に読者へ出している記事から**数える。
 *
 * 発行の記録（`redirect_resolutions`）の側から数えない。写しがあっても、
 * 記事の側に合言葉が入っていなければ読者は ASP の URL を踏む。
 * 読者が見ているものを数えないと、「発行済み 100 件」と出たまま
 * 実際のクリックは 1 件も記録されない、という読み方ができてしまう。
 */
export function createD1TrackingCoverage(db: DrizzleD1): TrackingCoveragePort {
  return {
    async summarize(workspaceId) {
      try {
        const rows = await db
          .select({ articleJson: publishedArticles.articleJson })
          .from(publishedArticles)
          .where(eq(publishedArticles.workspaceId, String(workspaceId)));
        const articles = rows.map((r) => JSON.parse(r.articleJson) as PublishedArticle);
        return ok(countTrackingCoverage(articles));
      } catch (cause) {
        return storageFailure("突合できるリンクの数え上げ", cause);
      }
    },
  };
}

/**
 * 転送の入口で押されたことを記録する。
 *
 * `TelemetrySinkPort` の上に薄く載せている。**ここが薄いことに意味がある。**
 * 「転送で押された 1 回は `affiliate_click` 1 件になる」という決めを
 * この 1 箇所だけが持つので、二重計上の検査をここへ固定できる。
 */
export function createRedirectClickTracking(deps: {
  readonly telemetry: TelemetrySinkPort;
}): ClickTrackingPort {
  return {
    async recordClick({ resolution, occurredAt }) {
      if (!isSafeDestination(resolution.destinationUrl)) {
        // 転送していないものを「押された」として数えない。
        // ここを通す実装にすると、転送が 410 で終わった回数まで
        // クリック数に混ざり、成果率が実際より低く出る。
        return storageFailure("クリックの記録", new Error("unsafe destination"));
      }
      const built = buildTelemetryEvent({
        key: "affiliate_click",
        occurredAt,
        // 誰が押したかは持たない（`consent: none` の約束）。
        readerKey: null,
        payload: {
          path: resolution.articlePath,
          siteSlug: resolution.siteSlug,
          linkId: String(resolution.affiliateLinkId),
          productId: resolution.productId ?? undefined,
          placement: resolution.placement,
          recordedVia: "redirect",
        },
      });
      if (!built.ok) return built;
      const written = await deps.telemetry.recordBatch(resolution.workspaceId, [built.value]);
      if (!written.ok) return written;
      return ok(true);
    },
  };
}
