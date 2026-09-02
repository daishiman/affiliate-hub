/**
 * @tier 2
 * @req REQ-BLOG01, REQ-BLOG02, A1, A2, A8
 * @types state-transition, boundary, tenant-isolation, db-migration
 *
 * feat-blog-ui-builder の受入 A8:
 * 「配色・テンプレート・固定ページの設定は D1 (Drizzle) に永続化され、
 *   再読み込み後も保持される」
 *
 * ## なぜ本物の D1 で見るのか
 *
 * 「保持される」は保存先の性質であって、関数の性質ではない。
 * 模造の保存先（Map）で確かめても、一意索引・`ON CONFLICT`・
 * 列の NULL 許容は 1 つも試されない。**保持できない形で保存する**
 * 事故はそこにしか出ない。
 *
 * ## この検査が塞ぐ穴
 *
 * `blog_template` / `blog_theme` / `page_theme_override` の 3 表は
 * schema に存在するが、実測の時点で**読み書きするコードが 1 行も無かった**
 * （`grep` の当たりが `src/db/schema.ts` だけ）。
 * 箱だけ先にあると、migration も型検査もテストも通り、機能だけが無い。
 */
import { drizzle } from "drizzle-orm/d1";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getPlatformProxy } from "wrangler";
import * as schema from "@/db/schema";
import type { WorkspaceId } from "@/domain/shared";
import { createD1BlogAppearanceRepository } from "@/infrastructure/persistence/d1/blog-appearance-repository";
import { sampleSites } from "@/infrastructure/persistence/sample/site-sample-repository";
import { migrationStatements } from "../support/migrations";

type TestEnv = { readonly DB: D1Database };
type Proxy = Awaited<ReturnType<typeof getPlatformProxy<TestEnv>>>;

const OWNER = "ws_appearance_owner" as WorkspaceId;
const OUTSIDER = "ws_appearance_outsider" as WorkspaceId;
const SITE = "appearance-owned-blog";

let proxy: Proxy;
let seq = 0;

/** ID は連番で採る。採番のばらつきを検査へ持ち込まない。 */
function repo() {
  return createD1BlogAppearanceRepository({
    db: drizzle(proxy.env.DB, { schema }),
    newId: () => `app_${++seq}`,
  });
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
}, 60_000);

afterAll(async () => {
  await proxy?.dispose();
});

beforeEach(async () => {
  await proxy.env.DB.prepare("DELETE FROM page_theme_override").run();
  await proxy.env.DB.prepare("DELETE FROM blog_theme").run();
  await proxy.env.DB.prepare("DELETE FROM blog_template").run();
  await proxy.env.DB.prepare("DELETE FROM site_blueprints").run();

  const blueprint = { ...sampleSites()[0]!.blueprint, id: "sb_appearance", workspaceId: OWNER };
  await proxy.env.DB.prepare(
    "INSERT INTO site_blueprints (id, workspace_id, slug, name, pattern, blueprint_json) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(
      "sb_appearance",
      String(OWNER),
      SITE,
      blueprint.name,
      blueprint.pattern,
      JSON.stringify(blueprint),
    )
    .run();
});

describe("A1/A8 テンプレート選択の永続化", () => {
  it("選んでいないブログは null（既定値で埋めない）", async () => {
    const got = await repo().templateOf({ workspaceId: OWNER, siteSlug: SITE });
    expect(got.ok).toBe(true);
    expect(got.ok && got.value).toBeNull();
  });

  it("選ぶと保存され、読み直しで同じ値が返る（A8 の本体）", async () => {
    const saved = await repo().saveTemplate({
      workspaceId: OWNER,
      siteSlug: SITE,
      templateId: "gadget",
    });
    expect(saved.ok).toBe(true);

    // **別のインスタンス**で読み直す。同じ物が覚えていても意味が無い。
    const reloaded = await repo().templateOf({ workspaceId: OWNER, siteSlug: SITE });
    expect(reloaded.ok && reloaded.value).toBe("gadget");
  });

  it("選び直すと行が増えず上書きされる（site_slug 一意）", async () => {
    const r = repo();
    await r.saveTemplate({ workspaceId: OWNER, siteSlug: SITE, templateId: "news" });
    await r.saveTemplate({ workspaceId: OWNER, siteSlug: SITE, templateId: "minimal" });

    const rows = await proxy.env.DB.prepare(
      "SELECT COUNT(*) AS n FROM blog_template WHERE site_slug = ?",
    )
      .bind(SITE)
      .first<{ n: number }>();
    expect(rows?.n).toBe(1);

    const got = await r.templateOf({ workspaceId: OWNER, siteSlug: SITE });
    expect(got.ok && got.value).toBe("minimal");
  });

  it("他所の作業場所からは読めない（存在も答えない）", async () => {
    await repo().saveTemplate({ workspaceId: OWNER, siteSlug: SITE, templateId: "howto" });
    const got = await repo().templateOf({ workspaceId: OUTSIDER, siteSlug: SITE });
    expect(got.ok && got.value).toBeNull();
  });

  it("他所の作業場所からは書けない", async () => {
    const wrote = await repo().saveTemplate({
      workspaceId: OUTSIDER,
      siteSlug: SITE,
      templateId: "howto",
    });
    expect(wrote.ok).toBe(false);

    const got = await repo().templateOf({ workspaceId: OWNER, siteSlug: SITE });
    expect(got.ok && got.value).toBeNull();
  });

  /**
   * 語彙外の値が行に入っていても、読み取りは「選んでいない」に倒す。
   *
   * テンプレートを 1 つ廃止した日に、その値のまま残る行が必ず出る。
   * そこで例外を投げると、廃止と同時に既存ブログの画面が落ちる。
   */
  it("語彙外の template_id は『選んでいない』として読む", async () => {
    await proxy.env.DB.prepare(
      "INSERT INTO blog_template (id, workspace_id, site_slug, template_id) VALUES (?, ?, ?, ?)",
    )
      .bind("bt_stale", String(OWNER), SITE, "廃止されたテンプレート")
      .run();

    const got = await repo().templateOf({ workspaceId: OWNER, siteSlug: SITE });
    expect(got.ok && got.value).toBeNull();
  });
});

describe("A2/A8 配色 2 層の永続化", () => {
  const theme = { brandTheme: "indigo-teal", colorMode: "dark" } as const;

  it("ブログ既定を保存すると、読み直しで同じ値が返る", async () => {
    await repo().saveTheme({ workspaceId: OWNER, siteSlug: SITE, theme });
    const got = await repo().themeOf({ workspaceId: OWNER, siteSlug: SITE });
    expect(got.ok && got.value).toEqual(theme);
  });

  it("保存し直しても行が増えない", async () => {
    const r = repo();
    await r.saveTheme({ workspaceId: OWNER, siteSlug: SITE, theme });
    await r.saveTheme({
      workspaceId: OWNER,
      siteSlug: SITE,
      theme: { brandTheme: "pink", colorMode: "light" },
    });
    const rows = await proxy.env.DB.prepare(
      "SELECT COUNT(*) AS n FROM blog_theme WHERE site_slug = ?",
    )
      .bind(SITE)
      .first<{ n: number }>();
    expect(rows?.n).toBe(1);
  });

  it("上書きを保存すると、そのページだけ返る", async () => {
    const r = repo();
    await r.saveTheme({ workspaceId: OWNER, siteSlug: SITE, theme });
    await r.saveOverride({
      workspaceId: OWNER,
      siteSlug: SITE,
      pagePath: "/about",
      override: { brandTheme: "green" },
    });

    const one = await r.overrideOf({ workspaceId: OWNER, siteSlug: SITE, pagePath: "/about" });
    expect(one.ok && one.value).toEqual({ brandTheme: "green" });

    // 設定していないページは null。既定と同じ値の行を返さない。
    const other = await r.overrideOf({ workspaceId: OWNER, siteSlug: SITE, pagePath: "/contact" });
    expect(other.ok && other.value).toBeNull();
  });

  /**
   * **A2 の本体。** 解除は行の削除で、NULL の行を残さない。
   * 残すと、解除したページが一覧に出続ける。
   */
  it("解除すると行が消え、一覧からも消える", async () => {
    const r = repo();
    await r.saveOverride({
      workspaceId: OWNER,
      siteSlug: SITE,
      pagePath: "/about",
      override: { brandTheme: "green" },
    });
    await r.clearOverride({ workspaceId: OWNER, siteSlug: SITE, pagePath: "/about" });

    const rows = await proxy.env.DB.prepare(
      "SELECT COUNT(*) AS n FROM page_theme_override WHERE site_slug = ?",
    )
      .bind(SITE)
      .first<{ n: number }>();
    expect(rows?.n).toBe(0);

    const list = await r.listOverrides({ workspaceId: OWNER, siteSlug: SITE });
    expect(list.ok && list.value).toEqual([]);
  });

  /**
   * 不変条件 I2 — 両軸とも空の保存は、行を作らず削除へ倒す。
   *
   * 「上書きしていない上書き行」は一覧に出るのに何も変えない。
   * 一度できると、解除しても消えないページに見える。
   */
  it("両軸とも空の保存は行を作らない（境界）", async () => {
    const r = repo();
    const saved = await r.saveOverride({
      workspaceId: OWNER,
      siteSlug: SITE,
      pagePath: "/about",
      override: {},
    });
    expect(saved.ok && saved.value).toBeNull();

    const rows = await proxy.env.DB.prepare(
      "SELECT COUNT(*) AS n FROM page_theme_override WHERE site_slug = ?",
    )
      .bind(SITE)
      .first<{ n: number }>();
    expect(rows?.n).toBe(0);
  });

  it("既にある上書きを空で保存すると消える（境界）", async () => {
    const r = repo();
    await r.saveOverride({
      workspaceId: OWNER,
      siteSlug: SITE,
      pagePath: "/about",
      override: { colorMode: "light" },
    });
    await r.saveOverride({ workspaceId: OWNER, siteSlug: SITE, pagePath: "/about", override: {} });

    const got = await r.overrideOf({ workspaceId: OWNER, siteSlug: SITE, pagePath: "/about" });
    expect(got.ok && got.value).toBeNull();
  });

  it("片方の軸だけの上書きを保存できる（境界）", async () => {
    const r = repo();
    await r.saveOverride({
      workspaceId: OWNER,
      siteSlug: SITE,
      pagePath: "/about",
      override: { colorMode: "light" },
    });
    const got = await r.overrideOf({ workspaceId: OWNER, siteSlug: SITE, pagePath: "/about" });
    expect(got.ok && got.value).toEqual({ colorMode: "light" });
  });

  it("他所の作業場所からは配色を読み書きできない", async () => {
    await repo().saveTheme({ workspaceId: OWNER, siteSlug: SITE, theme });

    const read = await repo().themeOf({ workspaceId: OUTSIDER, siteSlug: SITE });
    expect(read.ok && read.value).toBeNull();

    const wrote = await repo().saveTheme({
      workspaceId: OUTSIDER,
      siteSlug: SITE,
      theme: { brandTheme: "pink", colorMode: "light" },
    });
    expect(wrote.ok).toBe(false);

    // 書けていないことを、所有者側から読み直して確かめる。
    const after = await repo().themeOf({ workspaceId: OWNER, siteSlug: SITE });
    expect(after.ok && after.value).toEqual(theme);
  });
});
