/** @tier 2 @req REQ-B01 */
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { notFound } from "next/navigation";
import { describe, expect, it } from "vitest";
import { SAMPLE_SITE_SLUG } from "@/infrastructure/persistence/sample/site-sample-repository";
import { stopIfMissing } from "@/presentation/site/page-frame";
import { intoDom, renderRoute, textOf } from "../support/render";
import { ROUTE_CASES, importPathOf, propsOf } from "./route-table";

/**
 * **実在するブログの中で**無いものを開いたときに、通信の答えも 404 になることの確認。
 *
 * `tests/ui/site-not-found.test.tsx` は「無いブログ名」を見ている。こちらはその残りで、
 * ブログは実在するが記事名・商品名・書き手名・カテゴリー・道具が無い場合を見る。
 * 以前はどちらも画面に「見つかりませんでした」と出ていたが、後者は 200 で返っていた。
 * **目で見る分には正しく見えるので、画面を開いても発見できない。**
 * だから状態コードの側を機械で見る。
 *
 * 規範: 残課題リスト 項目 36 / docs/product/traceability.md REQ-B01 / Beads ah-a7j
 */

const APP_SITE_DIR = join(process.cwd(), "src/app/s/[site]");

/** 実在しないことがはっきり分かる値。見本データに紛れ込まない綴りにする。 */
const NO_SUCH = "no-such-resource-x9";

/**
 * 404 を表す印を、Next.js 自身から取り出す。
 *
 * 文字列を直接書かないのは、これが Next.js の内部の決めごとで、
 * 版が上がると変わりうるため。写しを書くと、印が変わったときに
 * 「404 になっていないのに緑」という最悪の壊れ方をする。
 */
function notFoundDigest(): string {
  try {
    notFound();
  } catch (thrown) {
    const digest = (thrown as { digest?: unknown }).digest;
    if (typeof digest === "string") return digest;
  }
  throw new Error("notFound() が 404 の印を投げませんでした。Next.js の仕様を確認してください。");
}

/**
 * `[site]` 以外の動く部分を持つ読者側の画面を、ファイルから集める。
 *
 * 1 枚ずつ列挙しない。列挙すると、後から足した画面だけが 200 のまま残る。
 * 抜けるのはいつも新しい画面である。
 */
function resourcePageImportPaths(): readonly string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name === "page.tsx") {
        const rel = relative(APP_SITE_DIR, full).split("\\").join("/");
        // `[site]` 直下の固定ページ（方針・問い合わせなど）は資源を指さないので対象外。
        if (/\[\w+\]/.test(rel)) found.push(`@/app/s/[site]/${rel.replace(/\.tsx$/, "")}`);
      }
    }
  };
  walk(APP_SITE_DIR);
  return found.sort();
}

/** 動く部分に入れる値。ブログ名だけ実在させ、残りは実在しない値にする。 */
function paramsFor(importPath: string): Record<string, string> {
  const params: Record<string, string> = { site: SAMPLE_SITE_SLUG };
  for (const match of importPath.matchAll(/\[(\w+)\]/g)) {
    if (match[1] !== "site") params[match[1]] = NO_SUCH;
  }
  return params;
}

/** 見本データの実在する値で開く読者側の画面。`route-table` が正本。 */
function existingResourceCases() {
  return ROUTE_CASES.filter(
    (route) =>
      route.file.startsWith("s/[site]/") &&
      Object.keys(route.params ?? {}).some((key) => key !== "site"),
  );
}

describe("実在するブログの中の、無い記事・商品・人", () => {
  const digest = notFoundDigest();

  it("資源を指す読者側の画面はすべて、無い名前で 404 を返す", async () => {
    const paths = resourcePageImportPaths();
    // 記事 4 種・人 2 種・カテゴリー・道具で 8 本。減っていたら数え方が壊れている。
    expect(paths.length).toBeGreaterThanOrEqual(8);

    const returned200: string[] = [];
    for (const importPath of paths) {
      try {
        await renderRoute(importPath, {
          params: Promise.resolve(paramsFor(importPath)),
          searchParams: Promise.resolve({}),
        });
        returned200.push(importPath);
      } catch (thrown) {
        expect(
          (thrown as { digest?: unknown }).digest,
          `${importPath} が 404 以外で落ちました`,
        ).toBe(digest);
      }
    }

    expect(
      returned200,
      `無い記事・商品・人なのに画面が描けています（200 で返ります）:\n  ${returned200.join("\n  ")}`,
    ).toEqual([]);
  });

  it.each(existingResourceCases().map((route) => [route.file, route] as const))(
    "実在する資源では 404 にしない — %s",
    async (_file, route) => {
      // 上の検査だけだと、全部 404 にしてしまっても緑になる。
      // 実在する記事・商品・人が 404 になったら、検索結果から本物が消える。
      const html = await renderRoute(importPathOf(route.file), propsOf(route));
      expect(html.length).toBeGreaterThan(200);
      expect(textOf(html)).not.toContain("見つかりませんでした");
    },
  );

  it("打ち切るのは「無い」だけで、「取れなかった」は打ち切らない", () => {
    /*
      分かれ目は `NOT_FOUND` の 1 点。ここを緩めて全部の失敗で 404 を返すと、
      保存先が一時的に落ちただけで**実在する記事が検索結果から消える**。
      逆に締めすぎれば元の 200 に戻る。画面からは両方きれいに見えるので、
      ここだけは関数を直接叩いて見る（方針の画面のように総当たりで通らない経路もある）。
    */
    expect(() => stopIfMissing({ code: "NOT_FOUND" })).toThrowError(
      expect.objectContaining({ digest }),
    );
    expect(() => stopIfMissing({ code: "STORAGE_UNAVAILABLE" })).not.toThrow();
    expect(() => stopIfMissing(undefined)).not.toThrow();
  });

  it("404 の画面は、無いのがブログだと決めつけない", async () => {
    /*
      受け先は `s/[site]/not-found.tsx` 1 枚で、無いブログ名も無い記事も同じ画面に来る。
      `not-found.tsx` はアドレスの `[site]` も `[product]` も受け取れないので、
      「このブログはありません」と書くと、無い記事を開いた読者に嘘をつくことになる。
      読者は実在するブログを閉じてしまう。**画面はどちらの場合もきれいに見える。**
    */
    const html = await renderRoute("@/app/s/[site]/not-found", propsOf({ file: "" }));
    const text = textOf(html);
    expect(text).not.toContain("このブログは見つかりませんでした");
    expect(text).not.toContain("指定されたブログはありません");
    expect(text).toContain("このページは見つかりませんでした");

    // 行き止まりを作らない。状態コードだけ直して素っ気なくすると、読者はそこで詰まる。
    const { document, cleanup } = intoDom(html);
    try {
      const back = [...document.querySelectorAll("a[href]")].find(
        (a) => a.getAttribute("href") === "/",
      );
      expect(back, "公開中のブログの一覧へ戻る導線がありません").toBeDefined();
    } finally {
      cleanup();
    }
  });
});
