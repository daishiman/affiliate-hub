/**
 * @tier 1
 * @req REQ-SEO05
 * @types equivalence, boundary
 */
import { describe, expect, it } from "vitest";
import {
  type GuidelineReference,
  INITIAL_GUIDELINE_REFERENCES,
  REVIEW_INTERVAL_DAYS,
  SPEC_CHAPTERS_BY_GUIDELINE,
  referenceReviewStatus,
  specReopenRequests,
} from "@/domain/seo/guideline-reference";

/**
 * 指針の鮮度判定。
 *
 * ここが間違うと、**古い指針を根拠にした最適化が「確認済み」の顔で残り続ける**。
 * 90 日の境界は仕様上「超えたら見直し」なので、90 日ちょうどは fresh。
 */
describe("指針の見直し時期", () => {
  // 2026-01-01 から数えて 89 日後 = 2026-03-31、90 日後 = 2026-04-01、91 日後 = 2026-04-02。
  // 原典を取得済みの行で境界を見る。未取得だと日付に関わらず unverified になるため。
  const checked = {
    checkedAt: "2026-01-01",
    verification: { kind: "source_fetched", fetchedAt: "2026-01-01T00:00:00Z", contentSha256: "a".repeat(64) },
  } as const;

  it("89 日なら verified_fresh", () => {
    expect(referenceReviewStatus(checked, "2026-03-31")).toBe("verified_fresh");
  });

  it("90 日ちょうどは verified_fresh（「超えたら」見直し）", () => {
    expect(referenceReviewStatus(checked, "2026-04-01")).toBe("verified_fresh");
  });

  it("91 日で review_due になる", () => {
    expect(referenceReviewStatus(checked, "2026-04-02")).toBe("review_due");
  });

  it("読めない日付は review_due に倒す", () => {
    // 壊れた日付が「新鮮」に見えると、直すきっかけが永久に来ない。
    expect(referenceReviewStatus({ ...checked, checkedAt: "いつか" }, "2026-04-01")).toBe(
      "review_due",
    );
  });

  it("原典未取得なら、日付が新しくても verified_fresh を名乗らせない", () => {
    // 「新しい」と「確かめた」を混ぜると、要旨だけの行が最も確かに見える。
    expect(
      referenceReviewStatus(
        { checkedAt: "2026-03-31", verification: { kind: "summary_only" } },
        "2026-03-31",
      ),
    ).toBe("unverified");
  });

  it("見直し間隔は 90 日", () => {
    expect(REVIEW_INTERVAL_DAYS).toBe(90);
  });
});

describe("最初に登録する指針", () => {
  it("4 件あり、全件に確認日と『全文は未取得』の但し書きがある", () => {
    expect(INITIAL_GUIDELINE_REFERENCES).toHaveLength(4);
    for (const ref of INITIAL_GUIDELINE_REFERENCES) {
      expect(ref.checkedAt).toBe("2026-08-24");
      // 全文を読んでいないことを隠さない。要旨確認だけの行を「全文確認済み」に見せない。
      expect(ref.note).toContain("本文全文は未取得");
      // 但し書きだけでなく型でも未取得であること。文だけだと機械が判定に使えない。
      expect(ref.verification.kind).toBe("summary_only");
      expect(ref.note).toContain("WebSearch で存在・発行元・要旨を確認");
      expect(ref.url).toMatch(/^https:\/\//);
    }
  });

  it("id が重複していない", () => {
    const ids = INITIAL_GUIDELINE_REFERENCES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

/**
 * 原典の状態から、どの仕様章を開き直すかを決める。
 *
 * ここが無いと閉ループが片道になる。原典を確かめる仕組みだけ作っても、
 * 「変わっていた」ことが仕様の側へ戻らなければ、記述は古いまま残る。
 */
describe("仕様の再評価要求", () => {
  const fetched = (
    contentSha256: string,
    previousSha256?: string,
    reEvaluatedSha256?: string,
  ) =>
    ({
      kind: "source_fetched",
      fetchedAt: "2026-08-24T00:00:00Z",
      contentSha256,
      ...(previousSha256 === undefined ? {} : { previousSha256 }),
      ...(reEvaluatedSha256 === undefined ? {} : { reEvaluatedSha256 }),
    }) as const;

  const at = (over: Partial<GuidelineReference> = {}): GuidelineReference => ({
    id: "gr_1",
    title: "t",
    url: INITIAL_GUIDELINE_REFERENCES[0].url,
    publisher: "p",
    region: "global",
    checkedAt: "2026-08-24",
    verification: fetched("a".repeat(64)),
    ...over,
  });

  it("指紋が前回と変わっていれば、内容変更として出す", () => {
    const requests = specReopenRequests(
      [at({ verification: fetched("b".repeat(64), "a".repeat(64)) })],
      "2026-08-24",
    );
    expect(requests).toHaveLength(1);
    expect(requests[0].reason).toBe("content_changed");
    expect(requests[0].chapters).toEqual(SPEC_CHAPTERS_BY_GUIDELINE[INITIAL_GUIDELINE_REFERENCES[0].url]);
  });

  it("A取得→B変更→B再取得でも警告を残し、B再評価完了後だけ消し、C変更で再発する", () => {
    const a = "a".repeat(64);
    const b = "b".repeat(64);
    const c = "c".repeat(64);

    const changedToB = specReopenRequests(
      [at({ verification: fetched(b, a, a) })],
      "2026-08-24",
    );
    expect(changedToB.map((request) => request.reason)).toEqual(["content_changed"]);

    // B をもう一度取得しても、仕様を再評価した事実にはならない。
    const fetchedBAgain = specReopenRequests(
      [at({ verification: fetched(b, b, a) })],
      "2026-08-24",
    );
    expect(fetchedBAgain.map((request) => request.reason)).toEqual(["content_changed"]);

    const acknowledgedB = specReopenRequests(
      [at({ verification: fetched(b, b, b) })],
      "2026-08-24",
    );
    expect(acknowledgedB).toEqual([]);

    const changedToC = specReopenRequests(
      [at({ verification: fetched(c, b, b) })],
      "2026-08-24",
    );
    expect(changedToC.map((request) => request.reason)).toEqual(["content_changed"]);
  });

  it("前回と同じ指紋なら出さない（取り直しただけで仕様を開かない）", () => {
    const same = "a".repeat(64);
    expect(specReopenRequests([at({ verification: fetched(same, same, same) })], "2026-08-24")).toEqual([]);
  });

  it("期限切れと未取得が重なったら、期限切れを先に名乗る", () => {
    // 理由が 2 つ立つときに両方出すと、同じ章が二重に並んで数が意味を失う。
    const requests = specReopenRequests(
      [at({ checkedAt: "2026-01-01", verification: { kind: "summary_only" } })],
      "2026-08-24",
    );
    expect(requests).toHaveLength(1);
    expect(requests[0].reason).toBe("review_due");
  });

  it("どの章の根拠でもない URL は、状態が悪くても再評価の対象にしない", () => {
    // 対応表に無い出典で章を名指しできない。名指しできない要求は行き先が無い。
    const requests = specReopenRequests(
      [at({ url: "https://example.com/unknown", verification: { kind: "summary_only" } })],
      "2026-08-24",
    );
    expect(requests).toEqual([]);
  });

  it("対応表の URL は、すべて初期候補として登録できる URL である", () => {
    // 表とレジストリがずれると、登録した出典が永久に章へ結び付かない。
    const known = new Set(INITIAL_GUIDELINE_REFERENCES.map((r) => r.url));
    for (const url of Object.keys(SPEC_CHAPTERS_BY_GUIDELINE)) {
      expect(known.has(url)).toBe(true);
    }
  });
});
