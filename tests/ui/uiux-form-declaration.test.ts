/**
 * @tier 2
 * @req REQ-UX06
 * @types code-boundary
 *
 * 画面の操作は、AI へ渡すか渡さないかを**必ず名乗る**。
 *
 * --- なぜ検査が要るか ---
 *
 * 素の `<form>` は 2 つの意味を同時に持つ。「AI へは渡さないと決めた」と
 * 「`ToolForm` へ移し忘れた」である。この 2 つは `<form>` の行からは見分けが付かない。
 * だから後者が前者の顔をして残り続ける。実際そうなっていた: `inbox-forms.tsx` の
 * 中の欄には `toolParamDescription`（AI へ何の値かを説明する宣言）が書いてあったのに、
 * 包む `<form>` が道具として名乗っていなかった。**説明はどこにも届いていなかった。**
 *
 * 意図をコメントで書いても足りない。コメントはファイルの冒頭にあり、
 * `<form>` の行からは見えない。意図は型で残すしかない。
 *   - AI から呼べる操作 → `ToolForm`（`toolName` / `toolDescription` が必須）
 *   - AI から呼べない操作 → `HumanOnlyForm`（`reason` が必須）
 * どちらも必須引数なので、消せば型が通らない。
 *
 * --- 何を見るか ---
 *
 *   1. 生 `<form>` を書いてよいのは 2 つの根（`tool-form.tsx` と `human-only-form.tsx`）だけ
 *   2. 例外は `method="get"` を**その場に**持つもの。何も変えないことがタグの行から見える
 *   3. 検査が空振りしていない（母集団の床・2 つの根の実在・両方の部品が実際に使われている）
 *
 * 3 を見る理由は、1 と 2 だけだと**走査に失敗して 0 件を返す実装でも緑になる**ため。
 * 「0 件である」と主張する検査には、0 でないはずの数の床が同居していなければならない。
 *
 * 規範: docs/spec/feat-uiux-overhaul/component-contract.md
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const ROOTS = ["src/app", "src/presentation"] as const;

/** 生 `<form>` を書いてよい 2 つのファイル。ここが `ToolForm` / `HumanOnlyForm` の中身。 */
const FORM_ROOTS = [
  join("src", "presentation", "ui", "primitives", "tool-form.tsx"),
  join("src", "presentation", "ui", "primitives", "human-only-form.tsx"),
] as const;

/** 母集団の床。走査対象がこれを下回るなら、走査そのものが壊れている。 */
const MIN_SCANNED_FILES = 100;
/** 2 つの部品が実際に使われている件数の床。0 なら移行が消えている。 */
const MIN_TOOL_FORM_USES = 20;
const MIN_HUMAN_ONLY_USES = 8;
/**
 * 取り出し器が拾うべき生 `<form>` の床。
 *
 * 2 つの根 + 何も変えない `method="get"` の 3 つ = 5。これを下回るなら、
 * 取り出し器が壊れていて「見つからない」だけである。
 */
const MIN_RAW_FORM_TAGS = 5;

function collectTsx(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectTsx(full, out);
    } else if (entry.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

/**
 * コメントを消す。**文字列は消さない。**
 *
 * 説明文の中で `<form>` に言及している箇所は当然たくさんある（この検査の話をしている
 * コメントがまさにそれ）。消さないと、書いた説明の数だけ赤くなる。
 * 一方、属性は文字列として書かれる（`method="get"`）ので、そちらは残す必要がある。
 * 消す範囲を「コメントだけ」に絞ると、消し過ぎと消し足りないの両方を避けられる。
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

/** 開始タグ `<form ...>` を丸ごと取り出す。属性が複数行に跨っていても 1 つとして拾う。 */
function rawFormTags(source: string): string[] {
  const tags: string[] = [];
  const opener = /<form(?=[\s/>])/g;
  let match = opener.exec(source);
  while (match !== null) {
    const end = source.indexOf(">", match.index);
    tags.push(source.slice(match.index, end === -1 ? source.length : end + 1));
    match = opener.exec(source);
  }
  return tags;
}

const files = ROOTS.flatMap((root) => collectTsx(root));
const sources = new Map(files.map((f) => [relative(process.cwd(), f), readFileSync(f, "utf8")]));

describe("画面の操作は AI へ渡すか渡さないかを名乗る", () => {
  it("検査が空振りしていない", () => {
    expect(files.length).toBeGreaterThanOrEqual(MIN_SCANNED_FILES);

    // 2 つの根が実在する。片方が消えれば、残った側が唯一の逃げ道になる。
    for (const root of FORM_ROOTS) {
      expect([...sources.keys()].map((k) => k.split("/").join(sep))).toContain(root);
    }

    const all = [...sources.values()].join("\n");
    expect(all.match(/<ToolForm[\s>]/g)?.length ?? 0).toBeGreaterThanOrEqual(MIN_TOOL_FORM_USES);
    // ActionButton は中身が HumanOnlyForm なので、そちらも「渡さないと決めた」件数に数える。
    const humanOnly =
      (all.match(/<HumanOnlyForm[\s>]/g)?.length ?? 0) +
      (all.match(/<ActionButton[\s>]/g)?.length ?? 0);
    expect(humanOnly).toBeGreaterThanOrEqual(MIN_HUMAN_ONLY_USES);

    // 取り出し器そのものが動いていることを示す。
    // ここが 0 なら、次の検査は「1 つも見つけない実装」として緑になる。
    const found = [...sources.values()].flatMap((s) => rawFormTags(stripComments(s)));
    expect(found.length).toBeGreaterThanOrEqual(MIN_RAW_FORM_TAGS);
  });

  it("生 <form> は 2 つの根と、何も変えない method=\"get\" だけ", () => {
    const offenders: string[] = [];

    for (const [path, source] of sources) {
      const normalized = path.split("/").join(sep);
      if ((FORM_ROOTS as readonly string[]).includes(normalized)) continue;

      for (const tag of rawFormTags(stripComments(source))) {
        // 何も変えないことがタグの行から見えるものだけを許す。
        // `method={...}` のように値が式なら許さない。式の中身はタグからは読めない。
        if (/method\s*=\s*["']get["']/i.test(tag)) continue;
        offenders.push(`${path}: ${tag.replace(/\s+/g, " ").slice(0, 80)}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
