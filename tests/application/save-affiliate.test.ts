/**
 * @tier 1
 * @req REQ-A07, REQ-P09
 * @types permission-matrix, equivalence, audit-log
 *
 * 提携先と提携条件を**登録する**側。読む側は `tests/application/affiliate.test.ts`。
 *
 * --- ここで最も守りたいこと ---
 * 1. **鍵が記録へ写らない。** 監査の記録に残すのは「登録済みかどうか」だけ。
 *    値を残せば、記録を読める人全員に鍵を配ったのと同じになる。
 * 2. **ASP を 2 か所から決めない。** 提携条件の ASP は提携先から引く。
 *    別々に選べると、A8 の提携先の下に楽天の条件がぶら下がる行が作れる。
 * 3. **「未取得」と 0 を混ぜない。** 承認率も報酬も、空欄は 0 にしない。
 * 4. **止める・終了にするで行を消さない。** 消すと過去の成果の出どころが消える。
 * 5. **権限が無ければ断る。** 収益の出どころを、読むだけの人が動かせない。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §2
 */
import { describe, expect, it } from "vitest";
import {
  type ManageAffiliateDeps,
  createSaveAffiliateAccountUseCase,
  createSaveAffiliateProgramUseCase,
} from "@/application/usecases/monetization/manage-affiliate";
import type {
  AffiliateAccountRepositoryPort,
  AffiliateProgramRepositoryPort,
} from "@/application/ports/monetization";
import type { AffiliateAccount, AffiliateProgram } from "@/domain/monetization";
import { ok } from "@/domain/shared";
import type { WorkspaceId } from "@/domain/shared";
import { SAMPLE_WORKSPACE_ID } from "@/infrastructure/persistence/sample/ranking-sample-repository";
import { anAnalyst, anOwner } from "../support/actors";
import { recordingAuditLog, testDeps } from "../support/doubles";

const WS = SAMPLE_WORKSPACE_ID as WorkspaceId;
const owner = anOwner({ workspaceId: WS });
const analyst = anAnalyst({ workspaceId: WS });

/** 実際に溜まる提携先の保存先。見本の版は保存を断るので、登録の検査には使えない。 */
function memoryAccounts(seed: readonly AffiliateAccount[] = []) {
  const rows = [...seed];
  const port: AffiliateAccountRepositoryPort = {
    async findById(_ws, id) {
      return ok(rows.find((a) => a.id === id) ?? null);
    },
    async list(_ws, page) {
      return ok({ items: rows.slice(0, page.limit), nextCursor: null });
    },
    async save(account) {
      const at = rows.findIndex((a) => a.id === account.id);
      if (at === -1) rows.push(account);
      else rows[at] = account;
      return ok(account);
    },
  };
  return { port, rows };
}

function memoryPrograms(seed: readonly AffiliateProgram[] = []) {
  const rows = [...seed];
  const port: AffiliateProgramRepositoryPort = {
    async findById(_ws, id) {
      return ok(rows.find((p) => p.id === id) ?? null);
    },
    async list(_ws, page) {
      return ok({ items: rows.slice(0, page.limit), nextCursor: null });
    },
    async save(program) {
      const at = rows.findIndex((p) => p.id === program.id);
      if (at === -1) rows.push(program);
      else rows[at] = program;
      return ok(program);
    },
  };
  return { port, rows };
}

function deps(over: Partial<ManageAffiliateDeps> = {}) {
  const base = testDeps();
  const audit = recordingAuditLog();
  const built: ManageAffiliateDeps = {
    accounts: memoryAccounts().port,
    programs: memoryPrograms().port,
    links: base.affiliateLinks,
    conversions: base.conversions,
    ids: base.ids,
    auditLog: audit.port,
    now: () => new Date("2026-08-26T00:00:00.000Z"),
    ...over,
  };
  return { deps: built, audit };
}

const ACCOUNT_INPUT = {
  accountId: null,
  asp: "a8net",
  label: "本体用",
  publicTrackingId: "",
  credentialRef: "",
  disabled: false,
};

describe("提携先を登録する", () => {
  it("登録できる。空欄は空文字ではなく未設定として残る", async () => {
    const accounts = memoryAccounts();
    const { deps: d } = deps({ accounts: accounts.port });

    const saved = await createSaveAffiliateAccountUseCase(d).execute(owner, ACCOUNT_INPUT);
    if (!saved.ok) throw new Error(saved.error.message);

    // 空文字で残すと、公開前の確認が「埋まっている」と読んでしまう。
    expect(accounts.rows[0]?.publicTrackingId).toBeNull();
    expect(accounts.rows[0]?.credentialRef).toBeNull();
    expect(saved.value.view.credentialRegistered).toBe(false);
  });

  it("記録に鍵の値は残らない。残るのは登録済みかどうかだけ", async () => {
    const { deps: d, audit } = deps();

    await createSaveAffiliateAccountUseCase(d).execute(owner, {
      ...ACCOUNT_INPUT,
      credentialRef: "A8_API_KEY",
    });

    const written = JSON.stringify(audit.entries());
    expect(written).not.toContain("A8_API_KEY");
    expect(written).toContain("credentialRegistered");
  });

  it("止めても行は消えない。止めた印が付くだけ", async () => {
    const accounts = memoryAccounts();
    const { deps: d } = deps({ accounts: accounts.port });
    const uc = createSaveAffiliateAccountUseCase(d);

    const first = await uc.execute(owner, ACCOUNT_INPUT);
    if (!first.ok) throw new Error(first.error.message);
    const stopped = await uc.execute(owner, {
      ...ACCOUNT_INPUT,
      accountId: first.value.accountId,
      disabled: true,
    });
    if (!stopped.ok) throw new Error(stopped.error.message);

    expect(accounts.rows).toHaveLength(1);
    expect(accounts.rows[0]?.disabledAt).not.toBeNull();
    expect(stopped.value.view.disabled).toBe(true);
  });

  it("知らない ASP は断る", async () => {
    const { deps: d } = deps();

    const saved = await createSaveAffiliateAccountUseCase(d).execute(owner, {
      ...ACCOUNT_INPUT,
      asp: "存在しないASP",
    });

    expect(saved.ok).toBe(false);
    if (saved.ok) return;
    expect(saved.error.field).toBe("asp");
  });

  it("提携を動かす権限が無ければ断る", async () => {
    const { deps: d } = deps();

    const saved = await createSaveAffiliateAccountUseCase(d).execute(analyst, ACCOUNT_INPUT);

    expect(saved.ok).toBe(false);
  });
});

/** 提携条件を作るのに要る、登録済みの提携先を 1 件用意する。 */
async function withAccount() {
  const accounts = memoryAccounts();
  const programs = memoryPrograms();
  const { deps: d, audit } = deps({ accounts: accounts.port, programs: programs.port });
  const created = await createSaveAffiliateAccountUseCase(d).execute(owner, ACCOUNT_INPUT);
  if (!created.ok) throw new Error(created.error.message);
  return { deps: d, audit, accounts, programs, accountId: created.value.accountId };
}

const PROGRAM_INPUT = {
  programId: null,
  advertiserName: "テスト広告主",
  rewardKind: "rate",
  rewardPercent: 3,
  rewardAmountMinor: null,
  rewardCurrency: "JPY" as const,
  rewardNote: "",
  approvalRatePercent: 65,
  confirmationDays: 45,
  cookieDurationDays: 30,
  restrictions: ["最安と書かない"],
  ended: false,
};

describe("提携条件を登録する", () => {
  it("ASP は提携先から引く。画面から別に受け取らない", async () => {
    const { deps: d, programs, accountId } = await withAccount();

    const saved = await createSaveAffiliateProgramUseCase(d).execute(owner, {
      ...PROGRAM_INPUT,
      accountId,
    });
    if (!saved.ok) throw new Error(saved.error.message);

    // 提携先が a8 なので、条件も a8 にしかならない。食い違う行を作れない。
    expect(programs.rows[0]?.asp).toBe("a8net");
  });

  it("承認率は％で受け取り、0〜1 の割合として保存する", async () => {
    const { deps: d, programs, accountId } = await withAccount();

    await createSaveAffiliateProgramUseCase(d).execute(owner, { ...PROGRAM_INPUT, accountId });

    // 人に 0.65 と書かせない。65 と書いた人の意図が 6500% にならないため。
    expect(programs.rows[0]?.approvalRate).toBeCloseTo(0.65, 5);
  });

  it("率を選んだのに値が空なら、0% にせず断る", async () => {
    const { deps: d, accountId } = await withAccount();

    const saved = await createSaveAffiliateProgramUseCase(d).execute(owner, {
      ...PROGRAM_INPUT,
      accountId,
      rewardPercent: null,
    });

    expect(saved.ok).toBe(false);
    if (saved.ok) return;
    expect(saved.error.field).toBe("rewardPercent");
  });

  it("「まだ分からない」は保存できる。0 円にはならない", async () => {
    const { deps: d, programs, accountId } = await withAccount();

    const saved = await createSaveAffiliateProgramUseCase(d).execute(owner, {
      ...PROGRAM_INPUT,
      accountId,
      rewardKind: "unknown",
      rewardPercent: null,
    });
    if (!saved.ok) throw new Error(saved.error.message);

    expect(programs.rows[0]?.rewardModel).toEqual({ kind: "unknown" });
    expect(saved.value.view.rewardLabel).toBe("未取得");
  });

  it("見つからない提携先の下には作れない", async () => {
    const { deps: d } = await withAccount();

    const saved = await createSaveAffiliateProgramUseCase(d).execute(owner, {
      ...PROGRAM_INPUT,
      accountId: "acc_does_not_exist",
    });

    expect(saved.ok).toBe(false);
  });

  it("終了にしても行は消えない", async () => {
    const { deps: d, programs, accountId } = await withAccount();
    const uc = createSaveAffiliateProgramUseCase(d);

    const first = await uc.execute(owner, { ...PROGRAM_INPUT, accountId });
    if (!first.ok) throw new Error(first.error.message);
    const ended = await uc.execute(owner, {
      ...PROGRAM_INPUT,
      accountId,
      programId: first.value.programId,
      ended: true,
    });
    if (!ended.ok) throw new Error(ended.error.message);

    expect(programs.rows).toHaveLength(1);
    expect(programs.rows[0]?.endedAt).not.toBeNull();
    expect(ended.value.view.active).toBe(false);
  });

  it("提携を動かす権限が無ければ断る", async () => {
    const { deps: d, accountId } = await withAccount();

    const saved = await createSaveAffiliateProgramUseCase(d).execute(analyst, {
      ...PROGRAM_INPUT,
      accountId,
    });

    expect(saved.ok).toBe(false);
  });
});
