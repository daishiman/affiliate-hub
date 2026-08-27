/**
 * @tier 1
 * @req REQ-API01
 * @types tenant-isolation
 *
 * 入口の群（REQ-API01）のうち、**他の作業場所を覗けないこと**はここで確かめている。
 * 「存在しないワークスペースのデータは『見つかりません』で、権限の話にしない」が
 * それで、権限の話に落とすと、あるかどうかが答えから漏れる。
 */
import { describe, expect, it } from "vitest";
import { buildToolCatalog } from "@/presentation/tools/catalog";
import { handleToolRequest, describeTools } from "@/presentation/tools/rest-adapter";
import { handleJsonRpc } from "@/presentation/tools/mcp-adapter";
import { toWebMcpTools } from "@/presentation/tools/webmcp-adapter";
import { WEBMCP_LISTED_TOOLS, isListedOnWebMcp } from "@/presentation/tools/webmcp-policy";
import type {
  EditorialRankingModelRepositoryPort,
  EditorialScoreCardRepositoryPort,
} from "@/application/ports";
import type { EditorialScoreCard } from "@/domain/ranking";
import type { RankingModel } from "@/domain/ranking";
import { markEditorial, ok } from "@/domain/shared";
import { createDeps } from "@/infrastructure/composition";
import type { ActorContext, CategoryId, ProductId, RankingModelId, WorkspaceId } from "@/domain/shared";

/**
 * 「ロジックを 3 回書かない」ことの確認。
 *
 * REST・バックエンド MCP・WebMCP は、同じユースケースの別の入口である。
 * 3 つが同じ順位を返すことをテストで固定しておけば、
 * どれか 1 つに独自の計算を書き足した時点で落ちる。
 */
const workspaceId = "ws_1" as WorkspaceId;
const modelId = "rm_1" as RankingModelId;

const model: RankingModel = {
  id: modelId,
  workspaceId,
  categoryId: "cat_1" as CategoryId,
  version: "1.0.0",
  audience: "はじめて買う人",
  criteria: [
    { key: "measured_performance", weight: 0.6, measurement: "実測の処理時間", passThreshold: 0.2 },
    { key: "usability", weight: 0.4, measurement: "設定完了までの手順数", passThreshold: 0.2 },
  ],
  effectiveFrom: new Date("2026-01-01T00:00:00Z"),
  affiliateCompensationIsInput: false,
};

const cards: EditorialScoreCard[] = [
  {
    productId: "p_low" as ProductId,
    scores: { measured_performance: 0.4, usability: 0.5 },
    evidenceRefs: ["ev_1"],
    testedAt: new Date("2026-06-01T00:00:00Z"),
  },
  {
    productId: "p_high" as ProductId,
    scores: { measured_performance: 0.9, usability: 0.8 },
    evidenceRefs: ["ev_2"],
    testedAt: new Date("2026-06-01T00:00:00Z"),
  },
];

// 差し替えたいのは順位まわりの 2 つだけ。残りは既定の組み立てをそのまま使う。
// ここで全ポートを手で書き並べると、ポートを 1 つ足すたびにテストが壊れる。
const catalog = buildToolCatalog({
  ...createDeps(),
  rankingModels: markEditorial({
    findById: async () => ok(model),
    list: async () => ok({ items: [], nextCursor: null }),
    save: async (m: RankingModel) => ok(m),
  }) as unknown as EditorialRankingModelRepositoryPort,
  scoreCards: markEditorial({
    listByModel: async () => ok(cards),
    save: async (c: EditorialScoreCard) => ok(c),
  }) as unknown as EditorialScoreCardRepositoryPort,
});

const actor: ActorContext = {
  workspaceId,
  userId: "u_1",
  roles: ["owner"],
  scopedBrandIds: [],
  isAiServiceAccount: false,
  // 身元を確かめてある人。ここは権限の検査で、ログインの有無は見ていない。
  identified: true,
};

const args = { modelId: "rm_1", productIds: ["p_low", "p_high"] };

describe("1つのユースケース、3つの入口", () => {
  it("REST は順位を返す", async () => {
    const response = await handleToolRequest(catalog, actor, "rank_products", args);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: { ranked: { productId: string }[] } };
    expect(body.data.ranked[0]?.productId).toBe("p_high");
  });

  it("バックエンド MCP も同じ順位を返す", async () => {
    const rpc = await handleJsonRpc(catalog, actor, {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "rank_products", arguments: args },
    });
    const result = rpc.result as { content: { text: string }[] };
    const parsed = JSON.parse(result.content[0]!.text) as { ranked: { productId: string }[] };
    expect(parsed.ranked[0]?.productId).toBe("p_high");
  });

  /**
   * **WebMCP に載るのは、表（`PAGE_TOOLS`）に名前があるものだけ。**
   *
   * ここは以前 `rank_products` が載ることを固定していた。あれが載っていたのは
   * 表に書いたからではなく、**`readOnly: true` と書いてあったから**である。
   * 旗を根拠にしていたので、読み取りの道具はどれも黙って候補に入っていた。
   * `rank_products` はどのページにも置いていないので、いまは載らないのが正しい。
   */
  it("WebMCP には表に名前のあるツールだけが載る", () => {
    const tools = toWebMcpTools(catalog);
    expect(tools.map((t) => t.name)).not.toContain("rank_products");
    expect(tools.length).toBeGreaterThan(0);
    for (const t of tools) {
      expect(isListedOnWebMcp(t.name), `${t.name} は表にありません`).toBe(true);
    }
  });

  it("3つの入口が配る入力の形は同一", () => {
    // WebMCP だけは表にある道具で見る（`rank_products` は載らない）。
    const listed = [...WEBMCP_LISTED_TOOLS][0]!;
    for (const name of ["rank_products", listed]) {
      const definition = catalog.find((t) => t.name === name);
      expect(describeTools(catalog).find((t) => t.name === name)?.inputSchema).toEqual(
        definition?.inputSchema,
      );
    }
    const web = toWebMcpTools(catalog).find((t) => t.name === listed);
    expect(web?.inputSchema).toEqual(catalog.find((t) => t.name === listed)?.inputSchema);
  });

  it("入力の誤りは、直し方の分かる日本語で返る", async () => {
    const response = await handleToolRequest(catalog, actor, "rank_products", {
      modelId: "rm_1",
      productIds: [],
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { message: string; suggestedAction: string } };
    expect(body.error.message).toMatch(/[ぁ-んァ-ン一-龥]/);
    expect(body.error.suggestedAction).not.toBeNull();
  });

  it("存在しないワークスペースのデータは「見つかりません」で、権限の話にしない", async () => {
    const otherActor: ActorContext = { ...actor, workspaceId: "ws_other" as WorkspaceId };
    const response = await handleToolRequest(catalog, otherActor, "rank_products", args);
    expect(response.status).toBe(404);
  });

  /*
   * 上の 1 件は **REST の入口しか通っていない**。
   * REQ-API02 が言っているのは「入口ごとにテナント判定がずれない」ことなので、
   * 1 つの入口で断れることは、残りの入口で断れることを何も言っていない。
   * `docs/product/traceability.md` U 節はこの要件を
   * `tests/property/tenancy.property.test.ts` の担当としていたが、
   * あの試験は `assertSameTenant` を直に呼ぶだけで、入口を 1 つも通らない
   * （2026-08-21 に読んで確かめた ＝ `TM04` 型）。
   */
  it("バックエンド MCP の入口も、他の作業場所のデータを返さない", async () => {
    const otherActor: ActorContext = { ...actor, workspaceId: "ws_other" as WorkspaceId };
    const rpc = await handleJsonRpc(catalog, otherActor, {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "rank_products", arguments: args },
    });
    const result = rpc.result as { isError?: boolean; content: { text: string }[] };
    const text = result.content.map((c) => c.text).join("\n");
    // 順位が返ってこないこと（他社の商品IDが混ざらない）。
    expect(text).not.toContain("p_high");
    expect(result.isError).toBe(true);
    // REST と同じ扱い（404 = 見つからない）に揃っていること。権限の話に落とさない。
    expect(text).toContain("status: 404");
  });
});
