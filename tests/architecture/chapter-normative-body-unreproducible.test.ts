/**
 * @tier 1
 * @req REQ-TS15
 * @types equivalence, boundary
 *
 * 2026-09-06: 手書き本文を正本 chapter_notes へ接続し、再生成不能の固定から
 * 全文再現・欠落検出へ反転。旧実測の下限は維持し、上限の引上げではなく
 * 正本からの完全再現と重複拒否で肥大化を止める。旧実装/PASS 記録は歴史として扱う。
 */
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
const ROOT = join(import.meta.dirname, "..", "..");
const SPEC_DIR = join(ROOT, "system-spec");
const COMPILER = join(ROOT, ".claude/plugins/system-spec-harness/skills/run-system-spec-compile/scripts/compile-spec-doc.py");
const REQUIREMENT_ID = /\b[A-Z][A-Z0-9]*-(?:REQ|ACC)-\d+\b|\b(?:DB|BE|INF)-[A-Z]+-\d+\b/g;
const REQUIREMENT_ID_EXACT = /^(?:[A-Z][A-Z0-9]*-(?:REQ|ACC)-\d+|(?:DB|BE|INF)-[A-Z]+-\d+)$/;
function cellsOf(line: string): string[] {
    return line
        .split(/(?<!\\)\|/)
        .slice(1, -1)
        .map((s) => s.trim());
}
function definitionsInChapters(): Map<string, {
    def: string;
    file: string;
}> {
    const defs = new Map<string, {
        def: string;
        file: string;
    }>();
    for (const name of markdownIn(SPEC_DIR)) {
        for (const line of readFileSync(join(SPEC_DIR, name), "utf8").split("\n")) {
            if (!line.startsWith("|"))
                continue;
            const cells = cellsOf(line);
            if (cells.length < 2 || !REQUIREMENT_ID_EXACT.test(cells[0]))
                continue;
            if (!defs.has(cells[0]))
                defs.set(cells[0], { def: cells[1], file: name });
        }
    }
    return defs;
}
type Occurrence = {
    file: string;
    line: number;
    ids: string[];
    namesChapter: boolean;
};
function bareIdOccurrences(dir: string): Occurrence[] {
    const owner = new Map([...definitionsInChapters()].map(([id, d]) => [id, d.file]));
    const out: Occurrence[] = [];
    for (const name of markdownIn(dir)) {
        const lines = readFileSync(join(dir, name), "utf8").split("\n");
        const heads = lines.flatMap((l, i) => (/^##\s/.test(l) ? [i] : []));
        lines.forEach((line, i) => {
            const ids = line.match(REQUIREMENT_ID);
            if (!ids)
                return;
            const start = heads.filter((h) => h <= i).pop() ?? 0;
            const end = heads.find((h) => h > i) ?? lines.length;
            const section = lines.slice(start, end).join("\n");
            const ownHome = ids.every((id) => owner.get(id) === name);
            out.push({
                file: name,
                line: i + 1,
                ids,
                namesChapter: ownHome || /`?system-spec\/[a-z-]+\.md`?/.test(section),
            });
        });
    }
    return out;
}
const SHORTEST_DEFINITION_FLOOR = 10;
const POSITIVE_CONTROL = "decision-auth-method";
const CHAPTER_ID_FLOOR = 65;
function markdownIn(dir: string): string[] {
    return readdirSync(dir)
        .filter((n) => n.endsWith(".md"))
        .sort();
}
function idsIn(dir: string): Set<string> {
    const found = new Set<string>();
    for (const name of markdownIn(dir)) {
        for (const id of readFileSync(join(dir, name), "utf8").matchAll(REQUIREMENT_ID)) {
            found.add(id[0]);
        }
    }
    return found;
}
function compileToTemp(): string {
    const out = mkdtempSync(join(tmpdir(), "spec-compile-"));
    temporaryDirectories.push(out);
    const proc = spawnSync("python3", [
        COMPILER,
        "compile",
        "--spec",
        join(SPEC_DIR, "spec-state.json"),
        "--references",
        join(SPEC_DIR, "fetched-references.json"),
        "--out-dir",
        out,
    ], { encoding: "utf8" });
    expect(proc.status, `生成器が失敗した: ${proc.stderr}`).toBe(0);
    return out;
}
const temporaryDirectories: string[] = [];
afterAll(() => {
    for (const directory of temporaryDirectories)
        rmSync(directory, { recursive: true, force: true });
});
describe("章の要件定義と歴史記録が正本から再生成できる (REQ-TS15)", () => {
    it("生成器の実体がある — 無ければ以下の 0 件は測れていないだけになる", () => {
        expect(existsSync(COMPILER)).toBe(true);
    });
    it("章側に要件 ID が 65 件以上ある（母集団の床。ここが空だと 0 件に意味が無い）", () => {
        const chapter = idsIn(SPEC_DIR);
        expect(chapter.size).toBeGreaterThanOrEqual(CHAPTER_ID_FLOOR);
    });
    it("陽性対照: 生成器出力に decision-auth-method が現れる（測る側が動いている）", () => {
        const out = compileToTemp();
        const names = markdownIn(out);
        expect(names.length).toBeGreaterThan(0);
        const hits = names.filter((n) => readFileSync(join(out, n), "utf8").includes(POSITIVE_CONTROL));
        expect(hits.length).toBeGreaterThanOrEqual(1);
    });
    it("全定義本文が同じ章へ再生成される（歴史記録を現行規範へ昇格しない）", () => {
        const out = compileToTemp();
        const defs = definitionsInChapters();
        const outText = markdownIn(out)
            .map((n) => readFileSync(join(out, n), "utf8"))
            .join("\n");
        expect(defs.size).toBeGreaterThanOrEqual(CHAPTER_ID_FLOOR);
        expect(Math.min(...[...defs.values()].map((d) => d.def.length))).toBeGreaterThanOrEqual(SHORTEST_DEFINITION_FLOOR);
        const specText = markdownIn(SPEC_DIR)
            .map((n) => readFileSync(join(SPEC_DIR, n), "utf8"))
            .join("\n");
        expect([...defs.values()].filter((d) => specText.includes(d.def))).toHaveLength(defs.size);
        const missing = [...defs]
            .filter(([, d]) => !readFileSync(join(out, d.file), "utf8").includes(d.def))
            .map(([id]) => id)
            .sort();
        expect(missing).toEqual([]);
        expect(outText).toContain("歴史的スナップショット（現行規範ではない");
        const [removedId, removed] = [...defs][0];
        const damaged = readFileSync(join(out, removed.file), "utf8").replaceAll(removed.def, "削除された本文");
        expect(damaged.includes(removed.def), removedId).toBe(false);
        const detected = [...defs].filter(([, definition]) => {
            const content = definition.file === removed.file ? damaged : readFileSync(join(out, definition.file), "utf8");
            return !content.includes(definition.def);
        }).map(([id]) => id);
        expect(detected).toContain(removedId);
    });
    it("生成された要件参照は定義の所在を解決できる（未定義参照は 0 件）", () => {
        const out = compileToTemp();
        const occurrences = bareIdOccurrences(out);
        expect(occurrences.length).toBeGreaterThan(0);
        const distinct = [...new Set(occurrences.flatMap((o) => o.ids))].sort();
        const definitions = definitionsInChapters();
        expect(distinct).toEqual([...definitions.keys()].sort());
        const unresolved = occurrences.flatMap((o) => o.ids.filter((id) => !definitions.has(id)));
        expect(unresolved).toEqual([]);
        const probe = mkdtempSync(join(tmpdir(), "bare-id-probe-"));
        temporaryDirectories.push(probe);
        const foreign = [...definitionsInChapters()].find(([, d]) => d.file !== "ui-ux.md")![0];
        writeFileSync(join(probe, "ui-ux.md"), `## 節\n\n${foreign} に従う。\n`, "utf8");
        expect(bareIdOccurrences(probe).filter((o) => !o.namesChapter)).toHaveLength(1);
        const own = [...definitionsInChapters()].find(([, d]) => d.file === "ui-ux.md")![0];
        writeFileSync(join(probe, "ui-ux.md"), `## 節\n\n${own} に従う。\n`, "utf8");
        expect(bareIdOccurrences(probe).filter((o) => !o.namesChapter)).toHaveLength(0);
    });
    it("生成器は章の枚数ぶんを出す（出力が痩せて 0 件になっていない）", () => {
        const out = compileToTemp();
        expect(markdownIn(out).length).toBe(markdownIn(SPEC_DIR).length);
    });
    it("全定義本文の材料が正本へ接続されており、compiler への本文ハードコードではない", () => {
        const defs = definitionsInChapters();
        expect(defs.size).toBeGreaterThanOrEqual(CHAPTER_ID_FLOOR);
        const state = readFileSync(join(SPEC_DIR, "spec-state.json"), "utf8");
        const libDir = join(ROOT, ".claude/plugins/system-spec-harness/lib");
        const libSource = readdirSync(libDir)
            .filter((n) => n.endsWith(".py"))
            .map((n) => readFileSync(join(libDir, n), "utf8"))
            .join("\n");
        expect(state).toContain(POSITIVE_CONTROL);
        expect(libSource.length).toBeGreaterThan(0);
        const decoded = JSON.parse(state) as unknown;
        const sourceStrings = (value: unknown): string[] => typeof value === "string" ? [value]
            : Array.isArray(value) ? value.flatMap(sourceStrings)
                : value && typeof value === "object" ? Object.values(value).flatMap(sourceStrings) : [];
        const bodies = sourceStrings(decoded);
        const disconnected = [...defs]
            .filter(([, d]) => !bodies.some((body) => body.includes(d.def)))
            .map(([id]) => id)
            .sort();
        expect(disconnected).toEqual([]);
        expect([...defs].filter(([, d]) => libSource.includes(d.def))).toEqual([]);
    });
    it("2026-08-20 に追記した『条項引用の可否』節は 8 章とも生成器を往復する", () => {
        const out = compileToTemp();
        const withSection = markdownIn(SPEC_DIR).filter((n) => readFileSync(join(SPEC_DIR, n), "utf8").includes("条項引用の可否"));
        expect(withSection).toHaveLength(8);
        for (const name of withSection) {
            expect(readFileSync(join(out, name), "utf8"), `${name}: 節が生成器出力に無い`).toContain("条項引用の可否");
        }
    });
});
