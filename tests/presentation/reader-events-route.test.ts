/**
 * @tier 1
 * @req REQ-BOPC02
 * @req feat-reader-behavior-analytics
 * @types boundary, tenant-isolation
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const stubs = vi.hoisted(() => ({
  execute: vi.fn(),
  intakeEntry: vi.fn(),
  strictActor: vi.fn(),
  fallbackActor: vi.fn(),
}));

vi.mock("@/presentation/composition", () => ({
  readerActorForKnownSite: stubs.strictActor,
  readerActorForSite: stubs.fallbackActor,
  readerInteractionIntakeEntry: stubs.intakeEntry,
}));
vi.mock("@/presentation/telemetry/consent-server", () => ({
  readConsentSignals: async () => ({ choice: "granted" }),
}));

const { POST } = await import("@/app/api/reader-events/route");

const ACTOR = {
  workspaceId: "ws_owner",
  userId: "anonymous",
  roles: [],
  scopedBrandIds: [],
  isAiServiceAccount: false,
  identified: false,
};

function request(siteSlug: unknown): Request {
  return new Request("https://hub.test/api/reader-events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ siteSlug, events: [{ eventId: "evt-1" }] }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  stubs.strictActor.mockResolvedValue(ACTOR);
  stubs.fallbackActor.mockResolvedValue({ ...ACTOR, workspaceId: "ws_public" });
  stubs.intakeEntry.mockResolvedValue({ execute: stubs.execute });
  stubs.execute.mockResolvedValue({ ok: true, value: { accepted: 1 } });
});

describe("POST /api/reader-events のブログ境界", () => {
  it("未知のブログは204で何も保存しない", async () => {
    stubs.strictActor.mockResolvedValue(null);

    const response = await POST(request("unknown-blog"));

    expect(response.status).toBe(204);
    expect(stubs.strictActor).toHaveBeenCalledWith("unknown-blog");
    expect(stubs.intakeEntry).not.toHaveBeenCalled();
    expect(stubs.execute).not.toHaveBeenCalled();
    expect(stubs.fallbackActor).not.toHaveBeenCalled();
  });

  it.each(["", "   ", null])("空のブログ名 %j はresolverも保存先も呼ばない", async (siteSlug) => {
    const response = await POST(request(siteSlug));

    expect(response.status).toBe(204);
    expect(stubs.strictActor).not.toHaveBeenCalled();
    expect(stubs.intakeEntry).not.toHaveBeenCalled();
    expect(stubs.execute).not.toHaveBeenCalled();
  });

  it("既知のブログはstrict resolverの作業場所でだけ保存する", async () => {
    const response = await POST(request("known-blog"));

    expect(response.status).toBe(204);
    expect(stubs.strictActor).toHaveBeenCalledWith("known-blog");
    expect(stubs.execute).toHaveBeenCalledWith(
      ACTOR,
      expect.objectContaining({ siteSlug: "known-blog" }),
    );
    expect(stubs.fallbackActor).not.toHaveBeenCalled();
  });
});
