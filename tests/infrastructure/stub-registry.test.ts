import { describe, expect, it } from "vitest";
import { createAspAdapter, supportedAsps } from "@/infrastructure/asp/asp-registry";
import { createChannelConnector } from "@/infrastructure/channels/channel-registry";
import { createLlm } from "@/infrastructure/llm/llm-provider-registry";
import { listStubs } from "@/infrastructure/stub-registry";
import { fakeSecretResolver } from "@/infrastructure/platform/secret-resolver";

/**
 * スタブ台帳。
 *
 * 「未実装なのに動いているように見える」ことを防ぐための検査。
 * カバレッジ報告の数字はこの一覧から作るので、手で数えた数とずれない。
 */
const secrets = fakeSecretResolver({});

describe("スタブ台帳", () => {
  it("未実装のアダプタは呼ぶと必ず失敗する", async () => {
    const asp = createAspAdapter("amazon_associates", {
      credentialRef: null,
      publicTrackingId: null,
      secrets,
    });
    expect(asp.ok).toBe(true);
    if (!asp.ok) return;

    const searched = await asp.value.searchProducts({ keyword: "ノートPC", limit: 5 });
    expect(searched.ok).toBe(false);
    if (!searched.ok) {
      expect(searched.error.code).toBe("NOT_IMPLEMENTED");
      // 何が足りないのかが失敗の中に入っていること
      expect(searched.error.details?.blockedBy).toBeTruthy();
    }
  });

  it("すべての提携先に差し込み口がある", () => {
    expect(supportedAsps()).toHaveLength(8);
  });

  it("登録されたスタブには、前提条件が必ず書かれている", () => {
    // 台帳へ載せるために、まず組み立てておく
    createLlm("anthropic", { credentialRef: "llm/main/api_key", modelId: "m", secrets });
    createChannelConnector("x", { credentialRef: null, secrets });

    const stubs = listStubs();
    expect(stubs.length).toBeGreaterThan(0);
    for (const s of stubs) {
      expect(s.blockedBy, `${s.id} に前提条件がありません`).not.toBe("");
      expect(s.label, `${s.id} に利用者向けの説明がありません`).not.toBe("");
    }
  });
});
