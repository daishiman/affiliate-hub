/** @tier 1 @req REQ-P08 @types boundary, pagination */
import { describe, expect, it } from "vitest";
import {
  createSampleChannelConnectionRepository,
  createSamplePublicationRepository,
} from "@/infrastructure/persistence/sample/distribution-sample-repository";
import { SAMPLE_WORKSPACE_ID } from "@/infrastructure/persistence/sample/ranking-sample-repository";
import { aPublication } from "../support/factories";

describe("見本の配信接続ページング", () => {
  it("cursorをたどると、決定的な順序で全接続を重複なく読める", async () => {
    const repository = createSampleChannelConnectionRepository();
    const ids: string[] = [];
    let cursor: string | null = null;

    do {
      const page = await repository.listByWorkspace(SAMPLE_WORKSPACE_ID, { limit: 1, cursor });
      expect(page.ok).toBe(true);
      if (!page.ok) return;
      ids.push(...page.value.items.map((connection) => String(connection.id)));
      cursor = page.value.nextCursor;
    } while (cursor !== null);

    expect(ids.length).toBeGreaterThan(1);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([...ids].sort());
  });
});

describe("見本の即時配信", () => {
  it("scheduledAtがnullの外部配信をdueとして返す", async () => {
    const repository = createSamplePublicationRepository();
    const immediate = aPublication({
      id: "sample-immediate-due" as never,
      workspaceId: SAMPLE_WORKSPACE_ID,
      channelKind: "bluesky",
      connectionId: "conn_bluesky" as never,
      state: "QUEUED",
      scheduledAt: null,
      publishedAt: null,
    });
    await repository.save(immediate);

    const due = await repository.listDue(new Date("2026-08-27T00:00:00Z"), 100);

    expect(due.ok).toBe(true);
    if (!due.ok) return;
    expect(due.value.map((publication) => publication.id)).toContain(immediate.id);
  });
});
