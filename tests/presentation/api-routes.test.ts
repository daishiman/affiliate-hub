/** @tier 1 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnyToolDefinition } from "@/presentation/tools/tool-definition";
import { NO_HAPPY_PATH, validInputFor } from "./tool-inputs";

/**
 * HTTP の入口 4 本（REST 一覧・REST 実行・バックエンド MCP・計測の受け口）。
 *
 * --- なぜ入口そのものを見るのか ---
 * 道具の中身と、道具を 3 つの入口に載せ替える部分は別のテストで固定してある。
 * 残っているのは**入口の手前**——出所の確認・身元の確認・見せてよい範囲の絞り込み——で、
 * ここは「同じ関数を全入口で使う」という約束の上に成り立っている。
 * 約束が守られているかは、**入口ごとに実際に叩いて同じ結果になること**でしか確かめられない。
 * 片方の入口にだけ緩い判定が残る、という壊れ方はこのテストが無いと見つからない。
 *
 * --- 差し替えているもの ---
 * Cloudflare の入れ物（接続用トークンの置き場）だけ。
 * 身元の判定そのもの（`authenticateApiRequest`）は本物を通す。
 * ここを差し替えると、判定を通したつもりで何も確かめないテストになる。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §2 / 統合仕様 §3「オリジン制約」
 */

/** 試験用の合言葉。本物の形をまねない（`test-honesty` が鍵らしい形を弾く）。 */
const TOKEN = "dummy-token-for-tests";

/** 未登録（＝閉じる）を試せるように、差し替え先を書き換えられる形にする。 */
let installedToken: string | undefined = TOKEN;

vi.mock("server-only", () => ({}));
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: { MCP_TOKEN: installedToken } }),
}));

const mcp = await import("@/app/api/mcp/route");
const toolsIndex = await import("@/app/api/tools/route");
const toolsCall = await import("@/app/api/tools/[tool]/route");
const telemetry = await import("@/app/api/telemetry/route");
const { createToolCatalog } = await import("@/presentation/composition");
const { clearTelemetryBuffer, recentTelemetry } = await import(
  "@/infrastructure/persistence/sample/telemetry-sample-sink"
);
const { CONSENT_COOKIE } = await import("@/presentation/telemetry/consent-server");
const { cookieJar } = await import("../support/cookie-jar");
const { PAGE_TOOLS } = await import("@/presentation/tools/webmcp-policy");

const ORIGIN = "https://hub.test";

type Headerish = Record<string, string>;

/** 合言葉つき（読み書きできる）。 */
function withToken(extra: Headerish = {}): Headerish {
  return { authorization: `Bearer ${TOKEN}`, ...extra };
}

/** 自サイトの画面から（読み取りだけ）。 */
function fromOwnScreen(extra: Headerish = {}): Headerish {
  return { "sec-fetch-site": "same-origin", ...extra };
}

function post(path: string, body: unknown, headers: Headerish = {}): Request {
  return new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function get(path: string, headers: Headerish = {}): Request {
  return new Request(`${ORIGIN}${path}`, { headers });
}

function params(tool: string): { params: Promise<{ tool: string }> } {
  return { params: Promise.resolve({ tool }) };
}

const CATALOG: readonly AnyToolDefinition[] = (await createToolCatalog());

/**
 * 道具は名前で決め打ちしない。
 *
 * 名前を書くと、その道具が消えたとき**テストだけが静かに意味を失う**
 * （名前が見つからず「見えない道具」の分岐に落ちるので、緑のまま残る）。
 * 性質（読み取り専用・人の承認が要る）で選べば、性質を持つ道具が
 * 1 つも無くなったときにここで落ちる。
 */
function pick(match: (t: AnyToolDefinition) => boolean, what: string): AnyToolDefinition {
  const found = CATALOG.find(match);
  if (found === undefined) throw new Error(`${what} にあたる道具が 1 つもありません。`);
  return found;
}

const READ_TOOL = pick(
  (t) => t.readOnly && NO_HAPPY_PATH[t.name] === undefined && validInputFor(t) !== null,
  "読み取り専用で、通る入力を組み立てられるもの",
);
const HUMAN_TOOL = pick((t) => t.requiresHumanApproval === true, "人の承認が要るもの");

/**
 * 読者のページに載せている道具の名前。
 *
 * ここも名前で決め打ちしない。載せる一覧（`PAGE_TOOLS`）から引くので、
 * 載せる道具を入れ替えたときに、この検査が自動で追従する。
 * 管理画面の分（`admin`）は読者ではないので外す。
 */
const READER_TOOL_NAMES = new Set(
  Object.entries(PAGE_TOOLS)
    .filter(([kind]) => kind !== "admin")
    .flatMap(([, names]) => names),
);

const READER_TOOL = pick(
  (t) => READER_TOOL_NAMES.has(t.name) && t.readOnly && validInputFor(t) !== null,
  "読者のページに載せていて、通る入力を組み立てられるもの",
);
const ADMIN_READ_TOOL = pick(
  (t) =>
    !READER_TOOL_NAMES.has(t.name) &&
    t.readOnly &&
    NO_HAPPY_PATH[t.name] === undefined &&
    validInputFor(t) !== null,
  "読者には見せていない読み取り専用で、通る入力を組み立てられるもの",
);

beforeEach(() => {
  installedToken = TOKEN;
  delete process.env.ALLOWED_ORIGINS;
  clearTelemetryBuffer();
});

afterEach(() => {
  delete process.env.ALLOWED_ORIGINS;
});

describe("身元の確認は入口をまたいで 1 つ", () => {
  it("接続用の合言葉が未登録なら、開けっ放しにせず閉じる", async () => {
    installedToken = undefined;

    const rest = await toolsIndex.GET(get("/api/tools", withToken()));
    const rpc = await mcp.POST(post("/api/mcp", { jsonrpc: "2.0", id: 1, method: "ping" }, withToken()));

    for (const res of [rest, rpc]) expect(res.status).toBe(503);
    // 直し方は本人が読む。値そのものは載せない。
    const body = (await rest.json()) as { error: string };
    expect(body.error).toContain("wrangler secret put");
    expect(body.error).not.toContain(TOKEN);
  });

  it("合言葉が違えば断る。応答に正解を載せない", async () => {
    const res = await mcp.POST(
      post("/api/mcp", { jsonrpc: "2.0", id: 1, method: "ping" }, { authorization: "Bearer wrong" }),
    );

    expect(res.status).toBe(401);
    // 次に何を直せばよいか分かる形で返す。
    expect(res.headers.get("www-authenticate")).toContain("Bearer");
    expect(await res.text()).not.toContain(TOKEN);
  });

  it("合言葉も自サイトの印も無ければ、入口 3 本とも断る", async () => {
    const results = await Promise.all([
      toolsIndex.GET(get("/api/tools")),
      mcp.GET(get("/api/mcp")),
      toolsCall.POST(post(`/api/tools/${READ_TOOL.name}`, {}), params(READ_TOOL.name)),
    ]);

    for (const res of results) expect(res.status).toBe(401);
  });
});

describe("よそのサイトからの呼び出し", () => {
  it("別のオリジンから呼ばれたら、実行の入口は 2 本とも断る", async () => {
    const foreign = { origin: "https://evil.test" };
    const rpc = await mcp.POST(
      post("/api/mcp", { jsonrpc: "2.0", id: 1, method: "ping" }, withToken(foreign)),
    );
    const rest = await toolsCall.POST(
      post(`/api/tools/${READ_TOOL.name}`, {}, withToken(foreign)),
      params(READ_TOOL.name),
    );

    for (const res of [rpc, rest]) {
      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: { code: string; suggestedAction: string } };
      expect(body.error.code).toBe("FORBIDDEN");
      // 黙って落とさない。運営者に何を確かめればよいかまで返す。
      expect(body.error.suggestedAction.trim()).not.toBe("");
    }
  });

  it("自分のオリジンからは通る", async () => {
    const res = await mcp.POST(
      post("/api/mcp", { jsonrpc: "2.0", id: 1, method: "ping" }, withToken({ origin: ORIGIN })),
    );
    expect(res.status).toBe(200);
  });

  it("運営者が明示的に許したオリジンは通る", async () => {
    process.env.ALLOWED_ORIGINS = "https://admin.test, https://other.test";

    const res = await mcp.POST(
      post(
        "/api/mcp",
        { jsonrpc: "2.0", id: 1, method: "ping" },
        withToken({ origin: "https://admin.test" }),
      ),
    );
    expect(res.status).toBe(200);
  });
});

describe("見せる範囲と実行できる範囲を一致させる", () => {
  it("自サイトの画面には、読み取りの道具しか見せない", async () => {
    const res = await toolsIndex.GET(get("/api/tools", fromOwnScreen()));
    const body = (await res.json()) as { tools: { name: string }[] };
    const shown = new Set(body.tools.map((t) => t.name));

    expect(shown.size).toBeGreaterThan(0);
    for (const tool of CATALOG) {
      // 一覧に出るのに**入口で**断られる、という食い違いを作らない。
      //
      // 判定は 2 段ある。ここで見ているのは 1 段目（入口・読み取りかどうか）だけで、
      // 2 段目（身元・何が読めるか）は呼んだときに効く。一覧は身元を見ていないので、
      // ログインしていない人には「名前は出るが呼ぶと断られる」道具が残る。
      // 名前は仕様として公開しているものなので、ここでは絞らない。
      // 2 段目の固定は `tests/presentation/api-scope-actor.test.ts`。
      const shouldShow = tool.readOnly && tool.requiresHumanApproval !== true;
      expect(shown.has(tool.name), tool.name).toBe(shouldShow);
    }
  });

  it("人の承認が要る道具は、合言葉を持っていても入口には出さない", async () => {
    const res = await toolsIndex.GET(get("/api/tools", withToken()));
    const body = (await res.json()) as { tools: { name: string }[] };

    expect(body.tools.map((t) => t.name)).not.toContain(HUMAN_TOOL.name);
  });

  it("見せていない道具を名指しで呼ばれても、理由を返して実行しない", async () => {
    const viaRest = await toolsCall.POST(
      post(`/api/tools/${HUMAN_TOOL.name}`, {}, withToken()),
      params(HUMAN_TOOL.name),
    );
    const viaMcp = await mcp.POST(
      post(
        "/api/mcp",
        { jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: HUMAN_TOOL.name, arguments: {} } },
        withToken(),
      ),
    );

    expect(viaRest.status).toBe(403);
    const rest = (await viaRest.json()) as { error: { message: string; suggestedAction: string } };
    expect(rest.error.message).toContain("人が画面で確認");
    expect(rest.error.suggestedAction).toContain("管理画面");

    const rpc = (await viaMcp.json()) as { error: { code: number; message: string }; result?: unknown };
    expect(rpc.error.code).toBe(-32600);
    expect(rpc.error.message).toContain("人が画面で確認");
    expect(rpc.result).toBeUndefined();
  });

  /**
   * 「読み取りだから自サイトの画面から実行できる」は、**2 段目の判定を忘れている**。
   *
   * 入口を通れるか（読み取りかどうか）と、通ったあと何が読めるか（身元）は別である。
   * ここを 1 つにまとめていたあいだ、ログインしていない人が見本の身元で
   * 改善要望や売上を読めていた（`ah-2ro`）。だからこの検査も 2 つに分ける。
   *
   * 身元の側の詳しい固定は `tests/presentation/api-scope-actor.test.ts`。
   */
  /**
   * 読者ページに載せている道具は、**読者の権限で動く**。
   *
   * 以前はここで 403 を固定していた。読者ページの画面は `read-site.ts`
   * （権限の要らない公開の道）を通るのに、同じページに載せた AI 向けの道具が
   * `read-product.ts`（`product.read` が要る管理側の道）を呼んでいたためである。
   * 同一サイトの呼び出しが見本の管理権限へ落ちていたあいだは通っていたので、
   * 画面上は正常に見えていた（`ah-2ro` でその落ち込みを止めて表に出た）。
   *
   * `ah-83f` で道具の向き先を読者ページの画面と同じ記事へ載せ替えた
   * （`reader-tools.ts`）。だからここは**通る側**を固定する。
   * この検査は `PAGE_TOOLS` から道具を引くので、載せる道具を差し替えると自動で追従し、
   * うっかり管理側の道具を読者ページへ戻すと落ちる。
   */
  it("読者ページに載せている道具は、読者の権限で実行できる", async () => {
    const res = await toolsCall.POST(
      post(`/api/tools/${READER_TOOL.name}`, validInputFor(READER_TOOL) ?? {}, fromOwnScreen()),
      params(READER_TOOL.name),
    );

    expect(res.status).toBe(200);
  });

  it("管理用の読み取りの道具は、ログインしていない画面からは実行できない", async () => {
    const res = await toolsCall.POST(
      post(
        `/api/tools/${ADMIN_READ_TOOL.name}`,
        validInputFor(ADMIN_READ_TOOL) ?? {},
        fromOwnScreen(),
      ),
      params(ADMIN_READ_TOOL.name),
    );

    // 入口（読み取りかどうか）は通る。断るのは身元の側である。
    expect(res.status).toBe(403);
  });
});

describe("REST の実行入口", () => {
  it("読み取れない本文は、直し方つきで断る", async () => {
    const res = await toolsCall.POST(
      post(`/api/tools/${READ_TOOL.name}`, "{ こわれた", withToken()),
      params(READ_TOOL.name),
    );

    const body = (await res.json()) as { error: { code: string; suggestedAction: string } };
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(body.error.suggestedAction).toContain("JSON");
  });

  it("無い道具を呼ばれたら、次にできることを添えて断る", async () => {
    const res = await toolsCall.POST(
      post("/api/tools/no_such_tool", {}, withToken()),
      params("no_such_tool"),
    );
    const body = (await res.json()) as { error: { code: string; suggestedAction: string } };

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
    // 送られてきた名前をそのまま返さない。返すと、応答を使って任意の文字列を映せる。
    expect(JSON.stringify(body)).not.toContain("no_such_tool");
    expect(body.error.suggestedAction).toContain("一覧");
  });
});

describe("バックエンド MCP の作法", () => {
  it("握手では、実装している版と名乗りを返す", async () => {
    const res = await mcp.POST(
      post("/api/mcp", { jsonrpc: "2.0", id: 1, method: "initialize" }, withToken()),
    );
    const body = (await res.json()) as {
      id: number;
      result: { protocolVersion: string; serverInfo: { name: string }; capabilities: unknown };
    };

    expect(body.id).toBe(1);
    expect(body.result.protocolVersion).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.result.serverInfo.name).toBe("affiliate-hub");
    expect(body.result.capabilities).toBeDefined();
  });

  it("握手の完了通知には本文を返さない", async () => {
    const res = await mcp.POST(
      post("/api/mcp", { jsonrpc: "2.0", method: "notifications/initialized" }, withToken()),
    );

    expect(res.status).toBe(202);
    expect(await res.text()).toBe("");
  });

  it("疎通確認は空の結果を返す", async () => {
    const res = await mcp.POST(
      post("/api/mcp", { jsonrpc: "2.0", id: "ping-1", method: "ping" }, withToken()),
    );
    const body = (await res.json()) as { id: string; result: unknown };

    expect(body.id).toBe("ping-1");
    expect(body.result).toEqual({});
  });

  it("本文が JSON でなければ、構文の誤りとして返す", async () => {
    const res = await mcp.POST(post("/api/mcp", "こわれている", withToken()));
    const body = (await res.json()) as { error: { code: number }; id: null };

    expect(body.error.code).toBe(-32700);
    expect(body.id).toBeNull();
  });

  it("JSON ではあるが呼び出しの形でなければ、要求の誤りとして返す", async () => {
    const res = await mcp.POST(post("/api/mcp", 42, withToken()));
    const body = (await res.json()) as { error: { code: number } };

    // -32700（読めない）と -32600（形が違う）は別。混ぜると送り側が直せない。
    expect(body.error.code).toBe(-32600);
  });

  it("知らないメソッドは、名前つきで断る", async () => {
    const res = await mcp.POST(
      post("/api/mcp", { jsonrpc: "2.0", id: 9, method: "tools/destroy" }, withToken()),
    );
    const body = (await res.json()) as { error: { code: number; message: string } };

    expect(body.error.code).toBe(-32601);
    expect(body.error.message).toContain("tools/destroy");
  });

  it("知らない通知（返事を待っていないもの）には、何も返さない", async () => {
    const res = await mcp.POST(post("/api/mcp", { jsonrpc: "2.0", method: "unknown/notice" }, withToken()));

    // 返事を待っていない相手にエラーを返すと、JSON-RPC の作法から外れる。
    expect(res.status).toBe(202);
  });

  it("道具の一覧は、呼び出し元ごとに絞られる", async () => {
    const asToken = await mcp.POST(
      post("/api/mcp", { jsonrpc: "2.0", id: 1, method: "tools/list" }, withToken()),
    );
    const asScreen = await mcp.POST(
      post("/api/mcp", { jsonrpc: "2.0", id: 1, method: "tools/list" }, fromOwnScreen()),
    );

    const names = async (res: Response) =>
      ((await res.json()) as { result: { tools: { name: string }[] } }).result.tools.map((t) => t.name);
    const withKey = await names(asToken);
    const onScreen = await names(asScreen);

    expect(onScreen.length).toBeLessThanOrEqual(withKey.length);
    for (const name of onScreen) expect(withKey).toContain(name);
  });

  it("道具を 1 つ実行できる", async () => {
    const res = await mcp.POST(
      post(
        "/api/mcp",
        {
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: { name: READ_TOOL.name, arguments: validInputFor(READ_TOOL) ?? {} },
        },
        withToken(),
      ),
    );
    const body = (await res.json()) as {
      id: number;
      result: { content: { type: string; text: string }[]; isError?: boolean };
    };

    expect(body.id).toBe(3);
    expect(body.result.isError).not.toBe(true);
    expect(body.result.content[0].text.trim()).not.toBe("");
  });

  it("疎通確認の GET では、読める道具の名前だけを返す", async () => {
    const res = await mcp.GET(get("/api/mcp", fromOwnScreen()));
    const body = (await res.json()) as { scope: string; tools: string[]; transport: string };

    expect(body.scope).toBe("same-origin");
    expect(body.transport).toContain("stateless");
    expect(body.tools).not.toContain(HUMAN_TOOL.name);
  });
});

describe("計測の受け口", () => {
  const pageView = {
    key: "page_view",
    occurredAt: "2026-08-17T00:00:00.000Z",
    payload: { siteSlug: "video-editing-gear", path: "/", referrerKind: "直接" },
  };

  async function send(body: unknown): Promise<number> {
    const res = await telemetry.POST(post("/api/telemetry", body));
    return res.status;
  }

  it("同意があれば受け取って数える", async () => {
    cookieJar.set(CONSENT_COOKIE, "granted");

    expect(await send({ events: [pageView], readerKey: "reader-test" })).toBe(204);
    expect(recentTelemetry().length).toBeGreaterThan(0);
  });

  it("送られてきた「同意しています」は信じない", async () => {
    // cookie を置かずに、本文だけで同意を主張させる。
    expect(await send({ events: [pageView], consent: "granted", readerKey: "reader-test" })).toBe(204);

    for (const event of recentTelemetry()) {
      // 判定を迂回する道を作らない。誰かを名指しできる印は残らない。
      expect(event.readerKey).toBeNull();
    }
  });

  it("読み取れない本文でも、読者の画面にはエラーを出さない", async () => {
    expect(await send("こわれている")).toBe(204);
    expect(recentTelemetry()).toHaveLength(0);
  });

  it("出来事が入っていなければ、何も記録しない", async () => {
    cookieJar.set(CONSENT_COOKIE, "granted");

    expect(await send({ events: [] })).toBe(204);
    expect(await send({ events: "まとめて" })).toBe(204);
    expect(await send({})).toBe(204);
    expect(recentTelemetry()).toHaveLength(0);
  });

  it("大きすぎる本文は読まずに捨てる", async () => {
    cookieJar.set(CONSENT_COOKIE, "granted");
    const flood = { events: Array.from({ length: 400 }, () => pageView), pad: "x".repeat(40 * 1024) };

    expect(await send(flood)).toBe(204);
    // 読まずに捨てるので、1 件も入らない。
    expect(recentTelemetry()).toHaveLength(0);
  });

  it("まとめ書きの上限を超えた分は切り捨てる", async () => {
    cookieJar.set(CONSENT_COOKIE, "granted");

    expect(await send({ events: Array.from({ length: 80 }, () => pageView) })).toBe(204);
    expect(recentTelemetry(200).length).toBeLessThanOrEqual(50);
  });
});
