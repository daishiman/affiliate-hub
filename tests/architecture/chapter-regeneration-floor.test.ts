/**
 * @tier 1
 * @req REQ-TS15
 * @types equivalence, boundary
 *
 * 2026-09-06: 手書き本文を正本 chapter_notes へ接続し、再生成不能の固定から
 * 全文再現・欠落検出へ反転。旧実測の下限は維持し、上限の引上げではなく
 * 正本からの完全再現と重複拒否で肥大化を止める。旧実装/PASS 記録は歴史として扱う。
 */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
const ROOT = process.cwd();
const RESIDUE_SECTIONS = [
    "compile が保てなかった行 (要判断)",
    "章にしか無い記述 (正本へ未接続)",
] as const;
function withoutResidue(text: string): string {
    const out: string[] = [];
    let dropping = false;
    for (const line of text.split("\n")) {
        if (/^## /.test(line)) {
            dropping = RESIDUE_SECTIONS.includes(line.slice(3) as never);
        }
        if (!dropping)
            out.push(line);
    }
    return out.join("\n");
}
function measure(source: string) {
    const text = withoutResidue(source);
    const lines = text.split("\n");
    const headings = lines.filter((l) => /^#{2,6} /.test(l));
    const tableRows = (name: string): number => {
        const candidates = lines.flatMap((line, i) => {
            const heading = line.match(/^(#{2,6}) (.+)$/);
            if (!heading || (heading[2] !== name && !(name === "To-Be" && heading[2] === "To-Be（規範契約）"))) return [];
            let count = 0;
            for (let j = i + 1; j < lines.length; j++) {
                const next = lines[j].match(/^(#{2,6}) /);
                if (next && next[1].length <= heading[1].length) break;
                if (lines[j].startsWith("|") && !/^\|\s*-+/.test(lines[j])) count += 1;
            }
            return [count];
        });
        return Math.max(0, ...candidates);
    };
    const answers = (text.match(/\*\*回答\*\*: [^\n]*/g) ?? []).map((s) => s.length - 8);
    return {
        lines: lines.length - 1,
        sections: headings.map((l) => l.replace(/^#{2,6} /, "")),
        rootSections: lines.filter((l) => /^## /.test(l)).map((l) => l.slice(3)),
        headings: headings.length,
        tableRows,
        principles: (text.match(/^- 原則: /gm) ?? []).length,
        hasNonNormativeNote: text.includes("**非規範・取得証跡なし・実装根拠に使用不可**"),
        answers,
        answersTotal: answers.reduce((a, b) => a + b, 0),
    };
}
const SHAPE_A = [
    "状態の意味 (State semantics)",
    "As-Is",
    "To-Be",
    "Delta",
    "Dependencies",
    "Acceptance evidence",
    "カテゴリ別収集状態",
    "確定内容 (質疑録)",
    "上流指針 (doctrine anchor)",
    "適用された設計知識",
    "最新ドキュメント出典",
] as const;
const SHAPE_A_WITH_CELL_RECORD = [
    "状態の意味 (State semantics)",
    "As-Is",
    "To-Be",
    "Delta",
    "Dependencies",
    "Acceptance evidence",
    "カテゴリ別収集状態",
    "確定セルの記録 (正本 spec-state.json)",
    "意思決定 (decisions)",
    "確定内容 (質疑録)",
    "上流指針 (doctrine anchor)",
    "適用された設計知識",
    "最新ドキュメント出典",
] as const;
const SHAPE_B = [
    "状態の意味と実装差分",
    "カテゴリ別収集状態",
    "確定セルの記録 (正本 spec-state.json)",
    "意思決定 (decisions)",
    "確定内容 (質疑録)",
    "上流指針 (doctrine anchor)",
    "適用された設計知識",
    "最新ドキュメント出典",
] as const;
type Chapter = {
    readonly name: string;
    readonly sections: readonly string[];
    readonly tables: ReadonlyArray<readonly [
        string,
        number
    ]>;
    readonly lines: number;
    readonly floorMeasuredOn: string;
    readonly headings: number;
    readonly principles: number;
    readonly answers: readonly [
        count: number,
        chars: number
    ] | null;
};
const LEGACY_MEASUREMENT_REFERENCE_ON = "2026-08-22";
const CHAPTERS: readonly Chapter[] = [
    {
        name: "auth",
        sections: [...SHAPE_A_WITH_CELL_RECORD, "章の注記 (chapter_notes)"],
        tables: [
            ["To-Be", 5],
            ["Acceptance evidence", 6],
            ["カテゴリ別収集状態", 7],
            ["上流指針 (doctrine anchor)", 3],
            ["最新ドキュメント出典", 2],
        ],
        lines: 153,
        floorMeasuredOn: "2026-08-19",
        headings: 21,
        principles: 2,
        answers: [1, 321],
    },
    {
        name: "backend",
        sections: [...SHAPE_B, "章の注記 (chapter_notes)"],
        tables: [
            ["カテゴリ別収集状態", 7],
            ["上流指針 (doctrine anchor)", 3],
            ["最新ドキュメント出典", 2],
        ],
        lines: 292,
        floorMeasuredOn: "2026-08-19",
        headings: 35,
        principles: 2,
        answers: [1, 111],
    },
    {
        name: "database",
        sections: [...SHAPE_B, "章の注記 (chapter_notes)"],
        tables: [
            ["カテゴリ別収集状態", 7],
            ["上流指針 (doctrine anchor)", 3],
            ["最新ドキュメント出典", 2],
        ],
        lines: 219,
        floorMeasuredOn: "2026-08-19",
        headings: 21,
        principles: 2,
        answers: [2, 102],
    },
    {
        name: "frontend",
        sections: [...SHAPE_A_WITH_CELL_RECORD, "章の注記 (chapter_notes)"],
        tables: [
            ["To-Be", 5],
            ["Acceptance evidence", 5],
            ["カテゴリ別収集状態", 7],
            ["上流指針 (doctrine anchor)", 3],
            ["最新ドキュメント出典", 2],
            ["確定内容 (質疑録)", 9],
        ],
        lines: 172,
        floorMeasuredOn: "2026-08-19",
        headings: 21,
        principles: 2,
        answers: [2, 95],
    },
    {
        name: "infrastructure",
        sections: [...SHAPE_B, "章の注記 (chapter_notes)"],
        tables: [
            ["カテゴリ別収集状態", 7],
            ["上流指針 (doctrine anchor)", 3],
            ["最新ドキュメント出典", 2],
        ],
        lines: 179,
        floorMeasuredOn: "2026-08-19",
        headings: 23,
        principles: 2,
        answers: [2, 154],
    },
    {
        name: "maintenance-ops",
        sections: [...SHAPE_A_WITH_CELL_RECORD, "章の注記 (chapter_notes)"],
        tables: [
            ["To-Be", 8],
            ["Acceptance evidence", 8],
            ["カテゴリ別収集状態", 7],
            ["上流指針 (doctrine anchor)", 2],
            ["最新ドキュメント出典", 2],
            ["確定内容 (質疑録)", 5],
        ],
        lines: 167,
        floorMeasuredOn: "2026-08-19",
        headings: 21,
        principles: 2,
        answers: [2, 116],
    },
    {
        name: "security",
        sections: [...SHAPE_A_WITH_CELL_RECORD, "章の注記 (chapter_notes)"],
        tables: [
            ["To-Be", 6],
            ["Acceptance evidence", 6],
            ["カテゴリ別収集状態", 7],
            ["上流指針 (doctrine anchor)", 2],
            ["最新ドキュメント出典", 2],
        ],
        lines: 173,
        floorMeasuredOn: "2026-08-19",
        headings: 21,
        principles: 2,
        answers: [2, 66],
    },
    {
        name: "ui-ux",
        sections: [...SHAPE_A_WITH_CELL_RECORD, "履歴", "章の注記 (chapter_notes)"],
        tables: [
            ["To-Be", 5],
            ["Acceptance evidence", 5],
            ["カテゴリ別収集状態", 7],
            ["上流指針 (doctrine anchor)", 2],
            ["最新ドキュメント出典", 2],
        ],
        lines: 223,
        floorMeasuredOn: "2026-08-19",
        headings: 28,
        principles: 2,
        answers: [2, 49],
    },
];
const GENERATED_SECTIONS = [
    "カテゴリ別収集状態",
    "確定セルの記録 (正本 spec-state.json)",
    "意思決定 (decisions)",
    "確定内容 (質疑録)",
    "章の注記 (chapter_notes)",
    "上流指針 (doctrine anchor)",
    "適用された設計知識",
    "最新ドキュメント出典",
] as const;
const PROBE_DIR = process.env.CHAPTER_FLOOR_PROBE_DIR;
const SPEC_DIR = PROBE_DIR ?? join(ROOT, "system-spec");
const GENERATED_DIR = mkdtempSync(join(tmpdir(), "chapter-floor-generated-"));
const compile = spawnSync("python3", [
    join(ROOT, ".claude/plugins/system-spec-harness/skills/run-system-spec-compile/scripts/compile-spec-doc.py"),
    "compile", "--spec", join(ROOT, "system-spec/spec-state.json"),
    "--references", join(ROOT, "system-spec/fetched-references.json"), "--out-dir", GENERATED_DIR,
], { encoding: "utf8" });
afterAll(() => rmSync(GENERATED_DIR, { recursive: true, force: true }));
function read(name: string): string {
    return readFileSync(join(SPEC_DIR, `${name}.md`), "utf8");
}
function decisionIds(owner?: string): string[] {
    const state = JSON.parse(readFileSync(join(ROOT, "system-spec/spec-state.json"), "utf8")) as {
        decisions: Array<{
            id: string;
            owner_category?: string;
        }>;
    };
    return state.decisions
        .filter((d) => owner === undefined || d.owner_category === owner)
        .map(({ id }) => id);
}
function decisionIdsInSection(text: string, heading: string): string[] {
    const lines = text.split("\n");
    const start = lines.findIndex((line) => line === heading);
    if (start < 0)
        return [];
    return lines
        .slice(start + 1, lines.findIndex((line, index) => index > start && /^## /.test(line)))
        .map((line) => line.match(/^\|\s*\*{0,2}`?(dec(?:ision)?-[a-z0-9-]+)`?\*{0,2}\s*\|/)?.[1])
        .filter((id): id is string => id !== undefined);
}
describe("8 章を再生成しても痩せないこと (C03 の事前の床)", () => {
    it("空の一時出力先へ正本だけから生成できる", () => {
        expect(compile.status, compile.stderr).toBe(0);
    });
    it("測定用の口が開いていない（通常の実行では確定章そのものを見ている）", () => {
        expect(PROBE_DIR, "CHAPTER_FLOOR_PROBE_DIR が設定されたまま走っています").toBeUndefined();
    });
    it("床を置いた章が、確定 8 章と過不足なく一致している", () => {
        expect([...CHAPTERS].map((c) => c.name).sort()).toEqual([
            "auth",
            "backend",
            "database",
            "frontend",
            "infrastructure",
            "maintenance-ops",
            "security",
            "ui-ux",
        ]);
    });
    it("床の由来が辿れる（測った日が全章に在り、まだ測り直していない章を数え上げで固定する）", () => {
        const malformed = CHAPTERS.filter((c) => !/^\d{4}-\d{2}-\d{2}$/.test(c.floorMeasuredOn)).map((c) => c.name);
        expect(malformed).toEqual([]);
        expect(CHAPTERS.length).toBe(8);
        const legacyMeasuredChapters = CHAPTERS.filter((c) => c.floorMeasuredOn < LEGACY_MEASUREMENT_REFERENCE_ON).map((c) => c.name);
        expect(legacyMeasuredChapters.sort()).toEqual([
            "auth",
            "backend",
            "database",
            "frontend",
            "infrastructure",
            "maintenance-ops",
            "security",
            "ui-ux",
        ]);
        expect(LEGACY_MEASUREMENT_REFERENCE_ON).toBe("2026-08-22");
    });
    it("00章の意思決定表が正本 decisions[] と全件一致する（compile が描く側）", () => {
        expect(decisionIdsInSection(read("00-requirements-definition"), "## 意思決定支援 (decisions)")).toEqual(decisionIds());
    });
    it.each(CHAPTERS.map((c) => c.name))("%s.md の意思決定表が正本の主担当分と一致する（compile が描く側）", (name) => {
        expect(decisionIdsInSection(read(name), "## 意思決定 (decisions)"), `${name}.md`).toEqual(decisionIds(name));
    });
    it("8 章の意思決定表の和が正本 decisions[] の全件になる（どの章にも載らない決定を出さない）", () => {
        const listed = CHAPTERS.flatMap((c) => decisionIdsInSection(read(c.name), "## 意思決定 (decisions)"));
        expect([...listed].sort()).toEqual([...decisionIds()].sort());
    });
    it("gap 1 の 2 節は 8 章すべてに載っている（旧 11 節の形を指す章は 0 件）", () => {
        const GAP1_SECTIONS = ["確定セルの記録 (正本 spec-state.json)", "意思決定 (decisions)"];
        const withoutGap1 = CHAPTERS.filter((c) => {
            const sections = measure(read(c.name)).sections;
            return !GAP1_SECTIONS.every((s) => sections.includes(s));
        }).map((c) => c.name);
        expect(withoutGap1).toEqual([]);
        expect(CHAPTERS.length).toBe(8);
        const stillShapeA = CHAPTERS.filter((c) => c.sections === SHAPE_A).map((c) => c.name);
        expect(stillShapeA).toEqual([]);
        expect([...SHAPE_A]).toEqual([
            "状態の意味 (State semantics)",
            "As-Is",
            "To-Be",
            "Delta",
            "Dependencies",
            "Acceptance evidence",
            "カテゴリ別収集状態",
            "確定内容 (質疑録)",
            "上流指針 (doctrine anchor)",
            "適用された設計知識",
            "最新ドキュメント出典",
        ]);
    });
    describe.each(CHAPTERS)("$name.md", (ch) => {
        const m = measure(read(ch.name));
        it("必須の節が 1 つも欠けていない（これが床）", () => {
            const missing = ch.sections.filter((s) => !m.sections.includes(s));
            expect(missing).toEqual([]);
        });
        it("章の root 節は生成契約どおりで、歴史本文は章の注記から脱出しない", () => {
            expect(m.rootSections).toEqual(GENERATED_SECTIONS);
        });
        it("非規範注記が残っている（実装根拠に使えない参照であることの断り）", () => {
            expect(m.hasNonNormativeNote).toBe(true);
        });
        it(`見出しが ${ch.headings} 個以上ある（節を残して中身を空にする形を止める）`, () => {
            expect(m.headings).toBeGreaterThanOrEqual(ch.headings);
        });
        it.each(ch.tables)("表「%s」の本文行が %i 行以上ある", (name, floor) => {
            expect(m.tableRows(name)).toBeGreaterThanOrEqual(floor);
        });
        it(`本章での適用の原則が ${ch.principles} 件以上ある`, () => {
            expect(m.principles).toBeGreaterThanOrEqual(ch.principles);
        });
        it(`行数は旧実測の床 ${ch.lines} 以上で、上乗せは正本由来の生成本文だけ`, () => {
            expect(m.lines).toBeGreaterThanOrEqual(ch.lines);
            expect(read(ch.name)).toBe(readFileSync(join(GENERATED_DIR, `${ch.name}.md`), "utf8"));
        });
        if (ch.answers !== null) {
            const [count, chars] = ch.answers;
            it(`確定回答が ${count} 本以上あり、逐語のまま残っている（合計 ${chars} 字以上）`, () => {
                expect(m.answers.length).toBeGreaterThanOrEqual(count);
                expect(m.answersTotal).toBeGreaterThanOrEqual(chars);
            });
        }
    });
    it("compile の申し送りが増えていない（正本へ接続できていない章の数）", () => {
        const scanned = CHAPTERS.map((ch) => {
            const text = readFileSync(join(ROOT, "system-spec", `${ch.name}.md`), "utf8");
            expect(text.split("\n").length, `${ch.name}.md: 走査する本文が床を割っている`).toBeGreaterThanOrEqual(ch.lines);
            return {
                name: ch.name,
                found: RESIDUE_SECTIONS.filter((s) => text.includes(`\n## ${s}`)),
            };
        });
        expect(scanned.length, "申し送りを検査した章の母集団").toBeGreaterThanOrEqual(8);
        const residue = scanned.filter((r) => r.found.length > 0);
        expect(residue.reduce((n, r) => n + r.found.length, 0), [
            "compile が正本へ接続できなかった行の報告が増えています。",
            residue.map((r) => `  ${r.name}: ${r.found.join(" / ")}`).join("\n"),
            "",
            "直し方は 2 つだけです（compile 自身が章末に書いています）。",
            "  (1) 事実を正本 spec-state.json から引けるようにする（推奨）",
            "  (2) 正本に居場所が無い記録なら、生成節の内側ではなく独立した `##` 節へ移す",
            "**この数を上げて緑にしないでください。**上げた時点で、ずれは減らなくなります。",
        ].join("\n")).toBe(0);
    });
    describe("痩せた章を止められること", () => {
        describe.each(CHAPTERS)("$name.md", (ch) => {
            const full = read(ch.name);
            it("節を 1 つ落とすと、欠けたものとして名指しで出る", () => {
                const last = ch.sections[ch.sections.length - 1];
                const cut = full.replace(`## ${last}\n`, "");
                const missing = ch.sections.filter((s) => !measure(cut).sections.includes(s));
                expect(missing).toEqual([last]);
            });
            it("非規範注記を消すと見つかる", () => {
                const cut = full.replace("**非規範・取得証跡なし・実装根拠に使用不可**", "参考");
                expect(measure(cut).hasNonNormativeNote).toBe(false);
            });
            it("収集状態の表から 1 行消すと床を割る", () => {
                const i = full.split("\n").findIndex((l) => l === "## カテゴリ別収集状態");
                const lines = full.split("\n");
                const at = lines.findIndex((l, j) => j > i && l.startsWith("|") && !/^\|\s*-+/.test(l));
                const cut = [...lines.slice(0, at), ...lines.slice(at + 1)].join("\n");
                expect(measure(cut).tableRows("カテゴリ別収集状態")).toBeLessThan(7);
            });
        });
        describe("auth.md（この章にしかない当てどころ）", () => {
            const full = read("auth");
            it("対象外の 5 行を消すと、収集状態の表が床を割る", () => {
                const cut = full
                    .split("\n")
                    .filter((l) => !/^\|[^|]+\| 対象外 \|/.test(l))
                    .join("\n");
                expect(measure(cut).tableRows("カテゴリ別収集状態")).toBeLessThan(7);
            });
            it("確定回答を要約に置き換えると、逐語の床を割る", () => {
                const cut = full.replace(/\*\*回答\*\*: .*/g, "**回答**: Better Auth を採用。");
                expect(measure(cut).answersTotal).toBeLessThan(321);
            });
            it("回答を 1 本足しただけでは床を割らない（合計は加算単調である）", () => {
                const added = `${full}\n**回答**: 短い追記\n`;
                expect(measure(added).answersTotal).toBeGreaterThanOrEqual(321);
            });
            it("原則を 1 件に減らすと床を割る", () => {
                const kept = full.split("\n").filter((l) => l.startsWith("- 原則: "))[0];
                const cut = full
                    .split("\n")
                    .filter((l) => !l.startsWith("- 原則: ") || l === kept)
                    .join("\n");
                expect(measure(cut).principles).toBeLessThan(2);
            });
        });
    });
});
