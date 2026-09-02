/**
 * @tier 2
 * @req REQ-SEC06, REQ-SEC07, REQ-QC09, REQ-QC11
 * @types db-migration, tenant-isolation, decision-table
 *
 * 広告表記と表記のきまりの**保存先**を、本物の D1 と本物のマイグレーションで通す。
 *
 * --- ここでいちばん見たいこと ---
 * 1. **初期の 13 件が、行を 1 件も入れていない作業場所でも効いている。**
 *    表を空のまま始めると、記事の確認は「違反 0 件」で緑になる。
 *    緑の理由が「守れている」なのか「何も見ていない」なのかは、
 *    画面からは区別が付かない。
 * 2. **止めたきまりが、他の作業場所まで止めない。**
 *    初期ルールは全作業場所で同じ ID の形をしているので、
 *    作業場所で絞れていないと 1 社の操作が全社に効く。
 * 3. 広告表記が作業場所をまたいで読めない。
 *
 * 規範: docs/product/traceability.md REQ-SEC06 / docs/spec/10-テスト戦略仕様.md §3-5
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/d1";
import { getPlatformProxy } from "wrangler";
import * as schema from "@/db/schema";
import type { DisclosureRepositoryPort, PolicyRuleRepositoryPort } from "@/application/ports/compliance";
import { createD1DisclosureRepository } from "@/infrastructure/persistence/d1/disclosure-repository";
import { createD1PolicyRuleRepository } from "@/infrastructure/persistence/d1/policy-rule-repository";
import { createDisclosure, createPolicyRule } from "@/domain/compliance";
import type { DisclosureId, PolicyRuleId, WorkspaceId } from "@/domain/shared";
import { taggedString } from "@/domain/shared";
import { SAMPLE_WORKSPACE_ID } from "@/infrastructure/persistence/sample/ranking-sample-repository";
import { migrationStatements } from "../support/migrations";

type TestEnv = { readonly DB: D1Database };
type Proxy = Awaited<ReturnType<typeof getPlatformProxy<TestEnv>>>;

let proxy: Proxy;
let rules: PolicyRuleRepositoryPort;
let disclosures: DisclosureRepositoryPort;

const WS = SAMPLE_WORKSPACE_ID as WorkspaceId;
const OTHER_WS = taggedString<"WorkspaceId">("ws_other") as WorkspaceId;

beforeAll(async () => {
  proxy = await getPlatformProxy<TestEnv>({
    configPath: "wrangler.jsonc",
    environment: "dev",
    persist: false,
  });
  for (const statement of migrationStatements()) {
    await proxy.env.DB.prepare(statement).run();
  }
  const db = drizzle(proxy.env.DB, { schema });
  rules = createD1PolicyRuleRepository(db);
  disclosures = createD1DisclosureRepository(db);
}, 60_000);

afterAll(async () => {
  await proxy?.dispose();
});

beforeEach(async () => {
  await proxy.env.DB.prepare("DELETE FROM policy_rules").run();
  await proxy.env.DB.prepare("DELETE FROM disclosures").run();
});

/** 保存できるきまりを 1 件作る。作れないものはここで落とす。 */
function aRule(over: {
  readonly id: string;
  readonly workspaceId?: WorkspaceId;
  readonly name?: string;
  readonly enabled?: boolean;
}) {
  const built = createPolicyRule({
    id: taggedString<"PolicyRuleId">(over.id) as PolicyRuleId,
    workspaceId: over.workspaceId ?? WS,
    name: over.name ?? "自社: 最上級の言い切り",
    domainScope: "general",
    channelScope: "any",
    severity: "warn",
    pattern: "日本一|世界一",
    basis: "景品表示法 第5条（優良誤認）",
    suggestion: "比較の範囲を書く（例: 当社調べ・2026 年 8 月時点）",
    enabled: over.enabled ?? true,
  });
  if (!built.ok) throw new Error(built.error.message);
  return built.value;
}

function aDisclosure(over: { readonly id: string; readonly workspaceId?: WorkspaceId }) {
  const built = createDisclosure({
    id: taggedString<"DisclosureId">(over.id) as DisclosureId,
    workspaceId: over.workspaceId ?? WS,
    relationshipType: "affiliate",
    editorialInfluence: "none",
    aiAssisted: false,
  });
  if (!built.ok) throw new Error(built.error.message);
  return built.value;
}

describe("表記のきまり（D1）", () => {
  it("行を 1 件も入れていない作業場所でも、初期のきまりが効いている", async () => {
    const listed = await rules.listEnabled(WS);
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    // **0 件になったら、この作業場所の記事は何も確認されない。**
    expect(listed.value.length).toBeGreaterThanOrEqual(13);
    expect(listed.value.every((r) => String(r.workspaceId) === String(WS))).toBe(true);
  });

  it("足したきまりが、初期のきまりに重なって返る", async () => {
    const saved = await rules.save(aRule({ id: "pol_own_1" }));
    expect(saved.ok).toBe(true);

    const listed = await rules.listEnabled(WS);
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.map((r) => String(r.id))).toContain("pol_own_1");
  });

  it("初期のきまりを止めると、その作業場所からだけ消える", async () => {
    const seeded = await rules.listEnabled(WS);
    if (!seeded.ok) return;
    const target = seeded.value[0];
    expect(target).toBeDefined();
    if (target === undefined) return;

    const stopped = await rules.save({ ...target, enabled: false });
    expect(stopped.ok).toBe(true);

    const after = await rules.listEnabled(WS);
    const other = await rules.listEnabled(OTHER_WS);
    expect(after.ok && other.ok).toBe(true);
    if (!after.ok || !other.ok) return;
    expect(after.value.map((r) => String(r.id))).not.toContain(String(target.id));
    // **他社では止まっていない。**初期ルールは ID の形が同じなので、
    // 作業場所で絞れていないと 1 社の操作が全社に効く。
    expect(other.value.length).toBeGreaterThanOrEqual(13);
  });

  it("他の作業場所の行を、同じ ID で上書きできない", async () => {
    const mine = await rules.save(aRule({ id: "pol_shared", workspaceId: WS }));
    expect(mine.ok).toBe(true);

    const theirs = await rules.save(
      aRule({ id: "pol_shared", workspaceId: OTHER_WS, name: "乗っ取り" }),
    );
    expect(theirs.ok).toBe(false);
    if (theirs.ok) return;
    expect(theirs.error.code).toBe("CONFLICT");

    const found = await rules.findById(WS, taggedString<"PolicyRuleId">("pol_shared") as PolicyRuleId);
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.value?.name).toBe("自社: 最上級の言い切り");
  });

  it("他の作業場所のきまりは、ID を知っていても引けない", async () => {
    await rules.save(aRule({ id: "pol_mine", workspaceId: WS }));
    const found = await rules.findById(
      OTHER_WS,
      taggedString<"PolicyRuleId">("pol_mine") as PolicyRuleId,
    );
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.value).toBeNull();
  });
});

describe("広告表記（D1）", () => {
  it("保存した表示文が、そのまま読み出せる", async () => {
    const saved = await disclosures.save(aDisclosure({ id: "dc_1" }));
    expect(saved.ok).toBe(true);

    const listed = await disclosures.list(WS, { limit: 10, cursor: null });
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.items).toHaveLength(1);
    // 読み出しで文を組み立て直していないこと。保存した文がそのまま出る。
    expect(listed.value.items[0]?.visibleMessage).toBe(
      "アフィリエイト広告を利用しています。評価内容に広告主は関与していません。",
    );
  });

  it("他の作業場所の広告表記が混ざらない", async () => {
    await disclosures.save(aDisclosure({ id: "dc_mine", workspaceId: WS }));
    await disclosures.save(aDisclosure({ id: "dc_theirs", workspaceId: OTHER_WS }));

    const listed = await disclosures.list(WS, { limit: 10, cursor: null });
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.items.map((d) => String(d.id))).toEqual(["dc_mine"]);
  });

  it("他の作業場所の行を、同じ ID で上書きできない", async () => {
    await disclosures.save(aDisclosure({ id: "dc_shared", workspaceId: WS }));
    const theirs = await disclosures.save(aDisclosure({ id: "dc_shared", workspaceId: OTHER_WS }));
    expect(theirs.ok).toBe(false);
    if (theirs.ok) return;
    expect(theirs.error.code).toBe("CONFLICT");
  });
});
