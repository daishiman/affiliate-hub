/**
 * @tier 1
 * @req REQ-BOPC01
 * @req REQ-BOPC04
 * @req feat-blog-custom-domain
 * @req feat-seo-assessment-reflection
 * @types screen-states, a11y, keyboard
 *
 * ブログ運営コンソールの新しい 2 面（住所・改善）の画面。
 *
 * ここで見るのは 3 つ。
 *
 *   1. **状態で押せるものが変わる。** 配信できていない住所を「読者へ
 *      見せる」に選べると、切り替えた瞬間に全記事がどこにも着かない。
 *   2. **断りが画面に出る。** ユースケースが欄の名前を付けた断りは、
 *      その欄のところに `role="alert"` で出る。名前と欄が食い違うと
 *      断りは黙って捨てられる。
 *   3. **押しボタンは本物の button である。** 行に 3 つ並ぶ操作を
 *      `name="intent"` で名乗らせているので、キーボードで辿った先の
 *      押しボタン自身が「どの操作か」を持つ。
 */
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomDomain } from "@/domain/domains";
import type { SeoFinding } from "@/domain/seo";

/**
 * 直前の操作の結果。テストごとに差し替える。
 *
 * `useActionState` をそのまま描くと常に初期状態になり、
 * **断りが画面に出るか**を確かめられない。
 */
const formState = vi.hoisted(() => ({
  current: { status: "idle", message: "" } as {
    status: "idle" | "done" | "failed";
    message: string;
    field?: string;
  },
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useActionState: () => [formState.current, () => undefined, false],
  };
});

const { BlogDomainRow, RegisterBlogDomainForm } = await import(
  "@/presentation/admin/publish/blog-domain-form"
);
const { AeoProfileForm, SeoFindingRow } = await import(
  "@/presentation/admin/publish/blog-improvement-form"
);

const SITE = "console-blog";

function aDomain(over: Partial<CustomDomain> = {}): CustomDomain {
  return {
    id: "dom-1",
    siteSlug: SITE,
    hostname: "blog.example.com",
    status: "pending",
    certificateStatus: "pending",
    canonical: false,
    externalHostnameId: null,
    syncedAt: null,
    lastError: null,
    ...over,
  };
}

const FINDING: SeoFinding = {
  id: "fnd-1",
  siteSlug: SITE,
  articleSlug: "how-to-choose",
  checkKind: "title",
  severity: "critical",
  state: "open",
  detail: "タイトルが 12 文字しかありません。",
  evidence: "title=「選び方」(12 文字)",
  suggestion: "何を選ぶのかを入れてください。",
  assessedAt: new Date("2026-09-04T12:00:00Z"),
};

beforeEach(() => {
  formState.current = { status: "idle", message: "" };
});

describe("住所の行: 状態で押せるものが変わる", () => {
  it("配信できていない住所は「読者へ見せる」を選べない", () => {
    const html = renderToStaticMarkup(
      <BlogDomainRow siteSlug={SITE} domain={aDomain({ status: "pending" })} canonical={false} />,
    );

    expect(html).not.toContain('value="set_canonical"');
    // 取り直しと取り下げは、どの状態でもできる。
    expect(html).toContain('value="sync"');
    expect(html).toContain('value="revoke"');
  });

  it("配信中の住所は「読者へ見せる」を選べる", () => {
    const html = renderToStaticMarkup(
      <BlogDomainRow siteSlug={SITE} domain={aDomain({ status: "active" })} canonical={false} />,
    );

    expect(html).toContain('value="set_canonical"');
  });

  it("いま見せている住所には、もう一度見せる操作を出さない", () => {
    const html = renderToStaticMarkup(
      <BlogDomainRow siteSlug={SITE} domain={aDomain({ status: "active" })} canonical />,
    );

    expect(html).not.toContain('value="set_canonical"');
    expect(html).toContain("いま読者へ見せている住所");
  });

  it("取り下げ済みの住所には、取り下げの欄も押しボタンも出さない", () => {
    const html = renderToStaticMarkup(
      <BlogDomainRow siteSlug={SITE} domain={aDomain({ status: "revoked" })} canonical={false} />,
    );

    expect(html).not.toContain('value="revoke"');
    expect(html).not.toContain('name="reason"');
  });

  it("直近の失敗があれば、その文言を行に出す", () => {
    const html = renderToStaticMarkup(
      <BlogDomainRow
        siteSlug={SITE}
        domain={aDomain({ status: "failed", lastError: "DNS の CNAME が見つかりません" })}
        canonical={false}
      />,
    );

    expect(html).toContain("DNS の CNAME が見つかりません");
  });
});

describe("断りは、名前を付けた欄のところに出る", () => {
  it("住所の形が違うという断りは、住所の欄に出る", () => {
    formState.current = { status: "failed", message: "住所の形が違います。", field: "hostname" };

    const html = renderToStaticMarkup(<RegisterBlogDomainForm siteSlug={SITE} />);

    expect(html).toContain('role="alert"');
    expect(html).toContain("住所の形が違います。");
    expect(html).toContain('aria-invalid="true"');
  });

  it("欄の名前が付かない断りは、フォームの結果として出る", () => {
    formState.current = { status: "failed", message: "このドメインは見つかりませんでした。" };

    const html = renderToStaticMarkup(<RegisterBlogDomainForm siteSlug={SITE} />);

    expect(html).toContain("このドメインは見つかりませんでした。");
    // 欄の側では鳴らない（どの欄を直せばよいか言えないため）。
    expect(html).not.toContain('aria-invalid="true"');
  });

  it("構えの断りは、その欄（名乗る名前）に出る", () => {
    formState.current = {
      status: "failed",
      message: "出典として名乗る主体を書いてください。",
      field: "publisherName",
    };

    const html = renderToStaticMarkup(<AeoProfileForm siteSlug={SITE} profile={null} />);

    expect(html).toContain("出典として名乗る主体を書いてください。");
    expect(html).toContain('aria-invalid="true"');
  });
});

describe("すべての入力欄に、名札が結び付いている", () => {
  it.each([
    ["住所の登録", <RegisterBlogDomainForm key="d" siteSlug={SITE} />],
    ["AEO の構え", <AeoProfileForm key="a" siteSlug={SITE} profile={null} />],
    ["SEO の指摘 1 件", <SeoFindingRow key="s" siteSlug={SITE} finding={FINDING} />],
  ])("%s の欄は label の for と id が一致する", (_name, element) => {
    const html = renderToStaticMarkup(element);

    const labelFor = [...html.matchAll(/<label[^>]*for="([^"]+)"/g)].map((m) => m[1]);
    const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));

    expect(labelFor.length).toBeGreaterThan(0);
    for (const target of labelFor) {
      expect(ids).toContain(target);
    }
  });
});

describe("キーボードで辿れる形になっている", () => {
  it("行に並ぶ 3 つの操作は、押しボタン自身が「どの操作か」を持つ", () => {
    const html = renderToStaticMarkup(
      <BlogDomainRow siteSlug={SITE} domain={aDomain({ status: "active" })} canonical={false} />,
    );

    /*
     * `intent` を隠し欄に置くと `FormData.get("intent")` が先頭の
     * 隠し欄を拾い、取り下げのつもりで押した操作が別のものになる。
     * 押しボタン自身に名乗らせているので、キーボードで辿った先と
     * 送られる操作が一致する。
     */
    expect(html).not.toMatch(/<input(?=[^>]*type="hidden")(?=[^>]*name="intent")/);
    const intents = [...html.matchAll(/<button(?=[^>]*name="intent")[^>]*value="([^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(intents).toEqual(expect.arrayContaining(["sync", "set_canonical", "revoke"]));
  });

  it("操作は button であって、押せない要素に onclick を付けていない", () => {
    const html = renderToStaticMarkup(<SeoFindingRow siteSlug={SITE} finding={FINDING} />);

    expect(html).toContain("<button");
    // 焦点から外した押しボタンがあると、キーボードだけでは辿り着けない。
    expect(html).not.toContain('tabindex="-1"');
    expect(html).not.toContain("<div onclick");
  });
});
