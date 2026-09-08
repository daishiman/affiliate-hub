/**
 * @tier 2
 * @req REQ-VIS03
 * @types screen-states, a11y
 */
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { asPartOfPage, describeViolations, findA11yViolations } from "../support/a11y";

/**
 * 記事の表紙（サムネイル）を登録する欄。
 *
 * --- ここで見たいこと ---
 *
 * 1. **断りが、原因の欄のところに出ること。** 業務側は `mimeType` / `original` /
 *    `altText` の 3 つの名前で断りを返す。名前が画面のどこにも配線されていないと、
 *    運営者には「登録できませんでした」だけが出て、何を直せばよいか分からない。
 * 2. **縮小版を幅ごとの名前で運ぶこと。** 並び順に頼る形に戻すと、1 枚落ちた日に
 *    「640 の絵が 320 として配られる」が起きる。名前は送る側と受ける側の約束なので、
 *    片方だけ直しても気づけない。ここで名前そのものを押さえる。
 * 3. **縮小版を作れなかったことを、黙って成功にしないこと。**
 *
 * 押した先で何が起きるかは `tests/application/manage-article-thumbnail.test.ts` が
 * 見ている。ここで見るのは、送る形と出す言葉だけである。
 */

let actionState: Record<string, unknown> = { status: "idle", message: "" };
let actionPending = false;

vi.mock("@/presentation/admin/publish/article-thumbnail-action", () => ({
  manageArticleThumbnailAction: async () => actionState,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useActionState: () => [actionState, () => undefined, actionPending],
  };
});

const { ArticleThumbnailForm } = await import(
  "@/presentation/admin/publish/article-thumbnail-form"
);

const A_THUMBNAIL = {
  href: "/api/blog-thumbnails/hub/quiet-laptop/abc/original.jpg",
  altText: "机の上の静かなノートパソコン",
  derivedWidths: [320, 640, 1280],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  actionState = { status: "idle", message: "" };
  actionPending = false;
});

describe("表紙の選び直しと準備中の操作", () => {
  it("登録中は画像と説明の両方を保持し、送信済み内容と表示を食い違わせない", () => {
    actionPending = true;
    render(<ArticleThumbnailForm articleId="a1" current={A_THUMBNAIL} />);
    expect((screen.getByLabelText("表紙にする絵") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText("絵の説明") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "登録しています" }) as HTMLButtonElement).disabled).toBe(true);
  });

  function setupPicker() {
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: (file: File) => `blob:${file.name}`,
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal("DataTransfer", class {
      files: File[] = [];
      items = { add: (file: File) => this.files.push(file) };
    });
    const view = render(<ArticleThumbnailForm articleId="a1" current={null} />);
    // jsdom lacks DataTransfer. Model only the browser's writable file-list boundary.
    for (const width of [320, 640, 1280]) {
      Object.defineProperty(hiddenInput(`derived-${width}`), "files", {
        configurable: true, writable: true, value: [],
      });
    }
    return {
      pick: (name: string | null) => fireEvent.change(hiddenInput("original")!, {
        target: { files: name === null ? [] : [new File(["image"], name, { type: "image/jpeg" })] },
      }),
      rerender: () => view.rerender(<ArticleThumbnailForm articleId="a1" current={null} />),
      unmount: view.unmount,
    };
  }

  function bitmap(width: number): ImageBitmap {
    return { width, height: width / 2, close: vi.fn() } as unknown as ImageBitmap;
  }

  it("準備中は理由を表示し、ボタンとフォーム送信の両方で登録を待つ", async () => {
    let finish!: (image: ImageBitmap) => void;
    vi.stubGlobal("createImageBitmap", () => new Promise<ImageBitmap>((resolve) => { finish = resolve; }));
    const { pick } = setupPicker();
    pick("cover.jpg");
    const button = screen.getByRole("button", { name: "画像を準備しています" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(fireEvent.submit(button.closest("form")!)).toBe(false);
    await act(async () => { finish(bitmap(200)); });
    expect((screen.getByRole("button", { name: "この絵を表紙にする" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("画像の変換が失敗しても理由が分かり、原本で登録を再開できる", async () => {
    vi.stubGlobal("createImageBitmap", async () => { throw new Error("decode failed"); });
    const { pick } = setupPicker();
    pick("broken.jpg");
    await waitFor(() => expect(screen.getByText(/縮小版を作れませんでした/)).toBeTruthy());
    expect((screen.getByRole("button", { name: "この絵を表紙にする" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("先に選んだ画像の変換が遅れて終わっても、最後に選んだ画像へ混ざらない", async () => {
    const pending = new Map<string, (image: ImageBitmap) => void>();
    vi.stubGlobal("createImageBitmap", (file: File) => new Promise<ImageBitmap>((resolve) => pending.set(file.name, resolve)));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => callback(new Blob(["derived"], { type: "image/jpeg" })));
    const { pick } = setupPicker();
    pick("old.jpg");
    pick("latest.jpg");
    const latest = bitmap(200);
    const old = bitmap(1600);
    await act(async () => { pending.get("latest.jpg")!(latest); });
    await act(async () => { pending.get("old.jpg")!(old); });
    expect(document.querySelector('img[src="blob:latest.jpg"]')).not.toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:old.jpg");
    expect(latest.close).toHaveBeenCalled();
    expect(old.close).toHaveBeenCalled();
    for (const width of [320, 640, 1280]) {
      expect(hiddenInput(`derived-${width}`)?.files?.length).toBe(0);
    }
  });

  it("選択を解除すると、前の画像の縮小版も送信対象から外れる", async () => {
    vi.stubGlobal("createImageBitmap", async () => bitmap(800));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => callback(new Blob(["derived"], { type: "image/jpeg" })));
    const { pick } = setupPicker();
    pick("cover.jpg");
    await waitFor(() => expect(hiddenInput("derived-320")?.files?.length).toBe(1));
    pick(null);
    for (const width of [320, 640, 1280]) {
      expect(hiddenInput(`derived-${width}`)?.files?.length).toBe(0);
    }
  });

  it("入力エラーでは同じ選択を保持し、登録できたら下見と縮小版を解放する", async () => {
    vi.stubGlobal("createImageBitmap", async () => bitmap(800));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => callback(new Blob(["derived"], { type: "image/jpeg" })));
    const { pick, rerender } = setupPicker();
    pick("cover.jpg");
    await waitFor(() => expect(hiddenInput("derived-320")?.files?.length).toBe(1));
    const files = () => ["original", "derived-320", "derived-640"].map((name) => hiddenInput(name)?.files?.[0]);
    const selected = files();
    actionState = { status: "failed", message: "絵の説明を入れてください。", field: "altText" };
    rerender();
    const form = hiddenInput("original")!.form!;
    expect(fireEvent.reset(form)).toBe(false);
    expect(files()).toEqual(selected);
    expect(screen.getByText("絵の説明を入れてください。")).toBeTruthy();
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith("blob:cover.jpg");

    actionState = { status: "done", message: "表紙を登録しました。" };
    rerender();
    expect(fireEvent.reset(form)).toBe(true);
    expect(document.querySelector('img[src="blob:cover.jpg"]')).toBeNull();
    expect(hiddenInput("derived-320")?.files?.length).toBe(0);
    expect(hiddenInput("derived-640")?.files?.length).toBe(0);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:cover.jpg");
  });

  it("変換中に画面を離れても、遅れて届いた画像と下見の参照を解放する", async () => {
    let finish!: (image: ImageBitmap) => void;
    vi.stubGlobal("createImageBitmap", () => new Promise<ImageBitmap>((resolve) => { finish = resolve; }));
    const { pick, unmount } = setupPicker();
    pick("leaving.jpg");
    const image = bitmap(800);
    unmount();
    await act(async () => { finish(image); });
    expect(document.querySelector('img[src="blob:leaving.jpg"]')).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:leaving.jpg");
    expect(image.close).toHaveBeenCalled();
  });

  it("縮小の描画が失敗したときも画像の参照を解放し、原本で続けられる", async () => {
    const image = bitmap(800);
    vi.stubGlobal("createImageBitmap", async () => image);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => { throw new Error("canvas unavailable"); });
    const { pick } = setupPicker();
    pick("cover.jpg");
    await waitFor(() => expect(screen.getByText(/縮小版を作れませんでした/)).toBeTruthy());
    expect(image.close).toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "この絵を表紙にする" }) as HTMLButtonElement).disabled).toBe(false);
    expect(hiddenInput("original")?.files?.[0]?.name).toBe("cover.jpg");
  });
});

function hiddenInput(name: string): HTMLInputElement | null {
  return document.querySelector(`input[name="${name}"]`);
}

describe("まだ表紙が無い記事", () => {
  it("無いことを書き、外す釦は出さない", () => {
    render(<ArticleThumbnailForm articleId="a1" current={null} />);
    expect(screen.getByText(/まだ表紙がありません/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "表紙を外す" })).toBeNull();
  });

  it("登録の口は `set` を送る", () => {
    render(<ArticleThumbnailForm articleId="a1" current={null} />);
    expect(hiddenInput("intent")?.value).toBe("set");
    expect(hiddenInput("articleId")?.value).toBe("a1");
  });
});

describe("いま表紙が付いている記事", () => {
  it("絵と説明と、配っている幅を出す", () => {
    render(<ArticleThumbnailForm articleId="a1" current={A_THUMBNAIL} />);
    const image = screen.getByAltText(A_THUMBNAIL.altText);
    expect(image.getAttribute("src")).toBe(A_THUMBNAIL.href);
    // 幅と高さの無い img は、絵が届いた瞬間に下の文章を押し下げる。
    expect(image.getAttribute("width")).toBe("320");
    expect(image.getAttribute("height")).toBe("180");
    // 「作れる幅」の案内文にも同じ数字が並ぶので、**配っている方**を名指しで取る。
    expect(screen.getByText(/配っている幅: 320 \/ 640 \/ 1280/)).toBeTruthy();
  });

  it("縮小版が 1 枚も無いことを、幅の一覧の代わりに書く", () => {
    render(<ArticleThumbnailForm articleId="a1" current={{ ...A_THUMBNAIL, derivedWidths: [] }} />);
    expect(screen.getByText(/縮小版はありません/)).toBeTruthy();
  });

  it("外す口が出て、`remove` を送る", () => {
    render(<ArticleThumbnailForm articleId="a1" current={A_THUMBNAIL} />);
    expect(screen.getByRole("button", { name: "表紙を外す" })).toBeTruthy();
    const intents = Array.from(
      document.querySelectorAll<HTMLInputElement>('input[name="intent"]'),
    ).map((node) => node.value);
    expect(intents).toEqual(["set", "remove"]);
  });

  /** 説明文は前の値から書き直す。空欄に戻ると、押し直すたびに書き直しになる。 */
  it("いまの説明文が、書き直せる形で入っている", () => {
    render(<ArticleThumbnailForm articleId="a1" current={A_THUMBNAIL} />);
    expect(screen.getByLabelText(/絵の説明/).getAttribute("value")).toBe(A_THUMBNAIL.altText);
  });
});

describe("縮小版の運び方", () => {
  /**
   * 幅を名前に書く。`getAll("derived")` の並び順に頼る形へ戻すと、
   * 1 枚落ちた日に残りの対応が 1 つずつずれる。
   */
  it("幅ごとに別の名前の欄がある", () => {
    render(<ArticleThumbnailForm articleId="a1" current={null} />);
    const names = Array.from(
      document.querySelectorAll<HTMLInputElement>('input[type="file"]'),
    ).map((node) => node.name);
    expect(names).toEqual(["original", "derived-320", "derived-640", "derived-1280"]);
  });

  /** 隠した欄は、キーボードの巡回にも読み上げにも出さない。 */
  it("隠した欄は操作の順路に出てこない", () => {
    render(<ArticleThumbnailForm articleId="a1" current={null} />);
    for (const width of [320, 640, 1280]) {
      const node = hiddenInput(`derived-${String(width)}`);
      expect(node?.hidden).toBe(true);
      expect(node?.getAttribute("aria-hidden")).toBe("true");
      expect(node?.tabIndex).toBe(-1);
    }
  });

  /**
   * jsdom には `createImageBitmap` が無い。**この環境は、縮小版を作れない
   * ブラウザと同じ形をしている。**そのとき黙って原本だけを送ると、運営者は
   * 縮小版が作られたと思ったまま公開する。作れなかったことをその場に書く。
   */
  it("縮小版を作れない環境では、作れなかったと書く", async () => {
    const objectUrl = "blob:thumbnail-preview";
    vi.stubGlobal("URL", { ...URL, createObjectURL: () => objectUrl });
    render(<ArticleThumbnailForm articleId="a1" current={null} />);

    const picker = hiddenInput("original");
    expect(picker).not.toBeNull();
    fireEvent.change(picker as HTMLInputElement, {
      target: { files: [new File([new Uint8Array(8)], "cover.jpg", { type: "image/jpeg" })] },
    });

    await waitFor(() => {
      expect(screen.getByText(/縮小版を作れませんでした/)).toBeTruthy();
    });
    vi.unstubAllGlobals();
  });
});

describe("断られたときの出し方", () => {
  it.each([
    ["mimeType", "この形式の画像は置けません（image/jpeg / image/png / image/webp のいずれか）。"],
    ["original", "画像が大きすぎます（上限 8MB）。"],
  ])("%s が原因なら、絵を選ぶ欄のところに出す", (field, message) => {
    actionState = { status: "failed", message, field };
    render(<ArticleThumbnailForm articleId="a1" current={null} />);
    expect(screen.getAllByText(message).length).toBeGreaterThan(0);
  });

  /** 説明文が原因なら、説明文の欄に出す。画面の下だけに出すと、どの欄か分からない。 */
  it("説明文が原因なら、説明文の欄に出す", () => {
    actionState = { status: "failed", message: "絵の説明を入れてください。", field: "altText" };
    render(<ArticleThumbnailForm articleId="a1" current={null} />);
    expect(screen.getByLabelText(/絵の説明/).getAttribute("aria-invalid")).toBe("true");
    expect(screen.getAllByText("絵の説明を入れてください。").length).toBeGreaterThan(0);
  });

  /** 別の欄が原因のときに、説明文の欄へ巻き添えで赤を出さない。 */
  it("別の欄が原因なら、説明文の欄は無傷のまま", () => {
    actionState = { status: "failed", message: "画像を選んでください。", field: "original" };
    render(<ArticleThumbnailForm articleId="a1" current={null} />);
    expect(screen.getByLabelText(/絵の説明/).getAttribute("aria-invalid")).not.toBe("true");
  });
});

describe("使えるかどうか", () => {
  it.each([
    ["表紙あり", A_THUMBNAIL],
    ["表紙なし", null],
  ])("%s でも支障が無い", async (_label, current) => {
    const { container } = render(<ArticleThumbnailForm articleId="a1" current={current} />);
    const violations = await findA11yViolations(asPartOfPage(container.innerHTML));
    expect(violations, describeViolations(violations)).toHaveLength(0);
  });
});
