import { and, asc, desc, eq, gte, lte, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import type {
  AutoApplyLogEntry,
  MeasurementSetting,
  PageMetric,
  SeoAutoApplyLogPort,
  SeoCitationBudgetPort,
  SeoMeasurementArticlePort,
  SeoFindingPort,
  SeoMeasurementSettingPort,
  SeoPageMetricPort,
  SeoSearchQueryCollectionPort,
  SeoSourceCollectionPort,
  SourceCollectionState,
} from "@/application/ports/seo-measurement";
import { MAX_CITATION_MONTHLY_SEARCH_LIMIT } from "@/application/ports/seo-measurement";
import {
  type SeoFindingRow,
  type SeoMeasurementSettingRow,
  type SeoPageMetricRow,
  type SeoSourceCollectionRow,
  seoAutoApplyLogs,
  seoFindings,
  seoMeasurementSettings,
  seoPageMetrics,
  seoSourceCollections,
  publishedArticles,
  seoPageObservations,
} from "@/db/schema";
import type {
  Finding,
  FindingCode,
  MeasurementSource,
  PageKey,
} from "@/domain/seo/aeo-measurement";
import { FINDING_CODES, isArticleAutoFixable } from "@/domain/seo/aeo-measurement";
import { domainError, err, ok, validationError } from "@/domain/shared";
import type { DrizzleD1 } from "./link-inbox-repository";
import { toLogEntry } from "./seo-auto-apply-log";
import { createD1SeoCitationBudgetRepository } from "./seo-citation-budget-repository";
import { jsonArrayChunks } from "./json-array-chunks";
import { createD1SeoMeasurementArticleRepository } from "./seo-measurement-article-repository";
import { createD1SeoSearchQueryMetricRepository } from "./seo-search-query-metric-repository";
import { storageFailure } from "./storage-failure";

/**
 * SEO / AEO 計測ループの保存先（D1）。同じ作業場所の口をまとめて作る。
 *
 * ==========================================================================
 * 1 つの工場で作る理由
 * ==========================================================================
 *
 * 扱う表はどれも `workspace_id` で仕切られており、**同じ作業場所の値しか
 * 見てはならない**という制約を共有している。口ごとに別の工場にすると、
 * 作業場所 ID を何度も渡すことになり、1 か所だけ別の値を渡した組み立てが
 * 型の上では成立してしまう。組み立て側の注意力に頼る作りにしない。
 *
 * ==========================================================================
 * 時刻の形が層で違う
 * ==========================================================================
 *
 * 保存先は Date（`mode: "timestamp"`）、上の層は ISO 8601 の文字列である。
 * 変換をこの層に閉じているのは、比較の意味が違うためである。文字列の
 * ISO 8601 は辞書順で時系列に並ぶので、上の層は `localeCompare` だけで
 * 並べ替えられる。Date を上まで通すと、その保証が消える。
 */

export type SeoMeasurementRepositoryDeps = {
  readonly db: DrizzleD1;
  readonly workspaceId: string;
};

export type SeoMeasurementRepositories = {
  readonly findings: SeoFindingPort;
  readonly logs: SeoAutoApplyLogPort;
  readonly collections: SeoSourceCollectionPort;
  readonly settings: SeoMeasurementSettingPort;
  readonly citationBudgets: SeoCitationBudgetPort;
  readonly metrics: SeoPageMetricPort;
  readonly queryMetrics: SeoSearchQueryCollectionPort;
  readonly measurementArticles: SeoMeasurementArticlePort;
};

/** 保存された Date を上の層の形（ISO 文字列）へ。null は null のまま。 */
function iso(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}

function toFinding(row: SeoFindingRow): Finding {
  return {
    source: row.source as MeasurementSource,
    pageKey: row.pageKey as PageKey,
    code: row.code as FindingCode,
    detail: row.detail,
    observedAt: row.observedAt.toISOString(),
  };
}

/** 候補と滞留件数は、同じ「公開中の記事で修正できる未反映所見」を数える。 */
function actionableFindingConditions() {
  return [
    isNull(seoFindings.appliedAt),
    eq(seoFindings.source, "static_audit"),
    inArray(seoFindings.code, FINDING_CODES.filter(isArticleAutoFixable)),
    isNotNull(publishedArticles.slug),
    isNull(publishedArticles.archivedAt),
  ];
}


function toCollectionState(row: SeoSourceCollectionRow): SourceCollectionState {
  return {
    source: row.source as MeasurementSource,
    lastCollectedAt: iso(row.lastCollectedAt),
    lastFailureReason: row.lastFailureReason,
    lastFailedAt: iso(row.lastFailedAt),
  };
}

function toSetting(row: SeoMeasurementSettingRow): MeasurementSetting {
  return {
    introducedAt: row.introducedAt.toISOString(),
    autoApplyPaused: row.autoApplyPaused,
    pausedAt: iso(row.pausedAt),
    resumedAt: iso(row.resumedAt),
    citationCheckLimit: row.citationCheckLimit,
    citationMonthlySearchLimit: row.citationMonthlySearchLimit,
  };
}

function toPageMetric(row: SeoPageMetricRow): PageMetric {
  return {
    pageKey: row.pageKey as PageKey,
    metricDate: row.metricDate,
    impressions: row.searchConsoleObserved ? row.impressions : null,
    clicks: row.searchConsoleObserved ? row.clicks : null,
    position: row.searchConsoleObserved ? row.position : null,
    aiCitations: row.aiCitations,
  };
}

export function createD1SeoMeasurementRepositories(
  deps: SeoMeasurementRepositoryDeps,
): SeoMeasurementRepositories {
  const { db, workspaceId } = deps;
  /*
    作業場所の絞りを 1 つの名前へ括り出さない。

    `const mine = eq(...)` と置くと短くはなるが、**問い合わせを読んでいる目に
    作業場所が見えなくなる**。読む側も、機械（`tests/architecture/
    tenant-scoped-schema.test.ts`）も、`.where(...)` の中に
    `seoFindings.workspaceId` があるかで判断する。機械は名前を 1 段だけ
    たどるので、`conditions` の配列越しに括り出すと届かない。

    「届くように書く」ではなく「毎回そこに書く」ほうを選んだのは、
    他所の作業場所の所見が混ざることが、この表で一番起きてはいけないからである。
  */

  const findings: SeoFindingPort = {
    async observedPageKey(input) {
      try {
        const [observed] = await db.select({ pageKey: seoPageObservations.pageKey }).from(seoPageObservations)
          .where(and(eq(seoPageObservations.workspaceId, workspaceId), eq(seoPageObservations.siteSlug, input.siteSlug),
            eq(seoPageObservations.articleSlug, input.articleSlug)))
          .orderBy(desc(seoPageObservations.lastCollectedAt), asc(seoPageObservations.pageKey)).limit(1);
        if (observed) return ok(observed.pageKey as PageKey);
        const [legacy] = await db.select({ pageKey: seoAutoApplyLogs.pageKey }).from(seoAutoApplyLogs)
          .where(and(eq(seoAutoApplyLogs.workspaceId, workspaceId), eq(seoAutoApplyLogs.siteSlug, input.siteSlug),
            eq(seoAutoApplyLogs.articleSlug, input.articleSlug)))
          .orderBy(desc(seoAutoApplyLogs.appliedAt), asc(seoAutoApplyLogs.id)).limit(1);
        return ok(legacy ? legacy.pageKey as PageKey : null);
      } catch (cause) { return storageFailure("記事の観測先の取得", cause); }
    },
    /**
     * 見た範囲の所見を、いまの姿へ入れ替える。
     *
     * **消してから入れる。** 逆にすると、今回出なかった所見（＝直った所見）を
     * 消す条件が「今回入れた分を除いて」になり、条件の書き方を間違えた日に
     * 直したはずの指摘が残り続ける。先に範囲ごと消せば、残るのは
     * 今回観測した分だけであることが 1 行で分かる。
     *
     * 消す範囲を「この系統の、見たページだけ」に絞るのが要点である。
     * 系統で絞らないと、静的解析の収集が Search Console の所見を消す。
     * ページで絞らないと、10 件だけ見た回が全件を消す。
    */
    async replaceForPages(input) {
      if (input.pages.length === 0 && input.completeSiteSlug === undefined && input.siteSnapshotSlug === undefined) {
        return ok({ added: 0, resolved: 0 });
      }
      const pageKeys = input.pages.map((page) => page.pageKey as string);
      const identityOf = new Map(input.pages.map((page) => [page.pageKey as string, page]));
      const findings = input.findings.filter(finding => identityOf.has(finding.pageKey));
      if (!Number.isFinite(Date.parse(input.observedAt)) || identityOf.size !== input.pages.length ||
          findings.some(finding => finding.source !== input.source) ||
          (input.completeSiteSlug !== undefined && (input.completeSiteSlug.trim() === "" ||
            input.pages.some(page => page.siteSlug !== input.completeSiteSlug))) ||
          (input.siteSnapshotSlug !== undefined && (input.siteSnapshotSlug.trim() === "" ||
            input.pages.some(page => page.siteSlug !== input.siteSnapshotSlug))) ||
          (input.completeSiteSlug !== undefined && input.completeSiteSlug !== input.siteSnapshotSlug)) {
        return err(validationError("観測した日時・ページ・系統の対応を確認できません。"));
      }

      try {
        const observedAt = Math.floor(Date.parse(input.observedAt) / 1000);
        const statements: D1PreparedStatement[] = [];

        // page集合が変わる取得元は専用cursorをCASする。古いrunならNOT NULL違反で
        // このbatch全体をrollbackし、limited/completeや異なるpage集合でも巻き戻さない。
        if (input.siteSnapshotSlug !== undefined) {
          statements.push(db.$client.prepare(`INSERT INTO seo_finding_site_snapshot
            (workspace_id,site_slug,source,last_collected_at) VALUES (?,?,?,?)
            ON CONFLICT(workspace_id,site_slug,source) DO UPDATE SET
              last_collected_at=CASE
                WHEN seo_finding_site_snapshot.last_collected_at<=excluded.last_collected_at
                THEN excluded.last_collected_at ELSE NULL END`).bind(
                  workspaceId, input.siteSnapshotSlug, input.source, observedAt,
                ));
        }

        if (input.recordPageObservations !== false) {
          const payloads = jsonArrayChunks(input.pages.map((page) => ({
              siteSlug: page.siteSlug,
              articleSlug: page.articleSlug,
              pageKey: page.pageKey,
            })));
          for (const payload of payloads) {
            statements.push(db.$client.prepare(`INSERT INTO seo_page_observation
              (workspace_id,site_slug,article_slug,page_key,source,last_collected_at)
              SELECT ?,json_extract(value,'$.siteSlug'),json_extract(value,'$.articleSlug'),
                     json_extract(value,'$.pageKey'),?,?
              FROM json_each(?) WHERE true
              ON CONFLICT(workspace_id,page_key,source) DO UPDATE SET
                site_slug=excluded.site_slug,article_slug=excluded.article_slug,
                last_collected_at=CASE WHEN seo_page_observation.last_collected_at<=excluded.last_collected_at
                  THEN excluded.last_collected_at ELSE NULL END`).bind(
                    workspaceId, input.source, observedAt, payload,
                  ));
          }
        }

        const deleteIndexes: number[] = [];
        if (input.completeSiteSlug !== undefined) {
          deleteIndexes.push(statements.length);
          statements.push(db.$client.prepare(`DELETE FROM seo_finding
            WHERE workspace_id=? AND source=? AND site_slug=? AND observed_at<=?`).bind(
              workspaceId, input.source, input.completeSiteSlug, observedAt,
            ));
        } else {
          for (const payload of jsonArrayChunks(pageKeys)) {
            deleteIndexes.push(statements.length);
            statements.push(db.$client.prepare(`DELETE FROM seo_finding
              WHERE workspace_id=? AND source=? AND observed_at<=?
                AND page_key IN (SELECT value FROM json_each(?))`).bind(
                  workspaceId, input.source, observedAt, payload,
                ));
          }
        }

        const findingPayloads = jsonArrayChunks(findings.map((finding) => {
            const identity = identityOf.get(finding.pageKey)!;
            return {
              siteSlug: identity.siteSlug,
              articleSlug: identity.articleSlug,
              pageKey: finding.pageKey,
              code: finding.code,
              detail: finding.detail,
              observedAt: Math.floor(Date.parse(finding.observedAt) / 1000),
            };
          }));
        for (const payload of findingPayloads) {
          statements.push(db.$client.prepare(`INSERT INTO seo_finding
            (id,workspace_id,site_slug,page_key,article_slug,source,code,detail,observed_at,applied_at)
            SELECT 'sf_' || lower(hex(randomblob(16))),?,json_extract(value,'$.siteSlug'),
                   json_extract(value,'$.pageKey'),json_extract(value,'$.articleSlug'),?,
                   json_extract(value,'$.code'),json_extract(value,'$.detail'),
                   json_extract(value,'$.observedAt'),NULL
            FROM json_each(?) WHERE true
            ON CONFLICT(workspace_id,page_key,code) DO UPDATE SET
              site_slug=excluded.site_slug,article_slug=excluded.article_slug,source=excluded.source,
              detail=excluded.detail,observed_at=excluded.observed_at,applied_at=NULL
            WHERE seo_finding.observed_at<=excluded.observed_at`).bind(
              workspaceId, input.source, payload,
            ));
        }

        const results = statements.length === 0 ? [] : await db.$client.batch(statements);
        const removed = deleteIndexes.reduce(
          (sum, index) => sum + Number(results[index]?.meta.changes ?? 0),
          0,
        );

        /*
          「直った件数」は、消した数から今回また出た数を引いたもの。
          消した数をそのまま出すと、毎回全件が「直った」ことになる。
        */
        const added = findings.length;
        return ok({ added, resolved: Math.max(0, removed - added) });
      } catch (cause) {
        for (let current = cause; current instanceof Error; current = current.cause) {
          if (current.message.includes("NOT NULL constraint failed: seo_page_observation.last_collected_at")) {
            return err(domainError("CONFLICT", "新しい観測結果が先に保存されています。今回の古い結果は反映しませんでした。"));
          }
          if (current.message.includes("NOT NULL constraint failed: seo_finding_site_snapshot.last_collected_at")) {
            return err(domainError("CONFLICT", "新しいサイト全体の観測結果が先に保存されています。今回の古い結果は反映しませんでした。"));
          }
        }
        return storageFailure("所見の保存", cause);
      }
    },

    async groupedByArticle(input) {
      try {
        const conditions = [eq(seoFindings.workspaceId, workspaceId)];
        if (!input.includeApplied) conditions.push(...actionableFindingConditions());
        if (input.articleSlug !== undefined) conditions.push(eq(seoFindings.articleSlug, input.articleSlug));
        if (input.siteSlug !== undefined) {
          conditions.push(eq(seoFindings.siteSlug, input.siteSlug));
        }
        const rows = await db
          .select({ finding: seoFindings, title: publishedArticles.title })
          .from(seoFindings)
          .leftJoin(publishedArticles, and(
            eq(publishedArticles.workspaceId, workspaceId),
            eq(publishedArticles.siteSlug, seoFindings.siteSlug),
            eq(publishedArticles.slug, seoFindings.articleSlug),
          ))
          .where(and(...conditions))
          .orderBy(asc(seoFindings.observedAt));

        /*
          記事に結びついていない所見（トップ・一覧）はここで落とす。
          自動反映は記事を書き換えるものなので、書き換える先が無い所見を
          候補に混ぜると、呼び出し側が毎回「記事が見つかりません」を
          数えることになる。落ちた理由が「見つからない」に化けるのが良くない。
        */
        const grouped = new Map<
          string,
          { siteSlug: string; articleSlug: string; pageKey: PageKey; title: string; findings: Finding[] }
        >();
        for (const { finding: row, title } of rows) {
          if (row.articleSlug === null) continue;
          const key = `${row.siteSlug}/${row.articleSlug}`;
          const bucket = grouped.get(key) ?? {
            siteSlug: row.siteSlug,
            articleSlug: row.articleSlug,
            pageKey: row.pageKey as PageKey,
            title: title ?? "",
            findings: [],
          };
          bucket.findings.push(toFinding(row));
          grouped.set(key, bucket);
        }

        // 上限は記事の本数に掛ける。所見の件数で切ると、
        // 所見の多い 1 本だけで枠を使い切って他の記事が永久に順番待ちになる。
        return ok([...grouped.values()].slice(0, input.limit));
      } catch (cause) {
        return storageFailure("自動反映の候補の取得", cause);
      }
    },

    async list(input) {
      try {
        const conditions = [eq(seoFindings.workspaceId, workspaceId)];
        if (input.siteSlug !== undefined) conditions.push(eq(seoFindings.siteSlug, input.siteSlug));
        if (input.source !== undefined) conditions.push(eq(seoFindings.source, input.source));
        const rows = await db
          .select()
          .from(seoFindings)
          .where(and(...conditions))
          .orderBy(desc(seoFindings.observedAt))
          .limit(input.limit);
        return ok(rows.map(toFinding));
      } catch (cause) {
        return storageFailure("所見一覧の取得", cause);
      }
    },

    async unappliedSummary(input = {}) {
      try {
        const conditions = [
          eq(seoFindings.workspaceId, workspaceId),
          ...actionableFindingConditions(),
        ];
        if (input.siteSlug !== undefined) conditions.push(eq(seoFindings.siteSlug, input.siteSlug));
        const [row] = await db
          .select({
            count: sql<number>`count(*)`,
            oldest: sql<number | null>`min(${seoFindings.observedAt})`,
          })
          .from(seoFindings)
          .innerJoin(publishedArticles, and(
            eq(publishedArticles.workspaceId, workspaceId),
            eq(publishedArticles.siteSlug, seoFindings.siteSlug),
            eq(publishedArticles.slug, seoFindings.articleSlug),
          ))
          .where(and(...conditions));
        const oldest = row?.oldest ?? null;
        return ok({
          count: row?.count ?? 0,
          // 保存されているのは秒。JavaScript の時刻はミリ秒なので 1000 倍する。
          oldestObservedAt: oldest === null ? null : new Date(oldest * 1000).toISOString(),
        });
      } catch (cause) {
        return storageFailure("未反映の所見の集計", cause);
      }
    },


  };

  const logs: SeoAutoApplyLogPort = {
    async list(input) {
      try {
        const conditions = [eq(seoAutoApplyLogs.workspaceId, workspaceId)];
        if (input.siteSlug !== undefined) {
          conditions.push(eq(seoAutoApplyLogs.siteSlug, input.siteSlug));
        }
        const rows = await db
          .select()
          .from(seoAutoApplyLogs)
          .where(and(...conditions))
          .orderBy(desc(seoAutoApplyLogs.appliedAt))
          .limit(input.limit);
        /*
          読めなかった行は一覧から落とす。並べて出すと、押しても何も
          起きない取り消しボタンが並ぶ。落とした行は残っているので、
          保存先を直接見れば復旧できる。
        */
        return ok(rows.map(toLogEntry).filter((entry): entry is AutoApplyLogEntry => entry !== null));
      } catch (cause) {
        return storageFailure("自動反映の履歴の取得", cause);
      }
    },

    async lastAppliedAt(pageKey) {
      try {
        const [row] = await db
          .select({ appliedAt: seoAutoApplyLogs.appliedAt })
          .from(seoAutoApplyLogs)
          .where(
            and(
              eq(seoAutoApplyLogs.workspaceId, workspaceId),
              eq(seoAutoApplyLogs.pageKey, pageKey),
              /*
                取り消した反映は「起きなかったこと」として数える。
                数に入れると、間違って反映して即座に戻した記事が
                14 日間まったく直せなくなる（NFR3 の冷却期間が
                「直した回数」ではなく「触った回数」で効いてしまう）。
              */
              isNull(seoAutoApplyLogs.revertedAt),
            ),
          )
          .orderBy(desc(seoAutoApplyLogs.appliedAt))
          .limit(1);
        return ok(row === undefined ? null : row.appliedAt.toISOString());
      } catch (cause) {
        return storageFailure("最後の反映時刻の取得", cause);
      }
    },
  };

  const collections: SeoSourceCollectionPort = {
    async all() {
      try {
        const rows = await db
          .select()
          .from(seoSourceCollections)
          .where(eq(seoSourceCollections.workspaceId, workspaceId));
        return ok(rows.map(toCollectionState));
      } catch (cause) {
        return storageFailure("収集状況の取得", cause);
      }
    },

    /**
     * 成功を記録する。**失敗の理由を消す。**
     *
     * 消さないと、直った後も赤い理由が画面に残り続ける。
     * 「いつ直ったか」は `last_collected_at` が持っているので、
     * 古い失敗理由を残す意味は無い。
     */
    async recordSuccess(input) {
      try {
        await db
          .insert(seoSourceCollections)
          .values({
            id: `ssc_${crypto.randomUUID()}`,
            workspaceId,
            source: input.source,
            lastCollectedAt: new Date(input.collectedAt),
            lastFailureReason: "",
            lastFailedAt: null,
          })
          .onConflictDoUpdate({
            target: [seoSourceCollections.workspaceId, seoSourceCollections.source],
            set: {
              lastCollectedAt: new Date(input.collectedAt),
              lastFailureReason: "",
              lastFailedAt: null,
            },
          });
        return ok(true as const);
      } catch (cause) {
        return storageFailure("収集の成功の記録", cause);
      }
    },

    /**
     * 失敗を記録する。**成功時刻は触らない。**
     *
     * 触ると「最後に成功したのはいつか」が失われ、
     * 「ずっと落ちている」と「さっきの 1 回だけ落ちた」が同じ見え方になる。
     */
    async recordFailure(input) {
      try {
        await db
          .insert(seoSourceCollections)
          .values({
            id: `ssc_${crypto.randomUUID()}`,
            workspaceId,
            source: input.source,
            lastCollectedAt: null,
            lastFailureReason: input.reason,
            lastFailedAt: new Date(input.failedAt),
          })
          .onConflictDoUpdate({
            target: [seoSourceCollections.workspaceId, seoSourceCollections.source],
            set: { lastFailureReason: input.reason, lastFailedAt: new Date(input.failedAt) },
          });
        return ok(true as const);
      } catch (cause) {
        return storageFailure("収集の失敗の記録", cause);
      }
    },
  };

  const settings: SeoMeasurementSettingPort = {
    /**
     * 設定を読む。無ければ作る。
     *
     * **`introduced_at` が入るのはこの 1 か所だけ**である（NFR2）。
     * `onConflictDoNothing` にしているのは、同時に 2 つの要求が来たときに
     * 後から来たほうが導入時刻を上書きしないためで、上書きされると
     * 導入前の記事が自動反映の対象へ入る。
     */
    async loadOrCreate(now) {
      try {
        await db
          .insert(seoMeasurementSettings)
          .values({ workspaceId, introducedAt: new Date(now) })
          .onConflictDoNothing();
        const [row] = await db
          .select()
          .from(seoMeasurementSettings)
          .where(eq(seoMeasurementSettings.workspaceId, workspaceId))
          .limit(1);
        if (row === undefined) return storageFailure("計測設定の作成", new Error("row missing"));
        return ok(toSetting(row));
      } catch (cause) {
        return storageFailure("計測設定の取得", cause);
      }
    },

    async setPaused(input) {
      try {
        await db
          .insert(seoMeasurementSettings)
          .values({
            workspaceId,
            introducedAt: new Date(input.at),
            autoApplyPaused: input.paused,
            ...(input.paused ? { pausedAt: new Date(input.at) } : { resumedAt: new Date(input.at) }),
          })
          .onConflictDoUpdate({
            target: seoMeasurementSettings.workspaceId,
            set: {
              autoApplyPaused: input.paused,
              // 止めた時刻と再開した時刻を別の列に持つ。1 列にすると
              // 「いつから止まっているか」が再開のたびに消える。
              ...(input.paused
                ? { pausedAt: new Date(input.at) }
                : { resumedAt: new Date(input.at) }),
            },
          });
        return await settings.loadOrCreate(input.at);
      } catch (cause) {
        return storageFailure("自動反映の停止設定の保存", cause);
      }
    },

    async setCitationCheckLimit(limit) {
      if (!Number.isInteger(limit) || limit < 0) {
        return err(validationError("被引用チェックの上限は 0 以上の整数で指定してください。"));
      }
      try {
        const now = new Date();
        await db
          .insert(seoMeasurementSettings)
          .values({ workspaceId, introducedAt: now, citationCheckLimit: limit })
          .onConflictDoUpdate({
            target: seoMeasurementSettings.workspaceId,
            set: { citationCheckLimit: limit },
          });
        return await settings.loadOrCreate(now.toISOString());
      } catch (cause) {
        return storageFailure("被引用チェック上限の保存", cause);
      }
    },

    async setCitationMonthlySearchLimit(limit) {
      if (!Number.isSafeInteger(limit) || limit < 0 || limit > MAX_CITATION_MONTHLY_SEARCH_LIMIT) {
        return err(validationError(`AI検索の月次上限は0〜${MAX_CITATION_MONTHLY_SEARCH_LIMIT}回で指定してください。`));
      }
      try {
        const now = new Date();
        await db
          .insert(seoMeasurementSettings)
          .values({ workspaceId, introducedAt: now, citationMonthlySearchLimit: limit })
          .onConflictDoUpdate({
            target: seoMeasurementSettings.workspaceId,
            set: { citationMonthlySearchLimit: limit },
          });
        return await settings.loadOrCreate(now.toISOString());
      } catch (cause) {
        return storageFailure("AI検索の月次上限の保存", cause);
      }
    },
  };

  const metrics: SeoPageMetricPort = {
    async upsertMany(input) {
      const rows = input.metrics;
      if (rows.length === 0) return ok(0);
      // この口はGSCの実観測専用。AIのみの日を0件として書き直さない。
      if (rows.some(row => row.impressions === null || row.clicks === null || row.position === null)) {
        return err(validationError("検索実績の観測値がありません。"));
      }
      const observedAt = Math.floor(Date.parse(input.observedAt) / 1000);
      if (!Number.isFinite(observedAt)) return err(validationError("検索実績の観測時刻を確認できません。"));
      try {
        const statements: D1PreparedStatement[] = [];
        const payloads = jsonArrayChunks(rows.map((metric) => ({
            pageKey: metric.pageKey, metricDate: metric.metricDate, impressions: metric.impressions,
            clicks: metric.clicks, position: metric.position,
          })));
        for (const payload of payloads) {
          statements.push(db.$client.prepare(`INSERT INTO seo_page_metric
            (id,workspace_id,page_key,metric_date,impressions,clicks,position,search_console_observed,ai_citations,search_console_collected_at)
            SELECT 'spm_' || lower(hex(randomblob(16))),?,json_extract(value,'$.pageKey'),json_extract(value,'$.metricDate'),
                   json_extract(value,'$.impressions'),json_extract(value,'$.clicks'),json_extract(value,'$.position'),1,NULL,?
            FROM json_each(?) WHERE true
            ON CONFLICT(workspace_id,page_key,metric_date) DO UPDATE SET
              impressions=excluded.impressions,clicks=excluded.clicks,position=excluded.position,
              search_console_observed=1,search_console_collected_at=excluded.search_console_collected_at
            WHERE seo_page_metric.search_console_collected_at IS NULL
               OR seo_page_metric.search_console_collected_at<=excluded.search_console_collected_at`)
            .bind(workspaceId, observedAt, payload));
        }
        const results = await db.$client.batch(statements);
        return ok(results.reduce((sum, result) => sum + Number(result.meta.changes ?? 0), 0));
      } catch (cause) {
        return storageFailure("実績の保存", cause);
      }
    },

    async upsertAiCitations(rows) {
      if (rows.length === 0) return ok(0);
      if (rows.some(row => row.aiCitations !== 0 && row.aiCitations !== 1)) {
        return err(validationError("被引用チェックの結果は引用あり/なしで指定してください。"));
      }
      try {
        const statements: D1PreparedStatement[] = [];
        for (const payload of jsonArrayChunks(rows.map((metric) => ({
          id: `spm_${crypto.randomUUID()}`,
          pageKey: metric.pageKey,
          metricDate: metric.metricDate,
          aiCitations: metric.aiCitations,
        })))) {
          statements.push(db.$client.prepare(`INSERT INTO seo_page_metric
            (id,workspace_id,page_key,metric_date,impressions,clicks,position,search_console_observed,ai_citations)
            SELECT json_extract(value,'$.id'),?,json_extract(value,'$.pageKey'),json_extract(value,'$.metricDate'),
              0,0,0,0,json_extract(value,'$.aiCitations')
            FROM json_each(?) WHERE true
            ON CONFLICT(workspace_id,page_key,metric_date) DO UPDATE SET ai_citations=excluded.ai_citations`)
            .bind(workspaceId, payload));
        }
        const results = await db.$client.batch(statements);
        return ok(results.reduce((sum, result) => sum + Number(result.meta.changes ?? 0), 0));
      } catch (cause) {
        return storageFailure("被引用チェック実績の保存", cause);
      }
    },

    async recent(input) {
      try {
        const rows = await db
          .select()
          .from(seoPageMetrics)
          .where(
            and(eq(seoPageMetrics.workspaceId, workspaceId), eq(seoPageMetrics.pageKey, input.pageKey),
              gte(seoPageMetrics.metricDate, input.from), lte(seoPageMetrics.metricDate, input.to)),
          )
          .orderBy(desc(seoPageMetrics.metricDate));
        // 古い順へ直して返す。推移は左から右へ読むので、
        // 並べ替えを画面へ残すと画面ごとに向きが変わる。
        return ok([...rows].reverse().map(toPageMetric));
      } catch (cause) {
        return storageFailure("実績の取得", cause);
      }
    },
  };

  return { findings, logs, collections, settings, metrics,
    citationBudgets: createD1SeoCitationBudgetRepository(deps),
    queryMetrics: createD1SeoSearchQueryMetricRepository(deps),
    measurementArticles: createD1SeoMeasurementArticleRepository(deps),
  };
}
