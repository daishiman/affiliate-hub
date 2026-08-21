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
 *
 * ── 解除条件（`ah-ejn` は保留。この検査が解除の合図を持っている）──────
 *
 * 何が手に入れば直せるか: **4 authority の節見出しを、取得証跡つきで持つこと。**
 * 必要なのは「節名を持つ証跡」であって、条項名そのものではない。
 * 名前だけなら確かめずに書けてしまい、それがこの課題の欠陥そのものだからである。
 *
 * **この検査が赤くなった日が、解除してよい日である。**赤くなる道は 2 つある。
 *
 *   - 「authority を引いている文は 0 文」が赤 → **要件文へ引かれた**
 *   - 「取得証跡は節名を持っていない」が赤 → **証跡が節名を持ち始めた**
 *
 * どちらでも、この課題を開き直し、**この検査ごと「引用がある」側へ書き直す**。
 * 消すのではなく、向きを反転させて残すこと
 * (「0 文であること」→「各章が最低 1 件引いていること」)。
 * 消すと、引用が後から抜けても誰も気づかない状態へ戻る。
 *
 * 単独では完了しない。`ah-v8y`（`docs/spec` 04〜12 の 9 枚が書面入力に
 * 取り込まれていない）に依存している。
 *
 * 取得は行わない。私が打たないだけでなく、**他のセッションに読んで渡してもらう
 * 形も取らない**。手段が変わっても到達点が同じなら迂回にあたる
 * （境目は道具ではなく目的。残課題 78 ⑲）。
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
   *
   * `freshness_extraction` は 2026-08-20 に足した欄で、**節名ではない**。
   * 「その record の更新日表明をどこからどう取ったか」だけを持ち、
   * 章・節・見出しの類は一切入らない。よってこの検査の趣旨
   * (証跡から条項は引けない = doctrine の引用根拠に使えない) は保たれている。
   * 欄が増えたこと自体はここで固定し、増えた欄が節名を持ち込んだら
   * 下の EVIDENCE_KEYS 検査が赤くなる。
   */
  const EVIDENCE_BASE_KEYS = [
    "content_bytes",
    "content_sha256",
    "http_status",
    "page_title",
    "retrieved_at",
    "source_url",
    "target_id",
  ];

  it("取得証跡は節名を持っていない（hash と page_title と鮮度の由来だけ）", () => {
    for (const id of ["owasp-asvs", "apple-hig", "google-sre"]) {
      const evidence = JSON.parse(
        readFileSync(join(ROOT, `system-spec/retrieval-evidence/${id}.json`), "utf8"),
      ) as Record<string, unknown>;
      const extra = Object.keys(evidence).filter((k) => !EVIDENCE_BASE_KEYS.includes(k));
      expect(extra.sort(), `${id}.json の想定外の欄`).toEqual(
        id === "owasp-asvs" ? [] : ["freshness_extraction"],
      );
    }
  });

  /**
   * `freshness_extraction` を「とりあえず全件に足す」で緑にできないようにする。
   *
   * 由来を知らない record に由来を書けば捏造になる。だから証跡側の
   * `freshness_extraction` の有無は、`fetched-references.json` 側の
   * `freshness_source` の申告の有無と **一致していなければならない**。
   * 片側だけ足した瞬間にここが赤くなる。
   */
  it("鮮度の由来は、申告のある record にだけ証跡がある", () => {
    const refs = JSON.parse(
      readFileSync(join(ROOT, "system-spec/fetched-references.json"), "utf8"),
    ) as { references: { target_id: string; freshness_source?: string }[] };

    // 母集団の床。record が消えれば mismatched は自明に [] になり、
    // 「食い違いが無い」と「数える対象が消えた」を見分けられなくなる。
    expect(
      refs.references.length,
      "取得 record が消えていない（0 が母集団消失で出ていないこと）",
    ).toBeGreaterThanOrEqual(8);
    expect(
      refs.references.filter((r) => r.freshness_source).length,
      "申告を持つ record が消えていない（全件が申告なしになれば検査は空回りする）",
    ).toBeGreaterThanOrEqual(5);

    const mismatched: string[] = [];
    for (const ref of refs.references) {
      const evidence = JSON.parse(
        readFileSync(
          join(ROOT, `system-spec/retrieval-evidence/${ref.target_id}.json`),
          "utf8",
        ),
      ) as Record<string, unknown>;
      const declared = Boolean(ref.freshness_source);
      const evidenced = "freshness_extraction" in evidence;
      if (declared !== evidenced) {
        mismatched.push(`${ref.target_id}: 申告=${declared} 証跡=${evidenced}`);
      }
    }
    expect(mismatched, "申告と証跡の食い違い").toEqual([]);
  });
});
