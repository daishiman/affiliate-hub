/**
 * @tier 2
 * @req REQ-SEO13
 * @types boundary, state-transition
 */
import { afterEach, describe, expect, it, vi } from "vitest";
const { signedInActor, seoMeasurementUseCases, execute, revalidatePath } = vi.hoisted(() => ({
  signedInActor: vi.fn(), seoMeasurementUseCases: vi.fn(), execute: vi.fn(), revalidatePath: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/presentation/composition", () => ({ signedInActor, seoMeasurementUseCases }));
import { applySeoRevisionAction, setSeoCitationMonthlyLimitAction } from "@/presentation/admin/observe/seo-aeo-action";

const initial = { status: "idle" as const, message: "" };
function input() {
  const data = new FormData();
  data.set("siteSlug", "blog"); data.set("articleSlug", "article-a"); data.set("approvalToken", "confirmed-diff");
  return data;
}
afterEach(() => vi.resetAllMocks());

describe("SEO差分反映のServer Action境界", () => {
  it("記事と確認トークンだけを渡し、送り込まれた本文や一括対象を採用しない", async () => {
    const actor = { workspaceId: "workspace-a" };
    signedInActor.mockResolvedValue(actor);
    seoMeasurementUseCases.mockResolvedValue({ manage: { execute } });
    execute.mockResolvedValue({ ok: true, value: { action: "apply", entry: { id: "history-a" } } });
    const data = input(); data.set("limit", "500"); data.set("articleJson", "untrusted body");
    const result = await applySeoRevisionAction(initial, data);
    expect(execute).toHaveBeenCalledWith(actor, { action: "apply", siteSlug: "blog", articleSlug: "article-a", approvalToken: "confirmed-diff" });
    expect(result).toEqual({ status: "done", message: "確認した差分をこの記事に反映しました。反映の記録から取り消せます。" });
    expect(revalidatePath.mock.calls).toEqual([
      ["/admin/seo"], ["/s/[site]", "layout"], ["/admin/content/published"],
      ["/admin/content/published/[site]/[slug]/edit", "page"], ["/admin/blog/articles"], ["/admin/blog/articles/[article]", "page"],
    ]);
  });

  it("対象や確認トークンのない一括実行要求では、保存口を呼ばない", async () => {
    const data = input(); data.delete("articleSlug"); data.delete("approvalToken");
    const result = await applySeoRevisionAction(initial, data);
    expect(result.status).toBe("failed");
    expect(result.message).toContain("対象の記事と差分を確認");
    expect(execute).not.toHaveBeenCalled();
  });

  it("ログインを確かめられないときは書換の口へ進まない", async () => {
    signedInActor.mockResolvedValue(null);
    const result = await applySeoRevisionAction(initial, input());
    expect(result.status).toBe("failed");
    expect(result.message).toContain("ログイン");
    expect(seoMeasurementUseCases).not.toHaveBeenCalled();
  });

  it("競合の断りを成功へ変えず、読み直すまで確認中の差分を残す", async () => {
    signedInActor.mockResolvedValue({ workspaceId: "workspace-a" });
    seoMeasurementUseCases.mockResolvedValue({ manage: { execute } });
    execute.mockResolvedValue({ ok: false, error: { code: "CONFLICT", message: "別の編集があるため反映しませんでした。", retryable: true } });
    const result = await applySeoRevisionAction(initial, input());
    expect(result).toMatchObject({ status: "failed", message: "別の編集があるため反映しませんでした。" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("AI検索の月次上限Server Action境界", () => {
  it("作業場所IDをフォームから受けず、本人の作業場所へ整数の上限だけを渡す", async () => {
    const actor = { workspaceId: "workspace-a" };
    signedInActor.mockResolvedValue(actor);
    seoMeasurementUseCases.mockResolvedValue({ manage: { execute } });
    execute.mockResolvedValue({ ok: true, value: { action: "set_citation_monthly_limit", limit: 120 } });
    const data = new FormData(); data.set("limit", "120"); data.set("workspaceId", "workspace-foreign");
    const result = await setSeoCitationMonthlyLimitAction(initial, data);
    expect(execute).toHaveBeenCalledWith(actor, { action: "set_citation_monthly_limit", limit: 120 });
    expect(result.status).toBe("done");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/seo");
  });

  it.each(["", "-1", "1.5", "01", "100001"])("不正な上限%sは認証や保存へ進めない", async (value) => {
    const data = new FormData(); data.set("limit", value);
    const result = await setSeoCitationMonthlyLimitAction(initial, data);
    expect(result).toMatchObject({ status: "failed", field: "limit" });
    expect(signedInActor).not.toHaveBeenCalled();
  });
});
