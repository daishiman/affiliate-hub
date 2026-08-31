/** @tier 1 */
/** @req REQ-TS15 */
/** @types equivalence */
/**
 * 章の `## 確定セルの記録` が、正本 `spec-state.json` の当該セルと一致していること。
 *
 * ── この節には生成器が無い ──────────────────────────────────
 *
 * `system-spec/*.md` の大半は正本の純関数だが、**この節だけは違う。**
 * repo 全体を探しても「確定セルの記録」や「接地: 済」という文字列を書く側の
 * コードは 1 行も無い（2026-08-30 実測。当たるのは検査 2 本だけである）。
 * 由来は `chapter-regeneration-floor.test.ts` の注記に残っている——
 * gap 1 の着地として **「再生成ではなく手編集で」** 8 章へ入れた節である。
 *
 * **だからこの節は腐る。**正本の `qa_ref` が新しい質疑で置き換われば、
 * 生成される他の節は次の compile で追従するのに、**この節だけ古い値のまま残る。**
 * 追従させる機械が存在しないのだから、ずれるのは事故ではなく既定の挙動である。
 *
 * 節の冒頭は自分で「本節は正本の**転記**である。値が食い違ったら正本を正とする」と
 * 断っている。**その断り書きには何の強制力も無い。**読む人は一致を前提に読むが、
 * 書いてある値は外れていてもそれらしく見える（実在する qa id で、実在するゴール記号）。
 * この検査は、その断り書きに初めて門を付けるものである。
 *
 * ── 実測 2026-08-30: 8 章のうち 5 章がずれていた ─────────────────
 *
 * 検査を書いた時点で、次のずれが在った。**手で直してある**（この節に生成器は無いので、
 * 直し方も手編集である。compile を待っても直らない）。
 *
 * | 章 | 欄 | 直す前（章） | 正本 |
 * |---|---|---|---|
 * | database | qa_ref | `qa-database-web-spec-intake` | `qa-database-web-blog-builder` |
 * | frontend | qa_ref | `qa-frontend-web-spec-intake` | `qa-frontend-web-seo-ai-search-v2` |
 * | infrastructure | qa_ref | `qa-infra-web-spec-intake` | `qa-infra-web-post-deploy-smoke` |
 * | maintenance-ops | qa_ref | `qa-ops-web-spec-intake` | `qa-ops-web-rollback` |
 * | ui-ux | qa_ref | `qa-uiux-web-screen-priority` | `qa-uiux-web-seo-ai-search-v2` |
 * | infrastructure | serves_goals | `G2, G1` | `["G1","G2"]`（並びだけ） |
 * | maintenance-ops | serves_goals | `G1, G2` | `["G1"]`（章に G2 が余分） |
 * | ui-ux | serves_goals | `G1` | `["G1","G2"]`（章に G2 が足りない） |
 * | ui-ux | required-info | `— block / 接地:` | 他 7 章は `— missing_effect: block / 接地:` |
 *
 * **ずれの向きが全部同じ**であることに意味がある——どれも章が古い。
 * 転記が独自に動いたのではなく、**正本だけが動いて転記が置き去りにされた。**
 * `maintenance-ops` の `G2` は、かつて正本に在って後から外れたものである。
 * つまり章は「今は間違いだが、当時は正しかった」値を持ち続けていた。
 *
 * ── 並びを見る欄と、見ない欄 ────────────────────────────────
 *
 * `serves_goals` は**並びまで**見る。正本の `backend` は `["G2","G1"]` で、
 * 章も `G2, G1` と書いてある。転記は並べ替えずに写す作法だと実物が示している。
 *
 * `required_info` は**並びを見ない**（`item_id` で対応させる）。`ui-ux` の章は
 * `product-goal / target-platforms / screen-information-priority` の順で、
 * 正本は `product-goal / screen-information-priority / target-platforms` である。
 * ここを並びで見ると、**中身が正しい章を「ずれた」と報せる**ことになる。
 * ずれていないものを赤くする検査は、本当にずれた日に信じてもらえない。
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SPEC_DIR = join(ROOT, "system-spec");

/** この節を持つ章。**8 章ちょうどであることを下の検査 1 件で固定する。** */
const CHAPTERS = [
  "auth",
  "backend",
  "database",
  "frontend",
  "infrastructure",
  "maintenance-ops",
  "security",
  "ui-ux",
] as const;

const HEADING = "## 確定セルの記録 (正本 spec-state.json)";

type RequiredInfo = {
  readonly item_id: string;
  readonly missing_effect: string;
  readonly status: string;
  readonly grounded_by?: string;
};

type Cell = {
  readonly state?: string;
  readonly qa_ref?: string;
  readonly serves_goals?: readonly string[];
  readonly required_info?: readonly RequiredInfo[];
};

type State = {
  readonly matrix: Record<string, Record<string, Cell>>;
};

const state = JSON.parse(readFileSync(join(SPEC_DIR, "spec-state.json"), "utf8")) as State;

/** 章の当該節だけを切り出す。次の `## ` の手前まで。 */
function section(chapter: string): string {
  const text = readFileSync(join(SPEC_DIR, `${chapter}.md`), "utf8");
  const start = text.indexOf(`\n${HEADING}\n`);
  if (start < 0) return "";
  const rest = text.slice(start + 1 + HEADING.length);
  const end = rest.indexOf("\n## ");
  return end < 0 ? rest : rest.slice(0, end);
}

/** `| 項目 | 値 |` の表から、項目名で値を引く。 */
function field(body: string, label: string): string | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const row = new RegExp(`^\\| ${escaped} \\| (.*?) \\|$`, "m").exec(body);
  return row === null ? null : row[1].trim();
}

/**
 * 該当が 0 件のときに章が書く 1 行。**空欄や `—` ではない。**
 *
 * この文言まで固定するのは、「block 指定が無い」と「登録を見ていない」が
 * 読む人にとって別物だからである。空欄はどちらとも読める。
 */
const NO_REQUIRED_INFO = "なし (この確定に block 指定の必須情報は登録されていない)";

/** 章の required-info 行を、`item_id` で引ける形へ戻す。 */
function transcribedRequiredInfo(body: string): Map<string, string> {
  const raw = field(body, "required-info");
  const found = new Map<string, string>();
  if (raw === null || raw === NO_REQUIRED_INFO) return found;
  for (const entry of raw.split("<br>")) {
    const m = /^`([^`]+)`\s*—\s*(.+)$/.exec(entry.trim());
    if (m !== null) found.set(m[1], m[2].trim());
  }
  return found;
}

/** 正本の 1 件を、章に出るはずの表記へ写す。**章から読んだ文字列と同じ土俵に乗せる。** */
function expectedRequiredInfo(info: RequiredInfo): string {
  const grounded =
    info.status === "grounded"
      ? `接地: 済 (\`${info.grounded_by}\`)`
      : `接地: ${info.status === "missing" ? "未" : info.status}`;
  return `missing_effect: ${info.missing_effect} / ${grounded}`;
}

describe("章の確定セルの記録が正本と一致すること", () => {
  it("この節を持つ章が 8 章ちょうどである", () => {
    // 章が 1 つ増えたときに、この検査だけ取り残される形を止める。
    // **母数が空でも 0 件で通る**形（残課題 78 ㉗）への当てでもある。
    const withSection = CHAPTERS.filter((c) => section(c) !== "");
    expect(withSection).toEqual([...CHAPTERS]);
    expect(CHAPTERS.length).toBe(8);
  });

  describe.each(CHAPTERS)("%s.md", (chapter) => {
    const body = section(chapter);
    const declared = field(body, "セル") ?? "";
    const [category, platform] = declared.split(" × ");
    const cell = state.matrix[category]?.[platform];

    it("名乗ったセルが正本に実在し、確定している", () => {
      // ここが先。**存在しないセルを名乗った章は、以降の比較が全部
      // 「undefined と一致しない」で落ちて、本当の原因が読めなくなる。**
      expect(cell, `${chapter}.md が名乗るセル ${declared} が正本に無い`).toBeDefined();
      expect(cell?.state).toBe("確定");
      expect(field(body, "状態")).toBe("確定");
    });

    it("確定質疑 (qa_ref) が正本と同じ", () => {
      expect(field(body, "確定質疑 (qa_ref)")).toBe(`\`${cell?.qa_ref}\``);
    });

    it("資するゴール (serves_goals) が正本と同じ（並びを含む）", () => {
      expect(field(body, "資するゴール (serves_goals)")).toBe(
        [...(cell?.serves_goals ?? [])].join(", "),
      );
    });

    it("required-info が正本と同じ（項目ごとに対応させる。並びは見ない）", () => {
      const transcribed = transcribedRequiredInfo(body);
      const canonical = new Map(
        (cell?.required_info ?? []).map((info) => [info.item_id, expectedRequiredInfo(info)]),
      );
      // 項目の集合と、項目ごとの中身を別々に見る。集合だけだと中身の書き換えが通り、
      // 中身だけだと項目が 1 つ消えたことが「比べる先が無い」で黙って通る。
      expect([...transcribed.keys()].sort()).toEqual([...canonical.keys()].sort());
      if (canonical.size === 0) {
        // **0 件を 0 件と書いてあること。**空欄や `—` だと「無い」と「見ていない」が
        // 同じ見た目になる。上の集合比較は空欄でも通ってしまうので、ここで文言を見る。
        expect(field(body, "required-info")).toBe(NO_REQUIRED_INFO);
      }
      for (const [itemId, expected] of canonical) {
        expect(transcribed.get(itemId), `${chapter}.md の required-info ${itemId}`).toBe(expected);
      }
    });
  });
});
