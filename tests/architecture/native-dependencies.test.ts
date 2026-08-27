/**
 * @tier 1
 * @req REQ-CI01
 * @types infra-config
 */
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function supportedArchitectures(): Set<string> {
  const output = execFileSync("pnpm", ["config", "get", "supportedArchitectures"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return new Set(
    output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  );
}

/*
  2026-08-27: `node_modules/@cloudflare/workerd-<os>-{64,arm64}` の実体が
  2 つとも存在することを見る検査をここに置いていたが、取り除いた。

  あれが測っていたのは**リポジトリではなく、その機械の install 履歴**だった。
  手元（darwin/arm64）で 2 つとも在ったのは、日をまたいだ 2 回の install が
  積み上がった結果で（作成日時が 8/26 と 8/27 でずれていた）、
  まっさらな checkout からは再現しない。実際、機械の上（ubuntu）では
  `linux-64` が無くて落ちた。手元でだけ緑になる検査は、門にならない。

  守りたい回帰は「両方の cpu を install 対象にする宣言が消えること」で、
  それは下の 1 本がリポジトリの中身だけで捕まえる。宣言が消えれば落ちる。
*/
describe("native optional dependency の共有（REQ-CI01）", () => {
  it("現在の OS について arm64 と x64 の両方を install 対象にする", () => {
    expect(supportedArchitectures()).toEqual(
      new Set(["os[]=current", "cpu[]=arm64", "cpu[]=x64"]),
    );
  });
});
