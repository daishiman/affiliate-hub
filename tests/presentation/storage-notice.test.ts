import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

/**
 * 「いま何で動いているか」の言葉が、接続の有無で本当に変わることを見る。
 *
 * --- なぜこれが要るのか ---
 * 2026-08-17、保存先を D1 につないだあとも画面が
 * 「しばらくすると消えます」と言い続けた。原因は**画面側が条件を
 * 文字で持っていた**こと。判断の材料（接続があるか）は入口にあるのに、
 * 言葉は画面にあったため、材料が変わっても言葉が変わらなかった。
 *
 * 直したあとも、次に保存先を 1 つつないだ人が
 * 同じ書き方（画面に固定文を書く）に戻れば、また同じことが起きる。
 * ここでは**入口にある `〜Notice()` を全部見つけてきて**、
 * どれも接続の有無で答えが変わることを確かめる。
 * お知らせを 1 つ足した日から検査対象に入る（対象表を人が書き足さない）。
 *
 * 規範: docs/architecture/testing-architecture.md §4-2
 */

vi.mock("server-only", () => ({}));

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

/** 入口から、保存先のお知らせを返す関数の名前を読み取る。 */
function noticeNames(): readonly string[] {
  const source = readFileSync(`${ROOT}src/presentation/composition.ts`, "utf-8");
  // **返す型で選ぶ。** 名前だけで選ぶと、ログイン状態の案内（ただの文字列）まで
  // 拾ってしまい、検査が「何を見ているのか」を言えなくなる。
  const names = [
    ...source.matchAll(/export async function (\w+)\(\): Promise<StorageStatus>/g),
  ].map((m) => m[1]);
  // 1 件も拾えていないのに緑になるのが最悪なので、そこだけ先に落とす。
  expect(names.length).toBeGreaterThan(0);
  return names;
}

type Notices = Record<string, () => Promise<Record<string, unknown>>>;

async function noticesWith(env: Record<string, unknown>): Promise<Notices> {
  vi.resetModules();
  vi.doMock("@opennextjs/cloudflare", () => ({
    // D1 の実体は要らない。お知らせは問い合わせを 1 度もしない。
    getCloudflareContext: async () => ({ env }),
  }));
  return (await import("@/presentation/composition")) as unknown as Notices;
}

describe("いま何で動いているかのお知らせ", () => {
  it("接続が無いときは、保存されるとは言わない", async () => {
    const mod = await noticesWith({});
    for (const name of noticeNames()) {
      const status = await mod[name]();
      expect(status.persisted, `${name} が接続なしで保存済みと言っています`).toBe(false);
      const message = String(status.message);
      expect(message.trim(), `${name} が黙っています`).not.toBe("");
      // 「保存されます」と読める言い方をしない。ここを間違えると、
      // 消えることを知らないまま作業した分がまるごと失われる。
      expect(message, `${name}: ${message}`).not.toContain("保存されます");
      expect(String(status.stubId).trim()).not.toBe("");
      expect(String(status.blockedBy).trim()).not.toBe("");
    }
  });

  it("接続があるときも黙らず、消えるとは言わない", async () => {
    const mod = await noticesWith({ DB: { prepare: () => ({}) } });
    for (const name of noticeNames()) {
      const status = await mod[name]();
      expect(status.persisted, `${name} が接続ありで見本と言っています`).toBe(true);
      const message = String(status.message);
      expect(message.trim(), `${name} が黙っています`).not.toBe("");
      expect(message, `${name}: ${message}`).toContain("保存されます");
    }
  });

  it("接続の有無で、見せる 1 文が実際に変わる", async () => {
    const without = await noticesWith({});
    const messages = new Map<string, string>();
    for (const name of noticeNames()) messages.set(name, String((await without[name]()).message));

    const withDb = await noticesWith({ DB: { prepare: () => ({}) } });
    for (const name of noticeNames()) {
      const after = String((await withDb[name]()).message);
      // 同じ文が出るなら、それは条件を見ていないということ。
      expect(after, `${name} の文が接続の有無で変わっていません`).not.toBe(messages.get(name));
    }
  });
});
