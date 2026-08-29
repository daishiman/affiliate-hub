/** @tier 1 */
import { describe, expect, it } from "vitest";
import type {
  ContactMessage,
  EditorialContactPort,
  EditorialReaderToolPort,
  EditorialShortlistPort,
  ReaderToolDefinition,
  ShortlistItem,
} from "@/application/ports/reader-interaction";
import {
  ANONYMOUS_READER_KEY,
  type ReaderInteractionDeps,
  createGetReaderToolUseCase,
  createListReaderToolsUseCase,
  createListShortlistUseCase,
  createRemoveFromShortlistUseCase,
  createRunReaderToolUseCase,
  createSaveToShortlistUseCase,
  createSubmitContactUseCase,
} from "@/application/usecases/site/reader-interaction";
import { domainError, err, markCommercial, markEditorial, ok } from "@/domain/shared";
import {
  createSampleContactSink,
  createSampleReaderToolRepository,
  createSampleShortlistRepository,
} from "@/infrastructure/persistence/sample/reader-interaction-sample";
import { anOutsider } from "../support/actors";
import { NOW } from "../support/clock";

/**
 * 読者が自分で操作するもの（気になる商品・診断の道具・問い合わせ）。
 *
 * --- ここで固定したいこと ---
 * 1. **ログインしていない人の保存先が、他の人と混ざらないこと。**
 *    合言葉を渡さなかったときに何を使うかが揺れると、
 *    「保存したのに消えた」「知らない商品が入っている」が起きる。
 * 2. **報酬に関わる保存先を、読者向けの操作に渡せないこと。**
 *    渡せてしまうと「気になる商品を報酬の高い順に並べる」が書けてしまう。
 *    ここは動いてから直すのではなく、組み立てた時点で止める。
 * 3. **できないことを、できたように見せないこと。**
 *    計算式が未登録なら数字を出さない。送信先が未設定なら「送信しました」と出さない。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §3-2（口の差し替えで確かめる）
 */

const AT = NOW.toISOString();

function anItem(over: Partial<ShortlistItem> = {}): ShortlistItem {
  return {
    productId: "prd_lens_50",
    productName: "標準レンズ 50mm",
    savedAt: AT,
    ...over,
  };
}

/** 呼ばれたときの引数だけを残す保存先。何回呼ばれたかは見ない。 */
function memoryShortlist() {
  const rows = new Map<string, ShortlistItem[]>();
  const keysSeen: string[] = [];
  const port = markEditorial({
    async list(siteSlug: string, readerKey: string) {
      keysSeen.push(readerKey);
      return ok(rows.get(`${siteSlug}::${readerKey}`) ?? []);
    },
    async add(siteSlug: string, readerKey: string, item: ShortlistItem) {
      keysSeen.push(readerKey);
      const k = `${siteSlug}::${readerKey}`;
      rows.set(k, [...(rows.get(k) ?? []), item]);
      return ok(true as const);
    },
    async remove(siteSlug: string, readerKey: string, productId: string) {
      keysSeen.push(readerKey);
      const k = `${siteSlug}::${readerKey}`;
      rows.set(k, (rows.get(k) ?? []).filter((i) => i.productId !== productId));
      return ok(true as const);
    },
  }) as EditorialShortlistPort;
  return { port, rows, keysSeen };
}

const A_TOOL: ReaderToolDefinition = {
  slug: "desk-fit",
  name: "机と椅子の高さの目安",
  purpose: "身長と机の高さから、椅子の座面をどこに合わせればよいかを出す。",
  inputs: [
    { key: "height", label: "身長", unit: "cm" },
    { key: "desk_height", label: "いま使っている机の高さ", unit: "cm" },
  ],
  howToRead: "座って肘が90度になるかを確かめ、合わなければ1cmずつ動かします。",
};

function toolPort(over: Partial<ReaderToolPortShape> = {}): EditorialReaderToolPort {
  return markEditorial({
    async find() {
      return ok(A_TOOL as ReaderToolDefinition | null);
    },
    async list() {
      return ok([A_TOOL]);
    },
    async run() {
      return ok({ summary: "座面はおよそ43cm", rows: [{ label: "座面の高さ", value: "43cm" }] });
    },
    ...over,
  }) as EditorialReaderToolPort;
}
type ReaderToolPortShape = {
  find: () => unknown;
  list: () => unknown;
  run: () => unknown;
};

function contactPort(
  onSubmit: (m: ContactMessage) => unknown = () => ok({ receiptId: "rc_0001" }),
): EditorialContactPort {
  return markEditorial({
    async submit(message: ContactMessage) {
      return onSubmit(message);
    },
  }) as EditorialContactPort;
}

function readerDeps(over: Partial<ReaderInteractionDeps> = {}): ReaderInteractionDeps {
  return {
    shortlist: memoryShortlist().port,
    readerTools: toolPort(),
    contact: contactPort(),
    ...over,
  };
}

/** 読者は誰でもよい。権限を持たない人でも同じように使える、が正しい姿。 */
const reader = anOutsider();

describe("読者向けの操作に渡してよい保存先", () => {
  it.each([
    ["気になる商品", createListShortlistUseCase],
    ["保存する", createSaveToShortlistUseCase],
    ["外す", createRemoveFromShortlistUseCase],
    ["道具を 1 つ取る", createGetReaderToolUseCase],
    ["道具の一覧", createListReaderToolsUseCase],
    ["道具を動かす", createRunReaderToolUseCase],
    ["問い合わせ", createSubmitContactUseCase],
  ])("%s: 報酬に関わる保存先が混ざっていたら、組み立てた時点で止まる", (_name, create) => {
    const deps = readerDeps({
      shortlist: markCommercial({
        async list() {
          return ok([]);
        },
        async add() {
          return ok(true as const);
        },
        async remove() {
          return ok(true as const);
        },
      }) as unknown as EditorialShortlistPort,
    });
    expect(() => (create as (d: ReaderInteractionDeps) => unknown)(deps)).toThrow(/報酬/);
  });

  it("止まったときに、どの保存先が原因かが分かる", () => {
    const deps = readerDeps({
      contact: markCommercial({
        async submit() {
          return ok({ receiptId: "x" });
        },
      }) as unknown as EditorialContactPort,
    });
    expect(() => createSubmitContactUseCase(deps)).toThrow(/contact/);
  });
});

describe("気になる商品", () => {
  it("合言葉を渡さないときは、名前を持たない読者ぶんとして扱う", async () => {
    const store = memoryShortlist();
    const deps = readerDeps({ shortlist: store.port });

    await createSaveToShortlistUseCase(deps).execute(reader, {
      siteSlug: "home-office-desk",
      item: anItem(),
    });
    const listed = await createListShortlistUseCase(deps).execute(reader, {
      siteSlug: "home-office-desk",
    });

    expect(store.keysSeen).toContain(ANONYMOUS_READER_KEY);
    expect(listed.ok && listed.value.map((i) => i.productId)).toEqual(["prd_lens_50"]);
  });

  it("合言葉が違う読者どうしで、保存したものが混ざらない", async () => {
    const store = memoryShortlist();
    const deps = readerDeps({ shortlist: store.port });
    const save = createSaveToShortlistUseCase(deps);
    const list = createListShortlistUseCase(deps);

    await save.execute(reader, { siteSlug: "home-office-desk", readerKey: "rk_a", item: anItem() });

    const other = await list.execute(reader, { siteSlug: "home-office-desk", readerKey: "rk_b" });
    expect(other.ok && other.value).toEqual([]);

    const mine = await list.execute(reader, { siteSlug: "home-office-desk", readerKey: "rk_a" });
    expect(mine.ok && mine.value).toHaveLength(1);
  });

  it("同じ合言葉でもブログが違えば混ざらない", async () => {
    const store = memoryShortlist();
    const deps = readerDeps({ shortlist: store.port });
    await createSaveToShortlistUseCase(deps).execute(reader, {
      siteSlug: "home-office-desk",
      readerKey: "rk_a",
      item: anItem(),
    });
    const otherSite = await createListShortlistUseCase(deps).execute(reader, {
      siteSlug: "camera-bags",
      readerKey: "rk_a",
    });
    expect(otherSite.ok && otherSite.value).toEqual([]);
  });

  it("商品が指定されていないときは、保存したことにしない", async () => {
    const store = memoryShortlist();
    const result = await createSaveToShortlistUseCase(readerDeps({ shortlist: store.port })).execute(
      reader,
      { siteSlug: "home-office-desk", item: anItem({ productId: "" }) },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("VALIDATION_FAILED");
    expect(result.error.field).toBe("productId");
    // どこを押せばよいかまで言う。「保存できません」だけでは直せない。
    expect(result.error.suggestedAction).toContain("気になる");
    expect(store.rows.size).toBe(0);
  });

  it.each(["   ", "\t", "\n"])("空白だけ (%j) の指定も、保存したことにしない", async (id) => {
    const result = await createSaveToShortlistUseCase(readerDeps()).execute(reader, {
      siteSlug: "home-office-desk",
      item: anItem({ productId: id }),
    });
    expect(result.ok).toBe(false);
  });

  it("外したものは一覧から消える", async () => {
    const store = memoryShortlist();
    const deps = readerDeps({ shortlist: store.port });
    await createSaveToShortlistUseCase(deps).execute(reader, {
      siteSlug: "home-office-desk",
      item: anItem(),
    });
    await createSaveToShortlistUseCase(deps).execute(reader, {
      siteSlug: "home-office-desk",
      item: anItem({ productId: "prd_bag", productName: "カメラバッグ" }),
    });
    await createRemoveFromShortlistUseCase(deps).execute(reader, {
      siteSlug: "home-office-desk",
      productId: "prd_lens_50",
    });

    const listed = await createListShortlistUseCase(deps).execute(reader, {
      siteSlug: "home-office-desk",
    });
    expect(listed.ok && listed.value.map((i) => i.productId)).toEqual(["prd_bag"]);
  });

  it("保存していないものを外そうとしても、失敗にしない", async () => {
    const result = await createRemoveFromShortlistUseCase(readerDeps()).execute(reader, {
      siteSlug: "home-office-desk",
      productId: "prd_unknown",
    });
    // 読者から見て「もう入っていない」が望みなので、既に無いことは成功。
    expect(result.ok).toBe(true);
  });

  it("保存先が読めないときは、空の一覧に見せず、そのまま失敗を返す", async () => {
    const broken = markEditorial({
      async list() {
        return err(domainError("UPSTREAM_UNAVAILABLE", "保存先に接続できません。"));
      },
      async add() {
        return ok(true as const);
      },
      async remove() {
        return ok(true as const);
      },
    }) as EditorialShortlistPort;

    const result = await createListShortlistUseCase(readerDeps({ shortlist: broken })).execute(
      reader,
      { siteSlug: "home-office-desk" },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("UPSTREAM_UNAVAILABLE");
  });
});

describe("診断・計算の道具", () => {
  it("無い道具を指したときは、白紙ではなく見つからないと返す", async () => {
    const result = await createGetReaderToolUseCase(
      readerDeps({ readerTools: toolPort({ find: async () => ok(null) }) }),
    ).execute(reader, { siteSlug: "home-office-desk", slug: "no-such-tool" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NOT_FOUND");
    expect(result.error.suggestedAction).toContain("トップ");
  });

  it("ある道具は、入力欄と結果の読み方まで一緒に返す", async () => {
    const result = await createGetReaderToolUseCase(readerDeps()).execute(reader, {
      siteSlug: "home-office-desk",
      slug: "desk-fit",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.inputs.length).toBeGreaterThan(0);
    // 数字だけ出して解釈を読者任せにしない。
    expect(result.value.howToRead.length).toBeGreaterThan(5);
  });

  it("取り出しに失敗したときは、見つからないと言い換えない", async () => {
    const result = await createGetReaderToolUseCase(
      readerDeps({
        readerTools: toolPort({
          find: async () => err(domainError("UPSTREAM_UNAVAILABLE", "取得できません。")),
        }),
      }),
    ).execute(reader, { siteSlug: "home-office-desk", slug: "desk-fit" });

    expect(result.ok).toBe(false);
    // 「無い」と「取れない」を同じ顔にすると、直し方が変わるのに気づけない。
    if (!result.ok) expect(result.error.code).toBe("UPSTREAM_UNAVAILABLE");
  });

  it("一覧は、保存側が返したものをそのまま渡す", async () => {
    const result = await createListReaderToolsUseCase(readerDeps()).execute(reader, {
      siteSlug: "home-office-desk",
    });
    expect(result.ok && result.value.map((t) => t.slug)).toEqual(["desk-fit"]);
  });

  it("動かした結果は、要約と内訳の両方を返す", async () => {
    const result = await createRunReaderToolUseCase(readerDeps()).execute(reader, {
      siteSlug: "home-office-desk",
      slug: "desk-fit",
      values: { height: "170", desk_height: "72" },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.summary).toContain("43cm");
    expect(result.value.rows).toHaveLength(1);
  });
});

describe("問い合わせ", () => {
  it("本文が空のときは送らない", async () => {
    let called = false;
    const result = await createSubmitContactUseCase(
      readerDeps({
        contact: contactPort(() => {
          called = true;
          return ok({ receiptId: "rc" });
        }),
      }),
    ).execute(reader, { siteSlug: "home-office-desk", body: "" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.field).toBe("body");
    expect(result.error.suggestedAction).toContain("内容");
    // 「送信しました」と出したのに中身が無い、を作らない。
    expect(called).toBe(false);
  });

  it.each(["   ", "\n\n", "\t "])("空白だけ (%j) も送らない", async (body) => {
    const result = await createSubmitContactUseCase(readerDeps()).execute(reader, {
      siteSlug: "home-office-desk",
      body,
    });
    expect(result.ok).toBe(false);
  });

  it("返信先を書かなくても送れる", async () => {
    let received: ContactMessage | null = null;
    const result = await createSubmitContactUseCase(
      readerDeps({
        contact: contactPort((m) => {
          received = m;
          return ok({ receiptId: "rc_0001" });
        }),
      }),
    ).execute(reader, { siteSlug: "home-office-desk", body: "記事の型番が古いようです。" });

    expect(result.ok && result.value.receiptId).toBe("rc_0001");
    expect(received).not.toBeNull();
    expect((received as unknown as ContactMessage).replyTo).toBeUndefined();
  });

  it("書かれた本文と返信先を、加工せずに渡す", async () => {
    let received: ContactMessage | null = null;
    await createSubmitContactUseCase(
      readerDeps({
        contact: contactPort((m) => {
          received = m;
          return ok({ receiptId: "rc" });
        }),
      }),
    ).execute(reader, {
      siteSlug: "home-office-desk",
      body: "  前後に空白のある本文  ",
      replyTo: "reader@example.com",
      humanCheckToken: "tok_abc",
    });

    const got = received as unknown as ContactMessage;
    expect(got.body).toBe("  前後に空白のある本文  ");
    expect(got.replyTo).toBe("reader@example.com");
    expect(got.humanCheckToken).toBe("tok_abc");
  });

  it("送信先の設定が済んでいないときは、受け付けたことにしない", async () => {
    const result = await createSubmitContactUseCase(
      readerDeps({
        contact: contactPort(() =>
          err(domainError("NOT_IMPLEMENTED", "送信先が未設定です。")),
        ),
      }),
    ).execute(reader, { siteSlug: "home-office-desk", body: "問い合わせ本文" });

    expect(result.ok).toBe(false);
  });
});

/**
 * 仮置きの見本（スタブ）そのものの振る舞い。
 *
 * ここを確かめるのは、**見本が「できたふり」をしていないこと**を固定するため。
 * 数字を返し始めたら、それは本物になったという合図であり、
 * このテストが落ちて気づける。
 */
describe("仮置きの見本", () => {
  it("同じ商品を 2 回保存しても、一覧では 1 件になる", async () => {
    const port = createSampleShortlistRepository();
    await port.add("home-office-desk", "rk_dup", anItem());
    await port.add("home-office-desk", "rk_dup", anItem({ productName: "標準レンズ 50mm（改）" }));

    const listed = await port.list("home-office-desk", "rk_dup");
    expect(listed.ok && listed.value).toHaveLength(1);
    // 後から押した方が残る（読者が見ているのは最新の記事）。
    expect(listed.ok && listed.value[0]?.productName).toContain("改");
  });

  it("一度も保存していない読者には、空の一覧を返す（失敗にしない）", async () => {
    const port = createSampleShortlistRepository();
    const listed = await port.list("home-office-desk", "rk_new");
    expect(listed.ok && listed.value).toEqual([]);
  });

  it("外した結果は残る", async () => {
    const port = createSampleShortlistRepository();
    await port.add("home-office-desk", "rk_rm", anItem());
    await port.remove("home-office-desk", "rk_rm", "prd_lens_50");
    const listed = await port.list("home-office-desk", "rk_rm");
    expect(listed.ok && listed.value).toEqual([]);
  });

  it("見本の道具は、名前で引けて、知らない名前では null を返す", async () => {
    const port = createSampleReaderToolRepository();
    const found = await port.find("home-office-desk", "desk-fit");
    expect(found.ok && found.value?.name).toContain("机と椅子");

    const missing = await port.find("home-office-desk", "no-such");
    expect(missing.ok && missing.value).toBeNull();
  });

  it("見本の道具は、計算だけは動かない（でっち上げた数字を出さない）", async () => {
    const port = createSampleReaderToolRepository();
    const run = await port.run("home-office-desk", "desk-fit", {
      height: "170",
      desk_height: "72",
      shoe: "いいえ",
    });
    expect(run.ok).toBe(false);
    if (run.ok) return;
    expect(run.error.code).toBe("NOT_IMPLEMENTED");
    // 読者が読んで、いつ使えるようになるかが分かる文にする。
    expect(run.error.suggestedAction).toContain("登録");
    expect(run.error.retryable).toBe(false);
  });

  it("見本の問い合わせは、送ったことにせず、別の連絡先を案内する", async () => {
    const port = createSampleContactSink();
    const sent = await port.submit({ siteSlug: "home-office-desk", body: "本文" });
    expect(sent.ok).toBe(false);
    if (sent.ok) return;
    expect(sent.error.code).toBe("NOT_IMPLEMENTED");
    expect(sent.error.suggestedAction).toContain("home-office-desk");
  });
});
