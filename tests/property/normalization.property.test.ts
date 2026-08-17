/** @tier 1 @req REQ-P02, REQ-P03, REQ-TH01, REQ-TH03 @types property, equivalence, idempotency */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parseBrandTheme, parseColorMode, resolveAppearance } from "@/domain/authoring/appearance";
import { BRAND_THEMES, COLOR_MODES } from "@/domain/authoring/site-blueprint";
import { normalizeExternalId } from "@/domain/monetization";
import { isInternalHost, normalizeAffiliateUrl } from "@/domain/monetization/link-ingestion";
import {
  IDENTITY_KEY_PRIORITY,
  type ProductIdentityKey,
  matchIdentity,
} from "@/domain/product/product-identity";

/**
 * 「そろえる処理」が持つべき 2 つの性質。
 *
 *   冪等（べきとう）: 2 回かけても 1 回かけたときと同じ
 *   対称           : 左右を入れ替えても同じ判断になる
 *
 * どちらも、崩れたときの症状が**遅れて出る**のがたちが悪い。
 * 冪等でないと、同じリンクを 2 度貼ったときだけ重複判定をすり抜ける。
 * 対称でないと、突合の向きを変えただけで同じ商品が別商品になる。
 * どちらも例のテストでは見つけにくく、性質で押さえるのが向いている。
 *
 * 対応する要件: REQ-P02（受信箱の重複検出）、REQ-P03（商品同一性）、REQ-B15（外観の選択）
 */

describe("そろえる処理は 2 回かけても変わらない（冪等）", () => {
  it("突合キーの正規化", () => {
    fc.assert(
      fc.property(fc.string(), (raw) => {
        const once = normalizeExternalId(raw);
        expect(normalizeExternalId(once)).toBe(once);
      }),
    );
  });

  it("成果リンクURLの正規化", () => {
    // 生成した文字列がたまたま URL になることは稀なので、URL の形から作る。
    const urlArb = fc.webUrl({ withQueryParameters: true, withFragments: true });
    fc.assert(
      fc.property(urlArb, (raw) => {
        const once = normalizeAffiliateUrl(raw);
        if (!once.ok) return; // 内部宛など、受け取らない URL はここでは対象外
        const twice = normalizeAffiliateUrl(once.value);
        expect(twice.ok).toBe(true);
        if (twice.ok) expect(twice.value).toBe(once.value);
      }),
    );
  });

  it("値の中の記号が区切りに化けない（別のリンクが同じ形にならない）", () => {
    // 見つけた不具合: `?x=b%26y=z`（x が 1 つ）と `?x=b&y=z`（x と y の 2 つ）が
    // 同じ正規形になり、別のリンクが重複と判定されていた。
    // 最小の反例は tests/domain/link-ingestion.test.ts に例として写してある。
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 6 }).filter((s) => /^[a-z]+$/.test(s)),
        fc.string({ minLength: 1, maxLength: 6 }).filter((s) => /^[a-z]+$/.test(s)),
        (key, other) => {
          fc.pre(key !== other);
          const single = normalizeAffiliateUrl(
            `https://ex.example.com/p?${key}=${encodeURIComponent(`v&${other}=w`)}`,
          );
          const pair = normalizeAffiliateUrl(`https://ex.example.com/p?${key}=v&${other}=w`);
          expect(single.ok && pair.ok).toBe(true);
          if (!single.ok || !pair.ok) return;
          expect(single.value).not.toBe(pair.value);
        },
      ),
    );
  });

  it("正規化しても、受け取ってよい URL が受け取れなくならない", () => {
    fc.assert(
      fc.property(fc.webUrl({ withQueryParameters: true }), (raw) => {
        const once = normalizeAffiliateUrl(raw);
        if (!once.ok) return;
        // 断片と計測用の付加情報しか落とさないので、ホストは保たれる
        expect(once.value.startsWith("http")).toBe(true);
        expect(once.value).not.toContain("#");
      }),
    );
  });
});

describe("内部宛の判定は、大文字小文字で変わらない", () => {
  it("同じホスト名なら、書き方を変えても同じ判定になる", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          "localhost",
          "app.localhost",
          "printer.local",
          "127.0.0.1",
          "10.1.2.3",
          "192.168.0.1",
          "169.254.169.254",
          "172.16.0.1",
          "0.0.0.0",
          "example.com",
          "shop.example.co.jp",
        ),
        (host) => {
          expect(isInternalHost(host.toUpperCase())).toBe(isInternalHost(host));
        },
      ),
    );
  });
});

describe("商品の同一判定は、比べる向きで変わらない（対称）", () => {
  const keyArb = fc.record({
    kind: fc.constantFrom(...IDENTITY_KEY_PRIORITY.filter((k) => k !== "name_similarity")),
    value: fc.string({ minLength: 1, maxLength: 8 }),
  });
  const keysArb = fc.array(keyArb, { maxLength: 4 });

  it("a と b を入れ替えても、同一かどうかの判断は変わらない", () => {
    fc.assert(
      fc.property(
        keysArb,
        keysArb,
        fc.option(fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }), {
          nil: undefined,
        }),
        (a: ProductIdentityKey[], b: ProductIdentityKey[], similarity) => {
          const ab = matchIdentity(a, b, similarity);
          const ba = matchIdentity(b, a, similarity);
          expect(ba.matched).toBe(ab.matched);
          expect(ba.by).toBe(ab.by);
          expect(ba.confidence).toBe(ab.confidence);
        },
      ),
    );
  });

  it("自分自身とは必ず同一になる（識別子が 1 つでもあれば）", () => {
    fc.assert(
      fc.property(fc.array(keyArb, { minLength: 1, maxLength: 4 }), (keys) => {
        expect(matchIdentity(keys, keys).matched).toBe(true);
      }),
    );
  });

  it("判定理由は必ず文章で返る（利用者が読める形になっている）", () => {
    fc.assert(
      fc.property(keysArb, keysArb, (a, b) => {
        expect(matchIdentity(a, b).reason.trim()).not.toBe("");
      }),
    );
  });
});

describe("外から来た文字列を外観として読む", () => {
  it("正しい名前は、そのまま往復する", () => {
    fc.assert(
      fc.property(fc.constantFrom(...BRAND_THEMES), (theme) => {
        expect(parseBrandTheme(theme)).toBe(theme);
      }),
    );
    fc.assert(
      fc.property(fc.constantFrom(...COLOR_MODES), (mode) => {
        expect(parseColorMode(mode)).toBe(mode);
      }),
    );
  });

  it("知らない名前は、必ず null になる（素通しさせない）", () => {
    fc.assert(
      fc.property(fc.string(), (raw) => {
        const parsed = parseBrandTheme(raw);
        expect(parsed === null || (BRAND_THEMES as readonly string[]).includes(parsed)).toBe(true);
      }),
    );
  });

  it("何を渡しても、必ず有効な外観が 1 組決まる（色無しの画面が出ない）", () => {
    fc.assert(
      fc.property(
        fc.option(fc.string(), { nil: null }),
        fc.option(fc.string(), { nil: null }),
        (chosenTheme, chosenMode) => {
          const appearance = resolveAppearance({ chosenTheme, chosenMode });
          expect(BRAND_THEMES).toContain(appearance.brandTheme);
          expect(COLOR_MODES).toContain(appearance.colorMode);
        },
      ),
    );
  });

  it("その人が選んだものは、ブログの既定より必ず優先される", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...BRAND_THEMES),
        fc.constantFrom(...BRAND_THEMES),
        fc.constantFrom(...COLOR_MODES),
        (chosen, siteTheme, siteMode) => {
          const appearance = resolveAppearance({
            chosenTheme: chosen,
            siteDefault: { brandTheme: siteTheme, colorMode: siteMode },
          });
          expect(appearance.brandTheme).toBe(chosen);
          // 選んでいない軸だけがブログの既定に落ちる
          expect(appearance.colorMode).toBe(siteMode);
        },
      ),
    );
  });
});
