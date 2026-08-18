/**
 * @tier 2
 * @req REQ-P01, REQ-P02, REQ-P03, REQ-P04, REQ-P05
 * @req REQ-P06, REQ-P07, REQ-P08, REQ-P09, REQ-P10
 * @req REQ-TH01, REQ-SEC08
 * @req REQ-B01, REQ-B02, REQ-B03, REQ-B04, REQ-B05, REQ-B06
 * @req REQ-B07, REQ-B08, REQ-B09, REQ-B10, REQ-B11, REQ-B12
 * @req REQ-B13, REQ-B14, REQ-B15, REQ-B16, REQ-B17, REQ-B18
 * @req REQ-S01, REQ-S02, REQ-S03, REQ-S04, REQ-S05
 * @req REQ-S06, REQ-S07, REQ-S08, REQ-S09, REQ-S10
 * @types keyboard
 */
import { describe, expect, it } from "vitest";
import { ROUTE_CASES, ROUTE_STATE_CASES, importPathOf, propsOf } from "./route-table";
import { focusableOrder, intoDom, renderRoute } from "../support/render";

/**
 * キーボードだけで画面を操作できるか。
 *
 * --- なぜこれを機械で見るのか ---
 *
 * マウスで押せることは、作った本人が必ず 1 回は試す。
 * **キーボードだけで辿れることは、誰も試さない。**
 * だから壊れるのはいつもこちら側で、しかも画面を見ても分からない。
 *
 * 壊れ方は 3 つに決まっている。
 *
 *   1. `tabindex="3"` のように**順番を手で決める**
 *      → 書いてある順と移動する順がずれる。1 つ足すたびに全部ずれる
 *   2. `<div onClick>` で押せるものを作る
 *      → マウスでは押せるが、Tab では**存在しない**。読み上げにも出ない
 *   3. 辿り着けるが**名前が無い**
 *      → 「ボタン」とだけ読み上げられる。何のボタンか分からないまま押すことになる
 *
 * どれも 1 画面ずつ手で確かめると必ず抜ける（抜けるのはいつも新しい画面）。
 * そこで `route-table.ts` の一覧から**全画面を回す**。画面を足した時点で対象に入る。
 *
 * --- ここで見ていないこと（正直に書く） ---
 *
 * 実際に Tab キーを押して移動させてはいない。移動先は
 * 「書いてある順・`tabindex` の値・要素の種類」で決まるので、
 * **その 3 つが正しければ移動順も正しい**という前提でここを見ている。
 * 押した結果どうなるか（フォーカスが戻る、閉じると呼び出し元へ返る）は
 * 部品側の検査（`tests/ui/feedback-button.test.tsx` など）で見る。
 *
 * 規範: docs/product/traceability.md REQ-TH01 / docs/spec/10-テスト戦略仕様.md §14
 */

/** 押せる見た目を持つのに、素の要素ではないもの。 */
const OPERABLE_ROLES = ["button", "link", "tab", "checkbox", "switch", "menuitem"];

/** 素のままキーボードで辿れる要素。 */
const NATIVELY_FOCUSABLE = ["a", "button", "input", "select", "textarea"];

const ALL_ROUTES = [
  ...ROUTE_CASES.map((r) => ({ ...r, state: "既定の表示" })),
  ...ROUTE_STATE_CASES,
];

async function domOf(route: (typeof ALL_ROUTES)[number]) {
  const html = await renderRoute(importPathOf(route.file), propsOf(route));
  return intoDom(html);
}

describe("順番を手で決めていない", () => {
  for (const route of ALL_ROUTES) {
    it(`${route.file}（${route.state}）`, async () => {
      const { document, cleanup } = await domOf(route);
      // 正の値を 1 つ置くと、その要素だけが全体の先頭へ割り込む。
      // 「画面の途中にある入力欄に、最初に飛ぶ」という直しにくい壊れ方になる。
      const forced = [...document.querySelectorAll("[tabindex]")]
        .map((el) => ({ tag: el.tagName.toLowerCase(), value: el.getAttribute("tabindex") ?? "" }))
        .filter((x) => Number(x.value) > 0);
      cleanup();
      expect(forced, "tabindex に正の値を置かない（順番は書いてある順で決める）").toEqual([]);
    });
  }
});

describe("押せるものは、辿り着ける", () => {
  for (const route of ALL_ROUTES) {
    it(`${route.file}（${route.state}）`, async () => {
      const { document, cleanup } = await domOf(route);

      // 役割だけ「押せる」と名乗って、素の要素でも `tabindex="0"` でもないもの。
      // マウスからは押せて、キーボードからは存在しないことになる。
      const unreachable = [...document.querySelectorAll(OPERABLE_ROLES.map((r) => `[role=${r}]`).join(","))]
        .filter((el) => {
          const tag = el.tagName.toLowerCase();
          if (NATIVELY_FOCUSABLE.includes(tag) && !el.hasAttribute("disabled")) return false;
          return el.getAttribute("tabindex") !== "0";
        })
        .map((el) => `${el.tagName.toLowerCase()}[role=${el.getAttribute("role")}]`);

      // 素の操作部品を `-1` で順路から外すと、見えているのに辿り着けない。
      const removed = [...document.querySelectorAll(NATIVELY_FOCUSABLE.join(","))]
        .filter((el) => el.getAttribute("tabindex") === "-1")
        .filter((el) => !(el.tagName.toLowerCase() === "input" && el.getAttribute("type") === "hidden"))
        .map((el) => `${el.tagName.toLowerCase()}:${(el.textContent ?? "").trim().slice(0, 20)}`);

      cleanup();
      expect(unreachable, "押せると名乗るなら、キーボードからも辿り着ける形にする").toEqual([]);
      expect(removed, "見えている操作部品を順路から外さない").toEqual([]);
    });
  }
});

describe("辿り着いたとき、それが何かが分かる", () => {
  for (const route of ALL_ROUTES) {
    it(`${route.file}（${route.state}）`, async () => {
      const { document, cleanup } = await domOf(route);
      // `focusableOrder` は名前が取れないと要素名（`input` など）だけを返す。
      // それは「ここに何かある」以上のことを読み上げられない状態である。
      const nameless = focusableOrder(document).filter((entry) => {
        const [tag, label] = entry.split(":");
        return label === undefined || label === tag;
      });
      cleanup();
      expect(nameless, "辿れる要素には、読み上げられる名前を必ず付ける").toEqual([]);
    });
  }
});
