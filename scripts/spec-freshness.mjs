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
 *
 * --- 終了コード（2026-08-19 に足した）---
 *
 * **`FRESH` かつ `verdict` が `PASS`** のときと `--write` だけが 0 で、それ以外は 1 を返す。
 *
 * 2026-08-19 に `verdict` を足した。それまでは鮮度しか見ておらず、
 * **判定が `FAIL` のレポートでも、焼き付けさえすれば緑**だった。
 *
 * それまでは `judgeFreshness` の答えを**受け取ったあと捨てて**いた。
 * 判定する側は試験されていて緑、呼び出しも `grep` で見つかる。
 * それでも `UNPINNED` のまま何年でも緑を出せる状態だった
 *（「呼ばれていない」より見つけにくい。**呼ばれて、答えを捨てている**）。
 *
 * レポートが無いときも 1 にする。無いことは「何も言えない」であって
 * 「問題なし」ではない。ここを 0 にすると、レポートを消すのが最も静かな逃げ道になる。
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = process.cwd();
/**
 * 見るレポート。既定は本物で、`SPEC_FRESHNESS_REPORT` で差し替えられる。
 *
 * 差し替え口を開けているのは、**終了コードそのものを試験するため**である。
 * 判定の関数だけを試験していたせいで「答えを捨てている」ことに気づけなかったので、
 * 指紋の無いレポート・古いレポートを実際に食わせて 1 が返ることを見る
 *（`tests/architecture/spec-freshness.test.ts`）。指紋の計算対象は変わらない。
 */
const REPORT = process.env.SPEC_FRESHNESS_REPORT
  ? resolve(ROOT, process.env.SPEC_FRESHNESS_REPORT)
  : join(ROOT, "system-spec/completeness-report.json");

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
    // **指紋の材料ではない。**人が読むための情報として残すだけ。
    // mtime は中身が 1 バイトも変わらなくても動く（clone、checkout、touch）。
    // 下の combined へ混ぜると、誰も書き換えていないのに毎回 STALE になり、
    // 「どうせ毎回赤い」と扱われて本物の書き換えを報せる力を失う。
    mtime: Math.floor(statSync(join(ROOT, f)).mtimeMs / 1000),
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

/**
 * レポートの**判定そのもの**を見る。
 *
 * 鮮度だけを見る門には穴がある。**判定が `FAIL` のレポートでも、焼き付けさえすれば
 * `FRESH` になって通る。**「いつの仕様書を見たか」は答えられるが、
 * 「満たしているか」は誰も見ていない状態で緑になる。
 *
 * これは「判定を出したあと捨てている」形の 3 例目である。1 度目は `judgeFreshness` の
 * 答えを受け取って捨てていた。2 度目は起動の応答を動いている証拠として読んだ。
 * 3 度目は、**その 1 度目を直した門が、すぐ隣の `verdict` を見ていなかった**。
 * 直した回にこそ隣を見る。
 *
 * 欄が無い場合も通さない。**消すのを逃げ道にしない**（レポート不在を 1 にしたのと同じ）。
 *
 * @param {{ verdict?: unknown }} report
 */
export function judgeVerdict(report) {
  const verdict = report?.verdict;
  if (typeof verdict !== "string" || verdict.trim() === "") {
    return {
      ok: false,
      state: "（記載なし）",
      message: "レポートに判定の欄がありません。満たしているかどうかを誰も言っていません",
    };
  }
  if (verdict !== "PASS") {
    return {
      ok: false,
      state: verdict,
      message: "評価は済んでいますが、満たしていません。gaps を片付けてから再評価してください",
    };
  }
  return { ok: true, state: verdict, message: "評価を満たしています" };
}

// ─── ここから下は実行時のみ ─────────────────────────────
if (process.argv[1] && process.argv[1].endsWith("spec-freshness.mjs")) {
  if (!existsSync(REPORT)) {
    process.stdout.write(`完全性レポートがありません（${relative(ROOT, REPORT)}）\n`);
    process.stdout.write("「仕様を満たした」と言う根拠がありません。評価を先に通してください。\n");
    process.exit(1);
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
  const verdicted = judgeVerdict(report);
  process.stdout.write(`  レポートの判定:       ${verdicted.state}\n`);
  process.stdout.write(`  ${verdicted.message}\n`);

  if (process.argv.includes("--write")) {
    report.inputs = {
      sha256: current.sha256,
      file_count: current.fileCount,
      files: current.files,
      pinned_at: new Date().toISOString(),
    };
    // 字下げ 2 はレポートの元の書式に合わせてある。1 で書き出していた頃は、
    // 指紋を焼き直すたびにファイル全体（約 1,000 行）が差分になり、
    // **本当に変わったのは指紋 1 行だけ**であることが差分から読めなかった。
    // 読めない差分は読まれず、読まれない差分には何を混ぜても通る。
    writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write("\n指紋を焼き付けました。内容を再評価せずにこれを行わないこと。\n");
    process.exit(0);
  }

  if (judged.state !== "FRESH") {
    process.stdout.write(
      "\n再評価してから `node scripts/spec-freshness.mjs --write` で焼き付けてください。\n",
    );
    // **判定を捨てない。** ここで 0 を返していたあいだ、この門は
    // 「どの仕様書に対する PASS か言えない」状態を緑で通し続けていた。
    process.exit(1);
  }
  if (!verdicted.ok) {
    process.stdout.write(
      "\nレポートの gaps を片付けて再評価してください。**焼き付けても、この赤は消えません。**\n",
    );
    // 鮮度と判定は別の問いである。「いつの仕様書を見たか」に答えられることは、
    // 「満たしている」を少しも意味しない。ここを 0 にすると、`--write` 1 回で
    // FAIL のレポートが緑になる。
    process.exit(1);
  }
  process.exit(0);
}
