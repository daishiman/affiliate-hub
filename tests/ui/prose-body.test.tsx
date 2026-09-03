/**
 * @tier 2
 * @req REQ-BOPS04, REQ-BOPS05
 * @types screen-states, equivalence, boundary
 *
 * 本文を読者に見せる側（`ProseBody`）。
 *
 * --- なぜ書く側の検査では足りないのか ---
 *
 * `prose-editor.test.tsx` が見ているのは**保存される文字列**である。
 * 文字列が正しくても、読者側の描き方が別の枝を通れば、
 * 運営者が編集中に見ていたものと読者が見るものはずれる。
 * **ずれた側は誰も気づかない**——運営者は自分の画面しか見ないからである。
 *
 * 実測（2026-08-27）では `prose-body.tsx` の分岐が 5.5%。断片は 10 種あるのに、
 * 画面の総当たりが通るのは実際に見本データへ入っている 1〜2 種だけだった。
 *
 * 割り方（`parseProse`）の正しさは `tests/domain/blogops` が見ている。
 * ここで見るのは**割った結果をどう描くか**だけ:
 *
 * 1. 10 種すべてが、それぞれの意味を持つ印で出る。
 * 2. 出せないものは出さない（商品カードの描き方が無いとき）。
 * 3. 端の入力でも読者から情報が消えない（表の桁不揃い・空の代替文）。
 */
// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { type ProseNode, serializeProse } from "@/domain/blogops";
import { ProseBody } from "@/presentation/prose/prose-body";

afterEach(cleanup);

/**
 * 断片から本文の文字列を作って描く。
 *
 * **`ProseNode` を直接渡さないのは、本物がそうしないため。**
 * 読者側が受け取るのは保存された文字列で、割り直すところから始まる。
 * ここを飛ばすと、書いた形が読める形に戻らない不具合を素通りさせる。
 */
function renderBody(
  nodes: readonly ProseNode[],
  options?: { readonly renderProductCard?: (productId: string) => React.ReactNode },
) {
  return render(
    <ProseBody
      body={serializeProse(nodes)}
      keyPrefix="sec-1"
      renderProductCard={options?.renderProductCard}
    />,
  );
}

describe("10 種の断片を、それぞれの意味を持つ印で描く", () => {
  it("段落は p で出る", () => {
    const { container } = renderBody([{ kind: "paragraph", text: "道具を選ぶ前に決めること。" }]);

    expect(container.querySelector("p")?.textContent).toBe("道具を選ぶ前に決めること。");
  });

  it("見出しは段の深さを保って出る（h3 と h4）", () => {
    renderBody([
      { kind: "heading", level: 3, text: "選び方" },
      { kind: "heading", level: 4, text: "予算から決める" },
    ]);

    // 節の見出しが h2 なので、本文の中は h3 と h4 しか取らない。
    // 飛び級を作ると、読み上げが伝える位置が実際の構造とずれる。
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("選び方");
    expect(screen.getByRole("heading", { level: 4 }).textContent).toBe("予算から決める");
  });

  it("並びは ul、順番付きは ol で出る（印の意味が違う）", () => {
    const { container } = renderBody([
      { kind: "bullet-list", items: ["軽さ", "静かさ"] },
      { kind: "ordered-list", items: ["測る", "選ぶ", "試す"] },
    ]);

    expect(container.querySelectorAll("ul > li")).toHaveLength(2);
    expect(container.querySelectorAll("ol > li")).toHaveLength(3);
  });

  it("引用は blockquote で出て、行ごとに分かれる", () => {
    const { container } = renderBody([{ kind: "quote", text: "一行目\n二行目" }]);

    const quote = container.querySelector("blockquote");
    expect(quote).not.toBeNull();
    // 改行を 1 つの p に押し込むと、読者側では続きの文に見える。
    expect(quote?.querySelectorAll("p")).toHaveLength(2);
  });

  it("区切りは hr で出る", () => {
    const { container } = renderBody([{ kind: "divider" }]);

    expect(container.querySelector("hr")).not.toBeNull();
  });

  it("画像は alt を必ず持つ", () => {
    renderBody([{ kind: "image", src: "https://example.test/a.png", alt: "机の全体" }]);

    expect(screen.getByRole("img", { name: "机の全体" })).not.toBeNull();
  });

  it("代替文が空でも、属性そのものは落とさない", () => {
    const { container } = renderBody([{ kind: "image", src: "https://example.test/a.png", alt: "" }]);

    const img = container.querySelector("img");
    // 空の `alt` は「読み飛ばしてよい絵」の意味。属性ごと落とすと、
    // 読み上げはファイル名を読み始める。**無いのと空は別。**
    expect(img?.getAttribute("alt")).toBe("");
  });
});

describe("注意書き（callout）", () => {
  it("記事の中の注意書きなので、読み上げに割り込ませない", () => {
    const { container } = renderBody([
      { kind: "callout", tone: "warn", title: "注意", text: "電源の形を確かめてください。" },
    ]);

    const aside = container.querySelector("aside");
    expect(aside).not.toBeNull();
    // `role="alert"` などを付けると、記事を読み進めている人の順序を壊す。
    // 画面が操作を止めた理由（`Callout`）とは別物である。
    expect(aside?.getAttribute("role")).toBeNull();
  });

  it("見出しがあれば強調して出す", () => {
    const { container } = renderBody([
      { kind: "callout", tone: "info", title: "補足", text: "本文" },
    ]);

    expect(container.querySelector("strong")?.textContent).toBe("補足");
  });

  it("見出しが空なら、空の強調を置かない", () => {
    const { container } = renderBody([{ kind: "callout", tone: "info", title: "", text: "本文" }]);

    // 空の `strong` を置くと、読み上げは「見出しがある」と伝えて中身を読まない。
    expect(container.querySelector("strong")).toBeNull();
  });

  it("見出しが空白だけでも、空として扱う", () => {
    const { container } = renderBody([
      { kind: "callout", tone: "note", title: "   ", text: "本文" },
    ]);

    expect(container.querySelector("strong")).toBeNull();
  });

  it("4 つの調子すべてに、それぞれの印が出る", () => {
    for (const tone of ["info", "tip", "warn", "note"] as const) {
      const { container, unmount } = renderBody([
        { kind: "callout", tone, title: "", text: "本文" },
      ]);

      // 調子ごとに違う印が出ないと、色を見分けられない人には
      // 4 種すべてが同じ注意書きに見える。
      expect(container.querySelector("svg")).not.toBeNull();
      unmount();
    }
  });

  it("本文の改行は行ごとに分かれる", () => {
    const { container } = renderBody([
      { kind: "callout", tone: "tip", title: "", text: "一行目\n二行目\n三行目" },
    ]);

    expect(container.querySelectorAll("aside p")).toHaveLength(3);
  });
});

describe("商品カード", () => {
  it("描き方を渡されていれば、その通りに描く", () => {
    renderBody([{ kind: "product-card", productId: "prod-1" }], {
      renderProductCard: (id) => <span data-testid="card">{id}</span>,
    });

    expect(screen.getByTestId("card").textContent).toBe("prod-1");
  });

  it("描き方が無ければ、何も出さない", () => {
    const { container } = renderBody([{ kind: "product-card", productId: "prod-1" }]);

    // 空の枠や「読み込み中」を出すと、読者にはそれが記事の一部に見える。
    // **出せないものは出さない。**
    expect(container.textContent).toBe("");
  });

  it("商品の名前や価格を、本文の側では持たない", () => {
    renderBody([{ kind: "product-card", productId: "prod-1" }], {
      renderProductCard: (id) => <span data-testid="card">{id}</span>,
    });

    // 渡るのは ID だけ。ここで名前を持つと、商品を直した日に
    // 記事が古い名前を出し続ける。
    expect(screen.getByTestId("card").textContent).toBe("prod-1");
  });
});

describe("比べる表", () => {
  it("見出しと中身が、表の印の中に出る", () => {
    renderBody([
      {
        kind: "comparison-table",
        headers: ["名前", "重さ"],
        rows: [["A", "1.2kg"]],
      },
    ]);

    expect(screen.getByRole("table")).not.toBeNull();
    expect(screen.getByRole("columnheader", { name: "名前" })).not.toBeNull();
    expect(screen.getByRole("cell", { name: "1.2kg" })).not.toBeNull();
  });

  it("桁が足りない行も落とさず、足りない桁は空で埋める", () => {
    const { container } = renderBody([
      {
        kind: "comparison-table",
        headers: ["名前", "重さ", "値段"],
        rows: [
          ["A", "1.2kg", "1万円"],
          ["B"],
        ],
      },
    ]);

    const bodyRows = container.querySelectorAll("tbody tr");
    // **行を落とさない。**落とすと、運営者から見て
    // 「保存したら表の行が消えた」ことになる。
    expect(bodyRows).toHaveLength(2);
    // 列数は見出しの数に揃える。揃えないと、読み上げが桁と見出しを結べない。
    expect(bodyRows[1]?.querySelectorAll("td")).toHaveLength(3);
  });
});

describe("並んだ断片", () => {
  it("書かれた順のまま描く", () => {
    const { container } = renderBody([
      { kind: "heading", level: 3, text: "見出し" },
      { kind: "paragraph", text: "段落" },
      { kind: "divider" },
    ]);

    const kinds = [...container.children].map((el) => el.tagName.toLowerCase());
    expect(kinds).toEqual(["h3", "p", "hr"]);
  });

  it("素の文章は、段落だけとして描かれる", () => {
    const { container } = render(<ProseBody body="ただの文章です。" keyPrefix="sec-1" />);

    expect(container.querySelector("p")?.textContent).toBe("ただの文章です。");
  });

  it("空の本文では何も描かない", () => {
    const { container } = render(<ProseBody body="" keyPrefix="sec-1" />);

    expect(container.textContent).toBe("");
  });
});
