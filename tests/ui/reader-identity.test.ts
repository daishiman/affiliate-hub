/**
 * @tier 1
 * @req REQ-BLOG02
 * @types decision-table, secrets
 *
 * 読者の合言葉。ログインを求めずに「気になる商品」を読者ごとに分けるための、
 * 意味の無い乱数である。
 *
 * この 1 本が守るのは**合言葉に個人が混ざらないこと**と、
 * **空文字を合言葉として扱わないこと**の 2 つ。
 * 前者は混ざってから気づいても取り返しがつかず、後者は
 * cookie が消えかけた端末全員が「同じ読者」になる形で壊れる——
 * どちらも画面上はもっともらしく動くので、使っても気づけない。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const store = {
  get: vi.fn<(name: string) => { value: string } | undefined>(),
  set: vi.fn(),
};

vi.mock("next/headers", () => ({ cookies: async () => store }));

const { READER_COOKIE_NAME, ensureReaderIdentity, readerIdentityOrNull } = await import(
  "@/presentation/site/reader-identity"
);

beforeEach(() => {
  store.get.mockReset();
  store.set.mockReset();
});

describe("読むだけの画面から読む", () => {
  it("配ってあれば、その合言葉を返す", () => {
    store.get.mockReturnValue({ value: "reader-1" });

    return expect(readerIdentityOrNull()).resolves.toBe("reader-1");
  });

  it("配っていなければ null で、その場では発行しない", async () => {
    /*
      ここで発行すると、記事を 1 枚見ただけの人にも合言葉が配られる。
      加えて `cookies().set` は読み取り専用の画面では例外になるので、
      記事が丸ごと開けなくなる。
    */
    store.get.mockReturnValue(undefined);

    await expect(readerIdentityOrNull()).resolves.toBeNull();
    expect(store.set).not.toHaveBeenCalled();
  });

  it("空の合言葉は「無い」と同じに扱う", async () => {
    /*
      cookie は消えかけの端末で空文字になることがある。
      空文字を合言葉として通すと、**そういう端末の読者が全員同じ人になり**、
      他人の「気になる商品」が見える。
    */
    store.get.mockReturnValue({ value: "" });

    await expect(readerIdentityOrNull()).resolves.toBeNull();
  });
});

describe("サーバ動作の中で確かめて発行する", () => {
  it("すでにあれば作り直さない", async () => {
    // 押すたびに別人になると、保存したものが毎回消えたように見える。
    store.get.mockReturnValue({ value: "reader-1" });

    await expect(ensureReaderIdentity()).resolves.toBe("reader-1");
    expect(store.set).not.toHaveBeenCalled();
  });

  it.each([
    ["まだ配っていない", undefined],
    ["空になっている", { value: "" }],
  ])("%s ときは新しく発行する", async (_name, found) => {
    store.get.mockReturnValue(found);

    const issued = await ensureReaderIdentity();

    expect(issued).toMatch(/^[0-9a-f-]{36}$/);
    expect(store.set).toHaveBeenCalledWith(READER_COOKIE_NAME, issued, expect.anything());
  });

  it("script からも他サイトからも読めない形で配る", async () => {
    /*
      記事には第三者の script が紛れ込みうる。持ち出しの経路は
      型ではなくブラウザの側で塞ぐ——`httpOnly` と `sameSite` は
      片方だけでは足りず、両方あって初めて経路が閉じる。
    */
    store.get.mockReturnValue(undefined);

    await ensureReaderIdentity();

    expect(store.set.mock.calls[0][2]).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  });

  it("発行する値は乱数だけで、読者について何も言わない", async () => {
    // 名前・連絡先・IP を混ぜられる形にしておくと、いつか混ざる。
    store.get.mockReturnValue(undefined);

    const first = await ensureReaderIdentity();
    store.set.mockReset();
    const second = await ensureReaderIdentity();

    expect(first).not.toBe(second);
  });
});
