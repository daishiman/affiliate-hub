import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Field } from "@/presentation/ui/primitives/field";
import { ToolForm } from "@/presentation/ui/primitives/tool-form";

/**
 * 「画面でできることは AI からもできる」を、部品の出力で確かめる。
 *
 * 属性名は小文字でないと読み取られない。
 * React が camelCase に直してしまう事故が起きやすいので、出力を直接見る。
 */

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
