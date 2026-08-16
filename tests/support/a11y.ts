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
 * 見る基準。**WCAG 2.2 AA まで**。
 *
 * AAA を入れないのは、AAA が「満たすことが望ましいが常には満たせない」水準として
 * 定義されているためで、落ちても直せない指摘が並ぶと検査全体が無視されるようになる。
 */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

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

export async function findA11yViolations(html: string): Promise<readonly A11yViolation[]> {
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
      runOnly: { type: "tag", values: TAGS },
      // 色のコントラストは別で見る（配色 5 種 × 明暗 2 種を
      // tests/ui/theme-contrast.test.ts が登録表から総当たりしている）。
      // ここで有効にしても、jsdom は実際の描画色を持たないため必ず「判定不能」になる。
      rules: { "color-contrast": { enabled: false } },
    });
    return result.violations.map((v) => ({
      id: v.id,
      impact: v.impact ?? "unknown",
      help: v.help,
      targets: v.nodes.flatMap((n) => n.target.map(String)),
    }));
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
