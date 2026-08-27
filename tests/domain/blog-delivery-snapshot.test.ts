/**
 * @tier 1
 * @req REQ-BLOG04, REQ-BOPS08
 * 受入条件 A9（`docs/spec/feat-blog-ops-crud/requirements-baseline.md`）に対応する。
 * @types boundary, equivalence
 *
 * 配信物の点検結果の畳み方。
 *
 * **ここで守るのは「見ていないものを緑にしない」ことである。**
 * 設定（出す / 切る）と点検結果（出せた / 出せない）は別の表に持っていて、
 * 畳み方を 1 か所に閉じ込めてあるのは、画面ごとに違う畳み方をすると
 * ある画面でだけ欠落が消えるためである。
 */
import { describe, expect, it } from "vitest";
import {
  DELIVERY_HEALTH_LABEL,
  DELIVERY_PARTS,
  type DeliveryPart,
  type DeliverySnapshot,
  deliveryHealth,
  missingDeliveryParts,
} from "@/domain/blogops";

function snapshot(
  part: DeliveryPart,
  ok: boolean,
  checkedAt: Date,
  detail = "",
): DeliverySnapshot {
  return { part, ok, checkedAt, detail };
}

const OLD = new Date("2026-08-01T00:00:00Z");
const NEW = new Date("2026-08-20T00:00:00Z");

describe("配信物の点検結果 (A9)", () => {
  it("設定も結果も無いとき、9 種すべてが「まだ点検していない」で並ぶ", () => {
    const rows = deliveryHealth([], []);

    // 表を写さず、部品表の長さと突き合わせる。部品が増えた日に落ちるのが正しい。
    expect(rows).toHaveLength(DELIVERY_PARTS.length);
    expect(rows.map((r) => r.part)).toStrictEqual([...DELIVERY_PARTS]);
    expect(rows.every((r) => r.state === "unchecked")).toBe(true);
    expect(rows.every((r) => r.checkedAt === null)).toBe(true);
  });

  it("点検していないものは欠落として数える（緑に畳まない）", () => {
    const rows = deliveryHealth([], []);
    expect(missingDeliveryParts(rows)).toHaveLength(DELIVERY_PARTS.length);
  });

  it("同じ部品の結果が複数あるとき、一覧は最新だけを採る", () => {
    const rows = deliveryHealth(
      [],
      [
        snapshot("robots", false, OLD, "古い方"),
        snapshot("robots", true, NEW, "新しい方"),
      ],
    );

    const robots = rows.find((r) => r.part === "robots");
    expect(robots?.state).toBe("ok");
    expect(robots?.detail).toBe("新しい方");
    expect(robots?.checkedAt).toStrictEqual(NEW);
  });

  it("結果の並び順が古い順でも新しい順でも、採る 1 件は変わらない", () => {
    const ascending = deliveryHealth(
      [],
      [snapshot("robots", false, OLD, "古い方"), snapshot("robots", true, NEW, "新しい方")],
    );
    const descending = deliveryHealth(
      [],
      [snapshot("robots", true, NEW, "新しい方"), snapshot("robots", false, OLD, "古い方")],
    );
    expect(descending).toStrictEqual(ascending);
  });

  it("切ってある部品は、点検結果があっても「出さない設定」として出る", () => {
    const rows = deliveryHealth(
      [{ part: "rss_feeds", enabled: false }],
      [snapshot("rss_feeds", true, NEW, "配れる新着があります")],
    );

    const rss = rows.find((r) => r.part === "rss_feeds");
    expect(rss?.state).toBe("off");
    // 切った部品は欠落ではない。切ったこと自体は運営者の判断だから。
    expect(missingDeliveryParts(rows)).not.toContain("rss_feeds");
  });

  it("入になっていて点検が通らない部品だけが欠落になる", () => {
    const rows = deliveryHealth(
      DELIVERY_PARTS.map((part) => ({ part, enabled: true })),
      DELIVERY_PARTS.map((part) =>
        snapshot(part, part !== "llms_txt", NEW, part === "llms_txt" ? "目的が空です" : "出せます"),
      ),
    );

    expect(missingDeliveryParts(rows)).toStrictEqual(["llms_txt"]);
  });

  it("状態の言い方は 4 通りすべてに用意されている", () => {
    // 画面が独自に言い換えないよう、言葉はドメインに 1 組だけ置く。
    expect(Object.keys(DELIVERY_HEALTH_LABEL).sort()).toStrictEqual([
      "missing",
      "off",
      "ok",
      "unchecked",
    ]);
  });
});
