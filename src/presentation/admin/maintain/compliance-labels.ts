import { POLICY_CHANNEL_SCOPES, POLICY_DOMAIN_SCOPES, POLICY_SEVERITIES, type PolicyChannelScope, type PolicyDomainScope, type PolicySeverity } from "@/domain/compliance/policy-rule";
import { RELATIONSHIP_LABEL, type EditorialInfluence, type RelationshipType } from "@/domain/compliance/disclosure";
import type { SelectOption } from "@/presentation/ui";

/**
 * 表記のきまりの語彙を、選ぶ欄と表の両方へ同じ言葉で出す。
 *
 * 画面（server component）と入力欄（client component）の両方から読むので、
 * `"use client"` を付けない別のファイルに置いている。片方へ書くと、
 * **選ぶときの言葉と、保存後に表へ出る言葉が食い違う。**
 *
 * `Record<語彙, string>` で受けているのは、語彙が増えたときに
 * ここが型で赤くなるようにするためである。増えた分野が
 * 「未対応」のまま選択肢から漏れると、そのきまりは誰も作れない。
 */
export const POLICY_DOMAIN_LABEL: Record<PolicyDomainScope, string> = {
  general: "分野を問わない",
  health_food: "健康食品（薬機法）",
  cosmetics: "化粧品（薬機法）",
  medical: "医療・医薬品",
  finance: "金融商品",
  gambling: "公営競技・賭け事",
  alcohol: "酒類",
  children: "子ども向け",
};

export const POLICY_CHANNEL_LABEL: Record<PolicyChannelScope, string> = {
  any: "すべての出し先",
  own_site: "自分のサイト",
  x: "X",
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  threads: "Threads",
  facebook: "Facebook",
  note: "note",
  newsletter: "メール配信",
  wordpress: "WordPress",
  bluesky: "Bluesky",
};

/**
 * 強さは、名前ではなく**何が起きるか**で書く。
 *
 * 「警告」とだけ書くと、公開できるのかどうかが読めない。
 * ここで止まるのか、確認すれば進めるのかが、選ぶ人の知りたいことである。
 */
export const POLICY_SEVERITY_LABEL: Record<PolicySeverity, string> = {
  block: "公開させない",
  warn: "人が確認すれば公開できる",
  info: "記録だけ残す",
};

/** 広告主が編集内容へどこまで関わったか。読者に出る文の後半になる。 */
export const EDITORIAL_INFLUENCE_LABEL: Record<EditorialInfluence, string> = {
  none: "評価内容に関与していない",
  limited: "事実確認のみ行った",
  declared: "内容確認を行っている",
};

const option = <T extends string>(values: readonly T[], label: Record<T, string>): readonly SelectOption[] =>
  values.map((value) => ({ value, label: label[value] }));

export const POLICY_DOMAIN_OPTIONS = option(POLICY_DOMAIN_SCOPES, POLICY_DOMAIN_LABEL);
export const POLICY_CHANNEL_OPTIONS = option(POLICY_CHANNEL_SCOPES, POLICY_CHANNEL_LABEL);
export const POLICY_SEVERITY_OPTIONS = option(POLICY_SEVERITIES, POLICY_SEVERITY_LABEL);

/**
 * 関係の種類は、**読者に出る文そのもの**を選択肢に出す。
 *
 * 短い名札（「スポンサー」）に置き換えると、選んだ言葉と記事に出る言葉が
 * 別物になり、何を選んだのかを確かめられなくなる。`RELATIONSHIP_LABEL` は
 * domain が持っている正本で、ここでは並べ替えもしない。
 */
export const RELATIONSHIP_OPTIONS: readonly SelectOption[] = (
  Object.keys(RELATIONSHIP_LABEL) as readonly RelationshipType[]
).map((value) => ({ value, label: RELATIONSHIP_LABEL[value] }));

export const EDITORIAL_INFLUENCE_OPTIONS: readonly SelectOption[] = (
  Object.keys(EDITORIAL_INFLUENCE_LABEL) as readonly EditorialInfluence[]
).map((value) => ({ value, label: EDITORIAL_INFLUENCE_LABEL[value] }));
