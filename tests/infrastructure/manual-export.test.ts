/**
 * @tier 1
 * @req REQ-P08
 * @types equivalence, boundary, adversarial
 *
 * 貼り付け用の書き出し。
 *
 * 自動で投稿できない先では、これが**唯一の出し道**になる。
 * 手順の番号が飛ぶ・出し先の名前が違う・広告表記が落ちる、のどれが起きても
 * 貼り付ける人は自分で気づけない（比べる相手が無い）ので、ここで固定する。
 */
import { describe, expect, it } from "vitest";
import type { ChannelPublishInput } from "@/application/ports";
import { CHANNEL_CAPABILITIES } from "@/domain/distribution";
import { createManualExport } from "@/infrastructure/channels/manual-export";
import type { ChannelConnectionId } from "@/domain/shared";

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

const exporter = createManualExport();

describe("貼り付け用の書き出し", () => {
  it("広告表記を本文の先頭側に置く（題の次・本文より前）", async () => {
    const draft = await exporter.buildDraft("note", input());
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;

    const md = draft.value.markdown;
    expect(md.indexOf("この記事には広告が含まれます。")).toBeLessThan(md.indexOf("本文です。"));
    expect(draft.value.instructions).toContain("消さないでください");
  });

  it("題が無いときは見出しを作らない（空の # を残さない）", async () => {
    const draft = await exporter.buildDraft("note", input({ title: null }));
    if (!draft.ok) return;
    expect(draft.value.markdown.startsWith("#")).toBe(false);
  });

  /**
   * 出し先の名前で分けない形にした本題。
   * 種類を渡さない設計だった間、どの先でも手順書は note のまま出ていた。
   */
  it("手順書は渡した出し先の名前で書かれる", async () => {
    const draft = await exporter.buildDraft("newsletter", input());
    if (!draft.ok) return;
    expect(draft.value.instructions).toContain(CHANNEL_CAPABILITIES.newsletter.label);
    expect(draft.value.instructions).not.toContain(CHANNEL_CAPABILITIES.note.label);
  });

  it.each([
    ["何も足さないとき", input(), 3],
    ["画像があるとき", input({ imageKeys: ["a.png"] }), 4],
    ["日時を決めているとき", input({ scheduledAt: new Date("2026-09-01T10:00:00Z") }), 4],
    ["両方あるとき", input({ imageKeys: ["a.png"], scheduledAt: new Date("2026-09-01T10:00:00Z") }), 5],
  ])("手順の番号が飛ばない: %s", async (_name, given, expected) => {
    const draft = await exporter.buildDraft("note", given);
    if (!draft.ok) return;

    const numbers = [...draft.value.instructions.matchAll(/^(\d+)\. /gm)].map((m) => Number(m[1]));
    expect(numbers).toEqual(Array.from({ length: expected }, (_, i) => i + 1));
  });

  it("画像があるときは、貼り付ける本文にも一覧が付く", async () => {
    const draft = await exporter.buildDraft("note", input({ imageKeys: ["hero.png", "table.png"] }));
    if (!draft.ok) return;
    expect(draft.value.markdown).toContain("hero.png");
    expect(draft.value.markdown).toContain("table.png");
    expect(draft.value.instructions).toContain("画像をアップロード");
  });

  it("画像が無いときは、画像の見出しを出さない（空の節を作らない）", async () => {
    const draft = await exporter.buildDraft("note", input());
    if (!draft.ok) return;
    expect(draft.value.markdown).not.toContain("添付する画像");
  });

  /**
   * 「自動で出せます」と読めてはいけない。
   * 手順書はこの経路の存在理由そのものなので、逆の意味に化けたら赤にする。
   */
  it("自動で投稿できるかのようには書かない", async () => {
    const draft = await exporter.buildDraft("note", input());
    if (!draft.ok) return;
    expect(draft.value.instructions).toContain("ご自身で投稿");
    expect(draft.value.instructions).not.toContain("直接公開");
  });
});
