/**
 * @tier 1
 * @req REQ-BLOG03, REQ-BOPS01, REQ-BOPS04, REQ-BOPS06, REQ-BOPS09, REQ-BOPS10
 * 受入条件 A1, A3, A5, A11（`docs/spec/feat-blog-ops-crud/requirements-baseline.md`）に対応する。
 * `@req` は要件表の ID しか拾わないので、受入 ID はここに文章で残す。
 * @types boundary, equivalence, decision-table
 *
 * ブログ運用 (blog ops) の言葉が持つ決まりを、**境目の値**で当てる。
 *
 * ここを足した理由。サイト網・記事の部品列・鮮度・読者評価の決まりは
 * 画面と Server Action の両方から呼ばれるので、決まりが緩むと
 * 「片方の画面だけ通ってしまう」形の壊れ方をする。境目 (60 文字、180 日、
 * 365 日、1 と 5) は関数の外から見える約束なので、実装の中身ではなく
 * **この表に手で書いた期待値**で固定する。
 *
 * 参考サイトの文章・素材・固有名・色値はここにも書かない。
 */
import { describe, expect, it } from "vitest";
import {
  FRESHNESS_AGING_DAYS,
  FIXED_PAGE_KINDS,
  FIXED_PAGE_PATH,
  LAYOUT_SLOT_LABEL,
  FRESHNESS_STALE_DAYS,
  MAX_SCORE,
  MIN_SCORE,
  REQUIRED_BLOCKS,
  type SiteNetworkNode,
  buildNetworkTree,
  childrenOf,
  freshnessOf,
  missingBlocks,
  slotHeading,
  summarizeRatings,
  validateArticleRestore,
  validateArticleSlug,
  validateNetworkRestore,
  validateSiteNetworkGraph,
  validateParent,
  validateScore,
  validateShortSlug,
} from "@/domain/blogops";
import { isErr, isOk } from "@/domain/shared";

const NOW = new Date("2026-08-26T00:00:00.000Z");

describe("公開固定ページの正本語彙", () => {
  it("8 種の名前と URL を 1 つの対応表で持つ", () => {
    expect(FIXED_PAGE_KINDS).toEqual([
      "profile",
      "sitemap",
      "site_policy",
      "privacy_policy",
      "commercial_transaction",
      "contact",
      "review_guidelines",
      "company",
    ]);
    expect(FIXED_PAGE_KINDS.map((kind) => FIXED_PAGE_PATH[kind])).toEqual([
      "/profile",
      "/sitemap",
      "/site-policy",
      "/privacy-policy",
      "/commercial-transaction",
      "/contact",
      "/review-guidelines",
      "/company",
    ]);
  });
});

function daysBefore(days: number): Date {
  return new Date(NOW.getTime() - days * 86_400_000);
}

function node(over: Partial<SiteNetworkNode> & Pick<SiteNetworkNode, "siteSlug">): SiteNetworkNode {
  return {
    id: `node_${over.siteSlug}`,
    siteSlug: over.siteSlug,
    role: over.role ?? "sub",
    parentSlug: over.parentSlug ?? null,
    name: over.name ?? over.siteSlug,
    oneLine: over.oneLine ?? "",
    position: over.position ?? 0,
    status: over.status ?? "active",
  };
}

describe("URL の名前", () => {
  const cases: readonly { readonly input: string; readonly accepted: boolean; readonly why: string }[] = [
    { input: "hub", accepted: true, why: "小文字だけ" },
    { input: "a1", accepted: true, why: "数字混じり" },
    { input: "a-b-c", accepted: true, why: "間のハイフン" },
    { input: "  hub  ", accepted: true, why: "前後の空白は落とす" },
    { input: "", accepted: false, why: "空" },
    { input: "   ", accepted: false, why: "空白だけ" },
    { input: "Hub", accepted: false, why: "大文字" },
    { input: "-hub", accepted: false, why: "ハイフンで始まる" },
    { input: "hub-", accepted: false, why: "ハイフンで終わる" },
    { input: "hub_1", accepted: false, why: "下線" },
    { input: "ハブ", accepted: false, why: "英数字以外" },
  ];

  for (const c of cases) {
    it(`${c.why}: ${JSON.stringify(c.input)} は ${c.accepted ? "通る" : "断る"}`, () => {
      const r = validateShortSlug(c.input);
      expect(r.ok).toBe(c.accepted);
      if (isOk(r)) expect(r.value).toBe(c.input.trim());
      if (isErr(r)) expect(r.error.field).toBe("slug");
    });
  }

  it("60 文字は通り、61 文字は断る (長さの境目)", () => {
    expect(validateShortSlug("a".repeat(60)).ok).toBe(true);
    const over = validateShortSlug("a".repeat(61));
    expect(over.ok).toBe(false);
    if (isErr(over)) expect(over.error.code).toBe("VALIDATION_FAILED");
  });

  it("記事の URL 名は同じ形を要るが、60 文字の上限は持たない", () => {
    expect(validateArticleSlug("how-to-choose").ok).toBe(true);
    expect(validateArticleSlug("How-To").ok).toBe(false);
    expect(validateArticleSlug("").ok).toBe(false);
    // サイトと違い、記事は長い見出しをそのまま URL 名にすることがある。
    expect(validateArticleSlug("a".repeat(61)).ok).toBe(true);
  });
});

describe("親子の決まり", () => {
  it("ハブに上位は付かない", () => {
    expect(validateParent("hub", "hub", null)).toEqual({ ok: true, value: null });
    expect(validateParent("hub", "hub", "")).toEqual({ ok: true, value: null });
    const r = validateParent("hub", "hub", "other");
    expect(r.ok).toBe(false);
    if (isErr(r)) expect(r.error.field).toBe("parentSlug");
  });

  for (const role of ["sub", "mini"] as const) {
    it(`${role} に上位が無ければ断る`, () => {
      expect(validateParent(role, "x", null).ok).toBe(false);
      expect(validateParent(role, "x", "  ").ok).toBe(false);
    });

    it(`${role} は上位が有れば通る`, () => {
      expect(validateParent(role, "x", " hub ")).toEqual({ ok: true, value: "hub" });
    });

    it(`${role} は自分自身を上位にできない`, () => {
      const r = validateParent(role, "x", "x");
      expect(r.ok).toBe(false);
      if (isErr(r)) expect(r.error.message).toContain("自分自身");
    });
  }
});

describe("サイト網全体の不変条件", () => {
  it("ハブ→サブ→ミニの木だけを受け入れる", () => {
    expect(validateSiteNetworkGraph([
      node({ siteSlug: "hub", role: "hub", parentSlug: null }),
      node({ siteSlug: "sub", role: "sub", parentSlug: "hub" }),
      node({ siteSlug: "mini", role: "mini", parentSlug: "sub" }),
    ])).toEqual({ ok: true, value: true });
  });

  it("存在しない親と役割を飛び越す親を断る", () => {
    const missing = validateSiteNetworkGraph([
      node({ siteSlug: "sub", role: "sub", parentSlug: "missing" }),
    ]);
    const wrongRole = validateSiteNetworkGraph([
      node({ siteSlug: "hub", role: "hub", parentSlug: null }),
      node({ siteSlug: "mini", role: "mini", parentSlug: "hub" }),
    ]);
    expect(isErr(missing) && missing.error.field).toBe("parentSlug");
    expect(isErr(wrongRole) && wrongRole.error.field).toBe("role");
  });

  it("1つの網に中心となるハブを複数置けない", () => {
    const multipleHubs = validateSiteNetworkGraph([
      node({ siteSlug: "hub-a", role: "hub", parentSlug: null }),
      node({ siteSlug: "hub-b", role: "hub", parentSlug: null }),
    ]);
    expect(isErr(multipleHubs) && multipleHubs.error.field).toBe("role");
  });

  it("既存の子孫へ付け替えて循環する網を断る", () => {
    const cyclic = validateSiteNetworkGraph([
      node({ siteSlug: "hub", role: "hub", parentSlug: null }),
      node({ siteSlug: "sub", role: "sub", parentSlug: "mini" }),
      node({ siteSlug: "mini", role: "mini", parentSlug: "sub" }),
    ]);
    expect(isErr(cyclic) && cyclic.error.message).toContain("循環");
  });
});

describe("削除済みのサイト網を戻す決まり", () => {
  it("元の親が通常のサイト網に残っていれば、同じ URL 名で戻せる", () => {
    const target = node({ siteSlug: "sub", parentSlug: "hub" });
    const result = validateNetworkRestore(target, [node({ siteSlug: "hub", role: "hub" })]);

    expect(result).toEqual({ ok: true, value: true });
  });

  it("元の親が削除済みなら戻せない", () => {
    const result = validateNetworkRestore(node({ siteSlug: "sub", parentSlug: "hub" }), []);

    expect(isErr(result) && result.error.field).toBe("parentSlug");
  });

  it("同じ URL 名が通常のサイト網にあれば戻せない", () => {
    const target = node({ siteSlug: "sub", parentSlug: "hub" });
    const result = validateNetworkRestore(target, [
      node({ siteSlug: "hub", role: "hub" }),
      node({ siteSlug: "sub", parentSlug: "hub" }),
    ]);

    expect(isErr(result) && result.error.field).toBe("siteSlug");
  });
});

describe("削除済みの記事を戻す決まり", () => {
  const deleted = {
    id: "bar_deleted",
    siteSlug: "hub",
    slug: "same-address",
    template: "T4" as const,
    title: "戻す記事",
    lead: "",
    status: "published" as const,
    authorName: "編集部",
    publishedAt: NOW,
    updatedAt: NOW,
  };

  it("元のサイトが通常のサイト網に残り、URL が空いていれば戻せる", () => {
    expect(validateArticleRestore(deleted, [], ["hub"])).toEqual({ ok: true, value: true });
  });

  it("元のサイトが削除済みなら戻せない", () => {
    const result = validateArticleRestore(deleted, [], []);

    expect(isErr(result) && result.error.field).toBe("siteSlug");
  });

  it("同じサイトと URL 名の記事が通常一覧にあれば戻せない", () => {
    const result = validateArticleRestore(deleted, [{ ...deleted, id: "bar_active" }], ["hub"]);

    expect(isErr(result) && result.error.field).toBe("slug");
  });
});

describe("網を木に並べる", () => {
  const nodes: readonly SiteNetworkNode[] = [
    node({ siteSlug: "hub", role: "hub", parentSlug: null, position: 0 }),
    node({ siteSlug: "beta", parentSlug: "hub", position: 2 }),
    node({ siteSlug: "alpha", parentSlug: "hub", position: 1 }),
    node({ siteSlug: "mini", role: "mini", parentSlug: "alpha", position: 1 }),
  ];

  it("position の順、同じなら URL 名の順に並ぶ", () => {
    const rows = buildNetworkTree(nodes);
    expect(rows.map((r) => r.node.siteSlug)).toEqual(["hub", "alpha", "mini", "beta"]);
  });

  it("深さは親からの段数になる", () => {
    const rows = buildNetworkTree(nodes);
    expect(rows.map((r) => r.depth)).toEqual([0, 1, 2, 1]);
    expect(rows.every((r) => r.orphaned === false)).toBe(true);
  });

  it("position が同じときは URL 名の順で決まる", () => {
    const tie = [
      node({ siteSlug: "hub", role: "hub", position: 0 }),
      node({ siteSlug: "b", parentSlug: "hub", position: 5 }),
      node({ siteSlug: "a", parentSlug: "hub", position: 5 }),
    ];
    expect(buildNetworkTree(tie).map((r) => r.node.siteSlug)).toEqual(["hub", "a", "b"]);
  });

  it("親の見つからない節点を捨てず、根の隣に孤児として並べる", () => {
    const orphaned = [
      node({ siteSlug: "hub", role: "hub", position: 0 }),
      node({ siteSlug: "lost", parentSlug: "gone", position: 1 }),
    ];
    const rows = buildNetworkTree(orphaned);
    expect(rows).toHaveLength(2);
    const lost = rows.find((r) => r.node.siteSlug === "lost");
    expect(lost).toBeDefined();
    expect(lost?.depth).toBe(0);
    expect(lost?.orphaned).toBe(true);
  });

  it("節点が 1 つも無ければ空になる", () => {
    expect(buildNetworkTree([])).toEqual([]);
  });

  it("消す前に数える子は、直下だけを数える", () => {
    expect(childrenOf(nodes, "hub").map((n) => n.siteSlug)).toEqual(["beta", "alpha"]);
    expect(childrenOf(nodes, "alpha").map((n) => n.siteSlug)).toEqual(["mini"]);
    expect(childrenOf(nodes, "mini")).toEqual([]);
  });
});

describe("記事型ごとの必須部品", () => {
  // 期待値は**手で書き写す**。REQUIRED_BLOCKS から作ると、
  // 部品を 1 つ消したときに繰り返しが 1 周短くなるだけで緑のまま通る。
  const expected = {
    T1: [
      "disclosure-notice",
      "intro-box",
      "hierarchical-toc",
      "editor-credential-box",
      "criterion-section",
      "pick-section",
      "summary-section",
    ],
    T2: [
      "disclosure-notice",
      "intro-box",
      "hierarchical-toc",
      "editor-credential-box",
      "summary-section",
    ],
    T3: ["intro-box", "hierarchical-toc"],
    T4: ["intro-box"],
  } as const;

  for (const template of ["T1", "T2", "T3", "T4"] as const) {
    it(`${template} の必須部品はこの表どおりである`, () => {
      expect(REQUIRED_BLOCKS[template]).toEqual(expected[template]);
    });

    it(`${template} は必須部品が揃えば欠けなしになる`, () => {
      const blocks = expected[template].map((kind) => ({ kind }));
      expect(missingBlocks(template, blocks)).toEqual([]);
    });

    it(`${template} は 1 つ欠けるとその 1 つだけを返す`, () => {
      const [first, ...rest] = expected[template];
      expect(missingBlocks(template, rest.map((kind) => ({ kind })))).toEqual([first]);
    });
  }

  it("何も無ければ必須部品を全部返す", () => {
    expect(missingBlocks("T1", [])).toEqual(expected.T1);
  });

  it("必須でない部品を足しても欠けは増えない", () => {
    const blocks = [...expected.T4.map((kind) => ({ kind })), { kind: "comment-form" } as const];
    expect(missingBlocks("T4", blocks)).toEqual([]);
  });

  it("T4 の必須部品は T1 より少ない (型を選ぶ意味が残っている)", () => {
    expect(REQUIRED_BLOCKS.T4.length).toBeLessThan(REQUIRED_BLOCKS.T1.length);
  });
});

describe("鮮度の境目", () => {
  const cases: readonly { readonly days: number; readonly expected: string }[] = [
    { days: 0, expected: "fresh" },
    { days: 179, expected: "fresh" },
    { days: 180, expected: "aging" },
    { days: 364, expected: "aging" },
    { days: 365, expected: "stale" },
    { days: 1000, expected: "stale" },
  ];

  for (const c of cases) {
    it(`${c.days} 日前の更新は ${c.expected}`, () => {
      expect(freshnessOf(daysBefore(c.days), NOW)).toBe(c.expected);
    });
  }

  it("境目の日数は画面ではなくここで決まる", () => {
    expect(FRESHNESS_AGING_DAYS).toBe(180);
    expect(FRESHNESS_STALE_DAYS).toBe(365);
  });

  it("これから先の日付は新しい扱いにする (時計のずれで古い印を出さない)", () => {
    expect(freshnessOf(new Date(NOW.getTime() + 86_400_000), NOW)).toBe("fresh");
  });
});

describe("読者の評価", () => {
  for (const score of [1, 2, 3, 4, 5]) {
    it(`${score} 点は通る`, () => {
      expect(validateScore(score)).toEqual({ ok: true, value: score });
    });
  }

  for (const bad of [0, 6, -1, 3.5, Number.NaN]) {
    it(`${bad} 点は断る`, () => {
      const r = validateScore(bad);
      expect(r.ok).toBe(false);
      if (isErr(r)) expect(r.error.field).toBe("score");
    });
  }

  it("上下の限りはここで決まる", () => {
    expect([MIN_SCORE, MAX_SCORE]).toEqual([1, 5]);
  });

  /** 見えている票。書くたびに `{ score, hidden: false }` と並べると本題が埋もれる。 */
  const shown = (...scores: number[]) => scores.map((score) => ({ score, hidden: false }));
  /** 伏せた票。 */
  const buried = (...scores: number[]) => scores.map((score) => ({ score, hidden: true }));

  it("0 件の平均は 0 ではなく null", () => {
    expect(summarizeRatings([])).toEqual({ count: 0, average: null });
  });

  it("全員が最低点を付けた場合と 0 件は別のものになる", () => {
    expect(summarizeRatings(shown(1, 1, 1))).toEqual({ count: 3, average: 1 });
    expect(summarizeRatings([]).average).toBeNull();
  });

  it("平均は小数第 1 位まで丸める", () => {
    expect(summarizeRatings(shown(5, 4, 4))).toEqual({ count: 3, average: 4.3 });
    expect(summarizeRatings(shown(5, 4))).toEqual({ count: 2, average: 4.5 });
  });

  it("伏せた票は平均にも件数にも入らない", () => {
    // 受入条件 A11。伏せた票が件数に残ると、読者には
    // 「5 件の評価で平均 5.0」と出て、実際に見えるのは 2 件、という食い違いになる。
    expect(summarizeRatings([...shown(5, 5), ...buried(1, 1, 1)])).toEqual({
      count: 2,
      average: 5,
    });
  });

  it("全部伏せると 0 件と同じ形になる（平均は 0 ではなく null）", () => {
    // **「伏せた結果 0 件」と「最初から 0 件」を同じ形にする。**
    // 読者側で別の形にすると、伏せた事実が読者に漏れる。
    expect(summarizeRatings(buried(1, 2, 3))).toEqual({ count: 0, average: null });
  });
});

describe("枠の見出しの落とし先", () => {
  /**
   * 運営者は見出しを空にできる。空のまま出すと、枠だけが名無しで並ぶ。
   * 落とし先を**画面ごとに書かない**のがここの主題で、当て字を各画面に書くと
   * 同じ枠が管理画面と読者側で別の名前になり、運営者が自分の触った枠を見失う。
   */
  it("見出しがあれば、そのまま使う", () => {
    expect(slotHeading("brand-tag-cloud", "よく買われている作り手")).toBe("よく買われている作り手");
  });

  it("空白だけの見出しは、書いていないものとして扱う", () => {
    // 全角空白 1 つを「見出しあり」と数えると、名無しの枠が出る。
    expect(slotHeading("brand-tag-cloud", "  ")).toBe(LAYOUT_SLOT_LABEL["brand-tag-cloud"]);
  });

  it("知らない枠は、枠の名前をそのまま出す（黙って消さない）", () => {
    // 空文字を返すと、枠が名無しで並び、**足りないことに気づく手がかりが消える**。
    expect(slotHeading("not-a-known-slot", "")).toBe("not-a-known-slot");
  });
});
