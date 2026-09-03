/** @tier 1 */
/** @req REQ-TS15 */
/** @types equivalence */
/**
 * 章の「上流指針 (doctrine anchor)」が、その章の確定要件を実際に覆っていること。
 *
 * ── 何が接続されていなかったか ──────────────────────────────
 *
 * 8 章すべてに `## 上流指針 (doctrine anchor)` の表が在り、その直後にこう書いてある——
 *
 *     本章の確定内容 (質疑録) は上記 authority を上流指針として適用する。
 *
 * **この文には強制力が無い。**表に載る concern と、確定セルが実際に要求した
 * 必須情報 (`required_info`) の concern は、別々の正本から来ていて
 * **誰も突き合わせていなかった。**ah-bgp の gap 2 が言う「doctrine anchor が
 * 宣言されているが、確定セル要件と接続されていない」はこの状態である。
 *
 * 覆われていない状態は静かに壊れる: 章は上流指針を掲げたまま、その指針が
 * 何も言っていない領域の要件を確定できる。読む人は「この確定は OWASP に従っている」と
 * 読むが、実際には**その concern の authority は表に載っていない。**
 *
 * ── 何を突き合わせるか ─────────────────────────────────────
 *
 *     spec-state.json  matrix[cat][platform].required_info[].item_id
 *          ↓ required-info-catalog.json が item → concern を決める
 *     concern
 *          ↓ doctrine-anchor-registry.json の category_concern_map[cat]
 *     章の上流指針表に載る concern
 *
 * この鎖が切れていないことを見る。**章 md は読まない。**章は正本の純関数として
 * この 2 つの registry から描かれるので、md を読むと同じ値を 2 回見るだけになる。
 *
 * ── 判定は引数を取る ───────────────────────────────────────
 *
 * `system-spec/*.md` と `spec-state.json` は `guard-confirmed-chapter-overwrite` が
 * 守っており、破壊実験のために壊すことができない。なので判定を実ファイル読み込みから
 * 切り離し、**合成入力で赤を出せる形**にしてある (ah-5nu と同じ作法)。
 *
 * ── 実測 2026-08-30 ────────────────────────────────────────
 *
 * 覆われていない concern は 0 件。ただし **`required_info` を持つ確定セルは
 * 8 章中 4 つしかない** (auth / ui-ux / security / backend)。残り 4 章の必須情報は
 * `missing_effect` が degrade / warn で、block ではないため登録が無い。
 * **母数を下の検査に併記してある**——4 が 0 に落ちた日、この検査は
 * 「覆われていない concern は 0 件」と言い続けながら何も見なくなる。
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const HARNESS = join(ROOT, ".claude", "plugins", "system-spec-harness");

type Item = { readonly item_id: string; readonly domain: string; readonly concern: string };
type Catalog = { readonly in_scope_domains: readonly string[]; readonly items: readonly Item[] };
type Registry = {
  readonly category_concern_map: Record<string, readonly string[]>;
  readonly concerns: readonly { readonly concern_id: string }[];
};
type Cell = {
  readonly state?: string;
  readonly required_info?: readonly { readonly item_id: string }[];
};
type State = {
  readonly matrix: Record<string, Record<string, Cell>>;
  readonly excluded_categories?: Record<string, string>;
};

function read<T>(...parts: string[]): T {
  return JSON.parse(readFileSync(join(...parts), "utf8")) as T;
}

const catalog = read<Catalog>(
  HARNESS,
  "skills",
  "run-system-spec-elicit",
  "references",
  "required-info-catalog.json",
);
const registry = read<Registry>(
  HARNESS,
  "skills",
  "ref-system-design-knowledge",
  "references",
  "doctrine-anchor-registry.json",
);
const state = read<State>(ROOT, "system-spec", "spec-state.json");

/** 章 1 つぶんの「要求された concern」。**item が catalog に無ければ、それも綻びとして返す。** */
function requiredConcerns(
  cell: Cell,
  items: readonly Item[],
): { readonly concerns: string[]; readonly unknown: string[] } {
  const byId = new Map(items.map((i) => [i.item_id, i.concern]));
  const concerns = new Set<string>();
  const unknown: string[] = [];
  for (const entry of cell.required_info ?? []) {
    const concern = byId.get(entry.item_id);
    if (concern === undefined) unknown.push(entry.item_id);
    else concerns.add(concern);
  }
  return { concerns: [...concerns].sort(), unknown: unknown.sort() };
}

/**
 * 覆えていない箇所を、原因つきで挙げる。**空配列が「覆えている」の意味である。**
 *
 * 3 種類を 1 本にまとめているのは、どれも「章が掲げた指針が要件に届いていない」
 * という同じ壊れだからである。分けると、片方だけ直して緑になる形ができる。
 */
function uncovered(
  matrix: Record<string, Record<string, Cell>>,
  items: readonly Item[],
  map: Record<string, readonly string[]>,
): string[] {
  const found: string[] = [];
  for (const [category, platforms] of Object.entries(matrix)) {
    for (const [platform, cell] of Object.entries(platforms)) {
      const { concerns, unknown } = requiredConcerns(cell, items);
      for (const id of unknown) {
        found.push(`${category} × ${platform}: required_info の ${id} が catalog に無い`);
      }
      if (concerns.length === 0) continue;
      const anchored = new Set(map[category] ?? []);
      for (const concern of concerns) {
        if (!anchored.has(concern)) {
          found.push(
            `${category} × ${platform}: 確定要件が要求する concern ${concern} が` +
              ` 上流指針に無い (anchor: ${[...anchored].sort().join(", ") || "未帰属"})`,
          );
        }
      }
    }
  }
  return found.sort();
}

describe("上流指針が確定要件を覆っていること", () => {
  it("確定要件の concern はすべて章の上流指針に載っている", () => {
    expect(uncovered(state.matrix, catalog.items, registry.category_concern_map)).toEqual([]);
    // 母数。**required_info を持つセルが 4 つある**ことを同じ検査で言う。
    // 0 になれば上の主張は空集合について正しいだけになり、何も守らなくなる。
    const withRequirements = Object.entries(state.matrix).flatMap(([cat, ps]) =>
      Object.entries(ps)
        .filter(([, cell]) => (cell.required_info ?? []).length > 0)
        .map(([p]) => `${cat} × ${p}`),
    );
    expect(withRequirements.sort()).toEqual([
      "auth × web",
      "backend × web",
      "security × web",
      "ui-ux × web",
    ]);
  });

  it("上流指針に使われる concern はすべて registry に定義がある", () => {
    // 写像の行き先が実在すること。存在しない concern_id を書くと、章の表は
    // `| xxx | - | - | - |` と**空欄で描かれて**、指針が無いことが見えなくなる。
    const defined = new Set(registry.concerns.map((c) => c.concern_id));
    const dangling = Object.entries(registry.category_concern_map).flatMap(([cat, ids]) =>
      ids.filter((id) => !defined.has(id)).map((id) => `${cat} → ${id}`),
    );
    expect(dangling).toEqual([]);
    expect(defined.size).toBe(7);
  });

  it("catalog の対象 domain のうち写像に無いものは、除外理由が正本に在る", () => {
    // `api` は `in_scope_domains` に居るが `category_concern_map` に無い。
    // **それは誤りではなく判断である**——api 章を立てず backend が引き受けている。
    // 判断であるなら根拠が正本に在るはずで、無ければただの漏れである。
    const unmapped = catalog.in_scope_domains.filter(
      (d) => (registry.category_concern_map[d] ?? []).length === 0,
    );
    expect(unmapped).toEqual(["api"]);
    for (const domain of unmapped) {
      const reason = state.excluded_categories?.[domain];
      expect(reason, `${domain} が写像に無いのに除外理由も無い`).toBeTruthy();
      expect(reason!.length).toBeGreaterThan(30);
    }
  });

  it("除外された domain の item も、引き受け先の上流指針が覆っている", () => {
    // 除外は「見なくてよい」ではない。`api-contract` の concern は
    // backend の anchor に載っていなければ、要件だけが宙に浮く。
    const apiConcerns = new Set(
      catalog.items.filter((i) => i.domain === "api").map((i) => i.concern),
    );
    expect([...apiConcerns]).toEqual(["application-architecture"]);
    for (const concern of apiConcerns) {
      expect(registry.category_concern_map["backend"]).toContain(concern);
    }
  });

  describe("覆えていない側を見つけられること", () => {
    const items: readonly Item[] = [
      { item_id: "a", domain: "auth", concern: "authentication" },
      { item_id: "b", domain: "auth", concern: "operations" },
    ];
    const map = { auth: ["authentication"] };

    it("指針に無い concern を要求するセルは、anchor の中身つきで挙がる", () => {
      const got = uncovered({ auth: { web: { required_info: [{ item_id: "b" }] } } }, items, map);
      expect(got).toEqual([
        "auth × web: 確定要件が要求する concern operations が 上流指針に無い (anchor: authentication)",
      ]);
    });

    it("catalog に無い item_id は、覆う覆わない以前の綻びとして挙がる", () => {
      const got = uncovered({ auth: { web: { required_info: [{ item_id: "z" }] } } }, items, map);
      expect(got).toEqual(["auth × web: required_info の z が catalog に無い"]);
    });

    it("写像そのものが無い category は『未帰属』と名指しされる", () => {
      const got = uncovered({ ops: { web: { required_info: [{ item_id: "a" }] } } }, items, map);
      expect(got).toEqual([
        "ops × web: 確定要件が要求する concern authentication が 上流指針に無い (anchor: 未帰属)",
      ]);
    });

    it("覆えている入力では空を返す（陰性対照）", () => {
      const got = uncovered({ auth: { web: { required_info: [{ item_id: "a" }] } } }, items, map);
      expect(got).toEqual([]);
    });
  });
});
