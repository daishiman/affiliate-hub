/**
 * @tier 1
 * @req REQ-BOPS14, FRONT-REQ-005
 * @types boundary, permission-matrix, tenant-isolation, fault-injection
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { aWriter, aNobody, anOutsider, WORKSPACE } from "../support/actors";

const stubs = vi.hoisted(() => ({
  bucket: { kind: "article-image-bucket" },
  db: { kind: "article-image-db" },
  deleteObject: vi.fn(),
  putObject: vi.fn(),
  reserveImage: vi.fn(),
  finalizeImage: vi.fn(),
  signedInActor: vi.fn(),
  tryGetBucket: vi.fn(),
  tryGetDb: vi.fn(),
  ownsArticle: vi.fn(),
  findImage: vi.fn(),
  isPublic: vi.fn(),
  readObject: vi.fn(),
}));

vi.mock("@/presentation/composition", () => ({
  signedInActor: stubs.signedInActor,
  requestOriginFromWebRequest: (request: Request) => new URL(request.url).origin,
}));
vi.mock("@/infrastructure/platform/bucket-connection", () => ({
  tryGetArticleImageBucket: stubs.tryGetBucket,
}));
vi.mock("@/infrastructure/persistence/d1/connection", () => ({
  tryGetDb: stubs.tryGetDb,
}));
vi.mock("@/infrastructure/platform/article-image-r2", () => ({
  deleteArticleImageObject: stubs.deleteObject,
  putArticleImageObject: stubs.putObject,
  readArticleImageObject: stubs.readObject,
}));
vi.mock("@/infrastructure/persistence/d1/article-image-repository", () => ({
  reserveArticleImage: stubs.reserveImage,
  finalizeArticleImage: stubs.finalizeImage,
  ownsImageArticle: stubs.ownsArticle,
  findArticleImage: stubs.findImage,
  isArticleImagePublic: stubs.isPublic,
}));

const { POST } = await import("@/app/api/article-images/route");
const { GET } = await import("@/app/api/article-images/[image]/route");

const PNG_BYTES = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00,
]);

function upload(bytes = PNG_BYTES, declaredMimeType = "image/png"): Request {
  const form = new FormData();
  form.set("articleId", "article-1");
  form.set("file", new File([bytes], "article-image", { type: declaredMimeType }));
  return new Request("https://hub.test/api/article-images", {
    method: "POST", body: form, headers: { origin: "https://hub.test" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  stubs.signedInActor.mockResolvedValue(aWriter());
  stubs.tryGetBucket.mockResolvedValue(stubs.bucket);
  stubs.tryGetDb.mockResolvedValue(stubs.db);
  stubs.putObject.mockResolvedValue(undefined);
  stubs.reserveImage.mockResolvedValue(undefined);
  stubs.finalizeImage.mockResolvedValue(true);
  stubs.deleteObject.mockResolvedValue(undefined);
  stubs.ownsArticle.mockResolvedValue(true);
  stubs.findImage.mockResolvedValue({ id: "image-1", workspaceId: WORKSPACE, articleId: "article-1", objectKey: "article-images/owned.png", mimeType: "image/png" });
  stubs.isPublic.mockResolvedValue(false);
  stubs.readObject.mockResolvedValue(PNG_BYTES.buffer);
});

describe("POST /api/article-images", () => {
  it.each([null, "null", "https://elsewhere.test"])("同一origin以外からの画像送信を拒否する: %s", async (origin) => {
    const request = upload();
    if (origin === null) request.headers.delete("origin");
    else request.headers.set("origin", origin);
    expect((await POST(request)).status).toBe(403);
    expect(stubs.putObject).not.toHaveBeenCalled();
  });

  it("他workspaceまたは存在しない記事には画像を足せない", async () => {
    stubs.ownsArticle.mockResolvedValue(false);
    expect((await POST(upload())).status).toBe(404);
    expect(stubs.putObject).not.toHaveBeenCalled();
  });

  it("Content-Lengthのない巨大multipartも読み込み中に拒否する", async () => {
    let cancelled = false;
    let chunks = 0;
    const request = new Request("https://hub.test/api/article-images", {
      method: "POST", headers: { origin: "https://hub.test", "content-type": "multipart/form-data; boundary=x" },
      body: new ReadableStream({ pull(controller) { if (chunks++ < 12) controller.enqueue(new Uint8Array(1024 * 1024)); else controller.close(); }, cancel() { cancelled = true; } }),
      duplex: "half",
    } as RequestInit);
    expect((await POST(request)).status).toBe(413);
    expect(cancelled).toBe(true);
    expect(stubs.putObject).not.toHaveBeenCalled();
  });

  it("申告された形式とバイト列が違う画像は置き場へ渡さない", async () => {
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]);

    const response = await POST(upload(jpeg, "image/png"));

    expect(response.status).toBe(400);
    expect(stubs.putObject).not.toHaveBeenCalled();
    expect(stubs.reserveImage).not.toHaveBeenCalled();
  });

  it("見分けた MIME を置き場と台帳の両方へ記録する", async () => {
    const response = await POST(upload());

    expect(response.status).toBe(200);
    expect(stubs.putObject).toHaveBeenCalledWith(
      stubs.bucket,
      expect.any(String),
      expect.any(ArrayBuffer),
      "image/png",
    );
    expect(stubs.reserveImage).toHaveBeenCalledWith(
      stubs.db,
      expect.objectContaining({ mimeType: "image/png" }),
    );
  });

  it("置き場へ書けなかった場合は未完了予約を保持し、公開URLを返さない", async () => {
    stubs.putObject.mockRejectedValueOnce(new Error("R2 put failed"));

    const response = await POST(upload());

    expect(response.status).toBe(502);
    expect(stubs.reserveImage).toHaveBeenCalledOnce();
    expect(stubs.finalizeImage).not.toHaveBeenCalled();
    expect(stubs.deleteObject).not.toHaveBeenCalled();
  });

  it("予約台帳へ記録できなければ、R2への書込自体を行わない", async () => {
    stubs.reserveImage.mockRejectedValueOnce(new Error("D1 insert failed"));

    const response = await POST(upload());

    expect(response.status).toBe(502);
    expect(stubs.putObject).not.toHaveBeenCalled();
    expect(stubs.finalizeImage).not.toHaveBeenCalled();
    expect(stubs.deleteObject).not.toHaveBeenCalled();
  });

  it("公開完了の応答が不明でも、成功にせず予約と実体を回収処理へ残す", async () => {
    stubs.finalizeImage.mockRejectedValueOnce(new Error("D1 completion unknown"));

    const response = await POST(upload());

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      message: "画像を保存できませんでした。もう一度お試しください。",
    });
    expect(stubs.deleteObject).not.toHaveBeenCalled();
  });

  it("回収済みの予約は遅延upload完了後も公開成功へ戻さない", async () => {
    stubs.finalizeImage.mockResolvedValue(false);
    expect((await POST(upload())).status).toBe(502);
    expect(stubs.deleteObject).not.toHaveBeenCalled();
  });
});

describe("GET /api/article-images/:image", () => {
  const read = () => GET(new Request("https://hub.test/api/article-images/image-1"), { params: Promise.resolve({ image: "image-1" }) });

  it("同じidへ解決されるpercent-encoded別名は認めない", async () => {
    const response = await GET(new Request("https://hub.test/api/article-images/%69mage-1"), { params: Promise.resolve({ image: "image-1" }) });
    expect(response.status).toBe(404);
    expect(stubs.readObject).not.toHaveBeenCalled();
  });

  it("匿名には下書き画像を返さない", async () => {
    stubs.signedInActor.mockResolvedValue(null);
    expect((await read()).status).toBe(404);
    expect(stubs.readObject).not.toHaveBeenCalled();
  });
  it("公開記事が参照する画像は匿名で読め、公開解除をキャッシュしない", async () => {
    stubs.signedInActor.mockResolvedValue(null);
    stubs.isPublic.mockResolvedValue(true);
    const response = await read();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    stubs.isPublic.mockResolvedValue(false);
    expect((await read()).status).toBe(404);
  });
  it("同workspaceの書き手は下書きを確認できる", async () => {
    expect((await read()).status).toBe(200);
  });
  it.each([anOutsider(), aNobody()])("他workspaceや閲覧権限なしでは下書きを見られない", async (actor) => {
    stubs.signedInActor.mockResolvedValue(actor);
    expect((await read()).status).toBe(404);
  });
  it("参照確認の障害時には画像を開示しない", async () => {
    stubs.signedInActor.mockResolvedValue(null);
    stubs.isPublic.mockRejectedValue(new Error("private DB details"));
    const response = await read();
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain("private DB");
    expect(stubs.readObject).not.toHaveBeenCalled();
  });
});
