/**
 * @tier 2
 * @req REQ-FB04, REQ-FB05
 * @types screen-states, a11y, keyboard
 */
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
import {
  CANVAS_COLORS,
  CANVAS_KEY_STEP,
  CANVAS_TOOLS,
  CaptureCanvas,
} from "@/presentation/ui/patterns/capture-canvas";
import { describeViolations, findA11yViolations } from "../support/a11y";

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

describe("読み上げ", () => {
  it("台紙を出した状態に、機械で分かる読み上げの問題が無い", async () => {
    const { container } = mount();
    const violations = await findA11yViolations(
      `<main><h1>改善したいことを送る</h1>${container.innerHTML}</main>`,
    );
    expect(describeViolations(violations)).toBe("");
  });
});

/**
 * 道具を選ぶところが、キーボードだけで届くか。
 *
 * **ここは道具・色・逃げ道までしか見ていない。**描く操作そのものは
 * 「描画面がある環境 > キーボードだけで印を置ける」で見る。
 * 分けてあるのは、jsdom には描画面が無く、ここでは印が画素へ載ったかを
 * 確かめられないため（この describe が緑でも、描けているとは言えない）。
 *
 * 2026-08-19 まで、描く操作にはキーボードの経路が無かった。
 * **この describe の名前は当時から「キーボードで道具を選べる」であり、
 * 見ている範囲は正しく書かれていた。にもかかわらず、要件表の a11y 欄は
 * 「対応」の 1 語だった**（`docs/product/backlog.md` 項目 82）。
 * 名前が正直でも、隣に何が無いかは誰も言わない。
 *
 * 選んだことを `aria-pressed` で持たせているのは、**選択を色だけで示さない**ため。
 * 色だけだと、見分けの付かない人には「いま何で描いているか」が最後まで分からない。
 */
describe("キーボードで道具を選べる", () => {
  it("道具・色・逃げ道は、すべて素のボタンとして置かれている", () => {
    mount();
    // `div` に押す動きを付けたものは、マウスからは押せてキーボードには存在しない。
    for (const label of [
      ...ANNOTATION_TOOLS.map((t) => ANNOTATION_TOOL_LABELS[t]),
      UI_COPY.feedback.captureUndo,
      UI_COPY.feedback.captureRetake,
      UI_COPY.feedback.captureDrop,
    ]) {
      const el = screen.getByRole("button", { name: label });
      expect(el.tagName.toLowerCase(), `${label} が素のボタンではありません`).toBe("button");
    }
  });

  it("いま選んでいる道具は、色ではなく状態として読み上げられる", () => {
    mount();
    const pen = screen.getByRole("button", { name: ANNOTATION_TOOL_LABELS.pen });
    const rect = screen.getByRole("button", { name: ANNOTATION_TOOL_LABELS.rect });
    expect(pen.getAttribute("aria-pressed")).toBe("true");
    expect(rect.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(rect);
    expect(screen.getByRole("button", { name: ANNOTATION_TOOL_LABELS.rect }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: ANNOTATION_TOOL_LABELS.pen }).getAttribute("aria-pressed")).toBe("false");
  });

  it("道具の並び・色の並びは、それぞれ名前を持つ", () => {
    // axe はここを見ない（名前の無い `group` は違反として上がらない）。
    // 上の読み上げ検査を緑にしたまま名前を外せたので、名指しで押さえる。
    // **壊しても赤にならないのは、守られていないときだけとは限らない。**
    mount();
    expect(screen.getByRole("group", { name: UI_COPY.feedback.captureTitle })).not.toBeNull();
    expect(screen.getByRole("group", { name: "色" })).not.toBeNull();
  });

  it("順番を手で決めていない（台紙の中に正の tabindex を置かない）", () => {
    const { container } = mount();
    const forced = [...container.querySelectorAll("[tabindex]")]
      .map((el) => Number(el.getAttribute("tabindex")))
      .filter((n) => n > 0);
    expect(forced).toEqual([]);
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
/** `toBlob` を呼んだ瞬間に台紙へ載っていた命令。**外へ出る 1 枚の中身がこれ。** */
let opsAtBlob: readonly string[] = [];
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
    // 位置の目印だけが使う。ここを記録しておくと、目印が
    // 「キーボードのときだけ描かれる」を op の名前で見分けられる。
    arc: record("arc"),
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
    opsAtBlob = [];
    blobResult = new Blob(["png"], { type: "image/png" });
    originalGetContext = HTMLCanvasElement.prototype.getContext;
    originalToBlob = HTMLCanvasElement.prototype.toBlob;
    const ctx = fakeContext();
    HTMLCanvasElement.prototype.getContext = ((kind: string) =>
      kind === "2d" ? ctx : null) as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toBlob = function toBlob(callback: BlobCallback): void {
      opsAtBlob = ops();
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

  /**
   * --- キーボードだけで印を 1 つ確定できるか ---
   *
   * ここが長らく空いていた。道具・色・逃げ道はキーボードで選べるのに、
   * **描く操作だけがポインタでしか動かなかった**（`docs/product/backlog.md` 項目 82）。
   * 選ぶところまで進めてしまうぶん、進めた人には「できる」ように見える。
   * 入口が無いより悪い壊れ方である。
   *
   * 見るのは「キーボードの経路が在ること」ではなく
   * **その経路の終わりに、ポインタと同じ印が画素へ描かれていること**。
   * 経路が在るだけなら、動かない `onKeyDown` を足しても満たせてしまう。
   *
   * ポインタの経路は落とさない。上の試験群がそのまま残っているのがその担保で、
   * **片方を消してもう片方を満たすのは、対応ではなく機能の削除である。**
   */
  describe("キーボードだけで印を置ける", () => {
    it("台紙そのものが、キーボードで届く", () => {
      const { container } = mount();
      // 届かなければ、この下の試験は「押せない鍵盤を押している」だけになる。
      expect(canvasOf(container).getAttribute("tabindex")).toBe("0");
    });

    it("矢印キーと Enter だけで、黒塗りを 1 つ確定できる", () => {
      const { container } = mount();
      pick(UI_COPY.feedback.toolRedact);
      const canvas = canvasOf(container);
      const [cx, cy] = [canvas.width / 2, canvas.height / 2];
      draws = [];

      // Enter 1 回目で始点。そこから広げて、Enter 2 回目で確定する。
      fireEvent.keyDown(canvas, { key: "Enter" });
      fireEvent.keyDown(canvas, { key: "ArrowRight" });
      fireEvent.keyDown(canvas, { key: "ArrowRight" });
      fireEvent.keyDown(canvas, { key: "ArrowDown" });
      fireEvent.keyDown(canvas, { key: "Enter" });

      const filled = draws.filter((d) => d.op === "fillRect");
      expect(filled.length, "黒塗りが画素へ描かれていません").toBeGreaterThan(0);
      // 薄い色で塗れないことは、ポインタのときと同じ決まりで見る。
      for (const d of filled) expect(d.fillStyle).toBe("#000000");
      expect(filled.at(-1)?.args).toEqual([cx, cy, CANVAS_KEY_STEP * 2, CANVAS_KEY_STEP]);
      expect(
        screen.getByRole("button", { name: UI_COPY.feedback.captureUndo }).hasAttribute("disabled"),
        "確定したのに「元に戻す」が押せません（印が残っていない）",
      ).toBe(false);
    });

    it("細かく動かしたいときは Shift を添える", () => {
      const { container } = mount();
      pick(UI_COPY.feedback.toolRect);
      const canvas = canvasOf(container);
      const [cx, cy] = [canvas.width / 2, canvas.height / 2];
      draws = [];

      fireEvent.keyDown(canvas, { key: "Enter" });
      fireEvent.keyDown(canvas, { key: "ArrowRight", shiftKey: true });
      fireEvent.keyDown(canvas, { key: "ArrowDown", shiftKey: true });
      fireEvent.keyDown(canvas, { key: "Enter" });

      // 大きい刻みだけだと、隠したい範囲の縁が合わない。
      expect(draws.filter((d) => d.op === "strokeRect").at(-1)?.args).toEqual([cx, cy, 1, 1]);
    });

    it("Esc で、描きかけをやめられる", () => {
      const { container } = mount();
      pick(UI_COPY.feedback.toolRedact);
      const canvas = canvasOf(container);

      fireEvent.keyDown(canvas, { key: "Enter" });
      fireEvent.keyDown(canvas, { key: "ArrowRight" });
      fireEvent.keyDown(canvas, { key: "Escape" });

      // やめたのに残ると、消し方が分からないまま送ることになる。
      expect(
        screen.getByRole("button", { name: UI_COPY.feedback.captureUndo }).hasAttribute("disabled"),
      ).toBe(true);
    });

    it("文字は、キーボードからも「入れる文字」を書いたときだけ置かれる", () => {
      const { container } = mount();
      pick(UI_COPY.feedback.toolText);
      const canvas = canvasOf(container);
      const [cx, cy] = [canvas.width / 2, canvas.height / 2];
      draws = [];

      fireEvent.keyDown(canvas, { key: "Enter" });
      expect(ops(), "空のまま置けています").not.toContain("fillText");

      fireEvent.change(screen.getByLabelText(UI_COPY.feedback.textToPlace), {
        target: { value: "ここが遅い" },
      });
      fireEvent.keyDown(canvas, { key: "Enter" });
      expect(draws.filter((d) => d.op === "fillText").at(-1)?.args).toEqual(["ここが遅い", cx, cy]);
    });

    it("いまどこにいて、何をした状態なのかが読み上げられる", () => {
      const { container } = mount();
      pick(UI_COPY.feedback.toolRedact);
      const canvas = canvasOf(container);
      const live = (): string => container.querySelector("[aria-live]")?.textContent ?? "";

      // 画素の上の位置は、見えない人には画面から一切分からない。
      // 数で知らせないと、始点を決めた場所が最後まで分からないまま広げることになる。
      fireEvent.keyDown(canvas, { key: "ArrowRight" });
      expect(live()).toContain(String(canvas.width / 2 + CANVAS_KEY_STEP));

      fireEvent.keyDown(canvas, { key: "Enter" });
      expect(live()).toContain(UI_COPY.feedback.captureKeyboardAnchored);

      fireEvent.keyDown(canvas, { key: "ArrowDown" });
      fireEvent.keyDown(canvas, { key: "Enter" });
      expect(live()).toContain(UI_COPY.feedback.captureKeyboardPlaced);
    });

    it("キーボードで置いた印も、写しに焼き込まれて数に入る", () => {
      const { container, exported } = mount();
      pick(UI_COPY.feedback.toolRedact);
      const canvas = canvasOf(container);

      fireEvent.keyDown(canvas, { key: "Enter" });
      fireEvent.keyDown(canvas, { key: "ArrowRight" });
      fireEvent.keyDown(canvas, { key: "Enter" });
      fireEvent.click(screen.getByRole("button", { name: "この写しを付ける" }));

      // ここが 0 だと、domain 側は「黒塗りの無い写し」として扱う。
      // 経路を足しただけで申告につながっていない、が起きるのはここ。
      expect(exported.redactionCount).toBe(1);
      expect(exported.count).toBe(1);
    });

    it("キーボードを使っていないあいだは、位置の目印を画素へ描かない", () => {
      const { container } = mount();
      const canvas = canvasOf(container);
      draws = [];
      // 位置の目印は、キーボードの人にだけ要る。常に描くと、
      // ポインタで作った写しにも輪が焼き込まれて出ていく。
      drag(canvas, [0, 0], [10, 10]);
      expect(ops(), "触っていないのに目印が描かれています").not.toContain("arc");

      // 触れば出る。出ないほうへ倒して緑にしていないことを、同じ検査の中で見せる。
      fireEvent.keyDown(canvas, { key: "ArrowRight" });
      expect(ops(), "キーボードで動かしても目印が出ません").toContain("arc");
    });

    it("外へ出す 1 枚には、位置の目印を焼き込まない", () => {
      const { container } = mount();
      const canvas = canvasOf(container);
      pick(UI_COPY.feedback.toolRedact);
      fireEvent.keyDown(canvas, { key: "Enter" });
      fireEvent.keyDown(canvas, { key: "ArrowRight" });
      fireEvent.keyDown(canvas, { key: "Enter" });
      draws = [];

      fireEvent.click(screen.getByRole("button", { name: "この写しを付ける" }));

      // `toBlob` を呼んだ瞬間に台紙へ載っていたものが、そのまま外へ出る。
      // 目印は操作のための印であって、送る中身ではない。
      expect(opsAtBlob, "写しを撮った時点で目印が載っています").not.toContain("arc");
      // 目印だけが抜けていること。印まで消えていたら、それは黒塗りの無い写しである。
      expect(opsAtBlob, "黒塗りごと消えています").toContain("fillRect");
      // 画面のほうには戻っている（消えると、次にどこから広げるのか分からない）。
      expect(ops()).toContain("arc");
    });
  });
});
