/**
 * @tier 1
 * @req REQ-BOPS09
 * @types equivalence, decision-table, boundary
 *
 * 評価の 2 つの口。読者が付ける側（`submitReaderRatingAction`）と、
 * 運営者が伏せる／戻す側（`manageBlogRatingAction`）。
 *
 * --- なぜここを別に見るのか ---
 *
 * この 2 つは**同じ票を扱うのに、握ってよい口が違う**。読者側は公開済み
 * しか返さない口（`publicBlogEntry`）だけを握り、運営側は作業場所つきの口
 * （`blogOpsEntry`）を握る。取り違えても画面はどちらも動くので、
 * 見た目からは分からない。
 *
 * 実測（2026-08-27）では両方とも分岐 0%。**書いた日から一度も
 * 通っていない。**評価は読者が触る数少ない口なので、断り方を
 * 間違えると「押したのに何も起きない」が読者側に出る。
 *
 * 集計そのものの正しさは `tests/application/blog-ops-usecases.test.ts` と
 * `tests/domain/blog-ops.test.ts` が見ている。ここで見るのは 3 つ:
 *
 * 1. **断る所で断る。**点数を選んでいない・ログインしていない・保存先が無い。
 * 2. **端末の目印の作り方。**あるものは使い回し、無ければ作って置く。
 * 3. **伏せると戻すの振り分け**と、そのあとに作り直す画面。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type DomainError, type Result, domainError, err, ok } from "@/domain/shared";
import { SAMPLE_ACTOR } from "@/infrastructure/identity/sample-actor";
import { READER_KEY_COOKIE } from "@/presentation/site/reader-rating-state";

const revalidated: string[] = [];
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => {
    revalidated.push(path);
  },
  revalidateTag: () => undefined,
}));

/**
 * 端末の目印の入れ物。**読むだけでなく置く側も見る**——
 * 置き忘れると、同じ読者が何度でも押せる状態が静かに出来上がる。
 */
let cookieValue: string | undefined;
const cookieSets: { name: string; value: string; options: Record<string, unknown> }[] = [];
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === READER_KEY_COOKIE && cookieValue !== undefined ? { value: cookieValue } : undefined,
    set: (name: string, value: string, options: Record<string, unknown>) => {
      cookieSets.push({ name, value, options });
      cookieValue = value;
    },
  }),
}));

let loggedIn = true;
let storageReady = true;
const seen: Record<string, unknown> = {};
const results: Record<string, Result<unknown, DomainError>> = {};

function recording(name: string) {
  return {
    execute: async (_actor: unknown, input: unknown) => {
      seen[name] = input;
      return results[name] as Result<unknown, DomainError>;
    },
  };
}

vi.mock("@/presentation/composition", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    signedInActor: async () => (loggedIn ? SAMPLE_ACTOR : null),
    publicBlogEntry: async () => ({ submitRating: recording("rating.submit") }),
    blogOpsEntry: async () =>
      storageReady
        ? { ready: true, setRatingHidden: recording("rating.hide") }
        : { ready: false, reason: "保存先 (D1) が用意されていません。" },
  };
});

const { submitReaderRatingAction } = await import("@/presentation/site/reader-rating-action");
const { manageBlogRatingAction } = await import("@/presentation/admin/publish/blog-rating-action");

const READER_IDLE = { status: "idle", message: "" } as const;
const OPS_IDLE = { status: "idle", message: "" } as const;

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.append(key, value);
  return data;
}

beforeEach(() => {
  loggedIn = true;
  storageReady = true;
  revalidated.length = 0;
  cookieSets.length = 0;
  cookieValue = undefined;
  for (const key of Object.keys(seen)) delete seen[key];
  results["rating.submit"] = ok({ count: 3, average: 4.5 });
  results["rating.hide"] = ok({});
});

describe("読者が評価を付ける口", () => {
  it("点数を選んでいなければ、ユースケースを呼ばずに断る", async () => {
    const state = await submitReaderRatingAction(
      READER_IDLE,
      form({ siteSlug: "owned-blog", articleSlug: "note", score: "", comment: "" }),
    );

    expect(state.status).toBe("failed");
    expect(state.field).toBe("score");
    // **呼ばないことまで見る。**`Number("")` は 0 なので、渡すと
    // 「1〜5 の外」という別の理由で断られ、読者には区別が付かない。
    expect(seen["rating.submit"]).toBeUndefined();
  });

  it("欄そのものが無いときも、点数未選択として断る", async () => {
    const state = await submitReaderRatingAction(READER_IDLE, form({ siteSlug: "owned-blog" }));

    expect(state.status).toBe("failed");
    expect(state.field).toBe("score");
  });

  it("目印がまだ無ければ作って置く（次からは同じ読者だと分かる）", async () => {
    await submitReaderRatingAction(
      READER_IDLE,
      form({ siteSlug: "owned-blog", articleSlug: "note", score: "5", comment: "" }),
    );

    expect(cookieSets).toHaveLength(1);
    expect(cookieSets[0]?.name).toBe(READER_KEY_COOKIE);
    expect(cookieSets[0]?.value).not.toBe("");
    // 端末の目印は、画面の script から読めてはいけない。
    expect(cookieSets[0]?.options.httpOnly).toBe(true);
    expect(cookieSets[0]?.options.sameSite).toBe("lax");
    expect((seen["rating.submit"] as { readerKey: string }).readerKey).toBe(cookieSets[0]?.value);
  });

  it("既にある目印は使い回し、置き直さない", async () => {
    cookieValue = "known-reader";

    await submitReaderRatingAction(
      READER_IDLE,
      form({ siteSlug: "owned-blog", articleSlug: "note", score: "4", comment: "" }),
    );

    expect(cookieSets).toHaveLength(0);
    expect((seen["rating.submit"] as { readerKey: string }).readerKey).toBe("known-reader");
  });

  it("空文字の目印は無いものとして扱い、作り直す", async () => {
    cookieValue = "";

    await submitReaderRatingAction(
      READER_IDLE,
      form({ siteSlug: "owned-blog", articleSlug: "note", score: "4", comment: "" }),
    );

    expect(cookieSets).toHaveLength(1);
    expect(cookieSets[0]?.value).not.toBe("");
  });

  it("点数は数として渡す", async () => {
    await submitReaderRatingAction(
      READER_IDLE,
      form({ siteSlug: "owned-blog", articleSlug: "note", score: "3", comment: "" }),
    );

    expect(seen["rating.submit"]).toMatchObject({
      siteSlug: "owned-blog",
      articleSlug: "note",
      score: 3,
    });
  });

  it("ひとことが空白だけなら、書かれなかったものとして渡す", async () => {
    await submitReaderRatingAction(
      READER_IDLE,
      form({ siteSlug: "owned-blog", articleSlug: "note", score: "5", comment: "   " }),
    );

    expect((seen["rating.submit"] as { comment: string | null }).comment).toBeNull();
  });

  it("ひとことがあれば、前後の空白を落とさずそのまま渡す", async () => {
    await submitReaderRatingAction(
      READER_IDLE,
      form({ siteSlug: "owned-blog", articleSlug: "note", score: "5", comment: " 読みやすい " }),
    );

    // 判定は trim で行うが、**渡すのは元のまま**。
    // ここで削ると、読者が入れた改行や字下げが黙って消える。
    expect((seen["rating.submit"] as { comment: string | null }).comment).toBe(" 読みやすい ");
  });

  it("受け付けたら、件数と平均をそのまま返す", async () => {
    const state = await submitReaderRatingAction(
      READER_IDLE,
      form({ siteSlug: "owned-blog", articleSlug: "note", score: "5", comment: "" }),
    );

    expect(state.status).toBe("done");
    expect(state.summary).toEqual({ count: 3, average: 4.5 });
  });

  it("まだ 1 票も無い記事では、平均が空のまま返る", async () => {
    results["rating.submit"] = ok({ count: 0, average: null });

    const state = await submitReaderRatingAction(
      READER_IDLE,
      form({ siteSlug: "owned-blog", articleSlug: "note", score: "5", comment: "" }),
    );

    expect(state.summary).toEqual({ count: 0, average: null });
  });

  it("断られたら、理由と欄の名前をそのまま返す", async () => {
    results["rating.submit"] = err(
      domainError("VALIDATION_FAILED", "点数は 1〜5 で選んでください。", { field: "score" }),
    );

    const state = await submitReaderRatingAction(
      READER_IDLE,
      form({ siteSlug: "owned-blog", articleSlug: "note", score: "9", comment: "" }),
    );

    expect(state.status).toBe("failed");
    // **欄名は濾さない。**濾すと「画面に無い欄名を返している」という
    // ユースケース側の誤りが、画面からも検査からも見えなくなる。
    expect(state.field).toBe("score");
  });

  it("欄名を持たない断りでも、理由は読者へ届く", async () => {
    results["rating.submit"] = err(domainError("NOT_FOUND", "記事 が見つかりません。"));

    const state = await submitReaderRatingAction(
      READER_IDLE,
      form({ siteSlug: "owned-blog", articleSlug: "gone", score: "5", comment: "" }),
    );

    expect(state.status).toBe("failed");
    expect(state.message).not.toBe("");
    expect(state.field).toBeUndefined();
  });
});

describe("運営者が評価を伏せる／戻す口", () => {
  it("ログインしていなければ断る", async () => {
    loggedIn = false;

    const state = await manageBlogRatingAction(
      OPS_IDLE,
      form({ articleId: "art-1", ratingId: "rt-1", intent: "hide", reason: "宣伝" }),
    );

    expect(state.status).toBe("failed");
    expect(seen["rating.hide"]).toBeUndefined();
  });

  it("保存先が無ければ、その理由をそのまま出す", async () => {
    storageReady = false;

    const state = await manageBlogRatingAction(
      OPS_IDLE,
      form({ articleId: "art-1", ratingId: "rt-1", intent: "hide", reason: "宣伝" }),
    );

    expect(state.status).toBe("failed");
    expect(state.message).toBe("保存先 (D1) が用意されていません。");
  });

  it("知らない業務語は断る", async () => {
    const state = await manageBlogRatingAction(
      OPS_IDLE,
      form({ articleId: "art-1", ratingId: "rt-1", intent: "delete", reason: "宣伝" }),
    );

    expect(state.status).toBe("failed");
    // **消す口は作っていない。**通ってしまうと、伏せた判断そのものが
    // 後から確かめられなくなる。
    expect(seen["rating.hide"]).toBeUndefined();
  });

  it("業務語が空でも断る", async () => {
    const state = await manageBlogRatingAction(
      OPS_IDLE,
      form({ articleId: "art-1", ratingId: "rt-1", intent: "", reason: "" }),
    );

    expect(state.status).toBe("failed");
    expect(seen["rating.hide"]).toBeUndefined();
  });

  it("伏せるでは hidden を立てて渡す", async () => {
    const state = await manageBlogRatingAction(
      OPS_IDLE,
      form({ articleId: "art-1", ratingId: "rt-1", intent: "hide", reason: "宣伝だけの文" }),
    );

    expect(seen["rating.hide"]).toEqual({
      articleId: "art-1",
      ratingId: "rt-1",
      hidden: true,
      reason: "宣伝だけの文",
    });
    expect(state.status).toBe("done");
    // 行が残っていることを、押した人にも伝える。
    expect(state.message).toContain("残っている");
  });

  it("戻すでは hidden を下ろして渡す", async () => {
    const state = await manageBlogRatingAction(
      OPS_IDLE,
      form({ articleId: "art-1", ratingId: "rt-1", intent: "show", reason: "見直した" }),
    );

    expect(seen["rating.hide"]).toMatchObject({ hidden: false });
    expect(state.status).toBe("done");
    expect(state.message).toContain("入り直します");
  });

  it("前後の空白は落として渡す", async () => {
    await manageBlogRatingAction(
      OPS_IDLE,
      form({ articleId: " art-1 ", ratingId: " rt-1 ", intent: " hide ", reason: " 宣伝 " }),
    );

    expect(seen["rating.hide"]).toEqual({
      articleId: "art-1",
      ratingId: "rt-1",
      hidden: true,
      reason: "宣伝",
    });
  });

  it("伏せたら、その記事の画面と一覧の両方を作り直す", async () => {
    await manageBlogRatingAction(
      OPS_IDLE,
      form({ articleId: "art-1", ratingId: "rt-1", intent: "hide", reason: "宣伝" }),
    );

    // 平均と件数が動くので、**一覧だけ古いまま**にならないようにする。
    expect(revalidated).toContain("/admin/blog/evaluate/art-1");
    expect(revalidated).toContain("/admin/blog/evaluate");
  });

  it("記事 ID に記号が入っていても、住所として壊れない形で作り直す", async () => {
    await manageBlogRatingAction(
      OPS_IDLE,
      form({ articleId: "art/1 2", ratingId: "rt-1", intent: "hide", reason: "宣伝" }),
    );

    expect(revalidated).toContain(`/admin/blog/evaluate/${encodeURIComponent("art/1 2")}`);
  });

  it("断られたら、作り直しをせずに理由を返す", async () => {
    results["rating.hide"] = err(domainError("NOT_FOUND", "評価 が見つかりません。"));

    const state = await manageBlogRatingAction(
      OPS_IDLE,
      form({ articleId: "art-1", ratingId: "rt-9", intent: "hide", reason: "宣伝" }),
    );

    expect(state.status).toBe("failed");
    // 変わっていないのに作り直すと、**直っていないのに直った合図**が出る。
    expect(revalidated).toHaveLength(0);
  });

  it("他所の作業場所の票は、断りとして返る", async () => {
    results["rating.hide"] = err(domainError("TENANT_MISMATCH", "この作業場所のものではありません。"));

    const state = await manageBlogRatingAction(
      OPS_IDLE,
      form({ articleId: "art-x", ratingId: "rt-x", intent: "hide", reason: "宣伝" }),
    );

    expect(state.status).toBe("failed");
    expect(revalidated).toHaveLength(0);
  });
});
