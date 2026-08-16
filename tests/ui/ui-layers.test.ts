import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 共通UIの構造の機械チェック。
 *
 * 見ているのは 3 点:
 *   1. 3 段の依存の向きが一方向 (primitives ← patterns ← templates)
 *   2. 部品が業務判断・データ取得を持っていない
 *   3. 仕様固有の重要UI (広告表示・順位・事実区分) を画面が自分で書いていない
 *
 * 3 が最も重要。広告表示の実装が画面ごとに散ると、
 * 法令要件が変わったときの直し漏れが必ず出る。
 */

const ROOT = process.cwd();
const UI = join(ROOT, "src/presentation/ui");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const code = (f: string): boolean => f.endsWith(".ts") || f.endsWith(".tsx");
const uiFiles = walk(UI).filter(code);
const primitives = uiFiles.filter((f) => f.includes("/primitives/"));
const patterns = uiFiles.filter((f) => f.includes("/patterns/"));
const templates = uiFiles.filter((f) => f.includes("/templates/"));

/** 画面側（app 配下）のコード。 */
const screens = walk(join(ROOT, "src/app")).filter(code);

function importsOf(source: string): string[] {
  return [...source.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
}

describe("共通UIの3段構成", () => {
  it("検査対象を実際に読めている", () => {
    expect(primitives.length, "primitives が空です").toBeGreaterThan(3);
    expect(patterns.length, "patterns が空です").toBeGreaterThan(4);
    expect(templates.length, "templates が空です").toBeGreaterThan(0);
    expect(screens.length, "画面が空です").toBeGreaterThan(2);
  });

  it("土台 (primitives) が上の段を読んでいない", () => {
    const offenders: string[] = [];
    for (const file of primitives) {
      for (const spec of importsOf(readFileSync(file, "utf8"))) {
        if (spec.includes("patterns/") || spec.includes("templates/")) {
          offenders.push(`${relative(ROOT, file)} → ${spec}`);
        }
      }
    }
    expect(
      offenders,
      "依存が逆流しています。順位表を直したらボタンが壊れる、という状態になります。",
    ).toEqual([]);
  });

  it("パターンが画面の骨格 (templates) を読んでいない", () => {
    const offenders: string[] = [];
    for (const file of patterns) {
      for (const spec of importsOf(readFileSync(file, "utf8"))) {
        if (spec.includes("templates/")) offenders.push(`${relative(ROOT, file)} → ${spec}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("部品が業務判断とデータ取得を持っていない", () => {
    const offenders: string[] = [];
    for (const file of uiFiles) {
      const source = readFileSync(file, "utf8");
      for (const spec of importsOf(source)) {
        // 部品は「渡されたものを出す」だけ。取ってくる側になった時点で使い回せなくなる。
        if (spec.startsWith("@/domain") || spec.startsWith("@/application")) {
          offenders.push(`${relative(ROOT, file)} → ${spec}（業務のきまりを持ち込んでいます）`);
        }
        if (spec.startsWith("@/infrastructure")) {
          offenders.push(`${relative(ROOT, file)} → ${spec}（データ取得を持ち込んでいます）`);
        }
      }
      if (/\bfetch\s*\(/.test(source)) {
        offenders.push(`${relative(ROOT, file)} が通信しています`);
      }
    }
    expect(
      offenders,
      "共通UIは表示だけを行います。業務判断は application 層、データ取得は infrastructure 層の仕事です。",
    ).toEqual([]);
  });
});

describe("仕様固有の重要UIの一元化", () => {
  /**
   * 画面が自分で書いてはいけないもの。
   * 見つけたら、対応するパターン部品を使わせる。
   */
  const CENTRALIZED: readonly { readonly pattern: RegExp; readonly use: string }[] = [
    { pattern: /rel=["'][^"']*sponsored/, use: "AffiliateLink" },
    { pattern: /広告を含みます|アフィリエイトリンクが含まれ/, use: "DisclosureNotice" },
    { pattern: /根拠あり|推測です/, use: "FactualityBadge" },
    { pattern: /順位づけに報酬/, use: "CriteriaDisclosure" },
    { pattern: /data-stub=/, use: "StubNotice / StubLabel" },
  ];

  it("画面が広告表示・順位・事実区分を自前で書いていない", () => {
    const offenders: string[] = [];
    for (const file of screens) {
      const source = readFileSync(file, "utf8");
      for (const rule of CENTRALIZED) {
        if (rule.pattern.test(source)) {
          offenders.push(`${relative(ROOT, file)} は ${rule.use} を使ってください`);
        }
      }
    }
    expect(
      offenders,
      "法令に関わる表示を画面ごとに書くと、要件が変わったときの直し漏れが必ず出ます。",
    ).toEqual([]);
  });

  it("仕様固有のパターンが一式そろっている", () => {
    // 「まだ作っていない」を見逃さないための一覧。
    const required = [
      "factuality.tsx",
      "evidence.tsx",
      "disclosure.tsx",
      "ranking-table.tsx",
      "comparison-table.tsx",
      "conversation.tsx",
      "product-card.tsx",
      "approval.tsx",
      "stub-notice.tsx",
    ];
    const present = patterns.map((f) => f.split("/").pop());
    expect(required.filter((r) => !present.includes(r))).toEqual([]);
  });

  /**
   * 使われていない共通部品を残さない。
   *
   * 「部品はあるが、どの画面からも呼ばれていない」状態は、
   * 一覧の上では実装済みに見えるのに読者には何も届いていない。
   * API はあるが画面が無い、と同じ壊れ方をする。
   */
  it("すべてのパターンがどこかの画面から使われている", () => {
    const users = [...screens, ...templates].map((f) => readFileSync(f, "utf8")).join("\n");
    const orphans: string[] = [];
    for (const file of patterns) {
      if (!file.endsWith(".tsx")) continue;
      const name = file.split("/").pop() ?? "";
      // 直接の import と、入口 (index.ts) 経由の名前つき import の両方を見る。
      if (users.includes(`/${name.replace(/\.tsx$/, "")}"`)) continue;
      const exported = [...readFileSync(file, "utf8").matchAll(/export function (\w+)/g)].map(
        (m) => m[1],
      );
      if (exported.some((n) => new RegExp(`<${n}[\\s/>]`).test(users))) continue;
      orphans.push(name);
    }
    expect(
      orphans,
      "どの画面からも呼ばれていない部品です。使うか、消してください。",
    ).toEqual([]);
  });

  it("入口 (index.ts) から全パターンを出している", () => {
    const index = readFileSync(join(UI, "index.ts"), "utf8");
    for (const name of [
      "FactualityBadge",
      "EvidenceList",
      "DisclosureNotice",
      "AffiliateLink",
      "RankingTable",
      "ComparisonTable",
      "Conversation",
      "ProductCard",
      "ApprovalFlow",
      "StubNotice",
    ]) {
      expect(index.includes(name), `${name} が入口から出ていません`).toBe(true);
    }
  });
});
