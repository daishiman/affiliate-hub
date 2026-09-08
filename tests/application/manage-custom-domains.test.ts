/**
 * @tier 1
 * @req REQ-BOPC01
 * @req feat-blog-custom-domain
 * @types equivalence, boundary, permission-matrix, fault-injection, idempotency, audit-log
 *
 * 住所層のユースケース。**正本が 2 つあることの扱い**だけを見る。
 *
 * 登録の意思はこちら (D1) が持ち、所有権と証明書の結果は向こう
 * (Cloudflare) が持つ。この試験が守りたいのは次の 3 つで、いずれも
 * 「どちらが済んでいて、どちらが済んでいないか」を運用者へ正しく
 * 伝えられるかに関わる。
 *
 *   1. 外部が落ちても、保存できた登録を「失敗」と言わないこと
 *   2. 記録 (監査) が書けなかったときに「保存できた」と言わないこと
 *   3. 取り下げは外部の可用性に依存しないこと (先にこちらを止める)
 *
 * SQL と遷移表は `tests/integration/d1-custom-domain.test.ts` が見る。
 */
import { describe, expect, it } from "vitest";
import type {
  CustomDomainRepositoryPort,
  CustomHostnameProviderPort,
  CustomHostnameSnapshot,
} from "@/application/ports/blog-domains";
import type { AuditLogPort } from "@/application/ports/compliance";
import { createManageCustomDomainsUseCase } from "@/application/usecases/blog-ops/manage-custom-domains";
import type { CustomDomain } from "@/domain/domains";
import {
  type ActorContext,
  type AuditLogId,
  type WorkspaceId,
  domainError,
  err,
  ok,
} from "@/domain/shared";
import { WORKSPACE, aWriter, anOwner } from "../support/actors";

const SITE = "domain-blog";
const NOW = new Date("2026-09-04T12:00:00Z");

/** 外部が返してくる「向こうの言い分」。既定は申し込み直後の姿。 */
const PENDING_SNAPSHOT: CustomHostnameSnapshot = {
  externalHostnameId: "cf-1",
  status: "pending",
  certificateStatus: "pending",
  lastError: null,
  instructions: [
    { recordType: "CNAME", name: "blog.example.com", value: "edge.example.net", why: "所有権の確認" },
  ],
};

function aDomain(over: Partial<CustomDomain> = {}): CustomDomain {
  return {
    id: "dom-1",
    siteSlug: SITE,
    hostname: "blog.example.com",
    status: "pending",
    certificateStatus: "pending",
    canonical: false,
    externalHostnameId: null,
    syncedAt: null,
    lastError: null,
    ...over,
  };
}

/**
 * 呼ばれた順序まで控える保存先。
 *
 * **順序を見るのは取り下げのためである。** こちらを先に落としてから
 * 外部を消す、という向きが崩れると、外部 API が落ちている間は
 * 取り下げが 1 件もできなくなる。
 */
function fakeRepo(seed: readonly CustomDomain[] = [], trace: string[] = []) {
  let rows = [...seed];
  const calls = trace;
  const port: CustomDomainRepositoryPort = {
    async listForSite(_ws, siteSlug) {
      calls.push("listForSite");
      return ok(rows.filter((r) => r.siteSlug === siteSlug));
    },
    async listForWorkspace() {
      calls.push("listForWorkspace");
      return ok(rows);
    },
    async findActiveByHostname(hostname) {
      return ok(rows.find((r) => r.hostname === hostname && r.status === "active") ?? null);
    },
    async register(_ws, siteSlug, hostname) {
      calls.push("register");
      const created = aDomain({ id: `dom-${rows.length + 1}`, siteSlug, hostname });
      rows = [...rows, created];
      return ok(created);
    },
    async applySnapshot(_ws, domainId, snapshot) {
      calls.push("applySnapshot");
      rows = rows.map((r) =>
        r.id === domainId
          ? {
              ...r,
              status: snapshot.status,
              certificateStatus: snapshot.certificateStatus,
              externalHostnameId: snapshot.externalHostnameId,
              lastError: snapshot.lastError,
              syncedAt: NOW,
            }
          : r,
      );
      return ok(rows.find((r) => r.id === domainId) as CustomDomain);
    },
    async setCanonical(_ws, siteSlug, domainId) {
      calls.push("setCanonical");
      rows = rows.map((r) =>
        r.siteSlug === siteSlug ? { ...r, canonical: r.id === domainId } : r,
      );
      return ok(rows.find((r) => r.id === domainId) as CustomDomain);
    },
    async revoke(_ws, domainId) {
      calls.push("revoke");
      rows = rows.map((r) => (r.id === domainId ? { ...r, status: "revoked", canonical: false } : r));
      return ok(true);
    },
  };
  return { port, calls, rows: () => rows };
}

/** 外部。`fail` に指定した操作だけが落ちる。 */
function fakeProvider(
  fail: Partial<Record<"request" | "snapshot" | "release", true>> = {},
  trace: string[] = [],
) {
  const calls = trace;
  const down = () =>
    err(domainError("UPSTREAM_UNAVAILABLE", "提供元へつながりません。", { retryable: true }));
  const port: CustomHostnameProviderPort = {
    async request() {
      calls.push("request");
      return fail.request ? down() : ok(PENDING_SNAPSHOT);
    },
    async snapshot() {
      calls.push("snapshot");
      return fail.snapshot ? down() : ok({ ...PENDING_SNAPSHOT, status: "active" as const });
    },
    async release() {
      calls.push("release");
      return fail.release ? down() : ok(true);
    },
  };
  return { port, calls };
}

function fakeAudit(fail = false) {
  const entries: string[] = [];
  const port: AuditLogPort = {
    async append(entry) {
      if (fail) return err(domainError("UPSTREAM_UNAVAILABLE", "記録を書けません。"));
      entries.push(entry.action);
      return ok("audit-1" as AuditLogId);
    },
    async listByTarget() {
      return ok([]);
    },
    async search() {
      return ok({ items: [], total: 0, page: 1, perPage: 20, nextCursor: null });
    },
  };
  return { port, entries };
}

function useCase(
  parts: {
    repo?: ReturnType<typeof fakeRepo>;
    provider?: ReturnType<typeof fakeProvider>;
    audit?: ReturnType<typeof fakeAudit>;
  } = {},
) {
  const repo = parts.repo ?? fakeRepo();
  const provider = parts.provider ?? fakeProvider();
  const audit = parts.audit ?? fakeAudit();
  const usecase = createManageCustomDomainsUseCase({
    domains: repo.port,
    provider: provider.port,
    auditLog: audit.port,
    ids: { newId: () => "id-1" },
    now: () => NOW,
  });
  return { usecase, repo, provider, audit };
}

function owner(): ActorContext {
  return anOwner({ workspaceId: WORKSPACE as WorkspaceId });
}

describe("入れられる住所と、入れられない住所", () => {
  it("大文字も末尾のドットも同じ住所として受け取る", async () => {
    const { usecase, repo } = useCase();

    const result = await usecase.execute(owner(), {
      action: "register",
      siteSlug: SITE,
      hostname: "  Blog.Example.COM.  ",
    });

    expect(result.ok).toBe(true);
    expect(repo.rows()[0].hostname).toBe("blog.example.com");
  });

  it("スキームやパスが混ざった入力は、黙って削らずに断る", async () => {
    const { usecase, repo, provider } = useCase();

    const result = await usecase.execute(owner(), {
      action: "register",
      siteSlug: SITE,
      hostname: "https://blog.example.com/posts",
    });

    expect(result.ok).toBe(false);
    // **外部へ申し込む手前で止まっていること**まで見る。壊れた名前で
    // 向こうに行を作ると、あとで人が掃除することになる。
    expect(provider.calls).toHaveLength(0);
    expect(repo.rows()).toHaveLength(0);
  });

  it("ドットの無い名前は受け取らない", async () => {
    const { usecase } = useCase();

    const result = await usecase.execute(owner(), {
      action: "register",
      siteSlug: SITE,
      hostname: "localhost",
    });

    expect(result.ok).toBe(false);
  });
});

describe("外部が落ちていても、済んだことは済んだと言う", () => {
  it("申し込みに失敗しても登録は残り、何が残っているかを伝える", async () => {
    const provider = fakeProvider({ request: true });
    const { usecase, repo } = useCase({ provider });

    const result = await usecase.execute(owner(), {
      action: "register",
      siteSlug: SITE,
      hostname: "blog.example.com",
    });

    // 失敗にしない。ここを err にすると運用者はもう一度登録を押し、
    // 同じ住所で CONFLICT を受け取る。
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.notice).not.toBeNull();
    expect(repo.rows()).toHaveLength(1);
  });

  it("外部 id をまだ持たない行の「今すぐ確認」は、申し込みからやり直す", async () => {
    const repo = fakeRepo([aDomain({ externalHostnameId: null })]);
    const provider = fakeProvider();
    const { usecase } = useCase({ repo, provider });

    const result = await usecase.execute(owner(), {
      action: "sync",
      siteSlug: SITE,
      domainId: "dom-1",
    });

    expect(result.ok).toBe(true);
    // snapshot は空の id で呼べない。分けずに片方だけ呼ぶと、登録時に
    // 外部が落ちていた行が永久に pending のまま取り残される。
    expect(provider.calls).toEqual(["request"]);
  });

  it("同じ状態を何度写し取っても結果は変わらない", async () => {
    const repo = fakeRepo([aDomain({ externalHostnameId: "cf-1" })]);
    const { usecase } = useCase({ repo });

    for (const _ of [0, 1, 2]) {
      const result = await usecase.execute(owner(), {
        action: "sync",
        siteSlug: SITE,
        domainId: "dom-1",
      });
      expect(result.ok).toBe(true);
    }

    expect(repo.rows()).toHaveLength(1);
    expect(repo.rows()[0].status).toBe("active");
  });
});

describe("取り下げは外部の可用性に依存しない", () => {
  it("外部の取り消しが落ちても、読者への配信は止まっている", async () => {
    const repo = fakeRepo([aDomain({ status: "active", externalHostnameId: "cf-1" })]);
    const provider = fakeProvider({ release: true });
    const { usecase } = useCase({ repo, provider });

    const result = await usecase.execute(owner(), {
      action: "revoke",
      siteSlug: SITE,
      domainId: "dom-1",
      reason: "別の住所へ移すため",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(repo.rows()[0].status).toBe("revoked");
    // 外部に残った登録は課金対象になるだけで、読者には届かない。
    expect(result.value.notice).not.toBeNull();
  });

  it("こちらを止めてから外部を消す（順序が逆だと外部の故障で止められない）", async () => {
    // 呼ばれた順序そのものを見たいので、保存先と外部で **1 本の記録**を共有する。
    // 別々の配列を突き合わせると、片方が呼ばれていない場合でも比較が成立してしまう。
    const trace: string[] = [];
    const repo = fakeRepo([aDomain({ status: "active", externalHostnameId: "cf-1" })], trace);
    const provider = fakeProvider({}, trace);
    const { usecase } = useCase({ repo, provider });

    await usecase.execute(owner(), {
      action: "revoke",
      siteSlug: SITE,
      domainId: "dom-1",
      reason: "移転",
    });

    expect(trace).toContain("revoke");
    expect(trace).toContain("release");
    expect(trace.indexOf("revoke")).toBeLessThan(trace.indexOf("release"));
  });

  it("理由の無い取り下げは受け付けない", async () => {
    const repo = fakeRepo([aDomain({ status: "active" })]);
    const { usecase } = useCase({ repo });

    const result = await usecase.execute(owner(), {
      action: "revoke",
      siteSlug: SITE,
      domainId: "dom-1",
      reason: "   ",
    });

    expect(result.ok).toBe(false);
    expect(repo.rows()[0].status).toBe("active");
  });
});

describe("記録が書けなかったら「保存できた」と言わない", () => {
  it("監査に書けないと失敗として返る", async () => {
    const audit = fakeAudit(true);
    const { usecase } = useCase({ audit });

    const result = await usecase.execute(owner(), {
      action: "register",
      siteSlug: SITE,
      hostname: "blog.example.com",
    });

    expect(result.ok).toBe(false);
  });

  it("成功した操作は記録に残る", async () => {
    const audit = fakeAudit();
    const { usecase } = useCase({ audit });

    await usecase.execute(owner(), {
      action: "register",
      siteSlug: SITE,
      hostname: "blog.example.com",
    });

    expect(audit.entries).toEqual(["blog_domain.registered"]);
  });
});

describe("見るのと変えるのは別の権限", () => {
  it("記事を書く人は住所の一覧を見られる（自分の記事がどこで読まれるかを知る必要がある）", async () => {
    const repo = fakeRepo([aDomain()]);
    const { usecase } = useCase({ repo });

    const result = await usecase.execute(aWriter(), { action: "read", siteSlug: SITE });

    expect(result.ok).toBe(true);
  });

  it("記事を書く人は住所を登録できない", async () => {
    const repo = fakeRepo();
    const { usecase, provider } = useCase({ repo });

    const result = await usecase.execute(aWriter(), {
      action: "register",
      siteSlug: SITE,
      hostname: "blog.example.com",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("FORBIDDEN");
    expect(repo.rows()).toHaveLength(0);
    expect(provider.calls).toHaveLength(0);
  });

  it("記事を書く人は正規の住所を切り替えられない", async () => {
    const repo = fakeRepo([aDomain({ status: "active" })]);
    const { usecase } = useCase({ repo });

    const result = await usecase.execute(aWriter(), {
      action: "set_canonical",
      siteSlug: SITE,
      domainId: "dom-1",
    });

    expect(result.ok).toBe(false);
    expect(repo.rows()[0].canonical).toBe(false);
  });
});
