/**
 * @tier 1
 * @req REQ-CI01
 * @types infra-config
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
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

function workerdPackage(suffix: string): string {
  return join(ROOT, "node_modules", "@cloudflare", `workerd-${suffix}`, "package.json");
}

describe("native optional dependency の共有（REQ-CI01）", () => {
  it("現在の OS について arm64 と x64 の両方を install 対象にする", () => {
    expect(supportedArchitectures()).toEqual(
      new Set(["os[]=current", "cpu[]=arm64", "cpu[]=x64"]),
    );
  });

  it.runIf(process.platform === "darwin" || process.platform === "linux")(
    "workerd の arm64/x64 実体が同時に存在する",
    () => {
      const platform = process.platform;
      const x64 = platform === "darwin" ? "darwin-64" : "linux-64";
      const arm64 = `${platform}-arm64`;

      expect(existsSync(workerdPackage(x64)), `${x64} がありません`).toBe(true);
      expect(existsSync(workerdPackage(arm64)), `${arm64} がありません`).toBe(true);
    },
  );
});
