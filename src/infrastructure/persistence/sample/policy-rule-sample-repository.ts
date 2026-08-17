import type { PolicyRuleRepositoryPort } from "@/application/ports/compliance";
import type { PolicyRule } from "@/domain/compliance";
import { buildSeedPolicyRules } from "@/domain/compliance";
import type { WorkspaceId } from "@/domain/shared";
import { ok } from "@/domain/shared";
import { registerStub, stubCall } from "../../stub-registry";

/**
 * ★ これは仮置きの見本データです（スタブ）。★
 *
 * 表現ポリシーの保存先。読み取りだけ**本物と同じ結果を返す**。
 *
 * 中身は `buildSeedPolicyRules()`（新しい作業場所に配る初期ルール）をそのまま使う。
 * 空配列を返す実装にしない。空を返すと記事の確認は毎回「違反 0 件」で緑になり、
 * **ポリシーが効いているのか、そもそも 1 件も無いのかが画面から区別できない**。
 * ここが返すのは「まだ誰も編集していない、配ったままの初期ルール」である。
 *
 * 追加・無効化はできない（保存先が無い）。できたふりをすると、
 * 無効にしたはずのルールが次に開いたときには復活している、という壊れ方になる。
 */
const stub = registerStub({
  id: "persistence:policy-rule-sample",
  port: "表現ポリシーの保存先",
  label: "表現ポリシー（初期ルールのまま）",
  blockedBy: "policy_rules テーブルの追加と、作業場所を作ったときに初期ルールを配る処理",
});

export function samplePolicyRuleNotice(): string {
  return `${stub.label}で確認しています（${stub.blockedBy}が済むまでの仮です）。`;
}

/**
 * 作業場所ごとに 1 度だけ組み立てて使い回す。
 *
 * 記事を 1 本開くたびに 13 件の正規表現を作り直す理由が無い。
 * 組み立てに失敗したときは覚えない（次に呼んだときに同じ失敗を返させる）。
 */
const cache = new Map<string, readonly PolicyRule[]>();

function rulesFor(workspaceId: WorkspaceId): readonly PolicyRule[] | null {
  const key = String(workspaceId);
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const built = buildSeedPolicyRules(workspaceId);
  if (!built.ok) return null;
  cache.set(key, built.value);
  return built.value;
}

export function createSamplePolicyRuleRepository(): PolicyRuleRepositoryPort {
  return {
    async findById(workspaceId, id) {
      const rules = rulesFor(workspaceId);
      if (rules === null) return stubCall(stub, "初期ルールの組み立て");
      return ok(rules.find((r) => String(r.id) === String(id)) ?? null);
    },
    async listEnabled(workspaceId) {
      const rules = rulesFor(workspaceId);
      if (rules === null) return stubCall(stub, "初期ルールの組み立て");
      return ok(rules.filter((r) => r.enabled));
    },
    save: () => stubCall(stub, "表現ポリシーの保存"),
  };
}
