/** @tier 1 */
import { describe, expect, it } from "vitest";
import { ASP_LABEL } from "@/domain/monetization";
import { createAspAdapter, supportedAsps } from "@/infrastructure/asp/asp-registry";
import { createChannelConnector } from "@/infrastructure/channels/channel-registry";
import { createLlm } from "@/infrastructure/llm/llm-provider-registry";
import { listStubs } from "@/infrastructure/stub-registry";
import { fakeSecretResolver } from "@/infrastructure/platform/secret-resolver";
import { llmProviderContextDouble } from "../support/doubles";

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
    // 個数を直接書かない。数を書くと、提携先を 1 つ足すたびに
    // このテストも直すことになり「触るファイル数」が水増しされる。
    // 確かめたいのは数ではなく「ドメインの一覧と差し込み口が一致していること」。
    const declared = Object.keys(ASP_LABEL).sort();
    const wired = supportedAsps()
      .map((a) => a.kind)
      .sort();
    expect(wired, "提携先の一覧と差し込み口がずれています").toEqual(declared);
  });

  it("登録されたスタブには、前提条件が必ず書かれている", () => {
    // 台帳へ載せるために、まず組み立てておく
    // **Anthropic は使わない。** 実装が入ったのでスタブとして登録されなくなった。
    // ここで確かめたいのは「まだ中身が無いものに前提条件が書かれている」ことなので、
    // まだ中身の無い提供元を選ぶ。
    createLlm("google", llmProviderContextDouble());
    createChannelConnector("x", { credentialRef: null, secrets });

    const stubs = listStubs();
    expect(stubs.length).toBeGreaterThan(0);
    for (const s of stubs) {
      expect(s.blockedBy, `${s.id} に前提条件がありません`).not.toBe("");
      expect(s.label, `${s.id} に利用者向けの説明がありません`).not.toBe("");
    }
  });
});
