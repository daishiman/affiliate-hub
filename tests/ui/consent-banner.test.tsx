/**
 * @tier 2
 * @req REQ-TM07
 * @types decision-table, equivalence
 *
 * 同意の聞き方。
 *
 * 要件は 2 つある。**3 つの状態すべてで読者に見えていること**と、
 * **断りにくくしていないこと**（片方のボタンだけ目立たせない＝ダークパターン）。
 *
 * ここを足した理由。2026-08-21 に測ったところ、
 *   - 「断った人」にだけ何も出さないようにしても緑
 *   - 「記録してよい」だけを目立つ見た目に変えても緑
 * だった。追跡表の判定欄は「3 状態すべてに表示あり」と書いてあったが、
 * **この部品を描いている検査が 1 つも無かった。**
 *
 * 断った人への表示を落とすと、取り消す手段まで一緒に消える。
 * 「いつでも取り消せます」と説明しているのに戻れない状態になるので、
 * ここは 3 状態を並べて見る。
 */
// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ConsentAnswer } from "@/presentation/ui/consent";
import { ConsentBanner } from "@/presentation/ui/patterns/consent-banner";

const DETAIL = "/s/blog-a/measurement";

function draw(current: ConsentAnswer) {
  render(<ConsentBanner current={current} detailHref={DETAIL} />);
}

// 前の描画を残さない。残すと「何も出さない実装」が
// 1 つ前の表示で緑になり、この検査が何も見なくなる。
afterEach(cleanup);

/** 3 つの状態。**1 つも欠かさず回す。** */
const STATES: readonly ConsentAnswer[] = ["unset", "granted", "denied"];

describe("3 つの状態すべてで、読者に見えている", () => {
  it.each(STATES)("%s のとき、いまの扱いが画面に出ている", (state) => {
    draw(state);
    // 何も描かない実装にすると、ここで body が空になって落ちる。
    expect(document.body.textContent?.trim(), `${state} のとき何も表示されていません`).not.toBe("");
  });

  it.each(STATES)("%s のとき、詳しい説明への入口がある", (state) => {
    draw(state);
    const links = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(links, `${state} のとき説明ページへ行けません`).toContain(DETAIL);
  });

  it.each(["granted", "denied"] as const)("%s のとき、選び直す口がある", (state) => {
    draw(state);
    // 取り消せない同意は同意ではない。**答えたあとも必ず戻れる。**
    expect(screen.getAllByRole("button").length, `${state} から選び直せません`).toBeGreaterThan(0);
  });

  it("答えたあとは、いまどちらなのかが読んで分かる", () => {
    draw("denied");
    expect(document.body.textContent).toContain("行っていません");
  });
});

describe("断りにくくしない", () => {
  it("まだ聞いていない人には、許可と拒否の両方を出す", () => {
    draw("unset");
    const names = screen.getAllByRole("button").map((b) => b.textContent);
    expect(names).toContain("記録しない");
    expect(names).toContain("記録してよい");
  });

  it("2 つのボタンの目立ち方が揃っている", () => {
    // 片方だけ強い見た目にするのがダークパターン。
    // 見た目の差は class に出る（`tests/ui/zz-probe-tone.test.tsx` で担保）。
    draw("unset");
    const deny = screen.getByRole("button", { name: "記録しない" });
    const allow = screen.getByRole("button", { name: "記録してよい" });
    expect(
      allow.className,
      "「記録してよい」だけ目立たせています。断る側と同じ見た目にしてください。",
    ).toBe(deny.className);
  });

  it("断る側が先に置かれている", () => {
    // 押しやすい位置を許可側に取らせない。
    draw("unset");
    const names = screen.getAllByRole("button").map((b) => b.textContent);
    expect(names.indexOf("記録しない")).toBeLessThan(names.indexOf("記録してよい"));
  });
});
