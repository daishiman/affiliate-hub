import {
  type DomainError,
  type Result,
  type WorkspaceId,
  asPolicyRuleId,
  ok,
} from "../shared";
import {
  type PolicyChannelScope,
  type PolicyRule,
  type PolicyDomainScope,
  type PolicySeverity,
  createPolicyRule,
} from "./policy-rule";

/**
 * 表現ポリシーの**初期ルール一覧**（REQ-SEC07）。
 *
 * `policy-rule.ts` はルールの「形」と当て方だけを持ち、中身を持たない。
 * 中身が空のまま公開すると、**検査は毎回「違反 0 件」で緑になる**。
 * 落ちない検査は、無い検査と見分けが付かない。ここはその穴を塞ぐ一覧である。
 *
 * --- ここに置く理由（ワークスペースのデータなのに、なぜコードにあるのか）---
 *
 * 運用されるルールはワークスペースごとに増減する。だから保存先はデータである。
 * ただし**最初の 1 件目を人が手で入れる前提にすると、誰も入れない**。
 * ここが持つのは「新しいワークスペースに配る初期値」で、
 * 配った後の追加・無効化はデータ側で行う（`enabled` を落とす）。
 *
 * --- 効き方を 3 段に分けている ---
 *
 *   block  公開させない。**法令で言い切れるものだけ**に限る
 *   warn   人が確認すれば公開できる。根拠しだいで正しくなり得るもの
 *   info   記録だけ
 *
 * 迷ったら `warn` にする。`block` を広く取ると、正しい記述まで止まり、
 * やがて**ポリシー自体を切る**運用になる。切られた検査は最も危ない。
 *
 * --- 例文を必ず 2 つ持たせている ---
 *
 * `triggers` は当たらなければならない文、`allows` は当たってはならない文。
 * 正規表現は書いた本人にしか効き目が分からないので、
 * **例文の無いルールを足せないようにしてある**（型で必須）。
 * 検査は `tests/domain/policy-rule-seed.test.ts` が全件に当てる。
 *
 * 規範: docs/product/traceability.md REQ-SEC07
 */
export type PolicyRuleSeed = {
  /** ワークスペースをまたいで同じ意味を指す短い名前。ID の素になる。 */
  readonly key: string;
  readonly name: string;
  readonly domainScope: PolicyDomainScope;
  readonly channelScope: PolicyChannelScope;
  readonly severity: PolicySeverity;
  readonly pattern: string;
  readonly basis: string;
  readonly suggestion: string;
  /** このルールが当たらなければならない文（最低 1 つ）。 */
  readonly triggers: readonly [string, ...string[]];
  /** 言い換えた後の文。当たってはならない。 */
  readonly allows: readonly [string, ...string[]];
};

/**
 * 初期ルール。
 *
 * 分野を `general` にしてよいのは**どの記事でも同じく駄目なもの**だけ。
 * 化粧品のルールを general に置くと家電の記事が止まり、
 * 執筆者が「この検査は当てにならない」と判断してポリシーごと切る。
 */
export const POLICY_RULE_SEEDS: readonly PolicyRuleSeed[] = [
  // ------------------------------------------------------------------ 薬機法
  {
    key: "yakki-cure",
    name: "薬機法: 治る・完治の断定",
    domainScope: "health_food",
    channelScope: "any",
    severity: "block",
    // 「治りにくい」「治療中」を巻き込まないよう、断定の語尾に限る。
    pattern: "(治る|治ります|完治(する|します)|治癒(する|します))",
    basis: "医薬品医療機器等法 第 66 条（誇大広告の禁止）。食品に医薬品的な効能を書けない",
    suggestion: "「〜が気になる方に選ばれています」など、体験や用途の説明に置き換える",
    triggers: ["飲み続ければ花粉症が治ります。", "3 か月で完治する人もいます。"],
    allows: ["花粉の季節が気になる方に選ばれています。", "治療中の方は医師にご相談ください。"],
  },
  {
    key: "yakki-no-side-effect",
    name: "薬機法: 副作用がない・安全と言い切る",
    domainScope: "health_food",
    channelScope: "any",
    severity: "block",
    pattern: "(副作用(は|が)(ない|ありません|一切)|絶対に安全|100\\s*%安全)",
    basis: "医薬品医療機器等法 第 66 条。安全性の断定は分量にかかわらず認められない",
    suggestion: "「体質に合わない場合はご使用を中止してください」と注意の側を書く",
    triggers: ["天然由来なので副作用はありません。", "誰が飲んでも絶対に安全です。"],
    allows: ["体質に合わない場合は使用を中止してください。"],
  },
  {
    key: "cosmetics-erase",
    name: "薬機法: 化粧品で「消える・生える」",
    domainScope: "cosmetics",
    channelScope: "any",
    severity: "block",
    pattern: "(シミ|しわ|シワ|ニキビ跡)(が|も)?(消える|消えます|無くなる|なくなります)|毛が生える",
    basis: "医薬品医療機器等法。化粧品の効能の範囲（56 項目）を超える表現",
    suggestion: "「乾燥による小じわを目立たなくする」など、認められた効能の範囲で書く",
    triggers: ["1 週間でシミが消えると評判です。", "使い続けると毛が生えるとされています。"],
    allows: ["乾燥による小じわを目立たなくします。"],
  },
  {
    key: "medical-diagnosis",
    name: "薬機法・医療広告: 診断や治療を代替できると書く",
    domainScope: "medical",
    channelScope: "any",
    severity: "block",
    pattern: "(病院(に行かなくて|いらず)|受診(は)?不要|医師の診断(は)?不要)",
    basis: "医療広告ガイドライン。受診の回避をすすめる表示は認められない",
    suggestion: "「気になる症状があるときは医療機関を受診してください」を併記する",
    triggers: ["これがあれば病院に行かなくて済みます。", "医師の診断は不要です。"],
    allows: ["気になる症状があるときは医療機関を受診してください。"],
  },

  // ------------------------------------------------------------------ 景表法
  {
    key: "keihyo-superlative",
    name: "景表法: 根拠のない最上級（日本一・No.1・最安値）",
    domainScope: "general",
    channelScope: "any",
    // 根拠を添えれば書けるので block ではなく warn。人が調査出典を確認して通す。
    severity: "warn",
    pattern: "(日本一|世界一|業界(No\\.?1|ナンバーワン)|No\\.?\\s*1|最安値|最高峰)",
    basis: "景品表示法 第 5 条第 1 号（優良誤認）。No.1 表示は調査出典の明示が要る",
    suggestion: "調査機関・調査期間・対象を併記するか、「〜の分野で高い評価」に弱める",
    triggers: ["満足度 No.1 のサービスです。", "ここが最安値です。"],
    allows: ["2026 年 3 月・当社調べ（20 代 500 人）で満足度 1 位でした。"],
  },
  {
    key: "keihyo-urgency",
    name: "景表法: 実体のない限定・急かし",
    domainScope: "general",
    channelScope: "any",
    severity: "warn",
    pattern: "(今だけ|本日限り|残りわずか|先着\\s*\\d+\\s*名|急がないと)",
    basis: "景品表示法 第 5 条第 2 号（有利誤認）。期限や数量に実体が無いと不当表示になる",
    suggestion: "終了日時や残数を具体的に書く。書けないなら表現ごと外す",
    triggers: ["今だけ半額です。", "先着 100 名の特典があります。"],
    allows: ["2026 年 4 月 30 日 23:59 までの価格です。"],
  },
  {
    key: "keihyo-guaranteed-result",
    name: "景表法: 効果の言い切り（必ず・絶対）",
    domainScope: "general",
    channelScope: "any",
    severity: "block",
    pattern: "(必ず(痩せ|効果|成功|稼げ)|絶対に(痩せ|効く|稼げ|儲か))",
    basis: "景品表示法 第 5 条第 1 号。個人差のある結果を言い切ることはできない",
    suggestion: "「個人差があります」を添えたうえで、体験談は体験談として書く",
    triggers: ["飲めば必ず痩せます。", "この方法なら絶対に稼げます。"],
    allows: ["効果の感じ方には個人差があります。"],
  },

  // ------------------------------------------------------------------ 金融
  {
    key: "finance-principal-guarantee",
    name: "金融: 元本保証・必ず儲かる",
    domainScope: "finance",
    channelScope: "any",
    severity: "block",
    pattern: "(元本保証|元本が保証|損(は|を)しません|必ず儲かる|絶対に増える)",
    basis: "金融商品取引法 第 38 条（断定的判断の提供の禁止）",
    suggestion: "「価格変動により元本を割り込む可能性があります」を必ず書く",
    triggers: ["元本保証で運用できます。", "この銘柄なら必ず儲かる。"],
    allows: ["価格変動により元本を割り込む可能性があります。"],
  },

  // ------------------------------------------------- 賭博・酒・子ども向け
  {
    key: "gambling-sure-win",
    name: "賭博: 必勝法・攻略の断定",
    domainScope: "gambling",
    channelScope: "any",
    severity: "block",
    pattern: "(必勝法|絶対に勝てる|勝ち確|負けない方法)",
    basis: "景品表示法 第 5 条第 1 号、および各 ASP の禁止事項",
    suggestion: "還元率や仕組みの説明にとどめ、勝敗の断定は書かない",
    triggers: ["この必勝法で勝てます。", "絶対に勝てる賭け方です。"],
    allows: ["還元率は公表値で 97% とされています。"],
  },
  {
    key: "alcohol-age",
    name: "酒類: 未成年へ向けた表現",
    domainScope: "alcohol",
    channelScope: "any",
    severity: "warn",
    pattern: "(未成年|高校生|中学生)(でも|も)(飲|楽しめ)",
    basis: "酒類の広告・宣伝及び酒類容器の表示に関する自主基準",
    suggestion: "「20 歳未満の飲酒は法律で禁止されています」を明記する",
    triggers: ["未成年でも飲めるノンアルコールです。"],
    allows: ["20 歳未満の飲酒は法律で禁止されています。"],
  },
  {
    key: "children-pressure",
    name: "子ども向け: 購入をせかす表現",
    domainScope: "children",
    channelScope: "any",
    severity: "warn",
    pattern: "(おうちの人に|パパやママに)(お願いして|ねだって)|買ってもらおう",
    basis: "景品表示法および日本広告審査機構の指針（子どもに向けた広告の配慮）",
    suggestion: "購入の判断は保護者に向けて書く",
    triggers: ["おやつを買ってもらおう。"],
    allows: ["ご購入は保護者の方がご判断ください。"],
  },

  // ---------------------------------------------------------------- ASP 規約
  {
    key: "asp-hidden-ad",
    name: "ASP 規約: 広告であることを隠す表現",
    domainScope: "general",
    channelScope: "any",
    severity: "block",
    pattern: "(広告(では|じゃ)(ない|ありません)|案件(では|じゃ)(ない|ありません)|PR(では|じゃ)ありません)",
    basis: "景品表示法のステルスマーケティング告示（2023-10-01 施行）および各 ASP の規約",
    suggestion: "広告表記は自分で書かず、共通の開示（DisclosureNotice）に任せる",
    triggers: ["これは広告ではありません、正直な感想です。"],
    allows: ["この記事には広告（アフィリエイトリンク）が含まれます。"],
  },
  {
    key: "asp-self-click",
    name: "ASP 規約: 自己申込・報酬目的の誘導を促す",
    domainScope: "general",
    channelScope: "any",
    severity: "warn",
    pattern: "(自己アフィリ|セルフバック|この(リンク|バナー)から申し込んでくれると(報酬|収入))",
    basis: "多くの ASP が自己申込の推奨を禁じている（規約は ASP ごとに異なる）",
    suggestion: "利用している ASP の規約を確認し、許されている場合だけ条件つきで書く",
    triggers: ["セルフバックで稼ぎましょう。"],
    allows: ["申し込み方法は公式サイトをご確認ください。"],
  },
];

/**
 * 初期ルールを 1 つのワークスペース向けに組み立てる。
 *
 * ID は `pol_<ワークスペース>_<key>` で決め打ちにしてある。
 * 乱数にすると**配り直したときに重複する**（同じ意味のルールが 2 本並び、
 * 違反が 2 件に見える）。決め打ちなら 2 回目は同じ ID になり、上書きで済む。
 *
 * 途中で 1 件でも壊れていたら**全体を失敗にする**。
 * 一部だけ配ると、配られなかったルールの分だけ検査が甘くなり、
 * しかもその事実は画面から見えない。
 */
export function buildSeedPolicyRules(
  workspaceId: WorkspaceId,
): Result<readonly PolicyRule[], DomainError> {
  const rules: PolicyRule[] = [];
  for (const seed of POLICY_RULE_SEEDS) {
    const built = createPolicyRule({
      id: asPolicyRuleId(`pol_${String(workspaceId)}_${seed.key}`),
      workspaceId,
      name: seed.name,
      domainScope: seed.domainScope,
      channelScope: seed.channelScope,
      severity: seed.severity,
      pattern: seed.pattern,
      basis: seed.basis,
      suggestion: seed.suggestion,
    });
    if (!built.ok) return built;
    rules.push(built.value);
  }
  return ok(rules);
}
