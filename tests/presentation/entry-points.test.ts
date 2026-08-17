/** @tier 1 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isToolAllowedForScope, refusalReason, visibleTools } from "@/presentation/http/tool-scope";
import { MAX_TOOLS_PER_PAGE, toWebMcpDescriptors } from "@/presentation/tools/webmcp-adapter";
import type { AnyToolDefinition } from "@/presentation/tools/tool-definition";

/**
 * 入口が 1 つの決まりで動いていることの検査。
 *
 * 壊れ方はいつも同じで、「入口を増やしたときに、そこだけ判定を書き直す」。
 * 片方だけ緩い状態は目視では見つからないので、機械で止める。
 */
const ROOT = resolve(import.meta.dirname, "../..");

function fakeTool(over: Partial<AnyToolDefinition>): AnyToolDefinition {
  return {
    name: "x",
    description: "見本",
    inputSchema: {},
    readOnly: true,
    requiresHumanApproval: false,
    useCase: { execute: async () => ({ ok: true, value: null }) },
    ...over,
  } as AnyToolDefinition;
}

describe("誰に何を許すか", () => {
  const readOnly = fakeTool({ name: "read", readOnly: true });
  const write = fakeTool({ name: "write", readOnly: false });
  const humanOnly = fakeTool({ name: "approve", readOnly: false, requiresHumanApproval: true });

  it("自サイトの画面からは読み取りだけ", () => {
    expect(isToolAllowedForScope(readOnly, "same-origin")).toBe(true);
    expect(isToolAllowedForScope(write, "same-origin")).toBe(false);
  });

  it("トークンがあれば書き込みも実行できる", () => {
    expect(isToolAllowedForScope(write, "bearer")).toBe(true);
  });

  it("人の確認が要る操作は、トークンがあっても入口からは実行できない", () => {
    expect(isToolAllowedForScope(humanOnly, "bearer")).toBe(false);
    expect(isToolAllowedForScope(humanOnly, "same-origin")).toBe(false);
  });

  it("断るときは理由を返す（無言で落とさない）", () => {
    expect(refusalReason(humanOnly)).toContain("人が画面で確認");
    expect(refusalReason(write)).toContain("認証");
  });

  it("見せる一覧と実行できる範囲が一致する", () => {
    const catalog = [readOnly, write, humanOnly];
    for (const scope of ["bearer", "same-origin"] as const) {
      for (const tool of visibleTools(catalog, scope)) {
        expect(isToolAllowedForScope(tool, scope), `${tool.name} が一覧にだけ出ています`).toBe(true);
      }
    }
  });
});

describe("AI へ公開する範囲（WebMCP）", () => {
  it("読み取り専用だけ、6 件まで", () => {
    const catalog = [
      ...Array.from({ length: 10 }, (_, i) => fakeTool({ name: `r${i}`, readOnly: true })),
      fakeTool({ name: "w", readOnly: false }),
    ];
    const descriptors = toWebMcpDescriptors(catalog);
    expect(descriptors.length).toBeLessThanOrEqual(MAX_TOOLS_PER_PAGE);
    expect(descriptors.some((d) => d.name === "w")).toBe(false);
  });

  it("実行の関数を混ぜない（ブラウザへ渡せる形だけにする）", () => {
    const [first] = toWebMcpDescriptors([fakeTool({ name: "r", readOnly: true })]);
    expect(Object.keys(first)).toEqual(["name", "description", "inputSchema"]);
  });
});

describe("入口の実装が 1 つであること", () => {
  it("MCP の入口は共通のカタログを使う", () => {
    const source = readFileSync(resolve(ROOT, "src/app/api/mcp/route.ts"), "utf8");
    expect(source).toContain("@/presentation/composition");
    expect(source).toContain("handleJsonRpc");
    // 旧実装（独自のツール一覧）へ戻っていないこと
    expect(source).not.toContain("@/lib/");
  });

  it("REST の入口も同じ判定関数を使う", () => {
    const source = readFileSync(resolve(ROOT, "src/app/api/tools/[tool]/route.ts"), "utf8");
    expect(source).toContain("isToolAllowedForScope");
  });

  it("旧実装（src/lib・src/components）が残っていない", () => {
    // 同じ役目のコードが 2 つあると、直したつもりの方が使われていない事故が起きる。
    expect(existsSync(resolve(ROOT, "src/lib")), "src/lib が残っています").toBe(false);
    expect(existsSync(resolve(ROOT, "src/components")), "src/components が残っています").toBe(false);
  });
});
