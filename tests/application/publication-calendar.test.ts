import { describe, expect, it } from "vitest";
import { currentActor, publicationCalendarUseCases } from "@/presentation/composition";

/**
 * 投稿カレンダー。
 *
 * ここで固定したいのは 4 つ。
 *   1. 月の枠が、日数どおりに揃っている（月末が欠けない）
 *   2. 仕様書 §22.7 の 7 項目が 1 件ごとに揃っている
 *   3. 予定日の無い配信を、カレンダーから消さない
 *   4. 過去の日時へは動かせない（出ないまま埋もれる状態を作らない）
 */

const MONTH = "2026-08";

async function calendar(month = MONTH) {
  const actor = await currentActor();
  const result = await publicationCalendarUseCases().getCalendar.execute(actor, { month });
  expect(result.ok, result.ok ? "" : result.error.message).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

describe("月の枠", () => {
  it("その月の日数だけ枠がある", async () => {
    const view = await calendar();
    expect(view.days).toHaveLength(31);
    expect(view.days[0].dayOfMonth).toBe(1);
    expect(view.days[30].dayOfMonth).toBe(31);
  });

  it("うるう年の 2 月を 29 日として扱う", async () => {
    const view = await calendar("2028-02");
    expect(view.days).toHaveLength(29);
  });

  it("前後の月への行き先を返す（年をまたいでも正しい）", async () => {
    const view = await calendar("2026-01");
    expect(view.previousMonth).toBe("2025-12");
    expect(view.nextMonth).toBe("2026-02");
  });

  it("月の指定が壊れているときは、直し方の分かる誤りを返す", async () => {
    const actor = await currentActor();
    const result = await publicationCalendarUseCases().getCalendar.execute(actor, {
      month: "2026-13",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.field).toBe("month");
  });
});

describe("1 件に載る情報", () => {
  it("仕様書の 7 項目が、1 件ごとに揃っている", async () => {
    const view = await calendar();
    const entries = [...view.days.flatMap((d) => d.entries), ...view.undated];
    expect(entries.length, "見本の配信が 1 件も読めていません").toBeGreaterThan(0);

    for (const e of entries) {
      expect(e.channelLabel.trim(), "媒体がありません").not.toBe(""); // 1. 媒体
      expect(e.accountLabel.trim(), "アカウントの欄が空です").not.toBe(""); // 2. アカウント
      expect(e.scheduledLabel.trim(), "投稿予定の欄が空です").not.toBe(""); // 3. 投稿予定
      expect(e.approvalLabel.trim(), "承認状態がありません").not.toBe(""); // 4. 承認状態
      // 5. キャンペーン / 6. コンテンツパッケージ は無い場合があるので、
      //    「取れないときは null」であることだけを見る（空文字にしない）。
      expect(e.campaignId === null || e.campaignId.length > 0).toBe(true);
      expect(e.packageId === null || e.packageId.length > 0).toBe(true);
      // 7. エラー
      expect(e.errorMessage === null || e.errorMessage.length > 0).toBe(true);
      expect(e.href.startsWith("/admin/distribution/")).toBe(true);
    }
  });

  it("記事が読めなくても、その配信をカレンダーから消さない", async () => {
    const view = await calendar();
    const entries = [...view.days.flatMap((d) => d.entries), ...view.undated];
    for (const e of entries) {
      // 題名が取れないときも、空欄ではなく言葉を入れる。
      expect(e.title.trim()).not.toBe("");
    }
  });

  it("予定日の無い配信を、別枠にして必ず出す", async () => {
    const view = await calendar();
    for (const e of view.undated) {
      expect(e.scheduledAt).toBeNull();
      expect(e.scheduledLabel).toContain("指定なし");
    }
  });

  it("変えられない配信には、変えられない理由が付いている", async () => {
    const view = await calendar();
    const entries = [...view.days.flatMap((d) => d.entries), ...view.undated];
    for (const e of entries) {
      if (e.reschedulable) {
        expect(e.notReschedulableReason).toBeNull();
      } else {
        expect(e.notReschedulableReason?.trim(), `${e.publicationId} に理由がありません`).not.toBe(
          "",
        );
      }
    }
  });
});

describe("その日の注意", () => {
  it("注意の文は、必ず理由の形で書かれている（色だけに頼らない）", async () => {
    const view = await calendar();
    for (const day of view.days) {
      for (const w of day.warnings) {
        expect(w.trim()).not.toBe("");
        // 「3件」のような数字だけの表示にしない。
        expect(w.length).toBeGreaterThan(10);
      }
    }
  });

  it("同じ日・同じ先に寄っているとき、連投になると知らせる", async () => {
    const view = await calendar();
    // 見本には 2026-08-20 に X 向けが 3 件置いてある。
    const day = view.days.find((d) => d.date === "2026-08-20");
    expect(day, "2026-08-20 の枠がありません").toBeDefined();
    expect(day?.entries).toHaveLength(3);
    expect(day?.warnings.join(" ")).toContain("連投");
  });

  it("集計の件数が、実際に並べた件数と一致している", async () => {
    const view = await calendar();
    const inMonth = view.days.flatMap((d) => d.entries);
    expect(view.totalEntries).toBe(inMonth.length + view.undated.length);
    expect(view.errorCount).toBe(inMonth.filter((e) => e.errorMessage !== null).length);
    expect(view.awaitingApprovalCount).toBe(inMonth.filter((e) => e.awaitingApproval).length);
  });
});

/** 予定日を動かせる担当者。見本のログインには公開の権限を持たせていない。 */
async function publisher() {
  const actor = await currentActor();
  return { ...actor, roles: ["publisher"] as const };
}

describe("予定日の変更", () => {
  it("公開の権限が無い人には、変更の欄を出さずに理由を返す", async () => {
    // 見本のログインは編集までで、公開の権限を持たない（認証が入るまでの安全側）。
    const view = await calendar();
    expect(view.canReschedule).toBe(false);
    expect(view.cannotRescheduleReason).toContain("権限がありません");

    for (const e of [...view.days.flatMap((d) => d.entries), ...view.undated]) {
      expect(e.reschedulable, "権限が無いのに変更できることになっています").toBe(false);
      expect(e.notReschedulableReason).toContain("権限がありません");
    }
  });

  it("公開の権限がある人には、変更できる配信が出る", async () => {
    const actor = await currentActor();
    const result = await publicationCalendarUseCases().getCalendar.execute(await publisher(), {
      month: MONTH,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.canReschedule).toBe(true);
    expect(result.value.cannotRescheduleReason).toBeNull();
    // 権限を変えただけで、並ぶ件数は変わらない（見える範囲は同じ）。
    const asViewer = await publicationCalendarUseCases().getCalendar.execute(actor, {
      month: MONTH,
    });
    expect(asViewer.ok).toBe(true);
    if (!asViewer.ok) return;
    expect(result.value.totalEntries).toBe(asViewer.value.totalEntries);
  });

  it("権限が無いまま変更を試みると断られる", async () => {
    const actor = await currentActor();
    const result = await publicationCalendarUseCases().reschedule.execute(actor, {
      publicationId: "pub_anything",
      scheduledAt: "2099-01-01T00:00",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // 存在の有無より先に権限で断る（存在を権限の無い人に漏らさない）。
    expect(result.error.code).toBe("FORBIDDEN");
  });

  it("過去の日時は受け付けない", async () => {
    const view = await publicationCalendarUseCases().getCalendar.execute(await publisher(), {
      month: MONTH,
    });
    expect(view.ok).toBe(true);
    if (!view.ok) return;
    const target = [...view.value.days.flatMap((d) => d.entries), ...view.value.undated].find(
      (e) => e.reschedulable,
    );
    expect(target, "見本に、予定日を変えられる配信がありません").toBeDefined();
    if (target === undefined) return;

    const result = await publicationCalendarUseCases().reschedule.execute(await publisher(), {
      publicationId: target.publicationId,
      scheduledAt: "2020-01-01T00:00",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.field).toBe("scheduledAt");
    expect(result.error.message).toContain("過去");
  });

  it("見つからない配信を、黙って無視しない", async () => {
    const result = await publicationCalendarUseCases().reschedule.execute(await publisher(), {
      publicationId: "pub_does_not_exist",
      scheduledAt: "2099-01-01T00:00",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NOT_FOUND");
    expect(result.error.suggestedAction).not.toBeUndefined();
  });

  it("先の日時へ変えると、送信の順番待ちへ戻る", async () => {
    const view = await publicationCalendarUseCases().getCalendar.execute(await publisher(), {
      month: MONTH,
    });
    expect(view.ok).toBe(true);
    if (!view.ok) return;
    const target = [...view.value.days.flatMap((d) => d.entries), ...view.value.undated].find(
      (e) => e.reschedulable,
    );
    if (target === undefined) return;

    const result = await publicationCalendarUseCases().reschedule.execute(await publisher(), {
      publicationId: target.publicationId,
      scheduledAt: "2099-03-04T10:30",
    });
    expect(result.ok, result.ok ? "" : result.error.message).toBe(true);
    if (!result.ok) return;
    expect(result.value.message).toContain("2099");
  });
});

describe("画面と AI の一致", () => {
  it("カレンダーと予定日変更が、画面と同じユースケースで登録されている", async () => {
    const { createToolCatalog } = await import("@/presentation/composition");
    const catalog = createToolCatalog();

    const read = catalog.find((t) => t.name === "get_publication_calendar");
    expect(read, "get_publication_calendar が道具の一覧にありません").toBeDefined();
    expect(read?.readOnly).toBe(true);

    const write = catalog.find((t) => t.name === "reschedule_publication");
    expect(write, "reschedule_publication が道具の一覧にありません").toBeDefined();
    expect(write?.readOnly).toBe(false);
    // 予定日の変更は公開のタイミングを動かす操作。人の確認を必ず挟む。
    expect(write?.requiresHumanApproval).toBe(true);
  });
});
