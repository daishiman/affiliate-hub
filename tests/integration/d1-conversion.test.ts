import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/d1";
import { getPlatformProxy } from "wrangler";
import * as schema from "@/db/schema";
import { createDeps } from "@/infrastructure/composition";
import {
  createAdjustConversionUseCase,
  createGetConversionUseCase,
  createListConversionsUseCase,
} from "@/application/usecases/monetization/manage-affiliate";
import type { ManageAffiliateDeps } from "@/application/usecases/monetization/manage-affiliate";
import { type ActorContext, formatMoney } from "@/domain/shared";
import { SAMPLE_WORKSPACE_ID } from "@/infrastructure/persistence/sample/ranking-sample-repository";
import { anOwner, anOutsider } from "../support/actors";

/**
 * 成果の金額の手修正を、**本物の D1 と本物のマイグレーション**で通す結合テスト。
 *
 * --- なぜこれが要るのか ---
 * 金額の手修正は、これまで保存先が無かった。直した値は返り値にだけ現れ、
 * 次に画面を開くと元の額に戻っていた。**これは数字の話なので、
 * 戻っていることに気づかないまま締めの報告に使われる**のがいちばん怖い。
 *
 * だから「直せた」と言えるのは、次の 3 つが揃ったときだけとする:
 *
 *   1. マイグレーションが `affiliate_conversions` を実際に作る
 *   2. 組み立てた SQL がその表に対して通る（列の綴り・型が合っている）
 *   3. **直した額を読み直せる**（返り値ではなく、読み直しで確かめる）
 *
 * --- ここでいちばん見たいこと ---
 * **取り込んだ額が書き換わらないこと。** 直した額は別の欄に入る。
 * 同じ欄に上書きすると、次の取込との差分が出せなくなり、
 * ASP 側の誤りにも自分の入力ミスにも気づけなくなる。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §3-5（結合テスト）/ REQ-TS07
 */

type TestEnv = { readonly DB: D1Database };
type Proxy = Awaited<ReturnType<typeof getPlatformProxy<TestEnv>>>;

let proxy: Proxy;
let deps: ManageAffiliateDeps;

/** 見本の成果と同じ作業場所にいて、提携の管理を任されている人。 */
const manager: ActorContext = anOwner({ workspaceId: SAMPLE_WORKSPACE_ID });

/** 見本にある、締めていない期間の成果（取込額 1200 円）。 */
const OPEN_CONVERSION = "cv_2026_08_a";
/** 見本にある、締め済みの期間の成果。 */
const CLOSED_CONVERSION = "cv_2026_07_a";

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
  const all = createDeps({ db: drizzle(proxy.env.DB, { schema }) });
  deps = {
    accounts: all.affiliateAccounts,
    programs: all.affiliatePrograms,
    links: all.affiliateLinks,
    conversions: all.conversions,
  };
}, 60_000);

afterAll(async () => {
  await proxy?.dispose();
});

beforeEach(async () => {
  await proxy.env.DB.prepare("DELETE FROM affiliate_conversions").run();
});

const adjust = () => createAdjustConversionUseCase(deps);
const get = () => createGetConversionUseCase(deps);
const list = () => createListConversionsUseCase(deps);

describe("マイグレーションそのもの", () => {
  it("成果の表を実際に作る", async () => {
    const tables = await proxy.env.DB.prepare(
      "select name from sqlite_master where type = 'table'",
    ).all<{ name: string }>();
    expect(tables.results.map((r) => r.name)).toContain("affiliate_conversions");
  });

  it("取り込んだ額と、手で直した額を別の列で持つ", async () => {
    // 1 つの列に上書きすると、次の取込との差分が出せなくなる。
    const columns = await proxy.env.DB.prepare("pragma table_info(affiliate_conversions)").all<{
      name: string;
    }>();
    const names = columns.results.map((r) => r.name);
    expect(names).toContain("ingested_amount_minor");
    expect(names).toContain("adjusted_amount_minor");
    expect(names).toContain("adjustment_reason");
  });
});

describe("成果の金額を直す", () => {
  it("直した額を読み直せる", async () => {
    const done = await adjust().execute(manager, {
      conversionId: OPEN_CONVERSION,
      amountMinor: 1500,
      currency: "JPY",
      reason: "ASP の確定通知に合わせました。",
    });
    if (!done.ok) throw done.error;

    // 返り値ではなく**読み直し**で確かめる。
    // 返り値だけを見ていたので、保存されていないことに長く気づけなかった。
    const again = await get().execute(manager, { conversionId: OPEN_CONVERSION });
    if (!again.ok) throw again.error;
    expect(again.value.view.adjustedLabel).toBe(formatMoney({ amountMinor: 1500, currency: "JPY" }));
    expect(again.value.view.adjustmentReason).toBe("ASP の確定通知に合わせました。");
    // 実際に使う金額も、直したほうへ切り替わっている。
    expect(again.value.view.effectiveLabel).toBe(again.value.view.adjustedLabel);
  });

  it("取り込んだ額は書き換わらない", async () => {
    const before = await get().execute(manager, { conversionId: OPEN_CONVERSION });
    if (!before.ok) throw before.error;
    const ingested = before.value.view.ingestedLabel;

    const done = await adjust().execute(manager, {
      conversionId: OPEN_CONVERSION,
      amountMinor: 9999,
      currency: "JPY",
      reason: "確認のため。",
    });
    if (!done.ok) throw done.error;

    const after = await get().execute(manager, { conversionId: OPEN_CONVERSION });
    if (!after.ok) throw after.error;
    expect(after.value.view.ingestedLabel).toBe(ingested);
    // 直した額のほうは変わっている（取込値が「たまたま同じ」なのではない）。
    expect(after.value.view.adjustedLabel).toBe(formatMoney({ amountMinor: 9999, currency: "JPY" }));
  });

  it("締め済みの期間は直せず、理由が読める言葉で返る", async () => {
    const done = await adjust().execute(manager, {
      conversionId: CLOSED_CONVERSION,
      amountMinor: 1,
      currency: "JPY",
      reason: "締めた後の訂正。",
    });
    expect(done.ok).toBe(false);
    if (done.ok) return;
    expect(done.error.message).toContain("締めている");
    // 記号の羅列を画面へ出さない。
    expect(done.error.message).not.toMatch(/^[A-Z_]+$/);
  });

  it("直せない理由は、押す前と押した後で同じ言葉になる", async () => {
    // 画面が「直せません」と言う理由と、実際に断られる理由がずれると、
    // 押した人はどちらを信じてよいか分からない。
    const shown = await get().execute(manager, { conversionId: CLOSED_CONVERSION });
    if (!shown.ok) throw shown.error;
    expect(shown.value.adjustable).toBe(false);

    const done = await adjust().execute(manager, {
      conversionId: CLOSED_CONVERSION,
      amountMinor: 1,
      currency: "JPY",
      reason: "締めた後の訂正。",
    });
    if (done.ok) throw new Error("締め済みなのに直せてしまいました");
    expect(shown.value.notAdjustableReason).toContain(done.error.message);
  });

  it("別の作業場所の人からは、直すどころか見つからない", async () => {
    const outsider = anOutsider();
    const done = await adjust().execute(outsider, {
      conversionId: OPEN_CONVERSION,
      amountMinor: 1,
      currency: "JPY",
      reason: "他所からの操作。",
    });
    expect(done.ok).toBe(false);
    if (done.ok) return;
    expect(done.error.code).toBe("NOT_FOUND");
  });

  it("直したあとも、一覧から消えない", async () => {
    // 保存した分と見本を重ねる作りなので、**同じ id が 2 件並ばないこと**まで見る。
    await adjust().execute(manager, {
      conversionId: OPEN_CONVERSION,
      amountMinor: 1500,
      currency: "JPY",
      reason: "確定通知に合わせました。",
    });
    const listed = await list().execute(manager, { period: "2026-08" });
    if (!listed.ok) throw listed.error;
    const hit = listed.value.items.filter((c) => c.conversionId === OPEN_CONVERSION);
    expect(hit).toHaveLength(1);
    expect(hit[0]?.adjustedLabel).toBe(formatMoney({ amountMinor: 1500, currency: "JPY" }));
  });
});
