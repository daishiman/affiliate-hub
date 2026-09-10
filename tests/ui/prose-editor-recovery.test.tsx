/** @tier 2 @req REQ-UX02, REQ-BOPS04 @types screen-states */
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { parseProse, serializeProse } from "@/domain/blogops";
import { ProseEditor } from "@/presentation/prose/prose-editor";
import { RichText } from "@/presentation/prose/rich-text";

afterEach(cleanup);

function Harness({ initial = "先頭\n\n末尾", upload }: { initial?: string; upload?: (file: File) => Promise<string> }) {
  const [value, setValue] = useState(initial);
  return <><button onClick={() => setValue("復元した本文")} type="button">復元</button><ProseEditor label="本文" name="body" value={value} onValueChange={setValue} onUploadImage={upload} /></>;
}

function saved() { return parseProse(document.querySelector<HTMLInputElement>('input[name="body"]')!.value); }
function input(el: HTMLElement, text: string) { el.textContent = text; fireEvent.input(el); }
function select(el: HTMLElement, start: number, end = start) {
  const range = document.createRange();
  range.setStart(el.firstChild!, start); range.setEnd(el.firstChild!, end);
  window.getSelection()?.removeAllRanges(); window.getSelection()?.addRange(range);
}

describe("本文編集の回復とキーボード", () => {
  it("入力内容が変わらないIME終了では保存済みの原文と履歴を変えない", () => {
    render(<Harness initial={"本文\n"} />);
    const field = screen.getByRole("textbox", { name: "段落" });
    fireEvent.compositionStart(field);
    fireEvent.compositionEnd(field);
    expect(document.querySelector<HTMLInputElement>('input[name="body"]')!.value).toBe("本文\n");
    expect((screen.getByRole("button", { name: "元に戻す" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("親で復元した本文を表示し、次の入力もその本文に続ける", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("復元"));
    expect(screen.getByRole("textbox", { name: "段落" }).textContent).toBe("復元した本文");
    input(screen.getByRole("textbox", { name: "段落" }), "復元した本文の続き");
    expect(saved()).toEqual([{ kind: "paragraph", text: "復元した本文の続き" }]);
  });

  it("削除・複製を元に戻せてやり直せる", () => {
    render(<Harness initial="残す文章" />);
    fireEvent.click(screen.getByRole("button", { name: "段落を複製" }));
    expect(saved()).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "元に戻す" }));
    expect(saved()).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "やり直す" }));
    expect(saved()).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: "段落を消す" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "元に戻す" }));
    expect(saved()).toHaveLength(2);
  });

  it("IME確定Enterは妨げず、通常Enterはカーソル位置で段落を分ける", async () => {
    render(<Harness initial="前半後半" />);
    const el = screen.getByRole("textbox", { name: "段落" });
    select(el, 2);
    expect(fireEvent.keyDown(el, { key: "Enter", isComposing: true })).toBe(true);
    expect(saved()).toHaveLength(1);
    fireEvent.keyDown(el, { key: "Enter" });
    expect(saved()).toEqual([{ kind: "paragraph", text: "前半" }, { kind: "paragraph", text: "後半" }]);
    await waitFor(() => expect(document.activeElement).toBe(screen.getAllByRole("textbox", { name: "段落" })[1]));
  });

  it("検索とEnterで挿入しEscapeでメニューを閉じる", () => {
    render(<Harness initial="本文" />);
    fireEvent.click(screen.getByRole("button", { name: "段落の下に部品を足す" }));
    const search = screen.getByRole("searchbox", { name: "本文ブロックを検索" });
    fireEvent.change(search, { target: { value: "引用" } });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(screen.getByRole("textbox", { name: "引用" })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "段落の下に部品を足す" }));
    fireEvent.keyDown(screen.getByRole("searchbox", { name: "本文ブロックを検索" }), { key: "Escape" });
    expect(screen.queryByRole("searchbox", { name: "本文ブロックを検索" })).toBeNull();
  });

  it("行操作の押し始めでは本文をblurさせず、click成立後に挿入メニューへ移る", () => {
    render(<Harness initial="本文" />);
    const field = screen.getByRole("textbox", { name: "段落" });
    act(() => field.focus());
    const add = screen.getByRole("button", { name: "段落の下に部品を足す" });
    // mousedown→blurで装飾帯が消えるとscroll anchoringがclick位置を変える。
    // 座標の保証は375px実E2E、ここでは原因となる既定のfocus移動を止める契約を検査。
    expect(fireEvent.mouseDown(add, { button: 0 })).toBe(false);
    expect(document.activeElement).toBe(field);
    fireEvent.mouseUp(add, { button: 0 });
    fireEvent.click(add);
    expect(document.activeElement).toBe(screen.getByRole("searchbox", { name: "本文ブロックを検索" }));
  });

  it("種類select・補助クリック・キーボードのfocus移動は妨げない", () => {
    render(<Harness initial="本文" />);
    const kind = screen.getByRole("combobox", { name: "段落の種類を変更" });
    const add = screen.getByRole("button", { name: "段落の下に部品を足す" });
    expect(fireEvent.mouseDown(kind, { button: 0 })).toBe(true);
    expect(fireEvent.mouseDown(add, { button: 2 })).toBe(true);
    expect(fireEvent.keyDown(add, { key: "Tab" })).toBe(true);
    act(() => add.focus());
    expect(document.activeElement).toBe(add);
    fireEvent.click(add);
    expect(screen.getByRole("searchbox", { name: "本文ブロックを検索" })).not.toBeNull();
  });

  it("IME互換キーコードのEnter/Escapeで候補を確定・終了しない", () => {
    render(<Harness initial="本文" />);
    fireEvent.click(screen.getByRole("button", { name: "段落の下に部品を足す" }));
    const search = screen.getByRole("searchbox", { name: "本文ブロックを検索" });
    fireEvent.change(search, { target: { value: "引用" } });
    expect(fireEvent.keyDown(search, { key: "Enter", keyCode: 229 })).toBe(true);
    expect(screen.queryByRole("textbox", { name: "引用" })).toBeNull();
    fireEvent.keyDown(search, { key: "Escape", keyCode: 229 });
    expect(search.isConnected).toBe(true);
  });

  it("種類変更で既存の文章を残す", () => {
    render(<Harness initial="**大切な文章**" />);
    fireEvent.change(screen.getByRole("combobox", { name: "段落の種類を変更" }), { target: { value: "quote" } });
    expect(saved()).toEqual([{ kind: "quote", text: "**大切な文章**" }]);
  });

  it("内部リンクを入力してもブラウザ検証で保存が止まらない", () => {
    render(<Harness initial={':::cta-button href="/s/blog" label="読む" tone=action\n:::'} />);
    const field = screen.getByRole("textbox", { name: "ボタンの行き先" }) as HTMLInputElement;
    expect(field.checkValidity()).toBe(true);
  });

  it("画像送信中の並べ替えと別の入力を保持する", async () => {
    let finish!: (url: string) => void;
    render(<Harness initial="文章" upload={() => new Promise((resolve) => { finish = resolve; })} />);
    fireEvent.click(screen.getByRole("button", { name: "段落の下に部品を足す" }));
    fireEvent.click(screen.getByRole("button", { name: "画像" }));
    fireEvent.change(screen.getByLabelText("画像に使うファイル"), { target: { files: [new File(["image"], "a.png", { type: "image/png" })] } });
    fireEvent.click(screen.getByRole("button", { name: "画像を 1 つ上へ" }));
    input(screen.getByRole("textbox", { name: "段落" }), "送信中に加筆");
    await act(async () => finish("/api/article-images/new"));
    // 画像は寸法欄 (width/height) を持つ。送信直後はまだ測っていないので `null`——
    // **欄ごと無いのと、測っていないのは違う。**前者だと読み手は「寸法は要らない」と
    // 読むが、後者は「入る場所は在るが、まだ入っていない」を意味する。
    expect(saved()).toEqual([{ kind: "image", src: "/api/article-images/new", alt: "", width: null, height: null }, { kind: "paragraph", text: "送信中に加筆" }]);
  });

  it("複数画像の同時アップロードで先の結果を消さない", async () => {
    const finish: ((url: string) => void)[] = [];
    render(<Harness initial={serializeProse([{ kind: "image-row", images: [{ src: "", alt: "左", width: null, height: null }, { src: "", alt: "右", width: null, height: null }] }])} upload={() => new Promise((resolve) => { finish.push(resolve); })} />);
    for (const label of ["1 枚目に使うファイル", "2 枚目に使うファイル"]) {
      fireEvent.change(screen.getByLabelText(label), { target: { files: [new File(["image"], "a.png", { type: "image/png" })] } });
    }
    await act(async () => { finish[0]!("/api/article-images/left"); finish[1]!("/api/article-images/right"); });
    expect(saved()).toEqual([{ kind: "image-row", images: [{ src: "/api/article-images/left", alt: "左", width: null, height: null }, { src: "/api/article-images/right", alt: "右", width: null, height: null }] }]);
  });

  it("プレビューへ切り替えても進行中の画像送信を保持する", async () => {
    let finish!: (url: string) => void;
    render(<Harness initial="文章" upload={() => new Promise((resolve) => { finish = resolve; })} />);
    fireEvent.click(screen.getByRole("button", { name: "段落の下に部品を足す" }));
    fireEvent.click(screen.getByRole("button", { name: "画像" }));
    fireEvent.change(screen.getByLabelText("画像に使うファイル"), { target: { files: [new File(["image"], "a.png", { type: "image/png" })] } });
    fireEvent.click(screen.getByRole("button", { name: "本文プレビュー" }));
    await act(async () => finish("/api/article-images/new"));
    expect(saved().some((node) => node.kind === "image" && node.src === "/api/article-images/new")).toBe(true);
    expect(screen.getByLabelText("本文プレビュー").querySelector("img")?.getAttribute("src")).toBe("/api/article-images/new");
  });

  it("見出しより長い既存の表行でも余剰セルを編集できる", () => {
    render(<Harness initial={"| 見出し |\n| --- |\n| 左 | 消えてはいけない値 |"} />);
    expect(screen.getByRole("textbox", { name: "1 行 2 列" }).textContent).toBe("消えてはいけない値");
    input(screen.getByRole("textbox", { name: "1 行 2 列" }), "右を編集");
    const table = saved()[0];
    expect(table?.kind === "comparison-table" && table.rows[0]).toEqual(["左", "右を編集"]);
  });
});

describe("文字選択とリンク", () => {
  it("絵文字の後ろの選択範囲に装飾を付ける", () => {
    let result = "";
    render(<RichText value="😀AB" onValueChange={(value) => { result = value; }} ariaLabel="文字" placeholder="" />);
    const el = screen.getByRole("textbox", { name: "文字" });
    fireEvent.focus(el); select(el, 2, 3);
    fireEvent.click(screen.getByRole("button", { name: "太字" }));
    expect(result).toBe("😀**A**B");
  });

  it("リンク入力へフォーカスを移して元の選択範囲に適用する", () => {
    let result = "";
    render(<RichText value="選択した文章" onValueChange={(value) => { result = value; }} ariaLabel="文字" placeholder="" />);
    const el = screen.getByRole("textbox", { name: "文字" });
    fireEvent.focus(el); select(el, 0, 3);
    fireEvent.click(screen.getByRole("button", { name: "リンク" }));
    const link = screen.getByRole("textbox", { name: "リンクの行き先" });
    fireEvent.blur(el, { relatedTarget: link });
    fireEvent.focus(link);
    expect(link.isConnected).toBe(true);
    window.getSelection()?.removeAllRanges();
    fireEvent.change(link, { target: { value: "/s/blog" } });
    fireEvent.click(screen.getByRole("button", { name: "付ける" }));
    expect(result).toBe("[選択し](/s/blog)た文章");
  });
});
