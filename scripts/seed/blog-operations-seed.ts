/**
 * ブログ運営管理層の見本データ（**開発機の D1 だけ**）。
 *
 * 住所（独自ドメイン）・観測（読者行動と日次集計）・改善（SEO / AEO）の
 * 3 層を、`/admin/sites/<ブログ>/` の画面から触れる状態にする。
 *
 * --- なぜ記事側の種と別ファイルなのか ---
 * 記事側の種は「何を書いたか」を作る。ここは「読まれた結果」を作る。
 * 同じファイルに置くと、記事を 1 本足すたびに観測の生成まで読み直す
 * ことになり、どちらの都合で値が動いたのかが追えなくなる。
 *
 * --- 決めごと 3 つ ---
 *   1. **生イベントを先に作り、日次集計はそこから畳む。** 集計の数字を
 *      手で書くと、画面の「日ごとの推移」と「記事の中のどこを読んでいるか」
 *      が食い違い、しかもどちらが正しいのか画面から判断できない。
 *   2. **列挙値は domain の定数から取り、写さない。** 区分を 1 つ足した日に、
 *      種だけ古い区分のままになるのを防ぐ。
 *   3. **参考サイト由来の文章・固有名は 1 つも書かない**（`check:reference-reuse`）。
 *      ホスト名は予約済みの `.test` を使う。
 */
import { detectGaps, type AnswerUnit, ANSWER_UNIT_KINDS } from "@/domain/aeo/answer-unit";
import {
  CERTIFICATE_STATUSES,
  CUSTOM_DOMAIN_STATUSES,
  type CertificateStatus,
  type CustomDomainStatus,
} from "@/domain/domains/custom-domain";
import {
  INTERACTION_KINDS,
  READER_SEGMENTS,
  type InteractionKind,
  type ReaderSegment,
  type ViewportBand,
  VIEWPORT_BANDS,
} from "@/domain/analytics/reader-interaction";
import {
  ASSESSMENT_STATES,
  SEO_CHECK_KINDS,
  SEO_SEVERITIES,
  type AssessmentState,
  type SeoCheckKind,
  type SeoSeverity,
} from "@/domain/seo/assessment";
import { TELEMETRY_ELEMENT_KINDS } from "@/presentation/ui/telemetry-attrs";
import { num, q, text } from "./sql";

/** 種を作るブログ 1 本ぶんの入口。記事の URL 名は呼び手が渡す。 */
export type OperationsSeedSite = {
  readonly siteSlug: string;
  /** 公開済み記事の URL 名。並び順がそのまま数字の大小になる。 */
  readonly articleSlugs: readonly string[];
};

export type OperationsSeedInput = {
  readonly workspaceId: string;
  readonly nowSeconds: number;
  readonly sites: readonly OperationsSeedSite[];
};

/**
 * 何日ぶんの観測を作るか。
 *
 * 14 日にしているのは、画面の既定期間（直近 1 週間前後）を**はみ出す**
 * ためである。ちょうど収まる日数だけ入れると、期間を広げたときに
 * 表が伸びるのか、そもそも古い日が無いだけなのかを区別できない。
 */
const OBSERVED_DAYS = 14;

/** 生イベントの保持期限より内側。掃除の対象にならない範囲で作る。 */
const RETENTION_DAYS = 90;

/**
 * 押される部品の名前。拾う側 (`elementKeyOf`) が作る `kind:id` と同じ形にする。
 *
 * 形を合わせておかないと、種のデータでは出る画面が、本物の観測を
 * 入れた途端に「見たことのない名前」で埋まる。
 */
const CLICK_TARGETS: readonly string[] = [
  `${TELEMETRY_ELEMENT_KINDS[0]}:seed-primary`,
  `${TELEMETRY_ELEMENT_KINDS[1]}:seed-related`,
  `${TELEMETRY_ELEMENT_KINDS[3]}:seed-cta`,
  `${TELEMETRY_ELEMENT_KINDS[4]}:seed-rank-1`,
];

/**
 * 同じ入力からいつも同じ値を出す乱数。
 *
 * `Math.random` を使うと、`pnpm seed:local` を当て直すたびに画面の数字が
 * 変わる。「実装を直したから変わったのか、種を引き直したから変わったのか」を
 * 画面から区別できなくなるので、文字列から決まる値にする。
 */
function pseudoRandom(seed: string): () => number {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    state ^= seed.charCodeAt(i);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state = Math.imul(state ^ (state >>> 15), 2246822519);
    state = Math.imul(state ^ (state >>> 13), 3266489917);
    return ((state ^= state >>> 16) >>> 0) / 4294967296;
  };
}

/** `YYYY-MM-DD`。`toRollupDay` と同じく UTC で切る。 */
function dayOf(atSeconds: number): string {
  return new Date(atSeconds * 1000).toISOString().slice(0, 10);
}

type SeedEvent = {
  readonly id: string;
  readonly siteSlug: string;
  readonly articleSlug: string;
  readonly kind: InteractionKind;
  readonly segment: ReaderSegment;
  readonly viewportBand: ViewportBand;
  readonly positionRatio: number;
  readonly dwellSeconds: number;
  readonly elementKey: string | null;
  readonly sessionKey: string;
  readonly rollupDay: string;
  readonly occurredAt: number;
};

/**
 * 読者 1 人ぶんの足あとを作る。
 *
 * 「開いた → 途中まで読み進んだ → 止まった → （たまに）押した → 出た」
 * の順で、**読み進んだ深さを 1 人ごとに変える**。全員が最後まで読む形に
 * すると到達率が全部の区間で 1 になり、記事のどこで離れているかを見る
 * 画面が「常に真っ平ら」になって、実装の誤りに気づけない。
 */
function sessionEvents(
  site: string,
  articleSlug: string,
  day: string,
  dayIndex: number,
  session: number,
  atSeconds: number,
): readonly SeedEvent[] {
  const rand = pseudoRandom(`${site}/${articleSlug}/${day}/${session}`);
  const sessionKey = `sk_seed_${day.replace(/-/g, "")}_${session}_${articleSlug.slice(0, 12)}`;
  const segment = READER_SEGMENTS[(session + dayIndex) % READER_SEGMENTS.length];
  const viewportBand = VIEWPORT_BANDS[(session * 2 + dayIndex) % VIEWPORT_BANDS.length];
  /*
   * 狭い画面ほど浅く離れる。画面幅の切り替えが**意味のある差**を
   * 見せられるようにするための偏りで、実測の主張ではない。
   */
  const bias = viewportBand === "narrow" ? 0.55 : viewportBand === "medium" ? 0.75 : 0.95;
  const depth = Math.min(1, Math.round((0.2 + rand() * bias) * 10) / 10);

  const base: Omit<SeedEvent, "id" | "kind" | "positionRatio" | "dwellSeconds" | "elementKey"> = {
    siteSlug: site,
    articleSlug,
    segment,
    viewportBand,
    sessionKey,
    rollupDay: day,
    occurredAt: atSeconds,
  };
  const make = (
    suffix: string,
    kind: InteractionKind,
    positionRatio: number,
    dwellSeconds: number,
    elementKey: string | null,
    offset: number,
  ): SeedEvent => ({
    ...base,
    id: `rie_seed_${day}_${articleSlug}_${session}_${suffix}`,
    kind,
    positionRatio,
    dwellSeconds,
    elementKey,
    occurredAt: atSeconds + offset,
  });

  const events: SeedEvent[] = [make("view", "view", 0, 0, null, 0)];
  for (let step = 1; step * 0.2 <= depth + 1e-9; step += 1) {
    const ratio = Math.round(step * 0.2 * 100) / 100;
    events.push(make(`scroll${step}`, "scroll", ratio, 0, null, step * 5));
  }
  events.push(
    make("dwell", "dwell", depth, Math.round(20 + depth * 120 + rand() * 40), null, 40),
  );
  // 押すのは一部の人だけ。全員が押すと、クリック率が常に 1 になる。
  if (rand() < 0.35) {
    const target = CLICK_TARGETS[Math.floor(rand() * CLICK_TARGETS.length)] ?? CLICK_TARGETS[0];
    events.push(make("click", "click", Math.min(depth, 0.9), 0, target, 45));
  }
  events.push(make("exit", "exit", depth, 0, null, 60));
  return events;
}

/** 観測の生データを作る。ここが日次集計の唯一の元。 */
function buildEvents(input: OperationsSeedInput): readonly SeedEvent[] {
  const events: SeedEvent[] = [];
  for (const site of input.sites) {
    for (let back = OBSERVED_DAYS; back >= 1; back -= 1) {
      const atSeconds = input.nowSeconds - back * 24 * 60 * 60;
      const day = dayOf(atSeconds);
      const dayIndex = OBSERVED_DAYS - back;
      site.articleSlugs.forEach((articleSlug, articleIndex) => {
        /*
         * 記事ごとに人数を変える。全部同じにすると「よく読まれている記事」の
         * 並べ替えが常に同点になり、並び順の実装が正しいか分からない。
         */
        const rand = pseudoRandom(`${site.siteSlug}/${articleSlug}/${day}/count`);
        const sessions = 2 + Math.floor(rand() * 6) + (articleIndex === 0 ? 4 : 0);
        for (let session = 0; session < sessions; session += 1) {
          events.push(
            ...sessionEvents(
              site.siteSlug,
              articleSlug,
              day,
              dayIndex,
              session,
              atSeconds + session * 137,
            ),
          );
        }
      });
    }
  }
  return events;
}

type Aggregate = {
  views: number;
  clicks: number;
  sessions: Set<string>;
  dwellTotal: number;
  dwellCount: number;
  scrollTotal: number;
  scrollCount: number;
  sampleCount: number;
  clicksByElement: Record<string, number>;
};

function emptyAggregate(): Aggregate {
  return {
    views: 0,
    clicks: 0,
    sessions: new Set(),
    dwellTotal: 0,
    dwellCount: 0,
    scrollTotal: 0,
    scrollCount: 0,
    sampleCount: 0,
    clicksByElement: {},
  };
}

function absorb(into: Aggregate, event: SeedEvent): void {
  into.sampleCount += 1;
  into.sessions.add(event.sessionKey);
  if (event.kind === "view") into.views += 1;
  if (event.kind === "click") {
    into.clicks += 1;
    if (event.elementKey !== null) {
      into.clicksByElement[event.elementKey] = (into.clicksByElement[event.elementKey] ?? 0) + 1;
    }
  }
  // 滞在と読み進みは、その種類の行だけの平均。ロールアップの式と同じ。
  if (event.kind === "dwell") {
    into.dwellTotal += event.dwellSeconds;
    into.dwellCount += 1;
  }
  if (event.kind === "scroll") {
    into.scrollTotal += event.positionRatio;
    into.scrollCount += 1;
  }
}

function average(total: number, count: number): number {
  return count === 0 ? 0 : Math.round((total / count) * 1000) / 1000;
}

/**
 * 成果と売上。**観測からは出ない**ので、ここで別に決める。
 *
 * ロールアップは売上の列に触れない（触れると再集計のたびに成果の記録が
 * 既定値へ戻る）。つまり日次集計の売上は別経路が書く値で、種でも
 * 別に作るのが実物に近い。
 *
 * **記事の単位でだけ**呼ぶこと。ブログの額はここで別に決めず、記事の合計を置く。
 */
function commerceOf(clicks: number, salt: number): { conversions: number; revenueMinor: number } {
  const conversions = Math.floor(clicks / 4);
  const unit = 1200 + (salt % 5) * 450;
  return { conversions, revenueMinor: conversions * unit };
}

/** 住所（独自ドメイン）。状態の分かれ目を全部作る。 */
function domainRows(
  input: OperationsSeedInput,
): readonly {
  id: string;
  siteSlug: string;
  hostname: string;
  status: CustomDomainStatus;
  certificateStatus: CertificateStatus;
  canonical: boolean;
  externalHostnameId: string | null;
  verificationToken: string | null;
  syncedDaysAgo: number | null;
  lastError: string | null;
}[] {
  const [hub, sub] = input.sites;
  if (hub === undefined) return [];
  const subSlug = sub?.siteSlug ?? hub.siteSlug;
  return [
    {
      id: "scd_seed_active",
      siteSlug: hub.siteSlug,
      hostname: "blog.seed-hub.test",
      status: "active",
      certificateStatus: "issued",
      // 正規の住所はブログごとに 1 つ。2 本目を canonical にすると索引が拒む。
      canonical: true,
      externalHostnameId: "chid_seed_active",
      verificationToken: null,
      syncedDaysAgo: 0,
      lastError: null,
    },
    {
      id: "scd_seed_pending",
      siteSlug: hub.siteSlug,
      hostname: "www.seed-hub.test",
      status: "pending",
      certificateStatus: "none",
      canonical: false,
      externalHostnameId: null,
      verificationToken: "seed-verify-2f4c8a",
      syncedDaysAgo: null,
      lastError: null,
    },
    {
      id: "scd_seed_revoked",
      siteSlug: hub.siteSlug,
      hostname: "old.seed-hub.test",
      status: "revoked",
      certificateStatus: "expired",
      canonical: false,
      externalHostnameId: "chid_seed_revoked",
      verificationToken: null,
      syncedDaysAgo: 30,
      lastError: null,
    },
    {
      id: "scd_seed_verifying",
      siteSlug: subSlug,
      hostname: "blog.seed-sub.test",
      status: "verifying",
      certificateStatus: "pending",
      canonical: false,
      externalHostnameId: "chid_seed_verifying",
      verificationToken: "seed-verify-91be07",
      syncedDaysAgo: 0,
      lastError: null,
    },
    {
      id: "scd_seed_failed",
      siteSlug: subSlug,
      hostname: "shop.seed-sub.test",
      status: "failed",
      certificateStatus: "error",
      canonical: false,
      externalHostnameId: "chid_seed_failed",
      verificationToken: "seed-verify-cc31d9",
      syncedDaysAgo: 1,
      lastError: "DNS に検証用のレコードが見つかりませんでした。",
    },
  ];
}

/**
 * SEO の指摘。**同じ記事の同じ観点は 1 行**（索引がそう決めている）。
 *
 * 重さと状態を順に回して、`open` だけの一覧・`dismissed` を含む一覧・
 * `applied` まで進んだ一覧のどれもが画面に出るようにする。
 */
function assessmentRows(input: OperationsSeedInput): readonly {
  id: string;
  siteSlug: string;
  articleSlug: string;
  checkKind: SeoCheckKind;
  severity: SeoSeverity;
  state: AssessmentState;
  detail: string;
  evidence: string;
  suggestion: string | null;
  dismissedReason: string | null;
}[] {
  const rows: {
    id: string;
    siteSlug: string;
    articleSlug: string;
    checkKind: SeoCheckKind;
    severity: SeoSeverity;
    state: AssessmentState;
    detail: string;
    evidence: string;
    suggestion: string | null;
    dismissedReason: string | null;
  }[] = [];
  let n = 0;
  for (const site of input.sites) {
    site.articleSlugs.forEach((articleSlug, articleIndex) => {
      // 1 記事につき 2 観点。全観点を全記事に付けると、一覧が
      // 「どの記事も同じだけ悪い」形になり、優先順位が読めない。
      for (let k = 0; k < 2; k += 1) {
        const checkKind = SEO_CHECK_KINDS[(articleIndex * 2 + k) % SEO_CHECK_KINDS.length];
        const severity = SEO_SEVERITIES[n % SEO_SEVERITIES.length];
        const state = ASSESSMENT_STATES[n % ASSESSMENT_STATES.length];
        rows.push({
          id: `asa_seed_${n}`,
          siteSlug: site.siteSlug,
          articleSlug,
          checkKind,
          severity,
          state,
          detail: `${checkKind} の観点で、機械が確かめられる不足が 1 件あります。`,
          // 根拠は非 null。空では登録できないので、種でも必ず現物を指す。
          evidence: `記事 ${articleSlug} の本文を走査した結果（観点: ${checkKind}）。`,
          suggestion:
            state === "dismissed" ? null : `${checkKind} を直す下書きを作れます。`,
          dismissedReason:
            state === "dismissed" ? "このブログでは意図してこの形にしています。" : null,
        });
        n += 1;
      }
    });
  }
  return rows;
}

/** AEO の引用単位。不足は `detectGaps` に出させ、手で書かない。 */
function answerUnitRows(
  input: OperationsSeedInput,
  now: Date,
): readonly { unit: AnswerUnit; gaps: readonly string[] }[] {
  const rows: { unit: AnswerUnit; gaps: readonly string[] }[] = [];
  let n = 0;
  for (const site of input.sites) {
    for (const articleSlug of site.articleSlugs) {
      for (let k = 0; k < 2; k += 1) {
        const kind = ANSWER_UNIT_KINDS[n % ANSWER_UNIT_KINDS.length];
        /*
         * 位置と出どころを回して、**不足が出る単位と出ない単位の両方**を作る。
         * 全部きれいだと、不足の一覧が空のまま画面を確かめることになる。
         */
        const positionRatio = k === 0 ? 0.2 : 0.75;
        const sourceRef = n % 3 === 0 ? null : `https://seed-source.test/${kind}`;
        const unit: AnswerUnit = {
          id: `aau_seed_${n}`,
          siteSlug: site.siteSlug,
          articleSlug,
          kind,
          question: `${articleSlug} は何を基準に選べばよいですか（観点 ${k + 1}）。`,
          answer:
            k === 0
              ? "予算・置き場所・音の 3 点を先に決めると、選択肢は 2 つか 3 つに絞れます。"
              : "その 3 点のうち、置き場所だけは後から変えにくいので最初に決めます。",
          positionRatio,
          sourceRef,
          extractedAt: now,
        };
        rows.push({ unit, gaps: detectGaps(unit) });
        n += 1;
      }
    }
  }
  return rows;
}

/**
 * 運営管理層 7 表ぶんの SQL を作る。
 *
 * 消す範囲は作業場所で縛る。ここで作る行は全部この作業場所のものなので、
 * 手で作った別の作業場所の行を巻き込まない。
 */
export function buildBlogOperationsSeedSql(input: OperationsSeedInput): readonly string[] {
  const ws = q(input.workspaceId);
  const now = new Date(input.nowSeconds * 1000);
  const out: string[] = [];

  out.push(
    `DELETE FROM article_answer_unit WHERE workspace_id = ${ws};`,
    `DELETE FROM site_aeo_profile WHERE workspace_id = ${ws};`,
    `DELETE FROM article_seo_assessment WHERE workspace_id = ${ws};`,
    `DELETE FROM article_daily_metric WHERE workspace_id = ${ws};`,
    `DELETE FROM site_daily_metric WHERE workspace_id = ${ws};`,
    `DELETE FROM reader_interaction_event WHERE workspace_id = ${ws};`,
    `DELETE FROM site_custom_domain WHERE workspace_id = ${ws};`,
  );

  for (const row of domainRows(input)) {
    const syncedAt =
      row.syncedDaysAgo === null
        ? null
        : input.nowSeconds - row.syncedDaysAgo * 24 * 60 * 60;
    out.push(
      `INSERT INTO site_custom_domain (id, workspace_id, site_slug, hostname, status, certificate_status, canonical, external_hostname_id, verification_token, synced_at, last_error, created_at, updated_at, deleted_at)
         VALUES (${q(row.id)}, ${ws}, ${q(row.siteSlug)}, ${q(row.hostname)}, ${q(row.status)}, ${q(row.certificateStatus)}, ${row.canonical ? 1 : 0}, ${text(row.externalHostnameId)}, ${text(row.verificationToken)}, ${num(syncedAt)}, ${text(row.lastError)}, ${input.nowSeconds - RETENTION_DAYS * 24 * 60 * 60}, ${input.nowSeconds}, NULL);`,
    );
  }

  const events = buildEvents(input);
  /*
   * 生イベントは 1 文にまとめて入れる。1 行 1 文にすると、
   * 2 週間ぶんで数千文になり、当てるだけで目に見えて待たされる。
   */
  const CHUNK = 200;
  for (let i = 0; i < events.length; i += CHUNK) {
    const values = events
      .slice(i, i + CHUNK)
      .map(
        (e) =>
          `(${q(e.id)}, ${ws}, ${q(e.siteSlug)}, ${q(e.articleSlug)}, ${q(e.kind)}, ${q(e.segment)}, ${q(e.viewportBand)}, ${e.positionRatio}, ${e.dwellSeconds}, ${text(e.elementKey)}, ${q(e.sessionKey)}, ${q(e.rollupDay)}, ${e.occurredAt})`,
      )
      .join(",\n         ");
    out.push(
      `INSERT INTO reader_interaction_event (id, workspace_id, site_slug, article_slug, kind, segment, viewport_band, position_ratio, dwell_seconds, element_key, session_key, rollup_day, occurred_at)
         VALUES ${values};`,
    );
  }

  /*
   * 日次集計は**生イベントから畳む**。ロールアップ
   * (`reader-metrics-repository.ts` の `rollupDay`) と同じ式で数える。
   * 手で数字を書くと、画面の合計と内訳が食い違ったときに、実装の誤りなのか
   * 種の書き間違いなのかを切り分けられない。
   */
  const bySite = new Map<string, Aggregate>();
  const byArticle = new Map<string, Aggregate>();
  /** 記事のキー → そのブログのキー。合計を足し戻すときに、組んだキーを解かずに済む。 */
  const siteKeyOfArticle = new Map<string, string>();
  for (const event of events) {
    const siteKey = `${event.siteSlug}\u0000${event.rollupDay}`;
    const articleKey = `${siteKey}\u0000${event.articleSlug}`;
    const site = bySite.get(siteKey) ?? emptyAggregate();
    absorb(site, event);
    bySite.set(siteKey, site);
    siteKeyOfArticle.set(articleKey, siteKey);
    const article = byArticle.get(articleKey) ?? emptyAggregate();
    absorb(article, event);
    byArticle.set(articleKey, article);
  }

  /*
   * 成果と売上は**記事にだけ**与え、ブログ側にはその合計を置く。
   *
   * ロールアップは売上の列に触れないので、「ブログの売上 = 記事の売上の合計」を
   * 機械で守っている場所が無い。ここで両側を別々に決めると、画面の合計と内訳が
   * 静かに食い違い、実装の誤りなのか種の誤りなのかを切り分けられなくなる。
   * 逆向き（ブログの額を記事へ配る）にすると端数の置き場所を決める話になるので、
   * **記事を先に決めて足す**向きにしている。
   */
  let salt = 0;
  const zeroCommerce = { conversions: 0, revenueMinor: 0 } as const;
  const commerceByArticle = new Map<string, { conversions: number; revenueMinor: number }>();
  const commerceBySite = new Map<string, { conversions: number; revenueMinor: number }>();
  for (const [key, agg] of byArticle) {
    const commerce = commerceOf(agg.clicks, (salt += 1));
    commerceByArticle.set(key, commerce);
    const siteKey = siteKeyOfArticle.get(key);
    if (siteKey === undefined) continue;
    const total = commerceBySite.get(siteKey) ?? zeroCommerce;
    commerceBySite.set(siteKey, {
      conversions: total.conversions + commerce.conversions,
      revenueMinor: total.revenueMinor + commerce.revenueMinor,
    });
  }

  for (const [key, agg] of bySite) {
    const [siteSlug, day] = key.split("\u0000");
    const { conversions, revenueMinor } = commerceBySite.get(key) ?? zeroCommerce;
    out.push(
      `INSERT INTO site_daily_metric (workspace_id, site_slug, day, views, unique_sessions, clicks, conversions, revenue_minor, average_dwell_seconds, average_scroll_ratio, sample_count, computed_at)
         VALUES (${ws}, ${q(String(siteSlug))}, ${q(String(day))}, ${agg.views}, ${agg.sessions.size}, ${agg.clicks}, ${conversions}, ${revenueMinor}, ${average(agg.dwellTotal, agg.dwellCount)}, ${average(agg.scrollTotal, agg.scrollCount)}, ${agg.sampleCount}, ${input.nowSeconds});`,
    );
  }
  for (const [key, agg] of byArticle) {
    const [siteSlug, day, articleSlug] = key.split("\u0000");
    const { conversions, revenueMinor } = commerceByArticle.get(key) ?? zeroCommerce;
    out.push(
      `INSERT INTO article_daily_metric (workspace_id, site_slug, article_slug, day, views, unique_sessions, clicks, conversions, revenue_minor, average_dwell_seconds, average_scroll_ratio, clicks_by_element, sample_count, computed_at)
         VALUES (${ws}, ${q(String(siteSlug))}, ${q(String(articleSlug))}, ${q(String(day))}, ${agg.views}, ${agg.sessions.size}, ${agg.clicks}, ${conversions}, ${revenueMinor}, ${average(agg.dwellTotal, agg.dwellCount)}, ${average(agg.scrollTotal, agg.scrollCount)}, ${q(JSON.stringify(agg.clicksByElement))}, ${agg.sampleCount}, ${input.nowSeconds});`,
    );
  }

  for (const row of assessmentRows(input)) {
    out.push(
      `INSERT INTO article_seo_assessment (id, workspace_id, site_slug, article_slug, check_kind, severity, state, detail, evidence, suggestion, draft_revision_id, dismissed_reason, assessed_at, updated_at)
         VALUES (${q(row.id)}, ${ws}, ${q(row.siteSlug)}, ${q(row.articleSlug)}, ${q(row.checkKind)}, ${q(row.severity)}, ${q(row.state)}, ${q(row.detail)}, ${q(row.evidence)}, ${text(row.suggestion)}, NULL, ${text(row.dismissedReason)}, ${input.nowSeconds}, ${input.nowSeconds});`,
    );
  }

  input.sites.forEach((site, index) => {
    out.push(
      `INSERT INTO site_aeo_profile (workspace_id, site_slug, topic_scope, audience, publisher_name, structured_data_enabled, updated_at)
         VALUES (${ws}, ${q(site.siteSlug)}, ${q("作業机まわりの道具選び")}, ${q("はじめて一式そろえる人")}, ${q("ローカル検証")}, ${index === 0 ? 1 : 0}, ${input.nowSeconds});`,
    );
  });

  for (const { unit, gaps } of answerUnitRows(input, now)) {
    out.push(
      `INSERT INTO article_answer_unit (id, workspace_id, site_slug, article_slug, kind, question, answer, position_ratio, source_ref, gaps, extracted_at)
         VALUES (${q(unit.id)}, ${ws}, ${q(unit.siteSlug)}, ${q(unit.articleSlug)}, ${q(unit.kind)}, ${q(unit.question)}, ${q(unit.answer)}, ${unit.positionRatio}, ${text(unit.sourceRef)}, ${q(JSON.stringify(gaps))}, ${input.nowSeconds});`,
    );
  }

  return out;
}

/** 検査から参照するための、この種が触る表の一覧。 */
export const OPERATIONS_SEED_TABLES = [
  "site_custom_domain",
  "reader_interaction_event",
  "site_daily_metric",
  "article_daily_metric",
  "article_seo_assessment",
  "site_aeo_profile",
  "article_answer_unit",
] as const;

/** 種が全部の区分を作れているかを検査が確かめるための、期待する区分。 */
export const OPERATIONS_SEED_ENUMS = {
  customDomainStatuses: CUSTOM_DOMAIN_STATUSES,
  certificateStatuses: CERTIFICATE_STATUSES,
  interactionKinds: INTERACTION_KINDS,
  readerSegments: READER_SEGMENTS,
  viewportBands: VIEWPORT_BANDS,
  seoSeverities: SEO_SEVERITIES,
  assessmentStates: ASSESSMENT_STATES,
  answerUnitKinds: ANSWER_UNIT_KINDS,
} as const;
