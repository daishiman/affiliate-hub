/**
 * @tier 1
 * @req REQ-CI14
 * @types infra-config, equivalence, boundary, secrets
 *
 * 印を 1 行に収めてあるのは、`scripts/required-test-types.mjs` の `@req` の
 * 読み取りが `*` で止まるためで、折り返すと 2 行目の要件が黙って落ちる。
 *
 * **見張っているのは「見張りが見張りでなくなる形」である。**
 *
 * この見張りには、緑のまま無意味になる道が 3 本ある。
 *
 *   1. 公開のあいだに **0% を報告する**。分母が無いので必ず 0% になり、
 *      「余裕がある」と読まれる緑が毎週 1 つ増える。
 *   2. 非公開になったのに**トークンが無いまま黙って通る**。
 *      見ていないのに「見ている」と思われる状態が続く。
 *   3. しきい値を yml に書き写す。正本を直しても機械だけが古い基準で走る。
 *
 * 3 本とも、ここで落ちる。
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ACTIONS_USAGE,
  fetchAccountUsage,
  judgeArmed,
  judgeRun,
  judgeUsage,
  judgeVisibility,
  readUsageOverride,
} from "../../scripts/actions-usage.mjs";
import { ACTIONS_USAGE as QUALITY_GATE_ACTIONS_USAGE } from "../../quality-gates.config.mjs";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

/** コメント行を落とした本体だけ。理由書きまで禁じると、書くほど赤くなる。 */
const codeOf = (text: string) =>
  text
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .join("\n");

describe("REQ-CI14 §1 公開のあいだは、使用率を出さない", () => {
  it("公開リポジトリでは、そもそも判定の対象にしない", () => {
    expect(judgeVisibility("public").applicable).toBe(false);
  });

  it("非公開・組織内は対象にする", () => {
    expect(judgeVisibility("private").applicable).toBe(true);
    expect(judgeVisibility("internal").applicable).toBe(true);
  });

  it("公開・非公開のどちらか分からない値は、緑にせず判定しない", () => {
    // 空文字や綴り違いで「対象外＝緑」に落ちると、見張りは黙って消える。
    for (const v of [undefined, "", "PUBLIQUE", "unknown"]) {
      expect(judgeVisibility(v).applicable).toBe(false);
      expect(judgeVisibility(v).reason).not.toBe("");
    }
  });

  it("公開のとき、出力に「%」が 1 度も現れない（0% と書かない）", () => {
    // ここがこの検査の中心。0% は「余裕がある」ではなく「測っていない」である。
    const out = judgeRun({ visibility: "public", hasToken: false }).lines.join("\n");
    expect(out).not.toMatch(/\d\s*%/);
    expect(out).toContain("::notice::");
    expect(out).not.toContain("::error::");
  });
});

describe("REQ-CI14 §2 しきい値の境目", () => {
  const pct = (minutes: number) => judgeUsage({ minutesUsed: minutes });

  it("枠のちょうど 70%（1,400 分）は警告にしない", () => {
    // ここを警告にすると、宣言した 70% が実質 69.9% になる。
    expect(pct(1400).percent).toBe(70);
    expect(pct(1400).level).toBe("ok");
    expect(pct(1400).annotation).toBeNull();
  });

  it("70% を 1 目盛り超えたら警告になる", () => {
    expect(pct(1402).level).toBe("warn");
    expect(pct(1402).annotation).toContain("::warning::");
  });

  it("枠のちょうど 90%（1,800 分）は、まだ誤り扱いにしない", () => {
    expect(pct(1800).percent).toBe(90);
    expect(pct(1800).level).toBe("warn");
  });

  it("90% を超えたら誤り扱いになる", () => {
    expect(pct(1802).level).toBe("error");
    expect(pct(1802).annotation).toContain("::error::");
  });

  it("同値の代表（余裕・警告・誤り）が、それぞれの区分に入る", () => {
    expect(pct(0).level).toBe("ok");
    expect(pct(500).level).toBe("ok");
    expect(pct(1500).level).toBe("warn");
    expect(pct(1900).level).toBe("error");
    expect(pct(5000).level).toBe("error");
  });

  it("警告の文に、残り何分かが入っている", () => {
    // 「超えました」だけでは、あと何回打てるかが決められない。
    expect(pct(1500).annotation).toContain("500 分");
  });

  it("超えたときの直し方に「検査を減らす」を挙げない", () => {
    expect(pct(1900).annotation).toContain("検査を減らして数字を下げないこと");
  });

  it("数でないもの・負の数は、緑にせず投げる", () => {
    for (const v of [Number.NaN, -1, Number.POSITIVE_INFINITY]) {
      expect(() => judgeUsage({ minutesUsed: v })).toThrow(TypeError);
    }
    expect(() => judgeUsage({ minutesUsed: 10, includedMinutes: 0 })).toThrow(TypeError);
  });
});

describe("REQ-CI14 §3 非公開になったのに武装していなければ、緑で終わらない", () => {
  it("非公開＋トークン無し は警告になる", () => {
    const v = judgeArmed({ visibility: "private", hasToken: false });
    expect(v.armed).toBe(false);
    expect(v.level).toBe("warn");
    expect(v.message).toContain("動いていません");
  });

  it("その警告に、本人が何をすればよいかが書いてある", () => {
    const m = judgeArmed({ visibility: "private", hasToken: false }).message ?? "";
    expect(m).toContain("Plan (read)");
    expect(m).toContain("Administration (read)");
    expect(m).toContain("ACTIONS_USAGE_TOKEN");
    expect(m).toContain("代行しません");
  });

  it("非公開＋トークン有り は武装している", () => {
    expect(judgeArmed({ visibility: "private", hasToken: true }).armed).toBe(true);
  });

  it("公開のときは、トークンが無くても警告にしない（まだ要らないため）", () => {
    expect(judgeArmed({ visibility: "public", hasToken: false }).level).toBe("skip");
  });

  it("使用量が取れなかった回は、黙って緑にせず警告にする", () => {
    const v = judgeRun({ visibility: "private", hasToken: true, fetchError: "HTTP 401" });
    expect(v.level).toBe("warn");
    expect(v.lines.join("\n")).toContain("HTTP 401");
  });

  it("使用量が空だった回も、黙って緑にしない", () => {
    const v = judgeRun({ visibility: "private", hasToken: true, minutesUsed: null });
    expect(v.level).toBe("warn");
  });
});

describe("REQ-CI14 §4 この見張りは、何があってもほかを止めない", () => {
  it("どの区分でも終了コードは 0", () => {
    const cases = [
      { visibility: "public", hasToken: false },
      { visibility: "private", hasToken: false },
      { visibility: "private", hasToken: true, minutesUsed: 100 },
      { visibility: "private", hasToken: true, minutesUsed: 1500 },
      { visibility: "private", hasToken: true, minutesUsed: 1999 },
      { visibility: "private", hasToken: true, fetchError: "HTTP 500" },
    ];
    for (const c of cases) expect(judgeRun(c).exitCode).toBe(0);
  });
});

describe("REQ-CI14 §5 外から与えたときは、必ずそう言う", () => {
  it("分数を外から渡せる（渡せないと、警告の枝を誰も踏めない）", () => {
    expect(readUsageOverride({ ACTIONS_USAGE_MINUTES: "1500" })).toEqual({
      invalid: false,
      minutes: 1500,
    });
  });

  it("渡していないときは null（既定で口座の実測を使う）", () => {
    expect(readUsageOverride({})).toBeNull();
    expect(readUsageOverride({ ACTIONS_USAGE_MINUTES: "" })).toBeNull();
  });

  it("分数でないものは、0 分として通さない", () => {
    expect(readUsageOverride({ ACTIONS_USAGE_MINUTES: "たくさん" })).toEqual({
      invalid: true,
      raw: "たくさん",
    });
  });

  it("外から渡した回の出力には、必ず告知が入る", () => {
    // 告知の出ない口を作ると、そこが「実測のふりをする」入口になる。
    const v = judgeRun({
      visibility: "private",
      hasToken: false,
      override: { invalid: false, minutes: 1500 },
    });
    expect(v.lines[0]).toContain("測定用");
    expect(v.lines.join("\n")).toContain("::warning::");
  });
});

describe("REQ-CI14 §6 トークンは、どこにも書かれず、どこにも出ない", () => {
  it("取得に失敗しても、返す文にトークンが混ざらない", async () => {
    // **値をこのファイルに書かない。**書くと、鍵らしい形の検出
    // （`tests/architecture/test-honesty.test.ts`）が正しく赤くなる。
    // 実測: 直に書いた版で 1 件検出された。組み立てて渡す。
    const token = `gh${"p"}_${"z".repeat(36)}`;
    const got = await fetchAccountUsage({
      owner: "someone",
      ownerType: "User",
      token,
      fetchImpl: (async () => {
        // 実際の例外は URL やヘッダを含むことがある。中身を素通しさせない。
        throw new Error(`request failed with authorization Bearer ${token}`);
      }) as unknown as typeof fetch,
    });
    expect(got.minutesUsed).toBeNull();
    expect(got.error).not.toContain(token);
    expect(got.error).not.toContain("ghp_");
  });

  it("個人口座の現行 API から Actions の分だけを合計する", async () => {
    let requested = "";
    const got = await fetchAccountUsage({
      owner: "someone",
      ownerType: "User",
      token: "t",
      fetchImpl: (async (input: string | URL | Request) => {
        requested = String(input);
        return {
          ok: true,
          json: async () => ({
            usageItems: [
              { product: "Actions", unitType: "minutes", quantity: 1200 },
              { product: "Actions", unitType: "minutes", quantity: 34 },
              { product: "Actions", unitType: "gigabyte-hours", quantity: 99 },
              { product: "Packages", unitType: "minutes", quantity: 500 },
            ],
          }),
        };
      }) as unknown as typeof fetch,
    });
    expect(got).toEqual({ minutesUsed: 1234, error: null });
    expect(requested).toBe("https://api.github.com/users/someone/settings/billing/usage");
  });

  it("組織口座は organization 用の現行 API を使う", async () => {
    let requested = "";
    const got = await fetchAccountUsage({
      owner: "example-org",
      ownerType: "Organization",
      token: "t",
      fetchImpl: (async (input: string | URL | Request) => {
        requested = String(input);
        return {
          ok: true,
          json: async () => ({
            usageItems: [{ product: "Actions", unitType: "minutes", quantity: 12 }],
          }),
        };
      }) as unknown as typeof fetch,
    });
    expect(got).toEqual({ minutesUsed: 12, error: null });
    expect(requested).toBe(
      "https://api.github.com/organizations/example-org/settings/billing/usage",
    );
  });

  it("旧 API の応答を現在値として誤読しない", async () => {
    const got = await fetchAccountUsage({
      owner: "someone",
      ownerType: "User",
      token: "t",
      fetchImpl: (async () => ({
        ok: true,
        json: async () => ({ total_minutes_used: 1234 }),
      })) as unknown as typeof fetch,
    });
    expect(got).toEqual({ minutesUsed: null, error: "usageItems がありません" });
  });

  it("応答が想定と違うときは、数を作らず理由を返す", async () => {
    const got = await fetchAccountUsage({
      owner: "someone",
      ownerType: "User",
      token: "t",
      fetchImpl: (async () => ({ ok: false, status: 403 })) as unknown as typeof fetch,
    });
    expect(got).toEqual({ minutesUsed: null, error: "HTTP 403" });
  });

  it("ワークフローもスクリプトも、トークンの値を持たない", () => {
    const yml = read(".github/workflows/actions-usage.yml");
    const script = read("scripts/actions-usage.mjs");
    // **母集団の床**。読めていなければ「書かれていない」も自明に成り立つ。
    expect(yml.length, "ワークフローを読めていません").toBeGreaterThan(500);
    expect(script.length, "スクリプトを読めていません").toBeGreaterThan(1000);

    expect(yml).toContain("ACTIONS_USAGE_TOKEN: ${{ secrets.ACTIONS_USAGE_TOKEN }}");
    for (const text of [yml, script]) {
      expect(text).not.toMatch(/gh[pousr]_[A-Za-z0-9]{16,}/);
      expect(text).not.toMatch(/github_pat_[A-Za-z0-9_]{20,}/);
    }
  });
});

describe("REQ-CI14 §8 閾値の正本", () => {
  it("quality-gates.config.mjs を唯一の正本として使う", () => {
    const script = read("scripts/actions-usage.mjs");
    expect(ACTIONS_USAGE).toBe(QUALITY_GATE_ACTIONS_USAGE);
    expect(script).toContain('from "../quality-gates.config.mjs"');
    expect(script).not.toMatch(/export const ACTIONS_USAGE\s*=/);
  });
});

describe("REQ-CI14 §7 ワークフローの形", () => {
  const yml = () => read(".github/workflows/actions-usage.yml");

  it("週 1 回の定例と、人が打つ口の両方がある", () => {
    const code = codeOf(yml());
    expect(code).toMatch(/schedule:\s*\n\s*- cron: "\d+ \d+ \* \* \d"/);
    expect(code).toContain("workflow_dispatch:");
  });

  it("判定はスクリプトを 1 本呼ぶだけで、yml が中身を持たない", () => {
    const code = codeOf(yml());
    const runs = [...code.matchAll(/^\s*(?:- )?run: (.+)$/gm)].map((m) => m[1].trim());
    expect(runs).toEqual(["node scripts/actions-usage.mjs"]);
  });

  it("しきい値の数字が yml に書き写されていない", () => {
    // 正本から読む。ここに数字を書き写すと、この検査自身が写しになる。
    const numbers = [
      ACTIONS_USAGE.includedMinutes,
      ACTIONS_USAGE.warnPercent,
      ACTIONS_USAGE.failPercent,
    ];
    expect(numbers.length, "正本から閾値を読めていません").toBe(3);
    const code = codeOf(yml());
    for (const n of numbers) {
      expect(code, `${n} が yml に書き写されています`).not.toMatch(
        new RegExp(`(?<![\\w.-])${n}(?![\\w.-])`),
      );
    }
  });

  it("読み取りだけの権限で走る", () => {
    expect(codeOf(yml())).toMatch(/permissions:\s*\n\s*contents: read/);
  });

  it("この見張りは push では走らない（毎回の押し出しを重くしない）", () => {
    expect(yml()).not.toMatch(/\n\s{2}push:/);
  });
});
