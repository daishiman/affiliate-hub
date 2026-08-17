/** @tier 2 */
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ANNOTATION_COLORS,
  ANNOTATION_TOOLS,
  ANNOTATION_TOOL_LABELS,
  ANNOTATION_COLOR_LABELS,
} from "@/domain/feedback/capture-policy";
import { UI_COPY } from "@/presentation/ui/copy";
import { CANVAS_COLORS, CANVAS_TOOLS, CaptureCanvas } from "@/presentation/ui/patterns/capture-canvas";

/**
 * 印を付ける台紙。
 *
 * --- 書き写しがずれないことを見る ---
 *
 * 共有 UI は domain を読まない決まりなので、道具と色の一覧は台紙側に書き写してある。
 * 書き写しは必ずずれる。**ずれた瞬間に落ちる**ようにここで突き合わせておく。
 * 検査は両方を読めるので、ここが突き合わせの置き場所として正しい。
 *
 * --- 黒塗りの色を選ばせない ---
 *
 * 薄い色で塗ると隠れない。選べるように見せること自体が誤りなので、
 * 「選ばせていない」ことを画面の出力で見る。
 */

afterEach(cleanup);

type Mounted = {
  /** `onExport` に渡ってきたもの。付けなかった場合は空のまま。 */
  readonly exported: { count: number; redactionCount: number | null; type: string | null };
  readonly retake: { count: number };
  readonly drop: { count: number };
  readonly container: HTMLElement;
};

function mount(): Mounted {
  const exported = { count: 0, redactionCount: null as number | null, type: null as string | null };
  const retake = { count: 0 };
  const drop = { count: 0 };
  const { container } = render(
    <CaptureCanvas
      source="data:image/png;base64,iVBORw0KGgo="
      maskedElementCount={2}
      onExport={(capture) => {
        exported.count += 1;
        exported.redactionCount = capture.redactionCount;
        exported.type = capture.blob.type;
      }}
      onRetake={() => {
        retake.count += 1;
      }}
      onDrop={() => {
        drop.count += 1;
      }}
    />,
  );
  return { exported, retake, drop, container };
}

describe("domain の決まりとの一致", () => {
  it("道具の一覧と並びが domain と同じ", () => {
    expect(CANVAS_TOOLS).toEqual(ANNOTATION_TOOLS);
  });

  it("色の一覧と並びが domain と同じ", () => {
    expect(CANVAS_COLORS).toEqual(ANNOTATION_COLORS);
  });

  it("画面に出す道具名・色名が domain の言い方と同じ", () => {
    for (const tool of ANNOTATION_TOOLS) {
      expect(Object.values(UI_COPY.feedback)).toContain(ANNOTATION_TOOL_LABELS[tool]);
    }
    for (const color of ANNOTATION_COLORS) {
      expect(Object.values(UI_COPY.feedback)).toContain(ANNOTATION_COLOR_LABELS[color]);
    }
  });
});

describe("黒塗り", () => {
  it("黒塗りを選ぶと、色の選択そのものが消える", () => {
    mount();
    // 最初は色を選べる（手書き）。
    expect(screen.queryByRole("button", { name: UI_COPY.feedback.colorRed })).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: UI_COPY.feedback.toolRedact }));
    // 薄い色で塗れると誤解させないため、選択肢ごと出さない。
    expect(screen.queryByRole("button", { name: UI_COPY.feedback.colorRed })).toBeNull();
  });

  it("焼き込むことと、写るのは開いている部分だけであることを先に伝える", () => {
    mount();
    expect(screen.getByText(UI_COPY.feedback.captureRedactHint)).not.toBeNull();
    expect(screen.getByText(new RegExp(UI_COPY.feedback.captureIncomplete))).not.toBeNull();
  });
});

describe("逃げ道", () => {
  it("元に戻す・撮り直す・画像を外す が常にある", () => {
    mount();
    for (const label of [
      UI_COPY.feedback.captureUndo,
      UI_COPY.feedback.captureRetake,
      UI_COPY.feedback.captureDrop,
    ]) {
      expect(screen.getByRole("button", { name: label }), `${label} がありません`).not.toBeNull();
    }
  });

  it("何も描いていないときは「元に戻す」を押せない", () => {
    mount();
    // 押せるのに何も起きないボタンは、故障と見分けが付かない。
    expect(
      screen.getByRole("button", { name: UI_COPY.feedback.captureUndo }).hasAttribute("disabled"),
    ).toBe(true);
  });

  it("描画機能の無い環境では、断ったうえで写しを付けさせない", () => {
    mount();
    // jsdom は canvas の描画面を持たない。黙って空の画像を作らないこと。
    expect(screen.getByText(UI_COPY.feedback.captureUnavailable)).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "この写しを付ける" }).hasAttribute("disabled"),
    ).toBe(true);
  });
});

/**
 * --- ここから下は、描画面がある環境を作って見る ---
 *
 * jsdom は `getContext("2d")` に null を返すので、上の試験は**断る側**しか通らない。
 * それだけだと「印が画素に描かれているか」を一度も確かめないまま出すことになる。
 * この部品の存在理由は**焼き込むこと**なので、そこを見ないのは検査したうちに入らない。
 *
 * 描画の実物（線がどう見えるか）は測らない。測るのは
 * 「どの色で」「どの命令を」呼んだか、つまり**隠したはずのものが隠れる呼び方をしたか**。
 */

/** 呼ばれた描画命令 1 つ分。色は呼んだ瞬間の値を写し取る。 */
type Draw = {
  readonly op: string;
  readonly args: readonly unknown[];
  readonly fillStyle: string;
  readonly strokeStyle: string;
};

let draws: Draw[] = [];
let blobResult: Blob | null = null;
let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;
let originalToBlob: typeof HTMLCanvasElement.prototype.toBlob;

function fakeContext(): CanvasRenderingContext2D {
  const state = { fillStyle: "", strokeStyle: "" };
  const record =
    (op: string) =>
    (...args: unknown[]): void => {
      draws.push({ op, args, fillStyle: state.fillStyle, strokeStyle: state.strokeStyle });
    };
  return {
    get fillStyle() {
      return state.fillStyle;
    },
    set fillStyle(v: string) {
      state.fillStyle = v;
    },
    get strokeStyle() {
      return state.strokeStyle;
    },
    set strokeStyle(v: string) {
      state.strokeStyle = v;
    },
    lineWidth: 0,
    lineCap: "butt",
    font: "",
    drawImage: record("drawImage"),
    fillRect: record("fillRect"),
    strokeRect: record("strokeRect"),
    beginPath: record("beginPath"),
    moveTo: record("moveTo"),
    lineTo: record("lineTo"),
    stroke: record("stroke"),
    fill: record("fill"),
    closePath: record("closePath"),
    fillText: record("fillText"),
  } as unknown as CanvasRenderingContext2D;
}

/** 何を呼んだかだけの一覧。順序を見たいときに使う。 */
function ops(): readonly string[] {
  return draws.map((d) => d.op);
}

function canvasOf(container: HTMLElement): HTMLCanvasElement {
  const canvas = container.querySelector("canvas");
  if (canvas === null) throw new Error("描画面がありません");
  return canvas;
}

/** 押して・引きずって・離す。座標は原点からの差だけが意味を持つ。 */
function drag(canvas: HTMLCanvasElement, from: readonly [number, number], to: readonly [number, number]): void {
  fireEvent.pointerDown(canvas, { clientX: from[0], clientY: from[1] });
  fireEvent.pointerMove(canvas, { clientX: to[0], clientY: to[1] });
  fireEvent.pointerUp(canvas, { clientX: to[0], clientY: to[1] });
}

function pick(label: string): void {
  fireEvent.click(screen.getByRole("button", { name: label }));
}

describe("描画面がある環境", () => {
  beforeEach(() => {
    draws = [];
    blobResult = new Blob(["png"], { type: "image/png" });
    originalGetContext = HTMLCanvasElement.prototype.getContext;
    originalToBlob = HTMLCanvasElement.prototype.toBlob;
    const ctx = fakeContext();
    HTMLCanvasElement.prototype.getContext = ((kind: string) =>
      kind === "2d" ? ctx : null) as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toBlob = function toBlob(callback: BlobCallback): void {
      callback(blobResult);
    };
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    HTMLCanvasElement.prototype.toBlob = originalToBlob;
  });

  it("描画面があるときは断らず、写しを付けられる", () => {
    mount();
    expect(screen.queryByText(UI_COPY.feedback.captureUnavailable)).toBeNull();
    expect(screen.getByRole("button", { name: "この写しを付ける" }).hasAttribute("disabled")).toBe(false);
  });

  it("黒塗りは、直前に選んだ色に関係なく真っ黒で塗りつぶす", () => {
    const { container } = mount();
    // 「青を選んでから黒塗り」でも青くならないこと。薄い色で塗れたら隠れない。
    pick(UI_COPY.feedback.colorBlue);
    pick(UI_COPY.feedback.toolRedact);
    draws = [];
    drag(canvasOf(container), [10, 20], [60, 50]);

    const filled = draws.filter((d) => d.op === "fillRect");
    expect(filled.length).toBeGreaterThan(0);
    for (const d of filled) expect(d.fillStyle).toBe("#000000");
    expect(filled.at(-1)?.args).toEqual([10, 20, 50, 30]);
  });

  it("手書きは選んだ色の線として描かれる", () => {
    const { container } = mount();
    pick(UI_COPY.feedback.colorBrown);
    draws = [];
    drag(canvasOf(container), [0, 0], [40, 40]);

    const stroked = draws.filter((d) => d.op === "stroke");
    expect(stroked.length).toBeGreaterThan(0);
    expect(stroked.at(-1)?.strokeStyle).toBe("#8a5a2b");
    expect(ops()).toContain("lineTo");
  });

  it("四角は枠だけで、塗りつぶさない", () => {
    const { container } = mount();
    pick(UI_COPY.feedback.toolRect);
    draws = [];
    drag(canvasOf(container), [5, 5], [25, 35]);

    expect(draws.filter((d) => d.op === "strokeRect").at(-1)?.args).toEqual([5, 5, 20, 30]);
    // 中を塗ると、指し示すはずの場所が見えなくなる。
    expect(ops()).not.toContain("fillRect");
  });

  it("矢印には頭が付く（線と見分けが付かないと指し示せない）", () => {
    const { container } = mount();
    pick(UI_COPY.feedback.toolArrow);
    draws = [];
    drag(canvasOf(container), [0, 0], [100, 0]);

    // 頭は閉じた形を塗って作る。ここが無いとただの線になる。
    expect(ops()).toContain("closePath");
    expect(ops()).toContain("fill");
  });

  it("文字は、入れる文字を書いたときだけ置かれる", () => {
    const { container } = mount();
    pick(UI_COPY.feedback.toolText);
    const canvas = canvasOf(container);

    // 空のまま押しても、読めない印が増えるだけなので置かない。
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10 });
    expect(ops()).not.toContain("fillText");
    expect(screen.getByRole("button", { name: UI_COPY.feedback.captureUndo }).hasAttribute("disabled")).toBe(
      true,
    );

    fireEvent.change(screen.getByLabelText(UI_COPY.feedback.textToPlace), { target: { value: "ここが遅い" } });
    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 40 });

    expect(draws.filter((d) => d.op === "fillText").at(-1)?.args).toEqual(["ここが遅い", 30, 40]);
  });

  it("元に戻すと、最後に付けた印だけが消える", () => {
    const { container } = mount();
    const canvas = canvasOf(container);
    drag(canvas, [0, 0], [10, 10]);
    pick(UI_COPY.feedback.toolRect);
    drag(canvas, [20, 20], [40, 40]);

    const undoButton = screen.getByRole("button", { name: UI_COPY.feedback.captureUndo });
    expect(undoButton.hasAttribute("disabled")).toBe(false);

    draws = [];
    fireEvent.click(undoButton);
    // 四角だけが消え、手書きは残る。
    expect(ops()).not.toContain("strokeRect");
    expect(ops()).toContain("stroke");

    draws = [];
    fireEvent.click(undoButton);
    expect(ops()).not.toContain("stroke");
    expect(undoButton.hasAttribute("disabled")).toBe(true);
  });

  it("引きずったまま台紙の外へ出ても、その印は確定する", () => {
    const { container } = mount();
    const canvas = canvasOf(container);
    fireEvent.pointerDown(canvas, { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(canvas, { clientX: 30, clientY: 30 });
    fireEvent.pointerLeave(canvas);

    // 描きかけが消えると、描いた本人には理由が分からない。
    expect(screen.getByRole("button", { name: UI_COPY.feedback.captureUndo }).hasAttribute("disabled")).toBe(
      false,
    );
  });

  it("押していないのに動かしても、何も起きない", () => {
    const { container } = mount();
    draws = [];
    fireEvent.pointerMove(canvasOf(container), { clientX: 50, clientY: 50 });
    expect(screen.getByRole("button", { name: UI_COPY.feedback.captureUndo }).hasAttribute("disabled")).toBe(
      true,
    );
  });

  it("付けた写しは png 1 枚で、黒塗りの数を申告する", () => {
    const { container, exported } = mount();
    const canvas = canvasOf(container);
    pick(UI_COPY.feedback.toolRedact);
    drag(canvas, [0, 0], [10, 10]);
    drag(canvas, [20, 20], [30, 30]);
    pick(UI_COPY.feedback.toolPen);
    drag(canvas, [40, 40], [50, 50]);

    fireEvent.click(screen.getByRole("button", { name: "この写しを付ける" }));

    expect(exported.count).toBe(1);
    // 手書きは黒塗りではない。数を多く申告すると domain 側の検査と食い違う。
    expect(exported.redactionCount).toBe(2);
    expect(exported.type).toBe("image/png");
  });

  it("画像が作れなかったときは、付けたことにしない", () => {
    blobResult = null;
    const { exported } = mount();
    fireEvent.click(screen.getByRole("button", { name: "この写しを付ける" }));
    // 空の写しを付けると、送った側は「見えているはず」と思い込む。
    expect(exported.count).toBe(0);
  });

  it("撮り直す・画像を外す は、そのまま呼び出し元へ渡る", () => {
    const { retake, drop } = mount();
    fireEvent.click(screen.getByRole("button", { name: UI_COPY.feedback.captureRetake }));
    fireEvent.click(screen.getByRole("button", { name: UI_COPY.feedback.captureDrop }));
    expect([retake.count, drop.count]).toEqual([1, 1]);
  });

  it("自動で隠した箇所の数を、撮った直後に見せる", () => {
    mount();
    expect(screen.getByText(new RegExp("自動で隠した箇所: 2"))).not.toBeNull();
  });
});
