/**
 * @tier 1
 * @req REQ-API02, REQ-FB13
 * @types permission-matrix, tenant-isolation
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 同じサイトの画面から来た呼び出しが、**どの身元で動くか**を固定する検査。
 *
 * --- なぜここを機械で見るのか ---
 *
 * `src/infrastructure/platform/api-token.ts` には、
 * 同一サイトからの呼び出しは「書き込みを守る仕組みではなく、
 * **公開ページと同じ読み取り範囲**を許すだけのもの」と書いてある。
 *
 * ところが `/api/tools` と `/api/mcp` は、その判定を通ったあとに
 * `currentActor()` を呼んでいた。`currentActor()` は**ログインできていないとき
 * 見本の身元へ落ちる**。見本が持つ役割は researcher / writer / reviewer /
 * analyst / feedback_admin で、公開ページの読者よりはるかに広い。
 * つまり**書いてある意図と、実際に効いていた範囲がずれていた**。
 *
 * `ah-3n1`（画面の写しの取り出し口）とまったく同じ原因である。
 * 見本へ落ちること自体は画面を組み立てるためには正しく、
 * 正しい挙動を**中身を外へ渡す口**で使ったことが穴だった。
 *
 * --- ここで見ている 3 つ ---
 *
 *   1. ログインしていない同一サイトの呼び出しが、管理用の読み取りを**通せない**
 *   2. 読者向けの読み取りは**通る**（下げすぎて読者ページの AI 案内を壊していない）
 *   3. 鍵（Bearer）の経路は**変わっていない**
 *
 * 2 を一緒に見るのは、1 だけを満たすなら「同一サイトを全部断る」で緑にできてしまい、
 * それだと WebMCP が黙って死ぬため。**閉じすぎたことも赤にする**。
 *
 * 規範:
 * - `src/infrastructure/platform/api-token.ts` の冒頭（意図が書いてある場所）
 * - `docs/product/traceability.md` REQ-API02 / REQ-FB13
 */

vi.mock("server-only", () => ({}));
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: { MCP_TOKEN: "test-token" } }),
}));

const { resetTestCookies } = await import("../support/cookie-jar");

/** 同一サイトの画面から来た呼び出し（ブラウザが付ける見出しを再現する）。 */
function sameOriginCall(tool: string, body: unknown = {}): Request {
  return new Request(`https://hub.test/api/tools/${tool}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://hub.test",
      "sec-fetch-site": "same-origin",
    },
    body: JSON.stringify(body),
  });
}

/** 門の合言葉だけを持った呼び出し（ブラウザ以外。Origin は付かない）。 */
function bearerCall(tool: string, body: unknown = {}, extraHeaders: Record<string, string> = {}): Request {
  return new Request(`https://hub.test/api/tools/${tool}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer test-token",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
}

const KEY_PLAIN = "integration-key-for-tests-0123456789abcdef";

/**
 * 見本の作業場所に、読み取りの鍵を 1 本置く。
 *
 * `tryGetDb()` が届かない試験環境では、鍵の保存先は見本の実装になる。
 * 置いた鍵は `vi.resetModules()` で消えるので、必要な試験ごとに置き直す。
 */
async function seedReadKey(): Promise<string> {
  const { issueIntegrationKey } = await import("@/domain/feedback");
  const { asIntegrationKeyId, asWorkspaceId } = await import("@/domain/shared");
  const { hashSecret } = await import("@/infrastructure/platform/secret-minter");
  const { seedIntegrationKey } = await import(
    "@/infrastructure/persistence/sample/feedback-sample-repository"
  );
  const built = issueIntegrationKey({
    id: asIntegrationKeyId("key_test"),
    workspaceId: asWorkspaceId("ws_sample"),
    label: "試験用の鍵",
    hashedValue: await hashSecret(KEY_PLAIN),
    scopes: ["read"],
    createdBy: "tester",
    at: new Date("2026-08-01T00:00:00Z"),
  });
  if (!built.ok) throw new Error(built.error.message);
  seedIntegrationKey(built.value);
  return "ws_sample";
}

function params(tool: string) {
  return { params: Promise.resolve({ tool }) };
}

async function codeOf(res: Response): Promise<string> {
  const body = (await res.json()) as { error?: { code?: string } };
  return body.error?.code ?? "OK";
}

describe("ログインしていない同一サイトの呼び出しは、読者の範囲しか読めない", () => {
  beforeEach(() => {
    resetTestCookies();
  });
  afterEach(() => {
    vi.resetModules();
  });

  it("改善要望の一覧は返さない（見本の身元なら読めてしまう）", async () => {
    const route = await import("@/app/api/tools/[tool]/route");
    const res = await route.POST(sameOriginCall("list_feedback"), params("list_feedback"));

    // 見本へ落ちていると 200 で中身が返る。それがこの課題（ah-2ro）の穴だった。
    expect(res.status).not.toBe(200);
    expect(await codeOf(res)).toBe("FORBIDDEN");
  });

  it("成果（売上）の一覧も返さない", async () => {
    const route = await import("@/app/api/tools/[tool]/route");
    const res = await route.POST(
      sameOriginCall("list_conversions", { period: "2026-08" }),
      params("list_conversions"),
    );

    expect(res.status).not.toBe(200);
    expect(await codeOf(res)).toBe("FORBIDDEN");
  });

  it("MCP の入口でも同じ（入口ごとに緩さが違う状態を作らない）", async () => {
    const route = await import("@/app/api/mcp/route");
    const res = await route.POST(
      new Request("https://hub.test/api/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://hub.test",
          "sec-fetch-site": "same-origin",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "list_feedback", arguments: {} },
        }),
      }),
    );

    const body = (await res.json()) as { result?: { isError?: boolean; content?: unknown } };
    // MCP は業務の断りを「エラー扱いの結果」として返す（JSON-RPC のエラーではない）。
    expect(body.result?.isError, JSON.stringify(body).slice(0, 300)).toBe(true);
  });
});

describe("読者向けの読み取りは、これまでどおり通る", () => {
  beforeEach(() => {
    resetTestCookies();
  });
  afterEach(() => {
    vi.resetModules();
  });

  it("公開されている記事の検索は同一サイトから通る（WebMCP を殺していない）", async () => {
    const route = await import("@/app/api/tools/[tool]/route");
    const res = await route.POST(
      sameOriginCall("search_articles", { siteSlug: "kurashi-no-erabikata", query: "" }),
      params("search_articles"),
    );

    // ここが FORBIDDEN になると、読者ページの AI 案内が黙って動かなくなる。
    expect(await codeOf(res)).not.toBe("FORBIDDEN");
  });
});

describe("鍵を持った呼び出しは変わらない", () => {
  beforeEach(() => {
    resetTestCookies();
  });
  afterEach(() => {
    vi.resetModules();
  });

  /**
   * **2026-08-18 に反転した。止まったことを、そのまま記録する。**
   *
   * 全体の合言葉（`MCP_TOKEN`）は「この入口を叩いてよい呼び出しか」しか見ておらず、
   * **どの作業場所の誰かを決めていない**。決まらないので身元は見本へ落ちる。
   * 見本から書き込みの役を外した結果、この経路の権限も読むだけになった。
   *
   * これは抜け道を塞いだのではなく、**この経路がもともと見本の権限に
   * ぶら下がっていた**ことが表に出たものである（`ah-3n1` / `ah-2ro` と同じ形）。
   *
   * 作業場所つきで取りに来る正しい道は `resolveIntegrationAccess`（連携の鍵）で、
   * そちらは `ai_service_account` の身元を鍵から組み立てる。
   * ここを緑に戻すために見本へ役を足さない。
   */
  it("Bearer だけでは管理用の読み取りは通らない（身元が決まらないため）", async () => {
    const route = await import("@/app/api/tools/[tool]/route");
    const res = await route.POST(bearerCall("list_feedback"), params("list_feedback"));

    expect(await codeOf(res)).toBe("FORBIDDEN");
  });

  /**
   * `ah-p9e` で決めたことの実物。**門と身元は別の見出しで名乗る。**
   * `Authorization: Bearer <MCP_TOKEN>` は「叩いてよい相手か」だけを通し、
   * 「どの作業場所の誰か」は `X-Integration-Key` の鍵から決まる。
   */
  it("鍵を添えた Bearer は、その鍵の作業場所として管理用の読み取りが通る", async () => {
    await seedReadKey();
    const route = await import("@/app/api/tools/[tool]/route");
    const res = await route.POST(
      bearerCall("list_feedback", {}, { "x-integration-key": KEY_PLAIN }),
      params("list_feedback"),
    );

    expect(await codeOf(res)).not.toBe("FORBIDDEN");
  });
});

describe("身元の決め方そのもの（口を 1 行触らずに穴が開くのを止める）", () => {
  beforeEach(() => {
    resetTestCookies();
  });

  it("ログインしていない同一サイトの身元は、読者と同じものになる", async () => {
    const { actorForScope, readerActor } = await import("@/presentation/composition");

    // 口の側の検査だけだと「たまたま今は閉じている」しか言えない。
    // 身元の決め方が見本へ戻されたら、route.ts を 1 行も触らずに穴が開く。
    expect(await actorForScope("same-origin", sameOriginCall("search_articles"))).toEqual(
      readerActor(),
    );
  });

  it("鍵の無い Bearer の身元は、見本ではなく読者になる", async () => {
    const { actorForScope, readerActor } = await import("@/presentation/composition");
    const { SAMPLE_ACTOR } = await import("@/infrastructure/identity/sample-actor");

    const actor = await actorForScope("bearer", bearerCall("list_feedback"));
    // ここが `currentActor()` へ戻ると見本になり、3 件の課題が同時に元へ戻る。
    expect(actor).toEqual(readerActor());
    expect(actor.workspaceId).not.toBe(SAMPLE_ACTOR.workspaceId);
  });

  it("通らない鍵を添えた Bearer も、見本ではなく読者になる", async () => {
    const { actorForScope, readerActor } = await import("@/presentation/composition");

    const actor = await actorForScope(
      "bearer",
      bearerCall("list_feedback", {}, { "x-integration-key": "no-such-key-0123456789abcdef" }),
    );
    expect(actor).toEqual(readerActor());
  });

  it("鍵を添えた Bearer の身元は、鍵の作業場所の ai_service_account になる", async () => {
    const workspaceId = await seedReadKey();
    const { actorForScope } = await import("@/presentation/composition");

    const actor = await actorForScope(
      "bearer",
      bearerCall("list_feedback", {}, { "x-integration-key": KEY_PLAIN }),
    );

    // 受入条件の 1 つ目。記録に残す材料が身元そのものに入っていること
    // （どの作業場所か・どの鍵か）。
    expect(actor.workspaceId).toBe(workspaceId);
    expect(actor.userId).toContain("試験用の鍵");
    expect(actor.roles).toEqual(["ai_service_account"]);
    expect(actor.isAiServiceAccount).toBe(true);
    expect(actor.identified).toBe(true);

    // 受入条件の 2 つ目。鍵の作業場所以外へは広がらない。
    const { SAMPLE_ACTOR } = await import("@/infrastructure/identity/sample-actor");
    expect(actor.roles).not.toEqual(SAMPLE_ACTOR.roles);
  });

  it("見本の身元は、書き込みの役を 1 つも持たない", async () => {
    const { can } = await import("@/domain/identity/permissions");
    const { SAMPLE_ACTOR } = await import("@/infrastructure/identity/sample-actor");

    // 2026-08-18 に反転した検査である。
    // 以前はここで「見本でも改善要望を読める」ことを固定していた。
    // 認証が無いまま管理画面が開く（`docs/product/open-doors.md`）以上、
    // 見本に配った権限は**アドレスを知っている人全員に配った権限**と同じである。
    for (const capability of [
      "content.write",
      "content.approve",
      "content.publish",
      "product.write",
      "site.draft",
      "feedback.manage",
      "integration_key.manage",
    ] as const) {
      expect(can(SAMPLE_ACTOR, capability), `見本が ${capability} を持っています`).toBe(false);
    }

    // 読むところまでは残す。ここまで塞ぐと画面が 1 枚も開かず、
    // 「閉じた」ではなく「壊れた」になる。
    expect(can(SAMPLE_ACTOR, "content.read")).toBe(true);
  });
});
