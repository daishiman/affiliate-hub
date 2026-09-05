/** @tier 2 @req REQ-S09 */
import { describe, expect, it, vi } from "vitest";
import { TOOL_CONTRACT, contractCoverage } from "@/presentation/tools/spec-contract";
import { renderDom } from "../support/render";

vi.mock("@/presentation/composition", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, createToolCatalog: async () => [] };
});

const ToolsPage = (await import("@/app/admin/tools/page")).default;

function toolRow(document: Document, specName: string): HTMLTableRowElement {
  const row = [...document.querySelectorAll<HTMLTableRowElement>("tbody tr")].find(
    (candidate) => candidate.querySelector("code")?.textContent === specName,
  );
  expect(row, `${specName} の状態行がありません`).toBeDefined();
  return row as HTMLTableRowElement;
}

describe("道具の実装状態と到達可能性", () => {
  it("集計は動作可能数ではなく実装済み数として表示する", async () => {
    const coverage = contractCoverage();
    const { document, cleanup } = await renderDom(ToolsPage());
    const text = document.body.textContent ?? "";

    expect(text).toContain(
      `仕様書に書かれた ${coverage.total} 個のうち ${coverage.implemented} 個は実装済みです`,
    );
    expect(text).not.toContain(`${coverage.implemented} 個が動きます`);
    expect([...document.querySelectorAll("th")].map((cell) => cell.textContent)).toContain("実装済み");
    cleanup();
  });

  it("実装済みでもこの面から届かない道具は理由付きで区別する", async () => {
    const unreachable = TOOL_CONTRACT.filter((entry) => entry.unreachableReason !== undefined);
    const { document, cleanup } = await renderDom(ToolsPage());

    expect(unreachable.length).toBeGreaterThan(0);
    for (const entry of unreachable) {
      const text = toolRow(document, entry.specName).textContent ?? "";
      expect(text).toContain("実装済み・この面からは使えません");
      expect(text).toContain(entry.unreachableReason);
      expect(text).not.toContain("動きます");
    }
    cleanup();
  });

  it("この面から届く実装済みの道具は従来どおり動くと表示する", async () => {
    const reachable = TOOL_CONTRACT.find(
      (entry) => entry.implementedBy !== null && entry.unreachableReason === undefined,
    );
    expect(reachable).toBeDefined();

    const { document, cleanup } = await renderDom(ToolsPage());
    expect(toolRow(document, reachable?.specName ?? "").textContent).toContain("動きます");
    cleanup();
  });
});
