/**
 * @tier 1
 * @req REQ-WC07
 * @types equivalence, decision-table
 *
 * §16.4 のエラー形式。**エラーの種類 15 個ぶんの判定表**である。
 *
 * ここまで、この変換には検査が 1 つも無かった。
 * `statusOf()` も `errorToMcpResult()` も `tests/` のどこからも呼ばれておらず、
 * 番号の表を丸ごと消しても（全部 500 になっても）誰も落ちなかった。
 *
 * 性質は `has-enumerated-input`。入力はエラーの種類という列挙で、
 * 大小の端が無い。端が無いものに境界値は書けないので、代わりに
 * **15 個のうち 1 個も落ちていないこと**を見る。一覧は実装から取る
 * （`ERROR_STATUS`）。ここへ書き写すと、種類が増えたときに追随しない。
 */
import { describe, expect, it } from "vitest";
import { domainError, notFound } from "@/domain/shared";
import type { DomainErrorCode } from "@/domain/shared";
import { ERROR_STATUS, errorResponse, maskExistence, statusOf } from "@/presentation/http/error-response";
import { errorToMcpResult } from "@/presentation/tools/mcp-adapter";

const CODES = Object.keys(ERROR_STATUS) as DomainErrorCode[];

/**
 * 「他テナントのものは、存在しないのと同じ扱いにする」。
 *
 * 403 を返すと「その ID は実在する」と教えてしまう。
 * 表の中でここだけが**わざと嘘の番号**なので、名指しで固定しておく。
 * 直したくなったときに、理由を読まずに直せないようにする。
 */
const DELIBERATELY_INDISTINGUISHABLE: Partial<Record<DomainErrorCode, number>> = {
  TENANT_MISMATCH: 404,
};

describe("エラーの種類ごとの番号（判定表）", () => {
  it("種類が 1 つも落ちていない（実装の表をそのまま回す）", () => {
    expect(CODES.length).toBeGreaterThanOrEqual(15);
    expect(new Set(CODES).size).toBe(CODES.length);
  });

  it.each(CODES.map((code) => [code, ERROR_STATUS[code]] as const))(
    "%s → %d",
    (code, expected) => {
      expect(statusOf(domainError(code, "説明"))).toBe(expected);
      // 400 未満・600 以上は HTTP の失敗として成立しない。
      expect(expected).toBeGreaterThanOrEqual(400);
      expect(expected).toBeLessThan(600);
    },
  );

  it("他の作業場所のものは「見つかりません」と同じ番号にする", () => {
    for (const [code, status] of Object.entries(DELIBERATELY_INDISTINGUISHABLE)) {
      expect(ERROR_STATUS[code as DomainErrorCode]).toBe(status);
    }
    expect(ERROR_STATUS.TENANT_MISMATCH).toBe(ERROR_STATUS.NOT_FOUND);
  });

  /**
   * **番号が同じでも本文が違えば存在は漏れる。**
   *
   * 上の検査は番号までしか見ておらず、`(id: xxx)` の有無や `code` の違いで
   * 他所の Workspace の中身が列挙できる状態を、緑のまま通していた。
   * ここでバイト単位の同一性を固定する。
   */
  it("他所のものと、そもそも無いものは、REST の本文まで同一", async () => {
    const 他所 = errorResponse(
      domainError("TENANT_MISMATCH", "記事 が見つかりません。", {
        suggestedAction: "ワークスペースを切り替えているか確認してください。",
      }),
    );
    const 無い = errorResponse(notFound("記事", "obj-9999"));
    expect(他所.status).toBe(無い.status);
    expect(await 他所.text()).toBe(await 無い.text());
  });

  it("MCP の文面でも同一", () => {
    const 他所 = errorToMcpResult(domainError("TENANT_MISMATCH", "記事 が見つかりません。"));
    const 無い = errorToMcpResult(notFound("記事", "obj-9999"));
    expect(他所.content.map((c) => c.text).join("\n")).toBe(
      無い.content.map((c) => c.text).join("\n"),
    );
  });
});

describe("どの種類でも、返す形は 1 つ", () => {
  it.each(CODES.map((code) => [code] as const))("%s: REST の本文の形が同じ", async (code) => {
    const res = errorResponse(domainError(code, "説明", { suggestedAction: "次の一手" }));
    expect(res.status).toBe(ERROR_STATUS[code]);
    const body = (await res.json()) as { error: Record<string, unknown> };
    expect(Object.keys(body.error).sort()).toEqual(
      ["code", "field", "message", "retryable", "suggestedAction"].sort(),
    );
    // 存在を隠す 2 種は、外へ出る手前で 1 種類へ潰される。
    // ここで元の種類を期待すると、**潰しを外したときに緑のまま**になる。
    expect(body.error.code).toBe(maskExistence(domainError(code, "説明")).code);
  });

  it.each(CODES.map((code) => [code] as const))("%s: MCP の文面に種類と番号が入る", (code) => {
    const result = errorToMcpResult(domainError(code, "説明", { suggestedAction: "次の一手" }));
    expect(result.isError).toBe(true);
    const text = result.content.map((c) => c.text).join("\n");
    const 外向き = maskExistence(domainError(code, "説明", { suggestedAction: "次の一手" }));
    expect(text).toContain(`code: ${外向き.code}`);
    expect(text).toContain(`status: ${ERROR_STATUS[外向き.code]}`);
    // 「失敗しました」だけだと、エージェントは同じ呼び出しを繰り返す。
    expect(text).toContain(`次にできること: ${外向き.suggestedAction}`);
  });
});

describe("もう一度試せるかどうかで、返し方が変わる", () => {
  it("試せるものには、待つ時間を添える", () => {
    const res = errorResponse(domainError("UPSTREAM_UNAVAILABLE", "上流が応答しません", { retryable: true }));
    expect(res.headers.get("Retry-After")).toBe("5");
  });

  it("試せないものには添えない（無駄に待たせない）", () => {
    const res = errorResponse(domainError("VALIDATION_FAILED", "入力が不正です"));
    expect(res.headers.get("Retry-After")).toBeNull();
  });

  it("試せるものは、MCP の文面でもそう言う", () => {
    const text = errorToMcpResult(domainError("RATE_LIMITED", "混み合っています", { retryable: true }))
      .content.map((c) => c.text)
      .join("\n");
    expect(text).toContain("しばらく待ってから");
  });
});
