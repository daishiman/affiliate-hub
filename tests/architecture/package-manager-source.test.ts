/**
 * @tier 1
 * @req REQ-CI01
 * @types infra-config, contract
 *
 * 依存解決の正本を pnpm 1 つに固定する。
 * 別の lockfile を `.gitignore` で隠さず、生まれた時点で検査を赤くする。
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

describe("依存解決の正本", () => {
  it("packageManager と lockfile は pnpm に一本化されている", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      readonly packageManager?: string;
    };

    expect(pkg.packageManager).toMatch(/^pnpm@/);
    expect(existsSync(join(ROOT, "pnpm-lock.yaml"))).toBe(true);

    for (const competingLock of ["package-lock.json", "yarn.lock", "bun.lock", "bun.lockb"]) {
      expect(existsSync(join(ROOT, competingLock)), competingLock).toBe(false);
    }
  });
});
