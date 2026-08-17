import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { adminWebMcpDescriptors, createToolCatalog, readerWebMcpDescriptors } from "@/presentation/composition";
import { findTool } from "@/presentation/tools/catalog";
import { MAX_TOOLS_PER_PAGE } from "@/presentation/tools/webmcp-adapter";
import {
  PAGE_KIND_LABELS,
  PAGE_TOOLS,
  WEBMCP_FLAG,
  isWebMcpEnabled,
  toolNamesForPage,
  type PageKind,
} from "@/presentation/tools/webmcp-policy";
import { allowedOriginsFrom, checkOrigin } from "@/presentation/http/origin-guard";

/**
 * ページ内 AI に渡すものの決めごと（ブログ層 §14.2〜§14.6）。
 *
 * 人の目で守れる決めごとではない。画面が 18 本あり、
 * 1 本でも「状態を変える道具をうっかり渡した」が起きると、
 * ページを開いた AI がそのまま公開できてしまう。
 */

const catalog = (await createToolCatalog());
const kinds = Object.keys(PAGE_TOOLS) as PageKind[];

describe("ページ種別ごとの道具", () => {
  it("どのページも 6 個以下", () => {
    for (const kind of kinds) {
      expect(PAGE_TOOLS[kind].length, PAGE_KIND_LABELS[kind]).toBeLessThanOrEqual(
        MAX_TOOLS_PER_PAGE,
      );
    }
  });

  it("渡す道具はすべて実在する", () => {
    const missing: string[] = [];
    for (const kind of kinds) {
      for (const name of PAGE_TOOLS[kind]) {
        if (findTool(catalog, name) === null) missing.push(`${kind}: ${name}`);
      }
    }
    expect(missing, "存在しない道具を渡そうとしています").toEqual([]);
  });

  it("渡す道具はすべて読み取り専用（ページ内の AI に状態を変えさせない）", () => {
    const writable: string[] = [];
    for (const kind of kinds) {
      for (const name of PAGE_TOOLS[kind]) {
        if (findTool(catalog, name)?.readOnly !== true) writable.push(`${kind}: ${name}`);
      }
    }
    expect(writable).toEqual([]);
  });

  it("同じページに同じ道具を二度渡さない", () => {
    for (const kind of kinds) {
      const names = PAGE_TOOLS[kind];
      expect(new Set(names).size, kind).toBe(names.length);
    }
  });

  it("ページ種別ごとに中身が違う（全部同じなら分ける意味が無い）", () => {
    expect(PAGE_TOOLS.comparison).not.toEqual(PAGE_TOOLS.ranking);
    expect(PAGE_TOOLS.article).not.toEqual(PAGE_TOOLS.admin);
  });

  it("表の順のまま渡る（登録順が変わると挙動の説明が付かない）", () => {
    const descriptors = readerWebMcpDescriptors("comparison");
    expect(descriptors.map((d) => d.name)).toEqual([...PAGE_TOOLS.comparison]);
  });

  it("管理画面にも状態を変える道具を渡さない", () => {
    for (const d of adminWebMcpDescriptors()) {
      expect(findTool(catalog, d.name)?.readOnly, d.name).toBe(true);
    }
  });
});

describe("機能フラグ", () => {
  it("既定では有効", () => {
    expect(isWebMcpEnabled({})).toBe(true);
  });

  it("止めたいときは止まる", () => {
    for (const value of ["off", "OFF", "false", "0", " no "]) {
      expect(isWebMcpEnabled({ [WEBMCP_FLAG]: value }), value).toBe(false);
    }
  });

  it("止めると、渡す道具が空になる", () => {
    expect(toolNamesForPage("article", { [WEBMCP_FLAG]: "off" })).toEqual([]);
    expect(toolNamesForPage("article", {}).length).toBeGreaterThan(0);
  });
});

describe("オリジン制約", () => {
  function req(origin: string | null): Request {
    const headers = new Headers();
    if (origin !== null) headers.set("origin", origin);
    return new Request("https://hub.example.com/api/mcp", { method: "POST", headers });
  }

  it("同じオリジンからは通す", () => {
    expect(checkOrigin(req("https://hub.example.com")).ok).toBe(true);
  });

  it("よそのサイトからは断り、理由を返す", () => {
    const d = checkOrigin(req("https://evil.example.net"));
    expect(d.ok).toBe(false);
    if (d.ok) return;
    expect(d.reason).toContain("このページからは実行できません");
    expect(d.origin).toBe("https://evil.example.net");
  });

  it("ブラウザ以外（Origin なし）は判定の対象にしない", () => {
    expect(checkOrigin(req(null)).ok).toBe(true);
    expect(checkOrigin(req("null")).ok).toBe(true);
  });

  it("運営が明示的に許したオリジンは通す", () => {
    const allowed = allowedOriginsFrom({ ALLOWED_ORIGINS: "https://blog.example.jp, https://a.jp" });
    expect(allowed).toEqual(["https://blog.example.jp", "https://a.jp"]);
    expect(checkOrigin(req("https://blog.example.jp"), allowed).ok).toBe(true);
    expect(checkOrigin(req("https://c.jp"), allowed).ok).toBe(false);
  });

  it("設定していなければ、自分のオリジンだけ", () => {
    expect(allowedOriginsFrom({})).toEqual([]);
    expect(allowedOriginsFrom({ ALLOWED_ORIGINS: "  " })).toEqual([]);
  });
});

describe("宣言型フォーム", () => {
  /** src の中の .ts / .tsx を全部たどる。 */
  function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
      else if (/\.tsx?$/.test(full)) out.push(full);
    }
    return out;
  }

  it("状態を変えるフォームに toolautosubmit を使わない", () => {
    // 使うと、AI が確認画面を飛ばして送信できてしまう。
    // 仕様（統合仕様 §3）で明確に禁じているので、書けないようにしておく。
    const root = resolve(import.meta.dirname, "../../src");
    const offenders = sourceFiles(root)
      .filter((f) => /toolautosubmit|toolAutoSubmit/i.test(readFileSync(f, "utf8")))
      .filter((f) => !f.endsWith("webmcp-policy.ts"))
      .map((f) => relative(root, f));
    expect(offenders, "状態変更に toolautosubmit は使えません").toEqual([]);
  });
});
