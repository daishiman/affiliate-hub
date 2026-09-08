/** @tier 1 */
import { describe, expect, it, vi } from "vitest";
import type { PublishedArticle } from "@/application/read-models/published-article";
import { createAnswerUnitExtractor } from "@/infrastructure/improvement/answer-unit-extractor";
import type { DrizzleD1 } from "@/infrastructure/persistence/d1/link-inbox-repository";
import type { WorkspaceId } from "@/domain/shared";

/**
 * 公開済み記事から、回答エンジンに引かれうる単位を切り出す側を確かめる。
 *
 * ここで守りたいのは 3 つ。
 *
 * 1. **問いの分からない断片を作らない。** 段落を機械的に刻んで並べると、
 *    引用されたときに意味が変わる。だから問いと答えの対になっている場所だけを取る。
 * 2. **FAQ と一文の結論の位置は 0。** どちらも記事の後ろに描かれるが、単体で
 *    名指しできる塊なので、節と同じ扱いにすると正しく作った FAQ が毎回
 *    「埋もれている」と指摘され、本当に埋もれている答えが埋もれる。
 * 3. **同じ問いは先に出たほうを残す。** 保存側は問いを鍵に置き換えるので、
 *    重複を渡すと後ろのものが勝ち、記事の奥の答えが表の答えを上書きする。
 *
 * @req REQ-BOPC04
 * @req feat-aeo-answer-optimization
 * @types boundary, property
 */

const WS = "ws-1" as WorkspaceId;

const AUTHOR = { slug: "a", name: "書き手", bio: "経歴", credentials: [] };

function article(overrides: Partial<PublishedArticle> = {}): PublishedArticle {
  return {
    slug: "gadget-review",
    siteSlug: "gadget",
    type: "review",
    title: "この掃除機は買いか",
    summary: "狭い部屋なら買い。吸引力より取り回しが効く。",
    categorySlug: "home",
    publishedAt: "2026-09-01",
    updatedAt: "2026-09-01",
    author: AUTHOR,
    disclosureRequired: true,
    sections: [],
    ...overrides,
  };
}

/** 1 行だけ返す薄い db。実際の D1 へは触らない。 */
function dbReturning(rows: readonly { articleJson: string }[]): DrizzleD1 {
  const limit = vi.fn(async () => rows);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  return { select } as unknown as DrizzleD1;
}

function extractorFor(a: PublishedArticle | null) {
  return createAnswerUnitExtractor(
    dbReturning(a === null ? [] : [{ articleJson: JSON.stringify(a) }]),
  );
}

describe("createAnswerUnitExtractor", () => {
  it("該当する公開記事が無ければ 0 件。失敗ではなく「引用できる形になっていない」", async () => {
    const units = await extractorFor(null)(WS, "gadget", "missing");

    expect(units).toEqual([]);
  });

  it("一文の結論を取り、記事全体が答えている問いはタイトルとみなす", async () => {
    const units = await extractorFor(article())(WS, "gadget", "gadget-review");

    expect(units).toHaveLength(1);
    expect(units[0]).toMatchObject({
      siteSlug: "gadget",
      articleSlug: "gadget-review",
      kind: "direct-answer",
      question: "この掃除機は買いか",
      answer: "狭い部屋なら買い。吸引力より取り回しが効く。",
      positionRatio: 0,
      sourceRef: null,
    });
  });

  it("結論が空白だけなら単位にしない。答えの無い問いを作らない", async () => {
    const units = await extractorFor(article({ summary: "   " }))(WS, "gadget", "gadget-review");

    expect(units).toEqual([]);
  });

  it("問いが空なら単位にしない", async () => {
    const units = await extractorFor(article({ title: "  ", summary: "答えだけある" }))(
      WS,
      "gadget",
      "gadget-review",
    );

    expect(units).toEqual([]);
  });

  it("FAQ は記事の後ろに描かれても位置 0。正しく作った FAQ を埋もれ扱いしない", async () => {
    const units = await extractorFor(
      article({
        faq: [
          { question: "水洗いできますか", answer: "ダストカップだけできます。" },
          { question: "答えが空のとき", answer: "  " },
        ],
      }),
    )(WS, "gadget", "gadget-review");

    expect(units).toHaveLength(2);
    expect(units[1]).toMatchObject({
      kind: "direct-answer",
      question: "水洗いできますか",
      positionRatio: 0,
    });
  });

  it.each([
    ["問いの形の見出し", "静かですか？", "direct-answer"],
    ["半角の疑問符でも", "Is it quiet?", "direct-answer"],
    ["語義の見出し", "サイクロン式とは", "definition"],
    ["「の意味」の見出し", "吸引仕事率の意味", "definition"],
    ["「の定義」の見出し", "静音の定義", "definition"],
    ["手順の見出し", "お手入れの手順", "step-list"],
    ["「やり方」の見出し", "フィルターの掃除のやり方", "step-list"],
    ["「の流れ」の見出し", "初期設定の流れ", "step-list"],
  ])("%s は %s として取る", async (_name, heading, kind) => {
    const units = await extractorFor(
      article({
        summary: "  ",
        sections: [{ id: "s1", heading, paragraphs: ["", "答えの段落。"] }],
      }),
    )(WS, "gadget", "gadget-review");

    expect(units).toHaveLength(1);
    expect(units[0]).toMatchObject({ kind, question: heading, answer: "答えの段落。" });
  });

  it("ただの見出しは取らない。問いが分からない断片は引用で意味が変わる", async () => {
    const units = await extractorFor(
      article({
        summary: "  ",
        sections: [{ id: "s1", heading: "使ってみた感想", paragraphs: ["よかった。"] }],
      }),
    )(WS, "gadget", "gadget-review");

    expect(units).toEqual([]);
  });

  it("問いの見出しでも中身が空白だけなら取らない", async () => {
    const units = await extractorFor(
      article({
        summary: "  ",
        sections: [{ id: "s1", heading: "静かですか？", paragraphs: ["  ", ""] }],
      }),
    )(WS, "gadget", "gadget-review");

    expect(units).toEqual([]);
  });

  it("節の位置は「何番目の節か」の比率になる", async () => {
    const units = await extractorFor(
      article({
        summary: "  ",
        sections: [
          { id: "s1", heading: "静かですか？", paragraphs: ["静かです。"] },
          { id: "s2", heading: "重いですか？", paragraphs: ["重くありません。"] },
          { id: "s3", heading: "高いですか？", paragraphs: ["普通です。"] },
        ],
      }),
    )(WS, "gadget", "gadget-review");

    expect(units.map((u) => u.positionRatio)).toEqual([0, 0.5, 1]);
  });

  it("節が 1 つしかないときは 0 で割らない", async () => {
    const units = await extractorFor(
      article({
        summary: "  ",
        sections: [{ id: "s1", heading: "静かですか？", paragraphs: ["静かです。"] }],
      }),
    )(WS, "gadget", "gadget-review");

    expect(units[0]?.positionRatio).toBe(0);
  });

  it("根拠の付いた言い切りは、見出しの形に関係なく取り、出どころを添える", async () => {
    const units = await extractorFor(
      article({
        summary: "  ",
        sections: [
          {
            id: "s1",
            heading: "実測してみた",
            paragraphs: ["本文。"],
            claims: [
              {
                id: "c1",
                statement: "運転音は 58dB だった。",
                kind: "fact",
                evidence: [
                  { id: "e1", sourceLabel: "自社実測", url: "https://example.com/m", checkedAt: "2026-08-01" },
                ],
              },
            ],
          },
        ],
      }),
    )(WS, "gadget", "gadget-review");

    expect(units).toHaveLength(1);
    expect(units[0]).toMatchObject({
      kind: "fact",
      question: "実測してみた",
      answer: "運転音は 58dB だった。",
      sourceRef: "https://example.com/m",
    });
  });

  it("URL の無い根拠は名札を出どころにする", async () => {
    const units = await extractorFor(
      article({
        summary: "  ",
        sections: [
          {
            id: "s1",
            heading: "実測してみた",
            paragraphs: [],
            claims: [
              {
                id: "c1",
                statement: "重さは 2.1kg だった。",
                kind: "fact",
                evidence: [{ id: "e1", sourceLabel: "取扱説明書", checkedAt: "2026-08-01" }],
              },
            ],
          },
        ],
      }),
    )(WS, "gadget", "gadget-review");

    expect(units[0]?.sourceRef).toBe("取扱説明書");
  });

  it("根拠が無い言い切りも捨てない。捨てると領域側が指摘できなくなる", async () => {
    const units = await extractorFor(
      article({
        summary: "  ",
        sections: [
          {
            id: "s1",
            heading: "",
            paragraphs: [],
            claims: [{ id: "c1", statement: "いちばん静かだ。", kind: "fact", evidence: [] }],
          },
        ],
      }),
    )(WS, "gadget", "gadget-review");

    expect(units).toHaveLength(1);
    expect(units[0]).toMatchObject({ sourceRef: null, question: "この掃除機は買いか" });
  });

  it.each([["inference"], ["opinion"]])("%s の言い切りは取らない", async (kind) => {
    const units = await extractorFor(
      article({
        summary: "  ",
        sections: [
          {
            id: "s1",
            heading: "見立て",
            paragraphs: [],
            claims: [
              {
                id: "c1",
                statement: "たぶん長持ちする。",
                kind: kind as "inference" | "opinion",
                evidence: [],
              },
            ],
          },
        ],
      }),
    )(WS, "gadget", "gadget-review");

    expect(units).toEqual([]);
  });

  it("中身の空の言い切りは取らない", async () => {
    const units = await extractorFor(
      article({
        summary: "  ",
        sections: [
          {
            id: "s1",
            heading: "実測",
            paragraphs: [],
            claims: [{ id: "c1", statement: "   ", kind: "fact", evidence: [] }],
          },
        ],
      }),
    )(WS, "gadget", "gadget-review");

    expect(units).toEqual([]);
  });

  it("比較表があれば、何を比べているかを 1 単位にする", async () => {
    const units = await extractorFor(
      article({
        summary: "  ",
        comparison: {
          caption: "3 機種の比較",
          columns: [{ key: "weight", label: "重さ" }],
          rows: [
            { id: "r1", label: "A 機", cells: {} },
            { id: "r2", label: "B 機", cells: {} },
          ],
        },
      }),
    )(WS, "gadget", "gadget-review");

    expect(units).toHaveLength(1);
    expect(units[0]).toMatchObject({
      kind: "comparison",
      question: "この掃除機は買いかでは何を比べているか",
      answer: "3 機種の比較（A 機、B 機）",
      positionRatio: 0,
    });
  });

  it("行の無い比較表からは単位を作らない", async () => {
    const units = await extractorFor(
      article({ summary: "  ", comparison: { caption: "比較", columns: [], rows: [] } }),
    )(WS, "gadget", "gadget-review");

    expect(units).toEqual([]);
  });

  it("同じ問いが 2 つできたら、先に出たほうを残す", async () => {
    const units = await extractorFor(
      article({
        summary: "表の答え。",
        faq: [{ question: "この掃除機は買いか", answer: "奥の答え。" }],
      }),
    )(WS, "gadget", "gadget-review");

    expect(units).toHaveLength(1);
    expect(units[0]?.answer).toBe("表の答え。");
  });

  it("長すぎる答えを途中で切らない。切った文は書き手が書いていない文になる", async () => {
    const long = "あ".repeat(600);
    const units = await extractorFor(article({ summary: long }))(WS, "gadget", "gadget-review");

    expect(units[0]?.answer).toBe(long);
  });
});
