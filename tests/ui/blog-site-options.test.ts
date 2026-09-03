/**
 * @tier 2
 * @req REQ-BLOG01
 * @types contract
 *
 * 5 画面が共有する「どのブログの話か」の選択肢。
 *
 * ここを検査するのは、選択肢の作り方が 1 か所にあること自体は
 * 型では言えないため。木の並び・カテゴリの同梱・空のときの理由は
 * どれも画面に出る前の判断で、出てからでは違いに気づけない。
 */
import { describe, expect, it } from "vitest";
import { blogSiteOptions, pickSiteSlug } from "@/presentation/admin/publish/blog-site-options";

describe("blogSiteOptions", () => {
  it("保存先が無い実行では、空の選択肢を黙って返さず理由を付ける", async () => {
    // 空の一覧だけを返すと、画面には「ブログが 1 本も無い」に見える。
    // 本当は保存先が無いだけで、ブログを足しても直らない。
    // **見えている状態と、その原因が食い違う**のがいちばん直せない形なので、
    // 選択肢が空になる経路には必ず理由を同伴させる。
    const { options, emptyReason } = await blogSiteOptions();

    expect(options).toEqual([]);
    expect(emptyReason).not.toBeNull();
    expect(emptyReason).toContain("保存先");
  });
});

describe("pickSiteSlug", () => {
  const options = [{ value: "first-camera" }, { value: "run-and-recover" }];

  it("?site= が選択肢にあればそれを使う", () => {
    expect(pickSiteSlug({ site: "run-and-recover" }, options)).toBe("run-and-recover");
  });

  it("配列で来た ?site= は先頭だけを見る", () => {
    expect(pickSiteSlug({ site: ["run-and-recover", "first-camera"] }, options)).toBe(
      "run-and-recover",
    );
  });

  it("選択肢に無い ?site= は黙って先頭へ落とす", () => {
    // 「選んでください」で止めないのは、打ち間違いや古いリンクで
    // 画面が何も出せなくなる方が、別のブログを見せるより困るため。
    expect(pickSiteSlug({ site: "存在しない" }, options)).toBe("first-camera");
  });

  it("?site= が無ければ先頭を使う", () => {
    expect(pickSiteSlug({}, options)).toBe("first-camera");
  });

  it("選択肢が空なら null を返し、先頭を捏造しない", () => {
    expect(pickSiteSlug({ site: "first-camera" }, [])).toBeNull();
  });
});
