/**
 * @tier 2
 * @req REQ-VIS02
 * @types fault-injection, boundary, idempotency, state-transition
 *
 * 参照が外れた古い表紙の掃除（毎晩の定期実行）。
 *
 * ## なぜ本物の D1 で見るのか
 *
 * ここが消す・消さないを決める根拠は**台帳の中身そのもの**である。
 * 台帳を模造（Map）に置き換えると、「読めた／読めなかった」の分岐は
 * 試せても、**列名を間違えた select** は 1 度も試されない。
 * 列名を間違えた select は本番で例外になり、この掃除の作りでは
 * 例外は「台帳を読めませんでした」に化ける。つまり**掃除が永久に
 * 見送られ続けるのに、記録には「見送りました」としか出ない**。
 * その壊れ方は模造では出ないので、台帳側は本物を使う。
 *
 * 置き場（R2）は逆に模造でよい。ここで見たいのは「どの鍵へ delete を
 * 呼んだか」だけで、R2 の性質には依っていない。
 *
 * ## ここで見たいこと
 *
 * 1. **消しすぎない。** 台帳が読めない・台帳が空・置いた直後のものは、
 *    どれも「消さない側へ倒す」。原本は運営者の手元にしか残らないので、
 *    消し過ぎは取り返しがつかない。
 * 2. **消し残りは次の回で拾える。** 2 度目は同じものを消さない。
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getPlatformProxy } from "wrangler";
import { THUMBNAIL_KEY_PREFIX, thumbnailObjectKey } from "@/domain/blogops";
import { sweepUnreferencedThumbnails } from "@/infrastructure/platform/blog-thumbnail-sweeper";
import type { ThumbnailBucket } from "@/infrastructure/platform/blog-thumbnail-r2";
import { migrationStatements } from "../support/migrations";

type TestEnv = { readonly DB: D1Database };
type Proxy = Awaited<ReturnType<typeof getPlatformProxy<TestEnv>>>;

const WORKSPACE = "ws_thumb_sweep";
const SITE = "creator-tools";
const ARTICLE_ID = "art_thumb_sweep";
const ARTICLE_SLUG = "quiet-laptop";

/** 掃除が走った時刻。猶予（24 時間）の前後を作るための基準。 */
const NOW = new Date("2026-09-05T17:00:00.000Z");
const LONG_AGO = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000);
const JUST_NOW = new Date(NOW.getTime() - 60 * 1000);

/** 1 世代ぶんの鍵（原本と派生 3 枚）。指紋が違えば別の段になる。 */
function generation(contentHash: string): readonly string[] {
  const parts = {
    siteSlug: SITE,
    articleSlug: ARTICLE_SLUG,
    contentHash,
    mimeType: "image/jpeg" as const,
  };
  return [
    thumbnailObjectKey({ ...parts, width: null }),
    thumbnailObjectKey({ ...parts, width: 320 }),
    thumbnailObjectKey({ ...parts, width: 640 }),
    thumbnailObjectKey({ ...parts, width: 1280 }),
  ];
}

/**
 * 置き場の代わり。**`uploaded` を持たせられるようにしてある**のが
 * `blog-thumbnail-r2.test.ts` の作り物との違いで、ここでの主題がそこにある。
 */
function fakeBucket(entries: readonly { key: string; uploaded?: Date }[]) {
  const objects = new Map(entries.map((e) => [e.key, e.uploaded]));
  const listedPrefixes: string[] = [];
  const bucket: ThumbnailBucket = {
    async put() {
      throw new Error("掃除は置かない");
    },
    async get() {
      return null;
    },
    async delete(key) {
      objects.delete(key);
    },
    async list(options) {
      const prefix = options?.prefix ?? "";
      listedPrefixes.push(prefix);
      return {
        objects: [...objects.entries()]
          .filter(([key]) => key.startsWith(prefix))
          .map(([key, uploaded]) => ({ key, uploaded })),
        truncated: false,
      };
    },
  };
  return { bucket, objects, listedPrefixes };
}

let proxy: Proxy;

async function putLedgerRow(objectKey: string): Promise<void> {
  await proxy.env.DB.prepare(
    "INSERT INTO blog_article_thumbnail (article_id, workspace_id, object_key, mime_type) VALUES (?, ?, ?, 'image/jpeg')",
  )
    .bind(ARTICLE_ID, WORKSPACE, objectKey)
    .run();
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
  await proxy.env.DB.prepare("DELETE FROM blog_article_thumbnail").run();
  await proxy.env.DB.prepare("DELETE FROM articles").run();
  await proxy.env.DB.prepare(
    "INSERT INTO articles (id, workspace_id, site_slug, slug, article_template, type, title) VALUES (?, ?, ?, ?, 'T1', 'ranking', '静かなノートパソコン')",
  )
    .bind(ARTICLE_ID, WORKSPACE, SITE, ARTICLE_SLUG)
    .run();
});

describe("参照が外れた世代だけを消す", () => {
  it("台帳が指す世代は残し、外れた世代だけを消す", async () => {
    const live = generation("1111aaaa");
    const orphan = generation("2222bbbb");
    await putLedgerRow(live[0]!);
    const store = fakeBucket(
      [...live, ...orphan].map((key) => ({ key, uploaded: LONG_AGO })),
    );

    const result = await sweepUnreferencedThumbnails(store.bucket, proxy.env.DB, NOW);

    expect(result.skipped).toBeNull();
    if (result.skipped !== null) return;
    expect(result.deleted).toBe(4);
    expect(result.referenced).toBe(1);
    expect(result.finished).toBe(true);
    // 生きている世代は 4 枚とも無傷。原本だけ残して派生を消すと `srcset` が 404 になる。
    expect([...store.objects.keys()].sort()).toEqual([...live].sort());
  });

  it("台帳が指すのは原本の鍵だが、消さずに守るのは段まるごと", async () => {
    // 派生の鍵は台帳に無い。頭（指紋の段）で照合していないと、
    // 「台帳に無い」と読んで派生 3 枚だけが消える。
    const live = generation("3333cccc");
    await putLedgerRow(live[0]!);
    const store = fakeBucket(live.map((key) => ({ key, uploaded: LONG_AGO })));

    const result = await sweepUnreferencedThumbnails(store.bucket, proxy.env.DB, NOW);

    expect(result.skipped).toBeNull();
    if (result.skipped !== null) return;
    expect(result.deleted).toBe(0);
    expect(store.objects.size).toBe(4);
  });

  it("表紙の置き場の外は見に行かない", async () => {
    await putLedgerRow(generation("4444dddd")[0]!);
    const store = fakeBucket([
      { key: "feedback-captures/ws/a.png", uploaded: LONG_AGO },
      { key: "exports/ws/b.csv", uploaded: LONG_AGO },
    ]);

    await sweepUnreferencedThumbnails(store.bucket, proxy.env.DB, NOW);

    // 別用途の鍵まで「台帳に無い」で消せてしまうと、同じバケットの
    // 改善要望の写しと書き出しファイルが毎晩消える。
    expect(store.listedPrefixes).toEqual([THUMBNAIL_KEY_PREFIX]);
    expect(store.objects.size).toBe(2);
  });

  it("別の作業場所の表紙も守る（台帳は絞らずに全部を読む）", async () => {
    /*
      置き場は全作業場所の絵を 1 つのバケットに持つ。掃除を呼ぶのは時計で、
      **どの作業場所の代理でもない**。ここで台帳を作業場所で絞ると、
      絞った先の外に居る生きている表紙が「参照されていない」に見えて、
      毎晩消える。`tests/architecture/tenant-scoped-schema.test.ts` の
      QUERY_EXEMPT に書いた理由は、この検査が支えている。
    */
    const otherWorkspace = "ws_thumb_sweep_other";
    const otherArticle = "art_thumb_sweep_other";
    await proxy.env.DB.prepare(
      "INSERT INTO articles (id, workspace_id, site_slug, slug, article_template, type, title) VALUES (?, ?, 'other-site', 'other-article', 'T1', 'ranking', '他所の記事')",
    )
      .bind(otherArticle, otherWorkspace)
      .run();

    const mine = generation("dddd4444");
    const theirs = generation("eeee5555");
    await putLedgerRow(mine[0]!);
    await proxy.env.DB.prepare(
      "INSERT INTO blog_article_thumbnail (article_id, workspace_id, object_key, mime_type) VALUES (?, ?, ?, 'image/jpeg')",
    )
      .bind(otherArticle, otherWorkspace, theirs[0]!)
      .run();

    const store = fakeBucket(
      [...mine, ...theirs].map((key) => ({ key, uploaded: LONG_AGO })),
    );
    const result = await sweepUnreferencedThumbnails(store.bucket, proxy.env.DB, NOW);

    expect(result.skipped).toBeNull();
    if (result.skipped !== null) return;
    expect(result.deleted).toBe(0);
    expect(result.referenced).toBe(2);
    expect(store.objects.size).toBe(8);
  });

  it("2 度走らせても、2 度目は何も消さない", async () => {
    const live = generation("5555eeee");
    await putLedgerRow(live[0]!);
    const store = fakeBucket(
      [...live, ...generation("6666ffff")].map((key) => ({ key, uploaded: LONG_AGO })),
    );

    await sweepUnreferencedThumbnails(store.bucket, proxy.env.DB, NOW);
    const second = await sweepUnreferencedThumbnails(store.bucket, proxy.env.DB, NOW);

    expect(second.skipped).toBeNull();
    if (second.skipped !== null) return;
    expect(second.deleted).toBe(0);
  });
});

describe("消さない側へ倒す", () => {
  it("置いた直後の世代には手を付けない（台帳へ書く前に走っても消えない）", async () => {
    // 順番は「R2 に置く → 台帳に書く」。その隙間で走ると、
    // いま上げたばかりの絵が「台帳に無い」に見える。
    const live = generation("7777aaaa");
    await putLedgerRow(live[0]!);
    const fresh = generation("8888bbbb");
    const store = fakeBucket([
      ...live.map((key) => ({ key, uploaded: LONG_AGO })),
      ...fresh.map((key) => ({ key, uploaded: JUST_NOW })),
    ]);

    const result = await sweepUnreferencedThumbnails(store.bucket, proxy.env.DB, NOW);

    expect(result.skipped).toBeNull();
    if (result.skipped !== null) return;
    expect(result.deleted).toBe(0);
    expect(store.objects.size).toBe(8);
  });

  it("置いた時刻が分からないものには手を付けない", async () => {
    await putLedgerRow(generation("9999cccc")[0]!);
    const store = fakeBucket(generation("aaaa1111").map((key) => ({ key })));

    const result = await sweepUnreferencedThumbnails(store.bucket, proxy.env.DB, NOW);

    expect(result.skipped).toBeNull();
    if (result.skipped !== null) return;
    // 猶予を判定できないなら、猶予のうちに居るかもしれない。
    expect(result.deleted).toBe(0);
  });

  it("台帳が空なら 1 枚も消さない", async () => {
    const store = fakeBucket(
      generation("bbbb2222").map((key) => ({ key, uploaded: LONG_AGO })),
    );

    const result = await sweepUnreferencedThumbnails(store.bucket, proxy.env.DB, NOW);

    // 本当に 1 枚も表紙が無い状態はあり得るが、そのときは消すものも無い。
    // 「表が空に見えているだけ」との区別が付かない以上、何もしない側へ倒す。
    expect(result.skipped).toBe("台帳に表紙が 1 件もありません");
    expect(store.objects.size).toBe(4);
  });

  it("台帳を読めなかったら 1 枚も消さない", async () => {
    const store = fakeBucket(
      generation("cccc3333").map((key) => ({ key, uploaded: LONG_AGO })),
    );
    const brokenDb = {
      prepare() {
        throw new Error("D1 down");
      },
    } as unknown as D1Database;

    const result = await sweepUnreferencedThumbnails(store.bucket, brokenDb, NOW);

    // ここは「台帳に無い鍵」を消す。台帳が空に見えた瞬間、全部が消える。
    expect(result.skipped).toBe("台帳を読めませんでした");
    expect(store.objects.size).toBe(4);
  });
});
