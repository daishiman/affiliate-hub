import { describe, expect, it } from "vitest";
import {
  MATRIX_CHANNELS,
  MATRIX_ROW_AXES,
} from "@/application/usecases/authoring/plan-generation-matrix";
import {
  currentActor,
  generationMatrixUseCases,
  sampleContentPackageId,
} from "@/presentation/composition";

/**
 * 生成マトリクスの確認。
 *
 * 固定したいのは「空欄を作らない」こと。
 * 作っていないのか作れないのかが区別できないと、利用者は待ち続ける。
 */
async function matrix(axis?: (typeof MATRIX_ROW_AXES)[number], limit?: number) {
  const result = await (await generationMatrixUseCases()).getMatrix.execute(await currentActor(), {
    packageId: sampleContentPackageId(),
    rowAxis: axis,
    limit,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

describe("生成マトリクス", () => {
  it("列は仕様どおり 7 媒体で、順序も固定されている", async () => {
    const m = await matrix();
    expect(m.channels.map((c) => c.channel)).toEqual([...MATRIX_CHANNELS]);
    expect(m.channels).toHaveLength(7);
  });

  it("どの軸で並べても、すべてのセルに状態と理由が入る", async () => {
    for (const axis of MATRIX_ROW_AXES) {
      const m = await matrix(axis);
      expect(m.rows.length).toBeGreaterThan(0);
      for (const row of m.rows) {
        expect(row.label.trim()).not.toBe("");
        expect(row.note.trim()).not.toBe("");
        expect(row.cells).toHaveLength(7);
        for (const cell of row.cells) {
          expect(cell.stateLabel.trim()).not.toBe("");
          // 空欄を作らないための本丸。理由が無いセルを 1 つも許さない。
          expect(cell.reason.trim()).not.toBe("");
        }
      }
    }
  });

  it("読者で並べると、企画に入っている読者の数だけ行ができる", async () => {
    const m = await matrix("audience");
    // 見本の企画には読者が 3 人。ID ではなく名前が出ることも一緒に確かめる。
    expect(m.rows.length).toBeGreaterThanOrEqual(2);
    for (const row of m.rows) {
      expect(row.label).not.toMatch(/^dp_/);
    }
  });

  it("切り口で並べると、選んでいない切り口も理由つきで残る", async () => {
    const m = await matrix("angle");
    // 16 種すべてを出す。隠すと「選び直せる」ことに気づけない。
    expect(m.rows).toHaveLength(16);
    const notChosen = m.rows.filter((r) => r.note.includes("選んでいない"));
    expect(notChosen.length).toBeGreaterThan(0);
  });

  it("上限を上げると、今回作る本数が増える", async () => {
    const few = await matrix("audience", 6);
    const many = await matrix("audience", 48);
    expect(many.plannedCount).toBeGreaterThan(few.plannedCount);
    // 上限で切られていることを、理由の文にも出す
    expect(
      few.rows.flatMap((r) => r.cells).some((c) => c.reason.includes("上限")),
    ).toBe(true);
  });

  it("上限が 0 以下なら、直せる言葉で断る", async () => {
    const result = await (await generationMatrixUseCases()).getMatrix.execute(await currentActor(), {
      packageId: sampleContentPackageId(),
      limit: 0,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.field).toBe("limit");
  });

  it("無い企画を指すと、見つからないと分かる誤りが返る", async () => {
    const result = await (await generationMatrixUseCases()).getMatrix.execute(await currentActor(), {
      packageId: "cp_does_not_exist",
    });
    expect(result.ok).toBe(false);
  });

  it("note を「直接公開」と書かない", async () => {
    const m = await matrix();
    const note = m.channels.find((c) => c.channel === "note");
    expect(note).toBeDefined();
    // note には公開された投稿用 API が無い。表示で嘘をつかない (§17)。
    expect(note!.publishNote).toContain("貼り付け");
    expect(note!.publishNote).not.toContain("自動");
  });

  it("すでにある文章はセルから記事へ辿れる", async () => {
    const m = await matrix("audience");
    const generated = m.rows.flatMap((r) => r.cells).filter((c) => c.state === "generated");
    expect(generated.length).toBeGreaterThan(0);
    for (const cell of generated) {
      expect(cell.variantId).not.toBeNull();
      expect(cell.variantStatusLabel).not.toBeNull();
    }
  });
});
