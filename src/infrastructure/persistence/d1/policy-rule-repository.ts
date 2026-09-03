import { eq } from "drizzle-orm";
import type { PolicyRuleRepositoryPort } from "@/application/ports/compliance";
import type { PolicyRule } from "@/domain/compliance";
import { buildSeedPolicyRules } from "@/domain/compliance";
import {
  type PolicyRuleId,
  type WorkspaceId,
  domainError,
  err,
  ok,
  taggedString,
} from "@/domain/shared";
import { type PolicyRuleRow, policyRules } from "@/db/schema";
import type { DrizzleD1 } from "./link-inbox-repository";
import { mergeWithSamples, storageFailure } from "./storage-failure";

/**
 * 表現ポリシーの保存先（D1）。
 *
 * **これはスタブではない。** 見本版（`policy-rule-sample-repository.ts`）と同じ契約を
 * 満たし、追加・書き換え・無効化が実際に残る。
 *
 * --- 表は「初期ルールからの差分」だけを持つ ---
 * 作業場所を作った時点で初期 13 件を流し込む形にはしていない。流し込むと、
 * 初期ルールを直した日に**既に作られた作業場所だけが古い版のまま**残り、
 * どの記事がどの版のきまりで確認されたのかが後から言えなくなる。
 *
 * よってここは毎回 2 つを重ねる:
 *   1. 表に入っている行（無効にしたもの・直したもの・足したもの）
 *   2. `buildSeedPolicyRules()` が返す初期ルールのうち、1 に無いもの
 *
 * 重ねる順は**保存されたほうが先**（`mergeWithSamples` と同じ理由）。
 * 逆にすると、無効にしたはずのきまりが次に開いたときには復活する。
 *
 * --- 表が空でも「きまり 0 件」を返さない ---
 * 見本版の注意書きと同じ理由である。空を返すと記事の確認は毎回
 * 「違反 0 件」で緑になり、**きまりが効いているのか 1 件も無いのかが
 * 画面から区別できない**。ここが返すのは常に「初期ルール＋この作業場所の変更」。
 *
 * --- 消す口を置いていない ---
 * `save` だけで足りる。きまりを外すのは `enabled: false` の保存であって、
 * 行を消すことではない。消せる形にすると、**過去の記事が
 * どのきまりで確認されたか**が辿れなくなる（記録側は `policy_rule.changed` に
 * 前後を残すが、参照先の行が消えていれば読めるのは名前だけになる）。
 */

/** 行 → ドメイン。 */
function toDomain(row: PolicyRuleRow): PolicyRule {
  return {
    id: taggedString<"PolicyRuleId">(row.id) as PolicyRuleId,
    workspaceId: taggedString<"WorkspaceId">(row.workspaceId) as WorkspaceId,
    name: row.name,
    domainScope: row.domainScope,
    channelScope: row.channelScope,
    severity: row.severity,
    pattern: row.pattern,
    ignoreCase: row.ignoreCase,
    basis: row.basis,
    suggestion: row.suggestion,
    enabled: row.enabled,
  };
}

/**
 * この作業場所の**実効のきまり一覧**（無効なものも含む）。
 *
 * 初期ルールの組み立てに失敗したときに**表の行だけを返さない**。
 * 返すと、13 件あるはずのきまりが数件になった状態で確認が通ってしまい、
 * 画面には「違反 0 件」とだけ出る。組み立てに失敗したら失敗として返す。
 */
async function effectiveRules(
  db: DrizzleD1,
  workspaceId: WorkspaceId,
): Promise<{ readonly ok: true; readonly rules: readonly PolicyRule[] } | { readonly ok: false; readonly what: string; readonly cause: unknown }> {
  const seeded = buildSeedPolicyRules(workspaceId);
  if (!seeded.ok) {
    return { ok: false, what: "初期ルールの組み立て", cause: new Error(seeded.error.code) };
  }
  try {
    const rows = await db
      .select()
      .from(policyRules)
      .where(eq(policyRules.workspaceId, String(workspaceId)));
    return { ok: true, rules: mergeWithSamples(rows.map(toDomain), seeded.value) };
  } catch (cause) {
    return { ok: false, what: "表現ポリシーの読み出し", cause };
  }
}

export function createD1PolicyRuleRepository(db: DrizzleD1): PolicyRuleRepositoryPort {
  return {
    async findById(workspaceId, id) {
      const effective = await effectiveRules(db, workspaceId);
      if (!effective.ok) return storageFailure(effective.what, effective.cause);
      return ok(effective.rules.find((r) => String(r.id) === String(id)) ?? null);
    },

    async listEnabled(workspaceId) {
      const effective = await effectiveRules(db, workspaceId);
      if (!effective.ok) return storageFailure(effective.what, effective.cause);
      return ok(effective.rules.filter((r) => r.enabled));
    },

    /**
     * 足す・直す・無効にする。
     *
     * 初期ルールと同じ ID で保存すると、以後はこの行が初期ルールを覆う。
     * **初期ルール側は書き換えない**ので、覆いを外せば元へ戻る。
     */
    async save(rule) {
      try {
        /*
         * **先に持ち主を確かめる。**
         *
         * `onConflictDoUpdate` の `where` で作業場所を突き合わせる書き方もあるが、
         * 条件に外れたときの結果が「何も起きずに成功」になる。
         * 保存できていないのに保存できたと返るのは、いちばん気づけない壊れ方である。
         * 別の作業場所の行だったときは、成功にせず断る。
         */
        const existing = await db
          .select({ workspaceId: policyRules.workspaceId })
          .from(policyRules)
          .where(eq(policyRules.id, String(rule.id)))
          .limit(1);
        const owner = existing[0]?.workspaceId;
        if (owner !== undefined && owner !== String(rule.workspaceId)) {
          return err(
            domainError("CONFLICT", "この ID のきまりは、別の作業場所のものです。", {
              field: "id",
              suggestedAction: "新しいきまりとして登録し直してください。",
            }),
          );
        }

        const values = {
          name: rule.name,
          domainScope: rule.domainScope,
          channelScope: rule.channelScope,
          severity: rule.severity,
          pattern: rule.pattern,
          ignoreCase: rule.ignoreCase,
          basis: rule.basis,
          suggestion: rule.suggestion,
          enabled: rule.enabled,
          updatedAt: new Date(),
        };
        await db
          .insert(policyRules)
          .values({ id: String(rule.id), workspaceId: String(rule.workspaceId), ...values })
          // 作業場所は更新の対象に入れない。行の持ち主は移らない。
          .onConflictDoUpdate({ target: policyRules.id, set: values });
      } catch (cause) {
        return storageFailure("表現ポリシーの保存", cause);
      }
      return ok(rule);
    },
  };
}
