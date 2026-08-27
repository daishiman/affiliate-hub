/**
 * 表の 1 行を「描く」ところ。**表そのものは `route-cases.ts` にある。**
 *
 * 割った理由はそちらの冒頭に書いた。要点だけ言うと、Playwright は React を
 * 持ち込めないのでこのファイルを import できず、以前は表を構文木から手読みしていた。
 * 表を描く道具から独立させたことで、その手読みが不要になった。
 *
 * ここは vitest 側の入口として、表をそのまま再輸出し、描く手順を足す。
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { type RouteWorld, renderRoute, renderRouteIn } from "../support/render";
import { SITE } from "./route-cases";

export { ADMIN_ROUTE_CASES, ROUTE_CASES, type RouteCase } from "./route-cases";
import type { RouteCase } from "./route-cases";

/**
 * 同じ画面を別の状態でもう一度開く場合。
 *
 * 状態違いを `ROUTE_CASES` に混ぜないのは、そこが**画面の本数**を表す表であり、
 * 混ぜるとファイルとの突き合わせができなくなるため。
 *
 * **`world` は「URL では作れない状態」を名前で指す。**
 * `params` / `searchParams` は URL の中身なので、URL で表せない前提
 * （ログインしているか、設定が済んでいるか）は書けない。書けないぶん、
 * その枝は**一度も描かれないまま**すべての走査を素通りする（残課題 141）。
 * 置き換え方は `tests/support/render.tsx` の `WORLDS` にある。
 */
export const ROUTE_STATE_CASES: readonly (RouteCase & {
  readonly state: string;
  readonly world?: RouteWorld;
})[] = [
  /*
   * ログインの画面は状態を 3 つ持つ（`signin/page.tsx` の冒頭に書いてある）。
   * そのうち既定の描画で通るのは 1 つ目（設定が済んでいない）だけで、
   * **残り 2 つは URL では作れない**。ここに無いと、
   * 「ログインの操作」も「ログアウトの操作」も一度も描かれない。
   *
   * 実測（2026-08-21）: 足す前は、ログアウトを壊れた形
   * （`<button className={styles.linkNote}>`＝押しどころの下限を持たない）へ戻しても
   * `tests/ui/screen-hit-and-current.test.tsx` は **120 件すべて緑**だった。
   */
  { state: "ログインの設定が済んで、まだ入っていないとき", file: "signin/page.tsx", world: "auth-configured" },
  { state: "ログインしているとき", file: "signin/page.tsx", world: "signed-in" },
  {
    // 断られた理由は画面に出さない（どのアドレスが登録済みかを外から測れてしまう）。
    // 出ないことを含めて、この枝も描いておく。
    state: "ログインを断られて戻ってきたとき",
    file: "signin/page.tsx",
    searchParams: { error: "access_denied" },
  },
  { state: "検索語が空のとき", file: "s/[site]/search/page.tsx", params: { site: SITE } },
  /*
   * **`EmptyView` が書かれてから一度も描かれていなかった枝**（UX-14）。
   * 見本の企画は読者像を全部持っているので `?axis=audience` でも行は埋まる。
   * URL では作れないので世界で作る。置き換えているのは企画の
   * `audiencePersonaIds` 1 フィールドだけで、**0 行になるところは本物が計算する。**
   */
  {
    state: "読者像が 1 つも登録されていないとき",
    file: "admin/content/matrix/page.tsx",
    searchParams: { axis: "audience" },
    world: "no-audience",
  },
  {
    // 存在しないブログ名でも、実在するブログの中の存在しない記事・商品・書き手でも、
    // `page.tsx` は `notFound()` を投げるので、ここで描くのは受け先の
    // `not-found.tsx` 1 枚である。**「見つからない商品」をここに書き戻さないこと。**
    // 書き戻すと画面は描けてしまい、そのとき通信の答えは 200 に落ちている。
    // 「404 で返ること」自体は tests/ui/site-not-found.test.tsx（無いブログ名）と
    // tests/ui/resource-not-found.test.tsx（無い記事・商品・人）が見ている。
    state: "存在しないブログ・記事・商品・人を指定したとき",
    file: "s/[site]/not-found.tsx",
  },
  { state: "対応待ちだけを見るとき", file: "admin/inbox/page.tsx", searchParams: { state: "pending" } },
  {
    state: "前の月を見るとき",
    file: "admin/affiliate/page.tsx",
    searchParams: { period: "2026-07" },
  },
  // 改善要望は「絞った状態」で見る時間が最も長い。既定の表示しか描かないと、
  // 絞り込みの説明文・件数・空の案内という**最も読まれる部分**が一度も描かれない。
  //
  // **↑ この理由は正しいが、2026-08-21 まで実現していなかった。**
  // 下の 4 件は既定の 1 件と合わせて 5 件とも、**1 文字も違わない
  // 「権限がありません」の画面を描いていた。**見本の身元が `feedback.read` を
  // 持たないためで、ここに書いた「絞り込みの説明文・件数・空の案内」は
  // **一度も描かれていない。**登録を増やすことは、描く枝を増やすことではない。
  //
  // **理由が丁寧なほど、次に読む人は「ここは測れている」と読む。**
  // 理由の質と、その理由が実現しているかは無関係なのに、読む側は前者から
  // 後者を推定してしまう。いまは `worldOf` が前提を足して描けているが、
  // **描けていることを確かめているのは `tests/ui/route-branch-reached.test.ts`
  // であって、この理由書きではない。**
  {
    state: "対応状況と種類を重ねて絞ったとき",
    file: "admin/feedback/page.tsx",
    searchParams: { status: "in_progress", kind: "hard_to_use", handedOff: "no" },
  },
  {
    state: "渡したものだけを見て 0 件になるとき",
    file: "admin/feedback/page.tsx",
    searchParams: { handedOff: "yes" },
  },
  {
    state: "廃棄したものも見るとき",
    file: "admin/feedback/page.tsx",
    searchParams: { discarded: "yes" },
  },
  {
    state: "知らない絞り込みの値を渡されたとき",
    file: "admin/feedback/page.tsx",
    // 手で URL を書き換えられても、絞り込みを無視して全件を出す（落とさない）。
    searchParams: { status: "とりあえず保留", kind: "なんとなく", handedOff: "たぶん" },
  },
  {
    state: "どうなってほしいかが書かれていない要望を開いたとき",
    file: "admin/feedback/[report]/page.tsx",
    params: { report: "fb_sample_draft" },
  },
  {
    state: "エラーが記録されていた要望を開いたとき",
    file: "admin/feedback/[report]/page.tsx",
    params: { report: "fb_sample_error" },
  },
  {
    state: "存在しない要望を開いたとき",
    file: "admin/feedback/[report]/page.tsx",
    params: { report: "fb_does_not_exist" },
  },
  // 改善の画面は、どのブログで試すかを決めてから**回す操作**が出る。
  // 既定の表示だけを描くと、1 周まわす欄（登録・承認・開始・観測・判定）が
  // 一度も描かれない。入口が無いまま「部品はある」に戻る道がここである。
  {
    state: "どのブログで試すかを決めたとき",
    file: "admin/improvement/page.tsx",
    searchParams: { site: SITE },
  },
];

/**
 * その画面を描くときの前提。**表に書いていない画面は、ここが決める。**
 *
 * 運営側の画面はすべて `authorized`（＝その画面を見る役を持った人）で描く。
 * 見本の身元は読むだけの役 1 つしか持たず、**運営画面の 13 枚は
 * 「権限がありません」の 1 枚に置き換わっていた**（2026-08-21 実測。残課題 141）。
 * 置き換わっても例外にならないので、走査は緑のまま素通りする。
 *
 * **1 枚ずつ `world` を書かせないのは、書き忘れた画面だけが断りのまま残るため。**
 * 抜けるのはいつも新しい画面である。表に `world` が書いてあればそちらが勝つ。
 *
 * 読者側の画面をここに含めないのは、`signedInActor()` を運営の身元へ
 * 置き換えると**読者として描くはずの画面が別の枝へ落ちる**ため。
 */
export function worldOf(
  route: RouteCase & { readonly world?: RouteWorld },
): RouteWorld | undefined {
  if (route.world !== undefined) return route.world;
  if (!route.file.startsWith("admin/")) return undefined;
  return pagesNeedingBlogOps().has(route.file) ? "blog-ops-ready" : "authorized";
}

/**
 * `blogOpsEntry()` を呼ぶ画面を**ソースから拾う。一覧を手で書かない。**
 *
 * --- なぜ拾うのか（2026-08-27）---
 *
 * この 12 枚は保存先が用意できていないと冒頭で `return` する。自動テストに
 * D1 は無いので、**総当たりが描いていたのは 12 枚とも同じ「いまは編集できません」**
 * だった。分岐の実測がそれを示している——`admin/blog/pages/page.tsx` は
 * 29 本中 1 本。上の `authorized` を足したときと**同じ形が、新しい画面で再発した。**
 *
 * だから一覧を手で持たない。手で並べると、次にブログ運用の画面を 1 枚足した人が
 * ここを知らず、**その 1 枚だけ**が断りの画面を描いたまま緑で通る。
 * 抜けるのはいつも新しい画面である（`worldOf` の説明と同じ理由）。
 *
 * 拾い方は `page-render.test.tsx` の `pageFilesOnDisk()` と同じ走査。
 * 走査は 1 回だけで、結果は使い回す。
 */
let blogOpsPages: ReadonlySet<string> | null = null;

function pagesNeedingBlogOps(): ReadonlySet<string> {
  if (blogOpsPages !== null) return blogOpsPages;
  const root = join(process.cwd(), "src/app");
  const found = new Set<string>();
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name === "page.tsx" && readFileSync(full, "utf8").includes("blogOpsEntry")) {
        found.add(relative(root, full));
      }
    }
  };
  walk(root);
  blogOpsPages = found;
  return found;
}

/** 画面を読み込むときの指定。`renderRoute` に渡す。 */
export function importPathOf(file: string): string {
  return `@/app/${file.replace(/\.tsx$/, "")}`;
}

/** Next.js が画面に渡す形（`params` も `searchParams` も Promise）に整える。 */
export function propsOf(route: RouteCase): Record<string, unknown> {
  return {
    params: Promise.resolve(route.params ?? {}),
    searchParams: Promise.resolve(route.searchParams ?? {}),
  };
}

/**
 * 表の 1 行を、そのとおりに描く。
 *
 * **`renderRoute` を直に呼ばずにここを通す。**直に呼ぶと `world` を持つ行が
 * 既定の前提で描かれ、**その行だけ黙って別の枝を測る**ことになる。
 * 落ちも赤も出ない（画面は描けてしまう）ので、取り違えに気づく手がかりが残らない。
 *
 * **前提は `worldOf` が決める。`route.world` を直に読まないこと。**
 * 直に読むと、表に `world` を書いていない運営画面が見本の身元で描かれ、
 * **13 枚が「権限がありません」の 1 枚に戻る**（2026-08-21 実測）。
 */
export function renderCase(route: RouteCase & { readonly world?: RouteWorld }): Promise<string> {
  const path = importPathOf(route.file);
  const props = propsOf(route);
  const world = worldOf(route);
  return world === undefined ? renderRoute(path, props) : renderRouteIn(world, path, props);
}
