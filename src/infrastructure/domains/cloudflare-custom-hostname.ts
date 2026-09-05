import type {
  CustomHostnameProviderPort,
  CustomHostnameSnapshot,
  DomainVerificationInstruction,
  EditorialCustomHostnameProviderPort,
} from "@/application/ports";
import type { CertificateStatus, CustomDomainStatus } from "@/domain/domains";
import { domainError, err, markEditorial, ok } from "@/domain/shared";
import { tryGetWorkerEnv } from "@/infrastructure/platform/worker-env";

/**
 * Cloudflare for SaaS の custom hostname とのつなぎ目 (住所層)。
 *
 * ここが返すのは**向こうの言い分**で、こちらの意思ではない。保存はしない。
 * 保存すると、外部が落ちている間に写しが正本のように振る舞いはじめる。
 *
 * --- 鍵の扱い ---
 * API token は戻り値にもログにも入れない。IndexNow クライアントと同じく、
 * 例外メッセージも信用せず、外へ出す前に伏せ字へ置き換える。fetch の実装が
 * 要求ヘッダを理由文へ写す日が来ても、token が呼び出し元のログへ歩いて
 * いかないようにする。「たぶん入らない」を根拠に置く秘密は、入った日に
 * 誰も気づけない。
 */

const CF_API = "https://api.cloudflare.com/client/v4";
const TIMEOUT_MS = 10_000;

/**
 * Cloudflare の言葉をこちらの状態へ翻訳する。
 *
 * 語彙をそのまま持ち込まないのは、外部の状態名が増えたときに、
 * こちらの遷移表を書き換えずに済ませるためである。翻訳表がここ 1 つに
 * あれば、増えた語をどこへ倒すかの判断も 1 か所で済む。
 */
function toDomainStatus(hostnameStatus: string): CustomDomainStatus {
  switch (hostnameStatus) {
    case "active":
      return "active";
    case "pending":
      return "pending";
    case "active_redeploying":
    case "pending_deletion":
    case "blocked":
      // 配信できていないが失敗とも言い切れない。確認中へ倒す。
      return "verifying";
    case "moved":
    case "deleted":
      return "failed";
    default:
      return "verifying";
  }
}

function toCertificateStatus(sslStatus: string | undefined): CertificateStatus {
  switch (sslStatus) {
    case "active":
      return "issued";
    case "pending_validation":
    case "pending_issuance":
    case "pending_deployment":
    case "initializing":
      return "pending";
    case "expired":
      return "expired";
    case undefined:
      return "none";
    default:
      return "error";
  }
}

/**
 * 運用者が DNS に置く設定へ翻訳する。
 *
 * `why` を添えるのは、この画面を見る人が DNS の専門家とは限らないため。
 * レコードの値だけ並べても、どれを消してよいかが分からず、うっかり
 * 消したときに住所が落ちる。
 */
function toInstructions(payload: CloudflareHostname): readonly DomainVerificationInstruction[] {
  const out: DomainVerificationInstruction[] = [];
  const ownership = payload.ownership_verification;
  if (ownership !== undefined) {
    out.push({
      recordType: ownership.type.toUpperCase(),
      name: ownership.name,
      value: ownership.value,
      why: "このドメインを本当にあなたが持っていることを確かめるための印です。",
    });
  }
  const httpCheck = payload.ownership_verification_http;
  if (httpCheck !== undefined) {
    out.push({
      recordType: "HTTP",
      name: httpCheck.http_url,
      value: httpCheck.http_body,
      why: "DNS を触れないときの代わりの確認方法です。どちらか一方で足ります。",
    });
  }
  for (const record of payload.ssl?.validation_records ?? []) {
    if (record.txt_name === undefined || record.txt_value === undefined) continue;
    out.push({
      recordType: "TXT",
      name: record.txt_name,
      value: record.txt_value,
      why: "証明書を発行するために必要です。発行後も残しておいてください。",
    });
  }
  return out;
}

type CloudflareHostname = {
  readonly id: string;
  readonly hostname: string;
  readonly status: string;
  readonly verification_errors?: readonly string[];
  readonly ownership_verification?: {
    readonly type: string;
    readonly name: string;
    readonly value: string;
  };
  readonly ownership_verification_http?: {
    readonly http_url: string;
    readonly http_body: string;
  };
  readonly ssl?: {
    readonly status?: string;
    readonly validation_errors?: readonly { readonly message?: string }[];
    readonly validation_records?: readonly {
      readonly txt_name?: string;
      readonly txt_value?: string;
    }[];
  };
};

function toSnapshot(payload: CloudflareHostname): CustomHostnameSnapshot {
  const errors = [
    ...(payload.verification_errors ?? []),
    ...(payload.ssl?.validation_errors ?? []).flatMap((e) =>
      e.message === undefined ? [] : [e.message],
    ),
  ];
  return {
    externalHostnameId: payload.id,
    status: toDomainStatus(payload.status),
    certificateStatus: toCertificateStatus(payload.ssl?.status),
    // 複数の理由が来ることがある。先頭だけ残すと、後ろの理由が
    // 本当の原因だったときに運用者が永久に辿り着けない。
    lastError: errors.length === 0 ? null : errors.join(" / "),
    instructions: toInstructions(payload),
  };
}

/** 理由文から token を伏せる。文の残りは触らない (原因を辿れなくなるため)。 */
function redact(message: string, token: string): string {
  return token.length === 0 ? message : message.split(token).join("***");
}

type Credentials = { readonly token: string; readonly zoneId: string };

async function loadCredentials(): Promise<Credentials | null> {
  const env = await tryGetWorkerEnv();
  const token = env["CLOUDFLARE_API_TOKEN"];
  const zoneId = env["CLOUDFLARE_ZONE_ID"];
  if (typeof token !== "string" || token.trim() === "") return null;
  if (typeof zoneId !== "string" || zoneId.trim() === "") return null;
  return { token, zoneId };
}

function notConfigured() {
  return err(
    domainError("NOT_SUPPORTED", "独自ドメインの連携が設定されていません。", {
      suggestedAction:
        "CLOUDFLARE_API_TOKEN と CLOUDFLARE_ZONE_ID を実行環境へ登録してください。",
    }),
  );
}

export function createCloudflareCustomHostnameProvider(): EditorialCustomHostnameProviderPort {
  async function call(
    path: string,
    init: RequestInit,
    creds: Credentials,
  ): Promise<{ ok: true; result: CloudflareHostname } | { ok: false; message: string }> {
    const response = await fetch(`${CF_API}/zones/${creds.zoneId}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${creds.token}`,
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = (await response.json()) as {
      readonly success?: boolean;
      readonly result?: CloudflareHostname;
      readonly errors?: readonly { readonly message?: string }[];
    };
    if (response.ok && body.success === true && body.result !== undefined) {
      return { ok: true, result: body.result };
    }
    const message =
      (body.errors ?? []).flatMap((e) => (e.message === undefined ? [] : [e.message]))
        .join(" / ") || `Cloudflare が ${response.status} を返しました。`;
    return { ok: false, message };
  }

  const port: CustomHostnameProviderPort = {
    async request(hostname) {
      const creds = await loadCredentials();
      if (creds === null) return notConfigured();
      try {
        const res = await call(
          "/custom_hostnames",
          {
            method: "POST",
            body: JSON.stringify({
              hostname,
              // 証明書は Cloudflare に任せる。自前で持つと、更新の失敗が
              // そのまま読者側の接続エラーになる。
              ssl: { method: "txt", type: "dv", settings: { min_tls_version: "1.2" } },
            }),
          },
          creds,
        );
        if (!res.ok) {
          return err(
            domainError("UPSTREAM_UNAVAILABLE", redact(res.message, creds.token), {
              retryable: true,
              suggestedAction: "少し待ってからもう一度お試しください。",
            }),
          );
        }
        return ok(toSnapshot(res.result));
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        return err(
          domainError("UPSTREAM_UNAVAILABLE", "ドメインの登録を申し込めませんでした。", {
            retryable: true,
            details: { reason: redact(message, creds.token).slice(0, 200) },
          }),
        );
      }
    },

    async snapshot(externalHostnameId) {
      const creds = await loadCredentials();
      if (creds === null) return notConfigured();
      try {
        const res = await call(
          `/custom_hostnames/${encodeURIComponent(externalHostnameId)}`,
          { method: "GET" },
          creds,
        );
        if (!res.ok) {
          return err(
            domainError("UPSTREAM_UNAVAILABLE", redact(res.message, creds.token), {
              retryable: true,
            }),
          );
        }
        return ok(toSnapshot(res.result));
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        return err(
          domainError("UPSTREAM_UNAVAILABLE", "ドメインの状態を確認できませんでした。", {
            retryable: true,
            details: { reason: redact(message, creds.token).slice(0, 200) },
          }),
        );
      }
    },

    async release(externalHostnameId) {
      const creds = await loadCredentials();
      if (creds === null) return notConfigured();
      try {
        const response = await fetch(
          `${CF_API}/zones/${creds.zoneId}/custom_hostnames/${encodeURIComponent(externalHostnameId)}`,
          {
            method: "DELETE",
            headers: { authorization: `Bearer ${creds.token}` },
            signal: AbortSignal.timeout(TIMEOUT_MS),
          },
        );
        /*
         * 404 は成功として扱う。向こうに無いなら、取り消したいという
         * 目的は達している。失敗にすると、こちらの取り下げが外部の
         * 掃除済み状態に引っかかって永久に完了しなくなる。
         */
        if (!response.ok && response.status !== 404) {
          return err(
            domainError(
              "UPSTREAM_UNAVAILABLE",
              `Cloudflare が ${response.status} を返しました。`,
              { retryable: true },
            ),
          );
        }
        return ok(true as const);
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        return err(
          domainError("UPSTREAM_UNAVAILABLE", "外部側の登録を取り消せませんでした。", {
            retryable: true,
            details: { reason: redact(message, creds.token).slice(0, 200) },
          }),
        );
      }
    },
  };

  return markEditorial(port);
}
