/**
 * @tier 2
 * @req REQ-BOPS09
 * @types screen-states, a11y
 */
// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { asPartOfPage, describeViolations, findA11yViolations } from "../support/a11y";

/**
 * 票 1 件を伏せる／戻す欄。
 *
 * --- なぜ描画検査だけでは足りないのか ---
 *
 * この部品は **1 つの実装が 2 つの欄を兼ねる**。`hidden` の真偽だけで
 * 送る業務語・釦の色・説明文・注意書きがまとめて反転する。片方しか描かない
 * 検査だと、反転を取り違えても緑のまま通る。実測（2026-08-31）では
 * 分岐 0%——**書いた日から一度も、伏せる側と戻す側の両方が描かれていない。**
 *
 * 取り違えの実害は非対称である。「戻す」つもりの操作が `hide` を送ると、
 * 読者に見えている票が消える。押した人には「戻しました」の画面が出る。
 *
 * 押した先で何が起きるかは `tests/presentation/blog-rating-actions.test.ts` が
 * 本物の道で見ている。ここで見るのは、送る形と出す言葉だけである。
 */

let actionState: Record<string, unknown> = { status: "idle", message: "" };

vi.mock("@/presentation/admin/publish/blog-rating-action", () => ({
  manageBlogRatingAction: async () => actionState,
}));

/**
 * `useActionState` は本来 form の送信で状態が入れ替わる。
 * ここでは初期状態を差し替えるだけでよいので、React の実物を使いつつ
 * 初期値だけを `actionState` から渡す。送信そのものは jsdom では起きない。
 */
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useActionState: () => [actionState, () => undefined, false],
  };
});

const { BlogRatingHideForm } = await import("@/presentation/admin/publish/blog-rating-form");

afterEach(() => {
  cleanup();
  actionState = { status: "idle", message: "" };
});

/** hidden の 2 値で、送る業務語ごと反転することを名前で押さえる。 */
function hiddenInput(name: string): HTMLInputElement | null {
  return document.querySelector(`input[name="${name}"]`);
}

describe("伏せる側（まだ読者に見えている票）", () => {
  it("`hide` を送り、理由の欄と危険色の釦を出す", () => {
    render(<BlogRatingHideForm articleId="bar_1" ratingId="rat_1" hidden={false} />);
    expect(hiddenInput("intent")?.value).toBe("hide");
    expect(hiddenInput("articleId")?.value).toBe("bar_1");
    expect(hiddenInput("ratingId")?.value).toBe("rat_1");
    expect(screen.getByLabelText(/伏せる理由/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "この評価を伏せる" })).toBeTruthy();
  });

  /**
   * 「消える」と誤解させない。行は残り、平均と件数から外れるだけである。
   * ここを「削除します」と書くと、取り消せない操作だと思われて使われなくなる。
   */
  it("票は消えないことを、押す前に書いておく", () => {
    render(<BlogRatingHideForm articleId="bar_1" ratingId="rat_1" hidden={false} />);
    expect(screen.getByText(/伏せても票は消えません/)).toBeTruthy();
  });
});

describe("戻す側（いま伏せてある票）", () => {
  it("`show` を送り、戻す側の言葉に入れ替わる", () => {
    render(<BlogRatingHideForm articleId="bar_1" ratingId="rat_1" hidden={true} />);
    expect(hiddenInput("intent")?.value).toBe("show");
    expect(screen.getByLabelText(/戻す理由/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "読者に見えるよう戻す" })).toBeTruthy();
    expect(screen.getByText(/平均と件数に入り直します/)).toBeTruthy();
  });
});

describe("断られたときの出し方", () => {
  /**
   * 理由が空で断られたら、**理由の欄のところに**出す。
   * 画面のいちばん下にだけ出すと、欄が複数ある画面ではどれが悪いか分からない。
   */
  it("理由の欄が原因なら、その欄に出す", () => {
    actionState = { status: "failed", message: "理由を書いてください。", field: "reason" };
    render(<BlogRatingHideForm articleId="bar_1" ratingId="rat_1" hidden={false} />);
    expect(screen.getAllByText("理由を書いてください。").length).toBeGreaterThan(0);
  });

  /** 別の欄が原因のときに、理由の欄へ巻き添えで赤を出さない。 */
  it("別の欄が原因なら、理由の欄は無傷のまま", () => {
    actionState = { status: "failed", message: "評価が見つかりません。", field: "ratingId" };
    render(<BlogRatingHideForm articleId="bar_1" ratingId="rat_1" hidden={false} />);
    const textarea = screen.getByLabelText(/伏せる理由/);
    expect(textarea.getAttribute("aria-invalid")).not.toBe("true");
  });
});

describe("使えるかどうか", () => {
  it.each([false, true])("hidden=%o でも支障が無い", async (hidden) => {
    const { container } = render(
      <BlogRatingHideForm articleId="bar_1" ratingId="rat_1" hidden={hidden} />,
    );
    const violations = await findA11yViolations(asPartOfPage(container.innerHTML));
    expect(violations, describeViolations(violations)).toHaveLength(0);
  });
});
