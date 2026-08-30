/**
 * @tier 2
 * @req REQ-UX02, REQ-SEO03
 * @types state-transition, boundary
 *
 * 承認済みの記事を自分のブログへ出す欄。
 *
 * --- ここで見ること ---
 *
 * **欄が何から作られているか**と、**選び直したときに何が起きるか**。
 * 出す処理そのもの（`publishArticleAction` の先）は
 * `tests/presentation/` 側が本物の道で確かめている。
 *
 * --- なぜテストを足したか（2026-08-30）---
 *
 * 分岐 60.7%・関数 33.3%。**種類を選び直す・ブログを選び直す・欄を増やす**の
 * どれも 1 度も押されていなかった。この 3 つは全部「書きかけを消さない」ための
 * 作りなのに、消えても緑のままだった。
 */
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublishArticleFormOptions } from "@/application/usecases/site/publish-article";

vi.mock("@/presentation/admin/publish/publish-article-action", () => ({
  publishArticleAction: async () => ({ status: "idle", message: "", field: null }),
}));

const { PublishArticleForm } = await import("@/presentation/admin/publish/publish-article-form");

const OPTIONS: PublishArticleFormOptions = {
  articleTypes: [
    {
      value: "ranking",
      label: "順位づけ",
      sections: [
        { id: "how_to_choose", label: "選び方の基準", purpose: "何で比べたかを書く" },
        { id: "ranking_list", label: "選んだもの", purpose: "順位と理由を書く" },
      ],
    },
    {
      value: "review",
      label: "単品レビュー",
      sections: [{ id: "experience", label: "使ってみて", purpose: "実際に使った結果を書く" }],
    },
  ],
  siteOptions: [
    {
      slug: "hub",
      name: "本店",
      categories: [
        { slug: "chairs", name: "椅子" },
        { slug: "desks", name: "机" },
      ],
    },
    { slug: "annex", name: "別館", categories: [{ slug: "lights", name: "照明" }] },
  ],
  relationshipOptions: [
    { value: "affiliate", label: "成果報酬" },
    { value: "sponsored", label: "提供" },
  ] as PublishArticleFormOptions["relationshipOptions"],
  prefill: {
    title: "静かなノートPCの選び方",
    conclusion: "30dB を下回るものを選べばよい。",
    disclosureMessage: "この記事には広告が含まれます。",
    body: "本文",
  },
};

const value = (name: string) => (document.querySelector(`[name="${name}"]`) as HTMLInputElement | null)?.value;
const namesOf = (name: string) =>
  [...document.querySelectorAll(`[name="${name}"]`)].map((n) => (n as HTMLInputElement).value);

afterEach(cleanup);

function renderForm(options: PublishArticleFormOptions = OPTIONS) {
  return render(<PublishArticleForm publicationId="pub_own_site" options={options} />);
}

describe("最初に出ている値", () => {
  it("もとの記事から写した値が、すでに入っている", () => {
    renderForm();
    /*
      **同じことを 2 回打たせない。** 承認までに書いた題と結論は既に在るので、
      空欄から始めさせると、書き手はそれを写す作業から始めることになる。
    */
    expect(value("title")).toBe(OPTIONS.prefill.title);
    expect(value("conclusion")).toBe(OPTIONS.prefill.conclusion);
    expect(value("disclosureMessage")).toBe(OPTIONS.prefill.disclosureMessage);
  });

  it("出し先と、そのブログの最初のカテゴリーが選ばれている", () => {
    renderForm();
    expect(value("siteSlug")).toBe("hub");
    expect(value("categorySlug")).toBe("chairs");
  });

  it("どの記事を出すのかを添える", () => {
    renderForm();
    expect(document.querySelector('[name="publicationId"]')?.getAttribute("value")).toBe("pub_own_site");
  });
});

describe("記事の種類を選び直す", () => {
  it("原稿の欄が、その種類のものへ入れ替わる", () => {
    renderForm();
    expect(screen.getByLabelText(/選び方の基準/)).toBeTruthy();
    expect(screen.queryByLabelText(/使ってみて/)).toBeNull();

    fireEvent.change(screen.getByLabelText(/記事の種類/), { target: { value: "review" } });

    expect(screen.queryByLabelText(/選び方の基準/)).toBeNull();
    expect(screen.getByLabelText(/使ってみて/)).toBeTruthy();
  });

  it("選び直しても、書いた内容は消えない", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/選び方の基準/), { target: { value: "静音性で比べた" } });

    fireEvent.change(screen.getByLabelText(/記事の種類/), { target: { value: "review" } });
    fireEvent.change(screen.getByLabelText(/記事の種類/), { target: { value: "ranking" } });

    /*
      **選び直しで読み直しをしない**のは、これのため。読み直す作りにすると、
      種類を確かめようと 1 度触っただけで書きかけの原稿が消える。
    */
    expect((screen.getByLabelText(/選び方の基準/) as HTMLTextAreaElement).value).toBe("静音性で比べた");
  });

  it("表に無い種類が選ばれたら、原稿の欄を 1 つも出さない", () => {
    renderForm({ ...OPTIONS, articleTypes: [] });
    expect(screen.queryByLabelText(/選び方の基準/)).toBeNull();
    // 空の一覧でも落とさない。落とすと、記事の構成を消した日に画面が白紙になる。
    expect(screen.getByLabelText(/タイトル/)).toBeTruthy();
  });
});

describe("出し先のブログを選び直す", () => {
  it("カテゴリーも、そのブログのものへ入れ替わる", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/出し先のブログ/), { target: { value: "annex" } });

    expect(value("siteSlug")).toBe("annex");
    /*
      **入れ替えないと、前のブログのカテゴリーが残ったまま送られて弾かれる。**
      弾かれた理由は「カテゴリーが無い」で、書き手には何のことか分からない。
    */
    expect(value("categorySlug")).toBe("lights");
  });

  it("カテゴリーの無いブログを選んだら、カテゴリーを空にする", () => {
    renderForm({
      ...OPTIONS,
      siteOptions: [OPTIONS.siteOptions[0]!, { slug: "annex", name: "別館", categories: [] }],
    });
    fireEvent.change(screen.getByLabelText(/出し先のブログ/), { target: { value: "annex" } });
    // 前のブログの値を残さない。残ると、存在しない組み合わせで送られる。
    expect(value("categorySlug")).toBe("");
  });

  it("出し先が 1 つも無ければ、出すボタンを押させない", () => {
    renderForm({ ...OPTIONS, siteOptions: [] });
    /*
      **押せる状態にしない。** 押せると「出した」と思った書き手が
      画面を閉じ、実際にはどこにも出ていない記事が残る。
    */
    expect(screen.getByText("いまサイトに出す").hasAttribute("disabled")).toBe(true);
    expect(
      screen.getByText("公開前に点検する（まだ出しません）").hasAttribute("disabled"),
    ).toBe(true);
  });
});

describe("欄を増やす", () => {
  it("根拠の欄は、増やしても既に書いた行を消さない", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/言い切り 1/), { target: { value: "30dB を下回る" } });

    fireEvent.click(screen.getByText("根拠の欄を増やす"));

    expect(namesOf("claimStatement")).toEqual(["30dB を下回る", ""]);
    expect(screen.getByLabelText(/言い切り 2/)).toBeTruthy();
  });

  it("根拠の 4 つの欄は、行ごとに独立して直せる", () => {
    renderForm();
    fireEvent.click(screen.getByText("根拠の欄を増やす"));

    const urls = document.querySelectorAll('[name="claimSourceUrl"]');
    fireEvent.change(urls[1]!, { target: { value: "https://example.invalid/spec" } });

    // 1 行目を巻き込まない。巻き込むと、出典が全部同じものに揃う。
    expect(namesOf("claimSourceUrl")).toEqual(["", "https://example.invalid/spec"]);
  });

  it("よくある質問の欄も、同じように増える", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/よくある質問 1/), { target: { value: "静かですか" } });

    fireEvent.click(screen.getByText("よくある質問の欄を増やす"));

    expect(namesOf("faqQuestion")).toEqual(["静かですか", ""]);
    expect(namesOf("faqAnswer")).toEqual(["", ""]);
  });
});

describe("点検と公開を、同じ道に通す", () => {
  it("どちらを押したかは、送られる 1 つの値だけで決まる", () => {
    renderForm();
    const check = screen.getByText("公開前に点検する（まだ出しません）");
    /*
      **同じ form・同じ action を通す。** 別々にすると、点検した内容と
      出す内容が別物になり、「点検は通ったのに出したら落ちた」が起きる。
      押されたボタンの値だけが送られるので、区別はこの 1 つで足りる。
    */
    expect(check.getAttribute("name")).toBe("intent");
    expect(check.getAttribute("value")).toBe("check");
    expect(screen.getByText("いまサイトに出す").getAttribute("name")).toBeNull();
  });
});
