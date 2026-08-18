/**
 * @tier 1
 * @req REQ-M01, REQ-M02, REQ-WA01, REQ-WA02
 * @types equivalence, boundary
 *
 * 仕様に並ぶ道具の数（管理側 読み取り 10 種 = REQ-WA01 / 状態変更 8 種 = REQ-WA02 /
 * バックエンド MCP の Tools 8 種 = REQ-M02 / Resources 8 種 = REQ-M01）が
 * 実装とどう対応するかを、ここ 1 か所で持つ。
 *
 * 分かれ目は「対応が付いている / スタブ / 載せない」の 3 つ（同値）と、
 * **面ごとの個数がぴったり合うこと・集合の外を尋ねられたとき**（境界）である。
 * 個数を見ないと、1 種こっそり落としても気づけない。
 *
 * 認可の側（誰が呼べるか・確認が要る道具を AI に触らせないか）はここには無い。
 * REQ-WA02 と REQ-M03 の権限は `api-routes.test.ts`、
 * 読者の身元から見た拒否は `reader-tools.test.ts` が持つ。
 */
import { describe, expect, it } from "vitest";
import { createToolCatalog, currentActor } from "@/presentation/composition";
import { findTool } from "@/presentation/tools/catalog";
import { handleJsonRpc } from "@/presentation/tools/mcp-adapter";
import { invokeTool } from "@/presentation/tools/tool-definition";
import {
  MCP_RESOURCES,
  TOOL_CONTRACT,
  contractCoverage,
  findResource,
  parseResourceUri,
  schemeOf,
} from "@/presentation/tools/spec-contract";
import { PAGE_TOOLS } from "@/presentation/tools/webmcp-policy";

/**
 * 仕様の道具名と、実際に動くツールの対応。
 *
 * ここで固定したいのは 2 つ。
 *   1. 対応が付いていると書いたものは、**本当に仕様の名前で呼べる**こと
 *   2. 対応が付いていないものは、**スタブだと分かる形で残る**こと
 * どちらかを緩めると「仕様の 36 個ぜんぶ実装済み」と言えてしまう。
 */

const catalog = (await createToolCatalog());

describe("対応表そのもの", () => {
  it("仕様書に書かれた面ごとの個数と合っている", () => {
    const c = contractCoverage();
    const counts = Object.fromEntries(c.bySurface.map((s) => [s.surface, s.total]));
    expect(counts).toEqual({
      webmcp_admin_read: 10,
      webmcp_admin_write: 8,
      webmcp_reader_read: 9,
      webmcp_reader_write: 1,
      mcp_tool: 8,
    });
    expect(c.total).toBe(36);
    expect(c.implemented + c.stub).toBe(c.total);
  });

  it("同じ面の中に同じ名前を二度書かない", () => {
    for (const surface of new Set(TOOL_CONTRACT.map((e) => e.surface))) {
      const names = TOOL_CONTRACT.filter((e) => e.surface === surface).map((e) => e.specName);
      expect(new Set(names).size, surface).toBe(names.length);
    }
  });

  it("未実装のものには必ず理由が書いてある", () => {
    for (const entry of TOOL_CONTRACT) {
      if (entry.implementedBy !== null) continue;
      expect(entry.stubReason, entry.specName).toBeTruthy();
      expect((entry.stubReason ?? "").length, entry.specName).toBeGreaterThan(15);
    }
  });

  it("実装済みと書いたものには理由を書かない（両方書くと、どちらが本当か分からなくなる）", () => {
    for (const entry of TOOL_CONTRACT) {
      if (entry.implementedBy === null) continue;
      expect(entry.stubReason, entry.specName).toBeUndefined();
    }
  });
});

describe("仕様の名前で呼べること", () => {
  it("対応が付いているものは、すべてカタログに存在する", () => {
    const missing = TOOL_CONTRACT.filter(
      (e) => e.implementedBy !== null && findTool(catalog, e.specName) === null,
    ).map((e) => e.specName);
    expect(missing, "対応表に書いた名前が呼べません。別名の生成が漏れています。").toEqual([]);
  });

  it("対応先のツールも実在する（綴り違いを型では止められないため）", () => {
    const broken = TOOL_CONTRACT.filter(
      (e) => e.implementedBy !== null && findTool(catalog, e.implementedBy) === null,
    ).map((e) => `${e.specName} -> ${e.implementedBy}`);
    expect(broken).toEqual([]);
  });

  /**
   * 「実装はあるが、この面からは届かない」を、理由だけ書いて放置させない。
   *
   * `ah-83f` の前は、読者ページに載っている 9 件が全部この状態だった。
   * 目録には在り、動きもするが、読者の身元では 1 件も通らない。
   * **画面上は道具が並んで見えるので、使っても気づけない。**
   * だから理由を書いたものは、載せる一覧から降りていることをここで固定する。
   */
  it("届かないと書いたものは、読者ページに載せていない", () => {
    const readerPageTools = new Set(
      Object.entries(PAGE_TOOLS)
        .filter(([kind]) => kind !== "admin")
        .flatMap(([, names]) => names),
    );
    const stillListed = TOOL_CONTRACT.filter(
      (e) =>
        e.unreachableReason !== undefined &&
        e.surface.startsWith("webmcp_reader") &&
        (readerPageTools.has(e.specName) || readerPageTools.has(e.implementedBy ?? "")),
    ).map((e) => e.specName);
    expect(
      stillListed,
      "届かない道具が読者ページに載ったままです。降ろすか、届く実装へ向け直してください。",
    ).toEqual([]);
  });

  it("届かない理由は、実装があるものにだけ書く（無いものは stubReason）", () => {
    for (const entry of TOOL_CONTRACT) {
      if (entry.unreachableReason === undefined) continue;
      expect(entry.implementedBy, entry.specName).not.toBeNull();
      expect(entry.unreachableReason.length, entry.specName).toBeGreaterThan(15);
    }
  });

  it("未実装のものはカタログに載せない（呼べば必ず失敗するものを載せない）", () => {
    const ghosts = TOOL_CONTRACT.filter(
      (e) => e.implementedBy === null && findTool(catalog, e.specName) !== null,
    ).map((e) => e.specName);
    expect(ghosts).toEqual([]);
  });

  it("別名は、元のツールと同じ処理を指している", () => {
    const entry = TOOL_CONTRACT.find((e) => e.specName === "search_products");
    const alias = findTool(catalog, "search_products");
    const base = findTool(catalog, entry?.implementedBy ?? "");
    expect(alias).not.toBeNull();
    expect(base).not.toBeNull();
    expect(alias?.useCase).toBe(base?.useCase);
    expect(alias?.readOnly).toBe(base?.readOnly);
    expect(alias?.requiresHumanApproval).toBe(base?.requiresHumanApproval);
  });

  it("別名でも、元と同じ結果が返る", async () => {
    const actor = await currentActor();
    const alias = findTool(catalog, "get_product_evidence");
    const base = findTool(catalog, "get_evidence");
    expect(alias).not.toBeNull();
    expect(base).not.toBeNull();
    if (alias === null || base === null) return;
    const args = { productId: "p_1" };
    const viaAlias = await invokeTool(alias, actor, args);
    const viaBase = await invokeTool(base, actor, args);
    expect(viaAlias).toEqual(viaBase);
  });

  it("カタログの中で名前が重複しない", () => {
    const names = catalog.map((t) => t.name);
    const dup = names.filter((n, i) => names.indexOf(n) !== i);
    expect(dup).toEqual([]);
  });
});

describe("バックエンド MCP の Resources", () => {
  it("仕様書どおり 8 種ある", () => {
    expect(MCP_RESOURCES).toHaveLength(8);
    expect(MCP_RESOURCES.map(schemeOf)).toEqual([
      "workspace",
      "brand",
      "product",
      "comparison",
      "content-package",
      "publication",
      "methodology",
      "evidence",
    ]);
  });

  it("中身はすべて既存のツールから取る（読み出しを二重に書かない）", () => {
    for (const r of MCP_RESOURCES) {
      expect(findTool(catalog, r.backedBy), r.uriTemplate).not.toBeNull();
      expect(findTool(catalog, r.backedBy)?.readOnly, r.uriTemplate).toBe(true);
    }
  });

  it("URI を読み分けられる", () => {
    expect(parseResourceUri("product://p_1")).toEqual({ scheme: "product", value: "p_1" });
    expect(parseResourceUri("こわれた")).toBeNull();
    expect(parseResourceUri("product://")).toBeNull();
    expect(findResource("evidence://e_1")?.backedBy).toBe("get_evidence");
    expect(findResource("unknown://x")).toBeNull();
  });

  it("resources/list が一覧を返す", async () => {
    const actor = await currentActor();
    const res = await handleJsonRpc(catalog, actor, {
      jsonrpc: "2.0",
      id: 1,
      method: "resources/list",
    });
    const result = res.result as { resourceTemplates: { uriTemplate: string }[] };
    expect(result.resourceTemplates).toHaveLength(8);
    expect(result.resourceTemplates[0]?.uriTemplate).toBe("workspace://{workspace_id}");
  });

  it("resources/read が中身を返す", async () => {
    const actor = await currentActor();
    const res = await handleJsonRpc(catalog, actor, {
      jsonrpc: "2.0",
      id: 2,
      method: "resources/read",
      params: { uri: "methodology://ranking" },
    });
    expect(res.error).toBeUndefined();
    const result = res.result as { contents: { uri: string; text: string }[] };
    expect(result.contents[0]?.uri).toBe("methodology://ranking");
    expect(result.contents[0]?.text).toContain("sections");
  });

  it("知らない場所は、黙って空にせず理由を返す", async () => {
    const actor = await currentActor();
    const res = await handleJsonRpc(catalog, actor, {
      jsonrpc: "2.0",
      id: 3,
      method: "resources/read",
      params: { uri: "secret://everything" },
    });
    expect(res.result).toBeUndefined();
    expect(res.error?.message).toContain("読めません");
  });
});
