/**
 * @tier 1
 * @req REQ-FB07, REQ-FB08
 * @types tenant-isolation, rate-limit, state-transition, secrets
 *
 * 取りに来るときの鍵の置き場（見本）。
 *
 * --- ここを検査する理由 ---
 *
 * 鍵の置き場は、間違えたときの代償が他と釣り合わない。
 * 一覧の並び順を間違えれば見づらいだけだが、**ここを間違えると
 * 他社が自分の鍵で他社のデータを取れる**。しかも取れてしまった側の
 * 画面には何も出ないので、気づくのは漏れた後になる。
 *
 * 見るのは 4 つ:
 *
 * 1. 平文が置き場に残らない（潰した値としか照合しない）。
 * 2. 他社の鍵は、発行も失効も利用の記録もできない。
 * 3. 回数の上限を**本当に数えている**（時刻を進めれば枠が戻る）。
 * 4. 見つからない鍵の照合が、存在の有無を漏らさない形で返る。
 */
import { beforeEach, describe, expect, it } from "vitest";
import { type IntegrationKey, markUsed } from "@/domain/feedback/integration-access";
import type { WorkspaceId } from "@/domain/shared";
import {
  clearIntegrationKeyStore,
  createSampleIntegrationKeyStore,
  seedIntegrationKey,
} from "@/infrastructure/persistence/sample/feedback-sample-repository";

const OWNER = "ws_sample" as WorkspaceId;
const OUTSIDER = "ws_other" as WorkspaceId;
const AT = new Date("2026-08-27T00:00:00.000Z");

/** 鍵の ID は素の文字列と取り違えないよう印が付いている。試験からは明示的に被せる。 */
type KeyId = IntegrationKey["id"];
const keyId = (value: string) => value as KeyId;

/**
 * 潰し方の中身は platform の担当。ここでは**平文が復元できない**ことだけが要る。
 * `` `sha256:${平文}` `` のような偽物にすると、平文が残っていないことを
 * 確かめる検査が、偽物のせいで必ず落ちる（あるいは必ず通る）。
 */
const HASHED: Record<string, string> = { plain_secret: "h_2f8c41" };
const hash = async (plainValue: string) => HASHED[plainValue] ?? `h_none_${plainValue.length}`;

function key(over: Omit<Partial<IntegrationKey>, "id"> & { id: string }): IntegrationKey {
  return {
    id: keyId(over.id),
    workspaceId: over.workspaceId ?? OWNER,
    label: over.label ?? "手元の取り込み",
    hashedValue: over.hashedValue ?? `h_${over.id}`,
    scopes: over.scopes ?? ["read"],
    createdBy: over.createdBy ?? "owner@local.test",
    createdAt: over.createdAt ?? AT,
    lastUsedAt: over.lastUsedAt ?? null,
    revokedAt: over.revokedAt ?? null,
    rateLimitPerMinute: over.rateLimitPerMinute ?? 3,
  };
}

beforeEach(() => {
  // 置き場はモジュールに 1 つ。前のテストの鍵が残ると、
  // 「他社の鍵が見える」不具合をこちらの検査が自分で作り出してしまう。
  clearIntegrationKeyStore();
});

describe("鍵の発行と一覧", () => {
  it("発行した鍵が、自分の一覧にだけ出る", async () => {
    const store = createSampleIntegrationKeyStore({ hash });
    expect((await store.issue(OWNER, key({ id: "ik_1" }))).ok).toBe(true);

    const mine = await store.list(OWNER);
    expect(mine.ok && mine.value.map((k) => String(k.id))).toEqual(["ik_1"]);

    const theirs = await store.list(OUTSIDER);
    expect(theirs.ok && theirs.value).toEqual([]);
  });

  it("他社の作業場所の鍵は発行できない", async () => {
    const store = createSampleIntegrationKeyStore({ hash });

    const issued = await store.issue(OWNER, key({ id: "ik_2", workspaceId: OUTSIDER }));

    // 入れ物の持ち主と鍵の持ち主が食い違ったら断る。通すと、
    // 発行者の権限で他社の一覧に鍵を仕込めることになる。
    expect(issued.ok).toBe(false);
  });
});

describe("鍵の照合", () => {
  it("平文ではなく、潰した値で照合する", async () => {
    const store = createSampleIntegrationKeyStore({ hash });
    await store.issue(OWNER, key({ id: "ik_3", hashedValue: await hash("plain_secret") }));

    const found = await store.authenticate("plain_secret");
    expect(found.ok && found.value?.id).toBe("ik_3");

    const listed = await store.list(OWNER);
    // **平文はどこにも残らない。**残っていれば、一覧を見られる人が
    // 全員その鍵を使えることになる。
    expect(JSON.stringify(listed.ok ? listed.value : [])).not.toContain("plain_secret");
  });

  it("知らない鍵は、断らずに『無い』と答える", async () => {
    const store = createSampleIntegrationKeyStore({ hash });

    const found = await store.authenticate("plain_unknown");

    // 断り方を変えると、返り方の違いから「その鍵は在る」と分かってしまう。
    // 在る場合と同じ形で `null` を返す。
    expect(found.ok && found.value).toBeNull();
  });
});

describe("鍵の失効", () => {
  it("失効させると、失効した時刻が入る", async () => {
    const store = createSampleIntegrationKeyStore({ hash });
    await store.issue(OWNER, key({ id: "ik_4" }));

    expect((await store.revoke(OWNER, keyId("ik_4"), AT)).ok).toBe(true);

    const listed = await store.list(OWNER);
    // 消さずに残す。消すと、失効させたこと自体が履歴から消える。
    expect(listed.ok && listed.value[0]?.revokedAt).toEqual(AT);
  });

  it("他社の鍵、知らない鍵は失効させられない", async () => {
    const store = createSampleIntegrationKeyStore({ hash });
    seedIntegrationKey(key({ id: "ik_5", workspaceId: OUTSIDER }));

    expect((await store.revoke(OWNER, keyId("ik_5"), AT)).ok).toBe(false);
    expect((await store.revoke(OWNER, keyId("ik_unknown"), AT)).ok).toBe(false);
  });
});

describe("回数の上限", () => {
  it("上限に達するまでは通し、達したら通さない", async () => {
    const store = createSampleIntegrationKeyStore({ hash });
    const target = key({ id: "ik_6", rateLimitPerMinute: 2 });
    await store.issue(OWNER, target);

    expect((await store.withinRateLimit(target.id, AT)).ok).toBe(true);
    await store.recordUsage(OWNER, { keyId: target.id, keyLabel: target.label, at: AT, fetchedCount: 1 });
    await store.recordUsage(OWNER, { keyId: target.id, keyLabel: target.label, at: AT, fetchedCount: 1 });

    const third = await store.withinRateLimit(target.id, AT);
    // 数えずに常に通すと、上限の設定が画面の飾りになる。
    expect(third.ok && third.value).toBe(false);
  });

  it("1 分が過ぎれば、枠は戻る", async () => {
    const store = createSampleIntegrationKeyStore({ hash });
    const target = key({ id: "ik_7", rateLimitPerMinute: 1 });
    await store.issue(OWNER, target);
    await store.recordUsage(OWNER, { keyId: target.id, keyLabel: target.label, at: AT, fetchedCount: 1 });

    const soon = await store.withinRateLimit(target.id, new Date(AT.getTime() + 30_000));
    expect(soon.ok && soon.value).toBe(false);

    const later = await store.withinRateLimit(target.id, new Date(AT.getTime() + 61_000));
    // 「1 分あたり」なので、古い記録は数から外れる。外さないと
    // 一度上限に触れた鍵が永久に使えなくなる。
    expect(later.ok && later.value).toBe(true);
  });

  it("知らない鍵は、上限の判定でも通さない", async () => {
    const store = createSampleIntegrationKeyStore({ hash });

    const allowed = await store.withinRateLimit(keyId("ik_unknown"), AT);

    // 置き場に無い鍵を通すと、失効直後の鍵が上限なしで使える窓ができる。
    expect(allowed.ok && allowed.value).toBe(false);
  });
});

describe("利用の記録", () => {
  it("使った時刻が鍵に残る", async () => {
    const store = createSampleIntegrationKeyStore({ hash });
    const target = key({ id: "ik_8" });
    await store.issue(OWNER, target);

    const usedAt = new Date(AT.getTime() + 5_000);
    expect((await store.recordUsage(OWNER, { keyId: target.id, keyLabel: target.label, at: usedAt, fetchedCount: 1 })).ok).toBe(true);

    const listed = await store.list(OWNER);
    expect(listed.ok && listed.value[0]?.lastUsedAt).toEqual(usedAt);
    // 記録の作り方は domain 側が正本。ここが独自に組み立てると、
    // 見本と本物で入る値がずれる。
    expect(listed.ok && listed.value[0]).toEqual(markUsed(target, usedAt));
  });

  it("他社の鍵、知らない鍵の利用は記録しない", async () => {
    const store = createSampleIntegrationKeyStore({ hash });
    seedIntegrationKey(key({ id: "ik_9", workspaceId: OUTSIDER }));

    const usage = { keyLabel: "手元の取り込み", at: AT, fetchedCount: 1 };
    const stolen = await store.recordUsage(OWNER, { ...usage, keyId: keyId("ik_9") });
    const unknown = await store.recordUsage(OWNER, { ...usage, keyId: keyId("ik_unknown") });

    expect(stolen.ok).toBe(false);
    expect(unknown.ok).toBe(false);
  });
});
