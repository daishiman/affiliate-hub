/** @tier 1 */
import { describe, expect, it } from "vitest";
import type { GuidelineReferencePort } from "@/application/ports/guideline-reference";
import { createManageGuidelineReferencesUseCase } from "@/application/usecases/seo/manage-guideline-references";
import {
  INITIAL_GUIDELINE_REFERENCES,
  type GuidelineReference,
} from "@/domain/seo/guideline-reference";
import { asWorkspaceId, domainError, err, ok } from "@/domain/shared";
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

/** どの口を落とすか。保存先の不調が、成功として素通りしないことを見るため。 */
type PortFailure = "list" | "add" | "updateCheckedAt";

/**
 * 呼ばれた事実を数える偽ポート。保存の副作用と、渡された引数をここで観測する。
 *
 * `added` / `checked` に**渡された値そのもの**を残す。件数だけ数えていると、
 * 採番した id や trim した題名が入れ替わっても気づけない。
 */
function fakePort(stored: readonly GuidelineReference[] = [], failing?: PortFailure) {
  const calls = { add: 0, updateCheckedAt: 0, list: 0 };
  const seen: {
    added: GuidelineReference | null;
    checked: { id: string; checkedAt: string } | null;
    workspaceIds: string[];
  } = { added: null, checked: null, workspaceIds: [] };
  const port: GuidelineReferencePort = {
    async list(workspaceId) {
      calls.list += 1;
      seen.workspaceIds.push(String(workspaceId));
      if (failing === "list") return err(domainError("UPSTREAM_UNAVAILABLE", "保存先を読めません。"));
      return ok(stored);
    },
    async add(input) {
      calls.add += 1;
      seen.added = input.reference;
      seen.workspaceIds.push(String(input.workspaceId));
      if (failing === "add") return err(domainError("UPSTREAM_UNAVAILABLE", "保存できません。"));
      return ok(input.reference);
    },
    async updateCheckedAt(input) {
      calls.updateCheckedAt += 1;
      seen.checked = { id: input.id, checkedAt: input.checkedAt };
      seen.workspaceIds.push(String(input.workspaceId));
      if (failing === "updateCheckedAt") return err(domainError("UPSTREAM_UNAVAILABLE", "更新できません。"));
      return ok({ ...ref(), id: input.id, checkedAt: input.checkedAt });
    },
  };
  return { port, calls, seen };
}

function usecase(
  stored: readonly GuidelineReference[] = [],
  today = "2026-08-24",
  options: { readonly failing?: PortFailure; readonly newId?: string } = {},
) {
  const { port, calls, seen } = fakePort(stored, options.failing);
  const manage = createManageGuidelineReferencesUseCase({
    references: port,
    ids: { newId: () => options.newId ?? "id_1" },
    now: () => new Date(`${today}T00:00:00Z`),
  });
  return { manage, calls, seen };
}

/** 正しい `add` の入力。1 欄だけ壊して断りを見るための土台。 */
function addInput(over: Record<string, unknown> = {}) {
  return {
    action: "add" as const,
    title: "総務省のガイドライン",
    url: "https://www.soumu.go.jp/example",
    publisher: "総務省",
    region: "jp",
    checkedAt: "2026-08-24",
    ...over,
  };
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

  it("空白だけの題名・発行元は、それぞれの欄名で断る", async () => {
    const { manage, calls } = usecase();
    const noTitle = await manage.execute(actor("owner"), addInput({ title: "   " }));
    expect(noTitle.ok).toBe(false);
    if (!noTitle.ok) {
      expect(noTitle.error.field).toBe("title");
      expect(noTitle.error.code).toBe("VALIDATION_FAILED");
    }

    const noPublisher = await manage.execute(actor("owner"), addInput({ publisher: "\t" }));
    expect(noPublisher.ok).toBe(false);
    if (!noPublisher.ok) expect(noPublisher.error.field).toBe("publisher");

    expect(calls.add).toBe(0);
  });

  it("対象は global と jp だけを受け取り、それ以外は region の欄で断る", async () => {
    const { manage, calls } = usecase();
    for (const region of ["global", "jp"]) {
      const accepted = await manage.execute(actor("owner"), addInput({ region }));
      expect(accepted.ok).toBe(true);
    }
    expect(calls.add).toBe(2);

    const rejected = await manage.execute(actor("owner"), addInput({ region: "eu" }));
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.error.field).toBe("region");
    expect(calls.add).toBe(2);
  });

  it("形は YYYY-MM-DD でも実在しない日は断る（2 月 30 日を確認日にしない）", async () => {
    const { manage, calls } = usecase();
    const impossible = await manage.execute(actor("owner"), addInput({ checkedAt: "2026-02-30" }));
    expect(impossible.ok).toBe(false);
    if (!impossible.ok) expect(impossible.error.field).toBe("checkedAt");

    // 桁を落とした形も通さない。
    const shape = await manage.execute(actor("owner"), addInput({ checkedAt: "2026-8-24" }));
    expect(shape.ok).toBe(false);

    // うるう年は実在するので通る（弾きすぎていないことの陰性対照）。
    const leap = await manage.execute(actor("owner"), addInput({ checkedAt: "2028-02-29" }));
    expect(leap.ok).toBe(true);
    expect(calls.add).toBe(1);
  });

  it("再確認で、どの出典かが空なら id の欄で断る", async () => {
    const { manage, calls } = usecase();
    const blank = await manage.execute(actor("owner"), {
      action: "recheck",
      id: "  ",
      checkedAt: "2026-08-24",
    });
    expect(blank.ok).toBe(false);
    if (!blank.ok) expect(blank.error.field).toBe("id");
    expect(calls.updateCheckedAt).toBe(0);
  });
});

describe("保存先へ渡すもの", () => {
  it("題名・発行元は前後の空白を落として渡し、id は gr_ を付けて採番する", async () => {
    const { manage, seen } = usecase([], "2026-08-24", { newId: "abc" });
    const added = await manage.execute(
      actor("owner"),
      addInput({ title: "  指針  ", publisher: "  発行元  " }),
    );
    expect(added.ok).toBe(true);
    expect(seen.added?.title).toBe("指針");
    expect(seen.added?.publisher).toBe("発行元");
    expect(seen.added?.id).toBe("gr_abc");
  });

  it("備考は、書いてあれば trim して渡し、空白だけなら欄ごと渡さない", async () => {
    const { manage, seen } = usecase();
    await manage.execute(actor("owner"), addInput({ note: "  全文を確認  " }));
    expect(seen.added?.note).toBe("全文を確認");

    const blank = usecase();
    await blank.manage.execute(actor("owner"), addInput({ note: "   " }));
    expect(blank.seen.added && "note" in blank.seen.added).toBe(false);
  });

  it("URL は trim せずそのまま渡す（末尾の差で別物になる出典を勝手に寄せない）", async () => {
    const { manage, seen } = usecase();
    await manage.execute(actor("owner"), addInput({ url: "https://example.com/a/" }));
    expect(seen.added?.url).toBe("https://example.com/a/");
  });

  it("再確認は、指定された id と確認日をそのまま渡す", async () => {
    const { manage, seen, calls } = usecase();
    const updated = await manage.execute(actor("owner"), {
      action: "recheck",
      id: "gr_9",
      checkedAt: "2026-08-24",
    });
    expect(updated.ok).toBe(true);
    expect(calls.updateCheckedAt).toBe(1);
    expect(seen.checked).toEqual({ id: "gr_9", checkedAt: "2026-08-24" });
  });

  it("どの口にも、操作した人の作業場所を渡す（他の作業場所の台帳を触らない）", async () => {
    const { manage, seen } = usecase();
    await manage.execute(actor("owner"), addInput());
    expect(seen.workspaceIds.length).toBeGreaterThan(0);
    for (const id of seen.workspaceIds) expect(id).toBe(String(WS));
  });
});

describe("保存先の不調", () => {
  it("一覧が読めないときは、空の一覧として返さない", async () => {
    const { manage } = usecase([], "2026-08-24", { failing: "list" });
    const listed = await manage.execute(actor("owner"), { action: "list" });
    expect(listed.ok).toBe(false);
    if (!listed.ok) expect(listed.error.code).toBe("UPSTREAM_UNAVAILABLE");
  });

  it("登録に失敗したら、登録できたことにせず、一覧も読みに行かない", async () => {
    const { manage, calls } = usecase([], "2026-08-24", { failing: "add" });
    const added = await manage.execute(actor("owner"), addInput());
    expect(added.ok).toBe(false);
    if (!added.ok) expect(added.error.code).toBe("UPSTREAM_UNAVAILABLE");
    expect(calls.list).toBe(0);
  });

  it("再確認に失敗したら、確認したことにしない", async () => {
    const { manage, calls } = usecase([], "2026-08-24", { failing: "updateCheckedAt" });
    const updated = await manage.execute(actor("owner"), {
      action: "recheck",
      id: "gr_1",
      checkedAt: "2026-08-24",
    });
    expect(updated.ok).toBe(false);
    expect(calls.list).toBe(0);
  });
});

describe("一覧の並びと判定の基準日", () => {
  it("登録済みが先、未登録の候補が後ろに並ぶ", async () => {
    const { manage } = usecase([ref({ id: "gr_x" })]);
    const listed = await manage.execute(actor("owner"), { action: "list" });
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    const flags = listed.value.rows.map((r) => r.registered);
    expect(flags[0]).toBe(true);
    // true の並びが途切れたあとに true が再び現れない。
    expect(flags.indexOf(false) === -1 || !flags.slice(flags.indexOf(false)).includes(true)).toBe(
      true,
    );
  });

  it("基準日は now() の UTC の日付を使う（同じ日の夜でも判定が動かない）", async () => {
    const stored = [ref({ id: "gr_edge", checkedAt: "2026-05-26" })];
    const { port } = fakePort(stored);
    const manage = createManageGuidelineReferencesUseCase({
      references: port,
      ids: { newId: () => "id_1" },
      now: () => new Date("2026-08-24T23:59:59Z"),
    });
    const listed = await manage.execute(actor("owner"), { action: "list" });
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.value.rows.find((r) => r.reference.id === "gr_edge")?.status).toBe("fresh");
    }
  });

  it("未登録の候補にも、確認日から出した状態が付く（候補だけ判定を飛ばさない）", async () => {
    const { manage } = usecase([]);
    const listed = await manage.execute(actor("owner"), { action: "list" });
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    const candidates = listed.value.rows.filter((r) => !r.registered);
    expect(candidates.length).toBeGreaterThan(0);
    for (const row of candidates) {
      expect(["fresh", "review_due"]).toContain(row.status);
    }
  });
});

describe("権限の分かれ目", () => {
  it("再確認も site.manage が要る（読める人が確認日を動かせてしまわない）", async () => {
    const { manage, calls } = usecase();
    const updated = await manage.execute(actor("analyst"), {
      action: "recheck",
      id: "gr_1",
      checkedAt: "2026-08-24",
    });
    expect(updated.ok).toBe(false);
    if (!updated.ok) expect(updated.error.code).toBe("FORBIDDEN");
    expect(calls.updateCheckedAt).toBe(0);
    expect(calls.list).toBe(0);
  });
});
