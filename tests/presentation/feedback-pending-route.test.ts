/** @tier 1 */
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 取りに来る経路（GET /api/feedback/pending）。
 *
 * --- ここでしか確かめられないこと ---
 *
 * 指示文の中身（何を入れて何を入れないか）は domain 側の検査が固定してある。
 * この入口に残っているのは**手前の判定**——鍵があるか・失効していないか・
 * その鍵にその権限があるか・回数の上限を超えていないか——と、
 * 取りに来た結果が「渡した」として記録されることの 2 つ。
 * 入口を実際に叩かないと、判定を 1 つ飛ばしても誰も気づけない。
 *
 * --- 失敗の言い分けをしないことを見る ---
 *
 * 「その鍵は存在しません」と「その鍵では読めません」を言い分けると、
 * 存在する鍵を総当たりで探せてしまう。無い鍵と潰れた保存先が
 * 同じ文言・同じ番号で返ることを固定する。
 */

vi.mock("server-only", () => ({}));
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: {} }),
}));

const route = await import("@/app/api/feedback/pending/route");
const { issueIntegrationKey } = await import("@/domain/feedback");
const { asIntegrationKeyId, asWorkspaceId } = await import("@/domain/shared");
const { hashSecret } = await import("@/infrastructure/platform/secret-minter");
const { clearFeedbackStore, seedIntegrationKey } = await import(
  "@/infrastructure/persistence/sample/feedback-sample-repository"
);

const WS = asWorkspaceId("ws_sample");
const ORIGIN = "https://hub.test";

/** 見本の作業場所に、指定した権限の鍵を 1 本置く。平文は呼び出し側だけが持つ。 */
async function seedKey(options: {
  readonly id: string;
  readonly plainValue: string;
  readonly scopes: readonly ("read" | "update_status")[];
  readonly revokedAt?: Date;
  readonly rateLimitPerMinute?: number;
}): Promise<void> {
  const built = issueIntegrationKey({
    id: asIntegrationKeyId(options.id),
    workspaceId: WS,
    label: `試験用 ${options.id}`,
    hashedValue: await hashSecret(options.plainValue),
    scopes: options.scopes,
    createdBy: "tester",
    at: new Date("2026-08-01T00:00:00Z"),
    rateLimitPerMinute: options.rateLimitPerMinute,
  });
  if (!built.ok) throw new Error(built.error.message);
  seedIntegrationKey(
    options.revokedAt === undefined ? built.value : { ...built.value, revokedAt: options.revokedAt },
  );
}

function get(headers: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}/api/feedback/pending`, { headers });
}

function withKey(plainValue: string): Record<string, string> {
  return { authorization: `Bearer ${plainValue}` };
}

describe("取りに来る経路の手前の判定", () => {
  beforeEach(() => {
    clearFeedbackStore();
  });

  it("鍵が無ければ 401 で、付け方を伝える", async () => {
    const res = await route.GET(get());
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("Authorization");
  });

  it("知らない鍵は 401 で、存在の有無を言い分けない", async () => {
    const res = await route.GET(get(withKey("this-key-was-never-issued-0000000000")));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("この鍵では取得できません。");
  });

  it("失効した鍵は 401 で、新しく発行するよう伝える", async () => {
    const plain = "revoked-plain-value-for-tests-0000000";
    await seedKey({
      id: "ik_revoked",
      plainValue: plain,
      scopes: ["read"],
      revokedAt: new Date("2026-08-02T00:00:00Z"),
    });

    const res = await route.GET(get(withKey(plain)));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("失効");
  });

  it("読む権限が無い鍵は 403 で、失効と区別できる", async () => {
    const plain = "status-only-plain-value-for-tests-000";
    await seedKey({ id: "ik_status_only", plainValue: plain, scopes: ["update_status"] });

    const res = await route.GET(get(withKey(plain)));
    expect(res.status).toBe(403);
  });

  it("1 分あたりの上限を超えたら 429 で、待てば通ると伝える", async () => {
    const plain = "rate-limited-plain-value-for-tests-00";
    await seedKey({
      id: "ik_rate",
      plainValue: plain,
      scopes: ["read"],
      rateLimitPerMinute: 1,
    });

    expect((await route.GET(get(withKey(plain)))).status).toBe(200);
    const second = await route.GET(get(withKey(plain)));
    expect(second.status).toBe(429);
    const body = (await second.json()) as { error: string };
    expect(body.error).toContain("待って");
  });
});

describe("取りに来た結果", () => {
  beforeEach(() => {
    clearFeedbackStore();
  });

  it("未対応でまだ渡していないものを指示文つきで返す", async () => {
    const plain = "reader-plain-value-for-tests-00000001";
    await seedKey({ id: "ik_reader_1", plainValue: plain, scopes: ["read"] });

    const res = await route.GET(get(withKey(plain)));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      reports: { id: string; prompt: string; templateVersion: string; fingerprint: string }[];
      message: string;
    };

    expect(body.reports.length).toBeGreaterThan(0);
    for (const r of body.reports) {
      expect(r.prompt).not.toBe("");
      expect(r.templateVersion).not.toBe("");
      expect(r.fingerprint).not.toBe("");
    }
  });

  it("氏名・メールアドレス・画像・鍵の値を返さない", async () => {
    const plain = "reader-plain-value-for-tests-00000002";
    await seedKey({ id: "ik_reader_2", plainValue: plain, scopes: ["read"] });

    const res = await route.GET(get(withKey(plain)));
    const raw = JSON.stringify(await res.json());

    expect(raw).not.toContain(plain);
    expect(raw).not.toContain("@");
    expect(raw).not.toContain("data:image");
    expect(raw.toLowerCase()).not.toContain("base64");
  });

  it("2 回目は空になる（同じ要望を二重に持ち帰らせない）", async () => {
    const plain = "reader-plain-value-for-tests-00000003";
    await seedKey({ id: "ik_reader_3", plainValue: plain, scopes: ["read"] });

    const first = (await (await route.GET(get(withKey(plain)))).json()) as {
      reports: unknown[];
    };
    expect(first.reports.length).toBeGreaterThan(0);

    const second = await route.GET(get(withKey(plain)));
    expect(second.status).toBe(200);
    const body = (await second.json()) as { reports: unknown[]; message: string };
    expect(body.reports).toHaveLength(0);
    expect(body.message).toContain("ありません");
  });

  it("取りに来たことが、誰が・どの鍵でとして要望の履歴に残る", async () => {
    const plain = "reader-plain-value-for-tests-00000004";
    await seedKey({ id: "ik_reader_4", plainValue: plain, scopes: ["read"] });

    await route.GET(get(withKey(plain)));

    const { createDeps } = await import("@/infrastructure/composition");
    const found = await createDeps().feedback.findById(WS, "fb_sample_sort");
    if (!found.ok || found.value === null) throw new Error("見本の要望が読めませんでした");

    const entry = found.value.handoff.entries.at(-1);
    expect(entry?.route).toBe("pulled_by_agent");
    expect(entry?.keyId).toBe("ik_reader_4");
    expect(entry?.actor).toContain("ik_reader_4");
    // 平文が履歴に混ざっていないこと。混ざると履歴を見た人が鍵を使える。
    expect(JSON.stringify(found.value.handoff)).not.toContain(plain);
  });

  it("使った記録が鍵側にも残る（最後に使った日が入る）", async () => {
    const plain = "reader-plain-value-for-tests-00000005";
    await seedKey({ id: "ik_reader_5", plainValue: plain, scopes: ["read"] });

    await route.GET(get(withKey(plain)));

    const { createDeps } = await import("@/infrastructure/composition");
    const listed = await createDeps().integrationKeys.list(WS);
    if (!listed.ok) throw new Error("鍵の一覧が読めませんでした");
    const used = listed.value.find((k) => String(k.id) === "ik_reader_5");
    expect(used?.lastUsedAt).not.toBeNull();
  });
});
