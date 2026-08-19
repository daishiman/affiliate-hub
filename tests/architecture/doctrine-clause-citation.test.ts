import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * @tier 1
 * @req REQ-TS13
 * @types equivalence, boundary
 *
 * `equivalence` を名乗る根拠: concern を available / unavailable の 2 クラスへ分け、
 * **両方が空でないこと**を見ている (片方だけを見ると、全部が片側へ落ちたときに
 * 気づけない。全部 unavailable にすれば「引用不可の規律」は自明に緑になる)。
 * `boundary` の根拠: unavailable の理由が 3 種ちょうどであること、および
 * 取得本文の欄が 0 件であることという境目そのものを見ていること。
 *
 * C05 gap 3 の当てどころ。
 *
 * authority を上流指針として掲げることと、その authority の「条項」を要件文の
 * 根拠として引けることは別である。前者は registry の帰属だけで成立するが、
 * 後者は条項が取得物の中に実在することを要する。
 *
 * この検査が守るのは主に 1 点:
 *   引けない理由の 3 種 (取れば可 / 経路を変えれば可 / 永久に不可) を
 *   「条項引用不可」の一語へ潰させないこと。
 * 潰すと、塞げる穴と塞げない穴が同じ顔になり、次に読む人は
 * 書籍を取りにいくか、取れる workbook を諦めるかのどちらかを必ず間違える。
 */

const ROOT = join(import.meta.dirname, "../..");
const REGISTRY = join(
  ROOT,
  ".claude/plugins/system-spec-harness/skills/ref-system-design-knowledge/references/doctrine-anchor-registry.json",
);

type ClauseCitation = {
  state?: string;
  reason_class?: string;
  reason?: string;
  reversal?: string | null;
  reversal_note?: string;
  citation_scope?: string;
  evidence_target_id?: string;
  cited_clauses?: { chapter?: number; title?: string; url?: string }[];
};

type Concern = {
  concern_id: string;
  authority: string;
  source_ref: string;
  clause_citation?: ClauseCitation;
};

const registry = JSON.parse(readFileSync(REGISTRY, "utf8")) as {
  concerns: Concern[];
  category_concern_map: Record<string, string[]>;
  clause_citation_policy?: { reason_class?: Record<string, string> };
};

/** 塞げる 2 種。取得すれば引用可になる。 */
const FIXABLE = ["not-in-fetch-targets", "fetched-but-no-body"];
/** 塞げない 1 種。この作業場所に取得経路が無い。 */
const UNFIXABLE = "no-retrieval-path";

describe("doctrine anchor の条項引用可否", () => {
  it("すべての concern が clause_citation を持つ（未判定のまま引用させない）", () => {
    const missing = registry.concerns
      .filter((c) => !c.clause_citation?.state)
      .map((c) => c.concern_id);
    expect(missing, "clause_citation が無い concern").toEqual([]);
  });

  it("state は available か unavailable のどちらかしかない", () => {
    for (const c of registry.concerns) {
      expect(["available", "unavailable"], `${c.concern_id} の state`).toContain(
        c.clause_citation?.state,
      );
    }
  });

  describe("引用可 (available) の側", () => {
    const available = registry.concerns.filter(
      (c) => c.clause_citation?.state === "available",
    );

    it("引用可の concern が実際に存在する（全部 unavailable に倒して緑にできない）", () => {
      expect(available.length).toBeGreaterThan(0);
    });

    it("引ける条項を 1 件以上挙げ、章番号・章題・URL をすべて持つ", () => {
      for (const c of available) {
        const clauses = c.clause_citation?.cited_clauses ?? [];
        expect(clauses.length, `${c.concern_id} の cited_clauses`).toBeGreaterThan(0);
        for (const q of clauses) {
          expect(typeof q.chapter, `${c.concern_id} の章番号`).toBe("number");
          expect(q.title, `${c.concern_id} の章題`).toBeTruthy();
          expect(q.url, `${c.concern_id} の URL`).toMatch(/^https:\/\//);
        }
      }
    });

    /**
     * 目次しか取得していないのに章の主張を要約すると、取得していない内容を
     * 出典に帰属させることになる。C05 が実在しない日付 2026-07-03 を
     * 「公式表明値」として書いたのと同じ形。範囲の宣言を必須にして、
     * 「どこまでを根拠にできるか」を書かせる。
     */
    it("引用範囲 (citation_scope) を宣言している", () => {
      for (const c of available) {
        expect(c.clause_citation?.citation_scope, `${c.concern_id} の citation_scope`)
          .toBeTruthy();
      }
    });

    it("引用の裏づけになる取得 record を名指ししており、それが実在する", () => {
      const refs = JSON.parse(
        readFileSync(join(ROOT, "system-spec/fetched-references.json"), "utf8"),
      ) as { references: { target_id: string }[] };
      const known = new Set(refs.references.map((r) => r.target_id));
      for (const c of available) {
        const target = c.clause_citation?.evidence_target_id;
        expect(target, `${c.concern_id} の evidence_target_id`).toBeTruthy();
        expect(known, `${c.concern_id} が名指しした取得 record`).toContain(target);
      }
    });
  });

  describe("引用不可 (unavailable) の側", () => {
    const unavailable = registry.concerns.filter(
      (c) => c.clause_citation?.state === "unavailable",
    );

    it("理由の種類 (reason_class) を必ず持ち、既知の 3 種のいずれかである", () => {
      for (const c of unavailable) {
        expect([...FIXABLE, UNFIXABLE], `${c.concern_id} の reason_class`).toContain(
          c.clause_citation?.reason_class,
        );
      }
    });

    it("理由の本文 (reason) を持つ（種類だけで済ませない）", () => {
      for (const c of unavailable) {
        expect(c.clause_citation?.reason, `${c.concern_id} の reason`).toBeTruthy();
      }
    });

    /** 記憶則⑤: 反転先を先に書く。 */
    it("塞げる 2 種は「引用可になる条件」を先に書いている", () => {
      for (const c of unavailable) {
        if (!FIXABLE.includes(c.clause_citation?.reason_class ?? "")) continue;
        expect(
          c.clause_citation?.reversal,
          `${c.concern_id} (${c.clause_citation?.reason_class}) の reversal`,
        ).toBeTruthy();
      }
    });

    /**
     * 塞げない 1 種に反転先を書かせない。書けてしまうと、
     * 「いつか取れる」という誤った期待が残り、3 種の区別が崩れる。
     */
    it("塞げない 1 種は reversal が null で、代わりに反転先が無い理由を書いている", () => {
      for (const c of unavailable) {
        if (c.clause_citation?.reason_class !== UNFIXABLE) continue;
        expect(c.clause_citation?.reversal, `${c.concern_id} の reversal`).toBeNull();
        expect(
          c.clause_citation?.reversal_note,
          `${c.concern_id} の reversal_note`,
        ).toBeTruthy();
      }
    });

    /**
     * 3 種を 1 種へ潰す変更をここで捕まえる。
     * 現状は 3 種すべてが実在しており、どれか 1 種でも消えたら赤くなる。
     */
    it("3 種の理由がすべて実在している（一語へ潰されていない）", () => {
      const present = new Set(
        unavailable.map((c) => c.clause_citation?.reason_class),
      );
      expect([...present].sort(), "実在する reason_class").toEqual(
        [...FIXABLE, UNFIXABLE].sort(),
      );
    });
  });

  it("registry の policy が 3 種の定義を持っている（章側の文言はここから来る）", () => {
    const defined = Object.keys(registry.clause_citation_policy?.reason_class ?? {});
    expect(defined.sort()).toEqual([...FIXABLE, UNFIXABLE].sort());
  });

  /**
   * 塞げていない穴を検査として残す（直っていないことの記録であって、
   * 正しさの記録ではない）。
   *
   * 引用可と申告した条項が **取得物の中に実在するか** を、この検査は確かめられない。
   * 私は今回それを手元の取得物 (google-sre.html) で確かめたが、CI は確かめられない。
   *
   * 塞げない理由 (難しいからではない): 取得した HTML 本文がリポジトリに保存されて
   * おらず、system-spec/retrieval-evidence/*.json は content_sha256 と content_bytes
   * しか持たない。照合対象の本文が repo 内に無いため、存在検査を書く相手がいない。
   * 本文を repo へ入れるのは別の判断 (容量・ライセンス・秘密混入) を要するので、
   * ここで勝手に決めない。
   *
   * **反転条件**: 取得本文が repo 内に保存されるようになった日 (例
   * retrieval-evidence/*.body.html)、この検査を反転させて
   * 「cited_clauses の各 URL と章題が取得本文の中に実在すること」へ変える。
   * **消さない。** 消すと、実在しない章番号を書いても誰も気づかない状態へ戻る。
   */
  it("引用した条項が取得物に実在するかは、この検査では確かめられない", () => {
    const evidence = JSON.parse(
      readFileSync(join(ROOT, "system-spec/retrieval-evidence/google-sre.json"), "utf8"),
    ) as Record<string, unknown>;

    // 母集団の床。証跡が空になれば bodyKeys は自明に [] になり、
    // 「本文が無い」と「証跡そのものが消えた」を見分けられなくなる。
    expect(
      Object.keys(evidence).length,
      "証跡の欄が消えていない（0 が母集団消失で出ていないこと）",
    ).toBeGreaterThanOrEqual(7);

    expect(
      "content_sha256" in evidence,
      "証跡は hash を持つ（本文の同一性は言える）",
    ).toBe(true);

    // 本文そのものは repo に無い。だから存在検査が書けない。
    const bodyKeys = Object.keys(evidence).filter((k) => /body|html|content_text/.test(k));
    expect(
      bodyKeys,
      "取得本文が repo に入った日に、この検査を存在検査へ反転させる",
    ).toEqual([]);
  });
});
