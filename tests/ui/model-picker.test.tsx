/** @tier 2 */
// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ModelPicker, type ModelPickerGroup } from "@/presentation/ui";

/**
 * どのモデルで書くかを選ぶ欄の見え方。
 *
 * --- なぜ描画まで見るのか ---
 * ここで固定したいのは「開いた直後に何が選ばれているか」である。
 * 組み立ての正しさ（どの提供元が選べるか）は
 * `tests/application/list-selectable-models.test.ts` が見ている。
 * それが正しくても、**同じ値の選択肢が 2 つあると初期選択が最後へ移る**
 * （単一選択の select では後の `selected` が勝つ、というブラウザの決まり）。
 * 実際に手元で動かして見つけた不具合なので、ここで固定する。
 *
 * @req REQ-G11
 * @types screen-states, boundary
 */

const groups: readonly ModelPickerGroup[] = [
  {
    providerId: "anthropic",
    label: "Anthropic",
    unavailableReason: null,
    models: [
      {
        modelId: "fast",
        label: "速いほう",
        inputPricePerMillionMinor: 450,
        outputPricePerMillionMinor: 2250,
        currency: "JPY",
      },
    ],
  },
  {
    providerId: "openai",
    label: "OpenAI",
    unavailableReason: "選べるモデルが設定されていません。",
    models: [],
  },
  {
    providerId: "workers_ai",
    label: "Workers AI",
    unavailableReason: "この提供元は枠として残してあるだけで、いまは使えません。",
    models: [],
  },
];

function renderPicker(overrides: { readonly emptyReason?: string | null } = {}) {
  return render(
    <ModelPicker
      action="/admin/generation"
      fieldName="model"
      separator="::"
      selected=""
      emptyReason={overrides.emptyReason ?? null}
      submitLabel="下書きを作る"
      groups={groups}
    />,
  );
}

afterEach(cleanup);

describe("開いた直後の姿", () => {
  it("選ばれているのは「選んでください」だけ", () => {
    const { container } = renderPicker();
    const select = container.querySelector("select");
    expect(select).not.toBeNull();
    // ここが本題。実際の選択位置を見る（属性ではなく、ブラウザが決めた結果）。
    expect(select?.value).toBe("");
    expect(select?.selectedOptions[0]?.textContent).toBe("選んでください");
  });

  it("空の値を持つ選択肢は 1 つだけ", () => {
    // 2 つ以上あると、上の「開いた直後」が静かに壊れる。
    const { container } = renderPicker();
    const empty = [...container.querySelectorAll("option")].filter((o) => o.value === "");
    expect(empty).toHaveLength(1);
  });

  it("既定のモデルを置かない（選ばずに送れない）", () => {
    const { container } = renderPicker();
    expect(container.querySelector("select")?.required).toBe(true);
  });
});

describe("選べないものの見え方", () => {
  it("選べない提供元も隠さず、理由を言葉で出す", () => {
    const { container } = renderPicker();
    const text = container.textContent ?? "";
    expect(text).toContain("OpenAI");
    expect(text).toContain("Workers AI");
    expect(text).toContain("選べるモデルが設定されていません。");
    expect(text).toContain("枠として残してある");
  });

  it("選べない提供元の選択肢は押せない", () => {
    const { container } = renderPicker();
    const groups = [...container.querySelectorAll("optgroup")];
    expect(groups.find((g) => g.label.startsWith("Anthropic"))?.disabled).toBe(false);
    expect(groups.find((g) => g.label.startsWith("OpenAI"))?.disabled).toBe(true);
  });

  it("単価は選ぶ時点で見える", () => {
    // 押したあとに出しても、高いほうを選んだと気づくのは請求のときになる。
    const { container } = renderPicker();
    expect(container.textContent).toContain("450");
    expect(container.textContent).toContain("2250");
  });
});

describe("1 つも選べないとき", () => {
  it("理由を出し、送信できないようにする", () => {
    const { container } = renderPicker({ emptyReason: "API キーがまだ登録されていません。" });
    expect(container.querySelector("select")?.disabled).toBe(true);
    expect(container.querySelector("button")?.disabled).toBe(true);
    expect(container.textContent).toContain("API キーがまだ登録されていません。");
  });
});
