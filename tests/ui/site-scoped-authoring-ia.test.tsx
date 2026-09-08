/** @tier 2 @req REQ-S09 */
import { describe, expect, it } from "vitest";
import { ADMIN_CARD_ROUTE_IDS, ADMIN_ROUTE_METADATA } from "@/presentation/ui";
import { ADMIN_NAV_GROUP_LABELS } from "@/presentation/ui/admin-route-metadata";

/**
 * サイト所属型オーサリング IA (feat-site-scoped-authoring-ia) の受入 A1 / A5 / A8。
 *
 * --- なぜ SSOT の値を直に見るのか ---
 *
 * 一段目の分類も、画面の住所も、正本は
 * `src/presentation/ui/admin-route-metadata.ts` の 1 つの表である。
 * サイドバーの描画結果だけを見ると、**表を直さずに描画側へ分岐を足しても緑になる**。
 * それは分類が 2 か所に散った状態そのもので、本 feature が無くそうとしている形である。
 *
 * 描画へ届いているか (読み上げに分類が出るか) は
 * `app-shell-nav.test.tsx` が別に見ている。ここは表の側だけを見る。
 *
 * 規範: docs/spec/feat-site-scoped-authoring-ia/entry-consolidation-contract.md
 *       docs/spec/feat-site-scoped-authoring-ia/site-scoped-route-contract.md
 *       docs/spec/feat-site-scoped-authoring-ia/shortcut-contract.md
 */

/** A5 が要求する、作業の対象物 5 つ。順序も業務順として固定する。 */
const WORK_OBJECTS: readonly string[] = ["blog", "article", "reader", "product", "delivery"];

/**
 * 対象物ではない入口。**運営者が「これについて作業する」と言わないもの。**
 *
 * 5 つに無理に混ぜると、たとえば設定が「配信」の下に出る。
 * そうなると「配信」というラベルから中身を言い当てられなくなり、A6 と衝突する。
 */
const UTILITY_ENTRIES = ["settings", "ai-usage", "tools", "ui-catalog"] as const;

/** A1 が要求する、site 配下へ移る 5 つの route id。 */
const SITE_SCOPED_AUTHORING_ROUTES = [
  "sites/[site]/authors",
  "sites/[site]/authors/new",
  "sites/[site]/audience/personas",
  "sites/[site]/audience/personas/new",
  "sites/[site]/writing",
] as const;

/**
 * A8 の近道。**旧入口をそのまま残し、行き先だけを転送の殻にする。**
 *
 * 消してしまうと、これまで 1 クリックで開けていた画面が
 * 「ブログを選ぶ → 目的の画面」の 2 クリックになる。
 */
const SHORTCUT_ENTRIES = ["personas", "writing", "content"] as const;

/**
 * このうち、**いま実際に転送の殻になっているもの**。
 *
 * `content` が入っていないのは意図である。行き先の
 * `/admin/sites/[site]/articles` がまだ無く、無い先へ送ると 404 になる。
 * 転送しない今より悪い。理由は `redirect-map-draft.json` の
 * `not_redirected` に残してあり、行き先ができた日にここへ移す。
 *
 * 「近道として残す」と「殻である」を 1 つの表で兼ねると、
 * 送り先が無いものまで殻にしないと緑にならず、404 を作る圧力になる。
 */
const REDIRECT_SHELL_ENTRIES = ["personas", "writing"] as const;

function routeIds(): readonly string[] {
  return ADMIN_ROUTE_METADATA.map((route) => route.id);
}

function routeById(id: string) {
  return ADMIN_ROUTE_METADATA.find((route) => route.id === id);
}

describe("A5: 一段目の分類が作業の対象物まで畳まれている", () => {
  it("分類がちょうど 5 つで、対象物の id と一致する", () => {
    expect(Object.keys(ADMIN_NAV_GROUP_LABELS)).toEqual(WORK_OBJECTS);
  });

  it("補助領域の 4 入口が、どの分類にも属さない", () => {
    /*
      属させないことを `nav.group === null` で見る。
      「分類に無い」だけを見ると、入口ごと消しても緑になる。
      消してはいけないので、入口が在ることと分類の外に在ることを両方見る。
    */
    for (const id of UTILITY_ENTRIES) {
      const route = routeById(id);
      expect(route, `${id} が route 表から消えています`).toBeDefined();
      expect(route?.nav, `${id} がサイドバーから消えています`).not.toBeNull();
      expect(route?.nav?.group, `${id} が分類の中に入っています`).toBeNull();
    }
  });

  it("サイドバーに出る全入口が、5 分類か分類の外かのどちらかに決まっている", () => {
    const known = new Set<string>(WORK_OBJECTS);
    const stray = ADMIN_ROUTE_METADATA.filter(
      (route) =>
        route.nav !== null &&
        route.nav.group !== null &&
        !known.has(route.nav.group),
    ).map((route) => route.id);
    expect(stray, "5 分類のどれでもない分類に属す入口があります").toEqual([]);
  });
});

describe("A1: 読者像と書き方の決め事が site 配下にある", () => {
  it("5 つの route id が正本の表にある", () => {
    const ids = new Set(routeIds());
    const missing = SITE_SCOPED_AUTHORING_ROUTES.filter((id) => !ids.has(id));
    expect(missing, "site 配下の route が表にありません").toEqual([]);
  });

  it("いずれも `sites/[site]` を辿って親へ戻れる", () => {
    /*
      パンくずは親子関係の射影である。親が繋がっていないと、
      site 配下に置いたのに「ブログ」へ戻る道が画面から消える。
    */
    for (const id of SITE_SCOPED_AUTHORING_ROUTES) {
      const route = routeById(id);
      expect(route, `${id} が表にありません`).toBeDefined();
      const chain: string[] = [];
      let cursor = route?.parent ?? null;
      while (cursor !== null && cursor !== "" && chain.length < 10) {
        chain.push(cursor);
        cursor = routeById(cursor)?.parent ?? null;
      }
      expect(chain, `${id} の親に sites/[site] がありません`).toContain("sites/[site]");
    }
  });
});

describe("A8: よく使う画面への近道が消えていない", () => {
  it("転送だけの作成 route を、移設先の実画面と二重に card 分類しない", () => {
    expect(ADMIN_CARD_ROUTE_IDS).not.toContain("personas/new");
    expect(ADMIN_CARD_ROUTE_IDS).not.toContain("personas/audiences/new");
    expect(ADMIN_CARD_ROUTE_IDS).toContain("sites/[site]/authors/new");
    expect(ADMIN_CARD_ROUTE_IDS).toContain("sites/[site]/audience/personas/new");
  });

  it("旧入口 3 件がサイドバーに残っている", () => {
    for (const id of SHORTCUT_ENTRIES) {
      const route = routeById(id);
      expect(route, `${id} が表から消えています`).toBeDefined();
      expect(
        route?.nav,
        `${id} がサイドバーから消えました。到達クリック数が畳む前より増えます。`,
      ).not.toBeNull();
    }
  });

  it("旧入口は転送だけを行う殻として印が付いている", () => {
    /*
      `redirectOnly` は「この route は DOM を持たない」の印である。
      印が無いまま中身も残っていると、同じ画面が 2 か所にある状態になり、
      片方だけ直された日に、どちらが本物か画面からは分からなくなる。
    */
    for (const id of REDIRECT_SHELL_ENTRIES) {
      expect(routeById(id)?.redirectOnly, `${id} に転送の殻の印がありません`).toBe(true);
    }
  });

  it("殻にした入口の子も、すべて殻になっている", () => {
    /*
      親だけを殻にすると、`/admin/personas` は送られるのに
      `/admin/personas/new` だけ古い画面が残る。片肺の状態である。
      表の親子関係から子を引いて、印の付け漏れを機械で見つける。
    */
    const children = ADMIN_ROUTE_METADATA.filter(
      (route) => route.parent !== null && REDIRECT_SHELL_ENTRIES.some((id) => id === route.parent),
    );
    const notShell = children
      .filter((route) => route.redirectOnly !== true)
      .map((route) => route.id);
    /*
      `writing/template` は例外である。旧 URL の子だが転送先ではなく、
      全ブログ共通の雛形という**新しい仕事**を持つ実在の画面である。
    */
    expect(notShell, "殻の子に印の付け漏れがあります").toEqual(["writing/template"]);
  });
});
