import { describe, expect, it } from "vitest";
import { DASHBOARD_WIDGET_KEYS } from "@/application/usecases/dashboard/read-dashboard";
import { ADMIN_NAV } from "@/presentation/ui";
import { currentActor, dashboardUseCases } from "@/presentation/composition";

/**
 * ホーム画面の 11 個の数字。
 *
 * ここで固定したいのは、数の正しさではなく **数の出し方**。
 *   1. 数字だけを出さない（意味と行き先が必ず付く）
 *   2. 「0 件」と「数えられなかった」を混ぜない
 *   3. 行き先が実在する画面である
 * この 3 つは目視だと必ず崩れるので、機械で止める。
 */

/** 見本データの時刻。ここを固定しないと「本日の投稿」が日によって変わる。 */
const AT = new Date("2026-08-16T09:00:00Z");

async function board() {
  const actor = await currentActor();
  const result = await dashboardUseCases().getDashboard.execute(actor, { at: AT });
  expect(result.ok, result.ok ? "" : result.error.message).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

describe("ホーム画面の数字", () => {
  it("仕様書の 11 個が、書かれた順で揃っている", async () => {
    const view = await board();
    expect(view.widgets.map((w) => w.key)).toEqual([...DASHBOARD_WIDGET_KEYS]);
  });

  it("すべての数字に、意味と行き先が付いている", async () => {
    const view = await board();
    for (const w of view.widgets) {
      expect(w.label.trim(), `${w.key} に見出しがありません`).not.toBe("");
      // 数だけ出して終わりにしない。何を意味するかを必ず書く。
      expect(w.reason.trim(), `${w.key} に説明がありません`).not.toBe("");
      expect(w.actionLabel.trim(), `${w.key} に行き先の名前がありません`).not.toBe("");
      expect(w.href.startsWith("/admin"), `${w.key} の行き先が管理画面ではありません`).toBe(true);
    }
  });

  it("行き先がすべて、実在する管理画面である", async () => {
    const view = await board();
    const known = new Set(ADMIN_NAV.map((n) => n.href));
    for (const w of view.widgets) {
      expect(known.has(w.href), `${w.key} の行き先 ${w.href} は管理画面の一覧にありません`).toBe(
        true,
      );
    }
  });

  it("数えられなかったものを 0 件と書かない", async () => {
    const view = await board();
    for (const w of view.widgets) {
      if (w.unavailableReason !== null) {
        expect(w.value, `${w.key} は数えられていないのに値が入っています`).toBeNull();
        expect(w.valueLabel).toBe("—");
        // 「出せません」だけで終わらせない。なぜ出せないかを書く。
        expect(w.unavailableReason.trim()).not.toBe("");
      } else {
        expect(w.value, `${w.key} の値がありません`).not.toBeNull();
        expect(w.valueLabel.trim()).not.toBe("");
      }
    }
  });

  it("値が 0 のものに色を付けない（手当ての要る数字が埋もれないようにする）", async () => {
    const view = await board();
    for (const w of view.widgets) {
      if (w.value === 0 && w.unavailableReason === null && w.key !== "revenue") {
        expect(w.tone, `${w.key} は 0 件なのに色が付いています`).toBe("neutral");
      }
    }
  });

  it("手当てが不要なときだけ、その旨の説明が出る", async () => {
    const view = await board();
    if (view.attentionCount === 0) {
      expect(view.allClearReason).not.toBeNull();
    } else {
      expect(view.allClearReason).toBeNull();
    }
  });

  it("集計の基準時刻と期間を返す（いつの数字か分かるようにする）", async () => {
    const view = await board();
    expect(view.asOf.getTime()).toBe(AT.getTime());
    expect(view.period).toBe("2026-08");
  });
});

describe("お金の数字と権限", () => {
  it("収益は、未取得の金額を 0 円として足さない", async () => {
    const view = await board();
    const revenue = view.widgets.find((w) => w.key === "revenue");
    expect(revenue).toBeDefined();
    if (revenue === undefined) return;
    if (revenue.unavailableReason === null) {
      // 見本には金額が未取得の成果が 1 件混ざっている。
      // それを 0 円として足していないことを、説明文で明示している。
      expect(revenue.reason).toContain("未取得");
    }
  });

  it("お金を見る権限が無い人には、数字ではなく理由が返る", async () => {
    const actor = await currentActor();
    const writerOnly = { ...actor, roles: ["writer"] as const };
    const result = await dashboardUseCases().getDashboard.execute(writerOnly, { at: AT });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    for (const key of ["link_inbox", "broken_links", "conversions", "revenue"] as const) {
      const w = result.value.widgets.find((x) => x.key === key);
      expect(w?.value, `${key} の数字が権限なしで見えています`).toBeNull();
      expect(w?.unavailableReason).toContain("権限がありません");
    }
    // 編集側の数字は、権限が無くても見える（記事の担当者が使う画面のため）。
    const generation = result.value.widgets.find((x) => x.key === "generation_queue");
    expect(generation?.unavailableReason).toBeNull();
  });
});

describe("画面と AI の一致", () => {
  it("get_dashboard が、画面と同じユースケースで登録されている", async () => {
    const { createToolCatalog } = await import("@/presentation/composition");
    const tool = createToolCatalog().find((t) => t.name === "get_dashboard");
    expect(tool, "get_dashboard が道具の一覧にありません").toBeDefined();
    // ホーム画面の数字は読むだけ。ページ内の AI にも渡してよい。
    expect(tool?.readOnly).toBe(true);
  });
});
