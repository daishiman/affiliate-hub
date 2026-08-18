/**
 * @tier 1
 * @req REQ-WC02
 * @types state-transition, equivalence
 *
 * ページ内 AI への登録そのものを確かめる。
 *
 * ここまで、`resolveModelContext()` と `registerWebMcpTools()` には検査が
 * 1 つも無かった。どちらも React の部品の中にあり、画面を描かないと
 * 触れなかったためである。`resolveModelContext()` を
 * `webmcp-adapter.ts` へ移し、登録先を引数で渡せるようにして届くようにした。
 *
 * 見ているのは 2 つ。
 *   REQ-WC01  正規の経路（`document.modelContext`）を先に見ること
 *   REQ-WC02  対応していない環境では**何もしない**こと、および
 *             登録した後に必ず元へ戻せること（未登録 → 登録済み → 解除）
 *
 * REQ-WC01 は宣言表にまだ載せていない。`has-input` を名乗ると `boundary` が
 * 要るが、登録先は「新しい経路 / 旧経路 / 無し」の 3 通りで大小の端が無く、
 * 理由つき除外の枠（上限 11・使用 10）が足りない。
 * 事情は `docs/product/required-test-types.md` §4 に書いた。
 * 宣言が無くても、この検査は今日から効く。
 */
import { describe, expect, it } from "vitest";
import {
  registerWebMcpTools,
  resolveModelContext,
  type ModelContextLike,
  type WebMcpTool,
} from "@/presentation/tools/webmcp-adapter";

function aTool(name: string): WebMcpTool {
  return {
    name,
    description: `${name} の説明`,
    inputSchema: { type: "object", properties: {} },
    execute: async () => ({ content: [{ type: "text", text: "ok" }] }),
  };
}

/** 呼ばれた中身を残す登録先。`provideContext` を持つ実装。 */
function contextRecorder() {
  const calls: WebMcpTool[][] = [];
  const modelContext: ModelContextLike = {
    provideContext: ({ tools }) => {
      calls.push(tools);
    },
  };
  return { modelContext, calls };
}

/** 1 件ずつ登録する古い形の実装。解除の関数を返す。 */
function toolRecorder() {
  const registered: string[] = [];
  const modelContext: ModelContextLike = {
    registerTool: (tool) => {
      registered.push(tool.name);
      return () => {
        const at = registered.indexOf(tool.name);
        if (at >= 0) registered.splice(at, 1);
      };
    },
  };
  return { modelContext, registered };
}

describe("登録先の選び方", () => {
  const newer: ModelContextLike = { provideContext: () => {} };
  const older: ModelContextLike = { registerTool: () => {} };

  it("両方あるときは、新しい経路を使う", () => {
    // 逆にすると、新しいブラウザでも旧経路に載り続け、
    // 非推奨が外れた日に**黙って**止まる。落ちないので気づけない。
    expect(resolveModelContext({ modelContext: newer }, { modelContext: older })).toBe(newer);
  });

  it("新しい経路が無ければ、旧経路に落ちる", () => {
    expect(resolveModelContext({}, { modelContext: older })).toBe(older);
  });

  it("どちらも無ければ、登録先は無し", () => {
    expect(resolveModelContext({}, {})).toBeUndefined();
  });

  it("そもそも document も navigator も無い場所でも、例外を投げない", () => {
    // サーバー側で読み込まれることがある。ここで投げると画面ごと落ちる。
    expect(resolveModelContext(undefined, undefined)).toBeUndefined();
  });
});

describe("対応していない環境では何もしない", () => {
  it("登録先が無ければ、何も起きず、解除も安全に呼べる", () => {
    const undo = registerWebMcpTools(undefined, [aTool("reader_list_rankings")]);
    expect(typeof undo).toBe("function");
    expect(() => undo()).not.toThrow();
  });

  it("登録の関数をどちらも持たない登録先でも、何も起きない", () => {
    const undo = registerWebMcpTools({}, [aTool("reader_list_rankings")]);
    expect(() => undo()).not.toThrow();
  });
});

describe("登録してから、元へ戻せる", () => {
  it("まとめて渡す形: 登録すると渡り、解除すると空になる", () => {
    const { modelContext, calls } = contextRecorder();
    const tools = [aTool("reader_list_rankings"), aTool("reader_get_product")];

    // 未登録
    expect(calls).toHaveLength(0);

    const undo = registerWebMcpTools(modelContext, tools);
    // 登録済み
    expect(calls).toHaveLength(1);
    expect(calls[0]?.map((t) => t.name)).toEqual(["reader_list_rankings", "reader_get_product"]);

    undo();
    // 解除後。**空を渡し直す**ところまでやらないと、ページを離れた後も
    // 前のページの道具が AI から見えたままになる。
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual([]);
  });

  it("1 件ずつ渡す形: 登録した数だけ、解除で消える", () => {
    const { modelContext, registered } = toolRecorder();
    const undo = registerWebMcpTools(modelContext, [
      aTool("reader_list_rankings"),
      aTool("reader_get_product"),
    ]);

    expect(registered).toEqual(["reader_list_rankings", "reader_get_product"]);

    undo();
    expect(registered).toEqual([]);
  });

  it("解除の関数を返さない実装でも、解除で落ちない", () => {
    const modelContext: ModelContextLike = { registerTool: () => undefined };
    const undo = registerWebMcpTools(modelContext, [aTool("reader_list_rankings")]);
    expect(() => undo()).not.toThrow();
  });
});
