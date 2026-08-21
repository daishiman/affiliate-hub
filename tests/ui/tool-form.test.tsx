/**
 * @tier 2
 * @req REQ-WC05
 * @types equivalence, decision-table
 *
 * 「画面でできることは AI からもできる」を、部品の出力で確かめる。
 *
 * 属性名は小文字でないと読み取られない。
 * React が camelCase に直してしまう事故が起きやすいので、出力を直接見る。
 *
 * 性質は `has-enumerated-input`。宣言型フォームの入力は
 * **仕様 §3 が挙げる属性 4 つ**という列挙で、大小の端が無い。
 * 端が無いものに境界値は書けないので、代わりに判定表で
 * **4 つのうち 1 つも落ちていないこと**を見る。
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Field } from "@/presentation/ui/primitives/field";
import { ToolForm } from "@/presentation/ui/primitives/tool-form";

/*
  仕様 §3 が挙げる属性 4 つ。**この一覧が判定表の行そのもの**である。

  1 つずつ `it` を書くと、仕様に 5 つ目が増えたときに気づけない。
  書いた側は 4 つ書いた時点で網羅した気になり、読む側も 4 つ並んでいれば
  足りて見える。一覧を 1 か所に置き、行数を数えることでしか気づけない。
*/
const DECLARATIVE_ATTRS = [
  { 属性: "toolname", 出す: true, なぜ: "AI が操作の名前として読む" },
  { 属性: "tooldescription", 出す: true, なぜ: "AI が何をする操作かを読む" },
  { 属性: "toolparamdescription", 出す: true, なぜ: "AI が各入力欄の意味を読む" },
  {
    属性: "toolautosubmit",
    出す: false,
    なぜ: "状態を変えるフォームで使うと、AI が確認画面を飛ばして送信できる（統合仕様 §3 で禁止）",
  },
] as const;

describe("宣言型フォームの属性（判定表）", () => {
  it("仕様が挙げる属性 4 つが、1 つも欠けずに表に並んでいる", () => {
    expect(DECLARATIVE_ATTRS.length).toBe(4);
    expect(new Set(DECLARATIVE_ATTRS.map((a) => a.属性)).size).toBe(4);
  });

  it.each(DECLARATIVE_ATTRS.map((a) => [`${a.属性}: ${a.出す ? "出す" : "出さない"}（${a.なぜ}）`, a] as const))(
    "%s",
    (_name, a) => {
      // 渡せる限りの属性をすべて渡した出力を 1 つ作り、そこに何が出ているかで判定する。
      const html =
        renderToStaticMarkup(
          <ToolForm toolName="createContentPackage" toolDescription="新しく作ります">
            <Field
              label="記事の題名"
              value=""
              onValueChange={() => {}}
              toolParamDescription="記事の題名。30 文字以内。"
            />
          </ToolForm>,
        );
      expect(html.includes(`${a.属性}=`)).toBe(a.出す);
    },
  );

  it("渡さなければ、属性そのものが出ない（空文字で出すと AI が空の説明を読む）", () => {
    const html = renderToStaticMarkup(<Field label="補足" value="" onValueChange={() => {}} />);
    expect(html).not.toContain("toolparamdescription=");
  });
});

describe("人と AI の両方から使えるフォーム", () => {
  it("操作の名前と説明が小文字の属性で出る", () => {
    const html = renderToStaticMarkup(
      <ToolForm toolName="createContentPackage" toolDescription="コンテンツパッケージを新しく作ります">
        <p>中身</p>
      </ToolForm>,
    );
    expect(html).toContain('toolname="createContentPackage"');
    expect(html).toContain('tooldescription="コンテンツパッケージを新しく作ります"');
    // camelCase で出てはいけない
    expect(html).not.toContain("toolName=");
  });

  it("入力欄の説明が小文字の属性で出る", () => {
    const html = renderToStaticMarkup(
      <Field
        label="記事の題名"
        value=""
        onValueChange={() => {}}
        toolParamDescription="記事の題名。30 文字以内。"
      />,
    );
    expect(html).toContain('toolparamdescription="記事の題名。30 文字以内。"');
  });
});

describe("入力欄の作法", () => {
  it("任意の欄にだけ印を付ける", () => {
    const optional = renderToStaticMarkup(
      <Field label="補足" value="" onValueChange={() => {}} optional />,
    );
    expect(optional).toContain("任意");

    const required = renderToStaticMarkup(<Field label="題名" value="" onValueChange={() => {}} />);
    // 必須側に「必須」と書かない（ほとんどが必須なので印が意味を失う）
    expect(required).not.toContain("必須");
  });

  it("自動で入った値は、由来を必ず添える", () => {
    const html = renderToStaticMarkup(
      <Field
        label="想定読了時間"
        value=""
        onValueChange={() => {}}
        autoValue="6 分"
        autoValueSource="本文の文字数からの概算"
      />,
    );
    expect(html).toContain("自動で入りました");
    expect(html).toContain("本文の文字数からの概算");
  });

  it("エラーは読み上げにも届く形で出す", () => {
    const html = renderToStaticMarkup(
      <Field label="価格" value="abc" onValueChange={() => {}} error="半角数字で入力してください" />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain("半角数字で入力してください");
  });
});
