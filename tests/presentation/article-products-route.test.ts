/** @tier 1 @req REQ-BOPS14, FRONT-REQ-005 @types boundary, permission-matrix */
import { beforeEach, expect, it, vi } from "vitest";
import { aWriter } from "../support/actors";
import { domainError, err, ok } from "@/domain/shared";

const stubs = vi.hoisted(() => ({ actor: vi.fn(), search: vi.fn() }));
vi.mock("@/presentation/composition", () => ({ signedInActor: stubs.actor, productUseCases: async () => ({ filterProducts: { execute: stubs.search } }) }));
const { GET } = await import("@/app/api/article-products/route");
const request = () => new Request("https://hub.test/api/article-products?q=desk");
beforeEach(() => { vi.clearAllMocks(); stubs.actor.mockResolvedValue(aWriter()); stubs.search.mockResolvedValue(ok({ items: [] })); });
it.each([["FORBIDDEN", 403], ["UPSTREAM_UNAVAILABLE", 502], ["RATE_LIMITED", 429]] as const)("%sを障害と混同せずHTTP %sへ変換する", async (code, status) => {
  stubs.search.mockResolvedValue(err(domainError(code, "検索できません。")));
  expect((await GET(request())).status).toBe(status);
});
it("検索の未捕捉例外に内部情報を含めない", async () => {
  stubs.search.mockRejectedValue(new Error("private query"));
  const response = await GET(request());
  expect(response.status).toBe(502);
  expect(await response.text()).not.toContain("private query");
});
