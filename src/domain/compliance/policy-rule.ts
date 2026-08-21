import {
  type DomainError,
  type PolicyRuleId,
  type Result,
  type WorkspaceId,
  err,
  ok,
  validationError,
} from "../shared";

/**
 * 表現ポリシー (プラットフォーム層 §20 / §26)。
 *
 * 「この言い方は使えない」をデータで持つ理由:
 *   - 法令・チャネル規約は改定される。コードに埋め込むと改定のたびに実装を触る
 *   - 分野ごとに規制が違う (健康食品・化粧品・金融・医療)。分岐ではなく登録で扱う
 *   - AI 生成プロンプトの禁止事項と、生成後の自動確認を同じ定義から作る
 *
 * ここに置くのはルールの「形」と判定ロジックだけ。
 * 実際のルール内容 (薬機法の表現一覧など) はワークスペースのデータとして登録する。
 */

/**
 * ルールが効く分野。記事のカテゴリーに対応する。
 *
 * 実行時の配列を正本にして型を導く。型だけで持つと、
 * 「登録されようとしている分野が語彙に有るか」を実行時に確かめられず、
 * 綴りの違う分野が黙って general 扱いになる。
 */
export const POLICY_DOMAIN_SCOPES = [
  "general",
  "health_food", // 健康食品 (薬機法)
  "cosmetics", // 化粧品 (薬機法)
  "medical", // 医療・医薬品
  "finance", // 金融商品取引法・貸金業法
  "gambling",
  "alcohol",
  "children", // 子ども向け
] as const;
export type PolicyDomainScope = (typeof POLICY_DOMAIN_SCOPES)[number];

export function isPolicyDomainScope(value: unknown): value is PolicyDomainScope {
  return typeof value === "string" && (POLICY_DOMAIN_SCOPES as readonly string[]).includes(value);
}

/**
 * ルールが効く出力先。SNS は各社の規約が違う。
 *
 * **配信できる出力先（`ChannelKind`）を 1 つ残らず含める。**
 * 含めそこねた出力先の記事は、`any` のルールだけが当たり、
 * その媒体固有の規約は 1 件も当たらないまま「違反 0 件」で通る。
 * 欠けを人の目で見つけるのは無理なので、
 * `tests/domain/policy-channel-scope.test.ts` が両方の語彙を突き合わせている。
 */
export const POLICY_CHANNEL_SCOPES = [
  "any",
  "own_site",
  "x",
  "instagram",
  "youtube",
  "tiktok",
  "threads",
  "note",
  "newsletter",
  "wordpress",
  "bluesky",
] as const;
export type PolicyChannelScope = (typeof POLICY_CHANNEL_SCOPES)[number];

export function isPolicyChannelScope(value: unknown): value is PolicyChannelScope {
  return typeof value === "string" && (POLICY_CHANNEL_SCOPES as readonly string[]).includes(value);
}

export type PolicySeverity =
  | "block" // 公開させない
  | "warn" // 人が確認すれば公開できる
  | "info"; // 記録だけ

export type PolicyRule = {
  readonly id: PolicyRuleId;
  readonly workspaceId: WorkspaceId;
  /** 人が読んで意味が分かる名前。例: 「薬機法: 治る・効くの断定」 */
  readonly name: string;
  readonly domainScope: PolicyDomainScope;
  readonly channelScope: PolicyChannelScope;
  readonly severity: PolicySeverity;
  /** 検出する表現。正規表現の文字列として保存する (データで持つため)。 */
  readonly pattern: string;
  /** 大文字小文字を区別しないか。日本語では通常 true でよい。 */
  readonly ignoreCase: boolean;
  /** 根拠となる法令・規約。「なぜ駄目か」を書けないルールは運用されない。 */
  readonly basis: string;
  /** 代わりにどう書くか。これが無いと執筆者が止まる。 */
  readonly suggestion: string;
  readonly enabled: boolean;
};

export type PolicyViolation = {
  readonly ruleId: PolicyRuleId;
  readonly ruleName: string;
  readonly severity: PolicySeverity;
  /** 見つかった箇所。前後を含めて示さないと執筆者が探せない。 */
  readonly excerpt: string;
  readonly basis: string;
  readonly suggestion: string;
};

export type PolicyCheckResult = {
  readonly violations: readonly PolicyViolation[];
  /** block が 1 件でもあれば false。 */
  readonly publishable: boolean;
  /** 正規表現として壊れていて実行できなかったルール。黙って飛ばさない。 */
  readonly unevaluatedRuleIds: readonly PolicyRuleId[];
};

export function createPolicyRule(input: {
  id: PolicyRuleId;
  workspaceId: WorkspaceId;
  name: string;
  domainScope: PolicyDomainScope;
  channelScope: PolicyChannelScope;
  severity: PolicySeverity;
  pattern: string;
  ignoreCase?: boolean;
  basis: string;
  suggestion: string;
  enabled?: boolean;
}): Result<PolicyRule, DomainError> {
  if (input.name.trim() === "") {
    return err(validationError("ルール名が必要です。", "name"));
  }
  if (input.pattern.trim() === "") {
    return err(validationError("検出する表現が必要です。", "pattern"));
  }
  if (input.basis.trim() === "") {
    return err(
      validationError(
        "根拠 (法令・規約) が必要です。理由の書けないルールは運用できません。",
        "basis",
      ),
    );
  }
  if (input.suggestion.trim() === "") {
    return err(
      validationError(
        "代わりの書き方が必要です。禁止だけ示すと執筆が止まります。",
        "suggestion",
      ),
    );
  }
  if (!isPolicyDomainScope(input.domainScope)) {
    return err(
      validationError(
        "分野が語彙にありません。知らない分野を通すと、そのルールはどの記事にも当たりません。",
        "domainScope",
      ),
    );
  }
  if (!isPolicyChannelScope(input.channelScope)) {
    return err(
      validationError(
        "出力先が語彙にありません。知らない出力先を通すと、そのルールはどの記事にも当たりません。",
        "channelScope",
      ),
    );
  }
  if (!isValidPattern(input.pattern)) {
    return err(validationError("検出する表現が正規表現として解釈できません。", "pattern"));
  }
  return ok({
    id: input.id,
    workspaceId: input.workspaceId,
    name: input.name,
    domainScope: input.domainScope,
    channelScope: input.channelScope,
    severity: input.severity,
    pattern: input.pattern,
    ignoreCase: input.ignoreCase ?? true,
    basis: input.basis,
    suggestion: input.suggestion,
    enabled: input.enabled ?? true,
  });
}

function isValidPattern(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

const EXCERPT_MARGIN = 20;

/**
 * 本文をポリシーに照らす。
 *
 * 対象は「分野が一致するか general」かつ「出力先が一致するか any」のルールのみ。
 * 全ルールを常に当てると、化粧品のルールが家電記事を止めて運用されなくなる。
 */
export function checkPolicies(
  rules: readonly PolicyRule[],
  target: {
    text: string;
    domainScope: PolicyDomainScope;
    channelScope: PolicyChannelScope;
  },
): PolicyCheckResult {
  const violations: PolicyViolation[] = [];
  const unevaluated: PolicyRuleId[] = [];

  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (rule.domainScope !== "general" && rule.domainScope !== target.domainScope) continue;
    if (rule.channelScope !== "any" && rule.channelScope !== target.channelScope) continue;

    let re: RegExp;
    try {
      re = new RegExp(rule.pattern, rule.ignoreCase ? "gi" : "g");
    } catch {
      unevaluated.push(rule.id);
      continue;
    }

    for (const match of target.text.matchAll(re)) {
      const index = match.index ?? 0;
      violations.push({
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity,
        excerpt: target.text.slice(
          Math.max(0, index - EXCERPT_MARGIN),
          index + match[0].length + EXCERPT_MARGIN,
        ),
        basis: rule.basis,
        suggestion: rule.suggestion,
      });
    }
  }

  return {
    violations,
    publishable: !violations.some((v) => v.severity === "block"),
    unevaluatedRuleIds: unevaluated,
  };
}
