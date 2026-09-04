/** @tier 1 @req REQ-A06 */
import { describe, expect, it } from "vitest";
import type { ChannelPublishInput, SecretResolverPort } from "@/application/ports";
import type { ChannelConnectionId } from "@/domain/shared";
import {
  createBlueskyConnector,
  createBlueskyTidGenerator,
} from "@/infrastructure/channels/bluesky";
import { fakeSecretResolver } from "@/infrastructure/platform/secret-resolver";

const CREDENTIAL_REF = "channel/conn_bluesky/credentials";
const PROVIDER_IDENTITY = "did:plc:publisher";
const SCHEDULED_AT = new Date("2026-08-27T03:04:05.678Z");

function input(over: Partial<ChannelPublishInput> = {}): ChannelPublishInput {
  return {
    connectionId: "conn_bluesky" as ChannelConnectionId,
    idempotencyKey: "cv_approved:bluesky:2026-08-27T03:04:05.678Z",
    providerDeliveryKey: "3m4exampletid",
    title: null,
    body: "比較した結果、今回はこの製品を選びました。",
    imageKeys: [],
    scheduledAt: SCHEDULED_AT,
    providerRecordCreatedAt: SCHEDULED_AT,
    disclosureText: "広告",
    ...over,
  };
}

function credentialSecret(): SecretResolverPort {
  return fakeSecretResolver({
    [CREDENTIAL_REF]: JSON.stringify({ identifier: "publisher.example", appPassword: "test-app-password" }),
  });
}

describe("Bluesky direct connector", () => {
  it("同じmicrosecondで多数作っても、単調増加する正式TIDが衝突しない", () => {
    const nextTid = createBlueskyTidGenerator(() => 0.5);
    const ids = Array.from({ length: 2_048 }, () => nextTid(SCHEDULED_AT));
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(ids);
    expect(ids.every((id) => /^[234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12}$/.test(id))).toBe(true);
  });

  it("保存したdelivery keyは正式なTIDで、retryでも同じrecord keyを使う", async () => {
    const requests: { url: string; init: RequestInit }[] = [];
    const connector = createBlueskyConnector({
      credentialRef: CREDENTIAL_REF,
      expectedProviderIdentity: PROVIDER_IDENTITY,
      secrets: credentialSecret(),
      now: () => new Date("2026-08-27T03:04:06.000Z"),
      fetch: async (url, init) => {
        requests.push({ url: String(url), init: init ?? {} });
        if (String(url).endsWith("com.atproto.server.createSession")) {
          return Response.json({ accessJwt: "test-jwt", did: PROVIDER_IDENTITY, handle: "publisher.example" });
        }
        const body = JSON.parse(String(init?.body)) as { rkey: string };
        return Response.json({
          uri: `at://${PROVIDER_IDENTITY}/app.bsky.feed.post/${body.rkey}`,
          cid: "bafy-test",
        });
      },
    });

    const prepared = await connector.prepareDeliveryKey(input({ providerDeliveryKey: null }), SCHEDULED_AT);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    // https://atproto.com/specs/tid — 13桁・base32-sortable・先頭制約を満たす。
    expect(prepared.value).toMatch(/^[234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12}$/);

    const delivery = input({
      providerDeliveryKey: prepared.value,
      scheduledAt: null,
      providerRecordCreatedAt: SCHEDULED_AT,
    });
    const first = await connector.publish(delivery);
    const retry = await connector.publish(delivery);
    expect(first.ok).toBe(true);
    expect(retry.ok).toBe(true);

    const putBodies = requests
      .filter((request) => request.url.endsWith("com.atproto.repo.putRecord"))
      .map((request) => JSON.parse(String(request.init.body)) as { rkey: string; record: { text: string; createdAt: string } });
    expect(putBodies).toHaveLength(2);
    expect(putBodies[0]?.rkey).toBe(prepared.value);
    expect(putBodies[1]?.rkey).toBe(prepared.value);
    expect(putBodies[0]?.record.text).toBe("広告\n比較した結果、今回はこの製品を選びました。");
    expect(putBodies[0]?.record.createdAt).toBe(SCHEDULED_AT.toISOString());
    expect(putBodies[1]?.record.createdAt).toBe(SCHEDULED_AT.toISOString());
  });

  it("一時的なprovider失敗だけをretryableとして返し、応答本文や秘密を漏らさない", async () => {
    const secretMarker = "must-not-leak-app-password";
    const connector = createBlueskyConnector({
      credentialRef: CREDENTIAL_REF,
      expectedProviderIdentity: PROVIDER_IDENTITY,
      secrets: fakeSecretResolver({
        [CREDENTIAL_REF]: JSON.stringify({ identifier: "publisher.example", appPassword: secretMarker }),
      }),
      fetch: async (url) =>
        String(url).endsWith("createSession")
          ? Response.json({ accessJwt: "test-jwt", did: PROVIDER_IDENTITY, handle: "publisher.example" })
          : new Response(`provider-internal ${secretMarker}`, { status: 503 }),
      now: () => SCHEDULED_AT,
    });

    const result = await connector.publish(input());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.retryable).toBe(true);
    expect(JSON.stringify(result.error)).not.toContain(secretMarker);
    expect(JSON.stringify(result.error)).not.toContain("provider-internal");
  });

  it("すべてのprovider呼び出しへtimeoutを付ける", async () => {
    const signals: (AbortSignal | null | undefined)[] = [];
    const connector = createBlueskyConnector({
      credentialRef: CREDENTIAL_REF,
      expectedProviderIdentity: PROVIDER_IDENTITY,
      secrets: credentialSecret(),
      requestTimeoutMs: 250,
      fetch: async (url, init) => {
        signals.push(init?.signal);
        return String(url).endsWith("createSession")
          ? Response.json({ accessJwt: "test-jwt", did: PROVIDER_IDENTITY, handle: "publisher.example" })
          : Response.json({ uri: `at://${PROVIDER_IDENTITY}/app.bsky.feed.post/3m4exampletid` });
      },
      now: () => SCHEDULED_AT,
    });

    expect((await connector.publish(input())).ok).toBe(true);
    expect(signals).toHaveLength(2);
    expect(signals.every((signal) => signal instanceof AbortSignal)).toBe(true);
  });

  it("認証情報が未登録でも参照名・環境変数名・秘密を利用者向け理由へ出さない", async () => {
    const connector = createBlueskyConnector({
      credentialRef: CREDENTIAL_REF,
      secrets: fakeSecretResolver({}),
      fetch: async () => {
        throw new Error("network must not be called");
      },
      now: () => SCHEDULED_AT,
    });

    const ready = await connector.checkReadiness();
    expect(ready.ok).toBe(false);
    if (ready.ok) return;
    expect(ready.error.message).toContain("認証情報");
    expect(JSON.stringify(ready.error)).not.toContain(CREDENTIAL_REF);
    expect(JSON.stringify(ready.error)).not.toContain("SECRET_");
  });

  it("登録前の実認証はDIDとhandleだけを返し、JWTと秘密を境界外へ出さない", async () => {
    const connector = createBlueskyConnector({
      credentialRef: CREDENTIAL_REF,
      expectedProviderIdentity: null,
      secrets: credentialSecret(),
      fetch: async () =>
        Response.json({
          accessJwt: "must-not-cross-boundary-jwt",
          refreshJwt: "must-not-cross-boundary-refresh",
          did: PROVIDER_IDENTITY,
          handle: "publisher.example",
        }),
      now: () => SCHEDULED_AT,
    });

    const resolved = await connector.resolveIdentity();

    expect(resolved).toEqual({
      ok: true,
      value: { providerIdentity: PROVIDER_IDENTITY, accountLabel: "@publisher.example" },
    });
    expect(JSON.stringify(resolved)).not.toMatch(/jwt|password/i);
  });

  it("同じinstanceのreadinessからpublishまでは認証Promiseを共有し、秘密を結果へ出さない", async () => {
    const jwtMarker = "must-stay-inside-connector-jwt";
    const secretMarker = "must-stay-inside-connector-password";
    let sessionCalls = 0;
    let putCalls = 0;
    const newConnector = () =>
      createBlueskyConnector({
        credentialRef: CREDENTIAL_REF,
        expectedProviderIdentity: PROVIDER_IDENTITY,
        secrets: fakeSecretResolver({
          [CREDENTIAL_REF]: JSON.stringify({
            identifier: "publisher.example",
            appPassword: secretMarker,
          }),
        }),
        fetch: async (url) => {
          if (String(url).endsWith("createSession")) {
            sessionCalls += 1;
            return Response.json({
              accessJwt: jwtMarker,
              did: PROVIDER_IDENTITY,
              handle: "publisher.example",
            });
          }
          putCalls += 1;
          return Response.json({
            uri: `at://${PROVIDER_IDENTITY}/app.bsky.feed.post/3m4exampletid`,
          });
        },
        now: () => SCHEDULED_AT,
      });
    const connector = newConnector();

    const ready = await connector.checkReadiness();
    const published = await connector.publish(input());

    expect(ready.ok).toBe(true);
    expect(published.ok).toBe(true);
    expect(sessionCalls).toBe(1);
    expect(putCalls).toBe(1);
    expect(JSON.stringify({ ready, published })).not.toContain(jwtMarker);
    expect(JSON.stringify({ ready, published })).not.toContain(secretMarker);

    expect((await newConnector().checkReadiness()).ok).toBe(true);
    expect(sessionCalls).toBe(2);
  });

  it("保存したDIDと現在のsecretのDIDが違うとreadiness・publish・unpublishをすべて止める", async () => {
    let mutationCalls = 0;
    const connector = createBlueskyConnector({
      credentialRef: CREDENTIAL_REF,
      expectedProviderIdentity: PROVIDER_IDENTITY,
      secrets: credentialSecret(),
      fetch: async (url) => {
        if (String(url).endsWith("createSession")) {
          return Response.json({
            accessJwt: "test-jwt",
            did: "did:plc:substituted",
            handle: "substituted.example",
          });
        }
        mutationCalls += 1;
        return Response.json({});
      },
      now: () => SCHEDULED_AT,
    });

    const ready = await connector.checkReadiness();
    const published = await connector.publish(input());
    const unpublished = await connector.unpublish(
      `at://${PROVIDER_IDENTITY}/app.bsky.feed.post/3m4exampletid`,
    );

    expect(ready.ok).toBe(false);
    expect(published.ok).toBe(false);
    expect(unpublished.ok).toBe(false);
    expect(mutationCalls).toBe(0);
    for (const result of [ready, published, unpublished]) {
      if (!result.ok) {
        expect(result.error.code).toBe("FORBIDDEN");
        expect(JSON.stringify(result.error)).not.toContain("did:plc:substituted");
      }
    }
  });

  it.each([
    `at://${PROVIDER_IDENTITY}/app.bsky.feed.like/3m4exampletid`,
    `at://${PROVIDER_IDENTITY}/app.bsky.feed.post/3m4differentid`,
    "at://did:plc:other/app.bsky.feed.post/3m4exampletid",
  ])("putRecord応答URIが期待値と完全一致しなければ成功にしない: %s", async (uri) => {
    const connector = createBlueskyConnector({
      credentialRef: CREDENTIAL_REF,
      expectedProviderIdentity: PROVIDER_IDENTITY,
      secrets: credentialSecret(),
      fetch: async (url) =>
        String(url).endsWith("createSession")
          ? Response.json({
              accessJwt: "test-jwt",
              did: PROVIDER_IDENTITY,
              handle: "publisher.example",
            })
          : Response.json({ uri }),
      now: () => SCHEDULED_AT,
    });

    const result = await connector.publish(input());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.retryable).toBe(true);
  });

  it("300 graphemesと3000 bytesを別々に検査する", async () => {
    const connector = createBlueskyConnector({
      credentialRef: CREDENTIAL_REF,
      expectedProviderIdentity: PROVIDER_IDENTITY,
      secrets: credentialSecret(),
      fetch: async () => Response.json({}),
      now: () => SCHEDULED_AT,
    });

    const combinedJapanese = await connector.validate(
      input({ disclosureText: "", body: "か\u3099".repeat(300) }),
    );
    expect(combinedJapanese.ok && combinedJapanese.value).toEqual([]);

    const overGraphemes = await connector.validate(
      input({ disclosureText: "", body: "あ".repeat(301) }),
    );
    expect(overGraphemes.ok && overGraphemes.value.join()).toContain("300 文字");

    // 家族emojiは1 graphemeに複数code pointを持つ。文字数内でもbyte上限は独立して効く。
    const overBytes = await connector.validate(
      input({ disclosureText: "", body: "👩‍👩‍👧‍👦".repeat(121) }),
    );
    expect(overBytes.ok && overBytes.value.join()).toContain("3000 bytes");
  });

  it("別DIDのAT URIを渡しても、自分の同じrkeyの投稿を誤削除しない", async () => {
    let deleteCalled = false;
    const connector = createBlueskyConnector({
      credentialRef: CREDENTIAL_REF,
      expectedProviderIdentity: "did:plc:mine",
      secrets: credentialSecret(),
      fetch: async (url) => {
        if (String(url).endsWith("createSession")) {
          return Response.json({ accessJwt: "test-jwt", did: "did:plc:mine", handle: "mine.example" });
        }
        deleteCalled = true;
        return Response.json({});
      },
      now: () => SCHEDULED_AT,
    });

    const result = await connector.unpublish(
      "at://did:plc:someone-else/app.bsky.feed.post/3m4exampletid",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
    expect(deleteCalled).toBe(false);
  });
});
