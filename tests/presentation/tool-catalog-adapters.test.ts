import { describe, expect, it } from "vitest";
import type { ActorContext } from "@/domain/shared";
import { createDeps } from "@/infrastructure/composition";
import { SAMPLE_ACTOR } from "@/infrastructure/identity/sample-actor";
import { SAMPLE_WORKSPACE_ID } from "@/infrastructure/persistence/sample/ranking-sample-repository";
import { buildToolCatalog } from "@/presentation/tools/catalog";
import { handleJsonRpc } from "@/presentation/tools/mcp-adapter";
import { describeTools, handleToolRequest } from "@/presentation/tools/rest-adapter";
import { invokeTool, type AnyToolDefinition } from "@/presentation/tools/tool-definition";
import { MAX_TOOLS_PER_PAGE, toWebMcpDescriptors } from "@/presentation/tools/webmcp-adapter";
import { NO_HAPPY_PATH, requiredFieldsOf, unknownFields, validInputFor } from "./tool-inputs";

/**
 * API の単体検査を、道具の一覧（カタログ）から機械的に作る。
 *
 * 道具は 95 個ある。**1 個ずつ手で検査を書くと、書いた分しか守られない。**
 * ここでは一覧をそのまま回すので、道具を 1 つ足せば検査も 1 つ増える。
 * 足した人が検査を書き忘れても、辞書に無い項目名で落ちて気づける。
 *
 * 見るのは 6 つ:
 *   正常系 / 入力検証 / 認証認可 / テナント分離 / エラー形式 / スタブが失敗を返すこと
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §3-3
 */

const catalog = buildToolCatalog(createDeps());

/** すべての役割を持つ人。正常系はこの人で通す。 */
const OWNER: ActorContext = { ...SAMPLE_ACTOR, roles: ["owner", ...SAMPLE_ACTOR.roles] };

/** 人ではなく AI。承認が要る操作を拒まれる側。 */
const AI: ActorContext = { ...SAMPLE_ACTOR, isAiServiceAccount: true };

/** 同じ役割を持つが、別の会社の人。見本データが 1 件も見えてはいけない。 */
const OTHER_TENANT: ActorContext = {
  ...OWNER,
  workspaceId: "ws_other_company" as ActorContext["workspaceId"],
};

const JAPANESE = /[ぁ-んァ-ヶー一-龥]/;

const readOnlyTools = catalog.filter((t) => t.readOnly);
const approvalTools = catalog.filter((t) => t.requiresHumanApproval);
const happyPathTools = readOnlyTools.filter((t) => NO_HAPPY_PATH[t.name] === undefined);
const requiredInputTools = catalog.filter((t) => requiredFieldsOf(t).length > 0);

const nameOf = (tool: AnyToolDefinition) => tool.name;

async function restBody(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe("道具の一覧そのもの", () => {
  it("道具が 1 つ以上あり、名前が重複していない", () => {
    // 名前が重なると findTool が先勝ちになり、**後ろの道具が一生呼ばれない**。
    expect(catalog.length).toBeGreaterThan(0);
    const names = catalog.map(nameOf);
    expect(new Set(names).size, `名前が重複しています: ${names.join(", ")}`).toBe(names.length);
  });

  it("入力の辞書が全部の道具をまかなえている", () => {
    // ここが落ちたら tests/presentation/tool-inputs.ts に項目名を 1 行足す。
    // 落ちないと、新しい道具だけが検査されないまま増えていく。
    expect(unknownFields(catalog), "辞書に無い項目名があります").toEqual([]);
  });

  it("すべての道具に、日本語の説明がある", () => {
    for (const tool of catalog) {
      expect(tool.description, `${tool.name} の説明が短すぎます`).toMatch(JAPANESE);
      expect(tool.description.length).toBeGreaterThan(5);
    }
  });
});

describe("3 つの入口が同じものを配る", () => {
  it("REST の一覧と MCP の一覧が、名前も説明も入力の形も一致する", async () => {
    // 1 つの定義から作っている、ということの実測。
    // ここがずれたら、どちらかの入口が定義を経由せず自前で持ち始めている。
    const rest = describeTools(catalog);
    const rpc = await handleJsonRpc(catalog, OWNER, { jsonrpc: "2.0", id: 1, method: "tools/list" });
    const mcp = (rpc.result as { tools: { name: string; description: string; inputSchema: unknown }[] })
      .tools;

    expect(mcp.map((t) => t.name)).toEqual(rest.map((t) => t.name));
    for (const [i, tool] of rest.entries()) {
      expect(mcp[i].description).toBe(tool.description);
      expect(mcp[i].inputSchema).toEqual(tool.inputSchema);
    }
  });

  it("MCP は、人の承認が要る操作をその旨つきで配る", async () => {
    const rpc = await handleJsonRpc(catalog, OWNER, { jsonrpc: "2.0", id: 1, method: "tools/list" });
    const mcp = (
      rpc.result as { tools: { name: string; annotations: { readOnlyHint: boolean; destructiveHint: boolean } }[] }
    ).tools;
    for (const tool of mcp) {
      const source = catalog.find((t) => t.name === tool.name);
      expect(tool.annotations.readOnlyHint).toBe(source?.readOnly);
      expect(tool.annotations.destructiveHint).toBe(source?.requiresHumanApproval);
    }
  });

  it("WebMCP には読み取り専用だけを、上限の数まで載せる", () => {
    // ページ内の AI に状態を変えさせない、という決まりを機械にする。
    // 数を絞るのは、選択肢が多いほどエージェントが誤った道具を選ぶため。
    const descriptors = toWebMcpDescriptors(catalog);
    expect(descriptors.length).toBeLessThanOrEqual(MAX_TOOLS_PER_PAGE);
    for (const d of descriptors) {
      const source = catalog.find((t) => t.name === d.name);
      expect(source?.readOnly, `${d.name} は読み取り専用ではありません`).toBe(true);
      expect(source?.requiresHumanApproval, `${d.name} は承認が要る操作です`).toBe(false);
      expect(d.description).toBe(source?.description);
      expect(d.inputSchema).toEqual(source?.inputSchema);
    }
  });
});

describe("正常系", () => {
  it.each(happyPathTools.map(nameOf))("%s は、見本データで結果を返す", async (name) => {
    const tool = catalog.find((t) => t.name === name)!;
    const input = validInputFor(tool)!;
    const result = await invokeTool(tool, OWNER, input);
    // 失敗した場合に「どの道具がどう失敗したか」を出す。
    // toBe(true) だけだと、95 個のどれが落ちたか分からない。
    expect(result.ok ? "ok" : `${result.error.code}: ${result.error.message}`).toBe("ok");
  });

  it.each(happyPathTools.map(nameOf))("%s は、REST でも 200 を返す", async (name) => {
    const tool = catalog.find((t) => t.name === name)!;
    const response = await handleToolRequest(catalog, OWNER, name, validInputFor(tool)!);
    expect(response.status).toBe(200);
    expect(await restBody(response)).toHaveProperty("data");
  });
});

describe("入力検証", () => {
  it.each(requiredInputTools.map(nameOf))("%s は、空の入力で例外を投げずに断る", async (name) => {
    const tool = catalog.find((t) => t.name === name)!;

    // 例外で落とすと、入口ごとに握り方が違って別々の応答になる。
    expect(() => tool.parse({})).not.toThrow();

    const response = await handleToolRequest(catalog, OWNER, name, {});
    expect(response.status).toBe(400);

    const body = (await restBody(response)).error as Record<string, unknown>;
    expect(body.code).toBe("VALIDATION_FAILED");
    // 「入力が不正です」では利用者は直せない。どこを直すかが要る。
    expect(String(body.message)).toMatch(JAPANESE);
    expect(body.suggestedAction, `${name} に直し方の案内がありません`).not.toBeNull();
  });

  it.each(requiredInputTools.map(nameOf))("%s は、入力そのものが無くても落ちない", async (name) => {
    // 本文が空の POST や、配列・文字列が届いたときに 500 を返さないこと。
    for (const raw of [undefined, null, "", [], 0]) {
      const response = await handleToolRequest(catalog, OWNER, name, raw);
      expect(response.status, `${name} に ${JSON.stringify(raw) ?? "undefined"} を渡すと落ちます`).toBe(400);
    }
  });
});

describe("認証認可", () => {
  it("人の承認が要る操作が実際に存在する", () => {
    // 0 件だと以下の検査が「何も確かめずに緑」になる。
    expect(approvalTools.length).toBeGreaterThan(0);
  });

  it.each(approvalTools.map(nameOf))("%s は、AI からは呼べない", async (name) => {
    const tool = catalog.find((t) => t.name === name)!;

    const direct = await invokeTool(tool, AI, validInputFor(tool) ?? {});
    expect(direct.ok).toBe(false);
    if (!direct.ok) expect(direct.error.code).toBe("FORBIDDEN");

    const response = await handleToolRequest(catalog, AI, name, validInputFor(tool) ?? {});
    expect(response.status).toBe(403);

    const rpc = await handleJsonRpc(catalog, AI, {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: validInputFor(tool) ?? {} },
    });
    const mcp = rpc.result as { content: { text: string }[]; isError?: boolean };
    expect(mcp.isError).toBe(true);
    expect(mcp.content[0].text).toContain("FORBIDDEN");
  });

  it("拒む判断は、入力を見る前に行われる", async () => {
    // 入力検証を先に通すと、AI に「その ID は形が違う」と教えてしまう。
    const tool = approvalTools[0];
    const result = await invokeTool(tool, AI, { でたらめ: true });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
  });
});

describe("テナント分離", () => {
  it.each(happyPathTools.map(nameOf))("%s は、別の会社に見本データを渡さない", async (name) => {
    const tool = catalog.find((t) => t.name === name)!;
    const result = await invokeTool(tool, OTHER_TENANT, validInputFor(tool)!);

    // 断られるのが正しい。読者向けの公開情報だけは誰が見ても同じなので、
    // その場合は「見本の会社の識別子が混ざっていないこと」で見る。
    if (result.ok) {
      expect(
        JSON.stringify(result.value),
        `${name} が別の会社に ${SAMPLE_WORKSPACE_ID} のデータを返しました`,
      ).not.toContain(SAMPLE_WORKSPACE_ID);
    }
  });
});

describe("エラー形式", () => {
  it("知らない道具の名前は、REST でも MCP でも同じ扱いになる", async () => {
    const response = await handleToolRequest(catalog, OWNER, "no_such_tool", {});
    expect(response.status).toBe(404);
    const body = (await restBody(response)).error as Record<string, unknown>;
    expect(body.code).toBe("NOT_FOUND");
    expect(String(body.message)).toMatch(JAPANESE);

    const rpc = await handleJsonRpc(catalog, OWNER, {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "no_such_tool" },
    });
    expect(rpc.error?.code).toBe(-32601);
    expect(String(rpc.error?.message)).toMatch(JAPANESE);
  });

  it("知らないメソッドは、対応していないと分かる形で返る", async () => {
    const rpc = await handleJsonRpc(catalog, OWNER, { jsonrpc: "2.0", id: 1, method: "tools/dance" });
    expect(rpc.error?.code).toBe(-32601);
    expect(rpc.result).toBeUndefined();
  });

  it("失敗の応答は、常に同じ 5 つの項目を持つ", async () => {
    // 入口ごとに形が違うと、呼ぶ側が入口ごとに分岐を書くことになる。
    const response = await handleToolRequest(catalog, OWNER, "no_such_tool", {});
    const body = (await restBody(response)).error as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual([
      "code",
      "field",
      "message",
      "retryable",
      "suggestedAction",
    ]);
  });

  it("MCP の失敗には、次にできることが添えられている", async () => {
    // 「失敗しました」だけだと、エージェントは同じ呼び出しを繰り返す。
    const tool = requiredInputTools[0];
    const rpc = await handleJsonRpc(catalog, OWNER, {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: tool.name, arguments: {} },
    });
    const mcp = rpc.result as { content: { text: string }[]; isError?: boolean };
    expect(mcp.isError).toBe(true);
    expect(mcp.content[0].text).toContain("次にできること");
    expect(mcp.content[0].text).toContain("code:");
  });
});

describe("まだ出来ていないものが、出来ているふりをしないこと", () => {
  it.each(Object.keys(NO_HAPPY_PATH))("%s は、理由どおり結果を返さない", async (name) => {
    // **NO_HAPPY_PATH は書き得にしない。** ここに名前を書けば正常系の検査を
    // 免れる、という状態にすると、実装が終わった道具もそのまま残り続ける。
    // 実装できたらこの検査が落ちるので、そのとき一覧から外す。
    const tool = catalog.find((t) => t.name === name);
    expect(tool, `${name} という道具はもうありません。一覧から外してください`).toBeDefined();

    const result = await invokeTool(tool!, OWNER, validInputFor(tool!) ?? {});
    expect(result.ok, `${name} は動くようになりました。NO_HAPPY_PATH から外してください`).toBe(false);
    if (!result.ok) {
      // 失敗の仕方も検査する。黙って空を返すのが最も困る。
      expect(result.error.message).toMatch(JAPANESE);
      expect(NO_HAPPY_PATH[name].length, "理由が書かれていません").toBeGreaterThan(10);
    }
  });
});
