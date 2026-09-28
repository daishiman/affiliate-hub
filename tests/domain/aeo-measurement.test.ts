/** @tier 1 @req REQ-SEO11 @types equivalence, boundary, decision-table */
import { describe, expect, it } from "vitest";
import {
  AUTO_APPLY_COOLDOWN_MS,
  DESCRIPTION_MIN_CHARS,
  EFFECT_JUDGEMENT_HOLD_MS,
  MEASUREMENT_SOURCES,
  MEASUREMENT_SOURCE_CAN_JUSTIFY_AUTO_APPLY,
  type Finding,
  type PageKey,
  type PageObservation,
  auditPageObservation,
  auditCompleteSite,
  auditLlmsTxt,
  autoApplyStalled,
  byUrgency,
  decideAutoApply,
  effectJudgementPending,
  pageKeyOf,
  sourceHealth,
} from "@/domain/seo/aeo-measurement";

describe("llms.txt の設計図との一致", () => {
  it.each([
    [true, "present", []],
    [true, "missing", ["missing_llms_txt"]],
    [true, "empty", ["missing_llms_txt"]],
    [false, "missing", []],
    [false, "empty", ["unexpected_llms_txt"]],
    [false, "present", ["unexpected_llms_txt"]],
  ] as const)("配信設定=%s・観測=%s", (expected, observed, codes) => {
    expect(auditLlmsTxt({ pageKey: KEY, expected, observed }, "2026-09-07T00:00:00.000Z")
      .map((row) => row.code)).toEqual(codes);
  });
});

/**
 * 計測ループの**判断**だけを見る。
 *
 * 外への問い合わせも保存も画面も出てこない。ここで固定したいのは
 * 「どういうときに書き換えてよいか」であって、書き換え方ではない。
 */

const KEY = "例.com/s/blog/best/laptops" as PageKey;

function finding(over: Partial<Finding> = {}): Finding {
  return {
    source: "static_audit",
    pageKey: KEY,
    /*
      既定は**記事を書き換えれば消える**所見にしてある。
      `missing_json_ld` のようなテンプレートの所見を既定に置くと、
      「反映してよい条件」を見るどの試験も、実際には
      「テンプレートの所見を根拠に記事を書き換えてよい」を固定してしまう。
    */
    code: "missing_title",
    detail: "title が空です。",
    observedAt: "2026-09-01T00:00:00.000Z",
    ...over,
  };
}

describe("突合の鍵", () => {
  it("クエリと後ろのスラッシュを落として、同じページを 1 つにまとめる", () => {
    const plain = pageKeyOf("https://例.com/s/blog/best/laptops");
    const withQuery = pageKeyOf("https://例.com/s/blog/best/laptops/?utm_source=chatgpt.com");
    const withHash = pageKeyOf("https://例.com/s/blog/best/laptops#結論");
    if (!plain.ok || !withQuery.ok || !withHash.ok) throw new Error("鍵を作れませんでした");
    expect(withQuery.key).toBe(plain.key);
    expect(withHash.key).toBe(plain.key);
  });

  it("ホストが違えば別のページ", () => {
    const a = pageKeyOf("https://例.com/x");
    const b = pageKeyOf("https://別.com/x");
    if (!a.ok || !b.ok) throw new Error("鍵を作れませんでした");
    expect(a.key).not.toBe(b.key);
  });

  it("ホストの大小は揃えるが、道の大小は揃えない", () => {
    const upperHost = pageKeyOf("https://例.COM/Best");
    const lowerHost = pageKeyOf("https://例.com/Best");
    const lowerPath = pageKeyOf("https://例.com/best");
    if (!upperHost.ok || !lowerHost.ok || !lowerPath.ok) throw new Error("鍵を作れませんでした");
    expect(upperHost.key).toBe(lowerHost.key);
    expect(lowerHost.key).not.toBe(lowerPath.key);
  });

  it("検索結果のページは鍵を作らない（問い合わせごとに中身が変わる）", () => {
    const result = pageKeyOf("https://例.com/s/blog/search?q=静かな");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("query_dependent_page");
  });

  it("URL に合言葉が埋まっていたら鍵を作らない（一覧と通知へ漏れる）", () => {
    const result = pageKeyOf("https://user:secret@例.com/x");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("credentials_in_url");
  });
});

describe("静的解析の規則", () => {
  function observation(over: Partial<PageObservation> = {}): PageObservation {
    return {
      pageKey: KEY,
      url: "https://例.com/s/blog/best/laptops",
      title: "静かなノートパソコンの選び方",
      metaDescription: "あ".repeat(DESCRIPTION_MIN_CHARS + 10),
      canonical: "https://例.com/s/blog/best/laptops",
      ogImage: "https://例.com/img/cover.png",
      jsonLdTypes: ["Article"],
      headingLevels: [1, 2, 2, 3],
      internalLinkCount: 4,
      images: [{ src: "/img/a.png", hasAlt: true, hasDimensions: true }],
      openGraph: {
        title: "静かなノートパソコンの選び方",
        description: "あ".repeat(DESCRIPTION_MIN_CHARS + 10),
        type: "article",
        url: "https://例.com/s/blog/best/laptops",
        image: "https://例.com/img/cover.png",
      },
      jsonLdNodes: [{
        types: ["BlogPosting"],
        properties: ["headline", "inLanguage", "articleSection", "datePublished", "author", "publisher", "mainEntityOfPage"],
        datePublished: "2026-09-01",
        dateModified: null,
      }],
      visibleDateTimes: ["2026-09-01"],
      internalLinkPageKeys: [],
      ...over,
    };
  }

  it("すべて満たしていれば所見は 0 件（合格印を並べない）", () => {
    expect(auditPageObservation(observation(), "2026-09-01T00:00:00.000Z")).toEqual([]);
  });

  it("欠けている要素をページ単位で並べる", () => {
    const found = auditPageObservation(
      observation({ canonical: null, ogImage: "", jsonLdTypes: [], openGraph: undefined, jsonLdNodes: undefined }),
      "2026-09-01T00:00:00.000Z",
    );
    expect(found.map((f) => f.code).sort()).toEqual(
      ["missing_canonical", "missing_json_ld"].sort(),
    );
  });

  it("10字未満のtitleと自己を指さないcanonicalを分けて指摘する", () => {
    const found = auditPageObservation(
      observation({ title: "短い題名", canonical: "https://例.com/s/blog/elsewhere" }),
      "2026-09-01T00:00:00.000Z",
    );
    expect(found.map((f) => f.code)).toEqual(expect.arrayContaining(["title_too_short", "canonical_not_self"]));
  });

  it("OGPは生成契約の4項目を検査し、実在画像のないページへ画像を要求しない", () => {
    const found = auditPageObservation(
      observation({ openGraph: { title: "題名", description: null, type: "article", url: null, image: null } }),
      "2026-09-01T00:00:00.000Z",
    );
    expect(found.map((f) => f.code)).toContain("missing_open_graph");
    expect(found.map((f) => f.code)).not.toContain("missing_og_image");
  });

  it("OGPの題名・説明・URLが公開ページと違えば不整合として分ける", () => {
    const found = auditPageObservation(
      observation({ openGraph: { title: "別の題名", description: "別の説明", type: "article", url: "https://例.com/s/blog/other", image: null } }),
      "2026-09-01T00:00:00.000Z",
    );
    expect(found.map((f) => f.code)).toContain("open_graph_mismatch");
  });

  it("構造化データの必須propertyと画面に見えない日付を検査する", () => {
    const found = auditPageObservation(
      observation({
        jsonLdNodes: [{ types: ["BlogPosting"], properties: ["headline", "datePublished"], datePublished: "2026-08-31", dateModified: "2026-09-01" }],
        visibleDateTimes: ["2026-08-30"],
      }),
      "2026-09-01T00:00:00.000Z",
    );
    expect(found.map((f) => f.code)).toEqual(expect.arrayContaining(["incomplete_structured_data", "structured_data_date_not_visible"]));
  });

  it("見出しの段が 2 つ飛んだら指摘する（h2 の次に h4）", () => {
    const found = auditPageObservation(
      observation({ headingLevels: [1, 2, 4] }),
      "2026-09-01T00:00:00.000Z",
    );
    expect(found.map((f) => f.code)).toContain("heading_level_skipped");
  });

  it("段が下がるのは飛びではない（節が終わっただけ）", () => {
    const found = auditPageObservation(
      observation({ headingLevels: [1, 2, 3, 2] }),
      "2026-09-01T00:00:00.000Z",
    );
    expect(found.map((f) => f.code)).not.toContain("heading_level_skipped");
  });

  it("字数はコードポイントで数える（絵文字を 2 字と数えない）", () => {
    // 60 字ちょうど。`length` で数えると 120 になり、長すぎると誤判定される。
    const found = auditPageObservation(
      observation({ title: "🍰".repeat(60) }),
      "2026-09-01T00:00:00.000Z",
    );
    expect(found.map((f) => f.code)).not.toContain("title_too_long");
  });

  it("alt の無い画像は枚数と例を出す（何を直せばよいか分かる形で）", () => {
    const found = auditPageObservation(
      observation({
        images: [
          { src: "/img/a.png", hasAlt: false, hasDimensions: true },
          { src: "/img/b.png", hasAlt: true, hasDimensions: true },
        ],
      }),
      "2026-09-01T00:00:00.000Z",
    );
    const alt = found.find((f) => f.code === "missing_image_alt");
    expect(alt?.detail).toContain("1 枚");
    expect(alt?.detail).toContain("/img/a.png");
  });
});

describe("サイト横断の静的監査", () => {
  const at = "2026-09-01T00:00:00.000Z";
  const page = (path: string, over: Partial<PageObservation> = {}): PageObservation => {
    const url = `https://example.com/s/site${path}`;
    const key = pageKeyOf(url);
    if (!key.ok) throw new Error("page key");
    return {
      pageKey: key.key, url, title: `固有のページ題名${path}`, metaDescription: `固有の説明文${path}`,
      canonical: url, ogImage: null, jsonLdTypes: ["WebPage"], headingLevels: [1],
      internalLinkCount: 1, images: [], internalLinkPageKeys: [], ...over,
    };
  };

  it("完全集合から重複title/description、被リンク0、canonical行き先不在を出す", () => {
    const home = page("");
    const article = page("/guides/a", {
      title: home.title,
      metaDescription: home.metaDescription,
      canonical: "https://example.com/s/site/guides/missing",
      internalLinkPageKeys: [home.pageKey],
    });
    const found = auditCompleteSite([home, article], at);
    expect(found.filter((f) => f.code === "duplicate_title")).toHaveLength(2);
    expect(found.filter((f) => f.code === "duplicate_meta_description")).toHaveLength(2);
    expect(found).toEqual(expect.arrayContaining([
      expect.objectContaining({ pageKey: article.pageKey, code: "orphan_page" }),
      expect.objectContaining({ pageKey: article.pageKey, code: "canonical_target_unreachable" }),
    ]));
    expect(found).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ pageKey: home.pageKey, code: "orphan_page" }),
    ]));
  });

  it("自己link、集合外link、重複linkは被リンクとして数えない", () => {
    const a = page("/guides/a");
    const outside = page("/guides/outside").pageKey;
    const b = page("/guides/b", { internalLinkPageKeys: [a.pageKey, a.pageKey, outside] });
    const found = auditCompleteSite([a, b], at);
    expect(found).not.toEqual(expect.arrayContaining([expect.objectContaining({ pageKey: a.pageKey, code: "orphan_page" })]));
    expect(found).toEqual(expect.arrayContaining([expect.objectContaining({ pageKey: b.pageKey, code: "orphan_page" })]));
  });
});

describe("自動反映してよいかの判定", () => {
  const base = {
    now: "2026-09-01T00:00:00.000Z",
    paused: false,
    loopIntroducedAt: "2026-06-01T00:00:00.000Z",
    articleCreatedAt: "2026-07-01T00:00:00.000Z",
    lastAppliedAt: null,
    findings: [finding()],
  };

  it("条件が揃えば反映してよい", () => {
    const decision = decideAutoApply(base);
    expect(decision.allowed).toBe(true);
    if (!decision.allowed) return;
    expect(decision.justifiedBy).toHaveLength(1);
  });

  it("止めているときは反映しないが、所見は返す（止めても提示は続く）", () => {
    const decision = decideAutoApply({ ...base, paused: true });
    expect(decision.allowed).toBe(false);
    if (decision.allowed) return;
    expect(decision.block).toBe("paused");
    expect(decision.reportOnly).toHaveLength(1);
  });

  it("導入前から公開されている記事は書き換えない", () => {
    const decision = decideAutoApply({ ...base, articleCreatedAt: "2026-05-01T00:00:00.000Z" });
    expect(decision.allowed).toBe(false);
    if (decision.allowed) return;
    expect(decision.block).toBe("created_before_introduction");
  });

  it("Search Console と AI 被引用は、それだけでは根拠にならない", () => {
    for (const source of ["search_console", "ai_citation"] as const) {
      const decision = decideAutoApply({
        ...base,
        findings: [finding({ source, code: "high_impressions_low_ctr" })],
      });
      expect(decision.allowed, source).toBe(false);
      if (decision.allowed) continue;
      expect(decision.block).toBe("no_reproducible_evidence");
    }
  });

  it("再現する系統の所見が混ざっていれば、根拠はその分だけになる", () => {
    const decision = decideAutoApply({
      ...base,
      findings: [
        finding(),
        finding({ source: "search_console", code: "high_impressions_low_ctr" }),
      ],
    });
    expect(decision.allowed).toBe(true);
    if (!decision.allowed) return;
    // 根拠に残るのは静的解析の 1 件だけ。
    expect(decision.justifiedBy.map((f) => f.source)).toEqual(["static_audit"]);
  });

  it("前回の反映から間隔が空いていなければ待つ", () => {
    const decision = decideAutoApply({
      ...base,
      lastAppliedAt: new Date(Date.parse(base.now) - AUTO_APPLY_COOLDOWN_MS + 1000).toISOString(),
    });
    expect(decision.allowed).toBe(false);
    if (decision.allowed) return;
    expect(decision.block).toBe("cooldown_not_elapsed");
  });

  it("間隔がちょうど空いたら反映してよい（境界）", () => {
    const decision = decideAutoApply({
      ...base,
      lastAppliedAt: new Date(Date.parse(base.now) - AUTO_APPLY_COOLDOWN_MS).toISOString(),
    });
    expect(decision.allowed).toBe(true);
  });

  it("機械が値を決められない所見しか無ければ反映しない", () => {
    const decision = decideAutoApply({ ...base, findings: [finding({ code: "title_too_long" })] });
    expect(decision.allowed).toBe(false);
    if (decision.allowed) return;
    expect(decision.block).toBe("nothing_auto_fixable");
  });

  it("同じ記事の所見はまとめて 1 回の根拠になる", () => {
    const decision = decideAutoApply({
      ...base,
      findings: [finding(), finding({ code: "missing_meta_description" })],
    });
    expect(decision.allowed).toBe(true);
    if (!decision.allowed) return;
    expect(decision.justifiedBy).toHaveLength(2);
  });

  /*
    ここが「値を決められる」と「直せる」を分けた理由そのものである。
    canonical も JSON-LD も h1 も、正しい値は 1 つに決まる（`autoFixable: true`）。
    だが出しているのは画面のテンプレートなので、記事 JSON をいくら
    書き換えても消えない。根拠に混ぜると、自動反映は
    「直したことにして記録を残す → 次の収集でまた同じ所見が出る」を
    繰り返し、**反映ログだけが積み上がってページは 1 文字も変わらない。**
  */
  it("画面の作りを直さないと消えない所見は、記事を書き換える根拠にならない", () => {
    for (const code of ["missing_canonical", "missing_json_ld", "missing_h1"] as const) {
      const decision = decideAutoApply({ ...base, findings: [finding({ code })] });
      expect(decision.allowed, code).toBe(false);
      if (decision.allowed) continue;
      expect(decision.block).toBe("nothing_auto_fixable");
      // 見せることは止めない。運営者は「直すべきだが自動では直らない」を知る。
      expect(decision.reportOnly).toHaveLength(1);
    }
  });

  it("記事の所見とテンプレートの所見が混ざったら、根拠は記事の分だけになる", () => {
    const decision = decideAutoApply({
      ...base,
      findings: [finding(), finding({ code: "missing_canonical" })],
    });
    expect(decision.allowed).toBe(true);
    if (!decision.allowed) return;
    expect(decision.justifiedBy.map((f) => f.code)).toEqual(["missing_title"]);
  });

  it("止まっている判定が、他のどの理由よりも先に出る", () => {
    // 止めたのに別の理由が出ると「止めたつもりが止まっていない」と読める。
    const decision = decideAutoApply({
      ...base,
      paused: true,
      articleCreatedAt: "2026-05-01T00:00:00.000Z",
    });
    expect(decision.allowed).toBe(false);
    if (decision.allowed) return;
    expect(decision.block).toBe("paused");
  });

  it("自動反映の根拠にできる系統は 1 つだけである（表そのものの見張り）", () => {
    const allowed = MEASUREMENT_SOURCES.filter((s) => MEASUREMENT_SOURCE_CAN_JUSTIFY_AUTO_APPLY[s]);
    expect(allowed).toEqual(["static_audit"]);
  });
});

describe("効果判定の保留", () => {
  it("反映の直後は判定しない", () => {
    expect(effectJudgementPending("2026-09-01T00:00:00.000Z", "2026-09-02T00:00:00.000Z")).toBe(true);
  });

  it("保留の期間を過ぎたら判定してよい", () => {
    const applied = "2026-09-01T00:00:00.000Z";
    const later = new Date(Date.parse(applied) + EFFECT_JUDGEMENT_HOLD_MS).toISOString();
    expect(effectJudgementPending(applied, later)).toBe(false);
  });
});

describe("系統が止まっていることの検出", () => {
  const configured = { static_audit: true, search_console: true, ai_citation: true } as const;

  it("鍵が要る系統が未登録なら「使っていない」と出す（壊れているとは言わない）", () => {
    const health = sourceHealth(
      { static_audit: "2026-09-01T00:00:00.000Z", search_console: null, ai_citation: null },
      { ...configured, search_console: false, ai_citation: false },
      "2026-09-01T00:00:00.000Z",
    );
    expect(health.find((h) => h.source === "search_console")?.state).toBe("not_configured");
  });

  it("一度も収集していない状態を「止まっている」と言わない", () => {
    const health = sourceHealth(
      { static_audit: null, search_console: null, ai_citation: null },
      configured,
      "2026-09-01T00:00:00.000Z",
    );
    expect(health.map((h) => h.state)).toEqual([
      "never_collected",
      "never_collected",
      "never_collected",
    ]);
  });

  it("想定間隔を超えて更新されない系統を名指しする", () => {
    const health = sourceHealth(
      {
        static_audit: "2026-09-01T00:00:00.000Z",
        // Search Console は日次のはず。10 日空いている。
        search_console: "2026-08-22T00:00:00.000Z",
        ai_citation: "2026-08-30T00:00:00.000Z",
      },
      configured,
      "2026-09-01T00:00:00.000Z",
    );
    const stalled = health.filter((h) => h.state === "stalled");
    expect(stalled.map((h) => h.source)).toEqual(["search_console"]);
    expect(stalled[0]?.message).toContain("Search Console");
    expect(stalled[0]?.message).toContain("10 日");
  });

  it("自動反映が止まった疑いは、件数と古さの両方が揃ったときだけ", () => {
    const now = "2026-09-01T00:00:00.000Z";
    const old = "2026-07-01T00:00:00.000Z";
    const recent = "2026-08-30T00:00:00.000Z";
    // 件数だけ多い（所見が本当に多い日はある）。
    expect(autoApplyStalled(50, recent, now)).toBe(false);
    // 古いだけ（1 件が残っているのは詰まりではない）。
    expect(autoApplyStalled(1, old, now)).toBe(false);
    expect(autoApplyStalled(50, old, now)).toBe(true);
    expect(autoApplyStalled(0, null, now)).toBe(false);
  });
});

describe("所見の並び", () => {
  it("重い順、同じ重さなら新しい順", () => {
    const low = finding({ code: "title_too_long", observedAt: "2026-09-03T00:00:00.000Z" });
    const highOld = finding({ code: "missing_json_ld", observedAt: "2026-09-01T00:00:00.000Z" });
    const highNew = finding({ code: "missing_h1", observedAt: "2026-09-02T00:00:00.000Z" });
    expect([low, highOld, highNew].sort(byUrgency).map((f) => f.code)).toEqual([
      "missing_h1",
      "missing_json_ld",
      "title_too_long",
    ]);
  });
});
