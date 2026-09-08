import { drizzle } from "drizzle-orm/d1";
import { eq, isNull } from "drizzle-orm";
import { createCollectSeoMeasurements } from "@/application/usecases/seo/collect-seo-measurements";
import * as schema from "@/db/schema";
import { siteBlueprints, siteRetirements } from "@/db/schema";
import type { MeasurementSource } from "@/domain/seo/aeo-measurement";
import { type ActorContext, asWorkspaceId } from "@/domain/shared";
import { createD1SeoMeasurementRepositories } from "../persistence/d1/seo-measurement-repository";
import { createD1SeoStaticAuditRepository } from "../persistence/d1/seo-static-audit-repository";
import { createAiCitationClient } from "../seo/aeo-measurement/ai-citation-client";
import { createSearchConsoleClient } from "../seo/aeo-measurement/search-console-client";
import { createStaticAuditCollector } from "../seo/aeo-measurement/static-audit-collector";

/**
 * SEO / AEO の収集を定時に回す（受入 A1）。
 *
 * ==========================================================================
 * なぜ `createDeps()` を呼ばないのか
 * ==========================================================================
 *
 * `distribution-scheduler.ts` と同じ理由である。ここは `worker-entry.js` から
 * **直に読まれる** TypeScript で、引き込んだものは Worker の中にもう 1 部載る。
 * 組み立ての総目録（`createDeps`）を引くと、画面と API のぶんが二重になり、
 * 3 MiB の上限に当たった日の公開が落ちる。要るものだけを名指しで組む。
 *
 * ==========================================================================
 * 呼び出し元に身元が無い
 * ==========================================================================
 *
 * 定時実行には「誰が」が無い。だから作業場所ごとに時計の身元を作る。
 * この身元を作れるのはこのファイルだけで、ポートには
 * 「全作業場所ぶんを集める」口を置かない —— 置くと、画面や道具の側から
 * 他所の分まで触れる入口ができる。
 */

/** 誰がこの収集を行ったか。**人でも AI でもない。時計である。** */
const COLLECTION_ACTOR_ID = "system:seo-measurement";

export type SeoCollectionOutcome = {
  readonly workspaceId: string;
  readonly siteSlug: string;
  readonly source: MeasurementSource;
  readonly pagesExamined: number;
  readonly findingsAdded: number;
  readonly findingsResolved: number;
  /** 共有予算から実際に消費した Search Console query 行数。 */
  readonly queryRowsFetched: number;
  readonly queryRowsStored: number;
  /** 見送った理由。**黙って 0 件にしない。** */
  readonly skippedReason: string | null;
};

export type SeoMeasurementCollectionResult = {
  readonly sites: number;
  readonly outcomes: readonly SeoCollectionOutcome[];
  /** 作業場所ごとの失敗。**1 つ落ちても残りは続ける。** */
  readonly failures: readonly { readonly siteSlug: string; readonly message: string }[];
};

/**
 * 1 回の起動でどこまでやるか。
 *
 * ==========================================================================
 * 「全部見る」を選ばない理由
 * ==========================================================================
 *
 * 定時実行の 1 回には限りがある（Cloudflare の枠は 15 分）。記事が
 * 200 本あるブログを毎回全部読むと、1 ページ 1 秒でも 200 秒かかり、
 * ブログが 5 つあれば枠を越える。越えた回は**途中で切られる**ので、
 * 名前の後ろのほうにあるブログだけが永久に見られない状態になり、
 * その事実は所見が 0 件であることとしてしか現れない。
 *
 * だから 1 回あたりのページ数を切り、古いものから順に見る。
 * 全部を見終えるのに数日かかるが、**どのページも必ず順番が回ってくる。**
 */
export const STATIC_AUDIT_PAGES_PER_RUN = 25;

/**
 * 実績を取りに行く期間（日）。
 *
 * Search Console の実績は 2〜3 日遅れて確定する。前日ぶんだけを取ると
 * 空の日が混ざるので、少し重ねて取って同じ日を上書きする。
 */
export const SEARCH_CONSOLE_LOOKBACK_DAYS = 7;
/** 1起動で保持・JSON bulk化するquery行を、全site合計で明示的に制限する。 */
export const SEARCH_CONSOLE_QUERY_ROWS_PER_RUN = 40_000;
/** Search Console は直近 3 日が確定途中になり得るため収集対象から外す。 */
export const SEARCH_CONSOLE_SETTLEMENT_DELAY_DAYS = 3;

/** 収集の対象になるブログ 1 つ。 */
export type CollectionTarget = {
  readonly workspaceId: string;
  readonly siteSlug: string;
};

/**
 * どの系統を、いまの回に走らせるか。
 *
 * ==========================================================================
 * 費用と上限が違うものを、同じ頻度で回さない
 * ==========================================================================
 *
 *   - 静的解析: 自分のサイトを読むだけで、費用は実質かからない。
 *     1 回 25 ページしか見ないので、**毎日回してようやく**全ページに
 *     順番が回る。間引くと一巡が数週間になり、直した記事の所見が
 *     いつまでも消えない。
 *
 *   - Search Console: 無料だが 1 日あたりの呼び出し上限がある。
 *     実績は日ごとに確定するので 1 日に何度取っても値は変わらない。
 *     1 日 1 回で足りる。7 日ぶん重ねて取るので、
 *     取りこぼした日があっても次の回が埋める。
 *
 *   - AI 検索の被引用: **1 ページごとに課金される。** しかも同じ問いでも
 *     返事が揺れるので、毎日見ても「変わった」しか分からない。
 *     週 1 回にすると、揺れではなく傾向として読めるようになる。
 *
 * ==========================================================================
 * ブログごとに曜日をずらす
 * ==========================================================================
 *
 * 被引用チェックを全ブログで同じ曜日に回すと、ブログが 10 個に増えた日に
 * その日の請求だけが跳ねる。`siteSlug` から作った数で曜日をずらすと、
 * ブログが増えても 1 日あたりの費用はならされる。**ずらす基準を
 * 名前から作る**のは、順番（追加順）だと途中で 1 つ消えたときに
 * 全部の曜日が動いてしまい、前の週との比較ができなくなるためである。
 *
 * cron は 1 日 1 回（UTC 17:00 = 日本時間 2:00）だけ動く。だから
 * 「週 1 回」は起動日そのものから導く。
 */
function sourcesForRun(at: Date, target: CollectionTarget): readonly MeasurementSource[] {
  const sources: MeasurementSource[] = ["static_audit", "search_console"];

  const dayNumber = Math.floor(at.getTime() / 86_400_000);
  if (dayNumber % 7 === stableWeekdayOffset(target.siteSlug)) {
    sources.push("ai_citation");
  }
  return sources;
}

/**
 * ブログの名前から 0..6 の数を作る。
 *
 * 暗号として強い必要はない。要るのは「同じ名前なら毎週同じ日」と
 * 「名前が違えば散る」の 2 つだけである。
 */
function stableWeekdayOffset(siteSlug: string): number {
  let hash = 0;
  for (let i = 0; i < siteSlug.length; i += 1) {
    hash = (hash * 31 + siteSlug.charCodeAt(i)) % 1_000_003;
  }
  return hash % 7;
}

export async function runSeoMeasurementCollection(
  binding: D1Database,
  env: Readonly<Record<string, unknown>>,
  at: Date,
): Promise<SeoMeasurementCollectionResult> {
  const origin = typeof env["PUBLIC_SITE_ORIGIN"] === "string" ? env["PUBLIC_SITE_ORIGIN"] : "";
  if (origin.trim() === "") {
    /*
      起点が分からないと、読みに行く URL を組み立てられない。
      推測（`https://<何か>`）で組み立てると、他人のサイトを読みに行く形になる。
      設定していないことは故障ではないので、理由を返して終わる。
    */
    return {
      sites: 0,
      outcomes: [],
      failures: [{ siteSlug: "-", message: "PUBLIC_SITE_ORIGIN が設定されていません。" }],
    };
  }

  const db = drizzle(binding, { schema });
  const allTargets = await listSeoCollectionTargets(db);
  const fairness = citationSitePositions(allTargets);
  const targets = rotateTargets(allTargets, at);

  const outcomes: SeoCollectionOutcome[] = [];
  const failures: { siteSlug: string; message: string }[] = [];
  let queryRowsRemaining = SEARCH_CONSOLE_QUERY_ROWS_PER_RUN;
  let staticPagesRemaining = STATIC_AUDIT_PAGES_PER_RUN;

  for (const target of targets) {
    const sources = sourcesForRun(at, target);
    if (sources.length === 0) continue;

    const repositories = createD1SeoMeasurementRepositories({
      db,
      workspaceId: target.workspaceId,
    });
    const staticAudits = createD1SeoStaticAuditRepository({
      db,
      workspaceId: target.workspaceId,
    });
    const collect = createCollectSeoMeasurements({
      workspaceId: asWorkspaceId(target.workspaceId),
      measurementArticles: repositories.measurementArticles,
      findings: repositories.findings,
      metrics: repositories.metrics,
      queryMetrics: repositories.queryMetrics,
      collections: repositories.collections,
      settings: repositories.settings,
      staticAudit: createStaticAuditCollector(),
      staticAudits,
      searchConsole: createSearchConsoleClient({
        serviceAccountJson: readSecret(env, "GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT"),
      }),
      aiCitation: createAiCitationClient({ apiKey: readSecret(env, "AEO_CITATION_API_KEY") }),
      citationBudgets: repositories.citationBudgets,
      now: () => at,
      // cron開始時刻ではなく、外部送信直前のUTC月へ課金予約する。
      budgetNow: () => new Date(),
    });

    const actor = collectionActor(target.workspaceId);
    const basePath = `/s/${target.siteSlug}`;

    for (const source of sources) {
      // Reserve before the call. If rows were written but a later success stamp fails,
      // the error result has no fetched count; retaining the allocation would let the next
      // site spend it again and exceed the process-wide cap.
      const reservation = source === "search_console"
        ? reserveQueryRows(queryRowsRemaining)
        : { allocated: 0, remaining: queryRowsRemaining };
      queryRowsRemaining = reservation.remaining;
      const staticReservation = source === "static_audit"
        ? reserveStaticPages(staticPagesRemaining)
        : { allocated: 0, remaining: staticPagesRemaining };
      staticPagesRemaining = staticReservation.remaining;
      let result: Awaited<ReturnType<typeof collect.execute>>;
      try {
        result = await collect.execute(
          actor,
          inputFor(source, target, origin, basePath, at, reservation.allocated, staticReservation.allocated,
            fairness.get(`${target.workspaceId}\u0000${target.siteSlug}`) ?? { activeSiteCount: 1, siteOrdinal: 0 }),
        );
      } catch {
        // 例外本文にはURL・検索語・資格情報が入り得る。固定文だけを残し、次の系統へ進む。
        failures.push({ siteSlug: target.siteSlug, message: `${source} の収集で予期しない失敗が起きました。` });
        continue;
      }
      if (!result.ok) {
        // 1 つの系統が落ちても、次の系統と次のブログは続ける。
        failures.push({ siteSlug: target.siteSlug, message: result.error.message });
        continue;
      }
      outcomes.push({
        workspaceId: target.workspaceId,
        siteSlug: target.siteSlug,
        source: result.value.source,
        pagesExamined: result.value.pagesExamined,
        findingsAdded: result.value.findingsAdded,
        findingsResolved: result.value.findingsResolved,
        queryRowsFetched: result.value.queryRowsFetched,
        queryRowsStored: result.value.queryRowsStored,
        skippedReason: result.value.skippedReason,
      });
      if (source === "search_console") {
        queryRowsRemaining = returnUnusedQueryRows(reservation.allocated, result.value.queryRowsFetched);
      }
    }
  }

  return { sites: targets.length, outcomes, failures };
}

/** 系統ごとの入力を組む。期間と上限の決め方をここ 1 か所に置く。 */
function inputFor(
  source: MeasurementSource,
  target: CollectionTarget,
  origin: string,
  basePath: string,
  at: Date,
  queryRowBudget: number,
  staticPageBudget: number,
  citationPosition: { readonly activeSiteCount: number; readonly siteOrdinal: number },
) {
  switch (source) {
    case "static_audit":
      return {
        action: "static_audit" as const,
        siteSlug: target.siteSlug,
        origin,
        basePath,
        limit: staticPageBudget,
      };
    case "search_console":
      return {
        action: "search_console" as const,
        siteUrl: `${origin}${basePath}/`,
        siteSlug: target.siteSlug,
        origin,
        basePath,
        // Seven complete UTC dates, ending three days before this invocation.
        ...settledSearchConsoleWindow(at),
        queryRowBudget,
      };
    case "ai_citation":
      return {
        action: "ai_citation" as const,
        siteSlug: target.siteSlug,
        origin,
        basePath,
        ...citationPosition,
      };
  }
}

function citationSitePositions(targets: readonly CollectionTarget[]): ReadonlyMap<string, {
  readonly activeSiteCount: number;
  readonly siteOrdinal: number;
}> {
  const byWorkspace = new Map<string, CollectionTarget[]>();
  for (const target of targets) {
    const sites = byWorkspace.get(target.workspaceId) ?? [];
    sites.push(target);
    byWorkspace.set(target.workspaceId, sites);
  }
  const result = new Map<string, { activeSiteCount: number; siteOrdinal: number }>();
  for (const [workspaceId, sites] of byWorkspace) {
    sites.sort((left, right) => left.siteSlug.localeCompare(right.siteSlug));
    sites.forEach((site, siteOrdinal) => result.set(`${workspaceId}\u0000${site.siteSlug}`, {
      activeSiteCount: sites.length, siteOrdinal,
    }));
  }
  return result;
}

/**
 * The shared query budget would otherwise always be spent by the first site.
 * Rotate the first site by UTC day so every site reaches the head of the queue.
 */
export function rotateTargets(targets: readonly CollectionTarget[], at: Date): readonly CollectionTarget[] {
  if (targets.length < 2) return targets;
  const offset = Math.floor(at.getTime() / 86_400_000) % targets.length;
  return [...targets.slice(offset), ...targets.slice(0, offset)];
}

export function settledSearchConsoleWindow(at: Date): { readonly startDate: string; readonly endDate: string } {
  return {
    startDate: isoDate(at, -(SEARCH_CONSOLE_LOOKBACK_DAYS + SEARCH_CONSOLE_SETTLEMENT_DELAY_DAYS - 1)),
    endDate: isoDate(at, -SEARCH_CONSOLE_SETTLEMENT_DELAY_DAYS),
  };
}

export function reserveQueryRows(available: number): { readonly allocated: number; readonly remaining: 0 } {
  return { allocated: Math.max(0, Math.floor(available)), remaining: 0 };
}

/** 外部fetch前に全ブログ共通枠を予約し、例外時にも二重利用しない。 */
export function reserveStaticPages(available: number): { readonly allocated: number; readonly remaining: 0 } {
  return {
    allocated: Math.min(STATIC_AUDIT_PAGES_PER_RUN, Math.max(0, Math.floor(available))),
    remaining: 0,
  };
}

/** Called only for a successful collection. On error the reservation remains consumed. */
export function returnUnusedQueryRows(allocated: number, fetched: number): number {
  return Math.max(0, Math.floor(allocated) - Math.max(0, Math.floor(fetched)));
}

function isoDate(at: Date, offsetDays: number): string {
  const shifted = new Date(at.getTime() + offsetDays * 24 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

/**
 * 収集の対象になるブログを数える。
 *
 * 読者向けreaderと同じく、未取り下げの公開設計図を数える。
 * サイト網の表示状態はブログ単体の公開資格ではない。
 * 記事0件でもトップ・一覧・固定ページは公開されるため対象から外さない。
 */
export async function listSeoCollectionTargets(
  db: ReturnType<typeof drizzle<typeof schema>>,
): Promise<readonly CollectionTarget[]> {
  const rows = await db
    .select({
      workspaceId: siteBlueprints.workspaceId,
      siteSlug: siteBlueprints.slug,
    })
    .from(siteBlueprints)
    .leftJoin(siteRetirements, eq(siteRetirements.slug, siteBlueprints.slug))
    .where(isNull(siteRetirements.slug))
    .orderBy(siteBlueprints.workspaceId, siteBlueprints.slug);
  return rows;
}

/**
 * 秘密を `env` から読む。**空文字は「無い」と同じ。**
 *
 * 空の値が登録されていると「登録済みだが認可に失敗する」という
 * 分かりにくい壊れ方になる。未登録へ倒して、画面に
 * 「まだ登録していません」と出るようにする。
 */
function readSecret(env: Readonly<Record<string, unknown>>, name: string): string | undefined {
  const value = env[name];
  if (typeof value !== "string" || value.trim() === "") return undefined;
  return value;
}

/**
 * 時計の身元。**この作業場所の中でしか使えない。**
 *
 * `workspace_admin` を名乗るのは、`site.manage` を持つ最小の役だからである。
 * 役を増やすと、その瞬間に「時計にできること」が増える。
 * `scopedBrandIds` を空にしているのは作業場所の全体を見るためで、
 * `site.manage` は元々ブランドをまたぐ権限として扱われている。
 */
function collectionActor(workspaceId: string): ActorContext {
  return {
    workspaceId: asWorkspaceId(workspaceId),
    userId: COLLECTION_ACTOR_ID,
    roles: ["workspace_admin"],
    scopedBrandIds: [],
    isAiServiceAccount: false,
    /*
      時計は「確かめてある身元」である。人がログインしたわけではないが、
      **どこから来たか**は分かっている（この Worker の定時実行）。
      false にすると、収集が残す記録が「確かめていない誰か」として
      並び、あとから運営者の操作と区別できなくなる。
    */
    identified: true,
  };
}
