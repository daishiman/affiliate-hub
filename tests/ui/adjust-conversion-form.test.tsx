/** @tier 2 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdjustConversionForm } from "@/presentation/admin/earn/adjust-conversion-form";

/**
 * 成果の画面から金額を直す欄。
 *
 * --- ここで固定したいこと ---
 *
 * **通貨を画面で選ばせないこと。** 選べると、ドル建ての成果に円を指定できる。
 * 金額の話なので、間違えても画面上は普通の数字に見え、締めるまで気づけない。
 *
 * **取り込んだ額を初期値に入れないこと。** 入っていると、確認せずに送って
 * しまい、直していないのに「手で直した額」の欄が埋まる。以後この成果は
 * 「人が確認して決めた額」として扱われる。
 *
 * **理由を入れるまで押せないこと。** 金額だけ直せると、あとから見た人に
 * 「なぜこの額なのか」が一切残らない。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §2
 */

function render(currency: "JPY" | "USD" = "JPY"): string {
  return renderToStaticMarkup(
    <AdjustConversionForm conversionId="cv_2026_08_a" currency={currency} />,
  );
}

describe("成果の金額を直す欄", () => {
  it("どの成果を、どの通貨で直すのかを一緒に送る", () => {
    const html = render();
    expect(html).toContain('value="cv_2026_08_a"');
    expect(html).toContain('value="JPY"');
  });

  it("通貨は選ばせない", () => {
    // 選択肢として出すと、ドル建ての成果に円を指定できてしまう。
    const html = render("USD");
    expect(html).not.toContain("<select");
    expect(html).toContain('value="USD"');
  });

  it("通貨に合わせた単位が欄に出る", () => {
    expect(render("JPY")).toContain("円");
    expect(render("USD")).toContain("ドル");
  });

  it("取り込んだ額を初期値に入れない", () => {
    // 空で始める。埋まっていると、見ずにそのまま送られる。
    const html = render();
    expect(html).toMatch(/name="amount"[^>]*value=""/);
  });

  it("金額と理由が空のうちは押せない", () => {
    expect(render()).toContain("disabled");
  });

  it("取り込んだ額が消えないことを、押す前に書いてある", () => {
    // 押したあとに説明しても、押すのをためらった人には届かない。
    expect(render()).toContain("取り込んだ額は消えません");
  });

  it("理由を残す欄があり、なぜ要るのかが書いてある", () => {
    const html = render();
    expect(html).toContain('name="reason"');
    expect(html).toContain("根拠");
  });

  it("AI から呼ぶ名前が、道具の名前と同じである", () => {
    expect(render()).toContain('toolname="adjust_conversion_reward"');
  });
});
