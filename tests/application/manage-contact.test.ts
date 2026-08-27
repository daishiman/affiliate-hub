/**
 * @tier 1
 * @req REQ-B18
 * @types equivalence, boundary, adversarial
 *
 * 届いた問い合わせを運営者が読む側。
 *
 * --- ここで最も守りたいこと ---
 * 1. **権限の無い人には読ませない。** 読者が書いた文章がそのまま入っている。
 * 2. **既定は未対応だけ。** 済んだものが常に視界にあると、残りを毎回数え直す。
 * 3. **0 件のときは、なぜ 0 件かを言う。** 白紙は「壊れている」と読まれる。
 * 4. **件数は絞り込みで変わらない。** 変わると、絞ったことを忘れて「もう無い」と読む。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §2
 */
import { describe, expect, it } from "vitest";
import type {
  ContactRecord,
  EditorialContactPort,
} from "@/application/ports/reader-interaction";
import type { EditorialSiteRepositoryPort } from "@/application/ports/site";
import {
  type ManageContactDeps,
  createListContactMessagesUseCase,
  createMarkContactHandledUseCase,
} from "@/application/usecases/site/manage-contact";
import { domainError, err, markEditorial, ok } from "@/domain/shared";
import { OTHER_WORKSPACE, WORKSPACE, aNobody, anOwner } from "../support/actors";

const SITE = "sample-site";

function record(over: Partial<ContactRecord> = {}): ContactRecord {
  return {
    id: "cm_1",
    siteSlug: SITE,
    body: "記事の型番が違うようです。",
    replyTo: "reader@example.com",
    receivedAt: "2026-08-25T00:00:00.000Z",
    handledAt: null,
    ...over,
  };
}

function contactPort(records: readonly ContactRecord[] = []) {
  const calls: { id: string; handled: boolean; at: string }[] = [];
  const port = markEditorial({
    async submit() {
      return ok({ receiptId: "cm_new" });
    },
    async list(_workspaceId, ownedSiteSlugs: readonly string[], siteSlug?: string) {
      return ok(
        records.filter(
          (record) =>
            ownedSiteSlugs.includes(record.siteSlug) &&
            (siteSlug === undefined || record.siteSlug === siteSlug),
        ),
      );
    },
    async markHandled(
      _workspaceId,
      ownedSiteSlugs: readonly string[],
      id: string,
      handled: boolean,
      at: string,
    ) {
      const target = records.find(
        (record) => record.id === id && ownedSiteSlugs.includes(record.siteSlug),
      );
      if (target === undefined) {
        return err(domainError("NOT_FOUND", "その問い合わせは見つかりません。"));
      }
      calls.push({ id, handled, at });
      return ok(true as const);
    },
  }) as EditorialContactPort;
  return { port, calls };
}

function sitesPort(): EditorialSiteRepositoryPort {
  const entries = [
    { slug: SITE, blueprint: { workspaceId: WORKSPACE } },
    { slug: "second-owned-site", blueprint: { workspaceId: WORKSPACE } },
    { slug: "other-site", blueprint: { workspaceId: OTHER_WORKSPACE } },
  ];
  return markEditorial({
    async findBySlug(slug: string) {
      return ok(entries.find((site) => site.slug === slug)?.blueprint ?? null);
    },
    async list() {
      return ok(entries);
    },
  }) as unknown as EditorialSiteRepositoryPort;
}

function deps(contact: EditorialContactPort): ManageContactDeps {
  return { contact, sites: sitesPort() };
}

describe("届いた問い合わせを読む", () => {
  it("権限が無い人には出さない", async () => {
    const { port } = contactPort([record()]);
    const result = await createListContactMessagesUseCase(deps(port)).execute(
      aNobody(),
      {},
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
  });

  it("既定では未対応だけを出す", async () => {
    const { port } = contactPort([
      record(),
      record({ id: "cm_2", handledAt: "2026-08-26T00:00:00.000Z" }),
    ]);
    const result = await createListContactMessagesUseCase(deps(port)).execute(anOwner(), {});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rows.map((r) => r.id)).toEqual(["cm_1"]);
  });

  it("「対応済みも見る」を選ぶと、済んだものも出る", async () => {
    const { port } = contactPort([
      record(),
      record({ id: "cm_2", handledAt: "2026-08-26T00:00:00.000Z" }),
    ]);
    const result = await createListContactMessagesUseCase(deps(port)).execute(anOwner(), {
      includeHandled: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rows.map((r) => r.id)).toEqual(["cm_1", "cm_2"]);
    expect(result.value.rows[1]?.handled).toBe(true);
  });

  it("件数は、いま出している分ではなく届いた全体の数で出す", async () => {
    const { port } = contactPort([
      record(),
      record({ id: "cm_2", handledAt: "2026-08-26T00:00:00.000Z" }),
      record({ id: "cm_3", handledAt: "2026-08-26T00:00:00.000Z" }),
    ]);
    const result = await createListContactMessagesUseCase(deps(port)).execute(anOwner(), {});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 出しているのは 1 件だが、届いたのは 3 件・未対応は 1 件。
    expect(result.value.rows).toHaveLength(1);
    expect(result.value.totalCount).toBe(3);
    expect(result.value.unhandledCount).toBe(1);
  });

  it("本文が長いときは抜粋を添える（全文は捨てない）", async () => {
    const long = "あ".repeat(200);
    const { port } = contactPort([record({ body: long })]);
    const result = await createListContactMessagesUseCase(deps(port)).execute(anOwner(), {});

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rows[0]?.summary.endsWith("…")).toBe(true);
    expect(result.value.rows[0]?.summary.length).toBeLessThan(long.length);
    // 抜粋だけにすると、画面で全文が読めなくなる。
    expect(result.value.rows[0]?.body).toBe(long);
  });

  it.each([
    [
      "1 件も届いていないとき",
      [] as readonly ContactRecord[],
      false,
      "まだ問い合わせは届いていません",
    ],
    [
      "届いているが全部対応済みのとき",
      [record({ handledAt: "2026-08-26T00:00:00.000Z" })] as readonly ContactRecord[],
      false,
      "未対応の問い合わせはありません",
    ],
  ])("%s は、なぜ 0 件かを言う", async (_name, records, includeHandled, expected) => {
    const { port } = contactPort(records);
    const result = await createListContactMessagesUseCase(deps(port)).execute(anOwner(), {
      includeHandled,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rows).toHaveLength(0);
    expect(result.value.emptyReason).toContain(expected);
  });

  it("サイトを指定すると、そのサイトの分だけを出す", async () => {
    const { port } = contactPort([
      record(),
      record({ id: "cm_2", siteSlug: "second-owned-site" }),
    ]);
    const result = await createListContactMessagesUseCase(deps(port)).execute(anOwner(), {
      siteSlug: "second-owned-site",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rows.map((r) => r.id)).toEqual(["cm_2"]);
  });

  it("サイト指定を省いても、自分の作業場所が持つサイトの分だけを出す", async () => {
    const { port } = contactPort([
      record(),
      record({ id: "cm_other", siteSlug: "other-site" }),
    ]);

    const result = await createListContactMessagesUseCase(deps(port)).execute(anOwner(), {
      includeHandled: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rows.map((r) => r.id)).toEqual(["cm_1"]);
  });
});

describe("対応済みの印", () => {
  it("権限が無い人は印を付けられない", async () => {
    const { port, calls } = contactPort([record()]);
    const result = await createMarkContactHandledUseCase(deps(port)).execute(aNobody(), {
      id: "cm_1",
      handled: true,
    });

    expect(result.ok).toBe(false);
    // 断ったのに保存先まで届いていたら、断りが飾りになる。
    expect(calls).toHaveLength(0);
  });

  it("押した時刻を保存先へ渡す", async () => {
    const { port, calls } = contactPort([record()]);
    const at = new Date("2026-08-26T09:00:00.000Z");
    const result = await createMarkContactHandledUseCase(deps(port), () => at).execute(
      anOwner(),
      { id: "cm_1", handled: true },
    );

    expect(result.ok).toBe(true);
    expect(calls).toEqual([{ id: "cm_1", handled: true, at: at.toISOString() }]);
  });

  it("未対応へ戻せる（押し間違いを直せる）", async () => {
    const { port, calls } = contactPort([record()]);
    await createMarkContactHandledUseCase(deps(port)).execute(anOwner(), {
      id: "cm_1",
      handled: false,
    });

    expect(calls[0]?.handled).toBe(false);
  });

  it("別の作業場所のサイトに届いた問い合わせ ID は更新できない", async () => {
    const { port, calls } = contactPort([
      record({ id: "cm_other", siteSlug: "other-site" }),
    ]);

    const result = await createMarkContactHandledUseCase(deps(port)).execute(anOwner(), {
      id: "cm_other",
      handled: true,
    });

    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });
});
