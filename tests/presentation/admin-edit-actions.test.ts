/**
 * @tier 1
 * @req REQ-UX02
 * @types equivalence, decision-table
 *
 * 管理画面の「直す」を押したときに動くもの（ブログの設計図・送信前の配信）。
 *
 * --- なぜユースケースを差し替えるのか ---
 * ここで見たいのは**画面から届いた形をユースケースの入力へ直す部分**である。
 * 見本の保管庫は保存を断るので、本物を通すと全部が同じ断りに落ち、
 * 「空欄を触らないこと」「入り切りの欄だけは空欄を外したいと読むこと」といった
 * 直し方の分かれ目が緑のまま何も確かめなくなる。
 * 断る判断そのものは `tests/application/edit-sites.test.ts` が本物で見ている。
 *
 * --- ここで守りたいこと ---
 * 1. **ログインしていない人には、黙って何も起きないのではなく理由が返る。**
 * 2. **画面に無い名前の軸は通さない。** 通すと、読む人のいない項目が設計図に残る。
 * 3. **入り切りの欄だけは、空欄を「触らない」と読まない。** 外れた箱は送られて
 *    こないので、空欄と区別が付かない。画面はいまの値を入れて開く。
 * 4. **何も変わらなかったことを、直したと言わない。**
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type DomainError, type Result, domainError, err, ok } from "@/domain/shared";
import { SAMPLE_ACTOR } from "@/infrastructure/identity/sample-actor";

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
}));

let loggedIn = true;
const seen: Record<string, unknown> = {};
let siteUpdate: Result<unknown, DomainError>;
let publicationUpdate: Result<unknown, DomainError>;

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
    siteEditingUseCases: async () => ({
      update: recording("site.update", () => siteUpdate),
    }),
    distributionUseCases: async () => ({
      update: recording("publication.update", () => publicationUpdate),
    }),
  };
});

const { updateManagedSiteAction } = await import("@/presentation/admin/publish/site-form-action");
const { updatePublicationAction } = await import("@/presentation/admin/publish/publication-form-action");

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

const IDLE_SITE = { status: "idle", message: "" } as const;
const IDLE_PUB = { status: "idle", message: "" } as const;
const REFUSED = err(domainError("VALIDATION_FAILED", "受け取れません。", { field: "name" }));

beforeEach(() => {
  loggedIn = true;
  for (const key of Object.keys(seen)) delete seen[key];
  siteUpdate = ok({ siteSlug: "video-editing-gear", changedLabels: ["ブログ名"], blueprint: {} });
  publicationUpdate = ok({
    card: {
      publicationId: "pub_1",
      channelLabel: "X（旧 Twitter）",
      stateLabel: "予定",
    },
    manualExportNotice: null,
  });
});

describe("ブログの設計図を直す操作", () => {
  it("ログインしていなければ、理由を添えて断る", async () => {
    loggedIn = false;
    const state = await updateManagedSiteAction(IDLE_SITE, form({ siteSlug: "s1" }));
    expect(state.status).toBe("failed");
    expect(state.message.trim()).not.toBe("");
  });

  it("空欄の項目は渡さない（触らない）", async () => {
    await updateManagedSiteAction(
      IDLE_SITE,
      form({ siteSlug: "s1", name: "  ", purpose: "新しい狙い" }),
    );
    const input = seen["site.update"] as Record<string, unknown>;
    expect(input.name).toBeUndefined();
    expect(input.purpose).toBe("新しい狙い");
    expect(input.genre).toBeUndefined();
  });

  it("軸が 1 つも入っていなければ、差別化そのものを渡さない", async () => {
    await updateManagedSiteAction(IDLE_SITE, form({ siteSlug: "s1", "axis.targetReader": "   " }));
    expect((seen["site.update"] as Record<string, unknown>).differentiation).toBeUndefined();
  });

  it("入っている軸だけを渡し、画面に無い名前の軸は通さない", async () => {
    await updateManagedSiteAction(
      IDLE_SITE,
      form({
        siteSlug: "s1",
        "axis.targetReader": "動画編集を始めて 1 年の人",
        "axis.ctaStrategy": "在庫と価格が確認できる販売ページのみ",
        // 画面に無い名前。通すと読む人のいない項目が設計図に残る。
        "axis.secretBackdoor": "通ってはいけない",
      }),
    );
    const input = seen["site.update"] as { differentiation: Record<string, string> };
    expect(Object.keys(input.differentiation).sort()).toEqual(["ctaStrategy", "targetReader"]);
  });

  it("入り切りの欄は、外れていれば「外したい」と読む", async () => {
    await updateManagedSiteAction(IDLE_SITE, form({ siteSlug: "s1" }));
    expect((seen["site.update"] as Record<string, unknown>).emitLlmsTxt).toBe(false);

    await updateManagedSiteAction(IDLE_SITE, form({ siteSlug: "s1", emitLlmsTxt: "on" }));
    expect((seen["site.update"] as Record<string, unknown>).emitLlmsTxt).toBe(true);
  });

  it("業務側が断れば、その理由と欄をそのまま画面へ返す", async () => {
    siteUpdate = REFUSED;
    const state = await updateManagedSiteAction(IDLE_SITE, form({ siteSlug: "s1" }));
    expect(state.status).toBe("failed");
    expect(state.field).toBe("name");
  });

  it("通れば、直した項目の名前と、見に行く先を返す", async () => {
    const state = await updateManagedSiteAction(IDLE_SITE, form({ siteSlug: "s1", name: "新" }));
    expect(state.status).toBe("done");
    expect(state.message).toContain("ブログ名");
    expect(state.sitePath).toBe("/admin/sites/video-editing-gear");
    expect(state.changedLabels).toEqual(["ブログ名"]);
  });

  it("何も変わらなかったときは、直したと言わない", async () => {
    siteUpdate = ok({ siteSlug: "video-editing-gear", changedLabels: [], blueprint: {} });
    const state = await updateManagedSiteAction(IDLE_SITE, form({ siteSlug: "s1" }));
    expect(state.status).toBe("done");
    // 「直しました」とだけ出ると、直っていないのに直したと思い込む。
    expect(state.message).toContain("同じでした");
  });
});

describe("送信前の配信を直す操作", () => {
  it("ログインしていなければ、理由を添えて断る", async () => {
    loggedIn = false;
    const state = await updatePublicationAction(IDLE_PUB, form({ publicationId: "pub_1" }));
    expect(state.status).toBe("failed");
    expect(state.message.trim()).not.toBe("");
  });

  it("直せるのは出し先と時刻の 2 つで、記事は渡さない", async () => {
    await updatePublicationAction(
      IDLE_PUB,
      form({
        publicationId: "pub_1",
        channelKind: "x",
        scheduledAt: "2026-09-01T10:00",
        // 記事を差し替えられると、承認したものと違う文章が承認済みの配信で外へ出る。
        contentVariantId: "cv_evil",
      }),
    );
    const input = seen["publication.update"] as Record<string, unknown>;
    expect(input).toEqual({
      publicationId: "pub_1",
      channelKind: "x",
      scheduledAt: "2026-09-01T10:00",
    });
  });

  it("時刻の空欄は「触らない」ではなく、空のまま業務側へ渡す", async () => {
    await updatePublicationAction(IDLE_PUB, form({ publicationId: "pub_1", channelKind: "x" }));
    // 予約を外して即時にする、の合図。ここを undefined にすると外せなくなる。
    expect((seen["publication.update"] as Record<string, unknown>).scheduledAt).toBe("");
  });

  it("業務側が断れば、その理由と欄をそのまま画面へ返す", async () => {
    publicationUpdate = err(
      domainError("CONFLICT", "もう出し始めています。", { field: "scheduledAt" }),
    );
    const state = await updatePublicationAction(IDLE_PUB, form({ publicationId: "pub_1" }));
    expect(state.status).toBe("failed");
    expect(state.field).toBe("scheduledAt");
  });

  it("通れば、出し先と今の状態を添えて返す", async () => {
    const state = await updatePublicationAction(IDLE_PUB, form({ publicationId: "pub_1" }));
    expect(state.status).toBe("done");
    expect(state.message).toContain("X（旧 Twitter）");
    expect(state.message).toContain("予定");
    expect(state.publicationPath).toBe("/admin/distribution/pub_1");
  });

  it("手で出す必要があるときは、その知らせを落とさずに返す", async () => {
    publicationUpdate = ok({
      card: { publicationId: "pub_1", channelLabel: "Facebook", stateLabel: "予定" },
      manualExportNotice: "この出し先は手で貼り付けてください。",
    });
    const state = await updatePublicationAction(IDLE_PUB, form({ publicationId: "pub_1" }));
    // 落とすと、出したつもりで何も出ていない状態になる。
    expect(state.manualExportNotice).toContain("手で貼り付け");
  });
});
