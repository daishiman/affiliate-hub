/**
 * @tier 1
 * @req REQ-P08
 * @types equivalence, idempotency, state-transition
 *
 * 見本（メモリ）の配信保存先。
 *
 * --- なぜここを見るのか ---
 *
 * 見本は「D1 が無い環境で画面を触れるようにする」ためのものだが、
 * **画面から見た振る舞いは D1 版と同じでなければならない**。ここがずれると、
 * 手元では通った操作が本番で落ちる／その逆が起きる。
 *
 * 見るのは 3 つ。
 *
 * 1. **二重投入は増えない。**同じ冪等鍵で 2 回入れても行は 1 本で、
 *    2 回目は「作っていない」と答える。ここが緩むと、再送のたびに
 *    読者へ同じ投稿が届く。
 * 2. **入れ替えは「見ていた姿」と合ったときだけ通す。**取り合いに負けた側は
 *    null を受け取り、上書きしない。
 * 3. **断る道具は断ると言う。**保存できない口が黙って成功を返すと、
 *    運用者は「保存された」と受け取る。
 */
import { describe, expect, it } from "vitest";
import {
  createSampleChannelConnectionRepository,
  createSamplePublicationRepository,
  samplePublicationScopeReferences,
} from "@/infrastructure/persistence/sample/distribution-sample-repository";
import { SAMPLE_WORKSPACE_ID } from "@/infrastructure/persistence/sample/ranking-sample-repository";
import { asBrandId, asChannelConnectionId, asPublicationId } from "@/domain/shared";
import { aPublication } from "../support/factories";

const WS = SAMPLE_WORKSPACE_ID;

function publication(id: string, over: Record<string, unknown> = {}) {
  return aPublication({
    id: asPublicationId(id),
    workspaceId: WS,
    channelKind: "bluesky",
    connectionId: asChannelConnectionId("conn_bluesky"),
    state: "QUEUED",
    scheduledAt: null,
    publishedAt: null,
    ...over,
  });
}

describe("同じものを 2 回入れない", () => {
  it("同じ冪等鍵の 2 回目は、行を増やさず「作っていない」と答える", async () => {
    const repo = createSamplePublicationRepository();
    const first = publication("dup-1", { idempotencyKey: "key-dup" });

    const created = await repo.createIfAbsent(first);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.created).toBe(true);

    // id は違うが鍵は同じ。再送はこの形で来る。
    const again = await repo.createIfAbsent(publication("dup-2", { idempotencyKey: "key-dup" }));
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.value.created).toBe(false);
    // 先に入った行をそのまま返す。あとから来た方で上書きしない。
    expect(String(again.value.publication.id)).toBe("dup-1");
  });

  it("冪等鍵から先に入った行を引ける", async () => {
    const repo = createSamplePublicationRepository();
    await repo.createIfAbsent(publication("key-lookup", { idempotencyKey: "key-lookup" }));

    const found = await repo.findByIdempotencyKey(WS, "key-lookup");
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(String(found.value?.id)).toBe("key-lookup");

    const missing = await repo.findByIdempotencyKey(WS, "no-such-key");
    expect(missing.ok).toBe(true);
    if (!missing.ok) return;
    expect(missing.value).toBeNull();
  });

  it("id で引けるが、知らない id は null（例外にしない）", async () => {
    const repo = createSamplePublicationRepository();
    await repo.save(publication("by-id"));

    const found = await repo.findById(WS, asPublicationId("by-id"));
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.value).not.toBeNull();

    const missing = await repo.findById(WS, asPublicationId("no-such"));
    expect(missing.ok).toBe(true);
    if (!missing.ok) return;
    expect(missing.value).toBeNull();
  });
});

describe("入れ替えは、見ていた姿と合ったときだけ通す", () => {
  it("合っていれば入れ替わる", async () => {
    const repo = createSamplePublicationRepository();
    const before = publication("cas-ok");
    await repo.save(before);

    const swapped = await repo.compareAndSwap(before, { ...before, state: "SENDING" });
    expect(swapped.ok).toBe(true);
    if (!swapped.ok) return;
    expect(swapped.value?.state).toBe("SENDING");

    const reread = await repo.findById(WS, asPublicationId("cas-ok"));
    expect(reread.ok && reread.value?.state).toBe("SENDING");
  });

  it("見ていた姿が既に無ければ null を返し、何も書かない", async () => {
    const repo = createSamplePublicationRepository();
    const stale = publication("cas-stale", { state: "QUEUED" });
    await repo.save({ ...stale, state: "PUBLISHED" });

    // 取り合いに負けた側。ここで上書きすると、送信済みが未送信へ戻る。
    const swapped = await repo.compareAndSwap(stale, { ...stale, state: "SENDING" });
    expect(swapped.ok).toBe(true);
    if (!swapped.ok) return;
    expect(swapped.value).toBeNull();

    const reread = await repo.findById(WS, asPublicationId("cas-stale"));
    expect(reread.ok && reread.value?.state).toBe("PUBLISHED");
  });
});

describe("送信の取り合い（claimForDelivery）", () => {
  it("どの版を見て予約したか分からない行は取りに行かない", async () => {
    const repo = createSamplePublicationRepository();
    const before = publication("claim-norev", { variantRevision: null });
    await repo.save(before);

    const claimed = await repo.claimForDelivery(before, { ...before, state: "SENDING" });
    expect(claimed.ok).toBe(true);
    if (!claimed.ok) return;
    // 版が分からないまま送ると、書き換わったあとの本文を古い予約で配ることになる。
    expect(claimed.value).toBeNull();
  });

  it("本文の版がずれていたら取らない", async () => {
    const repo = createSamplePublicationRepository();
    const before = publication("claim-drift", { variantRevision: 999 });
    await repo.save(before);

    const claimed = await repo.claimForDelivery(before, { ...before, state: "SENDING" });
    expect(claimed.ok).toBe(true);
    if (!claimed.ok) return;
    expect(claimed.value).toBeNull();
  });
});

describe("ブランドで絞る（見本と D1 で同じ規則）", () => {
  it("絞りが無ければ、その workspace の束と本文が全部返る", () => {
    const refs = samplePublicationScopeReferences(WS, undefined);
    expect(refs.packageIds.length).toBeGreaterThan(0);
    expect(refs.variantIds.length).toBeGreaterThan(0);
  });

  it("知らないブランドで絞ると、束も本文も空になる（全件へ倒さない）", () => {
    const refs = samplePublicationScopeReferences(WS, { brandIds: [asBrandId("brand_nosuch")] });
    // ここで空にせず全件へ倒すと、見えてはいけない他ブランドの行が並ぶ。
    expect(refs.packageIds).toEqual([]);
    expect(refs.variantIds).toEqual([]);
  });

  it("絞りに合わない配信は、最近の一覧にも予定表にも出ない", async () => {
    const repo = createSamplePublicationRepository();
    await repo.save(publication("scoped-out", { scheduledAt: new Date("2026-09-10T00:00:00Z") }));
    const scope = { brandIds: [asBrandId("brand_nosuch")] };

    const recent = await repo.listRecent(WS, 100, scope);
    expect(recent.ok).toBe(true);
    if (!recent.ok) return;
    expect(recent.value).toEqual([]);

    const calendar = await repo.listForCalendar(
      WS,
      new Date("2026-09-01T00:00:00Z"),
      new Date("2026-10-01T00:00:00Z"),
      scope,
    );
    expect(calendar.ok).toBe(true);
    if (!calendar.ok) return;
    expect(calendar.value).toEqual([]);
  });

  it("本文ごとの一覧は、その本文の配信だけを返す", async () => {
    const repo = createSamplePublicationRepository();
    const target = publication("by-variant");
    await repo.save(target);

    const listed = await repo.listByVariant(WS, target.variantId);
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.every((p) => p.variantId === target.variantId)).toBe(true);
  });
});

describe("見本に最初から入っている行", () => {
  it("絞り無しの一覧には、見本の配信がそのまま並ぶ", async () => {
    const repo = createSamplePublicationRepository();
    const recent = await repo.listRecent(WS, 100, undefined);
    expect(recent.ok).toBe(true);
    if (!recent.ok) return;
    expect(recent.value.length).toBeGreaterThan(0);
  });

  it("見本のブランドで絞ると、束と本文が引ける", () => {
    const refs = samplePublicationScopeReferences(WS, { brandIds: [asBrandId("brand_sample")] });
    expect(refs.packageIds.length).toBeGreaterThan(0);
    expect(refs.variantIds.length).toBeGreaterThan(0);
  });

  it("本文の版が合っていれば、送信の権利を取れる", async () => {
    const repo = createSamplePublicationRepository();
    const recent = await repo.listRecent(WS, 100, undefined);
    expect(recent.ok).toBe(true);
    if (!recent.ok) return;
    // 見本の行は本文の版と揃っている。ここが取れないなら、揃え方が壊れている。
    const seeded = recent.value.find((p) => p.variantRevision !== null);
    expect(seeded).toBeDefined();
    if (seeded === undefined) return;

    const claimed = await repo.claimForDelivery(seeded, { ...seeded, state: "SENDING" });
    expect(claimed.ok).toBe(true);
    if (!claimed.ok) return;
    expect(claimed.value?.state).toBe("SENDING");
  });

  it("同じ id で 2 回保存しても行は増えず、あとの姿に入れ替わる", async () => {
    const repo = createSamplePublicationRepository();
    const row = publication("save-twice");
    await repo.save(row);
    await repo.save({ ...row, state: "PUBLISHED" });

    const listed = await repo.listByVariant(WS, row.variantId);
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    // 増えていたら、取りやめた行が一覧に二重で残る。
    expect(listed.value.filter((p) => String(p.id) === "save-twice")).toHaveLength(1);
    const reread = await repo.findById(WS, asPublicationId("save-twice"));
    expect(reread.ok && reread.value?.state).toBe("PUBLISHED");
  });
});

describe("見本の配信接続", () => {
  it("id で引けるが、知らない id は null", async () => {
    const repo = createSampleChannelConnectionRepository();
    const listed = await repo.listByWorkspace(WS, { limit: 1, cursor: null });
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;

    const found = await repo.findById(WS, listed.value.items[0].id);
    expect(found.ok && found.value).not.toBeNull();

    const missing = await repo.findById(WS, asChannelConnectionId("conn_nosuch"));
    expect(missing.ok).toBe(true);
    if (!missing.ok) return;
    expect(missing.value).toBeNull();
  });

  it("まだ作っていない口は、成功と言わずに断る", async () => {
    const repo = createSampleChannelConnectionRepository();
    const listed = await repo.listByWorkspace(WS, { limit: 1, cursor: null });
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    const sample = listed.value.items[0];

    // 「保存した」とだけ返して何も変えないのが最も悪い。断ると言う。
    for (const result of [
      await repo.createIfAbsent(sample),
      await repo.save(sample),
      await repo.acquireProviderDeliveryLease({
        kind: sample.kind,
        providerIdentity: "provider-sample",
        holderPublicationId: asPublicationId("lease-holder"),
        at: new Date("2026-09-09T00:00:00Z"),
        expiresAt: new Date("2026-09-09T00:05:00Z"),
      }),
      await repo.releaseProviderDeliveryLease({
        kind: sample.kind,
        providerIdentity: "provider-sample",
        holderPublicationId: asPublicationId("lease-holder"),
        leaseToken: "token-sample",
      }),
    ]) {
      expect(result.ok).toBe(false);
    }
  });
});
