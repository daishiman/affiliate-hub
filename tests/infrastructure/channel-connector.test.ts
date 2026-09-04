/** @tier 1 @req REQ-P08 */
import { describe, expect, it } from "vitest";
import {
  availableChannels,
  createChannelConnector,
  createChannelExporter,
} from "@/infrastructure/channels/channel-registry";
import { fakeSecretResolver } from "@/infrastructure/platform/secret-resolver";
import type { ChannelPublishInput } from "@/application/ports";
import type { ChannelConnectionId } from "@/domain/shared";

const ctx = { credentialRef: null, secrets: fakeSecretResolver({}) };

function input(overrides: Partial<ChannelPublishInput> = {}): ChannelPublishInput {
  return {
    connectionId: "conn_1" as ChannelConnectionId,
    idempotencyKey: "key_1",
    providerDeliveryKey: null,
    title: "静かなノートPCの選び方",
    body: "本文です。",
    imageKeys: [],
    scheduledAt: null,
    providerRecordCreatedAt: null,
    disclosureText: "この記事には広告が含まれます。",
    ...overrides,
  };
}

describe("配信チャネル", () => {
  it("note へは直接投稿するコネクタを作れない", () => {
    const result = createChannelConnector("note", ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_SUPPORTED");
      expect(result.error.suggestedAction).toContain("書き出");
    }
  });

  it("選択肢の一覧で note は直接公開できないと示される", () => {
    const note = availableChannels().find((c) => c.kind === "note");
    expect(note?.directPublish).toBe(false);
  });

  it("送信が未実装でも、上限超過は今すぐ伝えられる", async () => {
    const result = createChannelConnector("x", ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const validated = await result.value.validate(input({ body: "あ".repeat(1000) }));
    expect(validated.ok).toBe(true);
    if (validated.ok) {
      expect(validated.value.join()).toContain("上限");
    }
  });

  it("送信そのものはスタブなので、成功を装わない", async () => {
    const result = createChannelConnector("x", ctx);
    if (!result.ok) throw new Error("コネクタを作れませんでした");

    const published = await result.value.publish(input());
    expect(published.ok).toBe(false);
    if (!published.ok) expect(published.error.code).toBe("NOT_IMPLEMENTED");
  });

  it("note の書き出しは広告表記を先頭に置き、消さないよう伝える", async () => {
    // 出し先の種類は書き出すときに渡す（窓口は 1 つ）。
    // 文面そのものの検査は tests/infrastructure/manual-export.test.ts にある。
    const draft = await createChannelExporter().buildDraft("note", input());
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;

    expect(draft.value.markdown).toContain("この記事には広告が含まれます。");
    expect(draft.value.instructions).toContain("消さないでください");
    expect(draft.value.instructions).not.toContain("直接公開");
  });
});
