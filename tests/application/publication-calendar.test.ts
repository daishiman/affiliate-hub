/** @tier 1 */
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
  const result = await (await publicationCalendarUseCases()).getCalendar.execute(actor, { month });
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
    const result = await (await publicationCalendarUseCases()).getCalendar.execute(actor, {
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
    const result = await (await publicationCalendarUseCases()).getCalendar.execute(await publisher(), {
      month: MONTH,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.canReschedule).toBe(true);
    expect(result.value.cannotRescheduleReason).toBeNull();
    // 権限を変えただけで、並ぶ件数は変わらない（見える範囲は同じ）。
    const asViewer = await (await publicationCalendarUseCases()).getCalendar.execute(actor, {
      month: MONTH,
    });
    expect(asViewer.ok).toBe(true);
    if (!asViewer.ok) return;
    expect(result.value.totalEntries).toBe(asViewer.value.totalEntries);
  });

  it("権限が無いまま変更を試みると断られる", async () => {
    const actor = await currentActor();
    const result = await (await publicationCalendarUseCases()).reschedule.execute(actor, {
      publicationId: "pub_anything",
      scheduledAt: "2099-01-01T00:00",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // 存在の有無より先に権限で断る（存在を権限の無い人に漏らさない）。
    expect(result.error.code).toBe("FORBIDDEN");
  });

  it("過去の日時は受け付けない", async () => {
    const view = await (await publicationCalendarUseCases()).getCalendar.execute(await publisher(), {
      month: MONTH,
    });
    expect(view.ok).toBe(true);
    if (!view.ok) return;
    const target = [...view.value.days.flatMap((d) => d.entries), ...view.value.undated].find(
      (e) => e.reschedulable,
    );
    expect(target, "見本に、予定日を変えられる配信がありません").toBeDefined();
    if (target === undefined) return;

    const result = await (await publicationCalendarUseCases()).reschedule.execute(await publisher(), {
      publicationId: target.publicationId,
      scheduledAt: "2020-01-01T00:00",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.field).toBe("scheduledAt");
    expect(result.error.message).toContain("過去");
  });

  it("見つからない配信を、黙って無視しない", async () => {
    const result = await (await publicationCalendarUseCases()).reschedule.execute(await publisher(), {
      publicationId: "pub_does_not_exist",
      scheduledAt: "2099-01-01T00:00",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NOT_FOUND");
    expect(result.error.suggestedAction).not.toBeUndefined();
  });

  /*
   * 見本のデータだけで動かしているとき（保存先がまだ無いとき）、
   * 操作の記録は書き足せない（`createSampleAuditLog` が断る）。
   * 予定日の変更は**誰がやったかを残せないなら実行しない**ので、
   * ここは成功ではなく「済んだこと・残っていること」を書いた断りが返る。
   *
   * 成功したときの中身は、記録を残せる組み合わせで下の
   * 「先の日時へ変えると、送信の順番待ちへ戻る」で見ている。
   */
  it("記録を残せないときは、予定日を変えたことにしない", async () => {
    const view = await (await publicationCalendarUseCases()).getCalendar.execute(await publisher(), {
      month: MONTH,
    });
    expect(view.ok).toBe(true);
    if (!view.ok) return;
    const target = [...view.value.days.flatMap((d) => d.entries), ...view.value.undated].find(
      (e) => e.reschedulable,
    );
    if (target === undefined) return;

    const result = await (await publicationCalendarUseCases()).reschedule.execute(await publisher(), {
      publicationId: target.publicationId,
      scheduledAt: "2099-03-04T10:30",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // 「失敗しました」だけにしない。何が済んでいて何が残っているかを書く。
    expect(result.error.message).toContain("記録");
    expect(result.error.suggestedAction ?? "").not.toBe("");
  });
});

describe("画面と AI の一致", () => {
  it("カレンダーと予定日変更が、画面と同じユースケースで登録されている", async () => {
    const { createToolCatalog } = await import("@/presentation/composition");
    const catalog = (await createToolCatalog());

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


// --- ここから下は、つなぎ目を差し替えて状態ごとに確かめる ------------------

import {
  createGetPublicationCalendarUseCase,
  createReschedulePublicationUseCase,
} from "@/application/usecases/distribution/publication-calendar";
import type { PublicationCalendarDeps } from "@/application/usecases/distribution/publication-calendar";
import type { PublicationState } from "@/domain/distribution";
import { ok } from "@/domain/shared/result";
import { aChannelConnection, aPublication } from "../support/factories";
import { OTHER_WORKSPACE, aPublisher, aWriter } from "../support/actors";
import { failing, recordingAuditLog, recordingEvents, testDeps } from "../support/doubles";

/**
 * 見本データだけでは、状態の組み合わせを全部は作れない。
 * 失敗したまま止まっている配信・手で貼り付ける配信・処理中の配信は、
 * どれも「予定日を変えられるか」の答えが違う。
 * ここを見ていないと、押せるはずのボタンが押せない（またはその逆）まま出る。
 */

function calendarDeps(over: Partial<PublicationCalendarDeps> = {}): PublicationCalendarDeps {
  const base = testDeps();
  return {
    publications: base.publications,
    connections: base.channelConnections,
    contentVariants: base.contentVariants,
    contentPackages: base.contentPackages,
    events: base.events,
    auditLog: recordingAuditLog().port,
    ids: base.ids,
    ...over,
  };
}

/** 配信の保存先を、渡した並びだけを持つものに差し替える。 */
function withPublications(rows: readonly ReturnType<typeof aPublication>[]) {
  const base = testDeps();
  return {
    ...base.publications,
    listRecent: async () => ok(rows),
    findById: async (_ws: unknown, id: unknown) =>
      ok(rows.find((r) => String(r.id) === String(id)) ?? null),
    save: async (p: unknown) => ok(p),
  } as PublicationCalendarDeps["publications"];
}

const publisherActor = aPublisher();
const AT = new Date("2026-08-17T05:00:00Z");
const FUTURE = "2099-03-04T10:30";

async function viewOf(deps: Partial<PublicationCalendarDeps>, actor = publisherActor) {
  const result = await createGetPublicationCalendarUseCase(calendarDeps(deps)).execute(actor, {
    month: "2026-08",
    at: AT,
  });
  expect(result.ok, result.ok ? "" : result.error.message).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

describe("状態ごとに、予定日を変えられるか", () => {
  const scheduled = new Date("2026-08-20T01:00:00Z");

  const cases: readonly { state: PublicationState; can: boolean; contains?: string }[] = [
    { state: "QUEUED", can: true },
    { state: "FAILED_VALIDATION", can: true },
    { state: "FAILED_SEND", can: true },
    { state: "RETRY_SCHEDULED", can: true },
    { state: "MANUAL_EXPORT_READY", can: true },
    { state: "PUBLISHED", can: false, contains: "すでに公開" },
    { state: "CANCELLED", can: false, contains: "取りやめ" },
    { state: "SENDING", can: false, contains: "処理中" },
    { state: "RENDERING", can: false, contains: "処理中" },
    { state: "VALIDATING", can: false, contains: "処理中" },
  ];

  it.each(cases)("$state のとき、変えられるか / 変えられない理由", async (c) => {
    const p = aPublication({ state: c.state, scheduledAt: scheduled });
    const view = await viewOf({ publications: withPublications([p]) });
    const entry = view.days.flatMap((d) => d.entries)[0];
    expect(entry, `${c.state} の配信が並んでいません`).toBeDefined();
    expect(entry.reschedulable).toBe(c.can);
    if (c.can) {
      expect(entry.notReschedulableReason).toBeNull();
    } else {
      expect(entry.notReschedulableReason ?? "").toContain(c.contains ?? "");
    }
  });

  it("変えられない状態は、変更を試みても断られる（画面と答えが揃う）", async () => {
    const p = aPublication({ state: "PUBLISHED", scheduledAt: scheduled });
    const result = await createReschedulePublicationUseCase(
      calendarDeps({ publications: withPublications([p]) }),
    ).execute(publisherActor, { publicationId: String(p.id), scheduledAt: FUTURE });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("CONFLICT");
    expect(result.error.field).toBe("scheduledAt");
  });
});

describe("予定日を変えたあとの状態", () => {
  const targets: readonly { from: PublicationState; to: PublicationState }[] = [
    // 順番待ちのものは、待ったまま日時だけ動かす。
    { from: "QUEUED", to: "QUEUED" },
    // 検査で止まったものは、直したうえで順番待ちへ戻す。
    { from: "FAILED_VALIDATION", to: "QUEUED" },
    // 送信に失敗したものは、送り直す枠へ移す。
    { from: "FAILED_SEND", to: "RETRY_SCHEDULED" },
    { from: "RETRY_SCHEDULED", to: "RETRY_SCHEDULED" },
    // 手で貼る先は、日時が覚え書きなので状態を動かさない。
    { from: "MANUAL_EXPORT_READY", to: "MANUAL_EXPORT_READY" },
  ];

  it.each(targets)("$from から変えると $to になる", async (c) => {
    const p = aPublication({ state: c.from, scheduledAt: new Date("2026-08-20T01:00:00Z") });
    const saved: unknown[] = [];
    const deps = calendarDeps({
      publications: {
        ...withPublications([p]),
        save: async (row: unknown) => {
          saved.push(row);
          return ok(row);
        },
      } as PublicationCalendarDeps["publications"],
    });
    const result = await createReschedulePublicationUseCase(deps).execute(publisherActor, {
      publicationId: String(p.id),
      scheduledAt: FUTURE,
    });
    expect(result.ok, result.ok ? "" : result.error.message).toBe(true);
    const stored = saved[0] as { state: PublicationState; scheduledAt: Date };
    expect(stored.state).toBe(c.to);
    expect(stored.scheduledAt.getUTCFullYear()).toBe(2099);
  });

  it("日時を空にすると、予定を外して「承認され次第すぐ」に戻る", async () => {
    const p = aPublication({ state: "QUEUED", scheduledAt: new Date("2026-08-20T01:00:00Z") });
    const saved: unknown[] = [];
    const result = await createReschedulePublicationUseCase(
      calendarDeps({
        publications: {
          ...withPublications([p]),
          save: async (row: unknown) => {
            saved.push(row);
            return ok(row);
          },
        } as PublicationCalendarDeps["publications"],
      }),
    ).execute(publisherActor, { publicationId: String(p.id), scheduledAt: "   " });
    expect(result.ok, result.ok ? "" : result.error.message).toBe(true);
    if (!result.ok) return;
    expect(result.value.scheduledLabel).toContain("指定なし");
    expect((saved[0] as { scheduledAt: Date | null }).scheduledAt).toBeNull();
  });

  it("読み取れない日時は、直し方が分かる形で断る", async () => {
    const p = aPublication({ state: "QUEUED" });
    const result = await createReschedulePublicationUseCase(
      calendarDeps({ publications: withPublications([p]) }),
    ).execute(publisherActor, { publicationId: String(p.id), scheduledAt: "きのう" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.field).toBe("scheduledAt");
    expect(result.error.message).toContain("選び直して");
  });

  it("他の作業場所の配信は動かせない", async () => {
    const p = aPublication({ workspaceId: OTHER_WORKSPACE, state: "QUEUED" });
    const result = await createReschedulePublicationUseCase(
      calendarDeps({ publications: withPublications([p]) }),
    ).execute(publisherActor, { publicationId: String(p.id), scheduledAt: FUTURE });
    expect(result.ok).toBe(false);
  });

  it("保存に失敗したら、成功したことにしない", async () => {
    const p = aPublication({ state: "QUEUED" });
    const result = await createReschedulePublicationUseCase(
      calendarDeps({
        publications: {
          ...withPublications([p]),
          save: async () => failing("保存先につながりません。"),
        } as PublicationCalendarDeps["publications"],
      }),
    ).execute(publisherActor, { publicationId: String(p.id), scheduledAt: FUTURE });
    expect(result.ok).toBe(false);
  });

  it("配信の読み取りに失敗したら、見つからないことにしない", async () => {
    // 「見つかりません」と返すと、利用者は消えたと思って作り直す。
    const result = await createReschedulePublicationUseCase(
      calendarDeps({
        publications: {
          ...testDeps().publications,
          findById: async () => failing("読めません。"),
        } as PublicationCalendarDeps["publications"],
      }),
    ).execute(publisherActor, { publicationId: "pub-x", scheduledAt: FUTURE });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).not.toBe("NOT_FOUND");
  });

  it("先の日時へ変えると、送信の順番待ちへ戻る", async () => {
    const p = aPublication({ state: "QUEUED" });
    const result = await createReschedulePublicationUseCase(
      calendarDeps({ publications: withPublications([p]) }),
    ).execute(publisherActor, { publicationId: String(p.id), scheduledAt: "2099-03-04T10:30" });
    expect(result.ok, result.ok ? "" : result.error.message).toBe(true);
    if (!result.ok) return;
    expect(result.value.message).toContain("2099");
  });

  it("予定日を変えたことが、誰がやったかつきで記録に残る", async () => {
    const p = aPublication({ state: "QUEUED", scheduledAt: new Date("2026-08-20T01:00:00Z") });
    const audit = recordingAuditLog();
    const result = await createReschedulePublicationUseCase(
      calendarDeps({ publications: withPublications([p]), auditLog: audit.port }),
    ).execute(publisherActor, { publicationId: String(p.id), scheduledAt: FUTURE });
    expect(result.ok, result.ok ? "" : result.error.message).toBe(true);

    expect(audit.actions()).toContain("publication.schedule_changed");
    const entry = audit.entries()[0];
    // 前と後ろの両方を残す。後ろだけだと「いつから動かしたのか」が読めない。
    expect(entry.before).not.toBeNull();
    expect(entry.after).not.toBeNull();
    expect(entry.targetId).toBe(String(p.id));
  });

  it("記録が残せなければ、予定日を変えたことにしない", async () => {
    const p = aPublication({ state: "QUEUED" });
    const result = await createReschedulePublicationUseCase(
      calendarDeps({
        publications: withPublications([p]),
        auditLog: {
          ...recordingAuditLog().port,
          append: async () => failing("記録の保存先に繋がりません。"),
        } as PublicationCalendarDeps["auditLog"],
      }),
    ).execute(publisherActor, { publicationId: String(p.id), scheduledAt: FUTURE });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("記録");
  });

  it("変えたことを、他の持ち場へ伝える", async () => {
    const p = aPublication({ state: "QUEUED" });
    const events = recordingEvents();
    const result = await createReschedulePublicationUseCase(
      calendarDeps({ publications: withPublications([p]), events: events.port }),
    ).execute(publisherActor, { publicationId: String(p.id), scheduledAt: FUTURE });
    expect(result.ok).toBe(true);
    expect(events.names()).toContain("publication.scheduled");
  });

  it("伝えるところで失敗しても、変更そのものは成功として返す", async () => {
    // ここで失敗にすると「押したのに日時が変わっていない」ように見える。
    const p = aPublication({ state: "QUEUED" });
    const result = await createReschedulePublicationUseCase(
      calendarDeps({
        publications: withPublications([p]),
        events: { publish: async () => failing("伝えられません。") } as PublicationCalendarDeps["events"],
      }),
    ).execute(publisherActor, { publicationId: String(p.id), scheduledAt: FUTURE });
    expect(result.ok, result.ok ? "" : result.error.message).toBe(true);
  });
});

describe("1 件に載る情報（つなぎ目を差し替えて）", () => {
  const scheduled = new Date("2026-08-20T01:00:00Z");

  it("接続先の指定が無いときは、その旨を書く", async () => {
    const p = aPublication({ connectionId: null, scheduledAt: scheduled });
    const view = await viewOf({ publications: withPublications([p]) });
    expect(view.days.flatMap((d) => d.entries)[0].accountLabel).toContain("指定なし");
  });

  it("接続先が消えているときは、空欄にせず「見つかりません」と書く", async () => {
    const p = aPublication({
      channelKind: "x",
      connectionId: aChannelConnection().id,
      scheduledAt: scheduled,
    });
    const view = await viewOf({
      publications: withPublications([p]),
      connections: {
        ...testDeps().channelConnections,
        listByWorkspace: async () => ok({ items: [], nextCursor: null }),
      } as PublicationCalendarDeps["connections"],
    });
    expect(view.days.flatMap((d) => d.entries)[0].accountLabel).toContain("見つかりません");
  });

  it("接続の一覧が取れなくても、配信は並べる", async () => {
    const p = aPublication({ connectionId: aChannelConnection().id, scheduledAt: scheduled });
    const view = await viewOf({
      publications: withPublications([p]),
      connections: {
        ...testDeps().channelConnections,
        listByWorkspace: async () => failing("接続先を読めません。"),
      } as PublicationCalendarDeps["connections"],
    });
    expect(view.days.flatMap((d) => d.entries)).toHaveLength(1);
  });

  it("接続先の名前が付く", async () => {
    const connection = aChannelConnection({ accountLabel: "@test_account" });
    const p = aPublication({ connectionId: connection.id, scheduledAt: scheduled });
    const view = await viewOf({
      publications: withPublications([p]),
      connections: {
        ...testDeps().channelConnections,
        listByWorkspace: async () => ok({ items: [connection], nextCursor: null }),
      } as PublicationCalendarDeps["connections"],
    });
    expect(view.days.flatMap((d) => d.entries)[0].accountLabel).toBe("@test_account");
  });

  it("記事が読めないときは、承認状態を「分からない」と書く（承認済みに見せない）", async () => {
    const p = aPublication({ scheduledAt: scheduled });
    const view = await viewOf({
      publications: withPublications([p]),
      contentVariants: {
        ...testDeps().contentVariants,
        findById: async () => failing("記事を読めません。"),
      } as PublicationCalendarDeps["contentVariants"],
    });
    const entry = view.days.flatMap((d) => d.entries)[0];
    expect(entry.approvalLabel).toContain("取得できません");
    expect(entry.awaitingApproval).toBe(false);
    expect(entry.packageId).toBeNull();
    expect(entry.title).toBe("題名のない記事");
  });

  it("配信そのものが読めないときは、空のカレンダーにせず失敗を返す", async () => {
    const result = await createGetPublicationCalendarUseCase(
      calendarDeps({
        publications: {
          ...testDeps().publications,
          listRecent: async () => failing("配信を読めません。"),
        } as PublicationCalendarDeps["publications"],
      }),
    ).execute(publisherActor, { month: "2026-08", at: AT });
    expect(result.ok).toBe(false);
  });

  it("1 件も無い月には、次に何をすればよいかを書く", async () => {
    const view = await viewOf({ publications: withPublications([]) });
    expect(view.emptyReason ?? "").toContain("承認");
    expect(view.totalEntries).toBe(0);
  });

  it("失敗したまま止まっている件数を、その日の注意として出す", async () => {
    const p = aPublication({
      state: "FAILED_SEND",
      scheduledAt: scheduled,
      lastError: "送信先が応答しません。",
    });
    const view = await viewOf({ publications: withPublications([p]) });
    const day = view.days.find((d) => d.date === "2026-08-20");
    expect(day?.warnings.join(" ")).toContain("失敗");
    expect(view.errorCount).toBe(1);
  });

  it("今日の枠に印が付く", async () => {
    const view = await viewOf({ publications: withPublications([]) });
    expect(view.days.filter((d) => d.isToday).map((d) => d.date)).toEqual(["2026-08-17"]);
  });

  it("月を指定しなければ、基準の時刻の月を出す", async () => {
    const result = await createGetPublicationCalendarUseCase(
      calendarDeps({ publications: withPublications([]) }),
    ).execute(publisherActor, { at: new Date("2026-01-05T00:00:00Z") });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.month).toBe("2026-01");
    expect(result.value.monthLabel).toBe("2026年1月");
  });

  it("記事を読む権限が無ければ、カレンダーそのものを出さない", async () => {
    const result = await createGetPublicationCalendarUseCase(calendarDeps({})).execute(
      { ...aWriter(), roles: [] },
      { month: "2026-08", at: AT },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("FORBIDDEN");
  });
});
