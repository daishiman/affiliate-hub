import { describe, expect, it } from "vitest";
import {
  PUBLICATION_STATE_LABEL,
  PUBLISH_MODE_LABEL,
  type ManageDistributionDeps,
  createCancelPublicationUseCase,
  createExportManualDraftUseCase,
  createGetPublicationUseCase,
  createListChannelsUseCase,
  createListPublicationsUseCase,
} from "@/application/usecases/distribution/manage-distribution";
import { CHANNEL_CAPABILITIES, type Publication } from "@/domain/distribution";
import { ok } from "@/domain/shared";
import { OTHER_WORKSPACE, aNobody, anOutsider, anOwner, aWriter } from "../support/actors";
import { aChannelConnection, aPublication } from "../support/factories";
import { NOW, daysFrom } from "../support/clock";
import { failing, testDeps } from "../support/doubles";
import { SAMPLE_WORKSPACE_ID } from "@/infrastructure/persistence/sample/ranking-sample-repository";

/**
 * 配信（どこへ出すか）。
 *
 * --- ここで固定したいこと ---
 * この一群でいちばん守りたいのは **「出せない先を、出せるように見せない」**。
 * note には公開された投稿の仕組みが無いので、
 * 「note へ直接公開」という選択肢が画面にも AI にも出てはいけない。
 * ここが緩むと、押しても何も起きないボタンを出すことになり、
 * さらに悪いことに、非公式な投稿方法を足したくなる圧力が生まれる。
 *
 * もうひとつは **出した選択肢が必ず押せる**こと。
 * 進める先を画面側で書き写すと、遷移の決まりを直したとき片方だけ古くなる。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §2 / 仕様書 §17
 */

const owner = anOwner();

function deps(over: Partial<ManageDistributionDeps> = {}): ManageDistributionDeps {
  const base = testDeps();
  return {
    connections: base.channelConnections,
    publications: base.publications,
    manualExport: base.manualExport,
    variants: base.contentVariants,
    ...over,
  };
}

/** 接続の一覧だけを差し替える。 */
function withConnections(items: readonly unknown[]): Partial<ManageDistributionDeps> {
  return {
    connections: {
      ...testDeps().channelConnections,
      listByWorkspace: async () => ok({ items, nextCursor: null }),
    } as ManageDistributionDeps["connections"],
  };
}

/** 配信 1 件を、指定した中身で返すようにする。 */
function withPublication(
  publication: Publication | null,
  over: Record<string, unknown> = {},
): Partial<ManageDistributionDeps> {
  return {
    publications: {
      ...testDeps().publications,
      findById: async () => ok(publication),
      save: async (p: Publication) => ok(p),
      ...over,
    } as ManageDistributionDeps["publications"],
  };
}

async function channels(actor = owner, over: Partial<ManageDistributionDeps> = {}) {
  const got = await createListChannelsUseCase(deps(over)).execute(actor, {});
  if (!got.ok) throw got.error;
  return got.value;
}

describe("出し先の一覧", () => {
  it("仕組みが用意されている出し先を、1 つ残らず出す", async () => {
    const view = await channels();
    expect(view.channels.map((c) => c.kind).sort()).toEqual(
      Object.keys(CHANNEL_CAPABILITIES).sort(),
    );
  });

  it("識別子ではなく、人が読める名前で出す", async () => {
    for (const c of await channels().then((v) => v.channels)) {
      // note だけは、サービス名そのものが「note」なので識別子と同じ綴りになる。
      if (c.kind !== "note") {
        expect(c.label, `${c.kind} の名前が識別子のままです`).not.toBe(c.kind);
      }
      expect(c.label.length).toBeGreaterThan(0);
      expect(Object.values(PUBLISH_MODE_LABEL)).toContain(c.publishModeLabel);
      expect(c.disclosurePlacementLabel).not.toMatch(/^[a-z_]+$/);
      // 何を根拠にこの制限を書いているのかが無いと、直すときに確かめられない。
      expect(c.basisNote.length).toBeGreaterThan(0);
    }
  });

  it("note は自動投稿できる先として出さない", async () => {
    const view = await channels();
    const note = view.channels.find((c) => c.kind === "note");
    expect(note?.canDirectPublish).toBe(false);
    expect(note?.publishModeLabel).toBe(PUBLISH_MODE_LABEL.manual_export);
    // 接続の有無にかかわらず、理由は「仕組みが無い」であって「未接続」ではない。
    expect(note?.blockedReason).toContain("公開された投稿の仕組みがありません");
    expect(note?.blockedReason).not.toContain("接続がまだありません");
  });

  it("接続が無い先は、出せない理由が「未接続」になる", async () => {
    const view = await channels(owner, withConnections([]));
    const x = view.channels.find((c) => c.kind === "x");
    expect(x?.blockedReason).toContain("接続がまだありません");
    expect(view.connectedCount).toBe(0);
  });

  it("使える接続があれば、出せない理由が消える", async () => {
    const view = await channels(
      owner,
      withConnections([aChannelConnection({ kind: "x", accountLabel: "@shop" })]),
    );
    const x = view.channels.find((c) => c.kind === "x");
    expect(x?.blockedReason).toBeNull();
    expect(x?.connectedAccounts).toEqual(["@shop"]);
    expect(view.connectedCount).toBe(1);
  });

  it("期限切れの接続は、使える接続として数えない", async () => {
    const view = await channels(
      owner,
      withConnections([
        aChannelConnection({ kind: "x", accountLabel: "@old", expiresAt: daysFrom(NOW, -1) }),
      ]),
    );
    const x = view.channels.find((c) => c.kind === "x");
    expect(x?.connectedAccounts).toEqual([]);
    expect(x?.unusableReasons.join()).toContain("期限が切れています");
    // つなぎ直せば直る、という道筋まで書く。
    expect(x?.unusableReasons.join()).toContain("つなぎ直して");
    expect(x?.blockedReason).toContain("接続がまだありません");
  });

  it("取り消された接続は、期限切れと違う理由で出す", async () => {
    const view = await channels(
      owner,
      withConnections([
        aChannelConnection({ kind: "x", accountLabel: "@gone", revokedAt: daysFrom(NOW, -1) }),
      ]),
    );
    const x = view.channels.find((c) => c.kind === "x");
    expect(x?.unusableReasons.join()).toContain("取り消されています");
    expect(x?.unusableReasons.join()).not.toContain("期限");
  });

  it("使える接続と使えない接続が混ざっていても、使える方だけを出す", async () => {
    const view = await channels(
      owner,
      withConnections([
        aChannelConnection({ kind: "x", accountLabel: "@live" }),
        aChannelConnection({ kind: "x", accountLabel: "@dead", revokedAt: daysFrom(NOW, -1) }),
      ]),
    );
    const x = view.channels.find((c) => c.kind === "x");
    expect(x?.connectedAccounts).toEqual(["@live"]);
    expect(x?.unusableReasons).toHaveLength(1);
    expect(x?.blockedReason).toBeNull();
  });

  it("自動で出せない先の数を、別に数える", async () => {
    const view = await channels();
    const manual = view.channels.filter((c) => !c.canDirectPublish).length;
    expect(view.manualOnlyCount).toBe(manual);
    expect(view.manualOnlyCount).toBeGreaterThan(0);
  });

  it("接続の一覧が読めないときは、0 件の一覧を出さない", async () => {
    const got = await createListChannelsUseCase(
      deps({
        connections: {
          ...testDeps().channelConnections,
          listByWorkspace: async () => failing("接続の保存先が読めません。"),
        } as ManageDistributionDeps["connections"],
      }),
    ).execute(owner, {});

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.message).toContain("接続の保存先");
  });

  it("権限が無い人には出さない", async () => {
    const got = await createListChannelsUseCase(deps()).execute(aNobody(), {});
    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("FORBIDDEN");
  });
});

describe("配信の一覧", () => {
  async function list(over: Partial<ManageDistributionDeps> = {}, input = {}) {
    const got = await createListPublicationsUseCase(deps(over)).execute(owner, input);
    if (!got.ok) throw got.error;
    return got.value;
  }

  function withRecent(items: readonly Publication[]): Partial<ManageDistributionDeps> {
    return {
      publications: {
        ...testDeps().publications,
        listRecent: async () => ok(items),
      } as ManageDistributionDeps["publications"],
    };
  }

  it("手当てが要るものだけを別に並べる", async () => {
    const view = await list(
      withRecent([
        aPublication({ state: "PUBLISHED" }),
        aPublication({ state: "FAILED_SEND" }),
        aPublication({ state: "FAILED_VALIDATION" }),
        aPublication({ state: "MANUAL_EXPORT_READY" }),
        aPublication({ state: "QUEUED" }),
      ]),
    );

    expect(view.total).toBe(5);
    expect(view.needsAttention.map((p) => p.state).sort()).toEqual([
      "FAILED_SEND",
      "FAILED_VALIDATION",
      "MANUAL_EXPORT_READY",
    ]);
    // 書き出し待ちを「手当て不要」に入れない。貼るまで世に出ていない。
    expect(view.emptyReason).toBeNull();
  });

  it("状態は日本語で出し、識別子のままにしない", async () => {
    const view = await list(withRecent([aPublication({ state: "RETRY_SCHEDULED" })]));
    expect(view.items[0].stateLabel).toBe(PUBLICATION_STATE_LABEL.RETRY_SCHEDULED);
    expect(view.items[0].stateLabel).not.toBe("RETRY_SCHEDULED");
    expect(view.items[0].channelLabel).toBe(CHANNEL_CAPABILITIES.own_site.label);
  });

  it("止まった理由と再試行の回数を、そのまま持ち出す", async () => {
    const view = await list(
      withRecent([
        aPublication({ state: "FAILED_SEND", attempts: 3, lastError: "相手先が応答しません。" }),
      ]),
    );
    expect(view.items[0].attempts).toBe(3);
    expect(view.items[0].lastError).toContain("応答しません");
  });

  it("1 件も無いときは、その意味と次の一歩を書く", async () => {
    const view = await list(withRecent([]));
    expect(view.total).toBe(0);
    expect(view.emptyReason).toContain("まだ配信の記録がありません");
    expect(view.emptyReason).toContain("承認");
  });

  it("読めないときは、0 件として出さない", async () => {
    const got = await createListPublicationsUseCase(
      deps({
        publications: {
          ...testDeps().publications,
          listRecent: async () => failing("配信の記録が読めません。"),
        } as ManageDistributionDeps["publications"],
      }),
    ).execute(owner, {});

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.message).toContain("配信の記録");
  });

  it("件数の上限を渡せる（渡さないときの既定がある）", async () => {
    const seen: number[] = [];
    const port = {
      ...testDeps().publications,
      listRecent: async (_ws: unknown, limit: number) => {
        seen.push(limit);
        return ok([]);
      },
    } as ManageDistributionDeps["publications"];

    await createListPublicationsUseCase(deps({ publications: port })).execute(owner, {});
    await createListPublicationsUseCase(deps({ publications: port })).execute(owner, { limit: 5 });

    expect(seen).toEqual([50, 5]);
  });
});

describe("配信 1 件", () => {
  async function get(publication: Publication | null, actor = owner) {
    return createGetPublicationUseCase(deps(withPublication(publication))).execute(actor, {
      publicationId: "pub-0001",
    });
  }

  it("進める先として出したものは、必ず実際に進められる", async () => {
    const got = await get(aPublication({ state: "QUEUED" }));
    if (!got.ok) throw got.error;

    expect(got.value.nextStates.map((s) => s.state).sort()).toEqual(["CANCELLED", "RENDERING"]);
    for (const s of got.value.nextStates) {
      expect(s.label).toBe(PUBLICATION_STATE_LABEL[s.state]);
    }
  });

  it("公開済みからは、どこへも進めない", async () => {
    const got = await get(aPublication({ state: "PUBLISHED" }));
    if (!got.ok) throw got.error;
    expect(got.value.nextStates).toEqual([]);
  });

  it("公開前の確認が要る状態では、進める先を出さない（押せないボタンを作らない）", async () => {
    const got = await get(aPublication({ state: "VALIDATING" }));
    if (!got.ok) throw got.error;
    // 確認の結果が無いと進めるか判断できない。ここで出すと必ず失敗するボタンになる。
    expect(got.value.nextStates).toEqual([]);
  });

  it("自動投稿の仕組みが無い先は、その理由が付く", async () => {
    const got = await get(aPublication({ channelKind: "note", state: "QUEUED" }));
    if (!got.ok) throw got.error;

    expect(got.value.canDirectPublish).toBe(false);
    expect(got.value.blockedReason).toContain("公開された投稿の仕組みがありません");
    expect(got.value.publishModeLabel).toBe(PUBLISH_MODE_LABEL.manual_export);
  });

  it("自動で出せる先には、余計な理由を付けない", async () => {
    const got = await get(aPublication({ channelKind: "x", state: "QUEUED" }));
    if (!got.ok) throw got.error;
    expect(got.value.canDirectPublish).toBe(true);
    expect(got.value.blockedReason).toBeNull();
  });

  it("見つからないときは、一覧へ戻る道を出す", async () => {
    const got = await get(null);
    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("NOT_FOUND");
    expect(got.error.suggestedAction).toContain("一覧");
  });

  it("他の作業場所の配信は見せない", async () => {
    // 保存先が取り違えて返してきても、application 側で止める。
    const got = await get(aPublication({ workspaceId: OTHER_WORKSPACE }), owner);
    expect(got.ok).toBe(false);
  });

  it("よその人が自分の作業場所の配信を読もうとしても止まる", async () => {
    const got = await get(aPublication(), anOutsider());
    expect(got.ok).toBe(false);
  });

  it("読めないときは、見つからないと言い換えない", async () => {
    const got = await createGetPublicationUseCase(
      deps({
        publications: {
          ...testDeps().publications,
          findById: async () => failing("保存先が読めません。"),
        } as ManageDistributionDeps["publications"],
      }),
    ).execute(owner, { publicationId: "pub-0001" });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).not.toBe("NOT_FOUND");
  });
});

describe("取りやめ", () => {
  async function cancel(publication: Publication | null, actor = owner, over = {}) {
    return createCancelPublicationUseCase(deps(withPublication(publication, over))).execute(actor, {
      publicationId: "pub-0001",
    });
  }

  it("順番待ちのものは取りやめられる", async () => {
    const got = await cancel(aPublication({ state: "QUEUED" }));
    if (!got.ok) throw got.error;
    expect(got.value.card.state).toBe("CANCELLED");
    expect(got.value.card.stateLabel).toBe("取りやめ");
  });

  it("公開済みのものは取りやめられない（取り下げは別の操作）", async () => {
    const got = await cancel(aPublication({ state: "PUBLISHED" }));
    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("CONFLICT");
  });

  it("保存に失敗したら、取りやめたことにしない", async () => {
    const got = await cancel(aPublication({ state: "QUEUED" }), owner, {
      save: async () => failing("保存できません。"),
    });
    expect(got.ok).toBe(false);
  });

  it("公開の権限が無い人は取りやめられない", async () => {
    const got = await cancel(aPublication({ state: "QUEUED" }), aWriter());
    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("FORBIDDEN");
  });

  it("見つからないものは取りやめられない", async () => {
    const got = await cancel(null);
    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("NOT_FOUND");
  });
});

describe("手作業での書き出し", () => {
  /** 貼り付ける中身は記事側にある。書き出しの確認には本文が要る。 */
  function withVariant(variant: unknown): Partial<ManageDistributionDeps> {
    return {
      variants: {
        ...testDeps().contentVariants,
        findById: async () => ok(variant),
      } as ManageDistributionDeps["variants"],
    };
  }

  const NOTE_BODY = "この記事は、実際に 3 か月使った記録です。";
  const noteVariant = {
    title: "3 か月使った記録",
    body: NOTE_BODY,
    disclosure: "この記事には広告が含まれます。",
  };

  async function exportDraft(
    publication: Publication | null,
    actor = owner,
    over: Partial<ManageDistributionDeps> = {},
  ) {
    return createExportManualDraftUseCase(
      deps({ ...withPublication(publication), ...withVariant(noteVariant), ...over }),
    ).execute(actor, { publicationId: "pub-0001" });
  }

  it("自動で出せない先には、記事の中身が入った下書きと手順が出る", async () => {
    const got = await exportDraft(aPublication({ channelKind: "note" }));
    if (!got.ok) throw got.error;

    expect(got.value.channelLabel).toBe(CHANNEL_CAPABILITIES.note.label);
    // 空の下書きを渡さない。貼っても何も出ないものを渡すと、note へ出す道がふさがる。
    expect(got.value.markdown).toContain(NOTE_BODY);
    expect(got.value.markdown).toContain("3 か月使った記録");
    // 広告表記は本文と一緒に出す。貼り付ける人が別途足すことを前提にしない。
    expect(got.value.markdown).toContain("広告が含まれます");
    // 書き出しただけで終わらせない。人が何をすればよいかを書く。
    expect(got.value.instructions.length).toBeGreaterThan(0);
  });

  it("もとの記事が見つからないときは、空の下書きを渡さない", async () => {
    const got = await exportDraft(aPublication({ channelKind: "note" }), owner, withVariant(null));
    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("NOT_FOUND");
    expect(got.error.message).toContain("記事");
  });

  it("記事が読めないときは、見つからないと言い換えない", async () => {
    const got = await exportDraft(aPublication({ channelKind: "note" }), owner, {
      variants: {
        ...testDeps().contentVariants,
        findById: async () => failing("記事の保存先が読めません。"),
      } as ManageDistributionDeps["variants"],
    });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).not.toBe("NOT_FOUND");
  });

  it("自動で出せる先では、書き出しを使わせない", async () => {
    const got = await exportDraft(aPublication({ channelKind: "x" }));
    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("NOT_SUPPORTED");
    expect(got.error.suggestedAction).toContain("配信を進めて");
  });

  it("書き出しの組み立てに失敗したら、空の下書きを渡さない", async () => {
    const got = await exportDraft(aPublication({ channelKind: "note" }), owner, {
      manualExport: {
        ...testDeps().manualExport,
        buildDraft: async () => failing("下書きを作れません。"),
      } as ManageDistributionDeps["manualExport"],
    });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.message).toContain("下書き");
  });

  it("見つからないものは書き出せない", async () => {
    const got = await exportDraft(null);
    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("NOT_FOUND");
  });

  it("権限が無い人は書き出せない", async () => {
    const got = await exportDraft(aPublication({ channelKind: "note" }), aNobody());
    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("FORBIDDEN");
  });
});

describe("見本データの整合", () => {
  it("見本の配信は、実在する記事を指している", async () => {
    // ここが食い違うと、書き出しが「記事が見つかりません」で止まる。
    // 実装の不具合と区別がつかず、note へ出す唯一の道がふさがったことに気づけない。
    const base = testDeps();
    const ws = SAMPLE_WORKSPACE_ID as typeof owner.workspaceId;
    const listed = await base.publications.listRecent(ws, 100);
    if (!listed.ok) throw listed.error;
    expect(listed.value.length).toBeGreaterThan(0);

    for (const p of listed.value) {
      const variant = await base.contentVariants.findById(ws, p.variantId);
      if (!variant.ok) throw variant.error;
      expect(variant.value, `配信 ${String(p.id)} の記事 ${String(p.variantId)} がありません`).not.toBeNull();
    }
  });
});
