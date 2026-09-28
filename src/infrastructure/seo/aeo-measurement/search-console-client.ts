import type {
  SearchConsoleClientPort,
  SearchConsoleQueryRow,
  SearchConsoleRow,
} from "@/application/ports/seo-measurement";
import { domainError } from "@/domain/shared/errors";
import { err, ok } from "@/domain/shared/result";

/**
 * 系統②: Google Search Console から実績を取る。
 *
 * ==========================================================================
 * 鍵はこのファイルの外へ出ない
 * ==========================================================================
 *
 * サービスアカウントの秘密鍵は `env` から読み、この中だけで使う。
 * 引数で受け取らないのは、引数にすると呼び出し側の変数に載り、
 * 失敗時の `details` や監査記録へ写る道ができるためである。
 * **外へ出るのは「登録されているか」（`configured()`）の真偽値だけ。**
 *
 * 失敗の `details` にも鍵を入れない。Google の応答本文には
 * 鍵そのものは入らないが、`error_description` に鍵の形式について
 * 触れる文が入ることがあるので、状態コードだけを残す。
 *
 * ==========================================================================
 * なぜ自分で JWT を組み立てるのか
 * ==========================================================================
 *
 * Google のクライアントライブラリは Node の crypto に依存していて、
 * Workers では動かない。やることは 3 つしかない ——
 * ヘッダと本文を base64url で繋いで、秘密鍵で RS256 の署名を付け、
 * トークン発行口と交換する。`crypto.subtle` にどれもある。
 */

/** 読み取りだけ。書き込みの権限を要求しない。 */
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const QUERY_ENDPOINT = "https://searchconsole.googleapis.com/webmasters/v3/sites";

/**
 * Google の 1 request 上限と、1 日・検索種別・property の公開上限。
 * `startRow` をこの単位で進め、最大 2 page で必ず止まる。
 */
const ROW_LIMIT = 25_000;
const MAX_PUBLISHED_ROWS = 50_000;
const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * 発行したトークンの寿命。1 時間が上限と決まっている。
 *
 * 端に寄せず 55 分で切っているのは、発行から使用までの間に
 * 時刻のずれで期限切れになるのを避けるためである。
 */
const TOKEN_TTL_SECONDS = 55 * 60;
/** 同一 Worker instance 内だけで再利用し、claims の期限より5分早く捨てる。 */
const TOKEN_CACHE_SECONDS = 50 * 60;

type ServiceAccount = {
  readonly client_email: string;
  readonly private_key: string;
};

export type SearchConsoleClientDeps = {
  /**
   * サービスアカウントの JSON（秘密鍵を含む）。
   * `env` から読んだ値をそのまま渡す。**保存も出力もしない。**
   */
  readonly serviceAccountJson: string | undefined;
  readonly fetch?: typeof fetch;
  /** テストで待機を進めるためのみ差し替える。 */
  readonly retryDelay?: (milliseconds: number) => Promise<void>;
  readonly requestTimeoutMs?: number;
};

export function createSearchConsoleClient(
  deps: SearchConsoleClientDeps,
): SearchConsoleClientPort {
  const doFetch = deps.fetch ?? fetch;
  const retryDelay = deps.retryDelay ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const timeoutMs = deps.requestTimeoutMs ?? REQUEST_TIMEOUT_MS;
  const account = parseServiceAccount(deps.serviceAccountJson);
  let cachedToken: { readonly value: string; readonly expiresAt: number } | null = null;
  let tokenPromise: Promise<string> | null = null;

  async function accessToken(): Promise<string> {
    const now = Date.now();
    if (cachedToken !== null && cachedToken.expiresAt > now) return cachedToken.value;
    if (tokenPromise !== null) return tokenPromise;
    tokenPromise = issueAccessToken(account!, doFetch, retryDelay, timeoutMs)
      .then((value) => {
        cachedToken = { value, expiresAt: Date.now() + TOKEN_CACHE_SECONDS * 1_000 };
        return value;
      })
      .finally(() => { tokenPromise = null; });
    return tokenPromise;
  }

  return {
    configured() {
      return account !== null;
    },

    async fetchRows(input) {
      if (account === null) {
        return err(
          domainError("VALIDATION_FAILED", "Search Console の資格情報が登録されていません。", {
            retryable: false,
            suggestedAction: "Cloudflare の画面でサービスアカウントの JSON を登録してください。",
          }),
        );
      }

      let token: string;
      try {
        token = await accessToken();
      } catch (cause) {
        return err(
          domainError("UPSTREAM_UNAVAILABLE", "Search Console の認可に失敗しました。", {
            retryable: true,
            suggestedAction: "サービスアカウントがこのプロパティに追加されているか確認してください。",
            details: { reason: cause instanceof Error ? cause.name : "unknown" },
          }),
        );
      }

      try {
        const rows: SearchConsoleRow[] = [];
        const dates = inclusiveDates(input.startDate, input.endDate);
        if (dates === null) return err(domainError("VALIDATION_FAILED", "Search Console の日付範囲を確認できません。"));
        let mayBeLimited = false;
        for (const metricDate of dates) {
          const fullPageSignatures = new Set<string>();
          for (let startRow = 0; startRow < MAX_PUBLISHED_ROWS; startRow += ROW_LIMIT) {
            const page = await query({
              doFetch, retryDelay, timeoutMs, token, siteUrl: input.siteUrl,
              startDate: metricDate, endDate: metricDate,
              dimensions: ["date", "page"], startRow, rowLimit: ROW_LIMIT,
            });
            if (!page.ok) return page;
            const signature = pagePrefixSignature(page.rows);
            if (page.rows.length === ROW_LIMIT && signature !== null && fullPageSignatures.has(signature)) {
              return err(domainError("UPSTREAM_UNAVAILABLE", "Search Console が同じページを繰り返したため取得を中止しました。", {
                retryable: true,
              }));
            }
            rows.push(...page.rows.flatMap(toRow));
            if (page.rows.length < ROW_LIMIT) break;
            if (signature !== null) fullPageSignatures.add(signature);
            if (startRow + ROW_LIMIT >= MAX_PUBLISHED_ROWS) mayBeLimited = true;
          }
        }
        return ok({ rows, mayBeLimited });
      } catch (cause) {
        return err(
          domainError("UPSTREAM_UNAVAILABLE", "Search Console の実績を取得できませんでした。", {
            retryable: true,
            details: { reason: cause instanceof Error ? cause.name : "unknown" },
          }),
        );
      }
    },

    async fetchQueryRows(input) {
      if (account === null) {
        return err(domainError("VALIDATION_FAILED", "Search Console の資格情報が登録されていません。"));
      }
      if (!Number.isInteger(input.startRow) || input.startRow < 0 || input.startRow >= MAX_PUBLISHED_ROWS ||
          !Number.isInteger(input.rowBudget) || input.rowBudget < 0 || input.rowBudget > MAX_PUBLISHED_ROWS) {
        return err(domainError("VALIDATION_FAILED", "Search Console の取得範囲を確認できません。"));
      }
      if (input.rowBudget === 0) {
        return ok({ rows: [], rowsFetched: 0, startRow: input.startRow, nextStartRow: input.startRow, complete: false, mayBeLimited: false });
      }
      try {
        const token = await accessToken();
        const rows: SearchConsoleQueryRow[] = [];
        let rowsFetched = 0;
        let nextStartRow = input.startRow;
        let remaining = input.rowBudget;
        const fullPageSignatures = new Set<string>();
        while (remaining > 0 && nextStartRow < MAX_PUBLISHED_ROWS) {
          const rowLimit = Math.min(ROW_LIMIT, remaining, MAX_PUBLISHED_ROWS - nextStartRow);
          const page = await query({
            doFetch, retryDelay, timeoutMs, token, siteUrl: input.siteUrl,
            startDate: input.metricDate, endDate: input.metricDate,
            dimensions: ["date", "page", "query"], startRow: nextStartRow, rowLimit,
          });
          if (!page.ok) return page;
          const signature = pagePrefixSignature(page.rows);
          if (page.rows.length === rowLimit && signature !== null && fullPageSignatures.has(signature)) {
            return err(domainError("UPSTREAM_UNAVAILABLE", "Search Console が同じページを繰り返したため取得を中止しました。", {
              retryable: true,
            }));
          }
          rows.push(...page.rows.flatMap(toQueryRow));
          rowsFetched += page.rows.length;
          nextStartRow += page.rows.length;
          remaining -= page.rows.length;
          if (page.rows.length < rowLimit) {
            return ok({ rows, rowsFetched, startRow: input.startRow, nextStartRow, complete: true, mayBeLimited: false });
          }
          if (signature !== null) fullPageSignatures.add(signature);
        }
        const atPublishedLimit = nextStartRow >= MAX_PUBLISHED_ROWS;
        return ok({
          rows, rowsFetched, startRow: input.startRow, nextStartRow,
          complete: atPublishedLimit,
          mayBeLimited: atPublishedLimit,
        });
      } catch (cause) {
        return err(domainError("UPSTREAM_UNAVAILABLE", "Search Console の検索語内訳を取得できませんでした。", {
          retryable: true,
          details: { reason: cause instanceof Error ? cause.name : "unknown" },
        }));
      }
    },
  };
}

/**
 * 資格情報を読む。**読めなければ「無い」と同じ扱いにする。**
 *
 * 壊れた JSON を「登録されている」と見なすと、収集のたびに失敗が記録され、
 * 画面には赤い印が出続ける。まだ登録していない状態と区別できるほうが
 * 直しようがあるので、形にならない値は未登録へ倒す。
 */
function parseServiceAccount(raw: string | undefined): ServiceAccount | null {
  if (raw === undefined || raw.trim() === "") return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
    if (typeof parsed.client_email !== "string" || typeof parsed.private_key !== "string") {
      return null;
    }
    return { client_email: parsed.client_email, private_key: parsed.private_key };
  } catch {
    return null;
  }
}

/** 1 行を型へ。欠けている行は落とす（配列で返して flatMap で潰す）。 */
function toRow(raw: unknown): readonly SearchConsoleRow[] {
  if (typeof raw !== "object" || raw === null) return [];
  const row = raw as {
    keys?: readonly string[];
    impressions?: number;
    clicks?: number;
    position?: number;
  };
  const [metricDate, url] = row.keys ?? [];
  if (typeof metricDate !== "string" || typeof url !== "string") return [];
  return [
    {
      url,
      metricDate,
      impressions: row.impressions ?? 0,
      clicks: row.clicks ?? 0,
      position: row.position ?? 0,
    },
  ];
}

function toQueryRow(raw: unknown): readonly SearchConsoleQueryRow[] {
  if (typeof raw !== "object" || raw === null) return [];
  const row = raw as {
    keys?: readonly string[];
    impressions?: number;
    clicks?: number;
    position?: number;
  };
  const [metricDate, url, queryText] = row.keys ?? [];
  if (typeof metricDate !== "string" || typeof url !== "string" || typeof queryText !== "string") return [];
  return [{
    url,
    metricDate,
    query: queryText,
    impressions: row.impressions ?? 0,
    clicks: row.clicks ?? 0,
    position: row.position ?? 0,
  }];
}

function inclusiveDates(startDate: string, endDate: string): readonly string[] | null {
  const pattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!pattern.test(startDate) || !pattern.test(endDate)) return null;
  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  const end = Date.parse(`${endDate}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return null;
  const days = Math.floor((end - start) / 86_400_000) + 1;
  if (days > 31) return null;
  return Array.from({ length: days }, (_, index) =>
    new Date(start + index * 86_400_000).toISOString().slice(0, 10));
}

/** query 文字列をログや error へ出さず、同一 page の繰り返しだけを見抜く。 */
function pagePrefixSignature(rows: readonly unknown[]): string | null {
  if (rows.length === 0) return null;
  let hash = 2_166_136_261;
  // Prefix length is independent of rowLimit, so a server that ignores startRow is detected
  // even when the shared budget makes the second request 15k after a 25k first request.
  for (const row of rows.slice(0, 64)) {
    const keys = typeof row === "object" && row !== null
      ? (row as { keys?: readonly unknown[] }).keys
      : undefined;
    const value = Array.isArray(keys) ? JSON.stringify(keys) : "invalid";
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16_777_619);
    }
  }
  // query is used only in this one-way in-memory fingerprint and never returned or logged.
  return String(hash >>> 0);
}

type QueryInput = {
  readonly doFetch: typeof fetch;
  readonly retryDelay: (milliseconds: number) => Promise<void>;
  readonly timeoutMs: number;
  readonly token: string;
  readonly siteUrl: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly dimensions: readonly string[];
  readonly startRow: number;
  readonly rowLimit: number;
};

async function query(input: QueryInput): Promise<
  | { readonly ok: true; readonly rows: readonly unknown[] }
  | { readonly ok: false; readonly error: ReturnType<typeof domainError> }
> {
  const result = await fetchJsonWithRetry<{ rows?: readonly unknown[] }>(input.doFetch,
    `${QUERY_ENDPOINT}/${encodeURIComponent(input.siteUrl)}/searchAnalytics/query`, {
      method: "POST",
      headers: { authorization: `Bearer ${input.token}`, "content-type": "application/json" },
      body: JSON.stringify({
        startDate: input.startDate,
        endDate: input.endDate,
        dimensions: input.dimensions,
        startRow: input.startRow,
        rowLimit: input.rowLimit,
        type: "web",
      }),
    }, input.retryDelay, input.timeoutMs);
  if (!result.response.ok) {
    return { ok: false, error: domainError("UPSTREAM_UNAVAILABLE", `Search Console が ${result.response.status} を返しました。`, {
      retryable: result.response.status >= 500 || result.response.status === 429,
      suggestedAction: result.response.status === 403
        ? "サービスアカウントをプロパティの利用者へ追加してください。"
        : "時間をおいてもう一度お試しください。",
      details: { status: String(result.response.status) },
    }) };
  }
  return { ok: true, rows: result.body?.rows ?? [] };
}

/**
 * サービスアカウントの秘密鍵で署名した JWT を、アクセストークンと交換する。
 *
 * 交換したトークンは client instance のメモリ内だけで持ち、保存しない。
 * 保存すると、置き場所（KV・D1・変数）の分だけ漏れる面が増える。
 * collector は日別に複数回呼ぶため、50 分以内は同じ token/promise を再利用する。
 */
async function issueAccessToken(
  account: ServiceAccount,
  doFetch: typeof fetch,
  retryDelay: (milliseconds: number) => Promise<void>,
  timeoutMs: number,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: account.client_email,
    scope: SCOPE,
    aud: TOKEN_ENDPOINT,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  };

  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claims))}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(account.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const jwt = `${unsigned}.${base64UrlBytes(new Uint8Array(signature))}`;

  const result = await fetchJsonWithRetry<{ access_token?: string }>(doFetch, TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  }, retryDelay, timeoutMs);
  if (!result.response.ok) throw new Error(`token endpoint returned ${result.response.status}`);

  if (typeof result.body?.access_token !== "string") throw new Error("token endpoint returned no token");
  return result.body.access_token;
}

async function fetchJsonWithRetry<T>(
  doFetch: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit,
  retryDelay: (milliseconds: number) => Promise<void>,
  timeoutMs: number,
): Promise<{ readonly response: Response; readonly body: T | null }> {
  let lastCause: unknown = new Error("request failed");
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await doFetch(input, { ...init, signal: controller.signal });
      if (response.ok || (response.status !== 429 && response.status < 500) || attempt === MAX_ATTEMPTS - 1) {
        if (!response.ok) return { response, body: null };
        // Keep the same AbortController alive until the body is consumed. A response whose
        // headers arrive but body stalls must not pin the Worker beyond the request timeout.
        return { response, body: await response.json() as T };
      }
      lastCause = new Error(`upstream returned ${response.status}`);
    } catch (cause) {
      lastCause = cause;
      if (attempt === MAX_ATTEMPTS - 1) throw cause;
    } finally {
      clearTimeout(timer);
    }
    await retryDelay(100 * 2 ** attempt);
  }
  throw lastCause;
}

/** PEM（`-----BEGIN PRIVATE KEY-----` の形）から DER のバイト列を取り出す。 */
function pemToBytes(pem: string): ArrayBuffer {
  /*
    改行が `\n` の 2 文字として保存されていることがある。
    Cloudflare の画面へ JSON を貼ったときの経路によって変わるので、
    どちらでも通るようにしておく。ここで落ちると
    「鍵は登録したのに認可だけ失敗する」という分かりにくい壊れ方になる。
  */
  const body = pem
    .replace(/\\n/g, "\n")
    .replace(/-----[A-Z ]+-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function base64Url(text: string): string {
  return base64UrlBytes(new TextEncoder().encode(text));
}

function base64UrlBytes(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
