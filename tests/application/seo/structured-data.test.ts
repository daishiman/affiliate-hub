/**
 * @tier 1
 * @req REQ-SEO01, REQ-SEO06
 * @types equivalence, boundary
 */
import { describe, expect, it } from "vitest";
import type { PublishedArticle } from "@/application/read-models/published-article";
import {
  buildBlogOpsFaqPage,
  buildBlogOpsPosting,
  buildBlogPosting,
  buildBreadcrumbList,
  buildFaqPage,
  buildHowTo,
  buildItemList,
  buildSpeakable,
  serializeJsonLd,
} from "@/application/seo/structured-data";
import { toExpressionArticleBlock } from "@/application/adapters/expression-article-block";

/** テスト用の最小の記事。必須欄だけ埋める。 */
const article: PublishedArticle = {
  slug: "laptops",
  siteSlug: "gadget",
  type: "ranking",
  title: "動画編集向けノートの選び方",
  summary: "実測で比べた結論を先に出す。",
  categorySlug: "laptop",
  publishedAt: "2026-08-01",
  updatedAt: "2026-08-20",
  author: { slug: "writer", name: "編集部", bio: "実測レビュー歴 5 年。", credentials: [] },
  disclosureRequired: true,
  sections: [{ id: "s1", heading: "結論", paragraphs: ["まずこれ。"] }],
};

const site = { siteName: "ガジェット研究室", origin: "https://example.com", basePath: "/s/gadget" };
const speakableSelectors = {
  answer: ".article-answer",
  keyPoints: "#article-key-points",
};

describe("BlogPosting", () => {
  it("必須キーが揃い、URL は articleHref から引く", () => {
    const posting = buildBlogPosting(article, site);
    expect(posting["@type"]).toBe("BlogPosting");
    expect(posting.headline).toBe(article.title);
    expect(posting.description).toBe(article.summary);
    expect(posting.datePublished).toBe("2026-08-01");
    expect(posting.dateModified).toBe("2026-08-20");
    expect(posting.author).toMatchObject({ "@type": "Person", name: "編集部" });
    expect(posting.publisher).toMatchObject({ "@type": "Organization", name: site.siteName });
    // ranking 記事は /best 配下。画面のリンクと同じ道になる。
    expect(posting.mainEntityOfPage).toEqual({
      "@type": "WebPage",
      "@id": "https://example.com/s/gadget/best/laptops",
    });
    // 言語とカテゴリー。多言語の検索・AI 抽出に「日本語の記事」だと明示する。
    expect(posting.inLanguage).toBe("ja");
    expect(posting.articleSection).toBe("laptop");
  });

  it("著者は実在する著者ページの URL を持ち、資格 0 件なら hasCredential を出さない", () => {
    const posting = buildBlogPosting(article, site);
    expect(posting.author).toMatchObject({
      url: "https://example.com/s/gadget/authors/writer",
    });
    // 境界: 空配列の資格一覧は「資格の無い資格持ち」という嘘の構造。キーごと省く。
    expect(posting.author).not.toHaveProperty("hasCredential");
  });

  it("資格があるときだけ hasCredential に写る", () => {
    const posting = buildBlogPosting(
      {
        ...article,
        author: { ...article.author, credentials: ["家電製品アドバイザー"] },
      },
      site,
    );
    expect(posting.author).toMatchObject({
      hasCredential: [
        { "@type": "EducationalOccupationalCredential", name: "家電製品アドバイザー" },
      ],
    });
  });

  it("監修者が付いていないなら contributor を出さず、付いていれば Person で出す", () => {
    // 同値: 無い記事にキー自体を出さない（空の監修者は「監修されている風」の嘘）。
    expect(buildBlogPosting(article, site)).not.toHaveProperty("contributor");
    const reviewed = buildBlogPosting(
      {
        ...article,
        reviewedBy: { slug: "expert", name: "監修 太郎", bio: "整備士 10 年。", credentials: [] },
      },
      site,
    );
    expect(reviewed.contributor).toMatchObject({
      "@type": "Person",
      name: "監修 太郎",
      url: "https://example.com/s/gadget/authors/expert",
    });
  });

  /**
   * 人物の説明文が、読み取りモデルの `bio` から来ていること（REQ-SEO01）。
   *
   * ここを足した理由。**`description` を固定文字列へ書き換えても全件緑だった**（実測、
   * 2026-08-28。`buildPerson` の `description: person.bio` を
   * `description: "編集部のプロフィールです。"` にして 10/10 緑）。
   * `name` と `url` と `hasCredential` は当たっていたが、説明文だけ誰も見ていなかった。
   *
   * 要件は「画面と機械向け出力を**同じ読み取りモデルから出す**」で、
   * 欄が 1 つでも別の出どころを持てば、そこから画面と食い違う。
   * 著者ページには実測歴が出ているのに、機械向けには別の紹介文が出る——
   * **どちらが本当かを読む側が決められなくなる。**
   *
   * 監修者も同じ関数（`buildPerson`）を通るが、**通っていることは検査の側から見えない**。
   * 実装を 1 か所にまとめ直した日に片方だけ別経路になっても、
   * 著者だけ見ていれば緑のままである。だから両方を名指しで当てる。
   */
  it("人物の説明文は読み取りモデルの bio をそのまま出す（著者・監修者とも）", () => {
    const reviewer = { slug: "expert", name: "監修 太郎", bio: "整備士 10 年。", credentials: [] };
    const posting = buildBlogPosting({ ...article, reviewedBy: reviewer }, site);
    expect(posting.author).toMatchObject({ description: article.author.bio });
    expect(posting.contributor).toMatchObject({ description: reviewer.bio });

    // 見本の値とたまたま一致しているだけ、を排す。bio を変えたら出力も変わる。
    const other = buildBlogPosting(
      {
        ...article,
        author: { ...article.author, bio: "別の紹介文。" },
        reviewedBy: { ...reviewer, bio: "監修者の別の紹介文。" },
      },
      site,
    );
    expect(other.author).toMatchObject({ description: "別の紹介文。" });
    expect(other.contributor).toMatchObject({ description: "監修者の別の紹介文。" });
  });
});

describe("ItemList（順位記事）", () => {
  it("ranking が無い・順位 0 件なら null（順位の無い順位表を出さない）", () => {
    // 境界: undefined と空配列の両方が「出さない」に写る。
    expect(buildItemList(article, site)).toBeNull();
    expect(
      buildItemList(
        {
          ...article,
          ranking: { caption: "空", updatedAt: "2026-08-20", criteria: [], entries: [], excluded: [] },
        },
        site,
      ),
    ).toBeNull();
  });

  it("順位・商品名が写り、reviewSlug がある商品だけ URL を持つ", () => {
    const list = buildItemList(
      {
        ...article,
        ranking: {
          caption: "動画編集ノート TOP2",
          updatedAt: "2026-08-20",
          criteria: [],
          entries: [
            {
              productId: "p1",
              rank: 1,
              productName: "ノート A",
              totalScore: 92,
              criterionScores: [],
              reviewSlug: "note-a",
              oneLine: "書き出しが最速。",
            },
            {
              productId: "p2",
              rank: 2,
              productName: "ノート B",
              totalScore: 88,
              criterionScores: [],
              oneLine: "軽さで選ぶなら。",
            },
          ],
          excluded: [],
        },
      },
      site,
    );
    expect(list).toMatchObject({ "@type": "ItemList", numberOfItems: 2 });
    expect(list?.itemListElement).toEqual([
      {
        "@type": "ListItem",
        position: 1,
        name: "ノート A",
        url: "https://example.com/s/gadget/reviews/note-a",
      },
      // レビュー未執筆の商品は URL を出さない（存在しないページへ送らない）。
      { "@type": "ListItem", position: 2, name: "ノート B" },
    ]);
  });
});

describe("パンくず", () => {
  it("position が 1 始まりで並ぶ", () => {
    const list = buildBreadcrumbList([
      { name: "ホーム", url: "https://example.com/s/gadget" },
      { name: "記事", url: "https://example.com/s/gadget/best/laptops" },
    ]);
    expect(list.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "ホーム", item: "https://example.com/s/gadget" },
      {
        "@type": "ListItem",
        position: 2,
        name: "記事",
        item: "https://example.com/s/gadget/best/laptops",
      },
    ]);
  });
});

describe("FAQ", () => {
  it("0 件なら null（質問の無い FAQ という嘘の構造を出さない）", () => {
    expect(buildFaqPage({ ...article, faq: [] })).toBeNull();
  });

  it("質問と答えが Question / Answer に写る", () => {
    const faq = buildFaqPage({
      ...article,
      faq: [{ question: "何を見て選ぶ?", answer: "まず書き出し速度。" }],
    });
    expect(faq?.mainEntity).toEqual([
      {
        "@type": "Question",
        name: "何を見て選ぶ?",
        acceptedAnswer: { "@type": "Answer", text: "まず書き出し速度。" },
      },
    ]);
  });

  it("運用側の記事 carrier も公開表示と同じ FAQPage に写る", () => {
    const faq = buildBlogOpsFaqPage([
      toExpressionArticleBlock(
        { kind: "faq", items: [{ question: "保証は?", answer: "1 年です。" }] },
        "faq_1",
        0,
      ),
    ]);
    expect(faq?.mainEntity).toEqual([
      {
        "@type": "Question",
        name: "保証は?",
        acceptedAnswer: { "@type": "Answer", text: "1 年です。" },
      },
    ]);
  });
});

/**
 * ブログ運用で書いた記事（`/blog/<slug>`）の BlogPosting。
 *
 * 出典も監修者も持たない経路なので、**出せない項目はキーごと省く**ことを見る。
 * 空の著者・空の出典を出すと、機械には「情報がある記事」に見えて中身が無い。
 */
describe("運用側の記事の BlogPosting", () => {
  const site = { siteName: "静かな家電の話", origin: "https://x.test", basePath: "/s/quiet" };
  const base = {
    slug: "keyboards",
    title: "静かなキーボードの選び方",
    lead: "打鍵音を気にする人向けに 3 機種を比べます。",
    authorName: "見本 太郎",
    publishedAt: new Date("2026-08-01T00:00:00Z"),
    updatedAt: new Date("2026-08-20T00:00:00Z"),
  };

  it("題名・導入・著者・更新日を写し、URL は /blog/<slug> を指す", () => {
    const ld = buildBlogOpsPosting({ article: base, blocks: [], site });

    expect(ld.headline).toBe(base.title);
    expect(ld.description).toBe(base.lead);
    expect(ld.inLanguage).toBe("ja");
    expect(ld.author).toEqual({ "@type": "Person", name: "見本 太郎" });
    expect(ld.datePublished).toBe("2026-08-01T00:00:00.000Z");
    expect(ld.dateModified).toBe("2026-08-20T00:00:00.000Z");
    expect(ld.mainEntityOfPage).toEqual({
      "@type": "WebPage",
      "@id": "https://x.test/s/quiet/blog/keyboards",
    });
  });

  it("著者ページを持たないので url を出さない（存在しない住所へ送らない）", () => {
    const ld = buildBlogOpsPosting({ article: base, blocks: [], site });

    expect(ld.author).not.toHaveProperty("url");
  });

  it("まだ公開していない記事に公開日を出さない", () => {
    const ld = buildBlogOpsPosting({
      article: { ...base, publishedAt: null },
      blocks: [],
      site,
    });

    expect(ld).not.toHaveProperty("datePublished");
    // 更新日は下書きでも出る。いつ触られたかは嘘にならない。
    expect(ld.dateModified).toBe("2026-08-20T00:00:00.000Z");
  });

  it("まとめの節があれば abstract に本文をそのまま写す", () => {
    const ld = buildBlogOpsPosting({
      article: base,
      blocks: [
        { kind: "intro-box", body: "導入。" },
        { kind: "summary-section", body: "静かさ重視なら B。" },
      ],
      site,
    });

    expect(ld.abstract).toBe("静かさ重視なら B。");
  });

  it("表現ブロックのまとめは carrier JSON ではなく読者に見える本文を写す", () => {
    const ld = buildBlogOpsPosting({
      article: base,
      blocks: [
        toExpressionArticleBlock(
          { kind: "summary", text: "軽さを優先します。" },
          "expression_summary",
          0,
        ),
      ],
      site,
    });

    expect(ld.abstract).toBe("軽さを優先します。");
    expect(JSON.stringify(ld)).not.toContain("expression-block:v1");
  });

  it("壊れたsummary carrierは通常本文へfallbackせずabstractへ出さない", () => {
    const ld = buildBlogOpsPosting({
      article: base,
      blocks: [
        {
          kind: "summary-section",
          body: "expression-block:v1:not-json",
        },
      ],
      site,
    });

    expect(ld).not.toHaveProperty("abstract");
    expect(JSON.stringify(ld)).not.toContain("expression-block:v1:not-json");
  });

  it("まとめの節が無ければ abstract を出さない", () => {
    const ld = buildBlogOpsPosting({
      article: base,
      blocks: [{ kind: "intro-box", body: "導入。" }],
      site,
    });

    expect(ld).not.toHaveProperty("abstract");
  });
});

describe("HTML への埋め込み", () => {
  it("値の中の < を \\u003c に逃がす（</script> でタグを閉じさせない）", () => {
    const json = serializeJsonLd({ headline: "</script><script>alert(1)</script>" });
    expect(json).not.toContain("<");
    expect(json).toContain("\\u003c/script>");
    // JSON としての意味は変わらない。読み戻すと元の文字列に戻る。
    expect(JSON.parse(json)).toEqual({ headline: "</script><script>alert(1)</script>" });
  });
});

/* ------------------------------------------------------------------ *
 * REQ-SEO06: HowTo / Speakable（feat-seo-aeo-gap-closure）
 * 上の既存ケースには一切触れていない。触ったら受入 A6 の反例になる。
 * ------------------------------------------------------------------ */

/** 手順を持つ手引き記事。`steps` 節に段落 3 件。 */
const guide: PublishedArticle = {
  ...article,
  slug: "desk-setup",
  type: "guide",
  title: "在宅机の作り方",
  sections: [
    {
      id: "steps",
      heading: "全手順",
      paragraphs: ["机の奥行きを測る。", "電源の位置を決める。", "配線を天板の裏へ通す。"],
    },
  ],
};

describe("HowTo", () => {
  it("T1-1: steps 節の段落が同順・同文で step になる", () => {
    const howTo = buildHowTo(guide, site);
    expect(howTo?.["@type"]).toBe("HowTo");
    expect(howTo?.step).toEqual([
      { "@type": "HowToStep", text: "机の奥行きを測る。" },
      { "@type": "HowToStep", text: "電源の位置を決める。" },
      { "@type": "HowToStep", text: "配線を天板の裏へ通す。" },
    ]);
    expect(howTo?.name).toBe("在宅机の作り方");
    expect(howTo?.mainEntityOfPage).toEqual({
      "@type": "WebPage",
      // guide 記事は /guides 配下。画面のリンクと同じ道になる。
      "@id": "https://example.com/s/gadget/guides/desk-setup",
    });
  });

  it("T1-2: steps 節はあるが段落が空なら null（手順の無い手順書を出さない）", () => {
    expect(
      buildHowTo({ ...guide, sections: [{ id: "steps", heading: "全手順", paragraphs: [] }] }, site),
    ).toBeNull();
  });

  it("T1-3: steps 節そのものが無ければ null", () => {
    expect(
      buildHowTo(
        { ...guide, sections: [{ id: "intro", heading: "はじめに", paragraphs: ["導入。"] }] },
        site,
      ),
    ).toBeNull();
  });

  it("T1-4: steps 節を持たない 4 型はいずれも null", () => {
    // 型ごとの分岐で止めているのではなく、`steps` 節が無いことからの帰結。
    // 1 型だけ確かめると、あとから型分岐が入り込んでも気づけない。
    for (const type of ["ranking", "review", "comparison", "tool"] as const) {
      expect(buildHowTo({ ...article, type }, site)).toBeNull();
    }
  });

  it("T1-5: 補助情報があれば写り、無ければキーごと出ない", () => {
    const withExtras = buildHowTo(
      {
        ...guide,
        sections: [
          ...guide.sections,
          { id: "required_time", heading: "必要時間", paragraphs: ["およそ 2 時間。"] },
          { id: "required_cost", heading: "必要費用", paragraphs: ["12,000 円ほど。"] },
          { id: "prerequisites", heading: "事前準備", paragraphs: ["メジャー", "結束バンド"] },
          { id: "outcome_state", heading: "完了後の状態", paragraphs: ["配線が見えなくなる。"] },
        ],
      },
      site,
    );
    expect(withExtras?.totalTime).toBe("PT2H");
    expect(withExtras?.estimatedCost).toEqual({
      "@type": "MonetaryAmount",
      currency: "JPY",
      value: 12000,
    });
    expect(withExtras?.supply).toEqual([
      { "@type": "HowToSupply", name: "メジャー" },
      { "@type": "HowToSupply", name: "結束バンド" },
    ]);
    expect(withExtras?.description).toBe("配線が見えなくなる。");
    /*
      `tool` は出さない。導出元は `prerequisites` の 1 節だけで、散文から
      「消費するもの」と「使う道具」を機械で分けられない。両方に出すと
      同じ事実が 2 か所に載り、片方だけ直る事故の口が開く（総称側へ寄せた）。
    */
    expect(withExtras).not.toHaveProperty("tool");

    // 境界: 補助情報が無ければキーごと省く。`"totalTime": null` は
    // 読む側に「所要時間が null という値だ」と見える。
    const bare = buildHowTo(guide, site);
    expect(bare).not.toHaveProperty("totalTime");
    expect(bare).not.toHaveProperty("estimatedCost");
    expect(bare).not.toHaveProperty("supply");
    expect(bare).not.toHaveProperty("description");
  });
});

describe("Speakable", () => {
  it("T2-1: 結論と要点が両方あれば selector は 2 件", () => {
    const speakable = buildSpeakable(
      { ...article, keyPoints: ["速い", "静か"] },
      speakableSelectors,
    );
    expect(speakable?.["@type"]).toBe("WebPage");
    expect(speakable?.speakable).toEqual({
      "@type": "SpeakableSpecification",
      cssSelector: [speakableSelectors.answer, speakableSelectors.keyPoints],
    });
  });

  it("T2-2: 結論だけなら selector は answer の 1 件", () => {
    const speakable = buildSpeakable(
      { ...article, keyPoints: undefined },
      speakableSelectors,
    );
    expect(speakable?.speakable).toMatchObject({
      cssSelector: [speakableSelectors.answer],
    });
  });

  it("T2-3: 要点だけなら selector は key-points の 1 件", () => {
    const speakable = buildSpeakable(
      { ...article, summary: "", keyPoints: ["速い"] },
      speakableSelectors,
    );
    expect(speakable?.speakable).toMatchObject({
      cssSelector: [speakableSelectors.keyPoints],
    });
  });

  it("T2-4: 読み上げるものが無ければ null", () => {
    // 空配列も「要点の無い要点」なので出さない。
    expect(buildSpeakable({ ...article, summary: "", keyPoints: [] }, speakableSelectors)).toBeNull();
    expect(
      buildSpeakable(
        { ...article, summary: "   ", keyPoints: undefined },
        speakableSelectors,
      ),
    ).toBeNull();
  });
});
