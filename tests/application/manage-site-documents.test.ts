/**
 * @tier 1
 * @req REQ-S06, REQ-W10
 * @types equivalence, boundary
 *
 * ブログの固定文書（運営者情報・各方針・規約・特定商取引法に基づく表記）。
 *
 * `legal_page` 表は 2026-08-26 まで、どの usecase からも読まれていなかった。
 * 読者に出ていたのは見本データで、運営者情報の位置には「編集部が運営しています」
 * という**書いた覚えのない文**が本物の顔で出ていた。
 *
 * ここで固定したいこと。
 *   1. **未整備が一覧から消えない。** 保存済みだけを返すと、空の固定ページは
 *      フッターのリンクを踏んだ読者の 404 としてしか現れない。
 *   2. **種類はルート表から来る。** 画面の一覧をここで並べ直さない。
 *   3. **他社のブログは「無い」と同じ顔で断る。** 符号を打ち分けると名前の実在が漏れる。
 *   4. **見出しだけ・本文だけの保存を通さない。** 通すと中身の無いページが読者に出る。
 */
import { describe, expect, expectTypeOf, it } from "vitest";
import type {
  EditorialSiteDocumentRepositoryPort,
  EditorialSiteRepositoryPort,
  SiteDocument,
} from "@/application/ports/site";
import {
  createListSiteDocumentsUseCase,
  createSaveSiteDocumentUseCase,
} from "@/application/usecases/site/manage-site-documents";
import { SITE_DOCUMENT_KEYS, type SiteDocumentKey } from "@/domain/authoring";
import { markEditorial, ok } from "@/domain/shared";
import { OTHER_WORKSPACE, WORKSPACE, anOwner, aWriter } from "../support/actors";

const owner = anOwner({ workspaceId: WORKSPACE });
const stranger = anOwner({ workspaceId: OTHER_WORKSPACE });

const SITE = { name: "動画編集の道具", workspaceId: WORKSPACE };

expectTypeOf<SiteDocument["key"]>().toEqualTypeOf<SiteDocumentKey>();

function sitesOf(workspaceId = WORKSPACE): EditorialSiteRepositoryPort {
  return markEditorial({
    async findBySlug(slug: string) {
      return ok(slug === "tools" ? { ...SITE, workspaceId } : null);
    },
    async list() {
      return ok([]);
    },
  }) as unknown as EditorialSiteRepositoryPort;
}

/** 保存した内容をそのまま持つ置き場。保存の形まで見たいので、記録も残す。 */
function documentsOf(seed: readonly SiteDocument[] = []) {
  const saved: { workspaceId: string; siteSlug: string; document: unknown }[] = [];
  const rows = [...seed];
  /*
    作業場所は口の第 1 引数。ここを受け取らないと、記録した `siteSlug` の位置に
    作業場所が入り、判定は通るのに「別の会社のブログへ保存していないか」を
    まったく見ていない試験になる。
  */
  const port = markEditorial({
    async listBySite(_workspaceId: string, _siteSlug: string) {
      return ok(rows);
    },
    async save(workspaceId: string, siteSlug: string, document: SiteDocument) {
      saved.push({ workspaceId, siteSlug, document });
      return ok(true as const);
    },
  }) as unknown as EditorialSiteDocumentRepositoryPort;
  return { port, saved };
}

function aDocument(over: Partial<SiteDocument> = {}): SiteDocument {
  return {
    key: "operator",
    title: "運営者情報",
    body: ["この記事は編集部が書いています。"],
    updatedAt: new Date("2026-08-01T00:00:00Z"),
    ...over,
  };
}

async function list(seed: readonly SiteDocument[] = [], actor = owner) {
  return createListSiteDocumentsUseCase({
    sites: sitesOf(),
    documents: documentsOf(seed).port,
  }).execute(actor, { siteSlug: "tools" });
}

describe("固定文書の一覧", () => {
  it("1 枚も書いていなくても、種類のぶんだけ行が出る", async () => {
    const r = await list();
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.rows.map((row) => row.key)).toEqual([...SITE_DOCUMENT_KEYS]);
    expect(r.value.rows.every((row) => row.missing)).toBe(true);
    expect(r.value.missingCount).toBe(SITE_DOCUMENT_KEYS.length);
  });

  it("書いた 1 枚だけが未整備から外れる", async () => {
    const r = await list([aDocument()]);
    if (!r.ok) throw new Error(r.error.message);
    const operator = r.value.rows.find((row) => row.key === "operator");
    expect(operator?.missing).toBe(false);
    expect(operator?.body).toEqual(["この記事は編集部が書いています。"]);
    expect(r.value.missingCount).toBe(SITE_DOCUMENT_KEYS.length - 1);
  });

  it("読者に出る場所が行に付く（実物を確かめに行ける）", async () => {
    const r = await list();
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.rows.find((row) => row.key === "tokushoho")?.readerPath).toBe("/tokushoho");
    expect(r.value.rows.every((row) => row.readerPath !== "")).toBe(true);
  });

  it("他社のブログは「無い」と同じ顔で断る", async () => {
    const r = await list([], stranger);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    // FORBIDDEN と打ち分けると、断り方の違いだけで名前の実在が分かる。
    expect(r.error.code).toBe("NOT_FOUND");
  });
});

describe("固定文書の保存", () => {
  async function save(
    input: { key?: string; title?: string; body?: readonly string[] },
    actor = owner,
  ) {
    const documents = documentsOf();
    const r = await createSaveSiteDocumentUseCase({
      sites: sitesOf(),
      documents: documents.port,
    }).execute(actor, {
      siteSlug: "tools",
      key: input.key ?? "operator",
      title: input.title ?? "運営者情報",
      body: input.body ?? ["編集部が運営しています。"],
    });
    return { r, saved: documents.saved };
  }

  it("知らない種類は保存しない", async () => {
    const { r, saved } = await save({ key: "not_a_page" });
    expect(r.ok).toBe(false);
    // どの画面にも出ない行を保存先へ残さない。
    expect(saved).toHaveLength(0);
  });

  it("ブログを所有していても site.manage 権限が無ければ保存しない", async () => {
    const { r, saved } = await save({}, aWriter({ workspaceId: WORKSPACE }));

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("FORBIDDEN");
    expect(saved).toHaveLength(0);
  });

  it.each([
    ["見出しが空", { title: "   " }, "title"],
    ["本文が空", { body: ["  ", ""] }, "body"],
  ])("%s なら、どの欄が原因かを返して保存しない", async (_name, over, field) => {
    const { r, saved } = await save(over);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("VALIDATION_FAILED");
    expect(r.error.field).toBe(field);
    expect(saved).toHaveLength(0);
  });

  it("前後の空きと空の段落を落として保存する", async () => {
    const { r, saved } = await save({
      title: "  特定商取引法に基づく表記  ",
      body: ["  事業者名: 例  ", "   ", "所在地: 請求があれば遅滞なく開示します。"],
    });
    expect(r.ok).toBe(true);
    // 保存先は、頼んだ人の作業場所。URL 名だけで書き先を決めない。
    expect(saved[0]?.workspaceId).toBe(WORKSPACE);
    expect(saved[0]?.siteSlug).toBe("tools");
    expect(saved[0]?.document).toEqual({
      key: "operator",
      title: "特定商取引法に基づく表記",
      body: ["事業者名: 例", "所在地: 請求があれば遅滞なく開示します。"],
    });
  });
});
