/** @tier 1 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 画面の写しの取り出し口（GET /api/feedback-captures/<id>）を、
 * **ログインで閉じたこと**を固定する検査。
 *
 * --- なぜここを機械で見るのか ---
 *
 * この口が返すのは、**撮った人の画面がそのまま入った画像**である。
 * 他の担当者の氏名・顧客名・書きかけの原稿が写り込む。
 * それでも 2026-08-17 の時点では、ログインしていない人が
 * 見本の身元（`identity:sample-actor`）のまま開ける状態だった。
 * 原因は `currentActor()` が**ログインできていないとき見本へ落ちる**ことで、
 * これは画面を組み立てるためには正しい挙動である。
 * 正しい挙動を、渡してはいけない場所で使ったことが穴だった。
 *
 * だからこの検査が見るのは 2 つある。
 *
 *   1. 口が閉じていること（未ログインでは 401）
 *   2. **落ちない身元の取り方が存在すること**（`signedInActor()` は見本へ落ちない）
 *
 * 2 を別に見るのは、1 だけだと「たまたま今は閉じている」しか言えないため。
 * `signedInActor()` が将来 `currentActor()` と同じ実装に戻されたら、
 * 口の側を 1 行も触らずに穴が開く。その戻り方をここで止める。
 *
 * --- 401 と 404 の使い分けを固定する ---
 *
 * 未ログイン → 401（どの URL でも同じなので、存在は漏れない。案内は残る）
 * ログイン済みだが権限が無い / 他所のもの / 無い → **すべて 404**
 * （言い分けると、識別子を総当たりして存在するものを数え上げられる）
 *
 * 規範: docs/product/traceability.md REQ-FB13
 * @req REQ-FB13
 * @types permission-matrix, tenant-isolation
 */

vi.mock("server-only", () => ({}));
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: {} }),
}));

const { resetTestCookies, setTestCookie } = await import("../support/cookie-jar");
const { SESSION_COOKIE_NAME } = await import("@/infrastructure/identity/session-actor");
const { SAMPLE_ACTOR } = await import("@/infrastructure/identity/sample-actor");

function request(id = "cap_anything"): [Request, { params: Promise<{ capture: string }> }] {
  return [
    new Request(`https://hub.test/api/feedback-captures/${id}`),
    { params: Promise.resolve({ capture: id }) },
  ];
}

describe("画面の写しの取り出し口は、ログインで閉じている", () => {
  beforeEach(() => {
    resetTestCookies();
  });
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@/presentation/composition");
  });

  it("ログインしていなければ 401 で、中身を 1 バイトも返さない", async () => {
    const route = await import("@/app/api/feedback-captures/[capture]/route");
    const res = await route.GET(...request());

    expect(res.status).toBe(401);
    expect(await res.arrayBuffer()).toHaveProperty("byteLength", 0);
  });

  it("合言葉はあるが確かめられないときも渡さない（保存先を落として認証を外せない）", async () => {
    // cookie はあるが、この環境に D1 は無い。`unavailable` になる経路。
    setTestCookie(SESSION_COOKIE_NAME, "not-a-real-session-token");

    const route = await import("@/app/api/feedback-captures/[capture]/route");
    const res = await route.GET(...request());

    expect(res.status).toBe(401);
  });

  it("保存も検索もさせない見出しを、断るときにも付ける", async () => {
    const route = await import("@/app/api/feedback-captures/[capture]/route");
    const res = await route.GET(...request());

    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-robots-tag")).toContain("noindex");
  });

  it("ログインできていても読む権限が無ければ 404（「無い」と区別が付かない）", async () => {
    vi.doMock("@/presentation/composition", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@/presentation/composition")>()),
      // 記事は書けるが、要望を読む権限は持たない人。
      signedInActor: async () => ({ ...SAMPLE_ACTOR, roles: ["writer"] as const }),
    }));

    const route = await import("@/app/api/feedback-captures/[capture]/route");
    const res = await route.GET(...request());

    expect(res.status).toBe(404);
    expect(await res.arrayBuffer()).toHaveProperty("byteLength", 0);
  });

  it("権限が無いときと、そもそも無いときで、応答が 1 文字も違わない", async () => {
    vi.doMock("@/presentation/composition", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@/presentation/composition")>()),
      signedInActor: async () => ({ ...SAMPLE_ACTOR, roles: ["writer"] as const }),
    }));
    const noPermission = await (
      await import("@/app/api/feedback-captures/[capture]/route")
    ).GET(...request("cap_exists_elsewhere"));

    vi.resetModules();
    vi.doMock("@/presentation/composition", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@/presentation/composition")>()),
      signedInActor: async () => ({ ...SAMPLE_ACTOR, roles: ["feedback_admin"] as const }),
    }));
    const missing = await (
      await import("@/app/api/feedback-captures/[capture]/route")
    ).GET(...request("cap_does_not_exist"));

    expect(noPermission.status).toBe(missing.status);
    expect(await noPermission.text()).toBe(await missing.text());
    expect([...noPermission.headers].sort()).toEqual([...missing.headers].sort());
  });
});

describe("どの作業場所のものかは、URL ではなく身元から決まる", () => {
  beforeEach(() => {
    resetTestCookies();
  });
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@/presentation/composition");
    vi.doUnmock("@/infrastructure/platform/feedback-capture-r2");
    vi.doUnmock("@/infrastructure/platform/bucket-connection");
  });

  it("URL に何を書いても、渡されるのは呼び出した人の作業場所", async () => {
    // ここが URL 由来になると、識別子を書き換えて他所の写しを指せる。
    // 404 だけを見ていても気づけない（他所のものは実在するので 200 が返ってしまう）。
    const seen: string[] = [];
    vi.doMock("@/presentation/composition", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@/presentation/composition")>()),
      signedInActor: async () => ({ ...SAMPLE_ACTOR, workspaceId: "ws_mine" }),
    }));
    vi.doMock("@/infrastructure/platform/bucket-connection", () => ({
      tryGetBucket: async () => ({}),
    }));
    vi.doMock("@/infrastructure/platform/feedback-capture-r2", () => ({
      readFeedbackCapture: async (_bucket: unknown, workspaceId: string) => {
        seen.push(workspaceId);
        return null;
      },
    }));

    const route = await import("@/app/api/feedback-captures/[capture]/route");
    await route.GET(...request("cap_belonging_to_ws_theirs"));

    expect(seen).toEqual(["ws_mine"]);
  });
});

describe("身元の取り方が 2 つあり、渡す口は落ちない方を使う", () => {
  beforeEach(() => {
    resetTestCookies();
  });

  it("ログインしていないとき、画面用は見本へ落ち、渡す用は null になる", async () => {
    const { currentActor, signedInActor } = await import("@/presentation/composition");

    // 画面はこれで動き続ける（断りは actorNotice() が出す）。
    expect((await currentActor()).userId).toBe(SAMPLE_ACTOR.userId);
    // 中身を外へ渡す口は、これで閉じる。
    expect(await signedInActor()).toBeNull();
  });

  it("見本の身元は、要望を読む権限を実際に持っている（だから落ちると危ない）", async () => {
    const { can } = await import("@/domain/identity/permissions");

    // この検査が緑であるかぎり、`currentActor()` を渡す口で使うことは穴になる。
    // 見本から権限を外して閉じる、という直し方を選ばなかった理由でもある
    // （外すと、認証が入るまで誰も改善要望の画面を確かめられなくなる）。
    expect(can(SAMPLE_ACTOR, "feedback.read")).toBe(true);
  });
});
