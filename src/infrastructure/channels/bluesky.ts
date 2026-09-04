import type {
  ChannelConnectorPort,
  ChannelPublishInput,
  PortResult,
  SecretResolverPort,
} from "@/application/ports";
import {
  type DomainError,
  type Result,
  domainError,
  err,
  ok,
  validationError,
} from "@/domain/shared";

const DEFAULT_SERVICE = "https://bsky.social";
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const POST_COLLECTION = "app.bsky.feed.post";
const TID_ALPHABET = "234567abcdefghijklmnopqrstuvwxyz";
const TID_PATTERN = /^[234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12}$/;

type BlueskyCredentials = {
  readonly identifier: string;
  readonly appPassword: string;
  readonly service: string;
};

export type BlueskyConnectorContext = {
  readonly credentialRef: string | null;
  /** 登録時に固定したDID。nullは登録前のidentity解決にだけ使う。 */
  readonly expectedProviderIdentity?: string | null;
  readonly secrets: SecretResolverPort;
  readonly fetch?: typeof globalThis.fetch;
  readonly now?: () => Date;
  /** 外部APIが応答しない場合もWorkerの実行時間を占有し続けない。 */
  readonly requestTimeoutMs?: number;
  /** テストでclock idを固定するための注入点。0以上1未満。 */
  readonly random?: () => number;
};

const DID_PATTERN = /^did:[a-z0-9]+:[A-Za-z0-9._:%-]+$/;

function providerIdentityMismatch() {
  return domainError("FORBIDDEN", "Bluesky の接続先が登録時と一致しません。", {
    suggestedAction: "この接続で使っていた認証情報へ戻すか、新しい接続として登録してください。",
  });
}

function missingProviderIdentity() {
  return domainError("CONFLICT", "Bluesky の接続先を安全に確認できません。", {
    suggestedAction: "接続を登録し直して、Bluesky のDIDを固定してください。",
  });
}

function credentialsError() {
  return domainError("NOT_FOUND", "Bluesky の認証情報がまだ登録されていません。", {
    suggestedAction: "Bluesky のハンドルとアプリパスワードを接続設定へ登録してください。",
  });
}

function parseCredentials(value: string) {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (
      typeof parsed.identifier !== "string" ||
      parsed.identifier.trim() === "" ||
      typeof parsed.appPassword !== "string" ||
      parsed.appPassword.trim() === ""
    ) {
      return err(credentialsError());
    }
    const serviceValue = typeof parsed.service === "string" ? parsed.service : DEFAULT_SERVICE;
    const service = new URL(serviceValue);
    if (service.protocol !== "https:" || service.username !== "" || service.password !== "") {
      return err(credentialsError());
    }
    return ok({
      identifier: parsed.identifier.trim(),
      appPassword: parsed.appPassword,
      service: service.origin,
    } satisfies BlueskyCredentials);
  } catch {
    return err(credentialsError());
  }
}

async function loadCredentials(context: BlueskyConnectorContext) {
  if (context.credentialRef === null) return err(credentialsError());
  const resolved = await context.secrets.resolve(context.credentialRef);
  // SecretResolverのdetailsには参照名が入ることがある。connector境界で安全な理由へ置換する。
  return resolved.ok ? parseCredentials(resolved.value) : err(credentialsError());
}

function providerFailure(status: number) {
  if (status === 429) {
    return domainError("RATE_LIMITED", "Bluesky の利用上限に達したため、投稿を待機します。", {
      retryable: true,
      suggestedAction: "時間を置いて自動再試行します。",
    });
  }
  if (status >= 500) {
    return domainError("UPSTREAM_UNAVAILABLE", "Bluesky へ一時的に接続できませんでした。", {
      retryable: true,
      suggestedAction: "時間を置いて自動再試行します。",
    });
  }
  if (status === 401 || status === 403) return credentialsError();
  return domainError("VALIDATION_FAILED", "Bluesky が投稿内容を受け付けませんでした。", {
    suggestedAction: "本文と接続設定を確認してください。",
  });
}

async function requestJson(
  fetcher: typeof globalThis.fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Result<Record<string, unknown>, DomainError>> {
  try {
    const response = await fetcher(url, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return err(providerFailure(response.status));
    const value = (await response.json()) as unknown;
    if (typeof value !== "object" || value === null) {
      return err(domainError("UPSTREAM_UNAVAILABLE", "Bluesky から正しい応答を受け取れませんでした。", { retryable: true }));
    }
    return ok(value as Record<string, unknown>);
  } catch {
    return err(
      domainError("UPSTREAM_UNAVAILABLE", "Bluesky へ一時的に接続できませんでした。", {
        retryable: true,
        suggestedAction: "時間を置いて自動再試行します。",
      }),
    );
  }
}

/**
 * AT Protocol TID（53bit microseconds + 10bit clock id）を作る。
 * 最初のclaimで一度だけ保存するため、retry時に時刻が変わってもrkeyは変わらない。
 */
function secureRandomUnit(): number {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return (value[0] ?? 0) / 0x1_0000_0000;
}

export function createBlueskyTidGenerator(random: () => number = secureRandomUnit) {
  const clockId = BigInt(Math.floor(Math.max(0, Math.min(0.999999999, random())) * 1024));
  let lastMicros = BigInt(-1);
  return (at: Date): string => {
    const wallMicros = BigInt(at.getTime()) * BigInt(1_000);
    const micros = wallMicros > lastMicros ? wallMicros : lastMicros + BigInt(1);
    if (micros < BigInt(0) || micros >= BigInt(2) ** BigInt(53)) {
      throw new Error("TID timestamp is outside the AT Protocol range");
    }
    lastMicros = micros;
    let value = (micros << BigInt(10)) | clockId;
    let encoded = "";
    for (let index = 0; index < 13; index += 1) {
      encoded = TID_ALPHABET[Number(value & BigInt(31))] + encoded;
      value >>= BigInt(5);
    }
    if (!TID_PATTERN.test(encoded)) throw new Error("Generated invalid AT Protocol TID");
    return encoded;
  };
}

function postText(input: ChannelPublishInput): string {
  const disclosure = input.disclosureText.trim();
  const body = input.body.trim();
  return disclosure !== "" && body.startsWith(disclosure)
    ? body
    : [disclosure, body].filter(Boolean).join("\n");
}

export function createBlueskyConnector(context: BlueskyConnectorContext): ChannelConnectorPort {
  const fetcher = context.fetch ?? globalThis.fetch;
  const now = context.now ?? (() => new Date());
  const requestTimeoutMs = context.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const nextTid = createBlueskyTidGenerator(context.random);

  const request = (url: string, init: RequestInit) =>
    requestJson(fetcher, url, init, requestTimeoutMs);

  async function session(credentials: BlueskyCredentials) {
    const response = await request(
      `${credentials.service}/xrpc/com.atproto.server.createSession`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          identifier: credentials.identifier,
          password: credentials.appPassword,
        }),
      },
    );
    if (!response.ok) return response;
    const accessJwt = response.value.accessJwt;
    const did = response.value.did;
    const handle = response.value.handle;
    if (
      typeof accessJwt !== "string" ||
      typeof did !== "string" ||
      !DID_PATTERN.test(did) ||
      typeof handle !== "string" ||
      handle.trim() === ""
    ) {
      return err(domainError("UPSTREAM_UNAVAILABLE", "Bluesky から正しい認証応答を受け取れませんでした。", { retryable: true }));
    }
    return ok({ accessJwt, did, handle: handle.trim().replace(/^@/, "") });
  }

  async function authenticateIdentity() {
    const loaded = await loadCredentials(context);
    if (!loaded.ok) return loaded;
    const authenticated = await session(loaded.value);
    if (!authenticated.ok) return authenticated;
    const expected = context.expectedProviderIdentity ?? null;
    if (expected !== null && authenticated.value.did !== expected) {
      return err(providerIdentityMismatch());
    }
    return ok({ credentials: loaded.value, authenticated: authenticated.value });
  }

  // 1回のWorker実行ではregistryが接続ごとにconnector instanceを1つだけ作る。
  // readinessと直後のpublish/unpublishは同じ認証Promiseを共有し、providerへの
  // session要求を重ねない。次instance（次cron）はこのclosureを共有せず再認証する。
  let authenticatedIdentityPromise: ReturnType<typeof authenticateIdentity> | null = null;
  function authenticatedIdentity() {
    authenticatedIdentityPromise ??= authenticateIdentity();
    return authenticatedIdentityPromise;
  }

  async function boundIdentity() {
    const identity = await authenticatedIdentity();
    if (!identity.ok) return identity;
    if ((context.expectedProviderIdentity ?? null) === null) return err(missingProviderIdentity());
    return identity;
  }

  return {
    kind: "bluesky",

    async resolveIdentity() {
      const identity = await authenticatedIdentity();
      if (!identity.ok) return identity;
      return ok({
        providerIdentity: identity.value.authenticated.did,
        accountLabel: `@${identity.value.authenticated.handle}`,
      });
    },

    async checkReadiness(): PortResult<true> {
      const identity = await boundIdentity();
      return identity.ok ? ok(true) : identity;
    },

    async prepareDeliveryKey(input, at): PortResult<string> {
      try {
        return ok(nextTid(at));
      } catch {
        return err(validationError("Bluesky の配信識別子を作れませんでした。", "scheduledAt"));
      }
    },

    async validate(input): PortResult<readonly string[]> {
      const problems: string[] = [];
      const text = postText(input);
      const graphemes = [...new Intl.Segmenter("ja", { granularity: "grapheme" }).segment(text)].length;
      const bytes = new TextEncoder().encode(text).byteLength;
      if (graphemes > 300) problems.push(`本文と広告表記の合計が Bluesky の上限 300 文字を ${graphemes - 300} 文字超えています。`);
      if (bytes > 3_000) problems.push(`本文と広告表記の合計が Bluesky の上限 3000 bytes を ${bytes - 3_000} bytes 超えています。`);
      if (input.imageKeys.length > 0) problems.push("Bluesky への画像添付は、現在の直接投稿では利用できません。");
      if (input.providerDeliveryKey !== null && !TID_PATTERN.test(input.providerDeliveryKey)) {
        problems.push("Bluesky の配信識別子が正しくありません。");
      }
      return ok(problems);
    },

    async publish(input) {
      if (input.providerDeliveryKey === null || !TID_PATTERN.test(input.providerDeliveryKey)) {
        return err(validationError("Bluesky の配信識別子が確定していません。", "providerDeliveryKey"));
      }
      if (
        input.providerRecordCreatedAt === null ||
        Number.isNaN(input.providerRecordCreatedAt.getTime())
      ) {
        return err(
          validationError(
            "Bluesky の投稿時刻が確定していません。",
            "providerRecordCreatedAt",
          ),
        );
      }
      const identity = await boundIdentity();
      if (!identity.ok) return identity;
      const { authenticated, credentials } = identity.value;
      /*
       * createRecordでなくputRecordを使う。claimで保存した同じTID rkeyへupsertすることで、
       * response喪失後のretryが別投稿を増やさない（D1 CASに加えるprovider側の冪等境界）。
       */
      const response = await request(
        `${credentials.service}/xrpc/com.atproto.repo.putRecord`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${authenticated.accessJwt}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            repo: authenticated.did,
            collection: POST_COLLECTION,
            rkey: input.providerDeliveryKey,
            record: {
              $type: POST_COLLECTION,
              text: postText(input),
              // 即時配信も初回claimで保存した同じ時刻を使い、retryでrecordを変えない。
              createdAt: input.providerRecordCreatedAt.toISOString(),
            },
          }),
        },
      );
      if (!response.ok) return response;
      const uri = response.value.uri;
      const expectedUri = `at://${authenticated.did}/${POST_COLLECTION}/${input.providerDeliveryKey}`;
      if (uri !== expectedUri) {
        return err(domainError("UPSTREAM_UNAVAILABLE", "Bluesky から投稿IDを受け取れませんでした。", { retryable: true }));
      }
      return ok({
        externalId: uri,
        externalUrl: `https://bsky.app/profile/${encodeURIComponent(authenticated.did)}/post/${encodeURIComponent(input.providerDeliveryKey)}`,
        publishedAt: now(),
      });
    },

    async unpublish(externalId) {
      const match = /^at:\/\/([^/]+)\/app\.bsky\.feed\.post\/([^/]+)$/.exec(externalId);
      if (match === null) return err(validationError("Bluesky の投稿IDが正しくありません。", "externalId"));
      const identity = await boundIdentity();
      if (!identity.ok) return identity;
      const { authenticated, credentials } = identity.value;
      if (match[1] !== authenticated.did || !TID_PATTERN.test(match[2] ?? "")) {
        return err(
          domainError("FORBIDDEN", "この接続とは別のBluesky投稿は取り下げられません。", {
            suggestedAction: "この接続で投稿した配信を選び直してください。",
          }),
        );
      }
      const response = await request(
        `${credentials.service}/xrpc/com.atproto.repo.deleteRecord`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${authenticated.accessJwt}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            repo: authenticated.did,
            collection: POST_COLLECTION,
            rkey: match[2],
          }),
        },
      );
      return response.ok ? ok(true) : response;
    },
  };
}
