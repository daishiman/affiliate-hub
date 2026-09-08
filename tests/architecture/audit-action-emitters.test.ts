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
  AUDIT_ACTIONS_WITHOUT_EMITTER_REASONS,
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
 * `manage-workspace.ts` に**全語**の日本語訳が並んでおり、
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
/** 理由の表。`.mjs` から来るので、語で引ける形に受け直す。 */
const reasons = AUDIT_ACTIONS_WITHOUT_EMITTER_REASONS as Record<string, string | undefined>;

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

  /*
   * --- 数だけでは足りなかった話（2026-08-21 に足した 3 件） ---
   *
   * 上の 2 つは件数しか見ていない。だから**語が入れ替わっても緑のまま**である。
   * 実際に起きた: `member.role_changed` に出す場所が付いた一方で、
   * 上限の説明は「`member.role_changed` は残課題 62」と書かれたまま残った。
   * 数は 6 のままで、古くなったのは説明だけ。
   *
   * ここから先は**語を鍵にして**突き合わせる。
   */
  it("出す場所を持たない語には、1 語ずつ理由が書いてある", () => {
    const missing = listOf("出す場所なし");
    const undocumented = missing.filter(
      (a) => (reasons[a] ?? "").trim() === "",
    );
    expect(
      undocumented,
      "出す場所が無いのに理由の書かれていない語があります。\n" +
        "quality-gates.config.mjs の AUDIT_ACTIONS_WITHOUT_EMITTER_REASONS へ、\n" +
        "**どの機能が無いから出せないのか**まで書いてください。",
    ).toEqual([]);
  });

  it("出す場所が付いた語の理由が、表に残っていない", () => {
    // **こちら向きが要る。**理由の表は放っておくと古くなる一方で、
    // 古い理由は古く見えない。出す場所を作った人が表から 1 行消すまで
    // 緑にしないことで、説明と実測を同じ変更の中で動かす。
    const missing = listOf("出す場所なし");
    const stale = Object.keys(reasons).filter((a) => !missing.includes(a));
    expect(
      stale,
      "この語には出す場所ができています（または語が消えています）。\n" +
        "quality-gates.config.mjs の AUDIT_ACTIONS_WITHOUT_EMITTER_REASONS から\n" +
        "該当の行を消し、AUDIT_ACTIONS_MAX_WITHOUT_EMITTER を同じぶん下げてください。",
    ).toEqual([]);
  });

  it("すべての語が、出しているか理由があるかのどちらかで説明されている", () => {
    // 受入条件そのもの。上の 2 件を合わせると、説明の無い語は 1 つも残らない。
    const explained = new Set([
      ...listOf("実処理"),
      ...Object.keys(reasons),
    ]);
    const unexplained = placed.map((p) => p.action).filter((a) => !explained.has(a));
    expect(unexplained, `説明の無い記録の語: ${unexplained.join(" / ")}`).toEqual([]);
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
