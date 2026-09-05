/**
 * @tier 2
 * @req REQ-BOPC01
 * @req feat-blog-custom-domain
 * @types state-transition, boundary, tenant-isolation, db-migration, db-constraint
 *
 * 住所層 (`site_custom_domain`) を本物の D1 で確かめる。
 *
 * ## なぜ本物の D1 か
 *
 * この表の約束のうち、いちばん重いもの——「取り下げたドメインは
 * 外部の写し取りで復活しない」「同じドメインを 2 つのブログには置けない」
 * 「正規の住所はブログごとに 1 つ」——は、**3 つとも部分ユニーク索引と
 * 遷移表の噛み合わせ**でできている。模造の保存先 (Map) では索引が
 * 1 つも試されないので、噛み合っていないことに気づけない。
 */
import { drizzle } from "drizzle-orm/d1";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getPlatformProxy } from "wrangler";
import type { CustomHostnameSnapshot } from "@/application/ports";
import * as schema from "@/db/schema";
import type { WorkspaceId } from "@/domain/shared";
import {
  createD1CustomDomainRepository,
  resolveCanonicalHostBySiteSlug,
  resolveSiteSlugByHost,
} from "@/infrastructure/persistence/d1/custom-domain-repository";
import { migrationStatements } from "../support/migrations";

type TestEnv = { readonly DB: D1Database };
type Proxy = Awaited<ReturnType<typeof getPlatformProxy<TestEnv>>>;

const OWNER = "ws_domain_owner" as WorkspaceId;
const OUTSIDER = "ws_domain_outsider" as WorkspaceId;
const SITE = "domain-owned-blog";

let proxy: Proxy;
let seq = 0;

function db() {
  return drizzle(proxy.env.DB, { schema });
}

function repo() {
  return createD1CustomDomainRepository({ db: db(), newId: () => `dom_${++seq}` });
}

/** 外部の写しを組み立てる。既定は「配信中・証明書あり」。 */
function snapshot(over: Partial<CustomHostnameSnapshot> = {}): CustomHostnameSnapshot {
  return {
    externalHostnameId: "cf_1",
    status: "active",
    certificateStatus: "issued",
    lastError: null,
    instructions: [],
    ...over,
  };
}

/**
 * 登録から配信中まで進める。
 *
 * `pending` から直接 `active` へは飛べない (遷移表がそう決めている)。
 * 所有権の確認を挟まずに配信中へ跳ぶ経路を作らないためで、外部の写しが
 * その順で来ることも、こちらが飛ばして書くこともない。
 */
async function activateDomain(hostname: string): Promise<string> {
  const r = repo();
  const registered = await r.register(OWNER, SITE, hostname);
  if (!registered.ok) throw new Error("前提が崩れた");
  await r.applySnapshot(
    OWNER,
    registered.value.id,
    snapshot({ status: "verifying", certificateStatus: "pending" }),
    new Date(),
  );
  const active = await r.applySnapshot(OWNER, registered.value.id, snapshot(), new Date());
  if (!active.ok) throw new Error("前提が崩れた");
  return registered.value.id;
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
}, 60_000);

afterAll(async () => {
  await proxy?.dispose();
});

beforeEach(async () => {
  await proxy.env.DB.prepare("DELETE FROM site_custom_domain").run();
});

describe("既定住所と独自ドメインの関係", () => {
  it("1 件も登録していないブログは行を持たない（既定住所は行ではない）", async () => {
    const listed = await repo().listForSite(OWNER, SITE);
    expect(listed.ok && listed.value).toEqual([]);
  });

  it("登録直後は pending で、正規の住所にはなっていない", async () => {
    const registered = await repo().register(OWNER, SITE, "Blog.Example.com");
    expect(registered.ok).toBe(true);
    if (!registered.ok) return;
    // 大文字と末尾ドットは正規化される。同じ住所が 2 通りに書けると、
    // 一意索引をすり抜けて二重登録できてしまう。
    expect(registered.value.hostname).toBe("blog.example.com");
    expect(registered.value.status).toBe("pending");
    expect(registered.value.canonical).toBe(false);
  });
});

describe("取り下げは終端である", () => {
  it("取り下げた後に外部が active を運んできても復活しない", async () => {
    const r = repo();
    const registered = await r.register(OWNER, SITE, "gone.example.com");
    if (!registered.ok) throw new Error("前提が崩れた");
    await r.revoke(OWNER, registered.value.id, "運用者が取り下げた");

    const applied = await r.applySnapshot(OWNER, registered.value.id, snapshot(), new Date());
    expect(applied.ok).toBe(false);

    const listed = await r.listForSite(OWNER, SITE);
    expect(listed.ok && listed.value[0]?.status).toBe("revoked");
  });

  it("取り下げた住所は、新しい行として登録し直せる（部分ユニーク索引の要）", async () => {
    const r = repo();
    const first = await r.register(OWNER, SITE, "reuse.example.com");
    if (!first.ok) throw new Error("前提が崩れた");
    await r.revoke(OWNER, first.value.id, "いったん外す");

    const second = await r.register(OWNER, SITE, "reuse.example.com");
    expect(second.ok).toBe(true);
    // 復活ではなく別の行。取り下げた判断は履歴として残る。
    expect(second.ok && second.value.id).not.toBe(first.value.id);
  });

  it("同じ住所を生きたまま 2 度登録することはできない", async () => {
    const r = repo();
    await r.register(OWNER, SITE, "dup.example.com");
    const again = await r.register(OWNER, "another-blog", "dup.example.com");
    expect(again.ok).toBe(false);
    // 「保存に失敗した」ではなく、業務上の答えとして返っていること。
    expect(again.ok === false && again.error.code).toBe("CONFLICT");
  });
});

describe("正規の住所はブログごとに 1 つ", () => {
  const activate = activateDomain;

  it("切り替えると前の行の canonical が降りる", async () => {
    const first = await activate("one.example.com");
    const second = await activate("two.example.com");
    const r = repo();

    await r.setCanonical(OWNER, SITE, first);
    await r.setCanonical(OWNER, SITE, second);

    const listed = await r.listForSite(OWNER, SITE);
    if (!listed.ok) throw new Error("読み出しに失敗");
    expect(listed.value.filter((d) => d.canonical).map((d) => d.id)).toEqual([second]);
  });

  it("配信中でない住所は正規にできない", async () => {
    const r = repo();
    const registered = await r.register(OWNER, SITE, "pending.example.com");
    if (!registered.ok) throw new Error("前提が崩れた");
    const set = await r.setCanonical(OWNER, SITE, registered.value.id);
    expect(set.ok).toBe(false);
  });

  it.each(["pending", "error"] as const)(
    "active でも証明書が %s の住所は正規にできない",
    async (certificateStatus) => {
      const r = repo();
      const registered = await r.register(OWNER, SITE, `${certificateStatus}.example.com`);
      if (!registered.ok) throw new Error("前提が崩れた");
      await r.applySnapshot(
        OWNER,
        registered.value.id,
        snapshot({ status: "verifying", certificateStatus: "pending" }),
        new Date(),
      );
      const active = await r.applySnapshot(
        OWNER,
        registered.value.id,
        snapshot({ status: "active", certificateStatus }),
        new Date(),
      );
      expect(active.ok).toBe(true);

      const set = await r.setCanonical(OWNER, SITE, registered.value.id);
      expect(set.ok).toBe(false);
    },
  );

  it("active から落ちると canonical も同時に降りる（画面と配信先を食い違わせない）", async () => {
    const id = await activate("drop.example.com");
    const r = repo();
    await r.setCanonical(OWNER, SITE, id);

    await r.applySnapshot(
      OWNER,
      id,
      snapshot({ status: "failed", certificateStatus: "error", lastError: "DNS が見つからない" }),
      new Date(),
    );

    const listed = await r.listForSite(OWNER, SITE);
    expect(listed.ok && listed.value[0]?.canonical).toBe(false);
  });

  it.each(["pending", "error"] as const)(
    "active のまま証明書が %s に落ちたら canonical も同時に降りる",
    async (certificateStatus) => {
      const id = await activate(`certificate-${certificateStatus}.example.com`);
      const r = repo();
      await r.setCanonical(OWNER, SITE, id);

      await r.applySnapshot(
        OWNER,
        id,
        snapshot({ status: "active", certificateStatus }),
        new Date(),
      );

      const listed = await r.listForSite(OWNER, SITE);
      expect(listed.ok && listed.value[0]?.canonical).toBe(false);
      expect(await resolveCanonicalHostBySiteSlug(db(), SITE)).toBeNull();
    },
  );
});

describe("公開側の照会と所有境界", () => {
  it("配信中の住所だけがブログへ解決する", async () => {
    const r = repo();
    const registered = await r.register(OWNER, SITE, "live.example.com");
    if (!registered.ok) throw new Error("前提が崩れた");

    // まだ pending。検証中の住所で読者を通すと、証明書の無いホストへ案内する。
    expect(await resolveSiteSlugByHost(db(), "live.example.com")).toBeNull();

    await r.applySnapshot(
      OWNER,
      registered.value.id,
      snapshot({ status: "verifying", certificateStatus: "pending" }),
      new Date(),
    );
    // 確認中もまだ通さない。
    expect(await resolveSiteSlugByHost(db(), "live.example.com")).toBeNull();

    await r.applySnapshot(OWNER, registered.value.id, snapshot(), new Date());
    expect(await resolveSiteSlugByHost(db(), "live.example.com")).toBe(SITE);
  });

  it.each(["pending", "error"] as const)(
    "active でも証明書が %s の住所は公開側で解決しない",
    async (certificateStatus) => {
      const r = repo();
      const hostname = `unavailable-${certificateStatus}.example.com`;
      const registered = await r.register(OWNER, SITE, hostname);
      if (!registered.ok) throw new Error("前提が崩れた");
      await r.applySnapshot(
        OWNER,
        registered.value.id,
        snapshot({ status: "verifying", certificateStatus: "pending" }),
        new Date(),
      );
      const active = await r.applySnapshot(
        OWNER,
        registered.value.id,
        snapshot({ status: "active", certificateStatus }),
        new Date(),
      );
      expect(active.ok).toBe(true);

      expect(await resolveSiteSlugByHost(db(), hostname)).toBeNull();
    },
  );

  it("正規の住所は逆向きにも引ける（canonical を組むため）", async () => {
    const r = repo();
    // 正規に立てていないうちは、公開側は既定の住所を正本とする。
    expect(await resolveCanonicalHostBySiteSlug(db(), SITE)).toBeNull();

    const id = await activateDomain("canonical.example.com");
    expect(await resolveCanonicalHostBySiteSlug(db(), SITE)).toBeNull();

    await r.setCanonical(OWNER, SITE, id);
    expect(await resolveCanonicalHostBySiteSlug(db(), SITE)).toBe("canonical.example.com");

    // 配信が止まれば正本も降りる。降りない実装だと、生きていない住所を
    // 検索エンジンへ「こちらが正本」と宣言し続けることになる。
    await r.applySnapshot(
      OWNER,
      id,
      snapshot({ status: "failed", certificateStatus: "error", lastError: "証明書が失効" }),
      new Date(),
    );
    expect(await resolveCanonicalHostBySiteSlug(db(), SITE)).toBeNull();
  });

  it("他の workspace の id を指しても触れない", async () => {
    const r = repo();
    const registered = await r.register(OWNER, SITE, "tenant.example.com");
    if (!registered.ok) throw new Error("前提が崩れた");

    const revoked = await r.revoke(OUTSIDER, registered.value.id, "他人の住所");
    expect(revoked.ok).toBe(false);

    const listed = await r.listForSite(OWNER, SITE);
    expect(listed.ok && listed.value[0]?.status).toBe("pending");
  });
});
