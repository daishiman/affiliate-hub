/** @tier 2 @req REQ-S09 @types ownership, screen-states */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SharedPersonaScopeNotice } from "@/presentation/admin/write/shared-persona-scope-notice";

const SITE_PERSONA_PAGES = [
  "src/app/admin/sites/[site]/authors/page.tsx",
  "src/app/admin/sites/[site]/authors/new/page.tsx",
  "src/app/admin/sites/[site]/audience/personas/page.tsx",
  "src/app/admin/sites/[site]/audience/personas/new/page.tsx",
] as const;

describe("SharedPersonaScopeNotice", () => {
  it("site の画面でも保存範囲がワークスペース共通だと明示する", () => {
    const html = renderToStaticMarkup(
      createElement(SharedPersonaScopeNotice, {
        resourceLabel: "書き手",
        siteName: "はじめてのカメラ",
      }),
    );

    expect(html).toContain("書き手は全ブログで共通です");
    expect(html).toContain("はじめてのカメラ");
    expect(html).toContain("すべてのブログで使われます");
  });

  it("一覧と作成の4画面が同じ共通部品を使う", () => {
    const missing = SITE_PERSONA_PAGES.filter((file) =>
      !readFileSync(join(process.cwd(), file), "utf8").includes(
        "<SharedPersonaScopeNotice",
      ),
    );

    expect(missing).toEqual([]);
  });
});
