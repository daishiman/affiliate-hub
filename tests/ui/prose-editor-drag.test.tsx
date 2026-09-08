/** @tier 2 @req REQ-UX02, REQ-BOPS04 @types screen-states, boundary, equivalence, keyboard */
// @vitest-environment jsdom
/**
 * 掴んで動かす並べ替えを当てる。
 *
 * この操作の壊れ方は**片方向だけ効かない**である。抜いてから挿すので
 * 添字が 1 つずれ、「下へ 1 つ動かす」だけが元の位置へ戻る。
 * 上下どちらも、端も、自分自身へ落とした場合も挟む。
 *
 * 履歴も一緒に見る。位置が変わっていないのに配列を作り直すと、
 * 「元に戻す」が押せるのに押しても何も起きない手が積まれる。
 */
import { cleanup, createEvent, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { parseProse } from "@/domain/blogops";
import { ProseEditor } from "@/presentation/prose/prose-editor";

afterEach(cleanup);

function Harness({ initial }: { readonly initial: string }) {
  const [value, setValue] = useState(initial);
  return <ProseEditor label="本文" name="body" value={value} onValueChange={setValue} />;
}

/** 保存されている本文を、段落の文字の並びとして読む。 */
function texts(): readonly string[] {
  const saved = document.querySelector<HTMLInputElement>('input[name="body"]');
  return parseProse(saved?.value ?? "").map((node) => ("text" in node ? node.text : node.kind));
}

function rows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-prose-row]"));
}

/** 行の高さを決める。jsdom は既定で 0 を返すので、上下半分の判定ができない。 */
function withBox(row: HTMLElement, top: number, height = 100): HTMLElement {
  row.getBoundingClientRect = () => ({ top, height, bottom: top + height, left: 0, right: 0, width: 100, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;
  return row;
}

const dataTransfer = () => ({ setData: () => {}, getData: () => "", effectAllowed: "" });

/**
 * jsdom には `DragEvent` が無いので、`clientY` と `relatedTarget` は
 * 初期化オブジェクトからは載らない。組み立ててから自分で足す。
 */
function fireDrag(
  type: "dragStart" | "dragOver" | "dragLeave" | "drop" | "dragEnd",
  el: HTMLElement,
  extra: { clientY?: number; relatedTarget?: Node | null } = {},
): void {
  const event = createEvent[type](el, { dataTransfer: dataTransfer() });
  for (const [key, value] of Object.entries(extra)) {
    Object.defineProperty(event, key, { configurable: true, value });
  }
  fireEvent(el, event);
}

function grips(): HTMLElement[] {
  return screen.getAllByRole("button", { name: /を掴んで動かす$/ });
}

/** `from` 番目を掴んで、`to` 番目の上半分／下半分へ落とす。 */
function drag(from: number, to: number, side: "before" | "after"): void {
  const all = rows();
  fireDrag("dragStart", grips()[from] as HTMLElement);
  const target = withBox(all[to] as HTMLElement, 0);
  const clientY = side === "before" ? 10 : 90;
  fireDrag("dragOver", target, { clientY });
  fireDrag("drop", target, { clientY });
}

const THREE = "あ\n\nい\n\nう";

describe("掴んで動かす", () => {
  it("取っ手は断片の数だけ出て、種類の名前を名乗る", () => {
    render(<Harness initial={THREE} />);
    expect(grips()).toHaveLength(3);
    expect(screen.getAllByRole("button", { name: "段落を掴んで動かす" })).toHaveLength(3);
  });

  it("下へ 1 つだけ動かす（添字がずれる向き）", () => {
    render(<Harness initial={THREE} />);
    drag(0, 1, "after");
    expect(texts()).toEqual(["い", "あ", "う"]);
  });

  it("上へ 1 つだけ動かす", () => {
    render(<Harness initial={THREE} />);
    drag(2, 1, "before");
    expect(texts()).toEqual(["あ", "う", "い"]);
  });

  it("いちばん下まで放る", () => {
    render(<Harness initial={THREE} />);
    drag(0, 2, "after");
    expect(texts()).toEqual(["い", "う", "あ"]);
  });

  it("いちばん上まで放る", () => {
    render(<Harness initial={THREE} />);
    drag(2, 0, "before");
    expect(texts()).toEqual(["う", "あ", "い"]);
  });

  it("すぐ下の断片の上側へ落としても位置は変わらない", () => {
    render(<Harness initial={THREE} />);
    drag(0, 1, "before");
    expect(texts()).toEqual(["あ", "い", "う"]);
    /* 位置が変わっていないので、戻せる手も積まれていない。 */
    expect((screen.getByRole("button", { name: "元に戻す" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("自分自身へ落としても何も起きない", () => {
    render(<Harness initial={THREE} />);
    drag(1, 1, "after");
    expect(texts()).toEqual(["あ", "い", "う"]);
    expect((screen.getByRole("button", { name: "元に戻す" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("動かした並べ替えは元に戻せる", () => {
    render(<Harness initial={THREE} />);
    drag(0, 2, "after");
    fireEvent.click(screen.getByRole("button", { name: "元に戻す" }));
    expect(texts()).toEqual(["あ", "い", "う"]);
    fireEvent.click(screen.getByRole("button", { name: "やり直す" }));
    expect(texts()).toEqual(["い", "う", "あ"]);
  });

  it("掴んでいなければ、上を通っても落としても並びを変えない", () => {
    render(<Harness initial={THREE} />);
    const target = withBox(rows()[0] as HTMLElement, 0);
    fireDrag("dragOver", target, { clientY: 90 });
    fireDrag("drop", target, { clientY: 90 });
    expect(texts()).toEqual(["あ", "い", "う"]);
    expect(target.getAttribute("data-drop-side")).toBeNull();
  });
});

describe("落ちる場所の見せ方", () => {
  it("上半分では上側に、下半分では下側に線を出す", () => {
    render(<Harness initial={THREE} />);
    fireDrag("dragStart", grips()[0] as HTMLElement);
    const target = withBox(rows()[2] as HTMLElement, 0);
    fireDrag("dragOver", target, { clientY: 10 });
    expect(target.getAttribute("data-drop-side")).toBe("before");
    fireDrag("dragOver", target, { clientY: 90 });
    expect(target.getAttribute("data-drop-side")).toBe("after");
  });

  it("行から出れば線を消し、中の部品へ移っただけでは消さない", () => {
    render(<Harness initial={THREE} />);
    fireDrag("dragStart", grips()[0] as HTMLElement);
    const target = withBox(rows()[2] as HTMLElement, 0);
    fireDrag("dragOver", target, { clientY: 90 });
    fireDrag("dragLeave", target, { relatedTarget: target.firstChild });
    expect(target.getAttribute("data-drop-side")).toBe("after");
    fireDrag("dragLeave", target, { relatedTarget: null });
    expect(target.getAttribute("data-drop-side")).toBeNull();
  });

  it("掴み終われば線も掴みも解ける", () => {
    render(<Harness initial={THREE} />);
    fireDrag("dragStart", grips()[0] as HTMLElement);
    const target = withBox(rows()[2] as HTMLElement, 0);
    fireDrag("dragOver", target, { clientY: 90 });
    fireDrag("dragEnd", grips()[0] as HTMLElement);
    expect(target.getAttribute("data-drop-side")).toBeNull();
    /* 掴みが解けているので、そのまま落としても動かない。 */
    fireDrag("drop", target, { clientY: 90 });
    expect(texts()).toEqual(["あ", "い", "う"]);
  });
});

describe("ボタンでの並べ替えは残す", () => {
  it("掴めない人も上へ・下へで動かせる", () => {
    render(<Harness initial={THREE} />);
    fireEvent.click(screen.getAllByRole("button", { name: "段落を 1 つ下へ" })[0] as HTMLElement);
    expect(texts()).toEqual(["い", "あ", "う"]);
    fireEvent.click(screen.getAllByRole("button", { name: "段落を 1 つ上へ" })[1] as HTMLElement);
    expect(texts()).toEqual(["あ", "い", "う"]);
  });

  it("端では上へ・下へを押せなくする", () => {
    render(<Harness initial={THREE} />);
    expect((screen.getAllByRole("button", { name: "段落を 1 つ上へ" })[0] as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getAllByRole("button", { name: "段落を 1 つ下へ" })[2] as HTMLButtonElement).disabled).toBe(true);
  });
});
