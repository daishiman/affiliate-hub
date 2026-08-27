/**
 * @tier 2
 * @req REQ-UX02
 * @types screen-states, boundary
 *
 * 複数選べる欄。
 *
 * --- なぜ描画して押すところまで見るのか ---
 * この部品の肝は「押した順ではなく、**渡された並び順**で返す」こと。
 * 押した順に足していく実装（`[...selected, value]`）でも型は通り、
 * 1 つだけ押す試験なら同じ結果になる。**2 つ以上を逆順に押したときだけ**
 * 食い違い、保存された値の並びが押した順に化ける。
 *
 * もう 1 つは「選ばない」が有効な答えになり得ること。
 * だから「1 つ以上選んでください」は補足ではなく誤りとして出す必要があり、
 * 誤りは `role="alert"` で読み上げに届かなければ意味がない。
 */
// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CheckboxGroup } from "@/presentation/ui";

const OPTIONS = [
  { value: "blog", label: "ブログ" },
  { value: "x", label: "X" },
  { value: "note", label: "note" },
];

function open(over: Partial<Parameters<typeof CheckboxGroup>[0]> = {}) {
  const changes: (readonly string[])[] = [];
  const view = render(
    <CheckboxGroup
      name="channels"
      label="出し先"
      options={OPTIONS}
      selected={over.selected ?? []}
      onSelectedChange={(next) => changes.push(next)}
      {...over}
    />,
  );
  return { ...view, changes };
}

afterEach(cleanup);

describe("複数選べる欄", () => {
  it("押した順ではなく、渡された並び順で返す", () => {
    // すでに note が選ばれている状態で X を足す。押した順なら ["note","x"]。
    const { getByLabelText, changes } = open({ selected: ["note"] });
    fireEvent.click(getByLabelText("X"));

    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual(["x", "note"]);
  });

  it("選んであるものを押すと、それだけが外れる", () => {
    const { getByLabelText, changes } = open({ selected: ["blog", "note"] });
    fireEvent.click(getByLabelText("ブログ"));

    expect(changes[0]).toEqual(["note"]);
  });

  it("何も選ばない状態にできる", () => {
    // 「選ばない」が有効な答えなので、空配列を返せないと保存できなくなる。
    const { getByLabelText, changes } = open({ selected: ["x"] });
    fireEvent.click(getByLabelText("X"));

    expect(changes[0]).toEqual([]);
  });

  it("誤りは読み上げに届く形で出し、補足と混ぜない", () => {
    const { getByRole, getByText } = open({
      hint: "あとから変えられます。",
      error: "1 つ以上選んでください。",
    });

    expect(getByRole("alert").textContent).toContain("1 つ以上選んでください。");
    expect(getByText("あとから変えられます。")).toBeTruthy();
  });

  it("何についての選択肢かが、項目の前に読まれる形になっている", () => {
    // div + label だと項目名しか読まれない。fieldset + legend であることが要る。
    const { getByRole } = open({ optional: true });
    const group = getByRole("group", { name: /出し先/ });

    expect(group.tagName).toBe("FIELDSET");
    expect(group.textContent).toContain("任意");
  });
});
