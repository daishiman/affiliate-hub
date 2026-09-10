/**
 * @tier 1
 * @req REQ-VIS03
 * @types permission-matrix, tenant-isolation, equivalence, boundary, fault-injection, idempotency, audit-log
 *
 * 記事サムネイルの登録と取り消し。
 *
 * --- ここで見たいこと ---
 * 1. **失敗したときに何が残るか。**残ってよいのは「誰も参照していない絵」だけで、
 *    「参照されているのに無い絵」は 1 つも作れないこと。
 * 2. **同じ絵を上げ直したとき、いま置いた絵を自分で消さないこと。**
 * 3. 権限と作業場所。
 */
import { describe, expect, it } from "vitest";
import {
  createRemoveArticleThumbnailUseCase,
  createSetArticleThumbnailUseCase,
} from "@/application/usecases/blog-ops";
import type { ArticleThumbnailStoragePort } from "@/application/ports/blog-ops";
import { domainError, err, isErr, isOk, markCommercial, ok } from "@/domain/shared";
import { aNobody, anOutsider, anOwner } from "../support/actors";
import { NOW } from "../support/clock";
import { recordingAuditLog } from "../support/doubles";
import { type Store, article, fakeRepository, sequentialIds } from "../support/blog-ops-fake";

function bytes(size: number, fill = 1): ArrayBuffer {
  return new Uint8Array(size).fill(fill).buffer;
}

/**
 * 置き場の代役。**どの鍵を置いて、どの鍵を消したか**だけを覚える。
 *
 * 鍵の組み立ては `thumbnail-asset.ts` の仕事なので、ここでは真似ず、
 * 「中身が違えば鍵が違う」という性質だけを写す（原本の先頭の値を鍵に混ぜる）。
 */
function fakeStorage(options: { failPut?: boolean; failDelete?: boolean } = {}) {
  const put: string[] = [];
  const deleted: string[] = [];
  const port: ArticleThumbnailStoragePort = {
    async putGeneration(input) {
      if (options.failPut === true) {
        return err(domainError("UPSTREAM_UNAVAILABLE", "置き場が落ちています", { retryable: true }));
      }
      const fingerprint = new Uint8Array(input.original)[0] ?? 0;
      const key = `blog-thumbnails/${input.siteSlug}/${input.articleSlug}/${fingerprint}/original.jpg`;
      put.push(key);
      return ok({ objectKey: key, derivedWidths: input.derived.map((d) => d.width) });
    },
    async deleteGeneration(objectKey) {
      if (options.failDelete === true) {
        return err(domainError("UPSTREAM_UNAVAILABLE", "置き場が落ちています", { retryable: true }));
      }
      deleted.push(objectKey);
      return ok({ deleted: 1 });
    },
  };
  return { port, put, deleted };
}

function depsWith(
  seed: Partial<Store> = {},
  storageOptions: { failPut?: boolean; failDelete?: boolean } = {},
) {
  const repo = fakeRepository({
    articles: [
      { article: article({ id: "a1", siteSlug: "hub", slug: "quiet-laptop" }), blocks: [], tagIds: [] },
    ],
    ...seed,
  });
  const audit = recordingAuditLog();
  const storage = fakeStorage(storageOptions);
  return {
    repo,
    audit,
    storage,
    deps: {
      repository: repo.port,
      storage: storage.port,
      ids: sequentialIds(),
      auditLog: audit.port,
      now: () => NOW,
    },
  };
}

const AN_UPLOAD = {
  articleId: "a1",
  mimeType: "image/jpeg",
  original: bytes(4096, 7),
  derived: [
    { width: 320, bytes: bytes(512) },
    { width: 640, bytes: bytes(1024) },
    { width: 1280, bytes: bytes(2048) },
  ],
  altText: "机の上の静かなノートパソコン",
};

describe("表紙を登録する", () => {
  it("置き場へ置いた鍵が、そのまま台帳に載る", async () => {
    const { deps, repo, storage } = depsWith();
    const r = await createSetArticleThumbnailUseCase(deps).execute(anOwner(), AN_UPLOAD);
    expect(isOk(r)).toBe(true);
    if (!isOk(r)) return;
    expect(storage.put).toEqual([r.value.objectKey]);
    // 台帳が持つのは**置いたときの鍵そのもの**。材料から組み直さない。
    expect(repo.store.thumbnails[0]?.objectKey).toBe(r.value.objectKey);
    expect(repo.store.thumbnails[0]?.derivedWidths).toEqual([320, 640, 1280]);
  });

  it("置き場が落ちたら、台帳には何も書かない", async () => {
    const { deps, repo, audit } = depsWith({}, { failPut: true });
    const r = await createSetArticleThumbnailUseCase(deps).execute(anOwner(), AN_UPLOAD);
    expect(isErr(r)).toBe(true);
    // 台帳に載って絵が無いと、読者の一覧に 404 を指す img が並ぶ。
    expect(repo.store.thumbnails).toEqual([]);
    expect(audit.actions()).toEqual([]);
  });

  it("配信しない幅は落として置く（srcset が 404 を指さない）", async () => {
    const { deps } = depsWith();
    const r = await createSetArticleThumbnailUseCase(deps).execute(anOwner(), {
      ...AN_UPLOAD,
      derived: [
        { width: 640, bytes: bytes(1024) },
        { width: 999, bytes: bytes(1024) },
      ],
    });
    expect(isOk(r) && r.value.derivedWidths).toEqual([640]);
  });

  it("絵を差し替えると、古い世代を消す", async () => {
    const { deps, storage } = depsWith();
    const usecase = createSetArticleThumbnailUseCase(deps);
    const first = await usecase.execute(anOwner(), AN_UPLOAD);
    const second = await usecase.execute(anOwner(), { ...AN_UPLOAD, original: bytes(4096, 8) });
    expect(isOk(first) && isOk(second)).toBe(true);
    if (!isOk(first)) return;
    expect(storage.deleted).toEqual([first.value.objectKey]);
  });

  it("同じ絵を上げ直しても、いま置いた絵を消さない", async () => {
    const { deps, storage, repo } = depsWith();
    const usecase = createSetArticleThumbnailUseCase(deps);
    const first = await usecase.execute(anOwner(), AN_UPLOAD);
    const second = await usecase.execute(anOwner(), AN_UPLOAD);
    expect(isOk(first) && isOk(second)).toBe(true);
    if (!isOk(first) || !isOk(second)) return;
    expect(second.value.objectKey).toBe(first.value.objectKey);
    // 鍵が同じなので、消すと**いま参照している絵**が消える。
    expect(storage.deleted).toEqual([]);
    expect(repo.store.thumbnails[0]?.objectKey).toBe(second.value.objectKey);
  });

  it("古い世代を消せなくても、差し替えは成功として返す", async () => {
    const { deps, repo } = depsWith({}, { failDelete: true });
    const usecase = createSetArticleThumbnailUseCase(deps);
    await usecase.execute(anOwner(), AN_UPLOAD);
    const second = await usecase.execute(anOwner(), { ...AN_UPLOAD, original: bytes(4096, 8) });
    // 読者にはもう新しい絵が出ている。ここで失敗を返すと運営者は押し直し、
    // 押し直すたびに消し残りが増える。
    expect(isOk(second)).toBe(true);
    expect(isOk(second) && repo.store.thumbnails[0]?.objectKey).toBe(
      isOk(second) ? second.value.objectKey : "",
    );
  });

  it("絵の説明が空なら断る", async () => {
    const { deps, storage } = depsWith();
    const r = await createSetArticleThumbnailUseCase(deps).execute(anOwner(), {
      ...AN_UPLOAD,
      altText: "   ",
    });
    expect(isErr(r)).toBe(true);
    // 断る判断は置き場を触る**前**に済ませる。
    expect(storage.put).toEqual([]);
  });

  it("置けない形式・大きすぎる絵は、置き場に触れる前に断る", async () => {
    const { deps, storage } = depsWith();
    const usecase = createSetArticleThumbnailUseCase(deps);
    const svg = await usecase.execute(anOwner(), { ...AN_UPLOAD, mimeType: "image/svg+xml" });
    const huge = await usecase.execute(anOwner(), {
      ...AN_UPLOAD,
      original: bytes(8 * 1024 * 1024 + 1),
    });
    expect(isErr(svg) && isErr(huge)).toBe(true);
    expect(storage.put).toEqual([]);
  });

  it("記録が書けなければ「登録できた」と言わない", async () => {
    const { deps, audit } = depsWith();
    const failing = {
      ...deps,
      auditLog: {
        ...audit.port,
        append: async () => err(domainError("UPSTREAM_UNAVAILABLE", "記録先が落ちています")),
      },
    };
    const r = await createSetArticleThumbnailUseCase(failing).execute(anOwner(), AN_UPLOAD);
    expect(isErr(r)).toBe(true);
  });

  it("何を差し替えたかが記録に残る", async () => {
    const { deps, audit } = depsWith();
    const usecase = createSetArticleThumbnailUseCase(deps);
    await usecase.execute(anOwner(), AN_UPLOAD);
    await usecase.execute(anOwner(), { ...AN_UPLOAD, original: bytes(4096, 8) });
    expect(audit.actions()).toEqual([
      "blog_article_thumbnail.set",
      "blog_article_thumbnail.set",
    ]);
    // 2 度目には**前の鍵**が残る。鍵は中身の指紋を含むので、
    // 絵が変わったかどうかがここだけで分かる。
    const second = audit.entries()[1];
    expect(second?.before).not.toBeNull();
    expect(second?.after).not.toBeNull();
  });
});

describe("誰が触れるか", () => {
  it("権限が無ければ登録できない", async () => {
    const { deps, storage } = depsWith();
    const r = await createSetArticleThumbnailUseCase(deps).execute(aNobody(), AN_UPLOAD);
    expect(isErr(r)).toBe(true);
    expect(storage.put).toEqual([]);
  });

  it("別の作業場所の記事には付けられない", async () => {
    const { deps, repo } = depsWith();
    const r = await createSetArticleThumbnailUseCase(deps).execute(anOutsider(), AN_UPLOAD);
    expect(isErr(r)).toBe(true);
    expect(repo.store.thumbnails).toEqual([]);
  });

  it("報酬のポートを渡すと、組み立てた時点で止まる", () => {
    const { deps } = depsWith();
    expect(() =>
      createSetArticleThumbnailUseCase({
        ...deps,
        // 見ているのは**印だけ**。中身が空でも組み立てが止まることを確かめる
        // ための偽装なので、`as never` はここでは表明として置いている。
        // 口を揃えると「印が違う」以外の理由でも止まり、何を見たのか読めなくなる。
        affiliateLinks: markCommercial({}) as never,
      }),
    ).toThrow(/商業データ/);
  });
});

describe("表紙を外す", () => {
  it("台帳の参照を外してから、置き場を消す", async () => {
    const { deps, repo, storage } = depsWith();
    const stored = await createSetArticleThumbnailUseCase(deps).execute(anOwner(), AN_UPLOAD);
    expect(isOk(stored)).toBe(true);
    if (!isOk(stored)) return;

    const r = await createRemoveArticleThumbnailUseCase(deps).execute(anOwner(), {
      articleId: "a1",
    });
    expect(isOk(r) && r.value.removed).toBe(true);
    expect(repo.store.thumbnails).toEqual([]);
    expect(storage.deleted).toEqual([stored.value.objectKey]);
  });

  it("置き場を消せなくても、読者からは消えている", async () => {
    const { deps, repo } = depsWith({}, { failDelete: true });
    await createSetArticleThumbnailUseCase(deps).execute(anOwner(), AN_UPLOAD);
    const r = await createRemoveArticleThumbnailUseCase(deps).execute(anOwner(), {
      articleId: "a1",
    });
    expect(isOk(r)).toBe(true);
    expect(repo.store.thumbnails).toEqual([]);
  });

  it("もともと無いものを外しても壊れない（記録も増やさない）", async () => {
    const { deps, audit } = depsWith();
    const r = await createRemoveArticleThumbnailUseCase(deps).execute(anOwner(), {
      articleId: "a1",
    });
    expect(isOk(r) && r.value.removed).toBe(false);
    expect(audit.actions()).toEqual([]);
  });

  it("権限が無ければ外せない", async () => {
    const { deps } = depsWith();
    const r = await createRemoveArticleThumbnailUseCase(deps).execute(aNobody(), {
      articleId: "a1",
    });
    expect(isErr(r)).toBe(true);
  });
});
