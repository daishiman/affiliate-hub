import { and, asc, between, desc, eq, gte, inArray, lte, sql, type AnyColumn } from "drizzle-orm";
import type {
  AudienceBreakdown,
  AudienceDaily,
  BlogAudiencePort,
  BlogRevenuePort,
  CommercialBlogRevenuePort,
  EditorialBlogAudiencePort,
  EditorialReaderInteractionIntakePort,
  EngagementProfile,
  MetricsRange,
  MetricsRollupPort,
  ReaderInteractionIntakePort,
} from "@/application/ports";
import { READER_SEGMENTS, VIEWPORT_BANDS, toRollupDay, type DailyMetrics, type ReaderSegment, type ViewportBand } from "@/domain/analytics/reader-interaction";
import {
  markCommercial,
  markEditorial,
  ok,
  taggedString,
  type WorkspaceId,
} from "@/domain/shared";
import {
  articleDailyMetrics,
  readerInteractionEvents,
  siteDailyMetrics,
  type ArticleDailyMetricRow,
  type SiteDailyMetricRow,
} from "@/db/schema";
import type { DrizzleD1 } from "./link-inbox-repository";
import { storageFailure } from "./storage-failure";

/**
 * 読者行動の観測と日次集計の保存先 (D1・観測層)。
 *
 * **この集計が書くのは読者側の列だけである。** `revenue_minor` と
 * `conversions` は成果側の経路が書き、ロールアップは触らない。同じ行に
 * 同居させておきながら書き手を分けるのは、集計を何度やり直しても売上が
 * 変わらないようにするためで、読者側の再集計が成果の記録を消さない。
 *
 * 読み口は 2 つに割ってある (`BlogAudiencePort` / `BlogRevenuePort`)。
 * 表を分けないのは AD-2 のため、口を分けるのは §12.3 のためで、
 * どちらの要求も落とさない形がこれになる。
 */

/** `YYYY-MM-DD` の期間で日次行を絞る。両端を含む。 */
function inRange(column: AnyColumn, range: MetricsRange) {
  return and(gte(column, range.from), lte(column, range.to));
}

function toDaily(row: SiteDailyMetricRow | ArticleDailyMetricRow): DailyMetrics {
  return {
    day: row.day,
    views: row.views,
    uniqueSessions: row.uniqueSessions,
    clicks: row.clicks,
    conversions: row.conversions,
    revenueMinor: row.revenueMinor,
    averageDwellSeconds: row.averageDwellSeconds,
    averageScrollRatio: row.averageScrollRatio,
    sampleCount: row.sampleCount,
  };
}

/** 売上列を落とす。編集判断へ渡してよい形にするのはここ 1 か所。 */
function toAudience(row: SiteDailyMetricRow | ArticleDailyMetricRow): AudienceDaily {
  const { revenueMinor: _revenue, ...rest } = toDaily(row);
  return rest;
}

/** ヒートマップの区間数。10 分割は「上から 1 割ずつ」で読める粒度。 */
const ENGAGEMENT_BUCKETS = 10;

export function createD1ReaderInteractionIntake(deps: {
  readonly db: DrizzleD1;
  /** @deprecated event ID は producer が一度だけ付ける。既存の組み立て互換用。 */
  readonly newId?: () => string;
}): EditorialReaderInteractionIntakePort {
  const { db } = deps;

  const port: ReaderInteractionIntakePort = {
    async record(workspaceId, events) {
      if (events.length === 0) return ok({ accepted: 0 });
      try {
        const rows = events.map((event) => ({
          id: event.eventId,
          workspaceId: String(workspaceId),
          siteSlug: event.siteSlug,
          articleSlug: event.articleSlug,
          kind: event.kind,
          segment: event.segment,
          viewportBand: event.viewportBand,
          positionRatio: event.positionRatio,
          dwellSeconds: event.dwellSeconds,
          elementKey: event.elementKey,
          sessionKey: event.sessionKey,
          /*
           * 対象日は受け取った時刻から導出し、送信側に決めさせない。
           * 端末の時計はずれる。ずれた日付をそのまま鍵にすると、
           * 集計が「無い日」に書かれて画面から消える。
           */
          rollupDay: toRollupDay(event.occurredAt),
          occurredAt: event.occurredAt,
        }));
        const inserted = await db
          .insert(readerInteractionEvents)
          .values(rows)
          .onConflictDoNothing()
          .returning({ id: readerInteractionEvents.id });
        return ok({ accepted: inserted.length });
      } catch (cause) {
        return storageFailure("読者行動の記録", cause);
      }
    },
  };

  return markEditorial(port);
}

export function createD1MetricsRollup(db: DrizzleD1): MetricsRollupPort {
  return {
    async pendingDays(days, limit) {
      if (days.length === 0) return ok([]);
      try {
        const rows = await db
          .selectDistinct({
            workspaceId: readerInteractionEvents.workspaceId,
            siteSlug: readerInteractionEvents.siteSlug,
            day: readerInteractionEvents.rollupDay,
          })
          .from(readerInteractionEvents)
          .where(inArray(readerInteractionEvents.rollupDay, [...days]))
          .orderBy(
            asc(readerInteractionEvents.rollupDay),
            asc(readerInteractionEvents.workspaceId),
            asc(readerInteractionEvents.siteSlug),
          )
          .limit(limit);
        return ok(
          rows.map((row) => ({
            workspaceId: taggedString<"WorkspaceId">(row.workspaceId) as WorkspaceId,
            siteSlug: row.siteSlug,
            day: row.day,
          })),
        );
      } catch (cause) {
        return storageFailure("集計対象の数え上げ", cause);
      }
    },

    async rollupDay(workspaceId, siteSlug, day) {
      try {
        const scope = and(
          eq(readerInteractionEvents.workspaceId, String(workspaceId)),
          eq(readerInteractionEvents.siteSlug, siteSlug),
          eq(readerInteractionEvents.rollupDay, day),
        );

        /*
         * 集計は SQL 側で畳む。生イベントを JS へ引き出すと、1 日ぶんが
         * 数十万行になったときに Worker の実行時間に収まらない。
         */
        const views = sql<number>`sum(case when ${readerInteractionEvents.kind} = 'view' then 1 else 0 end)`;
        const clicks = sql<number>`sum(case when ${readerInteractionEvents.kind} = 'click' then 1 else 0 end)`;
        const uniqueSessions = sql<number>`count(distinct ${readerInteractionEvents.sessionKey})`;
        // 滞在と読み進みは、その種類の行だけの平均。全体で割ると
        // 表示イベントの 0 に引きずられて、常に小さい値になる。
        const dwell = sql<number>`coalesce(avg(case when ${readerInteractionEvents.kind} = 'dwell' then ${readerInteractionEvents.dwellSeconds} end), 0)`;
        const scroll = sql<number>`coalesce(avg(case when ${readerInteractionEvents.kind} = 'scroll' then ${readerInteractionEvents.positionRatio} end), 0)`;
        /*
         * 種類を問わない全件数。示唆を出してよいかの足切りに使う。
         * 生イベントは 90 日で消えるので、ここで数えておかないと
         * 古い日については二度と数えられない。
         */
        const sampleCount = sql<number>`count(*)`;

        const siteRows = await db
          .select({
            views,
            clicks,
            uniqueSessions,
            averageDwellSeconds: dwell,
            averageScrollRatio: scroll,
            sampleCount,
          })
          .from(readerInteractionEvents)
          .where(scope);

        const now = new Date();
        const site = siteRows[0];
        const siteValues = {
          views: Number(site?.views ?? 0),
          clicks: Number(site?.clicks ?? 0),
          uniqueSessions: Number(site?.uniqueSessions ?? 0),
          averageDwellSeconds: Number(site?.averageDwellSeconds ?? 0),
          averageScrollRatio: Number(site?.averageScrollRatio ?? 0),
          sampleCount: Number(site?.sampleCount ?? 0),
          computedAt: now,
        };

        const articleRows = await db
          .select({
            articleSlug: readerInteractionEvents.articleSlug,
            views,
            clicks,
            uniqueSessions,
            averageDwellSeconds: dwell,
            averageScrollRatio: scroll,
            sampleCount,
          })
          .from(readerInteractionEvents)
          .where(and(scope, sql`${readerInteractionEvents.articleSlug} is not null`))
          .groupBy(readerInteractionEvents.articleSlug);

        const elementRows = await db
          .select({
            articleSlug: readerInteractionEvents.articleSlug,
            elementKey: readerInteractionEvents.elementKey,
            clicks: sql<number>`count(*)`,
          })
          .from(readerInteractionEvents)
          .where(
            and(
              scope,
              eq(readerInteractionEvents.kind, "click"),
              sql`${readerInteractionEvents.articleSlug} is not null`,
              sql`${readerInteractionEvents.elementKey} is not null`,
            ),
          )
          .groupBy(readerInteractionEvents.articleSlug, readerInteractionEvents.elementKey);

        const byArticle = new Map<string, Record<string, number>>();
        for (const row of elementRows) {
          if (row.articleSlug === null || row.elementKey === null) continue;
          const bucket = byArticle.get(row.articleSlug) ?? {};
          bucket[row.elementKey] = Number(row.clicks);
          byArticle.set(row.articleSlug, bucket);
        }

        /*
         * 置き換えで書く。`set` に売上と成果を含めないのが要点で、
         * 含めると再集計のたびに成果側の記録が既定値へ戻る。
         */
        const statements = [
          db
            .insert(siteDailyMetrics)
            .values({ workspaceId: String(workspaceId), siteSlug, day, ...siteValues })
            .onConflictDoUpdate({
              target: [
                siteDailyMetrics.workspaceId,
                siteDailyMetrics.siteSlug,
                siteDailyMetrics.day,
              ],
              set: siteValues,
            }),
          ...articleRows.flatMap((row) => {
            if (row.articleSlug === null) return [];
            const values = {
              views: Number(row.views),
              clicks: Number(row.clicks),
              uniqueSessions: Number(row.uniqueSessions),
              averageDwellSeconds: Number(row.averageDwellSeconds),
              averageScrollRatio: Number(row.averageScrollRatio),
              clicksByElement: JSON.stringify(byArticle.get(row.articleSlug) ?? {}),
              sampleCount: Number(row.sampleCount),
              computedAt: now,
            };
            return [
              db
                .insert(articleDailyMetrics)
                .values({
                  workspaceId: String(workspaceId),
                  siteSlug,
                  articleSlug: row.articleSlug,
                  day,
                  ...values,
                })
                .onConflictDoUpdate({
                  target: [
                    articleDailyMetrics.workspaceId,
                    articleDailyMetrics.siteSlug,
                    articleDailyMetrics.articleSlug,
                    articleDailyMetrics.day,
                  ],
                  set: values,
                }),
            ];
          }),
        ];

        // 1 日ぶんをまとめて書く。ブログ側だけ更新されて記事側が
        // 古いままになると、合計と内訳が合わない画面ができる。
        await db.batch(statements as [(typeof statements)[number], ...typeof statements]);
        return ok(true as const);
      } catch (cause) {
        return storageFailure("日次集計", cause);
      }
    },

    async purgeExpiredEvents(before) {
      try {
        const deleted = await db
          .delete(readerInteractionEvents)
          .where(lte(readerInteractionEvents.occurredAt, before))
          .returning({ id: readerInteractionEvents.id });
        return ok({ deleted: deleted.length });
      } catch (cause) {
        return storageFailure("生イベントの掃除", cause);
      }
    },
  };
}

export function createD1BlogAudienceRepository(db: DrizzleD1): EditorialBlogAudiencePort {
  const port: BlogAudiencePort = {
    async siteDaily(workspaceId, siteSlug, range) {
      try {
        const rows = await db
          .select()
          .from(siteDailyMetrics)
          .where(
            and(
              eq(siteDailyMetrics.workspaceId, String(workspaceId)),
              eq(siteDailyMetrics.siteSlug, siteSlug),
              inRange(siteDailyMetrics.day, range),
            ),
          )
          .orderBy(asc(siteDailyMetrics.day));
        return ok(rows.map(toAudience));
      } catch (cause) {
        return storageFailure("ブログの日次集計の読み出し", cause);
      }
    },

    async articleDaily(workspaceId, siteSlug, articleSlug, range) {
      try {
        const rows = await db
          .select()
          .from(articleDailyMetrics)
          .where(
            and(
              eq(articleDailyMetrics.workspaceId, String(workspaceId)),
              eq(articleDailyMetrics.siteSlug, siteSlug),
              eq(articleDailyMetrics.articleSlug, articleSlug),
              inRange(articleDailyMetrics.day, range),
            ),
          )
          .orderBy(asc(articleDailyMetrics.day));
        return ok(rows.map(toAudience));
      } catch (cause) {
        return storageFailure("記事の日次集計の読み出し", cause);
      }
    },

    async breakdown(workspaceId, siteSlug, range) {
      try {
        /*
         * 内訳だけは生イベントから引く。日次集計に持たせると、
         * 来歴 × 画面幅 の組み合わせぶん列が要る。90 日より前の
         * 内訳が見られなくなるのは、この設計で引き受ける制約。
         */
        const scope = and(
          eq(readerInteractionEvents.workspaceId, String(workspaceId)),
          eq(readerInteractionEvents.siteSlug, siteSlug),
          eq(readerInteractionEvents.kind, "view"),
          between(readerInteractionEvents.rollupDay, range.from, range.to),
        );
        const [segments, viewports] = await Promise.all([
          db
            .select({
              key: readerInteractionEvents.segment,
              count: sql<number>`count(*)`,
            })
            .from(readerInteractionEvents)
            .where(scope)
            .groupBy(readerInteractionEvents.segment),
          db
            .select({
              key: readerInteractionEvents.viewportBand,
              count: sql<number>`count(*)`,
            })
            .from(readerInteractionEvents)
            .where(scope)
            .groupBy(readerInteractionEvents.viewportBand),
        ]);

        /*
         * 観測が 0 の区分も 0 で埋めて返す。欠けたまま返すと、
         * 画面側が「まだ集まっていない」のか「その経路で誰も来ていない」
         * のかを描き分けられない。
         */
        const bySegment = Object.fromEntries(
          READER_SEGMENTS.map((key) => [key, 0]),
        ) as Record<ReaderSegment, number>;
        for (const row of segments) bySegment[row.key] = Number(row.count);

        const byViewport = Object.fromEntries(
          VIEWPORT_BANDS.map((key) => [key, 0]),
        ) as Record<ViewportBand, number>;
        for (const row of viewports) byViewport[row.key] = Number(row.count);

        return ok({ bySegment, byViewport } satisfies AudienceBreakdown);
      } catch (cause) {
        return storageFailure("読者の内訳の読み出し", cause);
      }
    },

    async engagement(workspaceId, siteSlug, articleSlug, range, viewportBand) {
      try {
        /*
         * 画面幅の絞り込みは、ここ（引き出す時点）で効かせる。
         * 引いた後で間引くと、到達率の分母が全体のままになり、
         * 「狭い画面の読者の到達率」ではない数字が出る。
         */
        const scope = and(
          eq(readerInteractionEvents.workspaceId, String(workspaceId)),
          eq(readerInteractionEvents.siteSlug, siteSlug),
          eq(readerInteractionEvents.articleSlug, articleSlug),
          between(readerInteractionEvents.rollupDay, range.from, range.to),
          ...(viewportBand === undefined
            ? []
            : [eq(readerInteractionEvents.viewportBand, viewportBand)]),
        );

        // 位置比率を 10 等分の番号へ落として数える。1.0 ちょうどが
        // 11 個目にならないよう最後の区間へ寄せる。
        const bucketIndex = sql<number>`min(cast(${readerInteractionEvents.positionRatio} * ${ENGAGEMENT_BUCKETS} as integer), ${ENGAGEMENT_BUCKETS - 1})`;

        const [buckets, totals, elements] = await Promise.all([
          db
            .select({
              bucket: bucketIndex,
              sessions: sql<number>`count(distinct ${readerInteractionEvents.sessionKey})`,
              dwell: sql<number>`coalesce(avg(case when ${readerInteractionEvents.kind} = 'dwell' then ${readerInteractionEvents.dwellSeconds} end), 0)`,
            })
            .from(readerInteractionEvents)
            .where(scope)
            .groupBy(bucketIndex),
          db
            .select({ sessions: sql<number>`count(distinct ${readerInteractionEvents.sessionKey})` })
            .from(readerInteractionEvents)
            .where(scope),
          db
            .select({
              elementKey: readerInteractionEvents.elementKey,
              clicks: sql<number>`count(*)`,
            })
            .from(readerInteractionEvents)
            .where(and(scope, eq(readerInteractionEvents.kind, "click")))
            .groupBy(readerInteractionEvents.elementKey),
        ]);

        const totalSessions = Number(totals[0]?.sessions ?? 0);
        const byBucket = new Map(
          buckets.map((row) => [
            Number(row.bucket),
            { sessions: Number(row.sessions), dwell: Number(row.dwell) },
          ]),
        );

        const viewRows = await db
          .select({ views: sql<number>`count(*)` })
          .from(readerInteractionEvents)
          .where(and(scope, eq(readerInteractionEvents.kind, "view")));
        const views = Number(viewRows[0]?.views ?? 0);

        const clickThroughByElement: Record<string, number> = {};
        for (const row of elements) {
          if (row.elementKey === null) continue;
          // 表示が 0 の期間は 0。null を混ぜると並べ替えが崩れる。
          clickThroughByElement[row.elementKey] =
            views === 0 ? 0 : Number(row.clicks) / views;
        }

        return ok({
          buckets: Array.from({ length: ENGAGEMENT_BUCKETS }, (_, i) => {
            const found = byBucket.get(i);
            return {
              from: i / ENGAGEMENT_BUCKETS,
              to: (i + 1) / ENGAGEMENT_BUCKETS,
              reachRatio:
                totalSessions === 0 ? 0 : (found?.sessions ?? 0) / totalSessions,
              averageDwellSeconds: found?.dwell ?? 0,
            };
          }),
          clickThroughByElement,
        } satisfies EngagementProfile);
      } catch (cause) {
        return storageFailure("読まれ方の読み出し", cause);
      }
    },
  };

  return markEditorial(port);
}

export function createD1BlogRevenueRepository(db: DrizzleD1): CommercialBlogRevenuePort {
  const port: BlogRevenuePort = {
    async siteDaily(workspaceId, siteSlug, range) {
      try {
        const rows = await db
          .select()
          .from(siteDailyMetrics)
          .where(
            and(
              eq(siteDailyMetrics.workspaceId, String(workspaceId)),
              eq(siteDailyMetrics.siteSlug, siteSlug),
              inRange(siteDailyMetrics.day, range),
            ),
          )
          .orderBy(asc(siteDailyMetrics.day));
        return ok(rows.map(toDaily));
      } catch (cause) {
        return storageFailure("売上を含む日次集計の読み出し", cause);
      }
    },

    async articleRanking(workspaceId, siteSlug, range, limit) {
      try {
        /*
         * 期間で合計してから並べる。日ごとの最大値で並べると、
         * 1 日だけ跳ねた記事が上位に居座り、続けて稼いでいる記事が
         * 見えなくなる。
         */
        const rows = await db
          .select({
            articleSlug: articleDailyMetrics.articleSlug,
            views: sql<number>`sum(${articleDailyMetrics.views})`,
            clicks: sql<number>`sum(${articleDailyMetrics.clicks})`,
            conversions: sql<number>`sum(${articleDailyMetrics.conversions})`,
            revenueMinor: sql<number>`sum(${articleDailyMetrics.revenueMinor})`,
          })
          .from(articleDailyMetrics)
          .where(
            and(
              eq(articleDailyMetrics.workspaceId, String(workspaceId)),
              eq(articleDailyMetrics.siteSlug, siteSlug),
              inRange(articleDailyMetrics.day, range),
            ),
          )
          .groupBy(articleDailyMetrics.articleSlug)
          .orderBy(desc(sql`sum(${articleDailyMetrics.revenueMinor})`))
          .limit(limit);

        return ok(
          rows.map((row) => ({
            articleSlug: row.articleSlug,
            views: Number(row.views),
            clicks: Number(row.clicks),
            conversions: Number(row.conversions),
            revenueMinor: Number(row.revenueMinor),
          })),
        );
      } catch (cause) {
        return storageFailure("記事別売上の読み出し", cause);
      }
    },
  };

  return markCommercial(port);
}
