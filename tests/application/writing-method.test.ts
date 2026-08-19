/** @tier 1 */
import { describe, expect, it } from "vitest";
import { createReadWritingMethodUseCase } from "@/application/usecases/authoring/read-writing-method";
import { CONVERSATION_MAX_LENGTH, CONVERSATION_MIN_LENGTH } from "@/domain/authoring/conversation-block";
import { createToolCatalog } from "@/presentation/composition";
import type { ActorContext } from "@/domain/shared";
import { taggedString } from "@/domain/shared";

/**
 * 書き方の決めごとが、画面・AI・公開前の検査で同じものになっていることを見る。
 *
 * 手引きを別に書くと必ずどちらかが古くなる。
 * ここでは「画面に出るもの」が domain の定義から来ていることを固定する。
 */

const actor: ActorContext = {
  userId: taggedString("user_test"),
  workspaceId: taggedString("ws_test"),
  roles: ["writer"],
  isAiServiceAccount: false,
};

const uc = createReadWritingMethodUseCase();

async function read(type?: string) {
  const result = await uc.execute(actor, { articleType: type });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

describe("記事の型ごとの節", () => {
  it("5 つの型から選べる", async () => {
    const m = await read();
    expect(m.types.map((t) => t.key)).toEqual(["ranking", "review", "comparison", "guide", "tool"]);
  });

  it("知らない型を渡されたら、順位の記事として出す（空白の画面にしない）", async () => {
    const m = await read("unknown-type");
    expect(m.articleType).toBe("ranking");
  });

  it("どの型でも、広告表示は本文より先に来る", async () => {
    for (const type of ["ranking", "review", "comparison", "guide", "tool"]) {
      const m = await read(type);
      const ids = m.sections.map((s) => s.id);
      expect(ids.indexOf("disclosure"), type).toBeLessThan(ids.indexOf("body"));
      // 見出しより先であること（広告と気づく前に読ませない）
      expect(ids.indexOf("disclosure"), type).toBeLessThan(ids.indexOf("h1"));
    }
  });

  it("順位の記事には、評価基準・順位・選外がそろっている", async () => {
    const ids = (await read("ranking")).sections.map((s) => s.id);
    expect(ids).toContain("methodology");
    expect(ids).toContain("ranking_list");
    expect(ids).toContain("excluded_products");
  });

  it("やり方の記事には、必要時間・手順・つまずいたときの戻り道がある", async () => {
    const ids = (await read("guide")).sections.map((s) => s.id);
    expect(ids).toContain("required_time");
    expect(ids).toContain("steps");
    expect(ids).toContain("troubleshooting");
  });

  it("どの節にも「なぜ置くか」が書いてある", async () => {
    for (const s of (await read()).sections) {
      expect(s.purpose.length, `${s.id} の理由が空です`).toBeGreaterThan(5);
    }
  });

  it("欠かせない節の数を数えて出す", async () => {
    const m = await read();
    expect(m.requiredCount).toBe(m.sections.filter((s) => s.required).length);
    expect(m.requiredCount).toBeGreaterThan(0);
  });
});

describe("書き方", () => {
  it("段落は結論から始めて、次の行動で終える", async () => {
    const order = (await read()).paragraphOrder.map((p) => p.step);
    expect(order[0]).toBe("結論");
    expect(order[order.length - 1]).toBe("次の行動");
  });

  it("文体の決まりには、必ず理由が付いている", async () => {
    for (const r of (await read()).styleRules) {
      expect(r.why.length, `${r.id} の理由が空です`).toBeGreaterThan(3);
    }
  });

  it("事実は 6 種類に分けて、種類ごとに語尾を決めている", async () => {
    const rules = (await read()).factRules;
    expect(rules).toHaveLength(6);
    for (const r of rules) {
      expect(r.allowed.length, `${r.kind} に使える語尾がありません`).toBeGreaterThan(0);
      expect(r.forbidden.length, `${r.kind} に避ける語尾がありません`).toBeGreaterThan(0);
    }
  });

  it("測った値と公表値で、使ってよい語尾が違う", async () => {
    const rules = (await read()).factRules;
    const measured = rules.find((r) => r.kind === "measured");
    const official = rules.find((r) => r.kind === "official");
    expect(measured?.allowed).not.toEqual(official?.allowed);
  });

  it("読者の知識量ごとに、説明の深さを決めている", async () => {
    const guide = (await read()).knowledgeGuide;
    expect(guide.map((g) => g.level)).toEqual(["beginner", "intermediate", "expert"]);
  });

  it("会話は長さと連続回数に上限がある", async () => {
    const c = (await read()).conversation;
    // **ここに 40 / 120 と書き写してはいけない。**この検査の目的は
    // 「画面に出る数が domain の定義から来ていること」で、書き写すと
    // 定義が動いても気づかないまま緑が出る（＝目的そのものが消える）。
    expect(c.minLength).toBe(CONVERSATION_MIN_LENGTH);
    expect(c.maxLength).toBe(CONVERSATION_MAX_LENGTH);
    expect(c.maxConsecutive).toBe(2);
    expect(c.basePattern[0]).toBe("本文");
    expect(c.rule).toContain("本文にも書きます");
  });
});

describe("道具として使えること", () => {
  it("read_writing_method が登録されていて、読み取りだけ", async () => {
    const tool = (await createToolCatalog()).find((t) => t.name === "read_writing_method");
    expect(tool).toBeDefined();
    expect(tool?.readOnly).toBe(true);
  });
});
