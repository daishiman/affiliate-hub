/** @tier 2 @req REQ-BOPS04, FRONT-REQ-007 @types screen-states, equivalence, boundary, injection */
// @vitest-environment jsdom
/**
 * 装飾つきの欄 (`RichText`) を、**DOM と保存文字列の往復**として当てる。
 *
 * この欄の壊れ方は「画面では太字に見えるのに保存すると素の字」「保存では
 * 装飾があるのに欄に出ない」という**片道だけの不一致**である。片側だけを
 * 見ても分からないので、押す→保存文字列を見る→描き直しを見る、で挟む。
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RichText } from "@/presentation/prose/rich-text";

afterEach(cleanup);

type HarnessProps = {
  readonly initial?: string;
  readonly multiline?: boolean;
  readonly onChange?: (value: string) => void;
  readonly onSlash?: (query: string) => void;
  readonly onSlashClosed?: () => void;
  readonly onSplit?: (before: string, after: string) => void;
};

function Harness({ initial = "", multiline, onChange, onSlash, onSlashClosed, onSplit }: HarnessProps) {
  const [value, setValue] = useState(initial);
  return (
    <RichText
      ariaLabel="段落"
      multiline={multiline}
      onSlash={onSlash}
      onSlashClosed={onSlashClosed}
      onSplit={onSplit}
      onValueChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
      placeholder="本文"
      value={value}
    />
  );
}

function field(): HTMLElement {
  return screen.getByRole("textbox", { name: "段落" });
}

/** 欄へ手を入れて道具帯を出す。帯は手が入っている間しか出ない。 */
function focusField(): HTMLElement {
  const el = field();
  fireEvent.focus(el);
  return el;
}

/** 本文の何文字目から何文字目かで選ぶ。走りをまたぐ範囲も指定できる。 */
function selectChars(root: HTMLElement, start: number, end: number): void {
  const texts: Text[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) texts.push(node as Text);
    else for (const child of Array.from(node.childNodes)) walk(child);
  };
  walk(root);
  if (texts.length === 0) {
    /* 空の欄には文字ノードが無い。欄そのものの先頭にカーソルを置く。 */
    const empty = document.createRange();
    empty.setStart(root, 0);
    empty.collapse(true);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(empty);
    return;
  }
  let seen = 0;
  let from: { node: Text; offset: number } | null = null;
  let to: { node: Text; offset: number } | null = null;
  for (const text of texts) {
    const length = text.data.length;
    if (from === null && seen + length >= start) from = { node: text, offset: start - seen };
    if (to === null && seen + length >= end) to = { node: text, offset: end - seen };
    seen += length;
  }
  if (from === null || to === null) throw new Error(`選べない範囲: ${start}-${end}`);
  const range = document.createRange();
  range.setStart(from.node, from.offset);
  range.setEnd(to.node, to.offset);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function press(label: string): void {
  fireEvent.click(screen.getByRole("button", { name: label }));
}

function paste(el: HTMLElement, text: string): void {
  fireEvent.paste(el, { clipboardData: { getData: () => text } });
}

describe("道具帯の出し入れ", () => {
  it("手を入れている間だけ帯を出す", () => {
    render(<Harness initial="あいうえお" />);
    expect(screen.queryByRole("toolbar")).toBeNull();
    focusField();
    expect(screen.getByRole("toolbar", { name: "段落の飾り" })).not.toBeNull();
  });

  it("欄の中へ手が移るだけでは帯を消さない", () => {
    render(<Harness initial="あいうえお" />);
    const el = focusField();
    fireEvent.blur(el.parentElement as HTMLElement, { relatedTarget: el });
    expect(screen.queryByRole("toolbar")).not.toBeNull();
    fireEvent.blur(el.parentElement as HTMLElement, { relatedTarget: null });
    expect(screen.queryByRole("toolbar")).toBeNull();
  });
});

describe("印の付け外し", () => {
  it.each([
    ["太字", "**あい**うえお"],
    ["斜体", "*あい*うえお"],
    ["打ち消し", "~~あい~~うえお"],
    ["行内コード", "`あい`うえお"],
  ])("%s を選んだ範囲へ当てる", (label, expected) => {
    const onChange = vi.fn();
    render(<Harness initial="あいうえお" onChange={onChange} />);
    const el = focusField();
    selectChars(el, 0, 2);
    press(label);
    expect(onChange).toHaveBeenCalledWith(expected);
  });

  it("範囲の全部に付いていればもう一度押して外す", () => {
    const onChange = vi.fn();
    render(<Harness initial="**あい**うえお" onChange={onChange} />);
    const el = focusField();
    expect(el.querySelector("strong")?.textContent).toBe("あい");
    selectChars(el, 0, 2);
    press("太字");
    expect(onChange).toHaveBeenLastCalledWith("あいうえお");
  });

  it("まだらな範囲は外さずに揃える", () => {
    const onChange = vi.fn();
    render(<Harness initial="**あい**うえお" onChange={onChange} />);
    const el = focusField();
    selectChars(el, 0, 4);
    press("太字");
    expect(onChange).toHaveBeenLastCalledWith("**あいうえ**お");
  });

  it("範囲を選んでいなければ当てない", () => {
    const onChange = vi.fn();
    render(<Harness initial="あいうえお" onChange={onChange} />);
    const el = focusField();
    selectChars(el, 2, 2);
    press("太字");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("Ctrl+B と Ctrl+I をショートカットとして受ける", () => {
    const onChange = vi.fn();
    render(<Harness initial="あいうえお" onChange={onChange} />);
    const el = focusField();
    selectChars(el, 0, 2);
    fireEvent.keyDown(el, { key: "b", ctrlKey: true });
    expect(onChange).toHaveBeenLastCalledWith("**あい**うえお");
    selectChars(el, 0, 2);
    fireEvent.keyDown(el, { key: "I", metaKey: true });
    expect(onChange).toHaveBeenLastCalledWith("***あい***うえお");
  });

  it("IME変換中のキーは装飾に使わない", () => {
    const onChange = vi.fn();
    render(<Harness initial="あいうえお" onChange={onChange} />);
    const el = focusField();
    selectChars(el, 0, 2);
    fireEvent.keyDown(el, { key: "b", ctrlKey: true, isComposing: true });
    fireEvent.keyDown(el, { key: "b", ctrlKey: true, keyCode: 229 });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("色の印", () => {
  it.each([
    ["文字の色", "{color="],
    ["地の色", "{bg="],
  ])("%s は見本つきの一覧から選ぶ", (label, notation) => {
    const onChange = vi.fn();
    render(<Harness initial="あいうえお" onChange={onChange} />);
    const el = focusField();
    const opener = screen.getByRole("button", { name: label });
    expect(opener.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(opener);
    expect(opener.getAttribute("aria-expanded")).toBe("true");
    selectChars(el, 0, 2);
    const option = screen.getAllByRole("button").find((b) => b.textContent !== null && b.textContent !== "" && b.getAttribute("aria-expanded") === null && /色|地/.test(b.textContent) === false);
    fireEvent.click(option as HTMLElement);
    expect(onChange).toHaveBeenCalled();
    expect(String(onChange.mock.calls.at(-1)?.[0])).toContain(notation);
  });

  it("一覧はもう一度押せば閉じる", () => {
    render(<Harness initial="あいうえお" />);
    focusField();
    const opener = screen.getByRole("button", { name: "文字の色" });
    fireEvent.click(opener);
    fireEvent.click(opener);
    expect(opener.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("リンクの印", () => {
  it("通せない行き先は付けさせない", () => {
    render(<Harness initial="あいうえお" />);
    focusField();
    press("リンク");
    const input = screen.getByRole("textbox", { name: "リンクの行き先" });
    fireEvent.change(input, { target: { value: "javascript:alert(1)" } });
    expect((screen.getByRole("button", { name: "付ける" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("通せる行き先を Enter で付ける", () => {
    const onChange = vi.fn();
    render(<Harness initial="あいうえお" onChange={onChange} />);
    const el = focusField();
    press("リンク");
    selectChars(el, 0, 2);
    const input = screen.getByRole("textbox", { name: "リンクの行き先" });
    fireEvent.change(input, { target: { value: "https://example.com/" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith("[あい](https://example.com/)うえお");
    expect(screen.queryByRole("textbox", { name: "リンクの行き先" })).toBeNull();
  });

  it("通せない行き先は Enter でも閉じない", () => {
    render(<Harness initial="あいうえお" />);
    focusField();
    press("リンク");
    const input = screen.getByRole("textbox", { name: "リンクの行き先" });
    fireEvent.change(input, { target: { value: "javascript:alert(1)" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.queryByRole("textbox", { name: "リンクの行き先" })).not.toBeNull();
  });

  it("Escape とやめるで閉じる", () => {
    render(<Harness initial="あいうえお" />);
    focusField();
    press("リンク");
    fireEvent.keyDown(screen.getByRole("textbox", { name: "リンクの行き先" }), { key: "Escape" });
    expect(screen.queryByRole("textbox", { name: "リンクの行き先" })).toBeNull();
    press("リンク");
    press("やめる");
    expect(screen.queryByRole("textbox", { name: "リンクの行き先" })).toBeNull();
  });

  it("IME変換中の Enter はリンクを確定しない", () => {
    render(<Harness initial="あいうえお" />);
    focusField();
    press("リンク");
    const input = screen.getByRole("textbox", { name: "リンクの行き先" });
    fireEvent.change(input, { target: { value: "https://example.com/" } });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(screen.queryByRole("textbox", { name: "リンクの行き先" })).not.toBeNull();
  });

  it("押した瞬間の範囲を覚えておき、欄から手が外れても当てられる", () => {
    const onChange = vi.fn();
    render(<Harness initial="あいうえお" onChange={onChange} />);
    const el = focusField();
    selectChars(el, 0, 2);
    press("リンク");
    window.getSelection()?.removeAllRanges();
    const input = screen.getByRole("textbox", { name: "リンクの行き先" });
    fireEvent.change(input, { target: { value: "/s/abc" } });
    press("付ける");
    expect(onChange).toHaveBeenLastCalledWith("[あい](/s/abc)うえお");
  });
});

describe("貼り付け", () => {
  it("素の文字だけを受け、1行の欄では改行を空白へ落とす", () => {
    const onChange = vi.fn();
    render(<Harness initial="" onChange={onChange} />);
    const el = focusField();
    selectChars(el, 0, 0);
    paste(el, "前\n後");
    expect(onChange).toHaveBeenLastCalledWith("前 後");
  });

  it("複数行の欄では改行を保つ", () => {
    const onChange = vi.fn();
    render(<Harness initial="" multiline onChange={onChange} />);
    const el = focusField();
    selectChars(el, 0, 0);
    paste(el, "前\n後");
    expect(onChange).toHaveBeenLastCalledWith("前\n後");
  });

  it("選ぶ場所が無ければ何も入れない", () => {
    const onChange = vi.fn();
    render(<Harness initial="あいうえお" onChange={onChange} />);
    const el = focusField();
    window.getSelection()?.removeAllRanges();
    paste(el, "貼る");
    expect(onChange).toHaveBeenLastCalledWith("あいうえお");
  });
});

describe("入力の知らせ", () => {
  it("`/` で始まれば後ろの文字を渡し、外れたら閉じたと知らせる", () => {
    const onSlash = vi.fn();
    const onSlashClosed = vi.fn();
    render(<Harness initial="" onSlash={onSlash} onSlashClosed={onSlashClosed} />);
    const el = field();
    el.textContent = "/見出し";
    fireEvent.input(el);
    expect(onSlash).toHaveBeenCalledWith("見出し");
    el.textContent = "見出し";
    fireEvent.input(el);
    expect(onSlashClosed).toHaveBeenCalled();
  });

  it("IME変換中は途中の字を外へ出さない", () => {
    const onChange = vi.fn();
    render(<Harness initial="" onChange={onChange} />);
    const el = field();
    fireEvent.compositionStart(el);
    el.textContent = "ん";
    fireEvent.input(el);
    expect(onChange).not.toHaveBeenCalled();
    el.textContent = "本";
    fireEvent.compositionEnd(el);
    expect(onChange).toHaveBeenLastCalledWith("本");
  });

  it("1行の欄の Enter はカーソル位置で前後へ分ける", () => {
    const onSplit = vi.fn();
    render(<Harness initial="前半後半" onSplit={onSplit} />);
    const el = focusField();
    selectChars(el, 2, 2);
    fireEvent.keyDown(el, { key: "Enter" });
    expect(onSplit).toHaveBeenCalledWith("前半", "後半");
  });

  it("複数行の欄の Enter は分けない", () => {
    const onSplit = vi.fn();
    render(<Harness initial="前半後半" multiline onSplit={onSplit} />);
    fireEvent.keyDown(focusField(), { key: "Enter" });
    expect(onSplit).not.toHaveBeenCalled();
  });
});

describe("DOM から保存文字列への読み戻し", () => {
  it("ブラウザが作る改行・段・見出し以外のタグを取りこぼさない", () => {
    const onChange = vi.fn();
    render(<Harness initial="" multiline onChange={onChange} />);
    const el = field();
    el.innerHTML = "<b>太</b><i>斜</i><del>消</del><code>码</code><br><div>次</div>";
    fireEvent.input(el);
    expect(onChange).toHaveBeenLastCalledWith("**太***斜*~~消~~`码`\n\n次");
  });

  it("行き先の無い `a` と印の無いタグは素の字として読む", () => {
    const onChange = vi.fn();
    render(<Harness initial="" onChange={onChange} />);
    const el = field();
    el.innerHTML = "<a>札</a><span>素</span>";
    fireEvent.input(el);
    expect(onChange).toHaveBeenLastCalledWith("札素");
  });

  it("通せない行き先のリンクは描き直しで裸の字に落とす", () => {
    render(<Harness initial="[札](javascript:alert(1))" />);
    const el = field();
    expect(el.querySelector("a")).toBeNull();
    expect(el.textContent).toContain("札");
  });
});
