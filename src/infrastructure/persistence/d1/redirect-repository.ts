import { eq } from "drizzle-orm";
import type { ClickTrackingPort, RedirectResolverPort } from "@/application/ports/analytics";
import type { TelemetrySinkPort } from "@/application/ports/telemetry";
import { buildTelemetryEvent } from "@/domain/analytics";
import { type RedirectResolution, isSafeDestination } from "@/domain/monetization";
import { asAffiliateLinkId, asWorkspaceId, ok } from "@/domain/shared";
import { type RedirectResolutionRow, redirectResolutions } from "@/db/schema";
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
