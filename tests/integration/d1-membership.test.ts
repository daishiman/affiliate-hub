/** @tier 2 @req REQ-P01 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/d1";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getPlatformProxy } from "wrangler";
import { createManageMembersUseCase } from "@/application/usecases/identity/manage-workspace";
import * as schema from "@/db/schema";
import type { ActorContext } from "@/domain/shared";
import { createD1MembershipReader } from "@/infrastructure/identity/membership-reader";
import { createD1SessionIssuer } from "@/infrastructure/identity/session-issuer";
import { createD1MembershipRepository } from "@/infrastructure/persistence/d1/membership-repository";
import { recordingAuditLog } from "../support/doubles";
import { WORKSPACE, anOwner } from "../support/actors";

/**
 * 担当者の登録を、**本物の D1 と本物のマイグレーション**で一周させる結合テスト。
 *
 * --- なぜこれが要るのか ---
 * 招待の話は、書く側（この画面）と読む側（ログイン）が別の実装に分かれている。
 * どちらも単体では緑にできるが、**間で受け渡す形が食い違うと誰も気づけない**:
 *
 *   1. 招待は小文字で保存されるのに、突き合わせは元の大文字のまま
 *   2. 役割を変えたときに `user_id` が消え、参加済みの人が入れなくなる
 *   3. 担当を外しても、次のログインで通ってしまう
 *
 * どれも画面には何も出ない。出るのは「入れない」「入れてしまう」だけである。
 * だから、招待 → 初回ログイン → 権限が効く → 外す → 入れない、を通しで見る。
 *
 * `drizzle/*.sql` をそのまま流し込む。手で書いた CREATE TABLE は使わない。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §3-5（結合テスト）
 */

type TestEnv = { readonly DB: D1Database };
type Proxy = Awaited<ReturnType<typeof getPlatformProxy<TestEnv>>>;

let proxy: Proxy;
let db: ReturnType<typeof drizzle<typeof schema>>;

const NOW = new Date("2026-08-21T03:00:00Z");
const owner: ActorContext = anOwner();

function migrationStatements(): readonly string[] {
  const dir = path.resolve(process.cwd(), "drizzle");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  expect(files.length).toBeGreaterThan(0);
  return files.flatMap((file) =>
    readFileSync(path.join(dir, file), "utf8")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s !== ""),
  );
}

beforeAll(async () => {
  proxy = await getPlatformProxy<TestEnv>({
    configPath: "wrangler.jsonc",
    environment: "dev",
    persist: false,
  });
  for (const statement of migrationStatements()) {
    await proxy.env.DB.prepare(statement).run();
  }
  db = drizzle(proxy.env.DB, { schema });
}, 60_000);

afterAll(async () => {
  await proxy?.dispose();
});

beforeEach(async () => {
  await proxy.env.DB.prepare("DELETE FROM sessions").run();
  await proxy.env.DB.prepare("DELETE FROM memberships").run();
});

/** 招待を出す口。ID は呼ぶたびに変える（同じ行を作り直さないため）。 */
let seq = 0;
function manage(now = NOW) {
  const audit = recordingAuditLog();
  const repository = createD1MembershipRepository(db);
  const uc = createManageMembersUseCase({
    memberships: repository,
    // 招待の判断にはこの 3 つを使わない。実際に読むのは担当者の表だけである。
    workspaces: notUsed("workspaces"),
    brands: notUsed("brands"),
    disclosures: notUsed("disclosures"),
    auditLog: audit.port,
    ids: { newId: () => `${++seq}` },
    now: () => now,
  });
  return { uc, audit, repository };
}

/**
 * 呼ばれたら落ちるつなぎ目。
 *
 * 見本の実装を渡すと、招待が**知らないうちに見本の作業場所を読んでいた**場合でも
 * 緑になる。ここで落としておけば、読んだ瞬間に分かる。
 */
function notUsed<T>(name: string): T {
  return new Proxy(
    {},
    {
      get() {
        throw new Error(`${name} はここで読まれないはずです`);
      },
    },
  ) as T;
}

describe("招待から参加まで", () => {
  it("招待した行が D1 に残る", async () => {
    const { uc, repository } = manage();
    const result = await uc.execute(owner, {
      action: "invite",
      invitedEmail: "Miwa@Example.com",
      displayName: "みわ",
      roles: ["writer"],
    });
    expect(result.ok).toBe(true);

    const found = await repository.findByInvitedEmail(WORKSPACE, "miwa@example.com");
    expect(found.ok).toBe(true);
    if (!found.ok || found.value === null) throw new Error("行が残っていません");
    expect(found.value.displayName).toBe("みわ");
    expect(found.value.userId).toBeNull();
  });

  it("初めてログインした人の user_id が埋まり、役割が効く", async () => {
    const { uc } = manage();
    await uc.execute(owner, {
      action: "invite",
      invitedEmail: "miwa@example.com",
      displayName: "みわ",
      roles: ["reviewer"],
    });

    // 招待しただけの段階では、権限は引けない。
    const reader = createD1MembershipReader(db);
    const before = await reader.findByUser(WORKSPACE, "u_miwa" as never);
    expect(before.ok && before.value).toBeNull();

    // Google の確認を通って初めて入る。大文字で返ってきても同じ行に当たる。
    const issued = await createD1SessionIssuer(db).issue("u_miwa", "Miwa@Example.com", NOW);
    expect(issued.kind).toBe("issued");

    const after = await reader.findByUser(WORKSPACE, "u_miwa" as never);
    expect(after.ok).toBe(true);
    if (!after.ok || after.value === null) throw new Error("権限を引けません");
    expect(after.value.roles).toEqual(["reviewer"]);
    expect(after.value.acceptedAt).not.toBeNull();
  });

  it("招待の無いアドレスは入れない（名簿だけでは通らない）", async () => {
    // 入口は 2 段。名簿（AUTH_ALLOWED_EMAILS）を通っても、担当者の行が無ければ
    // 通行証は出ない。ここでは行を 1 つも作らずに入ろうとする。
    const issued = await createD1SessionIssuer(db).issue("u_stranger", "stranger@example.com", NOW);
    expect(issued.kind).toBe("not_member");
  });
});

describe("参加したあとに変える", () => {
  async function joined(roles: readonly ["writer"] | readonly ["reviewer"] = ["writer"]) {
    const { uc, repository } = manage();
    const invited = await uc.execute(owner, {
      action: "invite",
      invitedEmail: "miwa@example.com",
      displayName: "みわ",
      roles,
    });
    if (!invited.ok) throw new Error("招待できませんでした");
    await createD1SessionIssuer(db).issue("u_miwa", "miwa@example.com", NOW);
    return { membershipId: invited.value.membershipId, uc, repository };
  }

  it("役割を変えても、参加の事実は消えない", async () => {
    const { membershipId, uc } = await joined();
    const changed = await uc.execute(owner, {
      action: "change_roles",
      membershipId,
      roles: ["publisher"],
      reason: "公開を任せるため",
    });
    expect(changed.ok).toBe(true);

    const reader = createD1MembershipReader(db);
    const after = await reader.findByUser(WORKSPACE, "u_miwa" as never);
    if (!after.ok || after.value === null) throw new Error("権限を引けません");
    // ここが空に戻ると、役割を変えられた人が次のログインまで入れなくなる。
    expect(after.value.roles).toEqual(["publisher"]);
    expect(after.value.userId).toBe("u_miwa");
    expect(after.value.acceptedAt).not.toBeNull();
  });

  it("担当を外した人は、次のログインで入れない", async () => {
    const { membershipId, uc } = await joined();
    const revoked = await uc.execute(owner, {
      action: "revoke",
      membershipId,
      reason: "契約が終わったため",
    });
    expect(revoked.ok).toBe(true);

    // 行は残っている（過去の記録を辿れる）。
    const rows = await createD1MembershipRepository(db).list(WORKSPACE, { limit: 10, cursor: null });
    expect(rows.ok && rows.value.items).toHaveLength(1);

    // それでも、次のログインでは通らない。
    const again = await createD1SessionIssuer(db).issue(
      "u_miwa",
      "miwa@example.com",
      new Date(NOW.getTime() + 60_000),
    );
    expect(again.kind).toBe("not_member");
  });
});
