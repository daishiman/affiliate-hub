import { describe, expect, it } from "vitest";
import {
  type ManageDistributionDeps,
  createSchedulePublicationUseCase,
} from "@/application/usecases/distribution/manage-distribution";
import type { ContentVariant } from "@/domain/authoring";
import type { Publication } from "@/domain/distribution";
import { markEditorial, ok } from "@/domain/shared";
import { OTHER_WORKSPACE, WORKSPACE, aNobody, anOwner } from "../support/actors";
import { aChannelConnection, aPublication } from "../support/factories";
import { NOW, daysFrom } from "../support/clock";
import { failing, testDeps } from "../support/doubles";
import { SAMPLE_WORKSPACE_ID } from "@/infrastructure/persistence/sample/ranking-sample-repository";

/**
 * 「この記事を、ここへ出す」を開始する入口。
 *
 * --- ここで守りたいこと ---
 *
 * この入口が無かったため、承認まで進めた記事を配信へ渡す道が存在しなかった
 * （残課題 26。1 周の結合テストで発覚し、テストは domain を直接呼んで代用していた）。
 *
 * いちばん危ないのは **黙って進めてしまうこと**の 2 つ。
 *   1. 承認前の記事が出てしまう
 *   2. 意図しないアカウントへ出てしまう
 * どちらも「出た」という事実が消せないので、迷ったら断って聞き返す。
 *
 * 次に危ないのが **同じ投稿が 2 つ出ること**。二重クリック・再送・AI の再試行で
 * 起きる。作る時点で 1 件にまとめる。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §2 / 残課題 26
 */

const owner = anOwner();

/** 見本の記事を 1 件借りてくる。中身ではなく「承認済みかどうか」だけを使う。 */
async function sampleVariant(): Promise<ContentVariant> {
  const listed = await testDeps().contentVariants.listByState(
    SAMPLE_WORKSPACE_ID,
    "GENERATED",
    { limit: 1, cursor: null },
  );
  if (!listed.ok) throw listed.error;
  const first = listed.value.items[0];
  if (first === undefined) throw new Error("見本の記事が 1 件も読めません");
  return first;
}

type Over = {
  variant?: ContentVariant | null;
  connections?: readonly unknown[];
  existing?: Publication | null;
  saveFails?: boolean;
  findByKeyFails?: boolean;
  /** 保存された配信をここへ溜める。件数を見る検査で使う。 */
  saved?: Publication[];
};

function deps(over: Over = {}): ManageDistributionDeps {
  const base = testDeps();
  const saved = over.saved ?? [];
  return {
    connections: {
      ...base.channelConnections,
      listByWorkspace: async () => ok({ items: over.connections ?? [], nextCursor: null }),
    } as ManageDistributionDeps["connections"],
    publications: {
      ...base.publications,
      findByIdempotencyKey: async () =>
        over.findByKeyFails === true
          ? failing("保存先に繋がりません。")
          : ok(over.existing ?? null),
      save: async (p: Publication) => {
        if (over.saveFails === true) return failing("保存先に繋がりません。");
        saved.push(p);
        return ok(p);
      },
    } as ManageDistributionDeps["publications"],
    manualExport: base.manualExport,
    variants: markEditorial({
      ...base.contentVariants,
      findById: async () => ok(over.variant === undefined ? null : over.variant),
    }) as ManageDistributionDeps["variants"],
    ids: base.ids,
  };
}

/** 承認済みの記事を返す組み立て。 */
async function approved(): Promise<ContentVariant> {
  return { ...(await sampleVariant()), status: "approved", workspaceId: WORKSPACE };
}

describe("配信を作る", () => {
  it("承認済みの記事を出し先へ渡すと、順番待ちの配信ができる", async () => {
    const got = await createSchedulePublicationUseCase(
      deps({
        variant: await approved(),
        connections: [aChannelConnection({ kind: "x", workspaceId: WORKSPACE })],
      }),
    ).execute(owner, { variantId: "cv_alpha_review", channelKind: "x" });
    if (!got.ok) throw got.error;

    expect(got.value.card.stateLabel).toBe("順番待ち");
    expect(got.value.alreadyExisted).toBe(false);
    // 自動で投稿できる先なので、書き出しの案内は出ない。
    expect(got.value.manualExportNotice).toBeNull();
  });

  it("承認していない記事は配信できず、次にすることが示される", async () => {
    const got = await createSchedulePublicationUseCase(
      deps({
        variant: { ...(await approved()), status: "review" },
        connections: [aChannelConnection({ kind: "x", workspaceId: WORKSPACE })],
      }),
    ).execute(owner, { variantId: "cv_alpha_review", channelKind: "x" });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.message).toContain("承認");
    expect(got.error.suggestedAction).toContain("承認");
  });

  it("同じ記事・同じ先・同じ時刻をもう一度頼んでも、配信は増えない", async () => {
    const already = aPublication({
      workspaceId: WORKSPACE,
      channelKind: "x",
      state: "QUEUED",
    });
    const saved: Publication[] = [];
    const got = await createSchedulePublicationUseCase(
      deps({
        variant: await approved(),
        connections: [aChannelConnection({ kind: "x", workspaceId: WORKSPACE })],
        existing: already,
        saved,
      }),
    ).execute(owner, { variantId: "cv_alpha_review", channelKind: "x" });
    if (!got.ok) throw got.error;

    // 失敗ではない。「同じものを 2 回作らなかった」という結果を返す。
    expect(got.value.alreadyExisted).toBe(true);
    expect(got.value.card.publicationId).toBe(String(already.id));
    // 保存を呼んでいないことまで見る。呼んで同じ鍵で弾かれる作りだと、
    // 保存先の実装が変わった日に二重投稿が復活する。
    expect(saved).toHaveLength(0);
  });

  it("出し先の接続が無いときは、設定へ案内して断る", async () => {
    const got = await createSchedulePublicationUseCase(
      deps({ variant: await approved(), connections: [] }),
    ).execute(owner, { variantId: "cv_alpha_review", channelKind: "x" });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.message).toContain("接続がまだありません");
    expect(got.error.suggestedAction).toContain("設定");
  });

  it("使える接続が 2 つあるときは、こちらで選ばずアカウント名を挙げて聞き返す", async () => {
    const got = await createSchedulePublicationUseCase(
      deps({
        variant: await approved(),
        connections: [
          aChannelConnection({ kind: "x", accountLabel: "@main", workspaceId: WORKSPACE }),
          aChannelConnection({ kind: "x", accountLabel: "@sub", workspaceId: WORKSPACE }),
        ],
      }),
    ).execute(owner, { variantId: "cv_alpha_review", channelKind: "x" });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    // どちらへ出るか分からないまま投稿しない。名前を出して選ばせる。
    expect(got.error.message).toContain("@main");
    expect(got.error.message).toContain("@sub");
  });

  it("期限切れの接続は、使える接続として数えない", async () => {
    const got = await createSchedulePublicationUseCase(
      deps({
        variant: await approved(),
        connections: [
          aChannelConnection({
            kind: "x",
            expiresAt: daysFrom(NOW, -1),
            workspaceId: WORKSPACE,
          }),
        ],
      }),
    ).execute(owner, { variantId: "cv_alpha_review", channelKind: "x" });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.message).toContain("接続がまだありません");
  });

  it("過ぎた時刻は予約できない（黙って即時に倒さない）", async () => {
    const got = await createSchedulePublicationUseCase(
      deps({
        variant: await approved(),
        connections: [aChannelConnection({ kind: "x", workspaceId: WORKSPACE })],
      }),
    ).execute(owner, {
      variantId: "cv_alpha_review",
      channelKind: "x",
      scheduledAt: "2020-01-01T00:00:00Z",
    });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.message).toContain("過ぎた時刻");
  });

  it("読み取れない日時は、指定なし（＝即時）に倒さず断る", async () => {
    const got = await createSchedulePublicationUseCase(
      deps({
        variant: await approved(),
        connections: [aChannelConnection({ kind: "x", workspaceId: WORKSPACE })],
      }),
    ).execute(owner, {
      variantId: "cv_alpha_review",
      channelKind: "x",
      scheduledAt: "きょうの夕方",
    });

    // 黙って即時に倒すと、打ち間違いがそのまま投稿になる。
    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.field).toBe("scheduledAt");
    expect(got.error.message).toContain("読み取れません");
  });

  it("自動で投稿できない先は、接続が無くても作れて、書き出しの案内が付く", async () => {
    const got = await createSchedulePublicationUseCase(
      deps({ variant: await approved(), connections: [] }),
    ).execute(owner, { variantId: "cv_alpha_review", channelKind: "note" });
    if (!got.ok) throw got.error;

    expect(got.value.card.stateLabel).toBe("順番待ち");
    expect(got.value.manualExportNotice).toContain("ご自身で投稿");
  });

  it("配信を始める権限が無い人は作れない", async () => {
    const got = await createSchedulePublicationUseCase(
      deps({ variant: await approved() }),
    ).execute(aNobody(), { variantId: "cv_alpha_review", channelKind: "x" });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("FORBIDDEN");
  });

  it("別の作業場所の記事は出せない", async () => {
    const got = await createSchedulePublicationUseCase(
      deps({
        variant: { ...(await approved()), workspaceId: OTHER_WORKSPACE },
        connections: [aChannelConnection({ kind: "x", workspaceId: WORKSPACE })],
      }),
    ).execute(owner, { variantId: "cv_alpha_review", channelKind: "x" });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("TENANT_MISMATCH");
  });

  it("記事が見つからないときは、作らずに理由を返す", async () => {
    const got = await createSchedulePublicationUseCase(deps({ variant: null })).execute(owner, {
      variantId: "cv_missing",
      channelKind: "x",
    });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("NOT_FOUND");
  });

  it("保存に失敗したら、できたふりをしない", async () => {
    const got = await createSchedulePublicationUseCase(
      deps({
        variant: await approved(),
        connections: [aChannelConnection({ kind: "x", workspaceId: WORKSPACE })],
        saveFails: true,
      }),
    ).execute(owner, { variantId: "cv_alpha_review", channelKind: "x" });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("NOT_IMPLEMENTED");
  });

  it("同じ要求があるかを確かめられないときは、作らずに止まる", async () => {
    const got = await createSchedulePublicationUseCase(
      deps({
        variant: await approved(),
        connections: [aChannelConnection({ kind: "x", workspaceId: WORKSPACE })],
        findByKeyFails: true,
      }),
    ).execute(owner, { variantId: "cv_alpha_review", channelKind: "x" });

    // 確かめずに作ると、二重投稿を防ぐ仕組みが黙って外れる。
    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("NOT_IMPLEMENTED");
  });
});
