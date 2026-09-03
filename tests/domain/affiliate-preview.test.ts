/**
 * @tier 1
 * @req REQ-P02, REQ-A07
 * @types equivalence, boundary, ssrf
 *
 * 貼られた URL の中身を **見せるためだけに** 読む層。
 *
 * ここが守るのは 2 つ。
 *
 *   1. **取れなかったものを、取れたことにしない。** 分からない欄は null のまま返し、
 *      `status`/`reason` で手入力へ渡す。埋めてしまうと、誰の見た表記か辿れなくなる。
 *   2. **列挙した提携先以外へは出ない。** 取得も画像表示も既定拒否。
 *      HTML の中の URL は攻撃者が書ける値なので、ここが最後の関門になる。
 *
 * --- なぜテストを足したか（2026-08-30）---
 *
 * ミューテーション 50.3%、生き残り 118・未到達 50。テストは 4 本あったが、
 * **HTML の揺れをほとんど通していなかった。** 実体参照、`<title>` 退避、
 * `@graph`、壊れた JSON-LD、offers の配列、属性の引用符違い —— どれも
 * 相手のサーバーが実際に返してくる形なのに、1 度も読ませていなかった。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type AffiliatePreviewProviderPolicy,
  AFFILIATE_PREVIEW_PROVIDER_POLICIES,
  canDisplayAffiliatePreviewImage,
  extractAffiliatePreview,
  isAffiliatePreviewFetchHopAllowed,
  resolveAffiliatePreviewProvider,
} from "@/domain/monetization";

const FIXTURE_POLICY: AffiliatePreviewProviderPolicy = {
  id: "fixture-provider",
  label: "Fixture provider",
  fetchHosts: ["shop.provider.test"],
  imageHosts: ["images.provider.test"],
  imageDisplayAllowed: true,
};

const AT = new Date("2026-08-29T12:00:00Z");
const SHOP = "https://shop.provider.test/a";

/** HTML だけ差し替えて読ませる。他の入力は固定して、変数を 1 つにする。 */
function read(html: string, finalUrl: string = SHOP) {
  return extractAffiliatePreview({ rawUrl: SHOP, finalUrl, html, retrievedAt: AT, policy: FIXTURE_POLICY });
}

/** JSON-LD を 1 つ埋めた最小の HTML。 */
function ld(node: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(node)}</script>`;
}

describe("どの提携先へ出てよいか", () => {
  it("列挙にあるホストだけ通す", () => {
    expect(resolveAffiliatePreviewProvider("https://shop.provider.test/item", [FIXTURE_POLICY])).toEqual({
      ok: true,
      policy: FIXTURE_POLICY,
    });
  });

  it.each([
    ["URL として読めない", "これはURLではない", "URLとして読み取れませんでした。"],
    ["http", "http://shop.provider.test/item", "https:// の成果リンクをそのまま貼り付けてください。"],
    ["利用者名が埋まっている", "https://u@shop.provider.test/item", "https:// の成果リンクをそのまま貼り付けてください。"],
    ["合言葉が埋まっている", "https://:p@shop.provider.test/item", "https:// の成果リンクをそのまま貼り付けてください。"],
    ["内部宛", "https://127.0.0.1/item", "内部ネットワーク宛のため取得しません。"],
    ["列挙に無い", "https://unknown.example/item", "この提携先は自動取得に未対応です。"],
  ])("%s ものは、理由を添えて断る", (_name, url, reason) => {
    /*
      **理由の文面まで固定する。** ここは操作者が画面で読む唯一の説明で、
      「なぜ自分の URL が弾かれたか」が分からないと手入力へ進めない。
    */
    expect(resolveAffiliatePreviewProvider(url, [FIXTURE_POLICY])).toEqual({ ok: false, reason });
  });

  it("前後の空白は落として読む", () => {
    expect(resolveAffiliatePreviewProvider("  https://shop.provider.test/item  ", [FIXTURE_POLICY]).ok).toBe(
      true,
    );
  });

  it("実サービス用の既定は、画像をどこにも許していない", () => {
    /*
      画像の再表示権利は提携先ごとの契約で、推測してはいけない。
      **足す人がここを緑のまま通せてしまうと、無断再配信が静かに始まる。**
    */
    for (const policy of AFFILIATE_PREVIEW_PROVIDER_POLICIES) {
      expect(policy.imageDisplayAllowed).toBe(false);
      expect(policy.imageHosts).toEqual([]);
      expect(policy.fetchHosts.length).toBeGreaterThan(0);
    }
    expect(AFFILIATE_PREVIEW_PROVIDER_POLICIES.length).toBeGreaterThan(1);
  });
});

describe("転送を追ってよいか", () => {
  it.each([
    ["列挙のホスト", "https://shop.provider.test/x", true],
    /*
      **下位ドメインは通さない。** 列挙は完全一致で、既定の方針が
      `amazon.co.jp` と `www.amazon.co.jp` を別々に書いているのがその意思表示。
      `*.example.com` を許すと、提携先が第三者に貸した下位ドメインまで
      同じ扱いになり、列挙した意味が消える。
    */
    ["下位ドメイン", "https://sub.shop.provider.test/x", false],
    ["http", "http://shop.provider.test/x", false],
    ["利用者名つき", "https://u@shop.provider.test/x", false],
    ["合言葉つき", "https://:p@shop.provider.test/x", false],
    ["内部宛", "https://localhost/x", false],
    ["列挙に無い", "https://elsewhere.test/x", false],
    ["画像用ホスト（取得は許していない）", "https://images.provider.test/x", false],
  ])("%s → %s", (_name, url, expected) => {
    expect(isAffiliatePreviewFetchHopAllowed(new URL(url), FIXTURE_POLICY)).toBe(expected);
  });
});

describe("画像を表示してよいか", () => {
  it.each([
    ["すべて通る", "https://images.provider.test/i.png", FIXTURE_POLICY, true],
    ["http", "http://images.provider.test/i.png", FIXTURE_POLICY, false],
    ["利用者名つき", "https://u@images.provider.test/i.png", FIXTURE_POLICY, false],
    ["内部宛", "https://127.0.0.1/i.png", FIXTURE_POLICY, false],
    ["URL として読めない", "not a url", FIXTURE_POLICY, false],
    ["取得は許すが画像は列挙外", "https://shop.provider.test/i.png", FIXTURE_POLICY, false],
  ])("%s → %s", (_name, url, policy, expected) => {
    expect(canDisplayAffiliatePreviewImage(url, policy)).toBe(expected);
  });

  it("権利が下りていなければ、ホストが正しくても出さない", () => {
    /*
      **「ホストが安全」と「表示してよい」は別の判断。** 同じ関門にまとめると、
      安全なホストを 1 つ足した日に再配信の権利まで一緒に開いてしまう。
    */
    expect(
      canDisplayAffiliatePreviewImage("https://images.provider.test/i.png", {
        ...FIXTURE_POLICY,
        imageDisplayAllowed: false,
      }),
    ).toBe(false);
  });
});

describe("何から読み取ったか（method）", () => {
  it("JSON-LD があれば、それを最優先する", () => {
    const preview = read(
      ld({ "@type": "Product", name: "図解キット" }) + '<meta property="og:title" content="別の名前">',
    );
    expect(preview.method).toBe("json-ld");
    expect(preview.productName).toBe("図解キット");
  });

  it("JSON-LD が無ければ og:title", () => {
    const preview = read('<meta property="og:title" content="なめらかペン"><title>店の名前</title>');
    expect(preview.method).toBe("open-graph");
    expect(preview.productName).toBe("なめらかペン");
  });

  it("og も無ければ <title>", () => {
    const preview = read("<title>なめらかペン</title>");
    expect(preview.method).toBe("html-meta");
    expect(preview.productName).toBe("なめらかペン");
  });

  it("名前が無く説明だけでも html-meta とする", () => {
    const preview = read('<meta name="description" content="書き心地。">');
    expect(preview.method).toBe("html-meta");
    expect(preview.productName).toBeNull();
    expect(preview.oneLine).toBe("書き心地。");
  });

  it("何も無ければ manual（手入力へ渡す）", () => {
    const preview = read("<p>ただの本文</p>");
    expect(preview.method).toBe("manual");
    expect(preview.status).toBe("partial");
  });
});

describe("状態と、その理由", () => {
  it("名前・価格・通貨が揃ったときだけ ready", () => {
    const preview = read(
      ld({ "@type": "Product", name: "図解キット", offers: { price: "4980", priceCurrency: "JPY" } }),
    );
    expect(preview.status).toBe("ready");
    expect(preview.reason).toBeNull();
  });

  it("名前が取れなければ、名前の確認を促す", () => {
    expect(read("<p>本文</p>").reason).toBe("商品名を自動取得できませんでした。確認して手入力してください。");
  });

  it("名前はあるが価格が無ければ、価格は提携先で見るよう促す", () => {
    const preview = read(ld({ "@type": "Product", name: "図解キット" }));
    expect(preview.status).toBe("partial");
    expect(preview.reason).toBe("価格は取得できませんでした。現在価格は提携先で確認してください。");
  });

  it("価格はあるが通貨が無ければ ready にしない", () => {
    const preview = read(ld({ "@type": "Product", name: "図解キット", offers: { price: "4980" } }));
    /*
      **数字だけでは金額にならない。** 4980 が円かドルか分からないまま
      ready にすると、画面が桁の違う金額を確定した顔で出す。
    */
    expect(preview.status).toBe("partial");
    expect(preview.currency).toBeNull();
    expect(preview.reason).toBeNull();
  });
});

describe("JSON-LD の読み方", () => {
  it("配列で来ても Product を見つける", () => {
    expect(read(ld([{ "@type": "WebPage" }, { "@type": "Product", name: "図解キット" }])).productName).toBe(
      "図解キット",
    );
  });

  it("@graph の中に入っていても見つける", () => {
    expect(
      read(ld({ "@graph": [{ "@type": "Organization" }, { "@type": "Product", name: "図解キット" }] }))
        .productName,
    ).toBe("図解キット");
  });

  it("@type が配列でも Product を認める", () => {
    expect(read(ld({ "@type": ["Thing", "Product"], name: "図解キット" })).productName).toBe("図解キット");
  });

  it("壊れた JSON-LD は捨てて、次の手がかりへ進む", () => {
    const preview = read(
      '<script type="application/ld+json">{ 壊れている </script><meta property="og:title" content="なめらかペン">',
    );
    /*
      **落とさない。** 相手のサーバーの JSON が壊れているのは日常で、
      そこで例外を投げると、画面が「取得に失敗」ではなく白紙になる。
    */
    expect(preview.productName).toBe("なめらかペン");
    expect(preview.method).toBe("open-graph");
  });

  it("Product が 1 つも無ければ JSON-LD を使わない", () => {
    const preview = read(ld({ "@type": "Article", name: "記事の題" }) + "<title>店の名前</title>");
    expect(preview.method).toBe("html-meta");
    expect(preview.productName).toBe("店の名前");
  });

  it("offers が配列なら先頭を採る", () => {
    const preview = read(
      ld({
        "@type": "Product",
        name: "図解キット",
        offers: [
          { price: "4980", priceCurrency: "JPY" },
          { price: "9800", priceCurrency: "JPY" },
        ],
      }),
    );
    expect(preview.price).toBe("4980");
  });

  it("価格が数値でも文字として持つ", () => {
    const preview = read(ld({ "@type": "Product", name: "K", offers: { price: 4980, priceCurrency: "JPY" } }));
    /*
      **金額を number にしない。** 0.1 + 0.2 の類の丸めが混ざる場所を
      表示層に作らない。ここは見せるだけなので、来た文字のまま運ぶ。
    */
    expect(preview.price).toBe("4980");
  });

  it("brand が入れ子のときは name を、文字列のときはそのまま採る", () => {
    expect(read(ld({ "@type": "Product", name: "K", brand: { name: "Example Works" } })).merchantName).toBe(
      "Example Works",
    );
    expect(read(ld({ "@type": "Product", name: "K", brand: "Example Works" })).merchantName).toBe(
      "Example Works",
    );
  });

  it("brand が無ければ og:site_name へ退避する", () => {
    expect(
      read(ld({ "@type": "Product", name: "K" }) + '<meta property="og:site_name" content="Example Works">')
        .merchantName,
    ).toBe("Example Works");
  });

  it("image が配列なら最初の文字列を採る", () => {
    const preview = read(
      ld({
        "@type": "Product",
        name: "K",
        image: [{ url: "https://images.provider.test/o.png" }, "https://images.provider.test/i.png"],
      }),
    );
    expect(preview.imageUrl).toBe("https://images.provider.test/i.png");
  });
});

describe("HTML の揺れ", () => {
  it("実体参照を戻す", () => {
    expect(read('<meta property="og:title" content="A &amp; B &quot;C&quot; &#39;D&#39; &lt;E&gt;">').productName).toBe(
      `A & B "C" 'D' <E>`,
    );
  });

  it("連なった空白と改行を 1 つに畳む", () => {
    expect(read("<title>\n  なめらか   ペン \n</title>").productName).toBe("なめらか ペン");
  });

  it("空白しか無い値は、取れなかったものとして扱う", () => {
    /*
      空文字を「取れた」にすると、画面に空欄が確定した顔で出て、
      手入力への誘導（`reason`）が働かなくなる。
    */
    expect(read('<meta property="og:title" content="   ">').productName).toBeNull();
  });

  it("<title> の中のタグは落とす", () => {
    expect(read("<title><b>なめらか</b>ペン</title>").productName).toBe("なめらかペン");
  });

  it("属性名の大文字小文字と引用符の違いを吸収する", () => {
    expect(read(`<META PROPERTY='og:title' CONTENT='なめらかペン'>`).productName).toBe("なめらかペン");
    expect(read(`<meta property=og:title content=ペン>`).productName).toBe("ペン");
  });

  it("rel が複数並んでいても canonical を見つける", () => {
    const preview = read(
      '<link rel="alternate canonical" href="https://shop.provider.test/products/x">',
      SHOP,
    );
    expect(preview.canonicalUrl).toBe("https://shop.provider.test/products/x");
  });
});

describe("正規 URL は、提携先の中にしか置かない", () => {
  it("canonical が列挙外を指していたら採らず、最終 URL へ戻す", () => {
    const preview = read('<link rel="canonical" href="https://attacker.test/x">', SHOP);
    /*
      **canonical は相手のページに書かれた文字列で、攻撃者が書ける。**
      そのまま画面に出すと、提携先の顔をした外部リンクを自前で配ることになる。
    */
    expect(preview.canonicalUrl).toBe(SHOP);
  });

  it("canonical が URL として壊れていても、落ちずに最終 URL へ戻す", () => {
    expect(read('<link rel="canonical" href="notaurl">', SHOP).canonicalUrl).toBe(SHOP);
  });

  it("最終 URL 自体が列挙外なら、正規 URL を名乗らない", () => {
    expect(read("<title>K</title>", "https://elsewhere.test/x").canonicalUrl).toBeNull();
  });

  it("最終 URL が壊れていても落ちない", () => {
    const preview = read("<title>K</title>", "notaurl");
    expect(preview.canonicalUrl).toBeNull();
    expect(preview.sourceHost).toBe("invalid.invalid");
  });
});

describe("画像は、権利の下りたホストのものだけ載せる", () => {
  it("列挙外のホストの画像は落とす", () => {
    expect(read('<meta property="og:image" content="https://attacker.test/i.png">').imageUrl).toBeNull();
  });

  it("権利が下りていない提携先では、正しいホストでも落とす", () => {
    const preview = extractAffiliatePreview({
      rawUrl: SHOP,
      finalUrl: SHOP,
      html: '<meta property="og:image" content="https://images.provider.test/i.png">',
      retrievedAt: AT,
      policy: { ...FIXTURE_POLICY, imageDisplayAllowed: false },
    });
    // 画像が無い状態は失敗ではない。画面は図解へ退避する。
    expect(preview.imageUrl).toBeNull();
  });
});

describe("読み取った事実の出どころを残す", () => {
  it("提携先・取得時刻・宛先ホスト・貼られた URL を、そのまま持ち帰る", () => {
    const preview = read("<title>K</title>", "https://shop.provider.test/products/x");
    expect(preview.providerId).toBe(FIXTURE_POLICY.id);
    expect(preview.providerLabel).toBe(FIXTURE_POLICY.label);
    expect(preview.retrievedAt).toBe(AT.toISOString());
    expect(preview.sourceHost).toBe("shop.provider.test");
    expect(preview.rawUrl).toBe(SHOP);
    // 重複照合はこの層の仕事ではない。ここで埋めると出どころが 2 か所になる。
    expect(preview.duplicateCandidates).toEqual([]);
  });

  it("見本の HTML 一式から、JSON-LD を優先して読み切る", () => {
    const html = readFileSync("tests/fixtures/reference-blog-admin-ux/product-preview.html", "utf8");
    const preview = extractAffiliatePreview({
      rawUrl: "https://shop.provider.test/a?id=1",
      finalUrl: "https://shop.provider.test/products/diagram-kit",
      html,
      retrievedAt: AT,
      policy: FIXTURE_POLICY,
    });

    expect(preview.status).toBe("ready");
    expect(preview.productName).toBe("図解キット");
    expect(preview.merchantName).toBe("Example Works");
    expect(preview.price).toBe("4980");
    expect(preview.currency).toBe("JPY");
    expect(preview.method).toBe("json-ld");
    expect(preview.imageUrl).toBe("https://images.provider.test/diagram-kit.png");
    expect(preview.oneLine).toBeNull();
  });
});
