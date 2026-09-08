/**
 * @tier 1
 * @req REQ-BOPC02
 * @req feat-reader-behavior-analytics
 * @types boundary, tenant-isolation
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: {} }),
}));

const {
  readerActor,
  readerActorForKnownSite,
  readerActorForSite,
} = await import("@/presentation/composition");

describe("読者行動を保存する作業場所の解決", () => {
  it("既知のブログだけ、所有する作業場所の読者を返す", async () => {
    const actor = await readerActorForKnownSite("home-office-desk");

    expect(actor).not.toBeNull();
    expect(actor?.workspaceId).toBe("ws_sample");
    expect(actor?.userId).toBe("anonymous");
  });

  it.each([null, "", "   ", "unknown-blog"])(
    "存在を確かめられないブログ %j は null にして保存先を作らない",
    async (siteSlug) => {
      expect(await readerActorForKnownSite(siteSlug)).toBeNull();
    },
  );

  it("既存の互換resolverは、未知のブログだけ従来の公開読者へfallbackする", async () => {
    expect(await readerActorForSite("unknown-blog")).toEqual(readerActor());
  });
});
