/**
 * @tier 1
 * @req REQ-WC01, REQ-WC02
 * @types state-transition, equivalence, decision-table
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
 * REQ-WC01 は 2026-08-18 に宣言した。性質は `has-enumerated-input`
 * （入力の軸がすべて列挙で、大小の端が無い）で、必須は等価分割と判定表。
 * `has-input` を名乗って `boundary` を除外する形にしなかったのは、
 * 列挙で本当に困るのが端ではなく**数え落とし**だからである。
 * 実際、判定表にそろえたときに 4 行のうち 1 行（新しい経路だけがある）が
 * 抜けていた。実装は正しかったが、**壊れても落ちない**状態だった。
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

  /*
    条件は 2 つ（新しい経路があるか / 旧経路があるか）で、組合せは 4 通り。
    **表にして 4 行そろえてある。**

    そろえる前は 3 行しか無く、「新しい経路だけがある」が抜けていた。
    抜けている行は、1 つずつ書いていると気づけない。3 つ書けば
    書いた側は網羅した気になり、読む側も 3 つ並んでいれば足りて見える。
    行数を数える下の検査が、増えた条件に気づくための唯一の手である。
  */
  const CASES = [
    { 新: true, 旧: true, 期待: "新", なぜ: "非推奨が外れた日に黙って止まらないよう、新を先に見る" },
    { 新: true, 旧: false, 期待: "新", なぜ: "旧が無くても新だけで成立する" },
    { 新: false, 旧: true, 期待: "旧", なぜ: "まだ新に対応していないブラウザを切り捨てない" },
    { 新: false, 旧: false, 期待: "無し", なぜ: "対応していない環境では何もしない" },
  ] as const;

  it("条件 2 つの組合せ 4 通りが、1 行も欠けずに並んでいる", () => {
    expect(CASES.length).toBe(2 ** 2);
    expect(new Set(CASES.map((c) => `${c.新}/${c.旧}`)).size).toBe(CASES.length);
  });

  it.each(CASES.map((c) => [`新=${c.新} 旧=${c.旧} → ${c.期待}（${c.なぜ}）`, c] as const))(
    "%s",
    (_name, c) => {
      const got = resolveModelContext(
        c.新 ? { modelContext: newer } : {},
        c.旧 ? { modelContext: older } : {},
      );
      const expected = c.期待 === "新" ? newer : c.期待 === "旧" ? older : undefined;
      expect(got).toBe(expected);
    },
  );

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
