/**
 * @tier 2
 * @req REQ-BLOG04
 * 受入条件 A14（`docs/spec/feat-blog-ops-crud/requirements-baseline.md`）に対応する。
 * `@req` は要件表の ID しか拾わないので、受入 ID はここに文章で残す。
 * @types a11y
 *
 * **総当たりの a11y 検査は「消えたもの」を教えない。**条文が名指しした画面は
 * 名前で当てる床が要る。画面が減った日に、総当たりは静かに緑のままになる。
 */
import { describe, expect, it } from "vitest";
import { describeViolations, findA11yViolations } from "../support/a11y";
import { ROUTE_CASES, renderCase } from "./route-table";

/**
 * 受入条文 A14 —「主要 6 画面が axe-core の重大違反 0 件」を、**6 件として数える。**
 *
 * ここを足した理由。読み上げの自動検査は `tests/ui/page-render.test.tsx` が
 * 経路の表から総当たりで回しており、この 6 枚も**そこに含まれてはいる**。
 * だが総当たりは「表に在るものを全部見る」ので、**6 枚のうち 1 枚が表から
 * 落ちた日に、それを教えるものが無い。**総数は 1 件減るだけで、
 * どの画面が消えたかは誰も見ていない。名前で当てるのはそのためである。
 *
 * **数字の 6 は条文の側から来ている。**画面が増えたからといってここを増やさない。
 * 条文が名指ししたものだけを名指しで見る表であって、画面の目録ではない。
 */

/**
 * 条文が名指しした 6 つと、それを実際に描いている画面。
 *
 * **「トップ構成」と「レイアウト」は同じ 1 枚に同居している** (`admin/blog/layout`)。
 * 帯 (トップに何が並ぶか) と枠 (脇と上下に何が出るか) は運営者にとって続きの
 * 操作なので 1 枚にまとめてあり、条文の 6 つに対して画面は 5 枚である。
 * **6 を作るために 6 枚目を選び直さない。**数合わせで別の画面を入れると、
 * 条文が何を要求していたのかが表から読めなくなる。
 */
const A14_SUBJECTS: readonly { readonly subject: string; readonly file: string }[] = [
  { subject: "サイト網一覧", file: "admin/site-network/page.tsx" },
  { subject: "トップ構成 (帯)", file: "admin/blog/layout/page.tsx" },
  { subject: "レイアウト (枠)", file: "admin/blog/layout/page.tsx" },
  { subject: "記事編集", file: "admin/blog/articles/[article]/page.tsx" },
  // 旧 `/admin/blog/pages` は canonical 管理口へ redirect する legacy adapter。
  { subject: "固定ページ", file: "admin/sites/[site]/documents/page.tsx" },
  { subject: "評価一覧", file: "admin/blog/evaluate/page.tsx" },
];

/** axe の言う重さのうち、条文が「重大」と呼んでいるもの。 */
const SEVERE = new Set(["critical", "serious"]);

describe("受入 A14 — 名指しされた 6 つの読み上げ検査", () => {
  it("条文の 6 つは全部、経路の表に在る (総当たりの対象から落ちていない)", () => {
    expect(A14_SUBJECTS).toHaveLength(6);
    const missing = A14_SUBJECTS.filter(
      (target) => !ROUTE_CASES.some((route) => route.file === target.file),
    ).map((target) => `${target.subject} (${target.file})`);
    expect(
      missing,
      "条文が名指しした画面が経路の表から落ちています。落ちた画面は総当たりの読み上げ検査も素通りします",
    ).toEqual([]);
  });

  for (const { subject, file } of A14_SUBJECTS) {
    it(`${subject} に重大な読み上げの違反が無い`, async () => {
      const route = ROUTE_CASES.find((candidate) => candidate.file === file);
      // 上の 1 本が落ちていれば、ここは表の欠けが原因だと分かる形で止まる。
      expect(route, `${file} が経路の表にありません`).toBeDefined();
      if (route === undefined) return;

      const violations = await findA11yViolations(await renderCase(route));
      const severe = violations.filter((violation) => SEVERE.has(violation.impact));
      expect(severe, describeViolations(severe)).toEqual([]);
    });
  }
});
