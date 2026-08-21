/**
 * @tier 1
 * @req REQ-API01, REQ-WC08, REQ-TS04
 * @types permission-matrix, equivalence, decision-table
 *
 * 入口の群（REQ-API01）の分かれ目は「誰に何を許すか」で、
 * 下の 入口 3 種 × 操作 の総当たりがそれである。
 * 各ツールの入力の分かれ目は、そのツールの要件の側が持つ（入口は形を配るだけ）。
 * 他の作業場所を覗けないことは `one-usecase-three-adapters.test.ts` が見ている。
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createToolCatalog } from "@/presentation/composition";
import {
  isToolAllowedForScope,
  loadScopedCatalog,
  refusalReason,
  visibleTools,
} from "@/presentation/http/tool-scope";
import { findTool } from "@/presentation/tools/catalog";
import { MAX_TOOLS_PER_PAGE, toWebMcpDescriptors } from "@/presentation/tools/webmcp-adapter";
import type { AnyToolDefinition } from "@/presentation/tools/tool-definition";

/**
 * 入口が 1 つの決まりで動いていることの検査。
 *
 * 壊れ方はいつも同じで、「入口を増やしたときに、そこだけ判定を書き直す」。
 * 片方だけ緩い状態は目視では見つからないので、機械で止める。
 */
const ROOT = resolve(import.meta.dirname, "../..");
const retiredCatalog = await createToolCatalog();

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

  it("1 回の要求では、全体と公開範囲を同じカタログ生成結果から作る", async () => {
    let loads = 0;
    const loaded = await loadScopedCatalog(async () => {
      loads += 1;
      return [readOnly, write, humanOnly];
    }, "bearer");

    expect(loads).toBe(1);
    expect(loaded.all).toEqual([readOnly, write, humanOnly]);
    expect(loaded.visible).toEqual([readOnly, write]);
  });
});

describe("AI へ公開する範囲（WebMCP）", () => {
  /** 表に名前を書く、という掲載の根拠を、見本の道具で作る。 */
  const listing = (...names: string[]) => ({ listed: (n: string) => names.includes(n) });

  it("表に名前があるものだけ、6 件まで", () => {
    const catalog = [
      ...Array.from({ length: 10 }, (_, i) => fakeTool({ name: `r${i}`, readOnly: true })),
      fakeTool({ name: "w", readOnly: false }),
    ];
    const names = Array.from({ length: 10 }, (_, i) => `r${i}`);
    const descriptors = toWebMcpDescriptors(catalog, listing(...names));
    expect(descriptors.length).toBeLessThanOrEqual(MAX_TOOLS_PER_PAGE);
    expect(descriptors.some((d) => d.name === "w")).toBe(false);
  });

  /**
   * **既定は「載せない」。**
   *
   * 以前は道具定義の `readOnly` が掲載を決めていたので、既定は「載せる」だった。
   * 読み取りの道具を 1 つ足すたびに、ページ内の AI の手が届く範囲が黙って広がる。
   * 表に書き忘れたときに載らないほうが、事故は軽い。
   */
  it("読み取り専用を名乗っていても、表に無ければ載らない", () => {
    expect(toWebMcpDescriptors([fakeTool({ name: "r", readOnly: true })])).toEqual([]);
  });

  it("実行の関数を混ぜない（ブラウザへ渡せる形だけにする）", () => {
    const [first] = toWebMcpDescriptors([fakeTool({ name: "r", readOnly: true })], listing("r"));
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

/*
  暫定だった 3 つのツールの後始末（REQ-WC08）。

  「移行済み」と書いてあるだけでは、消えたのか名前を変えただけなのかが分からない。
  旧名 3 つを 1 つずつ表にして、**消えたことと、その代わりがどれか**を並べる。
  代わりが無い行は空欄のままにしてある。埋めるより、無いことを見えるようにする方が要る。
*/
const RETIRED_TOOLS = [
  {
    旧名: "list_programs",
    後継: "list_affiliate_programs",
    なぜ: "何の一覧かが名前から分かるようにした",
  },
  {
    旧名: "get_revenue_summary",
    後継: "list_metrics",
    なぜ: "売上だけでなく計測値全体を 1 つの口から返す形にした",
  },
  {
    旧名: "record_conversion",
    後継: null,
    なぜ: "成果を書き込む口は、いまのカタログに 1 つも無い（`adjust_conversion_reward` は既にある成果の金額を直すだけ）。ASP からの取り込みが未実装のため、書き込む元が無い",
  },
] as const;

describe("暫定だった 3 ツールの後始末（判定表）", () => {
  it("旧名 3 つが、1 つも落ちずに表に並んでいる", () => {
    expect(RETIRED_TOOLS.length).toBe(3);
    expect(new Set(RETIRED_TOOLS.map((t) => t.旧名)).size).toBe(3);
  });

  it("旧 `src/lib/mcp/specs.ts` は存在しない", () => {
    expect(existsSync(resolve(ROOT, "src/lib/mcp/specs.ts"))).toBe(false);
  });

  it.each(RETIRED_TOOLS.map((t) => [t.旧名] as const))("%s: 旧名はカタログに無い", (旧名) => {
    expect(findTool(retiredCatalog, 旧名), `${旧名} がまだ受け付けられています`).toBeNull();
  });

  it.each(
    RETIRED_TOOLS.filter((t) => t.後継 !== null).map((t) => [t.旧名, t.後継 as string] as const),
  )("%s の代わりが %s として実在する", (_旧名, 後継) => {
    expect(findTool(retiredCatalog, 後継), `${後継} がありません`).not.toBeNull();
  });

  it("代わりが無い行は、無いままであることを言い切る", () => {
    // 埋まっていない行を黙って消すと「移行済み」だけが残る。
    const 未移行 = RETIRED_TOOLS.filter((t) => t.後継 === null).map((t) => t.旧名);
    expect(未移行).toEqual(["record_conversion"]);
    // 成果を書き込む口が生えたら、この検査が落ちて表を直すことになる。
    const 書き込みの口 = retiredCatalog.filter(
      (t) => t.readOnly !== true && /conversion/.test(t.name),
    );
    expect(書き込みの口.map((t) => t.name)).toEqual(["adjust_conversion_reward"]);
  });
});
