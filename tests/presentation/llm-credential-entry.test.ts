/** @tier 1 */
import { describe, expect, it } from "vitest";
import { createLlmCredentialManagement } from "@/infrastructure/composition";
import { llmCredentialEntry } from "@/presentation/composition";

/**
 * 鍵を預かれないとき、**理由が 1 行出る**ことを固定する。
 *
 * --- なぜここを検査するか ---
 * 預かれない状態は 3 つあり（保存先が無い・元締めの鍵が無い・元締めの鍵が短い）、
 * 利用者がやることは 3 つとも違う。ところが画面の見え方はどれも
 * 「登録できない」で同じである。理由を出さないと、鍵を貼り直す・
 * 別の提供元を試す、といった**関係のない作業**へ人を歩かせる。
 *
 * そして「理由を出す」は、条件式が成立しないと**無言**になる壊れ方をする。
 * 無言は例外を出さないので、画面を見ても壊れて見えない。
 * だから文言が出ること自体を固定する。
 *
 * --- この検査が見ていないこと ---
 * 文言そのものの良し悪しは見ていない。空でないこと・3 つが別の文であること、
 * そして**鍵の値らしきものが混ざっていない**ことだけを見る。
 *
 * 規範: docs/product/credential-registration.md
 * @req REQ-SEC01
 * @types secrets, infra-config
 */

const LONG_ENOUGH = "x".repeat(64);
const FAKE_DB = {} as never;

describe("鍵を預かれないときの理由", () => {
  it("保存先につながっていないときは、その理由が出る", () => {
    const built = createLlmCredentialManagement({ db: null, env: {} });
    expect(built.ready).toBe(false);
    if (built.ready) return;
    expect(built.reason).not.toBe("");
    expect(built.reason).toContain("保存先");
  });

  it("元締めの鍵が無いときは、登録の手順が出る", () => {
    const built = createLlmCredentialManagement({ db: FAKE_DB, env: {} });
    expect(built.ready).toBe(false);
    if (built.ready) return;
    expect(built.reason).toContain("LLM_KEY_ENCRYPTION_SECRET");
    // **値を貼らせない**ことまで書いてある。書かないと、チャットへ貼られる。
    expect(built.reason).toContain("貼らないで");
  });

  it("元締めの鍵が短いときは、短いと分かる理由が出る", () => {
    const built = createLlmCredentialManagement({
      db: FAKE_DB,
      env: { LLM_KEY_ENCRYPTION_SECRET: "short" },
    });
    expect(built.ready).toBe(false);
    if (built.ready) return;
    expect(built.reason).toContain("短すぎます");
  });

  it("3 つの理由は互いに別の文である（同じ文言で片づけていない）", () => {
    const reasons = [
      createLlmCredentialManagement({ db: null, env: {} }),
      createLlmCredentialManagement({ db: FAKE_DB, env: {} }),
      createLlmCredentialManagement({ db: FAKE_DB, env: { LLM_KEY_ENCRYPTION_SECRET: "short" } }),
    ].map((b) => (b.ready ? "" : b.reason));
    expect(new Set(reasons).size).toBe(3);
  });

  it("預かれないときも、提供元の一覧を返す口は残っている", async () => {
    // 鍵をどこで発行するかの案内は、**登録できない状態でこそ要る**。
    const built = createLlmCredentialManagement({ db: null, env: {} });
    expect(built.ready).toBe(false);
    if (built.ready) return;
    const providers = await built.catalog.listProviders();
    expect(providers.ok).toBe(true);
  });

  it("画面の入口も、預かれないときは理由つきで返す（空の一覧で誤魔化さない）", async () => {
    // ここは実行環境（Cloudflare）が無い状態で動く。
    // つまり保存先も元締めの鍵も無い＝利用者が最初に見る状態そのものである。
    const entry = await llmCredentialEntry();
    expect(entry.ready).toBe(false);
    if (entry.ready) return;
    expect(entry.reason.length).toBeGreaterThan(0);
  });

  it("理由に、元締めの鍵の値そのものが混ざらない", () => {
    const built = createLlmCredentialManagement({
      db: FAKE_DB,
      env: { LLM_KEY_ENCRYPTION_SECRET: LONG_ENOUGH.slice(0, 10) },
    });
    expect(built.ready).toBe(false);
    if (built.ready) return;
    expect(built.reason).not.toContain(LONG_ENOUGH.slice(0, 10));
  });
});
