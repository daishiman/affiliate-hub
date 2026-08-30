/** @tier 2 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/d1";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getPlatformProxy } from "wrangler";
import type {
  EditorialPublishedArticleAdminPort,
  EditorialPublishedArticleWriterPort,
  EditorialPublishedContentPort,
  EditorialSiteDocumentRepositoryPort,
} from "@/application/ports/site";
import type { PublishedArticle } from "@/application/read-models/published-article";
import * as schema from "@/db/schema";
import type { WorkspaceId } from "@/domain/shared";
import {
  createD1PublishedArticleWriter,
  createD1PublishedArticleAdminRepository,
  createD1ContentRepository,
} from "@/infrastructure/persistence/d1/published-article-repository";
import { createD1SiteDocumentRepository } from "@/infrastructure/persistence/d1/site-document-repository";
import { SAMPLE_WORKSPACE_ID } from "@/infrastructure/persistence/sample/ranking-sample-repository";
import { SAMPLE_SITE_SLUG, SECOND_SITE_SLUG } from "@/infrastructure/persistence/sample/site-sample-repository";
import { OTHER_WORKSPACE } from "../support/actors";

/**
 * 出した記事が**本物の D1 と本物のマイグレーション**で読み直せることを見る。
 *
 * --- なぜこれが要るのか ---
 * 記事の保存先を見本から本物へ切り替える動機は「出す口ができた」ことだった。
 * 出す口があるということは、**出したものが読者から見えなければ
 * その場で嘘になる**ということでもある。単体側（`tests/application/publish-article.test.ts`）
 * は覚え書きの保存先で通しているので、次の 4 つはここで初めて分かる:
 *
 *   1. マイグレーション 0011 が表を本当に作れるか
 *   2. 節・言い切り・根拠を JSON 1 列に畳んで、読み直したとき同じ形に戻るか
 *   3. 同じ URL 名で出し直したとき、**弾かれずに差し替わる**か
 *   4. 見本の記事が消えないか（消えると、まだ 1 本も出していない読者ページが
 *      全部空になり、「出していない」のか「壊れている」のか見分けられない）
 *
 * --- ここで見ないこと ---
 * 出してよいかの判定（公開ゲート）と権限は単体側で見る。
 * ここは**保存して読み直すまで**だけを見る。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §3-5（結合テスト）/ REQ-TS07
 */

type TestEnv = { readonly DB: D1Database };
type Proxy = Awaited<ReturnType<typeof getPlatformProxy<TestEnv>>>;

let proxy: Proxy;
let writer: EditorialPublishedArticleWriterPort;
let content: EditorialPublishedContentPort;
let admin: EditorialPublishedArticleAdminPort;
let documents: EditorialSiteDocumentRepositoryPort;

const workspaceId = SAMPLE_WORKSPACE_ID as WorkspaceId;

/** マイグレーションの本文を、実行できる単位に割る。 */
function migrationStatements(): readonly string[] {
  const dir = path.resolve(process.cwd(), "drizzle");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  expect(files.length).toBeGreaterThan(0);
  return files.flatMap((file) =>
    readFileSync(path.join(dir, file), "utf8")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s !== ""),
  );
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
  writer = createD1PublishedArticleWriter(db);
  content = createD1ContentRepository(db);
  admin = createD1PublishedArticleAdminRepository(db);
  documents = createD1SiteDocumentRepository({
    db,
    now: () => new Date("2026-08-26T00:00:00Z"),
    newId: () => "lp_test",
  });
}, 60_000);

afterAll(async () => {
  await proxy?.dispose();
});

beforeEach(async () => {
  await proxy.env.DB.prepare("DELETE FROM published_articles").run();
  await proxy.env.DB.prepare("DELETE FROM published_article_tombstones").run();
  await proxy.env.DB.prepare("DELETE FROM legal_page").run();
  await proxy.env.DB.prepare("DELETE FROM site_blueprints").run();
  await proxy.env.DB.prepare(
    `INSERT INTO site_blueprints
      (id, workspace_id, slug, name, pattern, published_at, blueprint_json)
     VALUES ('sb_article_owner', ?, ?, '所有ブログ', 'specialist_review', unixepoch(), '{}')`,
  )
    .bind(String(workspaceId), SAMPLE_SITE_SLUG)
    .run();
});

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
        paragraphs: ["排気口の位置で体感はかなり変わります。", "膝置きなら側面排気を選びます。"],
        claims: [
          {
            id: "quiet-laptop-claim-1",
            statement: "側面排気の機種は、膝置きでも温風が当たりにくい。",
            kind: "fact",
            evidence: [
              {
                id: "quiet-laptop-evidence-1",
                sourceLabel: "自社での実測（12 機種）",
                url: "https://example.com/measure",
                checkedAt: "2026-08-01",
              },
            ],
          },
        ],
      },
      {
        id: "steps",
        heading: "全手順",
        paragraphs: ["1. 排気の向きを見る", "2. 実測の騒音値を見る"],
      },
    ],
    ...over,
  };
}

describe("出した記事を読み直す", () => {
  it("節・言い切り・根拠まで同じ形で戻る", async () => {
    const article = anArticle();
    const saved = await writer.save(workspaceId, article);
    expect(saved.ok).toBe(true);

    const found = await content.findArticle(SAMPLE_SITE_SLUG, "quiet-laptop");
    expect(found.ok).toBe(true);
    if (!found.ok || found.value === null) throw new Error("出した記事が読み直せませんでした");

    expect(found.value).toEqual(article);
  });

  it("出していない記事は null（例外にしない）", async () => {
    const found = await content.findArticle(SAMPLE_SITE_SLUG, "nothing-here");
    expect(found.ok).toBe(true);
    if (!found.ok) throw new Error("読み取りに失敗しました");
    expect(found.value).toBeNull();
  });

  it("公開を取り下げた記事は、読者向けの 1 枚引きから消える", async () => {
    await writer.save(workspaceId, anArticle());

    const unpublished = await writer.unpublish(
      workspaceId,
      SAMPLE_SITE_SLUG,
      "quiet-laptop",
    );
    expect(unpublished.ok).toBe(true);

    const found = await content.findArticle(SAMPLE_SITE_SLUG, "quiet-laptop");
    if (!found.ok) throw new Error("読み取りに失敗しました");
    expect(found.value).toBeNull();
  });

  it("見本と同じURLの記事を取り下げても、見本が同じURLへ再露出しない", async () => {
    const slug = "laptops-for-video-editing";
    await writer.save(workspaceId, anArticle({ slug }));

    const unpublished = await writer.unpublish(workspaceId, SAMPLE_SITE_SLUG, slug);
    expect(unpublished.ok).toBe(true);

    const found = await content.findArticle(SAMPLE_SITE_SLUG, slug);
    expect(found).toEqual({ ok: true, value: null });
    const recent = await content.listRecent(SAMPLE_SITE_SLUG, 50);
    if (!recent.ok) throw new Error("一覧を読めませんでした");
    expect(recent.value.map((article) => article.slug)).not.toContain(slug);
  });

  it("部分成功後の再試行は、既に取り下げたURLを成功扱いにする", async () => {
    await writer.save(workspaceId, anArticle());
    expect((await writer.unpublish(workspaceId, SAMPLE_SITE_SLUG, "quiet-laptop")).ok).toBe(true);

    const retry = await writer.unpublish(workspaceId, SAMPLE_SITE_SLUG, "quiet-laptop");

    expect(retry).toEqual({ ok: true, value: true });
  });

  it("取り下げたURLへ同じworkspaceが出し直すと、墓標を外して新しい記事だけを出す", async () => {
    await writer.save(workspaceId, anArticle());
    await writer.unpublish(workspaceId, SAMPLE_SITE_SLUG, "quiet-laptop");

    const republished = await writer.save(
      workspaceId,
      anArticle({ title: "再公開した記事", updatedAt: "2026-09-02" }),
    );

    expect(republished.ok).toBe(true);
    const found = await content.findArticle(SAMPLE_SITE_SLUG, "quiet-laptop");
    if (!found.ok) throw new Error("再公開記事を読めませんでした");
    expect(found.value?.title).toBe("再公開した記事");
  });

  it("再公開と取り下げが競合しても、公開行と墓標が半端な組み合わせにならない", async () => {
    await writer.save(workspaceId, anArticle({ slug: "laptops-for-video-editing" }));

    await Promise.all([
      writer.unpublish(workspaceId, SAMPLE_SITE_SLUG, "laptops-for-video-editing"),
      writer.save(
        workspaceId,
        anArticle({ slug: "laptops-for-video-editing", title: "競合後の再公開" }),
      ),
    ]);

    const article = await proxy.env.DB.prepare(
      "SELECT count(*) as total FROM published_articles WHERE site_slug = ? AND slug = ?",
    )
      .bind(SAMPLE_SITE_SLUG, "laptops-for-video-editing")
      .first<{ total: number }>();
    const tombstone = await proxy.env.DB.prepare(
      "SELECT count(*) as total FROM published_article_tombstones WHERE site_slug = ? AND slug = ?",
    )
      .bind(SAMPLE_SITE_SLUG, "laptops-for-video-editing")
      .first<{ total: number }>();
    expect([article?.total, tombstone?.total]).toEqual(
      expect.arrayContaining([0, 1]),
    );
    expect((article?.total ?? 0) + (tombstone?.total ?? 0)).toBe(1);

    const visible = await content.findArticle(SAMPLE_SITE_SLUG, "laptops-for-video-editing");
    if (!visible.ok) throw new Error("競合後の記事を読めませんでした");
    if (article?.total === 1) expect(visible.value?.title).toBe("競合後の再公開");
    else expect(visible.value).toBeNull();
  });

  it("A workspaceの取り下げとB workspaceの同URL公開が競合しても、Bは所有権を奪えない", async () => {
    const slug = "cross-workspace-race";
    expect((await writer.save(workspaceId, anArticle({ slug }))).ok).toBe(true);

    const [unpublished, attacked] = await Promise.all([
      writer.unpublish(workspaceId, SAMPLE_SITE_SLUG, slug),
      writer.save(
        OTHER_WORKSPACE,
        anArticle({ slug, title: "別の作業場所が公開した記事" }),
      ),
    ]);

    expect(unpublished.ok).toBe(true);
    expect(attacked.ok).toBe(false);
    const occupants = await proxy.env.DB.prepare(
      `SELECT 'article' AS kind, workspace_id FROM published_articles
       WHERE site_slug = ? AND slug = ?
       UNION ALL
       SELECT 'tombstone' AS kind, workspace_id FROM published_article_tombstones
       WHERE site_slug = ? AND slug = ?`,
    )
      .bind(SAMPLE_SITE_SLUG, slug, SAMPLE_SITE_SLUG, slug)
      .all<{ kind: "article" | "tombstone"; workspace_id: string }>();
    expect(occupants.results).toEqual([
      { kind: "tombstone", workspace_id: String(workspaceId) },
    ]);
  });

  it("別workspaceは、所有しているブログの未使用URLにも記事を公開できない", async () => {
    const slug = "unused-but-owned-site";
    const attacked = await writer.save(
      OTHER_WORKSPACE,
      anArticle({ slug, title: "別の作業場所が差し込んだ記事" }),
    );

    expect(attacked.ok).toBe(false);
    const stored = await proxy.env.DB.prepare(
      "SELECT workspace_id FROM published_articles WHERE site_slug = ? AND slug = ?",
    )
      .bind(SAMPLE_SITE_SLUG, slug)
      .all<{ workspace_id: string }>();
    expect(stored.results).toEqual([]);
  });

  it("DB境界が、公開行と別workspace墓標の同一URL共存を拒否する", async () => {
    const slug = "protected-by-db";
    expect((await writer.save(workspaceId, anArticle({ slug }))).ok).toBe(true);

    await expect(
      proxy.env.DB.prepare(
        `INSERT INTO published_article_tombstones
           (site_slug, slug, workspace_id, unpublished_at)
         VALUES (?, ?, ?, unixepoch())`,
      )
        .bind(SAMPLE_SITE_SLUG, slug, String(OTHER_WORKSPACE))
        .run(),
    ).rejects.toThrow();

    const occupants = await proxy.env.DB.prepare(
      `SELECT 'article' AS kind, workspace_id FROM published_articles
       WHERE site_slug = ? AND slug = ?
       UNION ALL
       SELECT 'tombstone' AS kind, workspace_id FROM published_article_tombstones
       WHERE site_slug = ? AND slug = ?`,
    )
      .bind(SAMPLE_SITE_SLUG, slug, SAMPLE_SITE_SLUG, slug)
      .all<{ kind: "article" | "tombstone"; workspace_id: string }>();
    expect(occupants.results).toEqual([
      { kind: "article", workspace_id: String(workspaceId) },
    ]);
  });

  it("DB境界が、墓標と別workspace公開行の同一URL共存を拒否する", async () => {
    const slug = "protected-tombstone";
    const article = anArticle({ slug });
    expect((await writer.save(workspaceId, article)).ok).toBe(true);
    expect((await writer.unpublish(workspaceId, SAMPLE_SITE_SLUG, slug)).ok).toBe(true);

    await expect(
      proxy.env.DB.prepare(
        `INSERT INTO published_articles
           (site_slug, slug, workspace_id, type, title, summary, category_slug,
            author_slug, author_name, published_at, updated_at, article_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          article.siteSlug,
          article.slug,
          String(OTHER_WORKSPACE),
          article.type,
          article.title,
          article.summary,
          article.categorySlug,
          article.author.slug,
          article.author.name,
          article.publishedAt,
          article.updatedAt,
          JSON.stringify(article),
        )
        .run(),
    ).rejects.toThrow();

    const occupants = await proxy.env.DB.prepare(
      `SELECT 'article' AS kind, workspace_id FROM published_articles
       WHERE site_slug = ? AND slug = ?
       UNION ALL
       SELECT 'tombstone' AS kind, workspace_id FROM published_article_tombstones
       WHERE site_slug = ? AND slug = ?`,
    )
      .bind(SAMPLE_SITE_SLUG, slug, SAMPLE_SITE_SLUG, slug)
      .all<{ kind: "article" | "tombstone"; workspace_id: string }>();
    expect(occupants.results).toEqual([
      { kind: "tombstone", workspace_id: String(workspaceId) },
    ]);
  });

  it("別の作業場所からの取り下げでは、公開中の記事を消さない", async () => {
    const article = anArticle({ title: "元の作業場所が公開した記事" });
    await writer.save(workspaceId, article);

    const attacked = await writer.unpublish(
      OTHER_WORKSPACE,
      SAMPLE_SITE_SLUG,
      article.slug,
    );
    expect(attacked.ok).toBe(false);

    const found = await content.findArticle(SAMPLE_SITE_SLUG, article.slug);
    if (!found.ok) throw new Error("元の記事を読み直せませんでした");
    expect(found.value?.title).toBe("元の作業場所が公開した記事");
  });

  it("見本の記事は消えない", async () => {
    await writer.save(workspaceId, anArticle());
    const sample = await content.findArticle(SAMPLE_SITE_SLUG, "chairs-for-long-hours");
    expect(sample.ok).toBe(true);
    if (!sample.ok) throw new Error("読み取りに失敗しました");
    expect(sample.value?.stub).toBeDefined();
  });

  it("見本と同じ URL 名で出したら、出したほうが勝つ", async () => {
    await writer.save(workspaceId, anArticle({ slug: "chairs-for-long-hours" }));
    const found = await content.findArticle(SAMPLE_SITE_SLUG, "chairs-for-long-hours");
    expect(found.ok).toBe(true);
    if (!found.ok) throw new Error("読み取りに失敗しました");
    expect(found.value?.title).toBe("静かなノートパソコンの選び方");
    // 見本の印が残っていると、本物の記事が「仮」と表示される。
    expect(found.value?.stub).toBeUndefined();
  });

  it("同じ URL 名で出し直すと差し替わる（永久に通らない失敗にしない）", async () => {
    await writer.save(workspaceId, anArticle());
    const again = await writer.save(
      workspaceId,
      anArticle({ title: "静かなノートパソコンの選び方（2026 年版）", updatedAt: "2026-09-01" }),
    );
    expect(again.ok).toBe(true);

    const found = await content.findArticle(SAMPLE_SITE_SLUG, "quiet-laptop");
    if (!found.ok || found.value === null) throw new Error("読み直せませんでした");
    expect(found.value.title).toBe("静かなノートパソコンの選び方（2026 年版）");
    expect(found.value.updatedAt).toBe("2026-09-01");

    const listed = await content.listRecent(SAMPLE_SITE_SLUG, 20);
    if (!listed.ok) throw new Error("一覧を読めませんでした");
    // 差し替えであって追加ではない。2 本になっていたら、読者には同じ記事が 2 つ見える。
    expect(listed.value.filter((a) => a.slug === "quiet-laptop")).toHaveLength(1);
  });

  it("別の作業場所は、同じブログ名と URL 名の衝突で既存記事を上書きできない", async () => {
    await writer.save(workspaceId, anArticle({ title: "元の作業場所の記事" }));

    const attacked = await writer.save(
      OTHER_WORKSPACE,
      anArticle({ title: "別の作業場所からの差し替え" }),
    );

    expect(attacked.ok).toBe(false);
    const found = await content.findArticle(SAMPLE_SITE_SLUG, "quiet-laptop");
    if (!found.ok || found.value === null) throw new Error("元の記事を読み直せませんでした");
    expect(found.value.title).toBe("元の作業場所の記事");
  });
});

describe("一覧と検索に出る", () => {
  it("新着の先頭に出る（更新日の新しい順）", async () => {
    await writer.save(workspaceId, anArticle({ updatedAt: "2099-01-01" }));
    const listed = await content.listRecent(SAMPLE_SITE_SLUG, 5);
    if (!listed.ok) throw new Error("一覧を読めませんでした");
    expect(listed.value[0]?.slug).toBe("quiet-laptop");
    // 見本も一緒に並ぶ。出した 1 本だけになると、読者ページが急に痩せる。
    expect(listed.value.length).toBeGreaterThan(1);
  });

  it("カテゴリーの一覧に出る", async () => {
    await writer.save(workspaceId, anArticle());
    const listed = await content.listByCategory(SAMPLE_SITE_SLUG, "chairs");
    if (!listed.ok) throw new Error("一覧を読めませんでした");
    expect(listed.value.map((a) => a.slug)).toContain("quiet-laptop");
  });

  it("別のカテゴリーには出ない", async () => {
    await writer.save(workspaceId, anArticle());
    const listed = await content.listByCategory(SAMPLE_SITE_SLUG, "storage");
    if (!listed.ok) throw new Error("一覧を読めませんでした");
    expect(listed.value.map((a) => a.slug)).not.toContain("quiet-laptop");
  });

  it("別のブログには出ない", async () => {
    await writer.save(workspaceId, anArticle());
    const listed = await content.listRecent(SECOND_SITE_SLUG, 20);
    if (!listed.ok) throw new Error("一覧を読めませんでした");
    expect(listed.value.map((a) => a.slug)).not.toContain("quiet-laptop");
  });

  it("題名と結論のどちらでも探せる", async () => {
    await writer.save(workspaceId, anArticle());
    const byTitle = await content.search(SAMPLE_SITE_SLUG, "静かな", 10);
    if (!byTitle.ok) throw new Error("検索に失敗しました");
    expect(byTitle.value.map((a) => a.slug)).toContain("quiet-laptop");

    const bySummary = await content.search(SAMPLE_SITE_SLUG, "放熱", 10);
    if (!bySummary.ok) throw new Error("検索に失敗しました");
    expect(bySummary.value.map((a) => a.slug)).toContain("quiet-laptop");
  });
});

describe("書き手のページ", () => {
  it("出した記事の書き手を引ける（署名を行き止まりにしない）", async () => {
    await writer.save(workspaceId, anArticle());
    const person = await content.findPerson(SAMPLE_SITE_SLUG, "author", "author-nakata");
    if (!person.ok) throw new Error("人物を読めませんでした");
    expect(person.value?.name).toBe("中田 涼");
    expect(person.value?.credentials).toEqual(["騒音測定の実務経験 4 年"]);
  });

  it("その人が書いた記事が並ぶ", async () => {
    await writer.save(workspaceId, anArticle());
    const listed = await content.listByPerson(SAMPLE_SITE_SLUG, "author-nakata");
    if (!listed.ok) throw new Error("一覧を読めませんでした");
    expect(listed.value.map((a) => a.slug)).toEqual(["quiet-laptop"]);
  });

  it("見本の書き手も引ける（重ねても消さない）", async () => {
    await writer.save(workspaceId, anArticle());
    const person = await content.findPerson(SAMPLE_SITE_SLUG, "author", "mochizuki");
    if (!person.ok) throw new Error("人物を読めませんでした");
    expect(person.value).not.toBeNull();
  });
});

describe("訂正は見本のまま", () => {
  it("記事を出しても訂正の一覧は失敗しない", async () => {
    await writer.save(workspaceId, anArticle());
    const corrections = await content.listCorrections(SAMPLE_SITE_SLUG);
    expect(corrections.ok).toBe(true);
  });
});

/**
 * 固定文書（運営者情報・各方針・規約・特商法表記）。
 *
 * 2026-08-26 まで、D1 でも見本の文をそのまま返していた。運営者情報の位置に
 * **書いた覚えの無い文**が本物の顔で出ていたということで、これは
 * 「まだ書いていない」より悪い。ここでは 2 つを見る。
 *
 *   1. 書いていない固定ページは `null`（読者は 404）。**見本へ落ちない。**
 *   2. 管理画面で保存したものが、読者向けの 1 枚引きにそのまま出る。
 */
describe("固定文書は保存したものだけが出る", () => {
  it("1 度も書いていなければ null（見本の文へ落ちない）", async () => {
    const policy = await content.findPolicyDocument(SAMPLE_SITE_SLUG, "privacy");
    expect(policy.ok).toBe(true);
    if (!policy.ok) throw new Error("読み取りに失敗しました");
    expect(policy.value).toBeNull();
  });

  it("保存した本文が、段落のまま読者向けの経路へ出る", async () => {
    const saved = await documents.save(workspaceId, SAMPLE_SITE_SLUG, {
      key: "operator",
      title: "運営者情報",
      body: ["この記事は編集部が書いています。", "連絡先は問い合わせ欄からどうぞ。"],
    });
    expect(saved.ok).toBe(true);

    const policy = await content.findPolicyDocument(SAMPLE_SITE_SLUG, "operator");
    if (!policy.ok) throw new Error("読み取りに失敗しました");
    expect(policy.value).toEqual({
      title: "運営者情報",
      // 段落の区切りが保存先を往復しても消えない（1 列に畳んでいるので、ここが要）。
      body: ["この記事は編集部が書いています。", "連絡先は問い合わせ欄からどうぞ。"],
    });
  });

  it("別の作業場所からは、同じブログの文書が見えない", async () => {
    const others = await documents.listBySite("ws_other" as WorkspaceId, SAMPLE_SITE_SLUG);
    if (!others.ok) throw new Error("読み取りに失敗しました");
    expect(others.value).toEqual([]);
  });
});

describe("公開済み記事の非表示化", () => {
  it("読者の一覧・本文・検索からは消え、管理一覧には残る", async () => {
    await writer.save(workspaceId, anArticle({ updatedAt: "2099-01-01" }));
    const archived = await admin.archive(
      workspaceId,
      SAMPLE_SITE_SLUG,
      "quiet-laptop",
      "2026-08-28T09:00:00.000Z",
    );
    expect(archived.ok && archived.value).toBe(true);

    const [recent, found, searched, managed] = await Promise.all([
      content.listRecent(SAMPLE_SITE_SLUG, 20),
      content.findArticle(SAMPLE_SITE_SLUG, "quiet-laptop"),
      content.search(SAMPLE_SITE_SLUG, "静かな", 10),
      admin.list(workspaceId),
    ]);
    if (!recent.ok || !found.ok || !searched.ok || !managed.ok) {
      throw new Error("非表示後の読み込みに失敗しました");
    }
    expect(recent.value.map((item) => item.slug)).not.toContain("quiet-laptop");
    expect(found.value).toBeNull();
    expect(searched.value.map((item) => item.slug)).not.toContain("quiet-laptop");
    expect(managed.value.find((item) => item.article.slug === "quiet-laptop")?.archivedAt).toBe(
      "2026-08-28T09:00:00.000Z",
    );
  });

  it("見本と同じ URL の保存記事を非表示にしても見本へ逆戻りしない", async () => {
    await writer.save(workspaceId, anArticle({ slug: "chairs-for-long-hours" }));
    await admin.archive(
      workspaceId,
      SAMPLE_SITE_SLUG,
      "chairs-for-long-hours",
      "2026-08-28T09:00:00.000Z",
    );
    const found = await content.findArticle(SAMPLE_SITE_SLUG, "chairs-for-long-hours");
    if (!found.ok) throw new Error("記事を読み込めませんでした");
    expect(found.value).toBeNull();
  });
});

describe("公開済み記事の管理ポート", () => {
  it("workspace とブログと URL 名が一致する記事だけを引く", async () => {
    await writer.save(workspaceId, anArticle());

    const [found, otherSite, otherWorkspace] = await Promise.all([
      admin.find(workspaceId, SAMPLE_SITE_SLUG, "quiet-laptop"),
      admin.find(workspaceId, SECOND_SITE_SLUG, "quiet-laptop"),
      admin.find("workspace_other" as WorkspaceId, SAMPLE_SITE_SLUG, "quiet-laptop"),
    ]);

    if (!found.ok || !otherSite.ok || !otherWorkspace.ok) {
      throw new Error("管理用の記事を読み込めませんでした");
    }
    expect(found.value?.article.title).toBe("静かなノートパソコンの選び方");
    expect(found.value?.archivedAt).toBeNull();
    expect(otherSite.value).toBeNull();
    expect(otherWorkspace.value).toBeNull();
  });

  it("訂正した本文と一覧用の列を同時に差し替え、別 workspace は変えない", async () => {
    await writer.save(workspaceId, anArticle());
    const changed = anArticle({
      title: "静音ノートを実測から選ぶ",
      summary: "騒音値と排気方向を同時に見ます。",
      categorySlug: "workstations",
      updatedAt: "2026-08-28",
      author: {
        ...anArticle().author,
        name: "中田 涼（編集部）",
      },
    });

    const refused = await admin.replace("workspace_other" as WorkspaceId, changed);
    const replaced = await admin.replace(workspaceId, changed);
    const [managed, searched] = await Promise.all([
      admin.find(workspaceId, SAMPLE_SITE_SLUG, "quiet-laptop"),
      content.search(SAMPLE_SITE_SLUG, "騒音値", 10),
    ]);

    expect(refused.ok && refused.value).toBe(false);
    expect(replaced.ok && replaced.value).toBe(true);
    if (!managed.ok || !searched.ok) throw new Error("訂正した記事を読み込めませんでした");
    expect(managed.value?.article).toEqual(changed);
    expect(searched.value.map((article) => article.slug)).toContain("quiet-laptop");
  });

  it("存在しない記事は非表示にしたことにしない", async () => {
    const archived = await admin.archive(
      workspaceId,
      SAMPLE_SITE_SLUG,
      "nothing-here",
      "2026-08-28T09:00:00.000Z",
    );

    expect(archived.ok && archived.value).toBe(false);
  });
});
