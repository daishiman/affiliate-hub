import { describe, expect, it } from "vitest";
import { currentActor, personaUseCases } from "@/presentation/composition";

/**
 * 書き手と読者像の確認。
 *
 * ここで固定したいのは「できないことに理由が付く」こと。
 * 理由の無いまま操作を塞ぐと、利用者には壊れているようにしか見えない。
 */
describe("書き手", () => {
  it("一覧が空でなく、空のときは理由が付く", async () => {
    const result = await personaUseCases().listAuthors.execute(await currentActor(), {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.total).toBeGreaterThan(0);
    // 件数があるときに理由文を出すと、画面に空の案内が二重に出る。
    expect(result.value.emptyReason).toBeNull();
  });

  it("文体の度合いは数字ではなく読める言葉で返る", async () => {
    const result = await personaUseCases().listAuthors.execute(await currentActor(), {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    for (const author of result.value.items) {
      expect(author.toneLabels.length).toBeGreaterThan(0);
      for (const tone of author.toneLabels) {
        expect(tone.label.trim()).not.toBe("");
        // 0.35 のような生の数字を画面へ流さない
        expect(tone.label).not.toMatch(/^[0-9.]+$/);
      }
    }
  });

  it("架空の書き手には、資格を名乗れない理由が付く", async () => {
    const result = await personaUseCases().listAuthors.execute(await currentActor(), {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const character = result.value.items.find((a) => a.personaTypeLabel === "案内役（架空）");
    expect(character).toBeDefined();
    if (character === undefined) return;

    expect(character.verifiedCredentials).toEqual([]);
    expect(character.limitations.some((l) => l.includes("資格"))).toBe(true);
  });

  it("居ない書き手を指すと、見つからないと分かる誤りが返る", async () => {
    const result = await personaUseCases().getAuthor.execute(await currentActor(), {
      personaId: "ap_does_not_exist",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message.trim()).not.toBe("");
  });
});

describe("読者像", () => {
  it("知識量が 1 種類に偏っていない見本を持つ", async () => {
    const result = await personaUseCases().listAudiences.execute(await currentActor(), {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.total).toBeGreaterThan(0);
    // 見本が初心者だけだと、書き分けの確認ができないまま画面が「動いて」しまう
    expect(Object.keys(result.value.countsByKnowledge).length).toBeGreaterThan(1);
  });

  it("選ぶときの基準が空の読者像を作らない", async () => {
    const result = await personaUseCases().listAudiences.execute(await currentActor(), {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    for (const audience of result.value.items) {
      // 比較表の列はここから決まる。空だと列の決めようが無い。
      expect(audience.decisionCriteria.length).toBeGreaterThan(0);
      expect(audience.nextAction.trim()).not.toBe("");
    }
  });
});

describe("事実の範囲の確認", () => {
  async function firstAuthorId(): Promise<string> {
    const list = await personaUseCases().listAuthors.execute(await currentActor(), {});
    if (!list.ok) throw new Error("見本の書き手を取得できませんでした");
    const withoutTestRun = list.value.items.find((a) => a.verifiedExperienceCount === 0);
    return (withoutTestRun ?? list.value.items[0]!).personaId;
  }

  it("試した記録が無い書き手の一人称の体験は止まる", async () => {
    const personaId = await firstAuthorId();
    const result = await personaUseCases().checkFactBoundary.execute(await currentActor(), {
      personaId,
      body: "実際に使ってみたところ、書き出しがとても速くなりました。",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.passed).toBe(false);
    expect(result.value.violations.length).toBeGreaterThan(0);
    // どこが問題かを本文の抜粋で示す。指摘だけでは直しようが無い。
    for (const violation of result.value.violations) {
      expect(violation.excerpt.trim()).not.toBe("");
      expect(violation.message.trim()).not.toBe("");
    }
  });

  it("公式情報に基づく書き方は通る", async () => {
    const personaId = await firstAuthorId();
    const result = await personaUseCases().checkFactBoundary.execute(await currentActor(), {
      personaId,
      body: "メーカーの公表値では、書き出し時間は前の型より短くなっています。",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.passed).toBe(true);
    expect(result.value.summary.trim()).not.toBe("");
  });

  it("通っても止まっても、必ず 1 行の説明が返る", async () => {
    const personaId = await firstAuthorId();
    for (const body of ["実際に試しました。", "公式の仕様では対応しています。"]) {
      const result = await personaUseCases().checkFactBoundary.execute(await currentActor(), {
        personaId,
        body,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.summary.trim()).not.toBe("");
      expect(result.value.personaName.trim()).not.toBe("");
    }
  });
});
