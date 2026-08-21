/**
 * @tier 1
 * @req REQ-SEC09
 *
 * **記録の語を、語の側から数える。**
 *
 * `port-wiring.mjs` の 3 つの見張りは、どれも**入口から記録へ届いているか**を
 * 見ている。だから「語が `AuditAction` にあるだけで、どこからも出されていない」
 * 状態は 3 つとも緑のまま通る。入口の側には何も足りないところが無いからである。
 *
 * これは実際に穴だった。`export.performed` は語だけがあって出す場所が無く、
 * 調べたら `createExportManualDraftUseCase` が**記事の本文を人へ丸ごと渡すのに
 * 記録を 1 件も残していなかった**。**語だけがあって出す場所が無いのは、
 * 機能の抜けの影である。**
 *
 * 記録の一覧に語が並んでいると、読む人は「その操作は記録されている」と思う。
 * 実際には 1 行も出ない。**書いていないことは、書いていないようには見えない。**
 *
 * **手で数えた表を置かない。**この数え直しは 2026-08-18 に 2 度やった。
 * 1 度目は `action:` の直値だけを見て、引数として渡される語を取りこぼした。
 * 手で書いた数字は、**古くなっても古く見えない。**
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AUDIT_ACTIONS_MAX_SAMPLE_ONLY,
  AUDIT_ACTIONS_MAX_WITHOUT_EMITTER,
  AUDIT_ACTIONS_MIN_EMITTED,
} from "../../quality-gates.config.mjs";

const ROOT = resolve(import.meta.dirname, "../..");
/** 語の正本。ここだけは「出す場所」として数えない。 */
const SOURCE_OF_TRUTH = "src/domain/compliance/audit-log.ts";

function sourceFiles(dir: string): readonly string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

/** `AuditAction` の語を、型定義そのものから読む。手で並べない。 */
function auditActions(): readonly string[] {
  const text = readFileSync(join(ROOT, SOURCE_OF_TRUTH), "utf8");
  const union = text.split("export type AuditAction =")[1]?.split(";")[0] ?? "";
  return [...union.matchAll(/"([a-z_]+\.[a-z_]+)"/g)].map((m) => m[1]);
}

type Placement = "実処理" | "見本のみ" | "出す場所なし";

/**
 * その語がどこで使われているかを見る。
 *
 * **日本語ラベルの表は「出す場所」として数えない。**
 * `manage-workspace.ts` に 28 語すべての日本語訳が並んでおり、
 * ここを数えると全語が「出している」ことになる（最初に数えたときはそうなった）。
 * 表の行は `"語": "日本語"` の形をしているので、その形だけを外す。
 */
function placementOf(action: string, files: readonly string[]): Placement {
  const quoted = `"${action}"`;
  const labelRow = new RegExp(`^\\s*"${action.replace(".", "\\.")}"\\s*:\\s*"`);
  let sample = false;
  for (const path of files) {
    if (path.endsWith(SOURCE_OF_TRUTH)) continue;
    const text = readFileSync(path, "utf8");
    if (!text.includes(quoted)) continue;
    const lines = text.split("\n").filter((l) => l.includes(quoted) && !labelRow.test(l));
    if (lines.length === 0) continue;
    if (path.includes("/persistence/sample/")) sample = true;
    else return "実処理";
  }
  return sample ? "見本のみ" : "出す場所なし";
}

const files = sourceFiles(join(ROOT, "src"));
const placed = auditActions().map((action) => ({ action, where: placementOf(action, files) }));
const listOf = (where: Placement) =>
  placed.filter((p) => p.where === where).map((p) => p.action);

describe("記録の語が、出す場所を持っているか", () => {
  it("語が 1 つも読めなくなっていない（型定義の形が変わったら気づく）", () => {
    // 読み取りが壊れると全語が「出す場所なし」に倒れ、上限で落ちる。
    // ただし 0 件になると**全部が緑**になるので、ここで件数を押さえる。
    expect(placed.length).toBeGreaterThan(20);
  });

  it("出す場所を持たない語が、上限を超えていない", () => {
    const missing = listOf("出す場所なし");
    expect(
      missing.length,
      `出す場所の無い記録の語: ${missing.join(" / ")}\n` +
        "機能がまだ無いなら残課題へ。要件がその記録を求めていないなら、語のほうを消してください。",
    ).toBeLessThanOrEqual(AUDIT_ACTIONS_MAX_WITHOUT_EMITTER);
  });

  it("見本データの中にしか無い語が、上限を超えていない", () => {
    // **画面には記録が並ぶのに、その行を作った操作が存在しない**状態。
    // 見た目は動いて見えるので、見本を消すまで気づけない。
    const sampleOnly = listOf("見本のみ");
    expect(
      sampleOnly.length,
      `見本にしか無い記録の語: ${sampleOnly.join(" / ")}\n` +
        "画面には記録が並びますが、その行を作る操作がありません。",
    ).toBeLessThanOrEqual(AUDIT_ACTIONS_MAX_SAMPLE_ONLY);
  });

  it("実処理から出している語が、減っていない", () => {
    // 上の 2 つは「増えたら落ちる」だけなので、**語ごと消せば緑になる。**
    // 消して減らすのは正しい直し方の 1 つだが、
    // **出していた語まで一緒に消えたときに気づけない。**
    // 値は `quality-gates.config.mjs` に置く。**水準はあそこ 1 つを見れば分かる**、
    // という約束で運用しているので、下限だけここに直に書くと目に入らない。
    expect(listOf("実処理").length).toBeGreaterThanOrEqual(AUDIT_ACTIONS_MIN_EMITTED);
  });
});
