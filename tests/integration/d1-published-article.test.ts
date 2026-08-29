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
} from "@/application/ports/site";
import type { PublishedArticle } from "@/application/read-models/published-article";
import * as schema from "@/db/schema";
import type { WorkspaceId } from "@/domain/shared";
import {
  createD1PublishedArticleWriter,
  createD1PublishedArticleAdminRepository,
  createD1ContentRepository,
} from "@/infrastructure/persistence/d1/published-article-repository";
import { SAMPLE_WORKSPACE_ID } from "@/infrastructure/persistence/sample/ranking-sample-repository";
import { SAMPLE_SITE_SLUG, SECOND_SITE_SLUG } from "@/infrastructure/persistence/sample/site-sample-repository";

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
}, 60_000);

afterAll(async () => {
  await proxy?.dispose();
});

beforeEach(async () => {
  await proxy.env.DB.prepare("DELETE FROM published_articles").run();
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

describe("訂正と方針は見本のまま", () => {
  it("記事を出しても訂正の一覧は失敗しない", async () => {
    await writer.save(workspaceId, anArticle());
    const corrections = await content.listCorrections(SAMPLE_SITE_SLUG);
    expect(corrections.ok).toBe(true);
  });

  it("方針の文書を引ける", async () => {
    const policy = await content.findPolicyDocument(SAMPLE_SITE_SLUG, "privacy");
    expect(policy.ok).toBe(true);
    if (!policy.ok) throw new Error("読み取りに失敗しました");
    expect(policy.value).not.toBeNull();
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
