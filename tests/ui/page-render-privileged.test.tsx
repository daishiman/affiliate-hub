/**
 * @tier 2
 * @req REQ-S10
 * @types screen-states
 *
 * **`permission-matrix` を名乗っていたが、外した。**
 *
 * ここが見ているのは「持ち主の身元で断られないこと」——**できる側だけ**である。
 * `permission-matrix`（できてはいけない側）という名前は、
 * 実際に見ているものの 2 倍を主張していた。
 * **片側しか見ていない検査に、両側を見たという名前が付いていた。**
 *
 * できない側は `page-render-restricted.test.tsx` が見る。
 * 名前を外しても、このファイルの中身は 1 行も減っていない。
 * 減ったのは**主張のほう**である。
 */
import { describe, expect, it, vi } from "vitest";
import { ADMIN_ROUTE_CASES, importPathOf, propsOf } from "./route-table";
import { renderRoute, textOf } from "../support/render";

/**
 * 運営側の画面を、**権限を持った身元**でもう一度描く。
 *
 * 2026-08-18 に見本の身元から書き込みの役をすべて外した
 * （`src/infrastructure/identity/sample-actor.ts`）。認証がまだ無く、
 * 管理画面は誰でも開けるため、見本に配った役は
 * 「アドレスを知っている人全員に配った役」と同じだったからである。
 *
 * その結果、既定の描画（`page-render.test.tsx`）は**断り側の見た目しか通らない**。
 * 権限のある人にだけ見える部分は、描かれないまま検査を素通りする。
 *
 * ここで見本へ役を足し戻して緑にするのは間違いである。それは製品の権限を
 * 緩めることであって、検査を足すことではない。**検査の側が役を名乗る。**
 *
 * 見ているのは 2 つだけにしてある。文言を固定すると、言い回しを直すたびに
 * 30 本落ちるテストができ、やがて消される。
 */

/** 持ち主の身元。画面が権限で分岐するところを、許可側から通す。 */
vi.mock("@/infrastructure/identity/sample-actor", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const sample = actual.SAMPLE_ACTOR as { roles: readonly string[] };
  return {
    ...actual,
    getCurrentActor: async () => ({ ...sample, roles: ["owner"] }),
  };
});

describe("権限を持った身元での描画", () => {
  it("運営側の画面が 1 枚以上ある（表が空になっていない）", () => {
    expect(ADMIN_ROUTE_CASES.length).toBeGreaterThan(20);
  });

  for (const route of ADMIN_ROUTE_CASES) {
    it(`${route.file} が権限のある人の側で描ける`, async () => {
      const html = await renderRoute(importPathOf(route.file), propsOf(route));
      const text = textOf(html);

      expect(text.trim(), `${route.file} が空です`).not.toBe("");
      // 持ち主で開いて断られるなら、権限の要求か案内の絞り込みが食い違っている。
      expect(text, `${route.file} が持ち主の身元で断られています`).not.toMatch(
        /権限がありません/,
      );
    });
  }
});
