/**
 * @tier 1
 * @req REQ-UX02, REQ-BOPS07, REQ-BOPS12
 * @types equivalence, decision-table
 *
 * タグの口（`manageBlogTagAction`）と担当者の口（`manageMemberAction`）。
 *
 * --- なぜこの 2 つを 1 つのファイルで見るのか ---
 *
 * どちらも**1 つの関数で 2〜3 の操作を引き受ける口**である。画面が同じ欄の並びを
 * 使い回すためにそうなっていて、そのぶん「どの操作へ振り分けたか」を間違えても
 * 動きはする。振り分けの分かれ目は、押した先でしか通らない。
 *
 * 実測（2026-08-27）では、両方とも分岐 0.0%。**書いた日から一度も
 * 振り分けが確かめられていない。**保存の成否は
 * `tests/application/blog-ops-usecases.test.ts` が本物で見ているので、
 * ここでは**画面から届いた形をユースケースの入力へ直す部分**だけを見る。
 *
 * --- 見ている分かれ目 ---
 *
 * 1. ログインしていない人には、黙って何も起きないのではなく理由が返る。
 * 2. 保存先が無いとき、見本へ落ちずに断る（`REQ-BOPS12`）。
 * 3. 知らない `intent` を、別の mutation へ寄せない。
 * 4. 知らない役割は落とす（型の上でだけ正しい別物を権限の表へ入れない）。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type DomainError, type Result, domainError, err, ok } from "@/domain/shared";
import { SAMPLE_ACTOR } from "@/infrastructure/identity/sample-actor";

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
}));

/** ログインできているか。誰であるかとは別の軸。 */
let loggedIn = true;
/** 保存先が用意できているか。自動テストに D1 は無いので、ここで作る。 */
let storageReady = true;

/** 差し替えたユースケースが受け取った入力。届いた形の直し方を、ここで読む。 */
const seen: Record<string, unknown> = {};

let saveTag: Result<unknown, DomainError>;
let deleteTag: Result<unknown, DomainError>;
let manageMembers: Result<unknown, DomainError>;

function recording(name: string, read: () => Result<unknown, DomainError>) {
  return {
    execute: async (_actor: unknown, input: unknown) => {
      seen[name] = input;
      return read();
    },
  };
}

vi.mock("@/presentation/composition", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    signedInActor: async () => (loggedIn ? SAMPLE_ACTOR : null),
    blogOpsEntry: async () =>
      storageReady
        ? {
            ready: true,
            saveTag: recording("tag.save", () => saveTag),
            deleteTag: recording("tag.delete", () => deleteTag),
          }
        : { ready: false, reason: "保存先 (D1) が用意されていません。" },
    settingsUseCases: async () => ({
      manageMembers: recording("member", () => manageMembers),
    }),
  };
});

const { manageBlogTagAction } = await import("@/presentation/admin/blog-tag-action");
const { manageMemberAction } = await import("@/presentation/admin/member-action");

const IDLE = { status: "idle", message: "" } as const;

function form(entries: Record<string, string | readonly string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    if (typeof value === "string") data.append(key, value);
    else for (const one of value) data.append(key, one);
  }
  return data;
}

beforeEach(() => {
  loggedIn = true;
  storageReady = true;
  for (const key of Object.keys(seen)) delete seen[key];
  saveTag = ok({ tagId: "btg_1", name: "保存したタグ" });
  deleteTag = ok({ name: "消したタグ" });
  manageMembers = ok({ message: "招きました。" });
});

describe("タグの口", () => {
  it("ログインしていない人には理由が返る", async () => {
    loggedIn = false;
    const state = await manageBlogTagAction(IDLE, form({ intent: "save" }));

    expect(state.status).toBe("failed");
    expect(state.message).toContain("タグの編集");
    // 断ったのだから、ユースケースまで届いていない。
    expect(seen["tag.save"]).toBeUndefined();
  });

  it("保存先が無いとき、見本へ落ちずに断る", async () => {
    storageReady = false;
    const state = await manageBlogTagAction(IDLE, form({ intent: "save" }));

    expect(state.status).toBe("failed");
    expect(state.message).toContain("保存先");
    expect(seen["tag.save"]).toBeUndefined();
  });

  it("知らない操作の指定は、保存にも削除にも寄せない", async () => {
    const state = await manageBlogTagAction(IDLE, form({ intent: "ぜんぶ消す" }));

    expect(state).toMatchObject({ status: "failed", field: "intent" });
    expect(seen["tag.save"]).toBeUndefined();
    expect(seen["tag.delete"]).toBeUndefined();
  });

  it("知らないタグの種類は、既定へ寄せずに断る", async () => {
    const state = await manageBlogTagAction(
      IDLE,
      form({ intent: "save", siteSlug: "owned-blog", kind: "なんとなく" }),
    );

    expect(state).toMatchObject({ status: "failed", field: "kind" });
    expect(seen["tag.save"]).toBeUndefined();
  });

  it("tagId が空なら、同一性の鍵を渡さずに新しく作る", async () => {
    const state = await manageBlogTagAction(
      IDLE,
      form({
        intent: "save",
        siteSlug: "owned-blog",
        tagId: "",
        slug: " new-tag ",
        name: " 新しいタグ ",
        description: "説明",
        kind: "topic",
      }),
    );

    // 空文字の tagId を渡すと、保管庫は「その id の行を直す」と読む。
    expect(seen["tag.save"]).not.toHaveProperty("tagId");
    // 前後の空白は落とす。打ち間違えた空白で別のタグができない。
    expect(seen["tag.save"]).toMatchObject({ slug: "new-tag", name: "新しいタグ" });
    expect(state).toMatchObject({ status: "done", message: "タグを足しました。" });
  });

  it("tagId が入っていれば、直したと伝える", async () => {
    const state = await manageBlogTagAction(
      IDLE,
      form({
        intent: "save",
        siteSlug: "owned-blog",
        tagId: "btg_1",
        slug: "tag",
        name: "タグ",
        description: "",
        kind: "brand",
      }),
    );

    expect(seen["tag.save"]).toMatchObject({ tagId: "btg_1", kind: "brand" });
    expect(state).toMatchObject({ status: "done", message: "タグを直しました。" });
  });

  it("保存を断られたら、原因の欄ごと返す", async () => {
    saveTag = err(domainError("VALIDATION_FAILED", "slug が重複しています。", { field: "slug" }));
    const state = await manageBlogTagAction(
      IDLE,
      form({ intent: "save", siteSlug: "owned-blog", kind: "topic" }),
    );

    expect(state).toMatchObject({ status: "failed", field: "slug" });
  });

  it("消したときは、記事が消えないことも一緒に伝える", async () => {
    const state = await manageBlogTagAction(
      IDLE,
      form({ intent: "delete", siteSlug: "owned-blog", tagId: "btg_1", reason: "使わない" }),
    );

    expect(seen["tag.delete"]).toMatchObject({ tagId: "btg_1", reason: "使わない" });
    expect(state.status).toBe("done");
    expect(state.message).toContain("消したタグ");
    expect(state.message).toContain("タグ無しになります");
  });

  it("削除を断られたら、失敗として返す", async () => {
    deleteTag = err(domainError("FORBIDDEN", "権限がありません。"));
    const state = await manageBlogTagAction(
      IDLE,
      form({ intent: "delete", siteSlug: "owned-blog", tagId: "btg_1" }),
    );

    expect(state.status).toBe("failed");
  });
});

describe("担当者の口", () => {
  it("ログインしていない人は、担当者を招けない", async () => {
    loggedIn = false;
    const state = await manageMemberAction(IDLE, form({ intent: "invite" }));

    expect(state.status).toBe("failed");
    expect(state.message).toContain("担当者の招待");
    expect(seen.member).toBeUndefined();
  });

  it("招くとき、知らない役割は落とす", async () => {
    const state = await manageMemberAction(
      IDLE,
      form({
        intent: "invite",
        invitedEmail: "someone@example.com",
        displayName: "だれか",
        roles: ["writer", "架空の役割", "analyst"],
      }),
    );

    // 表に無い役割は `capabilitiesOf` が何も返さない。
    // 通すと「役割は付いているのに何もできない担当者」が静かに増える。
    expect(seen.member).toMatchObject({
      action: "invite",
      invitedEmail: "someone@example.com",
      roles: ["writer", "analyst"],
    });
    expect(state).toMatchObject({ status: "done", message: "招きました。" });
  });

  it("役割を変えるときは、名簿の行と理由を渡す", async () => {
    await manageMemberAction(
      IDLE,
      form({
        intent: "change_roles",
        membershipId: "mem_1",
        roles: ["reviewer"],
        reason: "担当替え",
      }),
    );

    expect(seen.member).toMatchObject({
      action: "change_roles",
      membershipId: "mem_1",
      roles: ["reviewer"],
      reason: "担当替え",
    });
  });

  it("取り消しは、役割を持ち込まない", async () => {
    await manageMemberAction(
      IDLE,
      form({ intent: "revoke", membershipId: "mem_1", roles: ["writer"], reason: "退職" }),
    );

    // 取り消しに役割を渡すと、ユースケース側が「変更」と読み違える余地が残る。
    expect(seen.member).toEqual({
      action: "revoke",
      membershipId: "mem_1",
      reason: "退職",
    });
  });

  it("断られたら、原因の欄ごと返す", async () => {
    manageMembers = err(
      domainError("VALIDATION_FAILED", "その宛先は招けません。", { field: "invitedEmail" }),
    );
    const state = await manageMemberAction(
      IDLE,
      form({ intent: "invite", invitedEmail: "x", displayName: "", roles: ["writer"] }),
    );

    expect(state).toMatchObject({ status: "failed", field: "invitedEmail" });
  });
});
