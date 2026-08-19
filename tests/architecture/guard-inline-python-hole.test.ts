/** @tier 1 */
/**
 * 見張り (guard-confirmed-chapter-overwrite.py) が「書込の形」は見るが「書き手」は見ないことを固定する。
 *
 * これは穴が塞がっていることの確認ではない。**穴が開いていることの監視**である。
 * 見張りは PreToolUse に渡るコマンド**文字列**だけを読む。`python3 なんとか.py` の
 * 「なんとか.py」の中身は一度も開かない。だから正本を書き換えるコードを .py に移すだけで通る。
 * 実際にこの作業場所では、正規 writer を通さない python スクリプトから正本を 3 回書き換え、
 * 3 回とも通っている。判断ではなく事故である。
 *
 * いまは塞がない (プラグイン側に手が入る)。塞ぐ見立ては「正規 writer に印を持たせ、
 * 印の無い書込を弾く」。**印の仕組みが足された日、この検査は赤くなる。赤は「検査を消す合図」ではなく
 * 「穴が塞がったので、この監視を役目終わりにしてよい」という合図である。**
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const GUARD = ".claude/plugins/system-spec-harness/hooks/guard-confirmed-chapter-overwrite.py";

/** 見張りへ PreToolUse ペイロードを流し、終了コードと理由を返す。実行はしない (判定だけ)。 */
function ask(payload: unknown): { code: number; reason: string } {
  const proc = spawnSync("python3", [GUARD], {
    cwd: ROOT,
    input: JSON.stringify(payload),
    encoding: "utf8",
  });
  expect(proc.error, "見張りを起動できませんでした").toBeUndefined();
  return { code: proc.status ?? -1, reason: proc.stderr ?? "" };
}

/** 正本を書き換える中身を持つ .py を、実行されない場所に置く。中身が読まれないことを見せるために作る。 */
function scriptThatWritesCanonicalState(): string {
  const dir = mkdtempSync(join(tmpdir(), "guard-hole-"));
  const path = join(dir, "writer.py");
  writeFileSync(
    path,
    [
      "# このスクリプトは実行しない。見張りがここを読まないことを見せるためだけに置いてある。",
      "import json, pathlib",
      'p = pathlib.Path("system-spec/spec-state.json")',
      "d = json.loads(p.read_text())",
      'p.write_text(json.dumps(d, ensure_ascii=False))',
      "",
    ].join("\n"),
  );
  return path;
}

describe("見張りは書込の形を見るが、書き手は見ない (穴の監視)", () => {
  it("正本を書き換える中身を .py に移すと、見張りは通してしまう", () => {
    // **数える対象そのものの床。**下の `code === 0` は「見張りが通した」ときと
    // 「見張りが何も見ていない」ときの両方で出る。見張りが空ファイルになっても 0 は出る。
    // **止まる例を同じ検査の中に置いて、見張りが生きていることを先に示す。**下げない。
    const alive = ask({
      tool_name: "Bash",
      tool_input: { command: `python3 -c "open('system-spec/spec-state.json','w')"` },
    });
    expect(alive.code, "見張りが止めるはずのものを止めていません。穴の監視の前に、見張り自体を確かめてください").toBe(2);

    const script = scriptThatWritesCanonicalState();
    // 中身は確かに正本への書込を含んでいる。見張りが読めば止められるはずのもの。
    expect(readFileSync(script, "utf8")).toContain("system-spec/spec-state.json");

    const { code } = ask({
      tool_name: "Bash",
      tool_input: { command: `python3 ${script} --apply` },
    });
    // 0 = 通る。これが穴である。塞がれた日にここが 2 になって赤くなる。
    expect(code, "見張りが .py の中身を読むようになった。穴が塞がったのなら、この検査は役目を終えている").toBe(0);
  });

  it("同じ書込をコマンド文字列に直接書くと、見張りは止める", () => {
    // 対照。書込の形が文字列に現れれば止まる。止まる/止まらないを分けているのは
    // 「危なさ」ではなく「文字列に見えているかどうか」である。
    const { code, reason } = ask({
      tool_name: "Bash",
      tool_input: {
        command: `python3 -c "open('system-spec/spec-state.json','w')"`,
      },
    });
    expect(code).toBe(2);
    expect(reason).toContain("BLOCKED");
  });

  it("見張りの中に、呼ばれるスクリプトの中身を読む箇所が無い", () => {
    const src = readFileSync(join(ROOT, GUARD), "utf8");
    // コマンドから取り出したトークンをファイルとして開いて中身を検査する処理があれば、
    // それが穴を塞ぐ実装である。いまは無い。
    const readsInvokedScript = /_(?:py|script)_source|read_text\(\)[^\n]*(?:script|invoked|cmd)/i.test(src);
    expect(readsInvokedScript, "呼ばれるスクリプトを読む実装が入った。穴が塞がったのなら、この監視は役目を終えている").toBe(false);
  });
});
