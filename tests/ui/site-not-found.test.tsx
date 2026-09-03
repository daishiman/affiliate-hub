/** @tier 2 */
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { notFound } from "next/navigation";
import { describe, expect, it } from "vitest";
import { SAMPLE_SITE_SLUG } from "@/infrastructure/persistence/sample/site-sample-repository";
import { intoDom, renderRoute, textOf } from "../support/render";
import { propsOf } from "./route-table";

/**
 * 無いブログを開いたときに、**通信の答えも 404 になる**ことの確認。
 *
 * 以前は画面に「このブログは見つかりませんでした」と出ていたのに 200 で返っていた。
 * 目で見る分には正しく見えるため、**この抜けは画面を開いても発見できない。**
 * だから状態コードの側を機械で見る。
 *
 * 規範: 残課題リスト 項目 32 / docs/product/traceability.md REQ-B01
 */

const APP_SITE_DIR = join(process.cwd(), "src/app/s/[site]");

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

/** `src/app/s/[site]` の下にある page.tsx を、読み込み用の経路として集める。 */
function sitePageImportPaths(): readonly string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name === "page.tsx") {
        found.push(`@/app/s/[site]/${relative(APP_SITE_DIR, full).split("\\").join("/")}`.replace(/\.tsx$/, ""));
      }
    }
  };
  walk(APP_SITE_DIR);
  return found.sort();
}

/** 動的な部分に入れる値。ブログ名以外は実在しなくてよい（先にブログで断られる）。 */
function paramsFor(importPath: string, site: string): Record<string, string> {
  const params: Record<string, string> = { site };
  for (const match of importPath.matchAll(/\[(\w+)\]/g)) {
    if (match[1] !== "site") params[match[1]] = "any";
  }
  return params;
}

describe("無いブログ", () => {
  const digest = notFoundDigest();

  it("読者側の画面はすべて、無いブログ名で 404 を返す", async () => {
    // 1 枚ずつ列挙しない。列挙すると、後から足した画面だけが 200 のまま残る。
    const paths = sitePageImportPaths();
    expect(paths.length).toBeGreaterThan(10);

    const returned200: string[] = [];
    for (const importPath of paths) {
      try {
        await renderRoute(importPath, {
          params: Promise.resolve(paramsFor(importPath, "no-such-site")),
          searchParams: Promise.resolve({}),
        });
        returned200.push(importPath);
      } catch (thrown) {
        expect((thrown as { digest?: unknown }).digest, `${importPath} が 404 以外で落ちました`).toBe(
          digest,
        );
      }
    }

    expect(
      returned200,
      `無いブログなのに画面が描けています（200 で返ります）:\n  ${returned200.join("\n  ")}`,
    ).toEqual([]);
  });

  it("実在するブログでは 404 にしない", async () => {
    // 上の検査だけだと、全部 404 にしてしまっても緑になる。
    const html = await renderRoute("@/app/s/[site]/page", {
      params: Promise.resolve({ site: SAMPLE_SITE_SLUG }),
      searchParams: Promise.resolve({}),
    });
    expect(html.length).toBeGreaterThan(200);
  });

  it("404 の画面には、戻り先と言い直しの案内がある", async () => {
    // 状態コードだけ直して画面を素っ気なくすると、読者はそこで詰まる。
    const html = await renderRoute("@/app/s/[site]/not-found", propsOf({ file: "" }));
    const text = textOf(html);
    expect(text).toContain("このページは見つかりませんでした");
    expect(text).toContain("アドレスの綴り");

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
