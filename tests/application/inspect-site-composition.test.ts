/**
 * @tier 1
 * @req REQ-BLOG01
 * @types equivalence, boundary
 *
 * 「このブログは本当に読者から開けるのか」を答える口の確認。
 *
 * この口が要る理由は、設計図（`getSite`）が答えられるのが
 * 「そう作る**つもりだった**」までで、「実際にそう**置かれている**」ではない
 * ためである。その 2 つを同じ画面の同じ節に混ぜていたのが、13 問に答えて
 * 緑の成功表示が出るのに `/s/<URL名>` が 404 だった食い違いの正体だった。
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createInspectSiteCompositionUseCase } from "@/application/usecases/site/inspect-site-composition";
import {
  SITE_COMPOSITION_ELEMENTS,
  SITE_CONTENT_REQUIRED_COUNTS,
  type CompositionCounts,
  decideHostRouting,
  evaluateSiteComposition,
} from "@/domain/authoring";
import type { ActorContext } from "@/domain/shared";
import { ok } from "@/domain/shared";
import { currentActor } from "@/presentation/composition";

const ROOT = process.cwd();

const FULL: CompositionCounts = SITE_CONTENT_REQUIRED_COUNTS;

/**
 * 数える先だけを差し替えた保存先。
 *
 * ここでフェイクを使うのは、**数えた結果をどう見せるか**だけを見たいためである。
 * 実際に数えられるか（保存先の問い合わせが正しいか）は保存先側の検査が持つ。
 */
function compositionReturning(
  counts: CompositionCounts | null,
  spy?: { slug?: string },
) {
  return async (slug: string) => {
    if (spy) spy.slug = slug;
    return ok(counts === null ? null : evaluateSiteComposition(counts));
  };
}

async function actor(): Promise<ActorContext> {
  return { ...(await currentActor()), roles: ["writer"] };
}

describe("inspectSiteComposition", () => {
  it("全部そろっていれば「開ける」と答える", async () => {
    const uc = createInspectSiteCompositionUseCase({ readComposition: compositionReturning(FULL) });

    const result = await uc.execute(await actor(), { siteSlug: "first-lens" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.reachable).toBe(true);
    expect(result.value.provisioningComplete).toBe(true);
    expect(result.value.contentReady).toBe(true);
    expect(result.value.gaps).toEqual([]);
    expect(result.value.readerPath).toBe("/s/first-lens");
  });

  it("住所の登録が無ければ「開けない」と答える", async () => {
    const uc = createInspectSiteCompositionUseCase({
      readComposition: compositionReturning({ ...FULL, network_node: 0 }),
    });

    const result = await uc.execute(await actor(), { siteSlug: "first-lens" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.reachable).toBe(false);
    expect(result.value.gaps.map((g) => g.element)).toEqual(["network_node"]);
  });

  it("埋まっている要素も返す（何があるかが見えないと直せない）", async () => {
    // 不足だけを返すと、画面は「足りないもの」しか出せない。
    // 何がどれだけ在るのかが見えて初めて、改善する側は次の一手を選べる。
    const uc = createInspectSiteCompositionUseCase({
      readComposition: compositionReturning({ ...FULL, categories: 3 }),
    });

    const result = await uc.execute(await actor(), { siteSlug: "first-lens" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.elements.map((e) => e.element)).toEqual([...SITE_COMPOSITION_ELEMENTS]);
    expect(result.value.elements.find((e) => e.element === "categories")?.count).toBe(3);
  });

  it("公開投影のCompositionReportを管理表示へ数え直さず渡す", async () => {
    const counts: CompositionCounts = {
      ...FULL,
      fixed_pages: 0,
      articles: 2,
    };
    const report = evaluateSiteComposition(counts);
    const uc = createInspectSiteCompositionUseCase({
      readComposition: async () => ok(report),
    });

    const result = await uc.execute(await actor(), { siteSlug: "first-lens" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect({
      reachable: result.value.reachable,
      provisioningComplete: result.value.provisioningComplete,
      contentReady: result.value.contentReady,
      counts: result.value.counts,
      gaps: result.value.gaps,
    }).toEqual(report);
  });

  it("埋まっている要素に直し方を出さない", async () => {
    // 足りているものに「追加できます」と添えると、不足の見分けが付かなくなる。
    const uc = createInspectSiteCompositionUseCase({ readComposition: compositionReturning(FULL) });

    const result = await uc.execute(await actor(), { siteSlug: "first-lens" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.elements.filter((e) => e.remedy !== null)).toEqual([]);
  });

  it("件数があってもレポートが不足とした要素に直し方を出す", async () => {
    const fixedPageGap = evaluateSiteComposition({ ...FULL, fixed_pages: 0 }).gaps[0];
    const report = {
      ...evaluateSiteComposition(FULL),
      provisioningComplete: true,
      contentReady: false,
      gaps: [fixedPageGap],
    };
    const uc = createInspectSiteCompositionUseCase({
      readComposition: async () => ok(report),
    });

    const result = await uc.execute(await actor(), { siteSlug: "first-lens" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.elements.find((e) => e.element === "fixed_pages")?.count).toBe(
      FULL.fixed_pages,
    );
    expect(result.value.elements.find((e) => e.element === "fixed_pages")?.remedy).toBeTruthy();
  });

  it("0 件の要素には必ず直し方が付く", async () => {
    const empty = Object.fromEntries(
      SITE_COMPOSITION_ELEMENTS.map((e) => [e, 0]),
    ) as CompositionCounts;
    const uc = createInspectSiteCompositionUseCase({ readComposition: compositionReturning(empty) });

    const result = await uc.execute(await actor(), { siteSlug: "first-lens" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const element of result.value.elements) {
      expect(element.remedy, `${element.element} の直し方`).toBeTruthy();
    }
  });

  it("無いブログは、他の作業場のブログと同じ応答にする", async () => {
    // 種類を分けると、返る code の違いだけで実在が分かってしまう。
    const uc = createInspectSiteCompositionUseCase({ readComposition: compositionReturning(null) });

    const result = await uc.execute(await actor(), { siteSlug: "not-there" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("公開投影へ、表示中のブログ名をそのまま渡す", async () => {
    const spy: { slug?: string } = {};
    const uc = createInspectSiteCompositionUseCase({
      readComposition: compositionReturning(FULL, spy),
    });

    await uc.execute(await actor(), { siteSlug: "first-lens" });

    expect(spy.slug).toBe("first-lens");
  });

  describe("住所の見せ方", () => {
    it("基底ドメインがあれば、サブドメインの住所も出す", async () => {
      const uc = createInspectSiteCompositionUseCase({
        readComposition: compositionReturning(FULL),
        siteBaseDomain: "example.com",
      });

      const result = await uc.execute(await actor(), { siteSlug: "first-lens" });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.readerHost).toBe("first-lens.example.com");
      // パスでの住所は基底ドメインの有無に関わらず**常に**出す。
      // 片方しか出さないと、手元で確かめる手段が消える。
      expect(result.value.readerPath).toBe("/s/first-lens");
    });

    it("基底ドメインが無ければ、サブドメインの住所は出さない", async () => {
      const uc = createInspectSiteCompositionUseCase({ readComposition: compositionReturning(FULL) });

      const result = await uc.execute(await actor(), { siteSlug: "first-lens" });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // 使えない住所を出すと、そこを開いた人は「壊れている」と読む。
      expect(result.value.readerHost).toBeNull();
      expect(result.value.readerPath).toBe("/s/first-lens");
    });

    /*
      ── 2 つの住所が同じ画面へ落ちること ──────────────────────────
      画面は住所を 2 通り案内する（`/s/<URL名>` と `<URL名>.<基底ドメイン>`）。
      **案内が 2 つあるなら、着く先が同じであることを機械が見ていないといけない。**
      片方だけが動く状態は、案内された人には見分けが付かず、
      しかも「作成済みと言ったのに開けない」と全く同じ形で現れる。

      ここで結んでいるのは、画面が案内する `readerPath` と、
      入口（`decideHostRouting`）が `readerHost` を受けたときに差し替える先である。
      別々に直せる 2 か所なので、突き合わせはここに置く。
    */
    it("案内する 2 つの住所が、同じ読者向けの画面へ落ちる", async () => {
      const base = "example.com";
      const uc = createInspectSiteCompositionUseCase({
        readComposition: compositionReturning(FULL),
        siteBaseDomain: base,
      });

      const result = await uc.execute(await actor(), { siteSlug: "first-lens" });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const host = result.value.readerHost;
      expect(host).not.toBeNull();

      const routed = decideHostRouting({ host, pathname: "/", baseDomain: base });

      expect(routed).toEqual({
        kind: "rewrite",
        slug: result.value.slug,
        pathname: result.value.readerPath,
      });
    });

    it("記事まで降りても、2 つの住所は同じ先へ落ちる", async () => {
      // トップだけ一致していても、下の階層で分かれたら意味が無い。
      const base = "example.com";
      const uc = createInspectSiteCompositionUseCase({
        readComposition: compositionReturning(FULL),
        siteBaseDomain: base,
      });

      const result = await uc.execute(await actor(), { siteSlug: "first-lens" });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const routed = decideHostRouting({
        host: result.value.readerHost,
        pathname: "/blog/hello",
        baseDomain: base,
      });

      expect(routed).toEqual({
        kind: "rewrite",
        slug: result.value.slug,
        pathname: `${result.value.readerPath}/blog/hello`,
      });
    });
  });

  /*
    ── 実在しない直し先を出さないこと ────────────────────────────
    実装のコメントが名指しで警戒している事故がここにある——
    版面の画面はブログ別ではなく 1 枚しか無いのに `/admin/blogs/<URL名>/layout`
    を出すと、直しに行った人は 404 を見て「壊れている」と読む。
    **不足を告げる画面が壊れて見えるのが、いちばん直せない。**
    だから行き先が実在することを、字面ではなく app ルーティングの実体で見る。
  */
  it("直し先の行き先が、すべて実在する画面である", async () => {
    const empty = Object.fromEntries(
      SITE_COMPOSITION_ELEMENTS.map((e) => [e, 0]),
    ) as CompositionCounts;
    const uc = createInspectSiteCompositionUseCase({ readComposition: compositionReturning(empty) });

    const result = await uc.execute(await actor(), { siteSlug: "first-lens" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const hrefs = result.value.elements
      .map((e) => e.manageHref)
      .filter((href): href is string => href !== null);

    // 行き先が 1 つも無ければ、この検査は何も見ていない。
    expect(hrefs.length).toBeGreaterThan(0);

    for (const href of hrefs) {
      // `/admin/sites/first-lens/documents` のような実値を、
      // ルーティング上の形（`[site]`）へ戻してから実体を探す。
      const segments = href
        .replace(/^\//, "")
        .split("/")
        .map((seg) => (seg === "first-lens" ? "[site]" : seg));
      const dir = join(ROOT, "src/app", ...segments);

      expect(
        existsSync(join(dir, "page.tsx")) || existsSync(join(dir, "page.ts")),
        `${href} の画面が src/app に無い`,
      ).toBe(true);
    }
  });
});
