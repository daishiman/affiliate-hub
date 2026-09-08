/**
 * @tier 1
 * @req REQ-BOPS01, REQ-BOPS02, REQ-BOPS03, REQ-BOPS04, REQ-BOPS05, REQ-BOPS08
 * @types boundary, decision-table
 *
 * ブログ管理の Server Action は、画面が送る値を信用しない。
 * 知らない操作を別の操作へ寄せたり、壊れた部品行を黙って捨てたりしないことを固定する。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { ARTICLE_BLOCK_KINDS, ARTICLE_TEMPLATES } from "@/domain/blogops";
import {
  parseArticleBlocksOrFailure,
  parseCheckboxWithMarkerOrFailure,
  parseEnumOrFailure,
  parseFiniteIntegerOrFailure,
  parseIntentOrFailure,
  parsePresentTextOrFailure,
} from "@/presentation/admin/publish/blog-action-input";
import {
  manageBlogLayoutAction,
} from "@/presentation/admin/publish/blog-layout-action";
import { manageBlogArticleAction } from "@/presentation/admin/publish/blog-article-action";
import { INITIAL_BLOG_OPS_STATE } from "@/presentation/admin/publish/blog-ops-state";
import { manageSiteNetworkAction } from "@/presentation/admin/publish/site-network-action";

const actionDoubles = vi.hoisted(() => ({
  saveLayoutBand: vi.fn(async () => ({ ok: true as const, value: true as const })),
  saveLayoutSlot: vi.fn(async () => ({ ok: true as const, value: true as const })),
  updateNetworkNode: vi.fn(async () => ({
    ok: true as const,
    value: {
      nodeId: "snn_owned",
      siteSlug: "owned-blog",
      changed: [] as readonly string[],
    },
  })),
  createNetworkNode: vi.fn(async () => ({
    ok: true as const,
    value: { nodeId: "snn_created", siteSlug: "owned-blog", name: "運営ブログ" },
  })),
  deleteNetworkNode: vi.fn(async () => ({
    ok: true as const,
    value: {
      nodeId: "snn_owned",
      siteSlug: "owned-blog",
      name: "運営ブログ",
    },
  })),
  restoreNetworkNode: vi.fn(async () => ({
    ok: true as const,
    value: { nodeId: "snn_owned", siteSlug: "owned-blog", name: "運営ブログ" },
  })),
  restoreArticle: vi.fn(async () => ({
    ok: true as const,
    value: {
      articleId: "bar_owned",
      siteSlug: "owned-blog",
      slug: "owned-article",
      title: "戻す記事",
    },
  })),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/presentation/composition", () => ({
  signedInActor: vi.fn(async () => ({ workspaceId: "ws_action_test", role: "owner" })),
  blogOpsEntry: vi.fn(async () => ({
    ready: true as const,
    saveLayoutBand: { execute: actionDoubles.saveLayoutBand },
    saveLayoutSlot: { execute: actionDoubles.saveLayoutSlot },
    updateNetworkNode: { execute: actionDoubles.updateNetworkNode },
    createNetworkNode: { execute: actionDoubles.createNetworkNode },
    deleteNetworkNode: { execute: actionDoubles.deleteNetworkNode },
    restoreNetworkNode: { execute: actionDoubles.restoreNetworkNode },
    restoreArticle: { execute: actionDoubles.restoreArticle },
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ブログ管理の操作指定", () => {
  it("知っている操作だけを受け取る", () => {
    const parsed = parseIntentOrFailure("update", ["create", "update", "delete"] as const);

    expect(parsed).toEqual({ ok: true, value: "update" });
  });

  it("削除済みサイト網の restore を別 intent へ寄せず復元口へ渡す", async () => {
    const data = new FormData();
    data.set("intent", "restore");
    data.set("nodeId", "snn_owned");

    const result = await manageSiteNetworkAction(INITIAL_BLOG_OPS_STATE, data);

    expect(result.status).toBe("done");
    expect(actionDoubles.restoreNetworkNode).toHaveBeenCalledWith(
      expect.anything(),
      { nodeId: "snn_owned" },
    );
    expect(actionDoubles.updateNetworkNode).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/s/owned-blog", "layout");
  });

  it("削除済み記事の restore を別 intent へ寄せず復元口へ渡す", async () => {
    const data = new FormData();
    data.set("intent", "restore");
    data.set("articleId", "bar_owned");

    const result = await manageBlogArticleAction(INITIAL_BLOG_OPS_STATE, data);

    expect(result.status).toBe("done");
    expect(actionDoubles.restoreArticle).toHaveBeenCalledWith(
      expect.anything(),
      { articleId: "bar_owned" },
    );
  });

  it("知らない操作を作成や保存に変換せず、操作欄の失敗として返す", () => {
    const parsed = parseIntentOrFailure("unknown", ["create", "update", "delete"] as const);

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.failure).toMatchObject({ status: "failed", field: "intent" });
    expect(parsed.failure.message.trim()).not.toBe("");
  });
});

describe("サイト網変更後の公開 route 失効", () => {
  it.each([
    {
      label: "作成",
      intent: "create",
      fields: {
        siteSlug: "owned-blog",
        role: "hub",
        parentSlug: "",
        name: "運営ブログ",
        oneLine: "",
      },
    },
    {
      label: "更新",
      intent: "update",
      fields: {
        nodeId: "snn_owned",
        parentSlug: "",
        name: "運営ブログ",
        oneLine: "",
        position: "0",
        status: "active",
      },
    },
    {
      label: "削除",
      intent: "delete",
      fields: { nodeId: "snn_owned", reason: "統合したため" },
    },
  ])("$labelで記事を含む子 route 全体を失効する", async ({ intent, fields }) => {
    const data = new FormData();
    data.set("intent", intent);
    for (const [name, value] of Object.entries(fields)) data.set(name, value);

    const result = await manageSiteNetworkAction(INITIAL_BLOG_OPS_STATE, data);

    expect(result.status).toBe("done");
    expect(revalidatePath).toHaveBeenCalledWith("/s/owned-blog", "layout");
  });
});

describe("ブログ管理の列挙値", () => {
  it("知らない版面を T1 へ寄せない", () => {
    const parsed = parseEnumOrFailure("T9", ARTICLE_TEMPLATES, {
      field: "template",
      label: "記事の版面",
    });

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.failure).toMatchObject({ status: "failed", field: "template" });
  });
});

describe("記事部品の行", () => {
  it("途中の番号が欠けたら、後ろの行を捨てずに断る", () => {
    const data = new FormData();
    data.set("blocks[0].kind", "body");
    data.set("blocks[0].body", "最初の本文");
    data.set("blocks[2].kind", "summary");
    data.set("blocks[2].body", "最後のまとめ");

    const parsed = parseArticleBlocksOrFailure(data, ARTICLE_BLOCK_KINDS);

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.failure.status).toBe("failed");
    expect(parsed.failure.field).toBe("blocks[1].kind");
  });

  it("知らない部品の種類を黙って読み飛ばさない", () => {
    const data = new FormData();
    data.set("blocks[0].kind", "unknown-block");
    data.set("blocks[0].body", "本文");

    const parsed = parseArticleBlocksOrFailure(data, ARTICLE_BLOCK_KINDS);

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.failure.field).toBe("blocks[0].kind");
  });
});

describe("mutation Action の必須入力", () => {
  it("帯の itemLimit が無いとき、0 とみなさず断る", async () => {
    const data = new FormData();
    data.set("intent", "band");
    data.set("siteSlug", "owned-blog");
    data.set("band", "latest_posts");
    data.set("position", "0");
    data.set("enabledPresent", "1");

    const result = await manageBlogLayoutAction(INITIAL_BLOG_OPS_STATE, data);

    expect(result).toMatchObject({ status: "failed", field: "itemLimit" });
    expect(actionDoubles.saveLayoutBand).not.toHaveBeenCalled();
  });

  it("数でない position を NaN のまま渡さない", async () => {
    const data = new FormData();
    data.set("intent", "slot");
    data.set("siteSlug", "owned-blog");
    data.set("region", "header");
    data.set("slotKey", "global-nav");
    data.set("position", "not-a-number");
    data.set("enabledPresent", "1");

    const result = await manageBlogLayoutAction(INITIAL_BLOG_OPS_STATE, data);

    expect(result).toMatchObject({ status: "failed", field: "position" });
    expect(actionDoubles.saveLayoutSlot).not.toHaveBeenCalled();
  });

  it("parentSlug 欄そのものが無いとき、「親なし」とみなさない", async () => {
    const data = new FormData();
    data.set("intent", "update");
    data.set("nodeId", "snn_owned");
    data.set("name", "運営ブログ");
    data.set("oneLine", "");
    data.set("position", "0");
    data.set("status", "active");

    const result = await manageSiteNetworkAction(INITIAL_BLOG_OPS_STATE, data);

    expect(result).toMatchObject({ status: "failed", field: "parentSlug" });
    expect(actionDoubles.updateNetworkNode).not.toHaveBeenCalled();
  });

  it("サイト網の数でない position も保存口へ渡さない", async () => {
    const data = new FormData();
    data.set("intent", "update");
    data.set("nodeId", "snn_owned");
    data.set("parentSlug", "");
    data.set("name", "運営ブログ");
    data.set("oneLine", "");
    data.set("position", "not-a-number");
    data.set("status", "active");

    const result = await manageSiteNetworkAction(INITIAL_BLOG_OPS_STATE, data);

    expect(result).toMatchObject({ status: "failed", field: "position" });
    expect(actionDoubles.updateNetworkNode).not.toHaveBeenCalled();
  });

  it("enabled の存在markerが無いとき、unchecked とみなさない", async () => {
    const data = new FormData();
    data.set("intent", "slot");
    data.set("siteSlug", "owned-blog");
    data.set("region", "header");
    data.set("slotKey", "global-nav");
    data.set("position", "0");

    const result = await manageBlogLayoutAction(INITIAL_BLOG_OPS_STATE, data);

    expect(result).toMatchObject({ status: "failed", field: "enabled" });
    expect(actionDoubles.saveLayoutSlot).not.toHaveBeenCalled();
  });

  it("存在marker付きの unchecked と、空の parentSlug 欄は正常値として受け取る", async () => {
    const slot = new FormData();
    slot.set("intent", "slot");
    slot.set("siteSlug", "owned-blog");
    slot.set("region", "header");
    slot.set("slotKey", "global-nav");
    slot.set("position", "0");
    slot.set("enabledPresent", "1");

    const network = new FormData();
    network.set("intent", "update");
    network.set("nodeId", "snn_owned");
    network.set("parentSlug", "");
    network.set("name", "運営ブログ");
    network.set("oneLine", "");
    network.set("position", "0");
    network.set("status", "active");

    const slotResult = await manageBlogLayoutAction(INITIAL_BLOG_OPS_STATE, slot);
    const networkResult = await manageSiteNetworkAction(INITIAL_BLOG_OPS_STATE, network);

    expect(slotResult.status).toBe("done");
    expect(networkResult.status).toBe("done");
    expect(actionDoubles.saveLayoutSlot).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ enabled: false, position: 0 }),
    );
    expect(actionDoubles.updateNetworkNode).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ parentSlug: null, position: 0 }),
    );
  });
});

describe("数値・存在・checkbox marker の共通parser", () => {
  it("有限整数だけを受け取る", () => {
    const valid = new FormData();
    valid.set("position", "-2");
    const invalid = new FormData();
    invalid.set("position", "Infinity");

    expect(
      parseFiniteIntegerOrFailure(valid, { field: "position", label: "並び順" }),
    ).toEqual({ ok: true, value: -2 });
    expect(
      parseFiniteIntegerOrFailure(invalid, { field: "position", label: "並び順" }).ok,
    ).toBe(false);
  });

  it("空文字は値として受け取るが、欄自体の欠落は断る", () => {
    const present = new FormData();
    present.set("parentSlug", "");

    expect(
      parsePresentTextOrFailure(present, { field: "parentSlug", label: "親のブログ" }),
    ).toEqual({ ok: true, value: "" });
    expect(
      parsePresentTextOrFailure(new FormData(), {
        field: "parentSlug",
        label: "親のブログ",
      }).ok,
    ).toBe(false);
  });

  it("markerがあるuncheckedをfalse、checkedをtrueとし、marker欠落は断る", () => {
    const unchecked = new FormData();
    unchecked.set("enabledPresent", "1");
    const checked = new FormData();
    checked.set("enabledPresent", "1");
    checked.set("enabled", "on");

    const options = {
      field: "enabled",
      markerField: "enabledPresent",
      label: "表示設定",
    } as const;
    expect(parseCheckboxWithMarkerOrFailure(unchecked, options)).toEqual({
      ok: true,
      value: false,
    });
    expect(parseCheckboxWithMarkerOrFailure(checked, options)).toEqual({
      ok: true,
      value: true,
    });
    expect(parseCheckboxWithMarkerOrFailure(new FormData(), options).ok).toBe(false);
  });
});
