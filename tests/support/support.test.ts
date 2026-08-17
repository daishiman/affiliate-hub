/** @tier 1 */
import { describe, expect, it } from "vitest";
import { ok } from "@/domain/shared/result";
import { describeViolations, findA11yViolations } from "./a11y";
import { boundaryValues, dateBoundaries, resetFactories, aProduct } from "./factories";
import { focusableOrder, headingLevels, intoDom, textOf } from "./render";
import { anOutsider, anOwner, WORKSPACE, OTHER_WORKSPACE } from "./actors";
import { failing, testDeps } from "./doubles";
import { fixedClock, sequentialIds, NOW } from "./clock";

/**
 * テストの土台そのものの検査。
 *
 * 土台が黙って壊れると、**土台を使っている全テストが「何も確かめないまま緑」**になる。
 * これは 1 つのテストが落ちるより悪い。落ちないので誰も気づかない。
 */

describe("読み上げの自動検査が、実際に違反を見つける", () => {
  it("代替テキストの無い画像を見つける", async () => {
    const violations = await findA11yViolations(`<img src="/a.png">`);
    expect(violations.map((v) => v.id)).toContain("image-alt");
  });

  it("正しい HTML では何も指摘しない", async () => {
    const violations = await findA11yViolations(
      `<main><h1>見出し</h1><img src="/a.png" alt="順位表の様子"><p>本文</p></main>`,
    );
    expect(describeViolations(violations)).toBe("");
  });

  it("指摘には、どの要素かが必ず入る（開き直さないと直せない指摘を出さない）", async () => {
    const violations = await findA11yViolations(`<img src="/a.png">`);
    for (const v of violations) {
      expect(v.targets.length, `${v.id} に該当要素がありません`).toBeGreaterThan(0);
      expect(v.help.trim()).not.toBe("");
    }
  });
});

describe("描画の補助", () => {
  it("文字だけを取り出す（属性値に紛れた同じ文字列を拾わない）", () => {
    const html = `<a href="/広告について" class="広告">案内</a>`;
    expect(textOf(html)).toBe("案内");
    expect(textOf(html)).not.toContain("広告について");
  });

  it("キーボードで辿れる要素を、出てくる順に返す", () => {
    const { document, cleanup } = intoDom(
      `<a href="/a">最初</a><button>次</button><input name="q"><span>対象外</span>`,
    );
    expect(focusableOrder(document)).toEqual(["a:最初", "button:次", "input:q"]);
    cleanup();
  });

  it("押せない要素を、辿れる要素として数えない", () => {
    const { document, cleanup } = intoDom(`<button disabled>押せない</button><a>行き先なし</a>`);
    expect(focusableOrder(document)).toEqual([]);
    cleanup();
  });

  it("見出しの深さを上から順に返す", () => {
    const { document, cleanup } = intoDom(`<h1>あ</h1><h2>い</h2><h4>う</h4>`);
    expect(headingLevels(document)).toEqual([1, 2, 4]);
    cleanup();
  });
});

describe("実行主体", () => {
  it("別の作業場所の人は、権限を持ったまま作業場所だけが違う", () => {
    // ここが要点。権限の無い人でテナント分離を確かめると、
    // 権限検査で落ちるだけで、分離が抜けていても気づけない。
    const outsider = anOutsider();
    expect(outsider.roles).toEqual(anOwner().roles);
    expect(outsider.workspaceId).toBe(OTHER_WORKSPACE);
    expect(anOwner().workspaceId).toBe(WORKSPACE);
  });

  it("AI のサービスアカウントは、その旨を必ず名乗る", () => {
    // 名乗らないと、公開を止める判断が効かない（§25）。
    expect(anOwner().isAiServiceAccount).toBe(false);
  });
});

describe("つなぎ目の差し替え", () => {
  it("指定した口だけが入れ替わり、他の口が 1 つも欠けない", () => {
    // ここが土台の本体。差し替えのたびに口が欠けると、
    // 「テストでは動くが本番で undefined」という最も分かりにくい壊れ方をする。
    const base = testDeps();
    const replaced = testDeps({ products: { search: async () => ok({ items: [], nextCursor: null }) } });
    expect(Object.keys(replaced).sort()).toEqual(Object.keys(base).sort());
  });

  it("同じ口の中の、差し替えていない処理は残る", () => {
    const base = testDeps();
    const replaced = testDeps({ products: { search: async () => ok({ items: [], nextCursor: null }) } });
    expect(Object.keys(replaced.products).sort()).toEqual(Object.keys(base.products).sort());
  });

  it("繋がっていない口は、成功したふりをせず失敗を返す", () => {
    const result = failing<string>();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_IMPLEMENTED");
      // 「できません」で終わらせない。次に何をすればよいかを書く。
      expect(result.error.suggestedAction?.trim()).not.toBe("");
    }
  });
});

describe("時刻と ID の固定", () => {
  it("時計は指示したぶんだけ進み、勝手に進まない", () => {
    const clock = fixedClock();
    expect(clock.now()).toEqual(NOW);
    expect(clock.now()).toEqual(NOW);
    clock.advanceHours(25);
    expect(clock.now().getTime() - NOW.getTime()).toBe(25 * 60 * 60 * 1000);
  });

  it("ID は毎回同じ順で出る", () => {
    expect([sequentialIds("x").generate(), sequentialIds("x").generate()]).toEqual([
      "x-0001",
      "x-0001",
    ]);
  });
});

describe("組み立ての土台", () => {
  it("何も指定しなければ、そのままで検査を通る値になる", () => {
    resetFactories();
    const product = aProduct();
    expect(product.workspaceId).toBe(WORKSPACE);
    expect(product.provenance.confidence).toBeGreaterThan(0.5);
    expect(product.discontinuedAt).toBeNull();
  });

  it("関心のある項目だけを上書きできる", () => {
    const product = aProduct({ name: "Alpha Studio 15" });
    expect(product.name).toBe("Alpha Studio 15");
    expect(product.brand).toBe("テストブランド");
  });
});

describe("境界値の並べ方", () => {
  it("上限+1 が必ず含まれる（書き忘れが最も多く、壊れると最も痛い）", () => {
    const values = boundaryValues(10).map((b) => b.value);
    expect(values).toEqual([0, 1, 10, 11]);
    expect(boundaryValues(10).at(-1)?.inRange).toBe(false);
  });

  it("日付の境界は、UTC と日本時間で 9 時間ずれることを持っている", () => {
    const b = dateBoundaries();
    expect(b.startOfDayUtc.getTime() - b.startOfDayJst.getTime()).toBe(9 * 60 * 60 * 1000);
  });
});
