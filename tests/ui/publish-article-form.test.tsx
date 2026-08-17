/** @tier 2 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PublishArticleFormOptions } from "@/application/usecases/site/publish-article";
import { ARTICLE_TYPES, ARTICLE_TYPE_LABEL, authoredSectionsFor } from "@/domain/authoring";
import { RELATIONSHIP_LABEL } from "@/domain/compliance";
import { PublishArticleForm } from "@/presentation/admin/publish-article-form";

/**
 * 「いまサイトに出す」欄。
 *
 * --- ここで固定したいこと ---
 *
 * **欄の並びを画面が書き起こしていないこと。** 記事の構成表を 1 つ直した日に、
 * 直った種類と直っていない種類が同じ画面に混ざるのを防ぐ。
 *
 * **広告表記は読者に出る文そのものを選ばせること。** 画面で「アフィリエイト」と
 * 短く言い換えると、選んだ言葉と記事に出る言葉が違ってしまい、
 * 何を選んだのかを後から確かめられなくなる。
 *
 * **全種類ぶんの欄が一度に手元にあること。** 種類を選び直すたびに読み直すと、
 * 書きかけの原稿が消える。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §2
 */

const OPTIONS: PublishArticleFormOptions = {
  articleTypes: ARTICLE_TYPES.map((value) => ({
    value,
    label: ARTICLE_TYPE_LABEL[value],
    sections: authoredSectionsFor(value).map((s) => ({
      id: s.id,
      label: s.label,
      purpose: s.purpose,
    })),
  })),
  siteOptions: [
    {
      slug: "quiet-desk",
      name: "静かな机",
      categories: [
        { slug: "laptop", name: "ノートパソコン" },
        { slug: "keyboard", name: "キーボード" },
      ],
    },
  ],
  relationshipOptions: (Object.keys(RELATIONSHIP_LABEL) as (keyof typeof RELATIONSHIP_LABEL)[]).map(
    (value) => ({ value, label: RELATIONSHIP_LABEL[value] }),
  ),
  prefill: {
    title: "静かなノートパソコンの選び方",
    conclusion: "書き出しの速さで選ぶ。",
    disclosureMessage: "この記事には広告が含まれます。",
    body: "結論から書く。",
  },
};

function render(options: PublishArticleFormOptions = OPTIONS): string {
  return renderToStaticMarkup(
    <PublishArticleForm publicationId="pub_own" options={options} />,
  );
}

describe("いまサイトに出す欄", () => {
  it("どの配信かを一緒に送る（取り違えを起こさない）", () => {
    expect(render()).toContain('value="pub_own"');
  });

  it("記事の種類の選択肢が、構成表の種類と 1 対 1 で並ぶ", () => {
    const html = render();
    for (const type of ARTICLE_TYPES) {
      expect(html, `${type} が選べません`).toContain(`value="${type}"`);
      expect(html).toContain(ARTICLE_TYPE_LABEL[type]);
    }
  });

  it("原稿の欄は、選んだ種類の構成表から作られる", () => {
    const html = render();
    // 既定は一覧の先頭。手で決め打った種類の欄を並べていないことを見る。
    for (const section of authoredSectionsFor(ARTICLE_TYPES[0])) {
      expect(html, `${section.label} の欄がありません`).toContain(`name="section:${section.id}"`);
      // 見出しだけでは書けない。何を書くかの説明も一緒に出す。
      expect(html).toContain(section.purpose);
    }
  });

  it("選んでいない種類の欄は出さない（全種類を一度に並べない）", () => {
    const html = render();
    const shown = new Set(authoredSectionsFor(ARTICLE_TYPES[0]).map((s) => s.id));
    const others = ARTICLE_TYPES.flatMap((t) => authoredSectionsFor(t))
      .map((s) => s.id)
      .filter((id) => !shown.has(id));
    for (const id of new Set(others)) {
      expect(html, `選んでいない種類の欄 ${id} が出ています`).not.toContain(
        `name="section:${id}"`,
      );
    }
  });

  it("広告との関係は、読者へ出す文そのものを選ばせる", () => {
    const html = render();
    expect(html).toContain("アフィリエイト広告を利用しています");
    // 自費購入も選べる（表記が要らない場合を「未設定」と区別する）。
    expect(html).toContain('value="purchased"');
  });

  it("広告との関係は既定で未選択（勝手に決めない）", () => {
    // 一度出た記事の表記は取り消せない。既定値を入れると、
    // 何も選ばずに押した人の記事に、選んでいない表記が付く。
    expect(render()).toContain("選んでください");
  });

  it("もとの記事の初期値が入っている（同じことを 2 回打たせない）", () => {
    const html = render();
    expect(html).toContain("静かなノートパソコンの選び方");
    expect(html).toContain("書き出しの速さで選ぶ。");
    expect(html).toContain("この記事には広告が含まれます。");
  });

  it("出し先のブログとカテゴリーを選べる", () => {
    const html = render();
    expect(html).toContain('value="quiet-desk"');
    expect(html).toContain('value="laptop"');
    expect(html).toContain('value="keyboard"');
  });

  it("出し先のブログが 1 つも無いときは押せない", () => {
    // ブログが無いのに押せると、押してから断られる。押す前に分かるようにする。
    // 「無いときに disabled が出る」だけでは、常に disabled でも通ってしまう。
    // あるときに押せることも一緒に見る。
    expect(render({ ...OPTIONS, siteOptions: [] })).toContain("disabled");
    expect(render()).not.toContain("disabled");
  });

  it("次に見直す日の欄があり、無いと出せないことが書いてある", () => {
    const html = render();
    expect(html).toContain('name="nextReviewOn"');
    expect(html).toContain("設定しないと公開できません");
  });

  it("AI から呼ぶ名前が、道具の名前と同じである（別名を作らない）", () => {
    expect(render()).toContain('toolname="publish_article_to_own_site"');
  });
});
