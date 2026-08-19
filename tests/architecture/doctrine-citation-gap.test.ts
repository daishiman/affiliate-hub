/**
 * @tier 1
 * @req REQ-TS13
 * @types equivalence, boundary
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 確定章の要件文に、上流指針 (doctrine anchor) の条項が 1 件も引かれていない。
 *
 * **これは塞ぐ課題ではなく、塞げていないことを検査として固定する課題である。**
 * `docs/spec/08-仕様の未修正点.md` ② に「未解消」と書いてあるが、
 * 本文の「未解消」は解消した日にも古く見えないまま残る。
 * ここに置けば、**引かれた日に赤くなる**。赤くなったら、この検査を消して
 * 「引用がある」側の検査へ書き直す合図である。
 *
 * いま何が起きているか (2026-08-19 実測、語ではなく文で数えた):
 *   確定 8 章の To-Be / 規範契約の要件文 40 文のうち、
 *   authority の名前を含む文は **0 文**。
 *   doctrine anchor の表と、そのすぐ下の定型 1 文
 *   (「本章の確定内容 (質疑録) は上記 authority を上流指針として適用する」)
 *   だけがあり、要件文の側は authority を一度も参照していない。
 *
 * なぜ塞げないか——**難しいからではなく、この作業場所の約束と両立しないからである**:
 *
 *   1. 条項を引くには authority の内部位置 (節番号・章名) が要る。
 *      それを取りに行くコマンドは権限で断られた。**迂回していない。**
 *      取得済みの `system-spec/retrieval-evidence/*.json` は
 *      `content_sha256` と `page_title` しか持たず、節名を 1 つも持っていない。
 *
 *   2. ローカルの出典カード
 *      (`.claude/plugins/system-spec-harness/skills/ref-system-design-knowledge/`)
 *      には「中核概念」として条項らしき名前が並んでいる。しかしこれは使えない。
 *      `system-spec/security.md` が自ら
 *      「本章内の `ref-system-design-knowledge/...` 参照は
 *        **非規範・取得証跡なし・実装根拠に使用不可**」と規定しているためである。
 *      カードから借りるのは、この課題が直そうとしている欠陥
 *      (**名前を借りているだけで、条項は当たっていない**) の再生産にあたる。
 *
 *   3. `docs/spec/` 側の書面入力にも条項番号は無い (grep で 0 件)。
 *      解除条件の文が「ASVS の該当章」と書いているだけで、章名を持っていない。
 *
 * 確かめずに条項名を書けば、この検査は緑になり、C05 も通るかもしれない。
 * **それは指標が目的化した状態そのもの**なので書いていない。
 */

const ROOT = process.cwd();

/** 確定章。`index.md` と `00-` の要求定義は要件文を持たないので数えない。 */
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

/**
 * doctrine anchor に挙がっている 4 つの authority を、名前で見つける。
 *
 * **わざと緩く書いてある。**節番号まで求めると「名前すら出ていない」現状と
 * 「名前は出たが節が無い」状態を区別できず、前進しても赤くならない。
 * ここで見たいのは「要件文が authority を一度でも参照したか」である。
 */
const AUTHORITY_PATTERNS = [
  /ASVS/i,
  /Human Interface Guidelines|Apple HIG/i,
  /Clean Architecture/i,
  /\bSRE\b|Site Reliability/i,
];

/** 表の本文行のうち、先頭列が ID になっているもの＝要件文。見出し行と罫線は除く。 */
function requirementSentences(markdown: string): string[] {
  const section = markdown.split(/^#{2,3} /m).find((s) => s.startsWith("To-Be"));
  if (section === undefined) return [];
  return section
    .split("\n")
    .filter(
      (line) =>
        /^\|\s*[A-Z][A-Z-]*-?[A-Z]*-?\d*\s*\|/.test(line) &&
        !/^\|\s*-+/.test(line) &&
        !/^\|\s*(ID|要件ID)\s*\|/.test(line),
    );
}

function citesAuthority(sentence: string): boolean {
  return AUTHORITY_PATTERNS.some((pattern) => pattern.test(sentence));
}

describe("上流指針の条項が要件文へ引かれていない (塞げていないことの固定)", () => {
  const perChapter = CHAPTERS.map((name) => {
    const text = readFileSync(join(ROOT, `system-spec/${name}.md`), "utf8");
    const sentences = requirementSentences(text);
    return { name, sentences, cited: sentences.filter(citesAuthority) };
  });

  it("確定 8 章すべてが To-Be の要件文を持っている（数える対象が消えていない）", () => {
    for (const { name, sentences } of perChapter) {
      expect(sentences.length, `${name}.md の要件文`).toBeGreaterThan(0);
    }
  });

  it("要件文は合計 40 文ある（数える対象が減ったら気づく）", () => {
    const total = perChapter.reduce((sum, c) => sum + c.sentences.length, 0);
    expect(total).toBe(40);
  });

  it("そのうち authority を引いている文は 0 文——引かれた日にこの検査が赤くなる", () => {
    const cited = perChapter.flatMap((c) => c.cited.map((s) => `${c.name}: ${s}`));
    expect(cited).toEqual([]);
  });

  it("doctrine anchor の表と定型 1 文だけは 8 章すべてに在る（名前は読める）", () => {
    for (const name of CHAPTERS) {
      const text = readFileSync(join(ROOT, `system-spec/${name}.md`), "utf8");
      expect(text, `${name}.md`).toContain("## 上流指針 (doctrine anchor)");
      expect(text, `${name}.md`).toContain(
        "上記 authority を上流指針として適用する",
      );
    }
  });

  /**
   * 見つける側が本当に効くことを、同じ検査の中で示す。
   * これが無いと、上の「0 文」は
   * **引用が無いから 0 なのか、見つけられないから 0 なのか**が区別できない。
   */
  describe("見つける側が効いていること（止まる例）", () => {
    it.each([
      ["ASVS", "| SEC-REQ-001 | ... OWASP ASVS V2.1 に従い ... |"],
      ["Apple HIG", "| UI-REQ-001 | ... Apple Human Interface Guidelines の ... |"],
      ["Clean Architecture", "| BE-ANA-01 | ... Clean Architecture の Dependency Rule ... |"],
      ["Google SRE", "| OPS-REQ-001 | ... Site Reliability Engineering 第 4 章 ... |"],
    ])("%s を引いた文は引用として数えられる", (_label, sentence) => {
      expect(citesAuthority(sentence)).toBe(true);
    });

    it("authority を引いていない実在の要件文は数えられない", () => {
      const security = readFileSync(join(ROOT, "system-spec/security.md"), "utf8");
      const first = requirementSentences(security)[0];
      expect(first).toContain("SEC-REQ-001");
      expect(citesAuthority(first)).toBe(false);
    });
  });

  /**
   * 塞げない理由 2 の当てどころ。カードを引用根拠にできないという規定が
   * 消えたら、この検査が赤くなって「カードから引ける」と知らせる。
   */
  it("出典カードを実装根拠に使えないという規定が security.md に残っている", () => {
    const security = readFileSync(join(ROOT, "system-spec/security.md"), "utf8");
    expect(security).toContain("非規範・取得証跡なし・実装根拠に使用不可");
  });

  /**
   * 塞げない理由 1 の当てどころ。証跡が節名を持ち始めたら赤くなる。
   */
  it("取得証跡は節名を持っていない（hash と page_title だけ）", () => {
    for (const id of ["owasp-asvs", "apple-hig", "google-sre"]) {
      const evidence = JSON.parse(
        readFileSync(join(ROOT, `system-spec/retrieval-evidence/${id}.json`), "utf8"),
      ) as Record<string, unknown>;
      expect(Object.keys(evidence).sort(), `${id}.json の欄`).toEqual([
        "content_bytes",
        "content_sha256",
        "http_status",
        "page_title",
        "retrieved_at",
        "source_url",
        "target_id",
      ]);
    }
  });
});
