/**
 * @tier 2
 * @req REQ-UX02, REQ-BOPS04, REQ-BOPS05
 * @types screen-states, a11y
 */
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type ProseNode,
  type ProseNodeKind,
  PROSE_MENU_ORDER,
  PROSE_NODE_KINDS,
  PROSE_NODE_METADATA,
  parseProse,
  serializeProse,
} from "@/domain/blogops";
import { ProseEditor, type ProductPick } from "@/presentation/prose/prose-editor";
import { asPartOfPage, describeViolations, findA11yViolations } from "../support/a11y";
import { PROSE_NODE_FIXTURE_BY_KIND } from "../domain/blogops/prose-node-fixture";

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
  onSearchProducts,
  onUploadImage,
}: {
  readonly initial?: string;
  readonly onSearchProducts?: (query: string) => Promise<readonly ProductPick[]>;
  readonly onUploadImage?: (file: File) => Promise<string>;
}) {
  const [value, setValue] = useState(initial);
  return (
    <ProseEditor
      label="本文"
      name="body"
      onSearchProducts={onSearchProducts}
      onUploadImage={onUploadImage}
      onValueChange={setValue}
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

/**
 * 装飾つきの欄へ文字を打つ。
 *
 * `<textarea>` ではなく `contenteditable` なので `change` は飛ばない。
 * 中身を差し替えて `input` を起こすのが、ブラウザで打ったときと同じ道筋になる
 * （欄は `onInput` で DOM を読み直して保存の文字列を組み立てる）。
 */
function typeInto(label: string, text: string): void {
  const field = screen.getByRole("textbox", { name: label });
  field.textContent = text;
  fireEvent.input(field);
}

function typeInParagraph(text: string): void {
  typeInto("段落", text);
}

const PROSE_EDITOR_PROBE: Readonly<Record<ProseNodeKind, () => boolean>> = {
  paragraph: () => screen.queryByLabelText("段落") !== null,
  heading: () => screen.queryByLabelText("小見出しの深さ") !== null,
  "bullet-list": () => screen.queryAllByText("・").length === 2,
  "ordered-list": () => screen.queryByText("1.") !== null,
  quote: () => screen.queryByLabelText("引用") !== null,
  callout: () => screen.queryByLabelText("注意書きの調子") !== null,
  "product-card": () => screen.queryByText("選択済みの商品") !== null,
  "comparison-table": () => screen.queryByRole("table") !== null,
  image: () => screen.queryByRole("img", { name: "机の全体" }) !== null,
  divider: () => screen.queryByRole("separator") !== null,
  code: () => screen.queryByLabelText("プログラムの中身") !== null,
  table: () => screen.queryByRole("table") !== null,
  "image-row": () => screen.queryAllByRole("img").length === 2,
  toggle: () => screen.queryByLabelText("折りたたみの見出し") !== null,
  checklist: () => screen.queryByRole("checkbox", { name: "1 番目に印を付ける" }) !== null,
  embed: () => screen.queryByLabelText("埋め込みの宛先") !== null,
  "cta-button": () => screen.queryByLabelText("ボタンの行き先") !== null,
  "link-card": () => screen.queryByLabelText("リンクカードの行き先") !== null,
  columns: () => screen.queryByLabelText("左の段") !== null,
};

describe("全種類の編集 consumer", () => {
  for (const kind of PROSE_NODE_KINDS) {
    it(`${kind} の専用編集面を出す`, () => {
      render(
        <Harness
          initial={serializeProse([PROSE_NODE_FIXTURE_BY_KIND[kind]])}
          onSearchProducts={async () => []}
          onUploadImage={async () => "/api/article-images/uploaded"}
        />,
      );

      expect(PROSE_EDITOR_PROBE[kind]()).toBe(true);
    });
  }
});

describe("`/` で部品を足す", () => {
  it("空の段落で `/` を打つと、部品の一覧が出る", () => {
    render(<Harness />);
    expect(screen.queryByRole("button", { name: "小見出し" })).toBeNull();

    typeInParagraph("/");

    expect(screen.getByRole("button", { name: "小見出し" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "比較表" })).not.toBeNull();
  });

  it("一覧は群に分かれ、段落を含む全 19 種が出る", () => {
    render(<Harness />);
    typeInParagraph("/");

    // 群の見出しが無いと、19 個が 1 列に並び、下端で切れたものが「無い」ことになる。
    for (const group of ["文章", "一覧", "見せ方", "データ", "差し込み"]) {
      expect(screen.getByText(group)).not.toBeNull();
    }
    // 要件上の全種類を、正本の同じ入口から挿せる。
    expect(PROSE_MENU_ORDER).toHaveLength(PROSE_NODE_KINDS.length);
    expect(screen.getByRole("button", { name: "段落" })).not.toBeNull();
    for (const kind of PROSE_MENU_ORDER) {
      expect(screen.getByRole("button", { name: PROSE_NODE_METADATA[kind].label })).not.toBeNull();
    }
  });

  it("続けて打った文字で絞る。名前でも読みでも当たる", () => {
    render(<Harness />);

    // metadata の読みで当てる。`list` は前方一致では拾えない。
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

    typeInto("引用", "引いた文");

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

/**
 * 段の深さは断片が自分で持ち、並びの位置からは導かない (FRONT-REQ-008・受け入れ A2)。
 *
 * ここが位置から導かれていると、上下に動かした瞬間に見出し 3 が 4 になり、
 * 記事の骨格が編集操作で崩れる。読者の目次も一緒に崩れる。
 */
describe("小見出しの深さは、動かしても消しても変わらない", () => {
  const MIXED = serializeProse([
    { kind: "heading", level: 4, text: "深いほう" },
    { kind: "paragraph", text: "あいだ" },
    { kind: "heading", level: 3, text: "浅いほう" },
  ]);

  it("上下に動かしても深さは持ち回る", () => {
    render(<Harness initial={MIXED} />);
    // 同じ名前のボタンが小見出しの数だけ並ぶ。2 つ目＝下の「浅いほう」を動かす。
    const ups = screen.getAllByRole("button", { name: "小見出しを 1 つ上へ" });
    fireEvent.click(ups[1] as HTMLButtonElement);

    expect(savedNodes()).toEqual([
      { kind: "heading", level: 4, text: "深いほう" },
      { kind: "heading", level: 3, text: "浅いほう" },
      { kind: "paragraph", text: "あいだ" },
    ]);
  });

  it("あいだの断片を消しても深さは変わらない", () => {
    render(<Harness initial={MIXED} />);
    fireEvent.click(screen.getByRole("button", { name: "段落を消す" }));

    expect(savedNodes()).toEqual([
      { kind: "heading", level: 4, text: "深いほう" },
      { kind: "heading", level: 3, text: "浅いほう" },
    ]);
  });

  it("選べるのは 3 と 4 だけで、節の見出し (2) は出てこない", () => {
    render(<Harness initial={serializeProse([{ kind: "heading", level: 3, text: "章" }])} />);
    const select = screen.getByLabelText("小見出しの深さ") as unknown as HTMLSelectElement;

    expect([...select.options].map((option) => option.value)).toEqual(["3", "4"]);
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
    typeInto("小見出しの文言", "新");

    expect(savedNodes()).toEqual([{ kind: "heading", level: 3, text: "新" }]);
  });

  it("箇条書きは項目を足せ、1 つしかないときは消せない", () => {
    render(<Harness initial={serializeProse([{ kind: "bullet-list", items: ["ひとつ"] }])} />);

    const remove = screen.getByRole("button", {
      name: "1 番目の項目を消す",
    }) as HTMLButtonElement;
    expect(remove.disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "項目を足す" }));
    typeInto("2 番目の項目", "ふたつ");
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
    typeInto("注意書きの題名", "注意");
    typeInto("注意書きの本文", "危ない");

    expect(savedNodes()).toEqual([
      { kind: "callout", tone: "warn", title: "注意", text: "危ない" },
    ]);
  });

  it("やることリストは、印を押して切り替えられる", () => {
    render(
      <Harness
        initial={serializeProse([
          { kind: "checklist", items: [{ text: "買う", checked: false }] },
        ])}
      />,
    );

    fireEvent.click(screen.getByLabelText("1 番目に印を付ける"));
    expect(savedNodes()).toEqual([
      { kind: "checklist", items: [{ text: "買う", checked: true }] },
    ]);
  });

  it("プログラムの欄は装飾を通さない。記号がそのまま残る", () => {
    render(<Harness initial={serializeProse([{ kind: "code", language: "", text: "" }])} />);

    fireEvent.change(screen.getByLabelText("プログラムの言語（決めなくても構いません）"), {
      target: { value: "ts" },
    });
    // `**` を太字として食べてしまうと、貼り付けたプログラムが書き換わる。
    fireEvent.change(screen.getByLabelText("プログラムの中身"), {
      target: { value: "const a = b ** 2;" },
    });

    expect(savedNodes()).toEqual([
      { kind: "code", language: "ts", text: "const a = b ** 2;" },
    ]);
  });

  it("画像の横並びは 2〜4 枚のあいだでしか増減しない", () => {
    render(
      <Harness
        initial={serializeProse([
          {
            kind: "image-row",
            images: [
              { src: "/media/a.png", alt: "あ" },
              { src: "/media/b.png", alt: "い" },
            ],
          },
        ])}
        onUploadImage={async () => "/media/c.png"}
      />,
    );

    const remove = screen.getByRole("button", {
      name: "いちばん右の絵を外す",
    }) as HTMLButtonElement;
    // 2 枚を下回ると「横並び」ではなくなるので、そこで止める。
    expect(remove.disabled).toBe(true);

    const add = screen.getByRole("button", { name: "並べる絵を 1 枚足す" });
    fireEvent.click(add);
    fireEvent.click(add);
    expect((add as HTMLButtonElement).disabled).toBe(true);
  });

  it("行き先が通らないとき、保存を待たずにその場で言う", () => {
    render(
      <Harness
        initial={serializeProse([
          { kind: "cta-button", href: "/s/a", label: "見る", tone: "action" },
        ])}
      />,
    );
    const href = screen.getByLabelText("ボタンの行き先");

    fireEvent.change(href, { target: { value: "javascript:alert(1)" } });

    expect(href.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("この行き先は使えません。")).not.toBeNull();
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

    typeInto("1 列目の見出し", "型");
    typeInto("1 行 1 列", "A");
    expect(savedNodes()).toEqual([
      { kind: "comparison-table", headers: ["型", "", ""], rows: [["A", "", ""], ["", "", ""]] },
    ]);

    fireEvent.click(screen.getByRole("button", { name: "いちばん下の行を消す" }));
    expect(savedNodes()).toEqual([
      { kind: "comparison-table", headers: ["型", "", ""], rows: [["A", "", ""]] },
    ]);
  });
});

/**
 * 商品カードに id の手入力欄を作らない (受け入れ A4)。
 *
 * 打てるようにすると、存在しない id や他の作業場の id が本文へ入り、
 * 公開されるまで誰も気づかない。**探して選ぶ以外の入り口を作らない**のが要点で、
 * 「探せないときだけ手打ち」という逃げ道も作らない。
 */
describe("商品カードは選んで挿す", () => {
  it("探せない画面では、id を打つ欄を出さずに挿せないと言う", () => {
    render(<Harness initial={serializeProse([{ kind: "product-card", productId: "" }])} />);

    expect(screen.queryByLabelText("商品の id")).toBeNull();
    expect(
      screen.getByText("この画面では商品を探せないため、商品カードは挿せません。"),
    ).not.toBeNull();
  });

  it("探して選ぶと、本文には id だけが乗る", async () => {
    const search = vi.fn(async () => [{ id: "pc_x", name: "商品 X" }]);
    render(
      <Harness
        initial={serializeProse([{ kind: "product-card", productId: "" }])}
        onSearchProducts={search}
      />,
    );

    fireEvent.change(screen.getByLabelText("商品を探す"), { target: { value: "商品" } });

    const hit = await screen.findByRole("button", { name: /商品 X/ });
    fireEvent.click(hit);

    // 名前も値段も本文へは焼き付けない。値段が変わった日に記事が嘘をつく。
    expect(savedNodes()).toEqual([{ kind: "product-card", productId: "pc_x" }]);
    // 選んだあとは名前で確かめられる。id だけ出ても運営者には読めない。
    expect(screen.getByText("商品 X")).not.toBeNull();
  });

  it("検索の失敗を、該当商品が 0 件だったことにしない", async () => {
    render(
      <Harness
        initial={serializeProse([{ kind: "product-card", productId: "" }])}
        onSearchProducts={async () => {
          throw new Error("商品を探せませんでした。");
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("商品を探す"), { target: { value: "商品" } });

    expect(await screen.findByText("商品を探せませんでした。")).not.toBeNull();
    expect(screen.queryByText("見つかりませんでした。")).toBeNull();
  });

  it("正常に 0 件だったときだけ、見つからなかったと伝える", async () => {
    render(
      <Harness
        initial={serializeProse([{ kind: "product-card", productId: "" }])}
        onSearchProducts={async () => []}
      />,
    );

    fireEvent.change(screen.getByLabelText("商品を探す"), { target: { value: "該当なし" } });

    expect(await screen.findByText("見つかりませんでした。")).not.toBeNull();
    expect(screen.queryByText("商品を探せませんでした。")).toBeNull();
  });
});

/**
 * 画像に URL の手入力欄を作らない (受け入れ A5)。
 *
 * よそのサイトの絵を指せると、相手が消した日に記事から絵が消える。
 * 送り先は置き場だけにする。
 */
describe("画像は送って挿す", () => {
  it("送れない画面では、URL を打つ欄を出さずに挿せないと言う", () => {
    render(<Harness initial={serializeProse([{ kind: "image", src: "", alt: "" }])} />);

    expect(screen.queryByLabelText("画像の場所")).toBeNull();
    expect(
      screen.getByText("この画面では画像を送れないため、画像は挿せません。"),
    ).not.toBeNull();
  });

  it("ファイルを選ぶと、返ってきた場所が本文に乗る", async () => {
    render(
      <Harness
        initial={serializeProse([{ kind: "image", src: "", alt: "" }])}
        onUploadImage={async () => "/media/a.png"}
      />,
    );

    // 空のまま `img` を出すと、壊れた絵の記号が並ぶ。
    expect(document.querySelector("img")).toBeNull();

    fireEvent.change(screen.getByLabelText("画像に使うファイル"), {
      target: { files: [new File(["x"], "a.png", { type: "image/png" })] },
    });
    await waitFor(() => expect(document.querySelector("img")).not.toBeNull());

    fireEvent.change(screen.getByLabelText("画像の説明（見えない人へ伝わる言葉）"), {
      target: { value: "棚の写真" },
    });

    expect(document.querySelector("img")?.getAttribute("alt")).toBe("棚の写真");
    expect(savedNodes()).toEqual([{ kind: "image", src: "/media/a.png", alt: "棚の写真" }]);
  });

  it("送れなかった理由を一般文へ潰さず、そのまま画面に出す", async () => {
    render(
      <Harness
        initial={serializeProse([{ kind: "image", src: "", alt: "" }])}
        onUploadImage={async () => {
          throw new Error("画像は 8 MiB 以下にしてください。");
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("画像に使うファイル"), {
      target: { files: [new File(["x"], "large.png", { type: "image/png" })] },
    });

    expect(await screen.findByText("画像は 8 MiB 以下にしてください。")).not.toBeNull();
    expect(screen.queryByText("送れませんでした。もう一度試してください。")).toBeNull();
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
          { kind: "checklist", items: [{ text: "買う", checked: false }] },
          { kind: "toggle", title: "ひらく", text: "なかみ" },
          { kind: "divider" },
        ])}
        onUploadImage={async () => "/media/a.png"}
      />,
    );

    const violations = await findA11yViolations(
      asPartOfPage(document.body.innerHTML),
    );
    expect(violations, describeViolations(violations)).toEqual([]);
  });
});
