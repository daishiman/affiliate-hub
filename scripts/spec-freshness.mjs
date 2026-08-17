#!/usr/bin/env node
/**
 * 仕様の完全性レポートが、いまの仕様書と同じものを見て出されたかを機械で判定する。
 *
 * `system-spec/completeness-report.json` は「仕様が揃っているか」の評価結果である。
 * 問題は、**評価したあとに仕様書を書き換えても、レポートは PASS のまま残る**ことにある。
 * 古い PASS は、古く見えない。これが最も危険な残り方である。
 *
 * そこで、評価の入力（`docs/spec/**.md` と `system-spec/**.md` と `spec-state.json`）の
 * 中身から求めた指紋をレポートに焼き付け、毎回それを突き合わせる。
 *
 *   一致   → FRESH（このレポートは、いまの仕様書に対する判定である）
 *   不一致 → STALE（**判定が正しいかどうかは分からない**。再評価が要る）
 *
 * STALE は「悪い」ではなく「まだ何も言えない」を意味する。
 * ここで嘘をつかないために、`--write` を付けない限りレポートは書き換えない。
 *
 * 使い方:
 *   node scripts/spec-freshness.mjs           判定して表示する（変更しない）
 *   node scripts/spec-freshness.mjs --write   いまの指紋をレポートへ焼き付ける
 *
 * **`--write` を、内容を再評価せずに使わないこと。**
 * それは「見ていないのに見たことにする」操作であり、この仕組みを無意味にする。
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const REPORT = join(ROOT, "system-spec/completeness-report.json");

/** 評価の入力に含める場所。ここを増やしたら指紋は必ず変わる（それでよい）。 */
const INPUT_DIRS = ["docs/spec", "system-spec"];
const INPUT_EXTENSIONS = [".md"];
/** 拡張子では拾えないが入力である単票。 */
const INPUT_FILES = ["system-spec/spec-state.json"];

function listFiles(dir) {
  const out = [];
  const full = join(ROOT, dir);
  if (!existsSync(full)) return out;
  for (const name of readdirSync(full)) {
    const path = join(full, name);
    if (statSync(path).isDirectory()) {
      out.push(...listFiles(relative(ROOT, path)));
    } else if (INPUT_EXTENSIONS.some((e) => name.endsWith(e))) {
      out.push(relative(ROOT, path));
    }
  }
  return out;
}

/**
 * 入力の指紋。
 *
 * ファイルごとの指紋を**並べ替えてから**まとめる。
 * 読む順番で指紋が変わると、中身が同じでも STALE になり、
 * 「どうせ毎回赤い」と扱われて誰も見なくなる。
 */
export function fingerprint() {
  const files = [...INPUT_DIRS.flatMap(listFiles), ...INPUT_FILES.filter((f) => existsSync(join(ROOT, f)))]
    .filter((f, i, all) => all.indexOf(f) === i)
    .sort();
  const perFile = files.map((f) => ({
    path: f,
    sha256: createHash("sha256").update(readFileSync(join(ROOT, f))).digest("hex"),
  }));
  const combined = createHash("sha256")
    .update(perFile.map((e) => `${e.path}:${e.sha256}`).join("\n"))
    .digest("hex");
  return { fileCount: perFile.length, files: perFile, sha256: combined };
}

/**
 * レポートと指紋を突き合わせる。
 *
 * @param {{ inputs?: { sha256?: string, file_count?: number } }} report
 * @param {{ sha256: string, fileCount: number }} current
 */
export function judgeFreshness(report, current) {
  const pinned = report?.inputs?.sha256;
  if (!pinned) {
    return {
      state: "UNPINNED",
      message:
        "レポートに入力の指紋がありません。どの仕様書に対する判定なのかを確かめる手段がありません",
    };
  }
  if (pinned !== current.sha256) {
    return {
      state: "STALE",
      message:
        "評価したあとに仕様書が変わっています。このレポートの PASS / FAIL は、いまの仕様書については何も言っていません",
    };
  }
  return { state: "FRESH", message: "いまの仕様書に対する判定です" };
}

// ─── ここから下は実行時のみ ─────────────────────────────
if (process.argv[1] && process.argv[1].endsWith("spec-freshness.mjs")) {
  if (!existsSync(REPORT)) {
    process.stdout.write("完全性レポートがありません（system-spec/completeness-report.json）\n");
    process.exit(0);
  }
  const report = JSON.parse(readFileSync(REPORT, "utf8"));
  const current = fingerprint();
  const judged = judgeFreshness(report, current);

  process.stdout.write(`\n仕様の完全性レポート: ${judged.state}\n`);
  process.stdout.write(`  ${judged.message}\n`);
  process.stdout.write(`  入力 ${current.fileCount} 件の指紋: ${current.sha256.slice(0, 16)}…\n`);
  if (report.inputs?.sha256) {
    process.stdout.write(`  レポートが見た指紋:   ${report.inputs.sha256.slice(0, 16)}…\n`);
  }
  process.stdout.write(`  レポートの判定:       ${report.verdict ?? "（記載なし）"}\n`);

  if (process.argv.includes("--write")) {
    report.inputs = {
      sha256: current.sha256,
      file_count: current.fileCount,
      files: current.files,
      pinned_at: new Date().toISOString(),
    };
    writeFileSync(REPORT, `${JSON.stringify(report, null, 1)}\n`);
    process.stdout.write("\n指紋を焼き付けました。内容を再評価せずにこれを行わないこと。\n");
  } else if (judged.state !== "FRESH") {
    process.stdout.write(
      "\n再評価してから `node scripts/spec-freshness.mjs --write` で焼き付けてください。\n",
    );
  }
}
