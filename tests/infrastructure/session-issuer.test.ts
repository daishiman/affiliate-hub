/**
 * @tier 1
 * @types equivalence, secrets, fault-injection
 * @req REQ-S10
 *
 * 通行証（`ah_session`）を**出す側**の確認。
 *
 * 確かめる側（[[session-repository]]）とは別のファイルにしてある。
 * ログインの仕組みを替えたときに書き直すのはこちらだけで、
 * 確かめる側は 1 行も変わらない、という分け方そのものが確認対象でもある。
 */
import { describe, expect, it } from "vitest";
import {
  APP_SESSION_TTL_MS,
  createD1SessionIssuer,
  generateSessionToken,
} from "@/infrastructure/identity/session-issuer";
import { hashSessionToken } from "@/infrastructure/identity/session-repository";
import type { DrizzleD1 } from "@/infrastructure/persistence/d1/link-inbox-repository";

const NOW = new Date("2026-08-18T00:00:00.000Z");

type Row = Record<string, unknown>;

/**
 * 偽の保存先。
 *
 * `select` は呼ばれた順に `results` を返す。
 * 1 回目は「`user_id` で引く」、2 回目は「招待のアドレスで引く」に対応する。
 */
function fakeDb(results: readonly Row[][]) {
  const inserted: Row[] = [];
  const updated: Row[] = [];
  let call = 0;

  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(results[call++] ?? []),
        }),
      }),
    }),
    insert: () => ({
      values: (v: Row) => {
        inserted.push(v);
        return Promise.resolve();
      },
    }),
    update: () => ({
      set: (v: Row) => ({
        where: () => {
          updated.push(v);
          return Promise.resolve();
        },
      }),
    }),
  } as unknown as DrizzleD1;

  return { db, inserted, updated };
}

describe("通行証を出す", () => {
  it("担当者の登録が無ければ、通行証を作らない", async () => {
    // 1 回目（user_id で引く）も 2 回目（招待のアドレスで引く）も空。
    const { db, inserted } = fakeDb([[], []]);
    const outcome = await createD1SessionIssuer(db).issue("u_1", "who@example.com", NOW);

    expect(outcome.kind).toBe("not_member");
    // ここで行を作ってしまうと、入れないはずの人が入れた状態で立つ。
    expect(inserted).toHaveLength(0);
  });

  it("既に担当者なら、その作業場所の通行証を出す", async () => {
    const { db, inserted, updated } = fakeDb([[{ workspaceId: "ws_1" }]]);
    const outcome = await createD1SessionIssuer(db).issue("u_1", "in@example.com", NOW);

    expect(outcome.kind).toBe("issued");
    expect(inserted).toHaveLength(1);
    expect(inserted[0]?.workspaceId).toBe("ws_1");
    expect(inserted[0]?.userId).toBe("u_1");
    // 2 回目以降は招待を受け取り直さない。
    expect(updated).toHaveLength(0);
  });

  it("初めての人は、アドレス宛の招待を受け取ってから入る", async () => {
    // 1 回目（user_id）は空。2 回目（招待のアドレス）に未受け取りの行がある。
    const { db, inserted, updated } = fakeDb([[], [{ id: "m_1", workspaceId: "ws_1" }]]);
    const outcome = await createD1SessionIssuer(db).issue("u_1", "Invited@Example.com ", NOW);

    expect(outcome.kind).toBe("issued");
    // 招待の行に user_id が埋まる。ここを飛ばすと、毎回「初めての人」になる。
    expect(updated).toHaveLength(1);
    expect(updated[0]?.userId).toBe("u_1");
    expect(updated[0]?.acceptedAt).toEqual(NOW);
    expect(inserted[0]?.workspaceId).toBe("ws_1");
  });

  it("合言葉そのものは保存しない。保存するのは潰した値だけ", async () => {
    const { db, inserted } = fakeDb([[{ workspaceId: "ws_1" }]]);
    const outcome = await createD1SessionIssuer(db).issue("u_1", "in@example.com", NOW);
    if (outcome.kind !== "issued") throw new Error("通行証が出ませんでした");

    const saved = JSON.stringify(inserted[0]);
    expect(saved).not.toContain(outcome.session.token);
    expect(inserted[0]?.tokenHash).toBe(await hashSessionToken(outcome.session.token));
  });

  it("期限は発行した時刻から数える", async () => {
    const { db } = fakeDb([[{ workspaceId: "ws_1" }]]);
    const outcome = await createD1SessionIssuer(db).issue("u_1", "in@example.com", NOW);
    if (outcome.kind !== "issued") throw new Error("通行証が出ませんでした");

    expect(outcome.session.expiresAt.getTime()).toBe(NOW.getTime() + APP_SESSION_TTL_MS);
  });

  it("保存先が落ちたときは「担当ではない」に化けさせない", async () => {
    const broken = {
      select: () => ({
        from: () => ({
          where: () => ({ limit: () => Promise.reject(new Error("D1_ERROR")) }),
        }),
      }),
    } as unknown as DrizzleD1;

    const outcome = await createD1SessionIssuer(broken).issue("u_1", "in@example.com", NOW);
    // ここを not_member にすると、保存先が落ちている間に入った人が
    // 「担当を外された人」として記録され、原因の切り分けができなくなる。
    expect(outcome.kind).toBe("failed");
    expect(JSON.stringify(outcome)).not.toContain("D1_ERROR");
  });
});

describe("合言葉の作り方", () => {
  it("毎回違う値になり、長さが足りている", () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    expect(a).not.toBe(b);
    // 32 バイトを 16 進で書いた長さ。短くすると総当たりが現実的になる。
    expect(a).toHaveLength(64);
    expect(a).toMatch(/^[0-9a-f]+$/);
  });
});
