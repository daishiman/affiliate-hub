/**
 * @tier 1
 * @req REQ-WC04, REQ-M03
 * @types decision-table
 *
 * **`readOnly` という 1 つの旗が、3 つの決定を兼ねていないこと。**
 *
 * 兼ねていた 3 つは次のとおりで、どれか 1 つのつもりで書いた値が残り 2 つに黙って効いた。
 *
 *   ① 外への申告        MCP の `readOnlyHint`（`mcp-adapter.ts`）
 *   ② 検査の対象        テナント分離を回す道具の選び方
 *   ③ WebMCP の掲載     `toWebMcpDescriptors` が誰を載せるか
 *
 * 実際に両方向で効いた。`export_manual_draft` は①のつもり（「投稿はしない」）で
 * `true` と書かれ、③が黙って効いて**記事の本文をページ内の AI へ渡していた。**
 * `false` へ直した瞬間に②から外れ、**検査対象から静かに消えた。**
 *
 * ここが見るのは値の正しさではなく、**3 つが独立に動くこと**である。
 * 1 つの旗を反転させて、変わってよい決定だけが変わることを実測する。
 * 「分けた」と書いただけでは、次に誰かが `readOnly` を根拠に戻したときに気づけない。
 *
 * `readOnly` が事実と合っているか（旗が嘘でないか）は
 * `readonly-honesty.test.ts` が実行で測る。ここは配線だけを見る。
 */
import { describe, expect, it } from "vitest";
import type { ActorContext } from "@/domain/shared";
import { createDeps } from "@/infrastructure/composition";
import { SAMPLE_ACTOR } from "@/infrastructure/identity/sample-actor";
import { buildToolCatalog } from "@/presentation/tools/catalog";
import { handleJsonRpc } from "@/presentation/tools/mcp-adapter";
import type { AnyToolDefinition } from "@/presentation/tools/tool-definition";
import { toWebMcpDescriptors } from "@/presentation/tools/webmcp-adapter";
import {
  PAGE_TOOLS,
  WEBMCP_LISTED_TOOLS,
  isListedOnWebMcp,
} from "@/presentation/tools/webmcp-policy";
import { validInputFor } from "./tool-inputs";

const OWNER: ActorContext = { ...SAMPLE_ACTOR, roles: ["owner", ...SAMPLE_ACTOR.roles] };
const catalog = buildToolCatalog(createDeps());

const findOrThrow = (name: string): AnyToolDefinition => {
  const tool = catalog.find((t) => t.name === name);
  if (tool === undefined) throw new Error(`${name} という道具がありません`);
  return tool;
};

/** 旗だけを反転した写し。他は 1 つも変えない。 */
const flipped = (tool: AnyToolDefinition): AnyToolDefinition => ({
  ...tool,
  readOnly: !tool.readOnly,
});

/** 表に載っている道具（③が「載せる」と言う側）。 */
const listedTool = findOrThrow(PAGE_TOOLS.article[0]!);
/** 読み取り専用を名乗るが、表には無い道具（旗を根拠にすると載っていた側）。 */
const unlistedReadOnly = catalog.find((t) => t.readOnly && !isListedOnWebMcp(t.name))!;

/** ②の対象の選び方。旗ではなく、**入力の見本があるか**で決まる。 */
const isInspected = (tool: AnyToolDefinition): boolean => validInputFor(tool) !== undefined;

describe("旗を 1 つ反転させても、変わる決定は 1 つだけ", () => {
  it("① 申告は変わる（ここが `readOnly` の持ち場）", async () => {
    const rpc = await handleJsonRpc(catalog, OWNER, { jsonrpc: "2.0", id: 1, method: "tools/list" });
    const hintOf = (list: unknown, name: string) =>
      (list as { tools: { name: string; annotations: { readOnlyHint: boolean } }[] }).tools.find(
        (t) => t.name === name,
      )?.annotations.readOnlyHint;
    expect(hintOf(rpc.result, listedTool.name)).toBe(listedTool.readOnly);

    // 旗を反転した写しで作り直すと、申告だけが反転する。
    const swapped = catalog.map((t) => (t.name === listedTool.name ? flipped(t) : t));
    const after = await handleJsonRpc(swapped, OWNER, { jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(hintOf(after.result, listedTool.name)).toBe(!listedTool.readOnly);
  });

  it("③ 掲載は変わらない（根拠は表であって旗ではない）", () => {
    // 載っている道具の旗を折っても、表にある限り載り続ける。
    const stillListed = toWebMcpDescriptors([flipped(listedTool)]);
    expect(stillListed.map((d) => d.name)).toEqual([listedTool.name]);

    // 逆向き。旗を立てても、表に無ければ載らない。
    expect(toWebMcpDescriptors([unlistedReadOnly])).toEqual([]);
    expect(toWebMcpDescriptors([flipped(unlistedReadOnly)])).toEqual([]);
  });

  it("② 検査の対象は変わらない（根拠は入力の見本）", () => {
    for (const tool of [listedTool, unlistedReadOnly]) {
      expect(isInspected(tool), tool.name).toBe(isInspected(flipped(tool)));
    }
  });
});

/*
 * **母数の床。値は数え上げた先から取らない。**
 *
 * 下の 3 件は「3 つの数が互いに違うこと」だけを見ている。大小の関係は、
 * 道具が 111 個から 3 個へ痩せても保たれる——つまり**この節は、見る対象が
 * 消えたことに気づけない。** `catalog.length > 0` は床の形をしているが、
 * 数える先と同じ `catalog` から取っているので `0 >= 0` と同じで、何も止めない。
 *
 * なのでリテラルで書く。`catalog` から取らないことがこの床の要点で、
 * 変数へ置き換えた瞬間に床の意味が消える。
 * 2026-08-21 の実測は 道具 111 / `readOnly` 83 / 表 14。
 * 痩せたら気づく程度に、実測の 1 割ほど下へ置く。増えるぶんには当たらない。
 */
const CATALOG_MIN = 100;
const DECLARED_READONLY_MIN = 70;
const LISTED_MIN = 10;

describe("3 つの根拠が、それぞれ別のものを数えている", () => {
  it("そもそも数えるだけの母数がある（痩せたら気づく）", () => {
    const declaredReadOnly = catalog.filter((t) => t.readOnly).length;
    const listed = catalog.filter((t) => isListedOnWebMcp(t.name)).length;
    expect(catalog.length, "道具の数が減っています。下の 3 件は大小しか見ないので、痩せても緑のままです").toBeGreaterThanOrEqual(CATALOG_MIN);
    expect(declaredReadOnly, "readOnly を名乗る道具が減っています").toBeGreaterThanOrEqual(DECLARED_READONLY_MIN);
    expect(listed, "WebMCP の表に載る道具が減っています").toBeGreaterThanOrEqual(LISTED_MIN);
  });

  /**
   * **数が違うことがそのまま「別の根拠である」ことの証拠になる。**
   *
   * 兼ねていた頃は、③の母数が①の母数とぴったり同じだった（同じ配列を絞っていたので当然）。
   * 2026-08-21 の実測: 道具 111 個、`readOnly` を名乗るもの 83 個、表にあるもの 14 個。
   * **差の 69 個は、旗を根拠にしていた間ずっと掲載の候補に入っていた。**
   */
  it("① の母数と ③ の母数が一致しない", () => {
    const declaredReadOnly = catalog.filter((t) => t.readOnly).length;
    const listed = catalog.filter((t) => isListedOnWebMcp(t.name)).length;
    expect(listed).toBeGreaterThan(0);
    expect(
      listed,
      `表にある道具（${listed}）と readOnly を名乗る道具（${declaredReadOnly}）の数が同じです。` +
        "掲載の根拠が旗へ戻っていないか見てください",
    ).toBeLessThan(declaredReadOnly);
  });

  it("② の母数は、① とも ③ とも違う", () => {
    const inspected = catalog.filter(isInspected).length;
    expect(inspected).toBeGreaterThan(catalog.filter((t) => t.readOnly).length);
    expect(inspected).toBeGreaterThan(WEBMCP_LISTED_TOOLS.size);
  });

  it("表に書き忘れた道具は載らない（既定は「載せない」側）", () => {
    // 旗が根拠だった頃、既定は「載せる」だった。読み取りの道具を 1 つ足すたびに、
    // ページ内の AI の手が届く範囲が黙って広がる。いまは書かなければ載らない。
    const notListed = catalog.filter((t) => !isListedOnWebMcp(t.name));
    expect(notListed.length, "対象が 0 件だと、この検査は何も見ていない").toBeGreaterThan(0);
    expect(toWebMcpDescriptors(notListed)).toEqual([]);
  });
});
