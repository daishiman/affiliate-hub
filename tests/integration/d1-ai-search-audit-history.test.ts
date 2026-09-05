/**
 * @tier 2
 * @req REQ-SEO07
 * @types boundary, db-migration, equivalence, tenant-isolation
 */
import { drizzle } from "drizzle-orm/d1";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getPlatformProxy } from "wrangler";
import type { AiSearchAuditHistoryPort } from "@/application/ports/seo";
import type { PublishedArticle } from "@/application/read-models/published-article";
import { auditArticleForAiSearch } from "@/application/seo/ai-search-audit";
import {
  AUDIT_HISTORY_WINDOW,
  type RecordAiSearchAuditDeps,
  recordAiSearchAudit,
} from "@/application/usecases/seo/record-ai-search-audit";
import {
  REAUDIT_BATCH_LIMIT,
  reauditStaleArticles,
} from "@/application/usecases/seo/reaudit-stale-articles";
import * as schema from "@/db/schema";
import type { WorkspaceId } from "@/domain/shared";
import { createD1AiSearchAuditHistoryRepository } from "@/infrastructure/persistence/d1/ai-search-audit-history-repository";
import { createD1PublishedArticleWriter } from "@/infrastructure/persistence/d1/published-article-repository";
import { SAMPLE_WORKSPACE_ID } from "@/infrastructure/persistence/sample/ranking-sample-repository";
import {
  SAMPLE_SITE_SLUG,
  sampleSites,
} from "@/infrastructure/persistence/sample/site-sample-repository";
import { NOW, daysFrom } from "../support/clock";
import { migrationStatements } from "../support/migrations";

/**
 * 点検履歴の保持窓（受入 A3）と定期再点検（受入 A4）を、
 * **本物の D1 と本物のマイグレーション**で見る。
 *
 * --- なぜ結合でしか分からないのか ---
 * 保持窓の刈り取りは SQL の `DELETE ... WHERE id NOT IN (SELECT ... LIMIT 30)` に、
 * 再点検の対象選びは `LEFT JOIN` と `ORDER BY` に閉じている。覚え書きの保存先で
 * 代役を立てると、そこで検査するのは**代役の実装**であって、本番で走る SQL ではない。
 * 次の 3 つはここでしか分からない:
 *
 *   1. マイグレーション 0044 が表と索引を本当に作れるか
 *   2. 追記と刈り取りが同じ batch（=同じトランザクション）で完結するか
 *   3. 同じ秒に入った 2 行の消える順が、実行のたびに変わらないか
 *
 * --- 偽の時計を使わない ---
 * `vi.useFakeTimers()` を呼ばない。点検も再点検も時刻を引数で受け取る設計なので、
 * 時計を差し替える必要が無い。差し替えると、仕込み忘れた 1 本が実時間で走って
 * 「たまに落ちる」形になる。
 */

type TestEnv = { readonly DB: D1Database };
type Proxy = Awaited<ReturnType<typeof getPlatformProxy<TestEnv>>>;

const workspaceId = SAMPLE_WORKSPACE_ID as WorkspaceId;

/** 隣の作業場所。境界の検査は、隣が実在しないと成立しない。 */
const OTHER_WORKSPACE_ID = "ws_audit_other" as WorkspaceId;
const OTHER_SITE_SLUG = "other-tenant-desk";

/*
  公開行を置く前に、その**サイトが実在すること**を用意する。
  移行 0035 の `published_articles_reject_tombstone_on_insert` は
  「`site_blueprints` に同じ slug と workspace の行が無い INSERT」を
  `RAISE(ABORT, 'published_article_url_state_conflict')` で拒む。
  この不変条件をアプリではなく DB 境界に置いているので、
  結合テストも本番と同じ前提を自分で用意する義務を負う。
  用意を忘れると、writer は例外を利用者向けの一文
  「この URL の名前は使えません。」へ翻訳して返す——原因は見えない。
*/
const sampleBlueprint = sampleSites().find((site) => site.slug === SAMPLE_SITE_SLUG)?.blueprint;
if (sampleBlueprint === undefined) throw new Error("見本ブログの設計図が見つかりません。");

let proxy: Proxy;
let history: AiSearchAuditHistoryPort;
let writer: ReturnType<typeof createD1PublishedArticleWriter>;

/** 履歴の id を順番に配る。本物は UUID なので、そのままでは前後を比べられない。 */
function idsFrom(prefix: string) {
  let n = 0;
  return {
    newId: () => {
      n += 1;
      return `${prefix}-${String(n).padStart(4, "0")}`;
    },
  };
}

function anArticle(over: Partial<PublishedArticle> = {}): PublishedArticle {
  return {
    slug: "quiet-laptop",
    siteSlug: SAMPLE_SITE_SLUG,
    type: "guide",
    title: "静かなノートパソコンの選び方",
    summary: "ファンの音が気になるなら、まず放熱の設計を見てください。",
    categorySlug: "chairs",
    publishedAt: "2026-08-17",
    updatedAt: "2026-08-17",
    author: {
      slug: "author-nakata",
      name: "中田 涼",
      bio: "騒音計を持ち歩いて 4 年、実測した機種は 120 台。",
      credentials: ["騒音測定の実務経験 4 年"],
    },
    disclosureRequired: true,
    sections: [
      {
        id: "body",
        heading: "本文",
        paragraphs: ["排気口の位置で体感はかなり変わります。"],
      },
    ],
    ...over,
  };
}

/** 履歴を `count` 件、`at` から 1 分ずつ古い側へ並べて仕込む。刈り取りは効かせない。 */
async function seedHistory(article: PublishedArticle, count: number, at: Date): Promise<void> {
  const ids = idsFrom("seed");
  for (let i = 0; i < count; i += 1) {
    const result = await history.record(
      {
        id: ids.newId(),
        workspaceId,
        siteSlug: article.siteSlug,
        slug: article.slug,
        trigger: "scheduled",
        checks: auditArticleForAiSearch(article, NOW),
        analyzerVersion: "1",
        // 新しいものから 1 分ずつ古くする。並びが決まるようにわざとずらす。
        checkedAt: new Date(at.getTime() - i * 60_000),
      },
      // 仕込みでは刈らない。刈り取りそのものを見るのはこの後の追記 1 回。
      10_000,
    );
    if (!result.ok) throw new Error(`履歴の仕込みに失敗しました: ${JSON.stringify(result.error)}`);
  }
}

async function rowsOf(article: PublishedArticle) {
  return await proxy.env.DB.prepare(
    "SELECT id, trigger, passed_count, total_count, checks_json, checked_at" +
      " FROM ai_search_audit_history WHERE site_slug = ? AND slug = ?" +
      " ORDER BY checked_at DESC, id DESC",
  )
    .bind(article.siteSlug, article.slug)
    .all<{
      readonly id: string;
      readonly trigger: string;
      readonly passed_count: number;
      readonly total_count: number;
      readonly checks_json: string;
      readonly checked_at: number;
    }>();
}

/** 記事を読者に出す。出していない記事は再点検も一覧も対象にしない。 */
async function publish(article: PublishedArticle): Promise<void> {
  const saved = await writer.save(workspaceId, article);
  if (!saved.ok) throw new Error(`記事の保存に失敗しました: ${JSON.stringify(saved.error)}`);
}

/** 通った／落ちた点検を 1 行、指定の時刻で仕込む。 */
async function recordAt(
  article: PublishedArticle,
  id: string,
  at: Date,
  passed: boolean,
): Promise<void> {
  const result = await history.record(
    {
      id,
      workspaceId,
      siteSlug: article.siteSlug,
      slug: article.slug,
      trigger: "scheduled",
      checks: [
        { check: "冒頭に結論がある", ok: true, hint: "一文の結論を書く。" },
        { check: "要点が箇条で読める", ok: passed, hint: "要点を 3〜5 個の箇条書きにする。" },
      ],
      analyzerVersion: "1",
      checkedAt: at,
    },
    10_000,
  );
  if (!result.ok) throw new Error(`履歴の仕込みに失敗しました: ${JSON.stringify(result.error)}`);
}

/**
 * 公開 API では作れない、境界が食い違った古い履歴を DB に直接置く。
 * JOIN / GROUP BY / 相関副問い合わせの workspace 条件は、こうした不整合行が
 * 隣に存在する入力でしか効いていることを証明できない。
 */
async function insertRawHistory(input: {
  readonly id: string;
  readonly rowWorkspaceId: WorkspaceId;
  readonly siteSlug: string;
  readonly slug: string;
  readonly checkedAt: Date;
  readonly passed: boolean;
}): Promise<void> {
  const checks = [
    {
      check: "要点が箇条で読める",
      ok: input.passed,
      hint: "要点を 3〜5 個の箇条書きにする。",
    },
  ];
  await proxy.env.DB.prepare(
    `INSERT INTO ai_search_audit_history
      (id, workspace_id, site_slug, slug, trigger, passed_count, total_count,
       checks_json, analyzer_version, checked_at)
     VALUES (?, ?, ?, ?, 'scheduled', ?, ?, ?, '1', ?)`,
  )
    .bind(
      input.id,
      String(input.rowWorkspaceId),
      input.siteSlug,
      input.slug,
      input.passed ? 1 : 0,
      checks.length,
      JSON.stringify(checks),
      Math.floor(input.checkedAt.getTime() / 1000),
    )
    .run();
}

function depsAt(now: Date, prefix = "aud"): RecordAiSearchAuditDeps {
  return { history, ids: idsFrom(prefix), now: () => now };
}

beforeAll(async () => {
  proxy = await getPlatformProxy<TestEnv>({
    configPath: "wrangler.jsonc",
    environment: "dev",
    persist: false,
  });
  for (const statement of migrationStatements()) {
    await proxy.env.DB.prepare(statement).run();
  }
  const db = drizzle(proxy.env.DB, { schema });
  history = createD1AiSearchAuditHistoryRepository(db);
  writer = createD1PublishedArticleWriter(db);
}, 60_000);

afterAll(async () => {
  await proxy?.dispose();
});

beforeEach(async () => {
  await proxy.env.DB.prepare("DELETE FROM ai_search_audit_history").run();
  await proxy.env.DB.prepare("DELETE FROM published_articles").run();
  await proxy.env.DB.prepare("DELETE FROM published_article_tombstones").run();
  await proxy.env.DB.prepare("DELETE FROM site_blueprints").run();
  await proxy.env.DB.prepare(
    `INSERT INTO site_blueprints
      (id, workspace_id, slug, name, pattern, published_at, blueprint_json)
     VALUES ('sb_audit_owner', ?, ?, '所有ブログ', 'specialist_review', unixepoch(), ?)`,
  )
    .bind(String(workspaceId), SAMPLE_SITE_SLUG, JSON.stringify(sampleBlueprint))
    .run();
  /*
    **隣の作業場所**も用意する。1 つしか無い環境では「絞り忘れ」と「絞れている」が
    同じ結果になり、境界の検査そのものが成立しない。
  */
  await proxy.env.DB.prepare(
    `INSERT INTO site_blueprints
      (id, workspace_id, slug, name, pattern, published_at, blueprint_json)
     VALUES ('sb_audit_other', ?, ?, '隣のブログ', 'specialist_review', unixepoch(), ?)`,
  )
    .bind(String(OTHER_WORKSPACE_ID), OTHER_SITE_SLUG, JSON.stringify(sampleBlueprint))
    .run();
});

describe("点検履歴の保持窓", () => {
  it("履歴の無い記事を 1 回公開すると、公開時の判定が 1 行残る", async () => {
    const article = anArticle();
    const checks = auditArticleForAiSearch(article, NOW);

    const saved = await recordAiSearchAudit(depsAt(NOW), {
      workspaceId,
      article,
      trigger: "publish",
      checks,
    });
    expect(saved.ok).toBe(true);

    const { results } = await rowsOf(article);
    expect(results).toHaveLength(1);
    const row = results[0];
    expect(row?.trigger).toBe("publish");
    // 通った数と総数は、画面に出したのと同じ判定から数えたものでなければならない。
    expect(row?.passed_count).toBe(checks.filter((check) => check.ok).length);
    expect(row?.total_count).toBe(checks.length);
    // 落ちた項目の直し方（hint）まで残す。残さないと、後から「何を直せば通るか」が消える。
    const stored = JSON.parse(row?.checks_json ?? "[]") as readonly {
      check: string;
      ok: boolean;
      hint: string;
    }[];
    expect(stored).toHaveLength(checks.length);
    expect(stored.map((item) => item.check)).toEqual(checks.map((check) => check.check));
    for (const item of stored) expect(typeof item.hint).toBe("string");
  });

  it("履歴 29 件のところへ 1 件足すと 30 件になり、1 行も消えない", async () => {
    const article = anArticle();
    await seedHistory(article, AUDIT_HISTORY_WINDOW - 1, NOW);
    const before = (await rowsOf(article)).results.map((row) => row.id);

    await recordAiSearchAudit(depsAt(daysFrom(NOW, 1)), {
      workspaceId,
      article,
      trigger: "publish",
      checks: auditArticleForAiSearch(article, NOW),
    });

    const after = (await rowsOf(article)).results.map((row) => row.id);
    expect(after).toHaveLength(AUDIT_HISTORY_WINDOW);
    // 保持窓ちょうどの手前では、既にある行は 1 つも触られない。
    expect(new Set(after)).toEqual(new Set([...before, "aud-0001"]));
  });

  it("履歴 30 件のところへ 1 件足すと 30 件のまま、最古の 1 行だけが消える", async () => {
    const article = anArticle();
    await seedHistory(article, AUDIT_HISTORY_WINDOW, NOW);
    const before = await rowsOf(article);
    const oldest = before.results[before.results.length - 1];

    await recordAiSearchAudit(depsAt(daysFrom(NOW, 1)), {
      workspaceId,
      article,
      trigger: "publish",
      checks: auditArticleForAiSearch(article, NOW),
    });

    const after = await rowsOf(article);
    expect(after.results).toHaveLength(AUDIT_HISTORY_WINDOW);
    /*
      **id の集合で比べる。** 件数だけを見ると「全部消して 30 件入れ直した」実装でも
      通ってしまう。履歴は追記の記録なので、入れ直しは記録の意味を壊す。
    */
    const survived = new Set(after.results.map((row) => row.id));
    expect(survived.has(oldest?.id ?? "")).toBe(false);
    for (const row of before.results.slice(0, AUDIT_HISTORY_WINDOW - 1)) {
      expect(survived.has(row.id)).toBe(true);
      const still = after.results.find((item) => item.id === row.id);
      // 残った行は時刻も中身も動かない。
      expect(still?.checked_at).toBe(row.checked_at);
      expect(still?.checks_json).toBe(row.checks_json);
    }
  });

  it("履歴が 40 件まで溜まっていても、1 回の追記で 30 件へ戻る", async () => {
    const article = anArticle();
    await seedHistory(article, 40, NOW);

    await recordAiSearchAudit(depsAt(daysFrom(NOW, 1)), {
      workspaceId,
      article,
      trigger: "publish",
      checks: auditArticleForAiSearch(article, NOW),
    });

    // 「古い 1 件を消す」書き方だと、ここは 40 件のままになる。
    expect((await rowsOf(article)).results).toHaveLength(AUDIT_HISTORY_WINDOW);
  });

  it("同じ秒に 2 行入っていても、消える行は実行のたびに変わらない", async () => {
    const article = anArticle();
    const sameSecond = NOW;
    const ids = idsFrom("tie");
    // 保持窓ちょうどを、末尾 2 行が同じ秒になるように仕込む。
    for (let i = 0; i < AUDIT_HISTORY_WINDOW; i += 1) {
      const at = i >= AUDIT_HISTORY_WINDOW - 2 ? new Date(sameSecond.getTime() - 3_600_000) : new Date(sameSecond.getTime() - i * 60_000);
      await history.record(
        {
          id: ids.newId(),
          workspaceId,
          siteSlug: article.siteSlug,
          slug: article.slug,
          trigger: "scheduled",
          checks: auditArticleForAiSearch(article, NOW),
          analyzerVersion: "1",
          checkedAt: at,
        },
        10_000,
      );
    }

    await recordAiSearchAudit(depsAt(daysFrom(NOW, 1)), {
      workspaceId,
      article,
      trigger: "publish",
      checks: auditArticleForAiSearch(article, NOW),
    });

    const after = (await rowsOf(article)).results.map((row) => row.id);
    expect(after).toHaveLength(AUDIT_HISTORY_WINDOW);
    /*
      同じ秒の 2 行のうち、id の小さいほう（`tie-0029`）が落ちる。
      `ORDER BY checked_at DESC, id DESC` の第 2 キーを外すと、
      どちらが落ちるかは実行計画次第になり、この検査が揺れる。
    */
    expect(after).not.toContain("tie-0029");
    expect(after).toContain("tie-0030");
  });
});

describe("定期再点検", () => {
  it("最後の点検が 8 日前の記事は、再点検されて 1 行増える", async () => {
    const article = anArticle();
    await publish(article);
    await seedHistory(article, 1, daysFrom(NOW, -8));

    const result = await reauditStaleArticles(depsAt(NOW), { now: NOW });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({ scanned: 1, recorded: 1, failed: 0 });

    const rows = (await rowsOf(article)).results;
    expect(rows).toHaveLength(2);
    // 追記された行は「定期点検で入った」と名乗る。公開時の行と混ざらない。
    expect(rows[0]?.trigger).toBe("scheduled");
  });

  it("最後の点検が 6 日前の記事は、まだ再点検しない", async () => {
    const article = anArticle();
    await publish(article);
    await seedHistory(article, 1, daysFrom(NOW, -6));

    const result = await reauditStaleArticles(depsAt(NOW), { now: NOW });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.scanned).toBe(0);
    expect((await rowsOf(article)).results).toHaveLength(1);
  });

  it("ちょうど 7 日前の記事は再点検する（境界を含む）", async () => {
    const article = anArticle();
    await publish(article);
    await seedHistory(article, 1, daysFrom(NOW, -7));

    const result = await reauditStaleArticles(depsAt(NOW), { now: NOW });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.recorded).toBe(1);
    expect((await rowsOf(article)).results).toHaveLength(2);
  });

  it("履歴が 1 件も無い記事は、いちばん先に再点検される", async () => {
    const never = anArticle({ slug: "never-checked" });
    const old = anArticle({ slug: "checked-long-ago" });
    await publish(never);
    await publish(old);
    await seedHistory(old, 1, daysFrom(NOW, -30));

    const result = await reauditStaleArticles(depsAt(NOW), { now: NOW });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.recorded).toBe(2);

    /*
      一度も点検していない記事が先頭に来る。SQLite の NULL 順に頼ると
      方言が変わった日に黙って入れ替わるので、id の若い順で確かめる
      （id は取り出した順に配られる）。
    */
    const first = await proxy.env.DB.prepare(
      "SELECT slug FROM ai_search_audit_history WHERE id = 'aud-0001'",
    ).first<{ readonly slug: string }>();
    expect(first?.slug).toBe("never-checked");
  });

  it("取り下げた記事は再点検しない", async () => {
    const article = anArticle();
    await publish(article);
    await proxy.env.DB.prepare(
      "UPDATE published_articles SET archived_at = ? WHERE site_slug = ? AND slug = ?",
    )
      .bind(NOW.toISOString(), article.siteSlug, article.slug)
      .run();

    const result = await reauditStaleArticles(depsAt(NOW), { now: NOW });
    expect(result.ok).toBe(true);
    // 読者に出ていない記事を点検しても、直す先が無い。
    if (result.ok) expect(result.value).toEqual({ scanned: 0, recorded: 0, failed: 0 });
  });

  it("対象が 60 件あっても、1 回の起動で触るのは 50 件ちょうど", async () => {
    for (let i = 0; i < 60; i += 1) {
      await publish(anArticle({ slug: `stale-${String(i).padStart(2, "0")}` }));
    }

    const result = await reauditStaleArticles(depsAt(NOW), { now: NOW });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.scanned).toBe(REAUDIT_BATCH_LIMIT);

    const counted = await proxy.env.DB.prepare(
      "SELECT count(*) AS n FROM ai_search_audit_history",
    ).first<{ readonly n: number }>();
    // 上限を外すと、記事が増えた日に cron の実行時間だけが黙って伸びる。
    expect(counted?.n).toBe(REAUDIT_BATCH_LIMIT);
  }, 60_000);

  it("1 回の起動で、同じ記事に 2 行足さない", async () => {
    const article = anArticle();
    await publish(article);

    await reauditStaleArticles(depsAt(NOW), { now: NOW });

    expect((await rowsOf(article)).results).toHaveLength(1);
  });
});

describe("最新の点検だけを見る", () => {
  /*
    test-design の T5-2。「過去に落ちたことがある記事」を拾う実装と
    「最新で落ちている記事」を拾う実装は、履歴が 1 件の記事では同じ結果になる。
    **履歴 2 件で判定が割れる**入力でしか区別できない。
    そしてその判定は SQL の相関副問い合わせにあるので、
    保存先の代役を立てた単体テストでは見られない（見えるのは代役の実装）。
  */

  it("3 日前に落ちて昨日通った記事は、一覧に出ない", async () => {
    const article = anArticle({ slug: "fixed-article" });
    await publish(article);
    await recordAt(article, "hist-0001", daysFrom(NOW, -3), false);
    await recordAt(article, "hist-0002", daysFrom(NOW, -1), true);

    const listed = await history.listLatestFailing({ workspaceId, limit: 50 });

    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    // 直した記事が一覧に残り続けると、運営者は「直っていない」と読む。
    expect(listed.value).toHaveLength(0);
  });

  it("3 日前に通って昨日落ちた記事は、一覧に出る", async () => {
    const article = anArticle({ slug: "broken-article" });
    await publish(article);
    await recordAt(article, "hist-0001", daysFrom(NOW, -3), true);
    await recordAt(article, "hist-0002", daysFrom(NOW, -1), false);

    const listed = await history.listLatestFailing({ workspaceId, limit: 50 });

    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.map((row) => row.slug)).toEqual(["broken-article"]);
    // 落ちた項目の文言は、点検した当時のものがそのまま残る。
    expect(listed.value[0]?.checks.filter((check) => !check.ok)).toEqual([
      { check: "要点が箇条で読める", ok: false, hint: "要点を 3〜5 個の箇条書きにする。" },
    ]);
  });

  it("取り下げた記事は、最新が落ちていても一覧に出ない", async () => {
    const article = anArticle({ slug: "archived-article" });
    await publish(article);
    await recordAt(article, "hist-0001", daysFrom(NOW, -1), false);
    await proxy.env.DB.prepare(
      "UPDATE published_articles SET archived_at = ? WHERE site_slug = ? AND slug = ?",
    )
      .bind(NOW.toISOString(), article.siteSlug, article.slug)
      .run();

    const listed = await history.listLatestFailing({ workspaceId, limit: 50 });

    expect(listed.ok).toBe(true);
    if (listed.ok) expect(listed.value).toHaveLength(0);
  });

  it("並びは点検日の新しい順で、同時刻は URL の名前の昇順になる", async () => {
    const older = anArticle({ slug: "b-older" });
    const tieA = anArticle({ slug: "a-tie" });
    const tieC = anArticle({ slug: "c-tie" });
    for (const article of [older, tieA, tieC]) await publish(article);
    await recordAt(older, "hist-0001", daysFrom(NOW, -3), false);
    await recordAt(tieC, "hist-0002", daysFrom(NOW, -1), false);
    await recordAt(tieA, "hist-0003", daysFrom(NOW, -1), false);

    const listed = await history.listLatestFailing({ workspaceId, limit: 50 });

    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    // 同時刻で並びが決まらないと、画面の順が読み込むたびに入れ替わる。
    expect(listed.value.map((row) => row.slug)).toEqual(["a-tie", "c-tie", "b-older"]);
  });
});

/**
 * 作業場所の境界。
 *
 * `listLatestFailing` の `where` から `workspace_id` を落としても、
 * 作業場所が 1 つしか無い環境では**全テストが緑のまま**になる。
 * 隣の作業場所に落ちた記事を実際に置いて、初めてその 1 行が意味を持つ。
 *
 * 刈り取り（`record` の DELETE）側も同じ理由でここで見る。今は
 * `(site_slug, slug)` が全体で一意なので結果は変わらないが、
 * **消す操作**なので、その一意性が崩れた日に他人の履歴を巻き込まない形にしておく。
 */
describe("隣の作業場所のものは見えないし、触らない", () => {
  /** 隣の作業場所に、落ちた点検を持つ公開記事を 1 本用意する。 */
  async function seedNeighbour(slug: string, at: Date): Promise<void> {
    const article = anArticle({ slug, siteSlug: OTHER_SITE_SLUG });
    const saved = await writer.save(OTHER_WORKSPACE_ID, article);
    if (!saved.ok) throw new Error(`隣の記事の保存に失敗しました: ${JSON.stringify(saved.error)}`);
    const result = await history.record(
      {
        id: `other-${slug}`,
        workspaceId: OTHER_WORKSPACE_ID,
        siteSlug: OTHER_SITE_SLUG,
        slug,
        trigger: "scheduled",
        checks: [{ check: "要点が箇条で読める", ok: false, hint: "要点を箇条書きにする。" }],
        analyzerVersion: "1",
        checkedAt: at,
      },
      10_000,
    );
    if (!result.ok) throw new Error(`隣の履歴の仕込みに失敗: ${JSON.stringify(result.error)}`);
  }

  it("隣の作業場所で落ちている記事は、こちらの一覧に出ない", async () => {
    await seedNeighbour("neighbour-broken", daysFrom(NOW, -1));
    const mine = anArticle({ slug: "my-broken" });
    await publish(mine);
    await recordAt(mine, "hist-0001", daysFrom(NOW, -2), false);

    const listed = await history.listLatestFailing({ workspaceId, limit: 50 });

    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    /*
      隣の記事のほうが**新しい**ので、絞りを落とすと並びの先頭に来る。
      日付をわざとこの向きにしてある——同じ日付だと、絞り漏れが
      「たまたま自分の 1 件だけ返った」で隠れうる。
    */
    expect(listed.value.map((row) => row.slug)).toEqual(["my-broken"]);
  });

  it("隣の履歴が同じ URL 座標を名乗っても、こちらの未点検記事を点検済みにしない", async () => {
    const mine = anArticle({ slug: "never-checked-by-us" });
    await publish(mine);
    await insertRawHistory({
      id: "other-claims-my-url",
      rowWorkspaceId: OTHER_WORKSPACE_ID,
      siteSlug: mine.siteSlug,
      slug: mine.slug,
      checkedAt: NOW,
      passed: true,
    });

    const stale = await history.listStale({ before: daysFrom(NOW, -7), limit: 50 });

    expect(stale.ok).toBe(true);
    if (!stale.ok) return;
    expect(stale.value.map((target) => target.article.slug)).toContain(mine.slug);
  });

  it("点検範囲の集計も、隣の公開記事や同じ URL 座標を名乗る履歴を数えない", async () => {
    const mine = anArticle({ slug: "coverage-is-mine" });
    await publish(mine);
    await seedNeighbour("neighbour-not-counted", daysFrom(NOW, -1));
    await insertRawHistory({
      id: "other-claims-coverage-url",
      rowWorkspaceId: OTHER_WORKSPACE_ID,
      siteSlug: mine.siteSlug,
      slug: mine.slug,
      checkedAt: NOW,
      passed: true,
    });

    const coverage = await history.getCoverage({ workspaceId });

    expect(coverage.ok).toBe(true);
    if (!coverage.ok) return;
    expect(coverage.value).toEqual({ publishedCount: 1, auditedCount: 0 });
  });

  it("隣の新しい履歴が同じ URL 座標を名乗っても、こちらの最新判定を隠さない", async () => {
    const mine = anArticle({ slug: "latest-stays-mine" });
    await publish(mine);
    await recordAt(mine, "mine-failing", daysFrom(NOW, -2), false);
    await insertRawHistory({
      id: "other-newer-passing",
      rowWorkspaceId: OTHER_WORKSPACE_ID,
      siteSlug: mine.siteSlug,
      slug: mine.slug,
      checkedAt: daysFrom(NOW, -1),
      passed: true,
    });

    const listed = await history.listLatestFailing({ workspaceId, limit: 50 });

    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.map((row) => row.slug)).toEqual([mine.slug]);
  });

  it("こちら名義の不整合履歴でも、隣の公開記事とは結合しない", async () => {
    await seedNeighbour("neighbour-title-must-not-leak", daysFrom(NOW, -2));
    await insertRawHistory({
      id: "mine-claims-neighbour-url",
      rowWorkspaceId: workspaceId,
      siteSlug: OTHER_SITE_SLUG,
      slug: "neighbour-title-must-not-leak",
      checkedAt: daysFrom(NOW, -1),
      passed: false,
    });

    const listed = await history.listLatestFailing({ workspaceId, limit: 50 });

    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value).toHaveLength(0);
  });

  it("こちらの刈り取りは、隣の作業場所の履歴を 1 行も減らさない", async () => {
    /*
      **この検査が今どこまで見ているかを正直に書いておく。**

      `record` の刈り取りは `workspace_id AND site_slug AND slug` で絞る。
      今の DB では `site_blueprints` の `(workspace_id, slug)` 制約により
      **隣の作業場所が同じ site_slug を持てない**ので、`workspace_id` の 1 行を
      落としても `site_slug` の側で分かれ、この検査は赤くならない。
      つまりここが見ているのは「刈り取りが自分の範囲を超えない」までで、
      `workspace_id` 単独の効きは**現時点では観測できない**。

      それでも置く理由は 2 つ。site_slug の全体一意が崩れた日に、
      この形の検査が既にあれば隣を消す実装は赤で止まる。そしてもう 1 つ、
      「刈り取りの範囲を測っていない」状態そのものを残さないためである。
    */
    await seedNeighbour("neighbour-kept", daysFrom(NOW, -1));
    const mine = anArticle({ slug: "my-pruned" });
    await publish(mine);
    await recordAt(mine, "mine-0001", daysFrom(NOW, -3), false);
    // 保持窓 1 で自分側を刈る。自分の古い 1 行だけが消えるはず。
    await recordAt(mine, "mine-0002", NOW, true);
    const pruned = await history.record(
      {
        id: "mine-0003",
        workspaceId,
        siteSlug: SAMPLE_SITE_SLUG,
        slug: "my-pruned",
        trigger: "publish",
        checks: [{ check: "要点が箇条で読める", ok: true, hint: "要点を箇条書きにする。" }],
        analyzerVersion: "1",
        checkedAt: NOW,
      },
      1,
    );
    expect(pruned.ok).toBe(true);

    const left = await proxy.env.DB.prepare(
      "SELECT id FROM ai_search_audit_history WHERE workspace_id = ? ORDER BY id",
    )
      .bind(String(OTHER_WORKSPACE_ID))
      .all<{ readonly id: string }>();
    expect(left.results.map((row) => row.id)).toEqual(["other-neighbour-kept"]);
    // 自分側は保持窓 1 のとおり最新 1 行だけが残る（刈り取りが効いていることの床）。
    const ours = await proxy.env.DB.prepare(
      "SELECT id FROM ai_search_audit_history WHERE workspace_id = ? ORDER BY id",
    )
      .bind(String(workspaceId))
      .all<{ readonly id: string }>();
    expect(ours.results.map((row) => row.id)).toEqual(["mine-0003"]);
  });
});

describe("記事が消えても、監査の記録は残る", () => {
  /*
    0044 が `ai_search_audit_history` に**外部キーを張っていない**ことの検査。

    記事の識別子 `(site_slug, slug)` は `published_articles` の主キーと同じ対なので、
    素直に書けば外部キーを張りたくなる。張らないのは、記事が消えたときに
    履歴が連鎖削除されると「なぜ取り下げたか」を後から辿れなくなるためである。
    **監査の記録は、監査の対象が消えた後にこそ要る。**

    この判断はスキーマの「書いていないこと」に宿っているので、検査が無いと
    次に外部キーを足した人が、悪意なく記録を消せるようになる。
  */
  it("記事を消しても、その記事の履歴は 1 行も減らない", async () => {
    const article = anArticle({ slug: "withdrawn-later" });
    await publish(article);
    await recordAt(article, "aud-before-withdrawal", NOW, false);

    await proxy.env.DB.prepare(
      "DELETE FROM published_articles WHERE site_slug = ? AND slug = ?",
    )
      .bind(article.siteSlug, article.slug)
      .run();

    const gone = await proxy.env.DB.prepare(
      "SELECT count(*) AS n FROM published_articles WHERE site_slug = ? AND slug = ?",
    )
      .bind(article.siteSlug, article.slug)
      .first<{ readonly n: number }>();
    // 記事が本当に消えていないと、この検査は何も見ていないことになる。
    expect(gone?.n).toBe(0);

    const rows = await rowsOf(article);
    expect(rows.results.map((row) => row.id)).toEqual(["aud-before-withdrawal"]);
  });
});
