/**
 * @tier 2
 * @req REQ-UX02, REQ-BOPS04, REQ-BOPS05
 * @types screen-states, a11y
 */
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { type ProseNode, parseProse, serializeProse } from "@/domain/blogops";
import { ProseEditor } from "@/presentation/prose/prose-editor";
import { asPartOfPage, describeViolations, findA11yViolations } from "../support/a11y";

/**
 * 本文を出来上がりの形のまま書く欄。
 *
 * --- なぜこのファイルが要るのか（2026-08-27）---
 *
 * この欄は**この PR の目玉**でありながら、分岐の実測は 0.0%（59 本中 0 本）だった。
 * 画面の総当たり（`page-render.test.tsx`）は記事の編集画面を描いているのに、
 * `"use client"` の中は**サーバ描画で一度も枝分かれしない**。
 * 初期表示の形しか通らないので、`/` も、並べ替えも、消す操作も、
 * 表の列足しも、**書いた日から一度も動かされていない。**
 *
 * 押さないと通らない枝は、押すテストでしか守れない。ここは「押した結果、
 * 何が保存されるか」を見る。保存の形そのものは `tests/domain/blogops` の
 * 往復検査が持っているので、ここでは重ねて書かない。
 *
 * --- 何を見て、何を見ないか ---
 *
 * 見るのは **`onValueChange` に渡る文字列**と、**画面に出る操作の名前**。
 * class 名や DOM の形は見ない。見た目を整え直した日に、
 * 意味が変わっていないのに赤くなる検査は、次に消される検査である。
 */

afterEach(cleanup);

/**
 * `value` を持つ側を用意する。**欄そのものは値を持たない。**
 *
 * 本物の呼び出し側（記事の編集画面）も同じ形で、
 * ここを省いて `value` を固定にすると、保存される文字列が一度も更新されず、
 * 「押しても何も起きない」ことに気づけない。
 */
function Harness({
  initial = "",
  productOptions,
}: {
  readonly initial?: string;
  readonly productOptions?: readonly { readonly value: string; readonly label: string }[];
}) {
  const [value, setValue] = useState(initial);
  return (
    <ProseEditor
      label="本文"
      name="body"
      onValueChange={setValue}
      productOptions={productOptions}
      value={value}
    />
  );
}

/** いま保存される文字列。隠し欄がそのまま送られるので、そこを読む。 */
function savedValue(): string {
  const hidden = document.querySelector<HTMLInputElement>('input[name="body"]');
  return hidden?.value ?? "";
}

/** 保存される文字列を、断片の並びとして読み直す。文字列の見た目には寄りかからない。 */
function savedNodes(): readonly ProseNode[] {
  return parseProse(savedValue());
}

function typeInParagraph(text: string): void {
  fireEvent.change(screen.getByLabelText("段落"), { target: { value: text } });
}

describe("`/` で部品を足す", () => {
  it("空の段落で `/` を打つと、部品の一覧が出る", () => {
    render(<Harness />);
    expect(screen.queryByRole("button", { name: "小見出し" })).toBeNull();

    typeInParagraph("/");

    expect(screen.getByRole("button", { name: "小見出し" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "比較表" })).not.toBeNull();
  });

  it("続けて打った文字で絞る。名前でも読みでも当たる", () => {
    render(<Harness />);

    // 読み（`PROSE_NODE_KEYWORDS`）で当てる。`list` は前方一致では拾えない。
    typeInParagraph("/list");
    expect(screen.getByRole("button", { name: "箇条書き" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "小見出し" })).toBeNull();

    // 日本語の名前でも当たる。
    typeInParagraph("/見出し");
    expect(screen.getByRole("button", { name: "小見出し" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "箇条書き" })).toBeNull();
  });

  it("当たるものが無いとき、黙って閉じずに理由を出す", () => {
    render(<Harness />);
    typeInParagraph("/ちがう");

    // 閉じてしまうと、打ち間違えたのか壊れたのかが区別できない。
    expect(screen.getByText("「ちがう」に当たる部品はありません。")).not.toBeNull();
  });

  it("`/` を消すと一覧も閉じる", () => {
    render(<Harness />);
    typeInParagraph("/");
    expect(screen.getByRole("button", { name: "小見出し" })).not.toBeNull();

    typeInParagraph("ふつうの本文");

    expect(screen.queryByRole("button", { name: "小見出し" })).toBeNull();
    expect(savedNodes()).toEqual([{ kind: "paragraph", text: "ふつうの本文" }]);
  });

  it("`/` の段落は置き換える。選んだ跡の空行を残さない", () => {
    render(<Harness />);
    typeInParagraph("/");
    fireEvent.click(screen.getByRole("button", { name: "引用" }));

    // 段落が残っていたら、運営者は自分が書いていない行を消して回ることになる。
    expect(screen.queryByLabelText("段落")).toBeNull();
    expect(screen.getByLabelText("引用")).not.toBeNull();
  });

  it("ボタンから開いたときは下に足す。書いた段落を消さない", () => {
    render(<Harness />);
    typeInParagraph("消えては困る本文");
    fireEvent.click(screen.getByRole("button", { name: "段落の下に部品を足す" }));
    fireEvent.click(screen.getByRole("button", { name: "引用" }));

    fireEvent.change(screen.getByLabelText("引用"), { target: { value: "引いた文" } });

    expect(savedNodes()).toEqual([
      { kind: "paragraph", text: "消えては困る本文" },
      { kind: "quote", text: "引いた文" },
    ]);
  });

  it("同じボタンをもう一度押すと閉じる", () => {
    render(<Harness />);
    const open = screen.getByRole("button", { name: "段落の下に部品を足す" });

    fireEvent.click(open);
    expect(screen.getByRole("button", { name: "小見出し" })).not.toBeNull();

    fireEvent.click(open);
    expect(screen.queryByRole("button", { name: "小見出し" })).toBeNull();
  });
});

describe("並べ替えと削除", () => {
  const TWO = serializeProse([
    { kind: "paragraph", text: "上の段落" },
    { kind: "quote", text: "下の引用" },
  ]);

  it("端の断片は、その向きへ動かせないことが見てわかる", () => {
    render(<Harness initial={TWO} />);

    const up = screen.getByRole("button", { name: "段落を 1 つ上へ" }) as HTMLButtonElement;
    const down = screen.getByRole("button", { name: "引用を 1 つ下へ" }) as HTMLButtonElement;

    // 押せないことを名前で伝える。押して何も起きない欄は、壊れて見える。
    expect(up.disabled).toBe(true);
    expect(down.disabled).toBe(true);
  });

  it("入れ替えると、保存される順番も入れ替わる", () => {
    render(<Harness initial={TWO} />);
    fireEvent.click(screen.getByRole("button", { name: "引用を 1 つ上へ" }));

    expect(savedNodes()).toEqual([
      { kind: "quote", text: "下の引用" },
      { kind: "paragraph", text: "上の段落" },
    ]);
  });

  it("消すと、その断片だけが保存から落ちる", () => {
    render(<Harness initial={TWO} />);
    fireEvent.click(screen.getByRole("button", { name: "引用を消す" }));

    expect(savedNodes()).toEqual([{ kind: "paragraph", text: "上の段落" }]);
  });

  it("いちばん下に段落を足せる", () => {
    render(<Harness initial={TWO} />);
    fireEvent.click(screen.getByRole("button", { name: "いちばん下に段落を足す" }));

    const paragraphs = screen.getAllByLabelText("段落");
    expect(paragraphs).toHaveLength(2);
  });
});

describe("空の断片は保存しない", () => {
  it("開いて選んでやめた跡は、本文へ残らない", () => {
    render(<Harness />);
    typeInParagraph("/");
    fireEvent.click(screen.getByRole("button", { name: "比較表" }));

    // 表は出ているが、1 マスも埋めていない。公開面に空の箱を並べない。
    expect(screen.getByLabelText("1 列目の見出し")).not.toBeNull();
    expect(savedValue()).toBe("");
  });

  it("区切り線は中身を持たないので、空でも残る", () => {
    render(<Harness />);
    typeInParagraph("/");
    fireEvent.click(screen.getByRole("button", { name: "区切り線" }));

    expect(savedNodes()).toEqual([{ kind: "divider" }]);
  });
});

describe("断片ごとの欄", () => {
  it("小見出しは深さを選べ、選び直すと保存にも乗る", () => {
    render(<Harness initial={serializeProse([{ kind: "heading", level: 3, text: "章" }])} />);

    fireEvent.change(screen.getByLabelText("小見出しの深さ"), { target: { value: "4" } });
    expect(savedNodes()).toEqual([{ kind: "heading", level: 4, text: "章" }]);

    fireEvent.change(screen.getByLabelText("小見出しの深さ"), { target: { value: "3" } });
    expect(savedNodes()).toEqual([{ kind: "heading", level: 3, text: "章" }]);
  });

  it("小見出しの文言を書き換えられる", () => {
    render(<Harness initial={serializeProse([{ kind: "heading", level: 3, text: "旧" }])} />);
    fireEvent.change(screen.getByLabelText("小見出しの文言"), { target: { value: "新" } });

    expect(savedNodes()).toEqual([{ kind: "heading", level: 3, text: "新" }]);
  });

  it("箇条書きは項目を足せ、1 つしかないときは消せない", () => {
    render(<Harness initial={serializeProse([{ kind: "bullet-list", items: ["ひとつ"] }])} />);

    const remove = screen.getByRole("button", {
      name: "1 番目の項目を消す",
    }) as HTMLButtonElement;
    expect(remove.disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "項目を足す" }));
    fireEvent.change(screen.getByLabelText("2 番目の項目"), { target: { value: "ふたつ" } });
    expect(savedNodes()).toEqual([{ kind: "bullet-list", items: ["ひとつ", "ふたつ"] }]);

    fireEvent.click(screen.getByRole("button", { name: "1 番目の項目を消す" }));
    expect(savedNodes()).toEqual([{ kind: "bullet-list", items: ["ふたつ"] }]);
  });

  it("番号付きの箇条書きは、番号が見えている", () => {
    render(
      <Harness initial={serializeProse([{ kind: "ordered-list", items: ["あ", "い"] }])} />,
    );

    expect(screen.getByText("1.")).not.toBeNull();
    expect(screen.getByText("2.")).not.toBeNull();
  });

  it("注意書きは調子・題名・本文をそれぞれ持つ", () => {
    render(
      <Harness
        initial={serializeProse([
          { kind: "callout", tone: "info", title: "題", text: "中身" },
        ])}
      />,
    );

    fireEvent.change(screen.getByLabelText("注意書きの調子"), { target: { value: "warn" } });
    fireEvent.change(screen.getByLabelText("注意書きの題名"), { target: { value: "注意" } });
    fireEvent.change(screen.getByLabelText("注意書きの本文"), { target: { value: "危ない" } });

    expect(savedNodes()).toEqual([
      { kind: "callout", tone: "warn", title: "注意", text: "危ない" },
    ]);
  });

  it("商品カードは、選べる商品を渡さないと id を直に打つ欄になる", () => {
    render(<Harness initial={serializeProse([{ kind: "product-card", productId: "" }])} />);

    fireEvent.change(screen.getByLabelText("商品の id"), { target: { value: "pc_x" } });
    expect(savedNodes()).toEqual([{ kind: "product-card", productId: "pc_x" }]);
  });

  it("選べる商品を渡すと、id を覚えなくてよくなる", () => {
    render(
      <Harness
        initial={serializeProse([{ kind: "product-card", productId: "" }])}
        productOptions={[{ value: "pc_x", label: "商品 X" }]}
      />,
    );

    fireEvent.change(screen.getByLabelText("差し込む商品"), { target: { value: "pc_x" } });
    expect(savedNodes()).toEqual([{ kind: "product-card", productId: "pc_x" }]);
  });

  it("画像は、場所を入れたときだけ実物を見せる", () => {
    render(<Harness initial={serializeProse([{ kind: "image", src: "", alt: "" }])} />);

    // 空のまま `img` を出すと、壊れた絵の記号が並ぶ。
    expect(document.querySelector("img")).toBeNull();

    fireEvent.change(screen.getByLabelText("画像の場所"), { target: { value: "/media/a.png" } });
    fireEvent.change(screen.getByLabelText("画像の説明（見えない人へ伝わる言葉）"), {
      target: { value: "棚の写真" },
    });

    expect(document.querySelector("img")?.getAttribute("alt")).toBe("棚の写真");
    expect(savedNodes()).toEqual([{ kind: "image", src: "/media/a.png", alt: "棚の写真" }]);
  });

  it("比較表は列と行を足せ、いちばん下の行だけは残る", () => {
    render(<Harness />);
    typeInParagraph("/");
    fireEvent.click(screen.getByRole("button", { name: "比較表" }));

    const removeRow = screen.getByRole("button", {
      name: "いちばん下の行を消す",
    }) as HTMLButtonElement;
    expect(removeRow.disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "列を足す" }));
    fireEvent.click(screen.getByRole("button", { name: "行を足す" }));
    expect(screen.getByLabelText("3 列目の見出し")).not.toBeNull();
    expect(screen.getByLabelText("2 行 3 列")).not.toBeNull();

    fireEvent.change(screen.getByLabelText("1 列目の見出し"), { target: { value: "型" } });
    fireEvent.change(screen.getByLabelText("1 行 1 列"), { target: { value: "A" } });
    expect(savedNodes()).toEqual([
      { kind: "comparison-table", headers: ["型", "", ""], rows: [["A", "", ""], ["", "", ""]] },
    ]);

    fireEvent.click(screen.getByRole("button", { name: "いちばん下の行を消す" }));
    expect(savedNodes()).toEqual([
      { kind: "comparison-table", headers: ["型", "", ""], rows: [["A", "", ""]] },
    ]);
  });
});

describe("読み上げと操作", () => {
  it("断片が並んでいても、自動検査に違反がない", async () => {
    // 同じ絵のボタンが断片の数だけ並ぶ形が、いちばん名前を取り違えやすい。
    render(
      <Harness
        initial={serializeProse([
          { kind: "heading", level: 3, text: "章" },
          { kind: "bullet-list", items: ["あ", "い"] },
          { kind: "callout", tone: "tip", title: "こつ", text: "中身" },
          { kind: "comparison-table", headers: ["型", "値"], rows: [["A", "1"]] },
          { kind: "image", src: "/media/a.png", alt: "棚の写真" },
          { kind: "divider" },
        ])}
      />,
    );

    const violations = await findA11yViolations(
      asPartOfPage(document.body.innerHTML),
    );
    expect(violations, describeViolations(violations)).toEqual([]);
  });
});
