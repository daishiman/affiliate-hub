/**
 * @tier 1
 * @req REQ-TM10
 * @types equivalence, decision-table
 *
 * 読者向けの開示ページの中身。
 *
 * 要件の中心は「何を書くか」ではなく「**どこから作るか**」である。
 * 説明を画面に書き起こすと、計測を 1 つ足したときに説明ページだけ古いまま残る。
 * 古いままでも画面は普通に読めるので、誰も気づかない。
 * だから登録表 (`TELEMETRY_EVENTS`) から作る、と決めてある。
 *
 * ここを足した理由。2026-08-19 に測ったところ、
 * **返す一覧を丸ごと空にしても 4090 件すべてが緑のまま通った。**
 * 追跡表の判定欄は `tests/domain/site-routes.test.ts`（表にある道には画面がある）
 * を指していたが、それは**道と画面の対応**を見ているだけで、
 * 説明の中身は誰も見ていなかった。
 */
import { describe, expect, it } from "vitest";
import { createExplainTelemetryUseCase } from "@/application/usecases/analytics/explain-telemetry";
import { RETENTION_DAYS, listTelemetryEvents } from "@/domain/analytics";
import { readerActor } from "@/presentation/composition";

const run = async (consent?: "granted" | "denied" | "unset") => {
  const r = await createExplainTelemetryUseCase().execute(readerActor(), { consent });
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
};

describe("説明は登録表から作る", () => {
  it("読者に関わる計測が、1 つ残らず説明に出る", async () => {
    // **この検査は、計測を足しても直さなくてよい。**
    // 足した計測が説明に出ていなければ、こちらが勝手に赤くなる。
    // 一覧を手で書き写すと、足した人がここも直すことになり、
    // 直し忘れが「説明していない」ではなく「テストが赤い」として現れてしまう。
    const expected = listTelemetryEvents()
      .filter((e) => e.category === "reader" || e.category === "commerce")
      .map((e) => e.label);
    const rows = (await run()).rows;

    expect(expected.length).toBeGreaterThan(0);
    expect(rows.map((r) => r.label).sort()).toEqual([...expected].sort());
  });

  it("運営側の記録（AI の利用・改善の試行）は読者の説明に出さない", async () => {
    const rows = (await run()).rows;
    expect(rows.map((r) => r.category)).not.toContain("ai");
    expect(rows.map((r) => r.category)).not.toContain("loop");
  });

  it("行ごとに「なぜ測るか」「いつ消すか」「何を記録するか」がそろっている", async () => {
    for (const r of (await run()).rows) {
      expect(r.why, `${r.label} に理由がありません`).not.toBe("");
      expect(r.categoryLabel).not.toBe("");
      expect(r.consentLabel).not.toBe("");
      expect(r.fieldNames.length, `${r.label} に記録する項目がありません`).toBeGreaterThan(0);
    }
  });

  it("保存日数は、同意が要るかどうかで決まる（行ごとに別の数を持たない）", async () => {
    for (const r of (await run()).rows) {
      expect(r.retentionDays).toBe(r.needsConsent ? RETENTION_DAYS.behaviour : RETENTION_DAYS.none);
    }
  });
});

describe("いまの状態を先頭に置く", () => {
  it("未回答・許可・拒否で、返す言葉が変わる", async () => {
    const [unset, granted, denied] = await Promise.all([
      run("unset"),
      run("granted"),
      run("denied"),
    ]);
    expect(unset.consent).toBe("unset");
    expect(granted.consent).toBe("granted");
    expect(denied.consent).toBe("denied");
    expect(new Set([unset.consentLabel, granted.consentLabel, denied.consentLabel]).size).toBe(3);
  });

  it("答えを渡さなければ、同意した扱いにしない", async () => {
    // 黙っている人を同意した扱いにしない、が計測全体の前提。
    expect((await run()).consent).toBe("unset");
  });
});

describe("記録しないと決めているもの", () => {
  it("説明の中心（記録しないもの）が空にならない", async () => {
    const v = await run();
    expect(v.neverRecorded.length).toBeGreaterThan(0);
    expect(v.retentionSummary.length).toBeGreaterThan(0);
    expect(v.howToWithdraw).not.toBe("");
  });

  it("取り消す方法に、ブラウザの設定の話が入っている", async () => {
    // 画面の中の取り消しだけを案内すると、DNT / GPC を出している読者に
    // 「こちらの設定は見ていない」と読まれる。
    expect(await run().then((v) => v.howToWithdraw)).toMatch(/DNT|GPC/);
  });
});
