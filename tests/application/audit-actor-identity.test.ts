/**
 * @tier 1
 * @req REQ-SEC09
 * @types audit-log, permission-matrix, equivalence
 *
 * 操作の記録が「誰がやったか」を本当に持っているかを見る。
 *
 * `wasApprovedByHuman()` は「承認が**人によって**行われたこと」を返す。
 * ところが `ActorContext.userId` は `string` で、**まだログインしていないことを表す値が型に無い**。
 * 実際には `"anonymous"`（読者）や `"u_sample"`（見本）という**普通の文字列**が入る。
 * 以前は変換する側（`auditActorOf`）が `userId === ""` だけを「無い」と見なしており、
 * 空文字を作る場所は 1 つも無かったので、この 2 つは素通りして
 * 「anonymous という人が承認した」として数えられていた。
 *
 * 直し方は 2 つに分けてある（2026-08-19）:
 *   - **記録は残す。** 残さないと「誰も押していない」と「押したが記録を断った」が
 *     同じ「行が無い」に化ける。
 *   - **確かめていないことを印（`identified`）で残し、`wasApprovedByHuman()` が印を見る。**
 *
 * よってここで固定するのは「記録できないこと」ではなく、
 * **記録は残り、かつ人の承認としては数えられないこと**である。
 */
import { describe, expect, it } from "vitest";
import { auditActorOf } from "@/application/audit";
import { createAuditLogEntry, wasApprovedByHuman } from "@/domain/compliance";
import type { AuditLogEntry } from "@/domain/compliance";
import type { ActorContext, AuditLogId, WorkspaceId } from "@/domain/shared";
import { taggedString } from "@/domain/shared";
import { SAMPLE_ACTOR } from "@/infrastructure/identity/sample-actor";
import { readerActor } from "@/presentation/composition";
import { anOwner } from "../support/actors";

/**
 * **まだログインしていない人**を表す身元。
 *
 * ここは「権限が無い人」（`aNobody`）とは別物である。あちらはログインした上で
 * 何も許されていない人で、`userId` は本物の人を指している。
 * こちらは**指す先の人が居ない**。記録に名前を書くと、その名前は嘘になる。
 *
 * テスト用に作った値を並べていない。並べると、本番に無い形だけを直して
 * 通せてしまう。**本番のコードが実際に返すものだけ**を集めてある。
 */
const NOT_SIGNED_IN: readonly { readonly what: string; readonly actor: ActorContext }[] = [
  { what: "読者（未ログインで公開ページを見ている人）", actor: readerActor() },
  { what: "見本（ログインを解決できないときに画面が落ちる先）", actor: SAMPLE_ACTOR },
];

function anEntryBy(actor: ActorContext): ReturnType<typeof createAuditLogEntry> {
  return createAuditLogEntry({
    id: taggedString<"AuditLogId">("al_test") as AuditLogId,
    workspaceId: actor.workspaceId as WorkspaceId,
    action: "content.approved",
    actor: auditActorOf(actor),
    targetType: "content",
    targetId: "c_1",
    reason: "確認しました。",
    occurredAt: new Date("2026-08-19T00:00:00Z"),
  });
}

describe("操作の記録が持つ「誰が」", () => {
  it("まだログインしていない人を表す身元が、本番のコードに 2 通りある", () => {
    // 数が減ったら、下の 2 件が「試す相手が居ないから緑」になる。
    // 0 を主張する検査ではないが、母集団が痩せれば同じことが起きる。
    expect(
      NOT_SIGNED_IN.length,
      "まだログインしていない身元が減っています。減らしたのなら、下の検査が" +
        "何を試しているのかを確かめ直してください（相手が居なければ何も試していません）。",
    ).toBeGreaterThanOrEqual(2);
  });

  it("まだログインしていない身元は、記録の上で「確かめていない」印が付く", () => {
    const unmarked = NOT_SIGNED_IN.filter((c) => auditActorOf(c.actor).identified).map(
      (c) => `${c.what} → userId ${String(auditActorOf(c.actor).userId)} が確かめた身元として記録される`,
    );
    expect(
      unmarked,
      `まだログインしていない人が、確かめた身元として記録されます:\n${unmarked.join("\n")}\n` +
        "ActorContext は userId: string で、ログインしていないことを表す値を持っていません。" +
        "名前が付いていること（anonymous / u_sample）は、確かめたことを意味しません。",
    ).toEqual([]);
  });

  /*
   * **逆向きの検査である。** 上と下は「印が付くこと」「人として数えないこと」を見るが、
   * ここは「行が残ること」を見る。片方だけだと、断って行を消す直し方に戻れてしまう。
   * 行が消えると、押した人が居なかったのか、押したが断られたのかが読めなくなる。
   */
  it("まだログインしていない身元でも、記録そのものは残る", () => {
    const refused = NOT_SIGNED_IN.filter((c) => !anEntryBy(c.actor).ok).map((c) => c.what);
    expect(
      refused,
      `確かめていない身元の操作が、記録ごと消えています:\n${refused.join("\n")}\n` +
        "断ると「誰も押していない」と「押したが記録を断った」が同じ「行が無い」になります。" +
        "残したうえで、確かめていないことは identified の印で示してください。",
    ).toEqual([]);
  });

  it("まだログインしていない人の承認は、人の承認として数えられない", () => {
    const counted: string[] = [];
    for (const c of NOT_SIGNED_IN) {
      const built = anEntryBy(c.actor);
      if (!built.ok) continue; // 記録が残らないこと自体は上の検査が赤くする
      const entries: readonly AuditLogEntry[] = [built.value];
      if (wasApprovedByHuman(entries, "c_1")) counted.push(c.what);
    }
    expect(
      counted,
      `人が承認したことになっています:\n${counted.join("\n")}\n` +
        "wasApprovedByHuman は公開前の最終確認と規制対応の説明に使います。" +
        "ここが true を返すと、誰も見ていない記事が「人が確認した」として公開へ進みます。",
    ).toEqual([]);
  });

  it("ログインしている人の承認は、いままでどおり人の承認として数えられる", () => {
    const built = anEntryBy(anOwner());
    expect(built.ok, "ログイン済みの人の記録まで作れなくなっています。").toBe(true);
    if (!built.ok) return;
    expect(
      wasApprovedByHuman([built.value], "c_1"),
      "ログイン済みの人の承認が、人の承認として数えられていません。断りすぎです。",
    ).toBe(true);
  });
});
