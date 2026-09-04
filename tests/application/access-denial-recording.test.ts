/**
 * @tier 1
 * @req REQ-SEC09, REQ-SEC01
 * @types equivalence, boundary
 *
 * `access-denial.ts` の**内側の判断**を直接見る。
 *
 * 受入側 (`tests/acceptance/feat-auth-workspace/denial-audit.test.ts`) は
 * 「断ったら行が 1 本残る」という入口からの振る舞いを見ている。それは通るが、
 * **中でどの値をどう決めているかは 1 つも押さえていない**。
 *
 * 実際、ミューテーション検査では access-denial.ts の変異 51 体中 39 体が生き残った。
 * 目印の拾い方 (`/id$|slug$/i`)、採番の接頭辞 (`al_` / `req_`)、
 * 記録の作成に失敗したときの落ち方 — どれを壊しても受入テストは緑のままだった。
 *
 * ここはその 3 つを名指しで固定する。**閾値ではなく、判断そのものを見る。**
 */
import { describe, expect, it } from "vitest";
import {
  auditDenials,
  denialActionOf,
  recordAccessDenial,
  withAccessDenialAudit,
} from "@/application/access-denial";
import type { AccessAuditDeps } from "@/application/access-denial";
import type { AuditLogPort } from "@/application/ports/compliance";
import type { AuditLogEntry } from "@/domain/compliance";
import type { UseCase } from "@/application/usecases/usecase";
import {
  type ActorContext,
  type DomainError,
  type DomainErrorCode,
  err,
  ok,
} from "@/domain/shared";
import { WORKSPACE, anAnalyst } from "../support/actors";

const NOW = new Date("2026-08-24T09:00:00.000Z");

function 記録先() {
  const 行: AuditLogEntry[] = [];
  const port: AuditLogPort = {
    async append(entry) {
      行.push(entry);
      return ok(entry.id);
    },
    async listByTarget() {
      return ok(行);
    },
    async search() {
      return ok({ items: 行, nextCursor: null });
    },
  };
  return { 行, port };
}

/** `now` を渡す版。時刻を固定したいときはこちら。 */
function deps(port: AuditLogPort): AccessAuditDeps {
  let n = 0;
  return { auditLog: port, ids: { newId: () => `n${++n}` }, now: () => NOW };
}

const 主体 = (): ActorContext => ({ ...anAnalyst(), requestId: "req-固定-1" });

function 断り(code: DomainErrorCode): DomainError {
  return { code, message: "x", retryable: false };
}

/** 1 行残して、その行を返す。目印の拾い方を見るための最小の呼び出し。 */
async function 残った行(targetId = "t-1"): Promise<AuditLogEntry> {
  const { 行, port } = 記録先();
  await recordAccessDenial(deps(port), 主体(), {
    error: 断り("FORBIDDEN"),
    attempted: "doThing",
    targetType: "doThing",
    targetId,
  });
  expect(行).toHaveLength(1);
  return 行[0];
}

describe("どの断りを記録するか (denialActionOf)", () => {
  it("権限不足と身元不明は同じ語、他所への越境だけ別の語で残す", () => {
    expect(denialActionOf("FORBIDDEN")).toBe("access.denied");
    expect(denialActionOf("UNAUTHENTICATED")).toBe("access.denied");
    expect(denialActionOf("TENANT_MISMATCH")).toBe("access.cross_workspace_blocked");
  });

  it("越境と権限不足は、記録の上では区別できていること", () => {
    // 3 つを 1 つの語へ潰すと一覧が読めなくなる。潰していないことをここで固定する。
    expect(denialActionOf("TENANT_MISMATCH")).not.toBe(denialActionOf("FORBIDDEN"));
  });

  it("それ以外は記録しない。特に NOT_FOUND は null を返す", () => {
    const 記録しない: readonly DomainErrorCode[] = [
      "NOT_FOUND",
      "VALIDATION_FAILED",
      "CONFLICT",
      "INVARIANT_VIOLATED",
      "UPSTREAM_UNAVAILABLE",
      "RATE_LIMITED",
      "NOT_SUPPORTED",
      "NOT_IMPLEMENTED",
      "COMMERCIAL_INPUT_REJECTED",
      "PUBLISH_GATE_FAILED",
      "EVIDENCE_REQUIRED",
      "FACT_BOUNDARY_VIOLATED",
    ];
    for (const code of 記録しない) expect(denialActionOf(code)).toBeNull();
  });
});

describe("記録しない種類は、保存先を 1 度も触らない", () => {
  it("NOT_FOUND では append が呼ばれない", async () => {
    const { 行, port } = 記録先();
    let 呼ばれた = 0;
    const 数える: AuditLogPort = { ...port, append: async (e) => (呼ばれた++, port.append(e)) };
    await recordAccessDenial(deps(数える), 主体(), {
      error: 断り("NOT_FOUND"),
      attempted: "getArticle",
      targetType: "getArticle",
      targetId: "a-1",
    });
    expect(呼ばれた).toBe(0);
    expect(行).toHaveLength(0);
  });
});

describe("行の中身の決め方", () => {
  it("記録の ID は al_ を頭に付けた採番であり、採番器を通している", async () => {
    const 行 = await 残った行();
    expect(String(行.id)).toBe("al_n1");
    expect(String(行.id).startsWith("al_")).toBe(true);
  });

  it("attempted と targetType / targetId は渡されたものがそのまま入る", async () => {
    const 行 = await 残った行("pub-42");
    expect(行.after?.attempted).toBe("doThing");
    expect(行.targetType).toBe("doThing");
    expect(行.targetId).toBe("pub-42");
  });

  it("result は denied、code は潰す前の種類", async () => {
    const { 行, port } = 記録先();
    await recordAccessDenial(deps(port), 主体(), {
      error: 断り("TENANT_MISMATCH"),
      attempted: "getArticle",
      targetType: "getArticle",
      targetId: "a-1",
    });
    expect(行[0].after?.result).toBe("denied");
    expect(行[0].after?.code).toBe("TENANT_MISMATCH");
    expect(行[0].action).toBe("access.cross_workspace_blocked");
    expect(行[0].workspaceId).toBe(WORKSPACE);
  });

  it("身元が糸を持っていればそれを使い、書き換えない", async () => {
    const 行 = await 残った行();
    expect(行.requestId).toBe("req-固定-1");
  });

  it("糸が無ければ req_ を頭に付けて 1 本その場で作る", async () => {
    const { 行, port } = 記録先();
    await recordAccessDenial(deps(port), anAnalyst(), {
      error: 断り("FORBIDDEN"),
      attempted: "doThing",
      targetType: "doThing",
      targetId: "t-1",
    });
    // `al_n1` が先に採番されるので、糸は 2 本目になる。
    expect(行[0].requestId).toBe("req_n2");
    expect(String(行[0].requestId).startsWith("req_")).toBe(true);
  });

  it("now を渡さなければ現在時刻を使う（既定を空にしていないこと）", async () => {
    const { 行, port } = 記録先();
    const 前 = Date.now();
    await recordAccessDenial({ auditLog: port, ids: { newId: () => "x" } }, 主体(), {
      error: 断り("FORBIDDEN"),
      attempted: "doThing",
      targetType: "doThing",
      targetId: "t-1",
    });
    const 後 = Date.now();
    expect(行[0].occurredAt.getTime()).toBeGreaterThanOrEqual(前);
    expect(行[0].occurredAt.getTime()).toBeLessThanOrEqual(後);
  });

  it("now を渡せばそれが入る（渡した時計を捨てていないこと）", async () => {
    const 行 = await 残った行();
    expect(行.occurredAt).toEqual(NOW);
  });
});

describe("記録そのものが作れなかったとき", () => {
  it("保存先を呼ばずに静かに戻る。呼び出し側へ投げ返さない", async () => {
    const { port } = 記録先();
    let 呼ばれた = 0;
    const 数える: AuditLogPort = { ...port, append: async (e) => (呼ばれた++, port.append(e)) };
    // 目印が空文字だと、ドメインが行そのものを断る。
    await expect(
      recordAccessDenial(deps(数える), 主体(), {
        error: 断り("FORBIDDEN"),
        attempted: "doThing",
        targetType: "doThing",
        targetId: "",
      }),
    ).resolves.toBeUndefined();
    expect(呼ばれた).toBe(0);
  });

  /*
    **ここは「投げ返さない」ではない。** 保存先の例外はそのまま上がる。
    包み手 (`withAccessDenialAudit`) も握り潰していないので、記録先が落ちると
    断りの応答ではなく例外が返る。**望ましい形かどうかは別の判断**であり、
    ここは今そうなっている事実を固定するだけにする。握り潰す形へ変えるなら
    このテストが赤くなり、変えたことが必ず目に入る。
  */
  it("保存先が落ちた例外は握り潰されず、そのまま上がる", async () => {
    const 落ちる: AuditLogPort = {
      async append() {
        throw new Error("保存先が落ちた");
      },
      async listByTarget() {
        return ok([]);
      },
      async search() {
        return ok({ items: [], nextCursor: null });
      },
    };
    await expect(
      recordAccessDenial(deps(落ちる), 主体(), {
        error: 断り("FORBIDDEN"),
        attempted: "doThing",
        targetType: "doThing",
        targetId: "t-1",
      }),
    ).rejects.toThrow("保存先が落ちた");
  });
});

/**
 * **目印 (`targetId`) の拾い方。**
 *
 * 包み手は入力の中から `〜id` / `〜slug` で終わる項目を 1 つ選んで目印にする。
 * ここを壊しても、行の本数も語も変わらないので受入テストは全部緑のまま通る。
 * 生き残った変異のいちばん濃い場所がここだった。
 */
describe("入力から目印を拾う (withAccessDenialAudit)", () => {
  async function 目印(input: unknown): Promise<string> {
    const { 行, port } = 記録先();
    const 常に断る: UseCase<unknown, never> = {
      async execute() {
        return err(断り("FORBIDDEN"));
      },
    };
    await withAccessDenialAudit(deps(port), "doThing", 常に断る).execute(主体(), input);
    expect(行).toHaveLength(1);
    return 行[0].targetId;
  }

  it("末尾が id / slug の項目を拾う", async () => {
    expect(await 目印({ articleId: "a-1" })).toBe("a-1");
    expect(await 目印({ siteSlug: "sakura" })).toBe("sakura");
  });

  it("大小文字を問わない（ID / SLUG も拾う）", async () => {
    expect(await 目印({ ID: "a-1" })).toBe("a-1");
    expect(await 目印({ SLUG: "sakura" })).toBe("sakura");
  });

  it("末尾でなければ拾わない。idx や identity を目印にしない", async () => {
    expect(await 目印({ idx: "3" })).toBe("(指定なし)");
    expect(await 目印({ identity: "u-1" })).toBe("(指定なし)");
    expect(await 目印({ slugger: "x" })).toBe("(指定なし)");
  });

  it("値が文字列でなければ飛ばして次を見る", async () => {
    expect(await 目印({ articleId: 42, siteSlug: "sakura" })).toBe("sakura");
    expect(await 目印({ articleId: null, siteSlug: "sakura" })).toBe("sakura");
    expect(await 目印({ articleId: 42 })).toBe("(指定なし)");
  });

  it("空白だけの値は目印にしない。飛ばして次を見る", async () => {
    expect(await 目印({ articleId: "   ", siteSlug: "sakura" })).toBe("sakura");
    expect(await 目印({ articleId: "" })).toBe("(指定なし)");
  });

  it("拾えないときは空文字ではなく (指定なし) を入れる", async () => {
    // 空文字だとドメインが行そのものを断り、記録が消える。
    // 「目印が無い」と「記録できなかった」を同じ形にしない。
    expect(await 目印({})).toBe("(指定なし)");
    expect(await 目印({ title: "題名" })).toBe("(指定なし)");
  });

  it("入力が object でないとき、null のときも (指定なし)", async () => {
    expect(await 目印(null)).toBe("(指定なし)");
    expect(await 目印(undefined)).toBe("(指定なし)");
    expect(await 目印("a-1")).toBe("(指定なし)");
    expect(await 目印(42)).toBe("(指定なし)");
  });

  it("該当が複数あれば先に現れたものを採る", async () => {
    expect(await 目印({ articleId: "a-1", siteSlug: "sakura" })).toBe("a-1");
    expect(await 目印({ siteSlug: "sakura", articleId: "a-1" })).toBe("sakura");
  });
});

describe("包んでも通り道は変わらない", () => {
  it("成功はそのまま返り、行は増えない", async () => {
    const { 行, port } = 記録先();
    const 通す: UseCase<unknown, string> = {
      async execute() {
        return ok("できた");
      },
    };
    const got = await withAccessDenialAudit(deps(port), "doThing", 通す).execute(主体(), {});
    expect(got).toEqual(ok("できた"));
    expect(行).toHaveLength(0);
  });

  it("断りの中身は 1 バイトも変えずに返す", async () => {
    const { port } = 記録先();
    const 元 = 断り("FORBIDDEN");
    const 常に断る: UseCase<unknown, never> = {
      async execute() {
        return err(元);
      },
    };
    const got = await withAccessDenialAudit(deps(port), "doThing", 常に断る).execute(主体(), {});
    expect(got.ok).toBe(false);
    if (!got.ok) expect(got.error).toBe(元);
  });
});

describe("束ねて包む (auditDenials)", () => {
  it("項目名がそのまま attempted になり、名前は落ちない", async () => {
    const { 行, port } = 記録先();
    const 常に断る: UseCase<never, never> = {
      async execute() {
        return err(断り("FORBIDDEN"));
      },
    };
    const 群 = auditDenials(deps(port), { publishArticle: 常に断る, removeSite: 常に断る });
    expect(Object.keys(群).sort()).toEqual(["publishArticle", "removeSite"]);

    await 群.publishArticle.execute(主体() as never, undefined as never);
    await 群.removeSite.execute(主体() as never, undefined as never);
    expect(行.map((r) => r.after?.attempted)).toEqual(["publishArticle", "removeSite"]);
    expect(行.map((r) => r.targetType)).toEqual(["publishArticle", "removeSite"]);
  });

  it("空の束を渡しても壊れない", () => {
    const { port } = 記録先();
    expect(Object.keys(auditDenials(deps(port), {}))).toEqual([]);
  });
});
