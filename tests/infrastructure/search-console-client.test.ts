/**
 * @tier 1
 * @req REQ-SEO07
 * @types equivalence, boundary, secrets
 *
 * 系統②（Google Search Console）の外側の口を確かめる。
 *
 * --- ここで見たいこと ---
 * 1. **秘密鍵が外へ出ないこと。** `configured()` は真偽値しか返さず、
 *    失敗の `details` にも要求の経路にも鍵が現れない。
 * 2. **読み取りの権限しか要求しないこと。** 自分で組み立てた JWT の
 *    `scope` を実際に開いて確かめる。
 * 3. **欠けた行を捨てても、取れた行は残ること。**
 *
 * --- なぜ本物の鍵を作るのか ---
 * `crypto.subtle` の署名を差し替えると、PEM の読み取り（`pemToBytes`）が
 * 一度も動かない。ここは「鍵は登録したのに認可だけ失敗する」という
 * 分かりにくい壊れ方が出る場所なので、**本物の鍵で 1 度は通す。**
 * 鍵はこのテストの中で作って捨てる。リポジトリには置かない。
 */
import { beforeAll, describe, expect, it } from "vitest";
import { createSearchConsoleClient } from "@/infrastructure/seo/aeo-measurement/search-console-client";

const SITE_URL = "sc-domain:example.com";
const START = "2026-08-15";
const END = "2026-08-15";
const CLIENT_EMAIL = "measurement@example-project.iam.gserviceaccount.com";
const ACCESS_TOKEN = "ya29.access-token-value";

type Call = { readonly url: string; readonly init: RequestInit };

/** テストの中だけで生きる本物の RSA 鍵。PEM の形まで含めて本番と同じにする。 */
let privateKeyPem = "";

beforeAll(async () => {
  const pair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  let binary = "";
  for (const byte of pkcs8) binary += String.fromCharCode(byte);
  const base64 = btoa(binary).replace(/(.{64})/g, "$1\n");
  privateKeyPem = `-----BEGIN PRIVATE KEY-----\n${base64}\n-----END PRIVATE KEY-----\n`;
});

function serviceAccountJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    type: "service_account",
    client_email: CLIENT_EMAIL,
    private_key: privateKeyPem,
    ...overrides,
  });
}

/** 「全部通る良い例」。ここから 1 か所ずつ崩す。 */
function aRow(overrides: Record<string, unknown> = {}): unknown {
  return {
    keys: ["2026-08-15", "https://example.com/s/creator-tools/guides/quiet-laptop"],
    impressions: 320,
    clicks: 12,
    position: 8.4,
    ...overrides,
  };
}

type HarnessOptions = {
  readonly json?: string | undefined;
  readonly tokenStatus?: number;
  readonly tokenBody?: unknown;
  readonly queryStatus?: number;
  readonly queryBody?: unknown;
  readonly queryBodies?: readonly unknown[];
  readonly queryThrows?: Error;
  readonly retryDelay?: (milliseconds: number) => Promise<void>;
};

function harness(options: HarnessOptions = {}) {
  const calls: Call[] = [];
  let queryCallIndex = 0;
  const client = createSearchConsoleClient({
    serviceAccountJson: "json" in options ? options.json : serviceAccountJson(),
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init: init ?? {} });

      if (url.startsWith("https://oauth2.googleapis.com/token")) {
        return new Response(
          JSON.stringify(options.tokenBody ?? { access_token: ACCESS_TOKEN }),
          { status: options.tokenStatus ?? 200 },
        );
      }

      if (options.queryThrows) throw options.queryThrows;
      const body = options.queryBodies?.[queryCallIndex] ?? options.queryBody ?? { rows: [aRow()] };
      queryCallIndex += 1;
      return new Response(JSON.stringify(body), {
        status: options.queryStatus ?? 200,
      });
    }) as typeof fetch,
    retryDelay: options.retryDelay,
  });
  return { client, calls };
}

/** base64url の塊を JSON として開く。JWT の中身を人の目で見るため。 */
function decodeSegment(segment: string): Record<string, unknown> {
  const padded = segment.replace(/-/g, "+").replace(/_/g, "/");
  const filled = padded + "=".repeat((4 - (padded.length % 4)) % 4);
  return JSON.parse(atob(filled)) as Record<string, unknown>;
}

describe("Search Console の口", () => {
  describe("資格情報の扱い", () => {
    it("読める JSON が入っていれば configured は true を返す（中身は返さない）", () => {
      const { client } = harness();
      expect(client.configured()).toBe(true);
      expect(typeof client.configured()).toBe("boolean");
    });

    it("壊れた JSON は「登録されていない」と同じ扱いにする", () => {
      /*
        壊れた値を「登録済み」と見なすと、収集のたびに失敗が記録され、
        画面に赤い印が出続ける。**まだ登録していない状態と同じ**にすれば、
        「登録してください」という直しようのある案内が出る。
      */
      expect(harness({ json: "{ これは JSON ではない" }).client.configured()).toBe(false);
    });

    it("必須の欄が欠けた JSON も「登録されていない」と同じ扱いにする", () => {
      expect(
        harness({ json: JSON.stringify({ client_email: CLIENT_EMAIL }) }).client.configured(),
      ).toBe(false);
      expect(
        harness({ json: JSON.stringify({ private_key: privateKeyPem }) }).client.configured(),
      ).toBe(false);
      expect(harness({ json: "   " }).client.configured()).toBe(false);
      expect(harness({ json: undefined }).client.configured()).toBe(false);
    });

    it("資格情報が無いときは網に出ず断る", async () => {
      const { client, calls } = harness({ json: undefined });

      const result = await client.fetchRows({ siteUrl: SITE_URL, startDate: START, endDate: END });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("VALIDATION_FAILED");
      expect(result.error.retryable).toBe(false);
      expect(calls).toHaveLength(0);
    });

    it("失敗しても秘密鍵が結果に混ざらない", async () => {
      const { client } = harness({ queryStatus: 403, queryBody: { error: { message: "denied" } } });

      const result = await client.fetchRows({ siteUrl: SITE_URL, startDate: START, endDate: END });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(JSON.stringify(result.error)).not.toContain("BEGIN PRIVATE KEY");
      expect(result.error.details).toEqual({ status: "403" });
      // 403 のときだけは「何をすれば直るか」を変える。
      // 時間をおいても直らない種類の失敗なので。
      expect(result.error.suggestedAction).toBe(
        "サービスアカウントをプロパティの利用者へ追加してください。",
      );
    });

    it("PEM の改行が 2 文字の `\\n` として保存されていても通る", async () => {
      const escaped = serviceAccountJson({ private_key: privateKeyPem.replace(/\n/g, "\\n") });
      const { client } = harness({ json: escaped });

      const result = await client.fetchRows({ siteUrl: SITE_URL, startDate: START, endDate: END });

      expect(result.ok).toBe(true);
    });
  });

  describe("認可の組み立て", () => {
    it("読み取りだけの権限を、自分のサービスアカウントとして要求する", async () => {
      const { client, calls } = harness();

      await client.fetchRows({ siteUrl: SITE_URL, startDate: START, endDate: END });

      const tokenCall = calls[0];
      expect(tokenCall?.url).toBe("https://oauth2.googleapis.com/token");
      const body = new URLSearchParams(String(tokenCall?.init.body));
      expect(body.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer");

      const [header, claims, signature] = String(body.get("assertion")).split(".");
      expect(decodeSegment(String(header))).toEqual({ alg: "RS256", typ: "JWT" });

      const parsed = decodeSegment(String(claims));
      expect(parsed.iss).toBe(CLIENT_EMAIL);
      // 書き込みの権限を混ぜない。取るだけの口が消す力を持つ理由が無い。
      expect(parsed.scope).toBe("https://www.googleapis.com/auth/webmasters.readonly");
      expect(parsed.aud).toBe("https://oauth2.googleapis.com/token");
      // 発行から使うまでの時刻のずれで期限切れにならないよう、端に寄せない。
      expect(Number(parsed.exp) - Number(parsed.iat)).toBe(55 * 60);

      // 署名は本物の鍵で作られている（空でも「なし」でもない）。
      expect(String(signature).length).toBeGreaterThan(100);
    });

    it("秘密鍵そのものは認可の要求に現れない", async () => {
      const { client, calls } = harness();

      await client.fetchRows({ siteUrl: SITE_URL, startDate: START, endDate: END });

      expect(String(calls[0]?.init.body)).not.toContain("BEGIN PRIVATE KEY");
      expect(String(calls[0]?.init.body)).not.toContain(privateKeyPem.slice(40, 120));
    });

    it("認可に失敗したら、あとで試せる失敗として返し、実績は取りに行かない", async () => {
      const { client, calls } = harness({ tokenStatus: 401 });

      const result = await client.fetchRows({ siteUrl: SITE_URL, startDate: START, endDate: END });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("UPSTREAM_UNAVAILABLE");
      expect(result.error.retryable).toBe(true);
      expect(JSON.stringify(result.error)).not.toContain("BEGIN PRIVATE KEY");
      expect(calls).toHaveLength(1);
    });

    it("トークンが返ってこなければ実績を取りに行かない", async () => {
      const { client, calls } = harness({ tokenBody: { expires_in: 3600 } });

      const result = await client.fetchRows({ siteUrl: SITE_URL, startDate: START, endDate: END });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(calls).toHaveLength(1);
    });

    it("同じclientの日別取得と検索語取得はtokenを再利用する", async () => {
      const { client, calls } = harness({ queryBody: { rows: [] } });

      await client.fetchRows({ siteUrl: SITE_URL, startDate: START, endDate: END });
      await client.fetchRows({ siteUrl: SITE_URL, startDate: START, endDate: END });
      await client.fetchQueryRows({ siteUrl: SITE_URL, metricDate: START, startRow: 0, rowBudget: 100 });

      expect(calls.filter((call) => call.url.startsWith("https://oauth2.googleapis.com/token"))).toHaveLength(1);
      expect(calls.filter((call) => call.url.includes("searchAnalytics/query"))).toHaveLength(3);
    });
  });

  describe("実績の取り方", () => {
    it("複数日のpage集計は日ごとに独立した要求にする", async () => {
      const { client, calls } = harness({ queryBodies: [{ rows: [] }, { rows: [] }] });

      const result = await client.fetchRows({ siteUrl: SITE_URL, startDate: "2026-08-15", endDate: "2026-08-16" });

      expect(result.ok).toBe(true);
      const bodies = calls.slice(1).map((call) => JSON.parse(String(call.init.body)) as Record<string, unknown>);
      expect(bodies.map((body) => [body.startDate, body.endDate, body.startRow])).toEqual([
        ["2026-08-15", "2026-08-15", 0],
        ["2026-08-16", "2026-08-16", 0],
      ]);
    });

    it("25,000 行ごと startRow を進め、短いページで止まる", async () => {
      const fullPage = Array.from({ length: 25_000 }, (_, index) =>
        aRow({ keys: ["2026-08-15", `https://example.com/s/creator-tools/guides/page-${index}`] }),
      );
      const { client, calls } = harness({ queryBodies: [{ rows: fullPage }, { rows: [aRow()] }] });

      const result = await client.fetchRows({ siteUrl: SITE_URL, startDate: START, endDate: END });

      expect(result.ok && result.value.rows).toHaveLength(25_001);
      const bodies = calls.slice(1).map((call) => JSON.parse(String(call.init.body)) as Record<string, unknown>);
      expect(bodies.map((body) => body.startRow)).toEqual([0, 25_000]);
      expect(bodies.every((body) => body.rowLimit === 25_000)).toBe(true);
      expect(result.ok && result.value.mayBeLimited).toBe(false);
    });

    it("検索語明細は日付・ページ・検索語の軸で取り、検索語を加工しない", async () => {
      const { client, calls } = harness({
        queryBody: { rows: [aRow({ keys: ["2026-08-15", "https://example.com/s/creator-tools/guides/quiet-laptop", "  静かな PC  "] })] },
      });

      const result = await client.fetchQueryRows({
        siteUrl: SITE_URL,
        metricDate: "2026-08-15",
        startRow: 0,
        rowBudget: 25_000,
      });

      expect(result.ok && result.value.rows[0]?.query).toBe("  静かな PC  ");
      const body = JSON.parse(String(calls[1]?.init.body)) as Record<string, unknown>;
      expect(body.dimensions).toEqual(["date", "page", "query"]);
      expect(body.startRow).toBe(0);
      expect(body.rowLimit).toBe(25_000);
    });

    it("壊れた行を型変換で落としてもAPI生取得数は予算消費として保持する", async () => {
      const { client } = harness({
        queryBody: { rows: [
          aRow({ keys: ["2026-08-15", "https://example.com/s/creator-tools/guides/quiet-laptop", "valid"] }),
          aRow({ keys: ["2026-08-15"] }),
        ] },
      });

      const result = await client.fetchQueryRows({
        siteUrl: SITE_URL, metricDate: "2026-08-15", startRow: 0, rowBudget: 25_000,
      });

      expect(result).toMatchObject({ ok: true, value: { rowsFetched: 2, rows: [{ query: "valid" }] } });
    });

    it("429 は指数バックオフで最大 3 回だけ再試行する", async () => {
      const delays: number[] = [];
      let attempts = 0;
      const client = createSearchConsoleClient({
        serviceAccountJson: serviceAccountJson(),
        retryDelay: async (milliseconds) => { delays.push(milliseconds); },
        fetch: (async (input: RequestInfo | URL) => {
          if (String(input).startsWith("https://oauth2.googleapis.com/token")) {
            return Response.json({ access_token: ACCESS_TOKEN });
          }
          attempts += 1;
          return attempts < 3 ? new Response("", { status: 429 }) : Response.json({ rows: [] });
        }) as typeof fetch,
      });

      const result = await client.fetchRows({ siteUrl: SITE_URL, startDate: START, endDate: END });

      expect(result.ok).toBe(true);
      expect(attempts).toBe(3);
      expect(delays).toEqual([100, 200]);
    });

    it("403 は再試行しない", async () => {
      const { client, calls } = harness({ queryStatus: 403 });
      const result = await client.fetchRows({ siteUrl: SITE_URL, startDate: START, endDate: END });
      expect(result.ok).toBe(false);
      expect(calls.filter((call) => call.url.includes("searchAnalytics/query"))).toHaveLength(1);
    });

    it("同じfull pageが繰り返されたら成功扱いにしない", async () => {
      const fullPage = Array.from({ length: 25_000 }, (_, index) => aRow({
        keys: [START, `https://example.com/s/creator-tools/guides/page-${index}`, `query-${index}`],
      }));
      const { client } = harness({ queryBodies: [{ rows: fullPage }, { rows: fullPage.slice(0, 15_000) }] });

      const result = await client.fetchQueryRows({
        siteUrl: SITE_URL, metricDate: START, startRow: 0, rowBudget: 40_000,
      });

      expect(result).toMatchObject({ ok: false, error: { code: "UPSTREAM_UNAVAILABLE" } });
    });
    it("日付とページの 2 軸で問い合わせ、取ったトークンを添える", async () => {
      const { client, calls } = harness();

      await client.fetchRows({ siteUrl: SITE_URL, startDate: START, endDate: END });

      const queryCall = calls[1];
      /*
        `sc-domain:example.com` には `:` が入る。そのまま経路へ入れると
        別のプロパティを指したり 404 になったりする。
      */
      expect(queryCall?.url).toBe(
        "https://searchconsole.googleapis.com/webmasters/v3/sites/sc-domain%3Aexample.com/searchAnalytics/query",
      );
      expect(queryCall?.init.headers).toMatchObject({
        authorization: `Bearer ${ACCESS_TOKEN}`,
      });

      const body = JSON.parse(String(queryCall?.init.body)) as Record<string, unknown>;
      // 日付を落とすと期間の合計しか返らず、「下がっている」を見る材料が消える。
      expect(body.dimensions).toEqual(["date", "page"]);
      expect(body.startDate).toBe(START);
      expect(body.endDate).toBe(END);
      expect(body.type).toBe("web");
      expect(body.startRow).toBe(0);
      expect(body.rowLimit).toBe(25_000);
    });

    it("取れた行をそのまま型へ移す", async () => {
      const { client } = harness();

      const result = await client.fetchRows({ siteUrl: SITE_URL, startDate: START, endDate: END });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.rows).toEqual([
        {
          url: "https://example.com/s/creator-tools/guides/quiet-laptop",
          metricDate: "2026-08-15",
          impressions: 320,
          clicks: 12,
          position: 8.4,
        },
      ]);
    });

    it("軸が欠けた行だけを捨て、他の行は残す", async () => {
      const { client } = harness({
        queryBody: {
          rows: [
            aRow({ keys: undefined }),
            aRow({ keys: ["2026-08-15"] }),
            null,
            "行ではない",
            aRow(),
          ],
        },
      });

      const result = await client.fetchRows({ siteUrl: SITE_URL, startDate: START, endDate: END });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      /*
        1 行が壊れているだけで全部を落とすと、その日の実績が丸ごと消える。
        消えたことは画面上「数字が無い日」にしか見えず、壊れたとは分からない。
      */
      expect(result.value.rows).toHaveLength(1);
      expect(result.value.rows[0]?.metricDate).toBe("2026-08-15");
    });

    it("数の欄が欠けている行は 0 として読む", async () => {
      const { client } = harness({
        queryBody: {
          rows: [aRow({ impressions: undefined, clicks: undefined, position: undefined })],
        },
      });

      const result = await client.fetchRows({ siteUrl: SITE_URL, startDate: START, endDate: END });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.rows[0]).toMatchObject({ impressions: 0, clicks: 0, position: 0 });
    });

    it("行が 1 つも無いのは失敗ではない", async () => {
      const { client } = harness({ queryBody: {} });

      const result = await client.fetchRows({ siteUrl: SITE_URL, startDate: START, endDate: END });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // 作ったばかりのサイトには実績が無い。無いことを失敗にすると、
      // 立ち上げ直後の運営者に毎回赤い印が出る。
      expect(result.value).toEqual({ rows: [], mayBeLimited: false });
    });

    it("混み合い（429）と上流の不調（5xx）はあとで試す", async () => {
      for (const status of [429, 500, 503]) {
        const result = await harness({ queryStatus: status }).client.fetchRows({
          siteUrl: SITE_URL,
          startDate: START,
          endDate: END,
        });
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.retryable).toBe(true);
      }
    });

    it("こちらの間違い（4xx）はあとで試しても直らない", async () => {
      for (const status of [400, 403, 404]) {
        const result = await harness({ queryStatus: status }).client.fetchRows({
          siteUrl: SITE_URL,
          startDate: START,
          endDate: END,
        });
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.retryable).toBe(false);
      }
    });

    it("網に出られなければ、空の実績ではなく失敗として返す", async () => {
      const { client } = harness({ queryThrows: new TypeError("network down") });

      const result = await client.fetchRows({ siteUrl: SITE_URL, startDate: START, endDate: END });

      /*
        ここを空配列にすると、通信が落ちた日に「表示 0 回」が保存され、
        あとから見たとき本当に見られていない日と区別が付かなくなる。
      */
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("UPSTREAM_UNAVAILABLE");
      expect(result.error.retryable).toBe(true);
      expect(result.error.details).toEqual({ reason: "TypeError" });
    });

    it("headers後にbodyが止まってもtimeoutし、最大3回で終了する", async () => {
      let attempts = 0;
      const client = createSearchConsoleClient({
        serviceAccountJson: serviceAccountJson(),
        requestTimeoutMs: 10,
        retryDelay: async () => undefined,
        fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
          if (String(input).startsWith("https://oauth2.googleapis.com/token")) {
            return Response.json({ access_token: ACCESS_TOKEN });
          }
          attempts += 1;
          return new Response(new ReadableStream({
            start(controller) {
              init?.signal?.addEventListener("abort", () => controller.error(new DOMException("timed out", "AbortError")));
            },
          }), { status: 200, headers: { "content-type": "application/json" } });
        }) as typeof fetch,
      });

      const result = await client.fetchRows({ siteUrl: SITE_URL, startDate: START, endDate: END });

      expect(result).toMatchObject({ ok: false, error: { code: "UPSTREAM_UNAVAILABLE" } });
      expect(attempts).toBe(3);
    });
  });
});
