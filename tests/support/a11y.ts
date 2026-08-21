import { JSDOM } from "jsdom";

/**
 * 読み上げと操作の自動検査（axe）。
 *
 * 自動検査で見つかるのは、アクセシビリティの問題の**一部だけ**である
 * （およそ 3〜4 割と言われる。「この代替テキストは内容を説明しているか」は機械には分からない）。
 * それでも入れるのは、**残りの機械で分かる側が、目視では最も見落とされる**ためで、
 * 「axe が通った＝アクセシブル」と読み替えないことが前提になる。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §3-4
 */

export type A11yViolation = {
  readonly id: string;
  readonly impact: string;
  readonly help: string;
  readonly targets: readonly string[];
};

/**
 * 見る基準。**WCAG 2.2 AA まで + best-practice**。
 *
 * AAA を入れないのは、AAA が「満たすことが望ましいが常には満たせない」水準として
 * 定義されているためで、落ちても直せない指摘が並ぶと検査全体が無視されるようになる。
 *
 * --- `best-practice` を入れた理由（2026-08-19） ---
 * 「当たる規則が 28 件から 45 件へ増えるから」ではない。
 * **`landmark-unique` の違反が現に出ていて、それが見えていなかったから**である。
 * `/admin/settings` と `/admin/ui-catalog` が、同じ名前の目印（広告表示のお知らせ）を
 * 1 画面に 2 つ出していた。読み上げの目印一覧でどちらがどちらか見分けが付かない状態が、
 * WCAG の等級だけを見ていたときには 1 度も赤くならなかった。
 * 広げた時点で出た件数と直し方は docs/product/backlog.md の 84 に実測として残してある。
 */
export const A11Y_TAGS: readonly string[] = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22aa",
  "best-practice",
];

/**
 * **止めている規則。1 件ずつ理由を書く。**
 *
 * 止めるのは、赤が出たときに最も簡単な逃げ道になる。
 * だから止めた件数そのものに上限を張り（`tests/ui/axe-rule-coverage.test.ts`）、
 * **理由の書かれていない項目を 0 件で固定**してある。
 * `reason` は空文字列を書けてしまう（型では止まらない）ので、あの検査は壊せる。
 */
export type DisabledRule = { readonly id: string; readonly reason: string };

export const DISABLED_RULES: readonly DisabledRule[] = [
  {
    id: "color-contrast",
    reason:
      "色のコントラストは別で見る（配色 5 種 × 明暗 2 種を tests/ui/theme-contrast.test.ts が登録表から総当たりしている）。ここで有効にしても、jsdom は実際の描画色を持たないため必ず「判定不能」になる",
  },
];

/** 理由が書かれていない項目。**この関数が本物の検査と同じ通り道を通る。** */
export function disabledRulesWithoutReason(
  rules: readonly DisabledRule[] = DISABLED_RULES,
): readonly string[] {
  return rules.filter((r) => r.reason.trim().length === 0).map((r) => r.id);
}

/** いま `A11Y_TAGS` で有効になっている規則の一覧。**手書きの定数ではなく axe に訊く。** */
export async function enabledRuleIds(): Promise<readonly string[]> {
  const axe = (await import("axe-core")).default;
  const off = new Set(DISABLED_RULES.map((r) => r.id));
  return axe
    .getRules()
    .filter((r) => r.tags.some((t) => A11Y_TAGS.includes(t)))
    .map((r) => r.ruleId)
    .filter((id) => !off.has(id));
}

/**
 * HTML の断片を検査する。
 *
 * 断片ではなくページ全体を渡すこと。
 * 見出しの階層・地図（landmark）・重複 ID は、**周りが無いと判定できない**。
 */
/**
 * 検査に使う DOM は **1 つを作って使い回す**。
 *
 * 呼び出しごとに新しく作ると、2 回目以降が `axe.run arguments are invalid` で落ちる。
 * axe は最初に読み込まれたときの `window` を覚えており、
 * 別の window で作った document は「Node ではない」と判定されるため。
 * 原因が分かりにくい壁なので、作るのは 1 回だけにしてある。
 */
let shared: JSDOM | null = null;

function sharedDom(): JSDOM {
  // `lang` と `<title>` は入れ物側で満たしておく。
  // ここで検査したいのは**画面の中身**であって、Next.js が出す `<head>` ではない。
  // 入れ物を空にすると `document-title` `html-has-lang` が毎回出て、
  // 本当に直すべき指摘がその中に埋もれる。
  shared ??= new JSDOM(
    `<!doctype html><html lang="ja"><head><title>検査対象</title></head><body></body></html>`,
    { pretendToBeVisual: true },
  );
  return shared;
}

/**
 * 4 つの入れ物すべてを返す版。
 *
 * `findA11yViolations` は違反だけを返す。**それだけでは「規則が緑だった」と
 * 「規則が判定できなかった」が同じ「何も出ない」に見える。**
 * どの規則がどの入れ物へ入ったかを数える検査（`tests/ui/axe-rule-coverage.test.ts`）が
 * ここを使う。**通り道は 1 本のまま**にしておかないと、
 * 数えている経路と本物の検査の経路が別々に動いてしまう。
 */
export type A11yBuckets = {
  readonly violations: readonly string[];
  readonly passes: readonly string[];
  readonly incomplete: readonly string[];
  readonly inapplicable: readonly string[];
};

export async function runA11y(html: string): Promise<A11yBuckets> {
  const raw = await runAxe(html);
  return {
    violations: raw.violations.map((r) => r.id),
    passes: raw.passes.map((r) => r.id),
    incomplete: raw.incomplete.map((r) => r.id),
    inapplicable: raw.inapplicable.map((r) => r.id),
  };
}

/**
 * 画面の一部（部品ひとつ）を、画面に置かれた姿にしてから渡す。
 *
 * **部品だけを渡すと、画面にしか答えられない問いに部品が答えさせられる。**
 * 例: `region`（画面の中身はすべて目印の中にあること）は、
 * `<main>` を持っているのは画面の側なので、部品だけを渡すと必ず違反になる。
 * これは部品の欠陥ではなく**渡し方の欠陥**である。
 *
 * 逆に、画面まるごとを検査するときはこれを使わないこと。
 * 使うと `<main>` が二重になり、本物の欠け（画面が目印を持っていない）が隠れる。
 */
export function asPartOfPage(html: string): string {
  return `<main>${html}</main>`;
}

export async function findA11yViolations(html: string): Promise<readonly A11yViolation[]> {
  const result = await runAxe(html);
  return result.violations.map((v) => ({
    id: v.id,
    impact: v.impact ?? "unknown",
    help: v.help,
    targets: v.nodes.flatMap((n) => n.target.map(String)),
  }));
}

async function runAxe(html: string) {
  const dom = sharedDom();
  dom.window.document.body.innerHTML = html;

  // axe はブラウザ前提のため、実行の間だけ window / document を貸す。
  // `navigator` は Node 22 以降、読み取り専用の組み込みになっており書き換えられない。
  // axe は `window.navigator` を見るので、貸すのは window と document だけでよい。
  const g = globalThis as unknown as Record<string, unknown>;
  const saved = { window: g.window, document: g.document };
  g.window = dom.window;
  g.document = dom.window.document;

  try {
    const axe = (await import("axe-core")).default;
    const result = await axe.run(dom.window.document, {
      runOnly: { type: "tag", values: [...A11Y_TAGS] },
      // 止める規則は `DISABLED_RULES` から組み立てる。
      // ここへ直接書くと、理由つきの一覧が**飾りになる**（一覧に無い規則も止められてしまう）。
      rules: Object.fromEntries(DISABLED_RULES.map((r) => [r.id, { enabled: false }])),
    });
    return result;
  } finally {
    g.window = saved.window;
    g.document = saved.document;
    dom.window.document.body.innerHTML = "";
  }
}

/**
 * 違反を人が読める 1 つの文にする。
 *
 * 「axe に 3 件の違反」とだけ出るテストは、直すために結局ブラウザを開くことになる。
 * **どの要素の何が悪いか**まで出す。
 */
export function describeViolations(violations: readonly A11yViolation[]): string {
  if (violations.length === 0) return "";
  return violations
    .map((v) => `[${v.impact}] ${v.id}: ${v.help}\n    該当: ${v.targets.join(", ")}`)
    .join("\n");
}
