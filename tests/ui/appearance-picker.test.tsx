/**
 * @tier 2
 * @req REQ-TH03
 * @types equivalence, decision-table, screen-states
 *
 * 見た目（配色 × 明暗）を選ぶ欄。
 *
 * --- なぜ描画して押すところまで見るのか ---
 * この部品は React の状態でテーマを持ち回さず、**一番外側の要素の属性を
 * 直接書き換える**。組み立てを読むだけでは「属性が変わったか」が分からない。
 * さらに `auto`（端末の設定に従う）だけは**属性を出さないことが意味**になっており、
 * 空文字を入れる実装に静かに変わっても、型検査も lint も気づかない。
 *
 * 配色の一覧はここに無く、渡してもらう（`REQ-TH03`）。
 * その線が守られていることも、渡さなければ欄が出ないという形で見る。
 */
// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { APPEARANCE_ATTR, AppearancePicker } from "@/presentation/ui";

const SCHEMES = [
  { value: "slate", label: "落ち着いた青" },
  { value: "amber", label: "あたたかい橙" },
] as const;

const MODES = [
  { value: "auto", label: "端末の設定に合わせる" },
  { value: "light", label: "明るい" },
  { value: "dark", label: "暗い" },
] as const;

function open(
  current = { brandTheme: "slate", colorMode: "auto" },
  withSchemes = true,
) {
  return render(
    <AppearancePicker
      current={current}
      schemeOptions={withSchemes ? SCHEMES : undefined}
      modeOptions={MODES}
      description="選んだ見た目は、この端末だけで覚えます。"
    />,
  );
}

/** 「配色」「明るさ」の見出しから、その欄の select を引く。 */
function fieldOf(container: HTMLElement, label: string): HTMLSelectElement {
  const found = [...container.querySelectorAll("select")].find((s) =>
    (s.closest("label") ?? s.parentElement)?.textContent?.includes(label),
  );
  if (found === undefined) throw new Error(`「${label}」の欄がありません`);
  return found;
}

beforeEach(() => {
  document.cookie = "ah_theme=; path=/; max-age=0";
  document.cookie = "ah_mode=; path=/; max-age=0";
  for (const attr of Object.values(APPEARANCE_ATTR)) {
    document.documentElement.removeAttribute(attr);
  }
});
afterEach(cleanup);

describe("どの軸を出すか", () => {
  it("配色を渡した画面（管理画面）では、2 つとも選べる", () => {
    const { container } = open();
    expect(container.querySelectorAll("select")).toHaveLength(2);
  });

  it("配色を渡さない画面（読者側）では、明るさだけになる", () => {
    // 配色はブログが決めたブランドなので、読者に選ばせない。
    const { container } = open(undefined, false);
    const selects = [...container.querySelectorAll("select")];
    expect(selects).toHaveLength(1);
    expect(container.textContent).not.toContain("配色");
  });

  it("説明を渡せば、欄の上に出す", () => {
    const { container } = open();
    expect(container.textContent).toContain("この端末だけで覚えます");
  });

  it("見出しは既定で「画面の見た目」", () => {
    const { container } = open();
    expect(container.querySelector("legend")?.textContent).toBe("画面の見た目");
  });
});

describe("選んだ瞬間に何が起きるか", () => {
  it("明るさを選ぶと、一番外側の属性がその場で変わる", () => {
    const { container } = open();
    fireEvent.change(fieldOf(container, "明るさ"), { target: { value: "dark" } });

    expect(document.documentElement.getAttribute(APPEARANCE_ATTR.mode)).toBe("dark");
  });

  it("端末の設定に合わせるを選ぶと、明暗の属性は消える", () => {
    const { container } = open({ brandTheme: "slate", colorMode: "dark" });
    fireEvent.change(fieldOf(container, "明るさ"), { target: { value: "auto" } });

    // 空文字を残さない。残すと、当たらない属性が付いたままになり、
    // 後から見て「なぜ端末の設定に従っているのか」が読めなくなる。
    expect(document.documentElement.hasAttribute(APPEARANCE_ATTR.mode)).toBe(false);
  });

  it("配色を選ぶと、明暗はそのままで配色だけ変わる", () => {
    const { container } = open({ brandTheme: "slate", colorMode: "dark" });
    fireEvent.change(fieldOf(container, "明るさ"), { target: { value: "light" } });
    fireEvent.change(fieldOf(container, "配色"), { target: { value: "amber" } });

    expect(document.documentElement.getAttribute(APPEARANCE_ATTR.scheme)).toBe("amber");
    expect(document.documentElement.getAttribute(APPEARANCE_ATTR.mode)).toBe("light");
  });

  it("選んだ値は欄にも残る（押した直後に元へ戻らない）", () => {
    const { container } = open();
    fireEvent.change(fieldOf(container, "配色"), { target: { value: "amber" } });

    expect(fieldOf(container, "配色").value).toBe("amber");
  });
});

describe("次に開いたときも同じ見た目にする", () => {
  it.each([
    ["配色", "amber", "ah_theme"],
    ["明るさ", "dark", "ah_mode"],
  ] as const)("%sの選択を cookie に書き留める", (label, value, cookieName) => {
    const { container } = open();
    fireEvent.change(fieldOf(container, label), { target: { value } });

    expect(document.cookie).toContain(`${cookieName}=${value}`);
  });
});

describe("渡していない選択肢は当てない", () => {
  it.each(["配色", "明るさ"] as const)("%sに知らない値が来ても、無視する", (label) => {
    const { container } = open();
    const field = fieldOf(container, label);
    // 選択肢に無い値を入れると、select の値は空文字になる。
    // ここで素通しすると、themes.css に無い名前が属性へ入り、
    // どの配色にも当たらない「色が抜けた画面」ができる。
    fireEvent.change(field, { target: { value: "みたことのない値" } });

    expect(document.documentElement.hasAttribute(APPEARANCE_ATTR.scheme)).toBe(false);
    expect(document.cookie).not.toContain("みたことのない値");
  });
});
