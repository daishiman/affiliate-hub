/** @tier 1 */
import { describe, expect, it } from "vitest";
import type { GuidelineReferencePort } from "@/application/ports/guideline-reference";
import { createManageGuidelineReferencesUseCase } from "@/application/usecases/seo/manage-guideline-references";
import {
  INITIAL_GUIDELINE_REFERENCES,
  type GuidelineReference,
} from "@/domain/seo/guideline-reference";
import { asWorkspaceId, ok } from "@/domain/shared";
import type { ActorContext, WorkspaceId } from "@/domain/shared";

/**
 * SEO/AI 指針の出典レジストリ (feat-blog-ui-builder 受入条件 5)。
 *
 * 見ているのは 4 つ。
 * ①権限の無い人が登録できない ②90 日ちょうどは fresh、超えたら再確認
 * ③初期候補は一覧に出るが、開いただけでは保存されない ④入力の検査が欄名まで返す。
 *
 * @req REQ-SEC01
 * @types permission-matrix, boundary
 */

const WS = asWorkspaceId("ws_a") as WorkspaceId;

const actor = (role: string): ActorContext =>
  ({
    workspaceId: WS,
    userId: "u_1",
    roles: [role],
    isAiServiceAccount: false,
  }) as unknown as ActorContext;

function ref(over: Partial<GuidelineReference> = {}): GuidelineReference {
  return {
    id: "gr_1",
    title: "AI features and your website",
    url: "https://developers.google.com/search/docs/appearance/ai-features",
    publisher: "Google Search Central",
    region: "global",
    checkedAt: "2026-08-01",
    ...over,
  };
}

/** 呼ばれた事実を数える偽ポート。保存の副作用をここで観測する。 */
function fakePort(stored: readonly GuidelineReference[] = []) {
  const calls = { add: 0, updateCheckedAt: 0 };
  const port: GuidelineReferencePort = {
    async list() {
      return ok(stored);
    },
    async add(input) {
      calls.add += 1;
      return ok(input.reference);
    },
    async updateCheckedAt(input) {
      calls.updateCheckedAt += 1;
      return ok({ ...ref(), id: input.id, checkedAt: input.checkedAt });
    },
  };
  return { port, calls };
}

function usecase(stored: readonly GuidelineReference[] = [], today = "2026-08-24") {
  const { port, calls } = fakePort(stored);
  const manage = createManageGuidelineReferencesUseCase({
    references: port,
    ids: { newId: () => "id_1" },
    now: () => new Date(`${today}T00:00:00Z`),
  });
  return { manage, calls };
}

describe("権限", () => {
  it("閲覧権限だけの analyst は一覧を読めるが登録はできない", async () => {
    const { manage } = usecase();
    const listed = await manage.execute(actor("analyst"), { action: "list" });
    expect(listed.ok).toBe(true);

    const added = await manage.execute(actor("analyst"), {
      action: "add",
      title: "t",
      url: "https://example.com/guide",
      publisher: "p",
      region: "jp",
      checkedAt: "2026-08-24",
    });
    expect(added.ok).toBe(false);
    if (!added.ok) expect(added.error.code).toBe("FORBIDDEN");
  });
});

describe("90 日の判定 (境界)", () => {
  it("90 日ちょうどは確認済み、91 日で再確認になる", async () => {
    const { manage } = usecase(
      [ref({ id: "gr_edge", checkedAt: "2026-05-26" })], // 2026-08-24 まで 90 日
      "2026-08-24",
    );
    const on = await manage.execute(actor("owner"), { action: "list" });
    expect(on.ok).toBe(true);
    if (on.ok) {
      const row = on.value.rows.find((r) => r.reference.id === "gr_edge");
      expect(row?.status).toBe("fresh");
    }

    const { manage: over } = usecase([ref({ id: "gr_edge", checkedAt: "2026-05-26" })], "2026-08-25");
    const overListed = await over.execute(actor("owner"), { action: "list" });
    expect(overListed.ok).toBe(true);
    if (overListed.ok) {
      expect(overListed.value.rows.find((r) => r.reference.id === "gr_edge")?.status).toBe(
        "review_due",
      );
    }
  });
});

describe("初期候補", () => {
  it("未登録の候補は registered: false で並び、一覧しただけでは保存されない", async () => {
    const { manage, calls } = usecase([]);
    const listed = await manage.execute(actor("owner"), { action: "list" });
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      const candidates = listed.value.rows.filter((r) => !r.registered);
      expect(candidates).toHaveLength(INITIAL_GUIDELINE_REFERENCES.length);
    }
    expect(calls.add).toBe(0);
    expect(calls.updateCheckedAt).toBe(0);
  });

  it("同じ URL を登録済みなら、候補としては重ねて出さない", async () => {
    const first = INITIAL_GUIDELINE_REFERENCES[0];
    const { manage } = usecase([ref({ id: "gr_x", url: first.url })]);
    const listed = await manage.execute(actor("owner"), { action: "list" });
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      const urls = listed.value.rows.filter((r) => !r.registered).map((r) => r.reference.url);
      expect(urls).not.toContain(first.url);
    }
  });
});

describe("入力の検査", () => {
  it("https でない URL は欄名つきで断る", async () => {
    const { manage, calls } = usecase();
    const added = await manage.execute(actor("owner"), {
      action: "add",
      title: "t",
      url: "http://example.com/guide",
      publisher: "p",
      region: "jp",
      checkedAt: "2026-08-24",
    });
    expect(added.ok).toBe(false);
    if (!added.ok) expect(added.error.field).toBe("url");
    expect(calls.add).toBe(0);
  });

  it("読めない確認日は再確認 (recheck) でも断る", async () => {
    const { manage, calls } = usecase();
    const updated = await manage.execute(actor("owner"), {
      action: "recheck",
      id: "gr_1",
      checkedAt: "2026-13-99",
    });
    expect(updated.ok).toBe(false);
    if (!updated.ok) expect(updated.error.field).toBe("checkedAt");
    expect(calls.updateCheckedAt).toBe(0);
  });

  it("正しい入力なら登録され、一覧が返る", async () => {
    const { manage, calls } = usecase();
    const added = await manage.execute(actor("owner"), {
      action: "add",
      title: "総務省のガイドライン",
      url: "https://www.soumu.go.jp/example",
      publisher: "総務省",
      region: "jp",
      checkedAt: "2026-08-24",
      note: "全文を確認",
    });
    expect(added.ok).toBe(true);
    expect(calls.add).toBe(1);
  });
});
