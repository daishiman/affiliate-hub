/**
 * @tier 1
 * @req REQ-WC03, REQ-WC04
 * @types equivalence, boundary, decision-table
 *
 * 1 ページ 6 ツール以下・読み取り専用から導入（REQ-WC04）の分かれ目は
 * 「ページ種別ごとに中身が違う」（同値）と「どのページも 6 個以下」（境界）である。
 * ページ種別は 7 つあり、全部に当てている。
 *
 * 機能フラグ（REQ-WC03）も 2026-08-18 に宣言した。
 * 性質は `has-enumerated-input`（入力の軸がすべて列挙で、大小の端が無い）で、
 * 必須は等価分割と判定表。`has-input` を名乗って `boundary` を除外する形に
 * しなかったのは、列挙で本当に困るのが端ではなく**数え落とし**だからである。
 * 実際 REQ-WC03 は、止める値の一覧を検査側に書き写していたせいで
 * `disabled` が試されていなかった。
 *
 * 宣言型フォーム（REQ-WC05）の節がこのファイルにもあるが、**印は付けていない**。
 * 付けると、このファイルの `decision-table`（中身は REQ-WC03 のもの）が
 * REQ-WC05 の充足として数えられ、描画側の判定表を丸ごと消しても緑になる。
 * REQ-WC05 の印は、判定表が実際にある `tests/ui/tool-form.test.tsx` だけに付けた。
 * WC06 の権限は `api-routes.test.ts` の側で見ている。
 */
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
  WEBMCP_OFF_VALUES,
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
  /*
    入力は「値を置かない / 止める値 / それ以外」の 3 区分しかなく、
    大小の端が無い。境界値の代わりに**止める値を 1 つも落とさない**ことを見る。

    止める値は実装から取る（`WEBMCP_OFF_VALUES`）。ここで一覧を書き写すと、
    実装に値が 1 つ増えたときに検査は 4 つのまま緑になる。
    実際、書き写していた間 `disabled` が抜けていた。
  */
  it("止める値が 1 つも落ちていない（実装の一覧をそのまま回す）", () => {
    expect(WEBMCP_OFF_VALUES.length).toBeGreaterThan(0);
    for (const value of WEBMCP_OFF_VALUES) {
      expect(isWebMcpEnabled({ [WEBMCP_FLAG]: value }), value).toBe(false);
      // 大文字・前後の空白は運用でよく混ざる。同じ値として扱う。
      expect(isWebMcpEnabled({ [WEBMCP_FLAG]: ` ${value.toUpperCase()} ` }), value).toBe(false);
    }
  });

  it.each([
    ["値を置かない", undefined, true, "既定は有効"],
    ["止める値", "off", false, "まとめて止めるつまみ"],
    ["それ以外", "on", true, "知らない値で黙って止まらない"],
  ] as const)("%s → %s（%s）", (_区分, value, enabled, _なぜ) => {
    const env = value === undefined ? {} : { [WEBMCP_FLAG]: value };
    expect(isWebMcpEnabled(env)).toBe(enabled);
    expect(toolNamesForPage("article", env).length > 0).toBe(enabled);
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

  it("proxy配下でも公開originを共通resolverで比較する", () => {
    const request = new Request("https://internal.example/api/mcp", {
      method: "POST",
      headers: {
        origin: "https://hub.example.com",
        "x-forwarded-host": "hub.example.com",
        "x-forwarded-proto": "https",
      },
    });
    expect(checkOrigin(request).ok).toBe(true);
  });

  it("不正なforwarded hostならOrigin一致を推測せず断る", () => {
    const request = new Request("https://internal.example/api/mcp", {
      method: "POST",
      headers: {
        origin: "https://hub.example.com",
        "x-forwarded-host": "hub.example.com, attacker.example",
        "x-forwarded-proto": "https",
      },
    });
    expect(checkOrigin(request).ok).toBe(false);
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
    // 除外は置かない。以前は `webmcp-policy.ts` を除いていたが、
    // いまその中に語は 1 つも無く、除外だけが残っていた。
    // 「ここに書けば見逃される 1 ファイル」を残す意味は無い。
    const offenders = sourceFiles(root)
      .filter((f) => /toolautosubmit|toolAutoSubmit/i.test(readFileSync(f, "utf8")))
      .map((f) => relative(root, f));
    expect(offenders, "状態変更に toolautosubmit は使えません").toEqual([]);
  });
});
