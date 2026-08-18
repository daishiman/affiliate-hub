/**
 * @tier 2
 * @req REQ-IM09
 * @types screen-states, a11y
 */
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { describeViolations, findA11yViolations } from "../support/a11y";

/**
 * 改善ループを回す操作部品。
 *
 * --- なぜ画面の描画検査だけでは足りないのか ---
 *
 * `page-render.test.tsx` は画面が描けることしか見ない。**欄がまるごと消えても
 * 分量は足りるので緑のまま**である。実際、記録先の表も判定の式もそろっていて
 * 押す場所だけが無い状態が、誰にも気づかれずに残っていた。
 * ここでは「1 周に必要な操作が出ていること」を名前で見る。
 *
 * 押した先で何が起きるかは `tests/presentation/improvement-actions.test.ts` が
 * 本物の道で確かめている。両方で同じことを見ると、片方が必ず古くなる。
 *
 * --- 出さない側も見る ---
 *
 * できないことを薄く出して押させないのが、この画面の決まりである。
 * 観測値が無いのに「判定する」が出ていたら、押した人は毎回断られる。
 */

let draftResult: unknown = { status: "idle", message: "" };
let approveResult: unknown = { status: "idle", message: "" };
let startResult: unknown = { status: "idle", message: "" };
let advanceResult: unknown = { status: "idle", message: "" };

vi.mock("@/presentation/admin/improvement-action", () => ({
  draftVariantSpecAction: async () => draftResult,
  approveVariantSpecAction: async () => approveResult,
  startLoopRunAction: async () => startResult,
  advanceLoopRunAction: async () => advanceResult,
}));

const {
  AdvanceLoopRunForm,
  ApproveVariantSpecForm,
  DraftVariantSpecForm,
  StartLoopRunForm,
} = await import("@/presentation/admin/improvement-forms");

const DIMENSIONS = [
  { value: "section_order", label: "記事の中身／並べる順番" },
  { value: "lead_length", label: "記事の中身／書き出しの長さ" },
];
const SPECS = [
  { value: "spec_baseline", label: "現行（比べるもと）" },
  { value: "spec_compare_first", label: "比較表を先に出す" },
];
const METRICS = [{ value: "read_completion_rate", label: "読み終えた割合" }];

afterEach(cleanup);

beforeEach(() => {
  draftResult = { status: "idle", message: "" };
  approveResult = { status: "idle", message: "" };
  startResult = { status: "idle", message: "" };
  advanceResult = { status: "idle", message: "" };
});

async function submit(container: HTMLElement): Promise<void> {
  const form = container.querySelector("form");
  if (form === null) throw new Error("囲いが見つかりませんでした");
  await act(async () => {
    fireEvent.submit(form);
  });
}

describe("試作を登録する欄", () => {
  it("同時に変えられる数だけ欄が出る（上限より多く書かせない）", () => {
    render(
      <DraftVariantSpecForm siteSlug="video-editing-gear" dimensions={DIMENSIONS} maxSimultaneous={2} />,
    );

    expect(screen.getAllByRole("combobox", { name: /変えるもの/ })).toHaveLength(2);
    expect(screen.getByRole("button", { name: /試作を登録する/ })).toBeTruthy();
  });

  it("軸の選択肢は渡されたものがそのまま出る（画面に書き起こさない）", () => {
    render(
      <DraftVariantSpecForm siteSlug="video-editing-gear" dimensions={DIMENSIONS} maxSimultaneous={2} />,
    );

    expect(screen.getAllByRole("option", { name: "記事の中身／並べる順番" }).length).toBeGreaterThan(0);
  });

  it("登録できたことも、断られたことも文面で出る", async () => {
    draftResult = { status: "done", message: "試作を登録しました。次は承認です。" };
    const done = render(
      <DraftVariantSpecForm siteSlug="video-editing-gear" dimensions={DIMENSIONS} maxSimultaneous={2} />,
    );
    await submit(done.container);
    expect(screen.getByText(/次は承認です/)).toBeTruthy();

    cleanup();
    draftResult = { status: "failed", message: "この軸は数字で決めます。" };
    const failed = render(
      <DraftVariantSpecForm siteSlug="video-editing-gear" dimensions={DIMENSIONS} maxSimultaneous={2} />,
    );
    await submit(failed.container);
    expect(screen.getByText(/数字で決めます/)).toBeTruthy();
  });
});

describe("承認する欄", () => {
  it("承認待ちが無いときは、欄ではなくその旨が出る", () => {
    render(<ApproveVariantSpecForm siteSlug="video-editing-gear" pendingSpecs={[]} />);

    expect(screen.getByText(/承認を待っている試作はありません/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /承認する/ })).toBeNull();
  });

  it("承認待ちがあるときだけ、承認のボタンが出る", () => {
    render(<ApproveVariantSpecForm siteSlug="video-editing-gear" pendingSpecs={SPECS} />);

    expect(screen.getByRole("button", { name: /承認する/ })).toBeTruthy();
  });
});

describe("比較を始める欄", () => {
  it("承認済みが 2 つ無いと始められない理由が出る", () => {
    render(
      <StartLoopRunForm
        siteSlug="video-editing-gear"
        approvedSpecs={[SPECS[0]]}
        metrics={METRICS}
        defaultMinimumSamples={200}
      />,
    );

    expect(screen.getByText(/承認済みの試作が 2 つ要ります/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /この比較を始める/ })).toBeNull();
  });

  it("判定に必要な件数は、既定値がそのまま欄に入っている", () => {
    render(
      <StartLoopRunForm
        siteSlug="video-editing-gear"
        approvedSpecs={SPECS}
        metrics={METRICS}
        defaultMinimumSamples={200}
      />,
    );

    const field = screen.getByRole("textbox", { name: /判定に必要な件数/ }) as HTMLInputElement;
    // 別の場所に「既定は 200 です」と書いて空欄にすると、
    // 手で 0 と書かれたときに「既定のまま」と見分けられなくなる。
    expect(field.value).toBe("200");
  });
});

describe("実施中の比較に対する操作", () => {
  it("観測値を書く前は「判定する」を出さない", () => {
    render(<AdvanceLoopRunForm runId="run_body_width" running hasObservation={false} />);

    expect(screen.getByRole("button", { name: /観測値を書く/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /判定する/ })).toBeNull();
    expect(screen.getByText(/観測値を書くと判定できます/)).toBeTruthy();
  });

  it("観測値があれば「判定する」が出る", () => {
    render(<AdvanceLoopRunForm runId="run_body_width" running hasObservation />);

    expect(screen.getByRole("button", { name: /判定する/ })).toBeTruthy();
  });

  it("終わった比較には、観測も判定も打ち切りも出さない", () => {
    render(<AdvanceLoopRunForm runId="run_section_order" running={false} hasObservation />);

    expect(screen.getByText(/もう終わっています/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("押した後に返ってきた理由が、そのまま画面に出る", async () => {
    advanceResult = {
      status: "failed",
      message: "件数が足りないため、まだ差があるとは言えません。",
    };
    const { container } = render(
      <AdvanceLoopRunForm runId="run_body_width" running hasObservation />,
    );
    await submit(container);

    expect(screen.getByText(/まだ差があるとは言えません/)).toBeTruthy();
  });
});

describe("読み上げと操作の自動検査", () => {
  it("1 周に必要な 4 つの欄すべてに違反がない", async () => {
    const { container } = render(
      <>
        <DraftVariantSpecForm
          siteSlug="video-editing-gear"
          dimensions={DIMENSIONS}
          maxSimultaneous={2}
        />
        <ApproveVariantSpecForm siteSlug="video-editing-gear" pendingSpecs={SPECS} />
        <StartLoopRunForm
          siteSlug="video-editing-gear"
          approvedSpecs={SPECS}
          metrics={METRICS}
          defaultMinimumSamples={200}
        />
        <AdvanceLoopRunForm runId="run_body_width" running hasObservation />
      </>,
    );

    const violations = await findA11yViolations(container.innerHTML);
    expect(violations, describeViolations(violations)).toEqual([]);
  });
});
