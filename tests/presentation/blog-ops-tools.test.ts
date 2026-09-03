/**
 * @tier 1
 * @req REQ-BLOG06
 * @types contract, permission-matrix
 *
 * **手元の CLI から記事を書く口の、越えてはいけない線を固定する。**
 *
 * ここが見張るのは 2 つ。
 *
 * 1. **報酬額が記事づくりの入力にならないこと。**
 *    どの商品を上に置くか、どう書き分けるかが売上で決まると、
 *    読者から見て「おすすめ」の意味が変わる。
 *
 *    渡された場合に落とすのは `manage-blog-articles.ts` の `guardEditorial` で、
 *    それは `tests/application/blog-ops-usecases.test.ts` が固定している。
 *    **ここが見るのはその手前——渡す渡さない以前に、触ってすらいないこと**である。
 *    2 つは別の線で、片方があれば要らないというものではない。ガードは
 *    「`base` に載せた」瞬間に落ちるが、載せずに読むだけの経路
 *    （道具の説明文を報酬額で組み立てる、など）はガードを通らない。
 *
 * 2. **公開と削除を AI が押せないこと。**
 *    宣言 (`requiresHumanApproval`) と入口の判定 (`isToolAllowedForScope`) は
 *    別の場所にある。片方だけ直すと、宣言は書いてあるのに誰も止めない。
 *    ブログ運用の 7 道具は `admin-screen-task-manifest.ts` に載っていないため、
 *    `tests/ui/uiux-admin-api-contract.test.ts` の走査からは外れている
 *    （2026-08-26 に確認）。この 7 つはここで見る。
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { AppDeps } from "@/application/deps";
import { createDeps } from "@/infrastructure/composition";
import { blogOpsTools } from "@/presentation/tools/blog-ops-tools";
import { isToolAllowedForScope, type CallerScope } from "@/presentation/http/tool-scope";

const ROOT = join(import.meta.dirname, "../..");

/** 入口は 2 つだけ。`bearer` が手元の CLI、`same-origin` が画面の中の AI。 */
const SCOPES: readonly CallerScope[] = ["bearer", "same-origin"];

/**
 * 商業区分のポート名。**一覧を手で書き写さない。**
 *
 * `src/application/deps.ts` は「ここから下は Commercial 区分」という 1 行で
 * 区切ってある。そこを読む。手で写すと、6 つ目が足された日に
 * **この検査だけが 5 つのままになり、緑のまま穴が開く。**
 */
function commercialPorts(): readonly string[] {
  const source = readFileSync(join(ROOT, "src/application/deps.ts"), "utf8");
  const at = source.indexOf("ここから下は Commercial 区分");
  expect(at, "deps.ts の Commercial 区分の目印が見つかりません").toBeGreaterThan(0);
  return [...source.slice(at).matchAll(/readonly (\w+):/g)].map((m) => m[1] as string);
}

/** 組み立てのあいだに触られたポート名を記録する。 */
function recordTouchedPorts(): { readonly deps: AppDeps; readonly touched: Set<string> } {
  const touched = new Set<string>();
  const real = createDeps();
  const deps = new Proxy(real, {
    get(target, key, receiver) {
      if (typeof key === "string") touched.add(key);
      return Reflect.get(target, key, receiver);
    },
  }) as AppDeps;
  return { deps, touched };
}

describe("ブログ運用の道具 — 報酬額は記事づくりの入力にならない", () => {
  it("組み立てのあいだ、商業区分のポートを 1 つも触らない", () => {
    const { deps, touched } = recordTouchedPorts();
    blogOpsTools(deps);

    /*
      **禁止と許可の両方を見る。**片方だけでは足りない。

      禁止リストだけだと、報酬額が別の名前（たとえば商品のポート）から
      入ってきた日に気づかない。許可リストだけだと、`deps.ts` の
      Commercial 区分そのものが名前を変えたときに、何を守っていたのかが
      読めなくなる。**2 つ並べてあると、落ちた側がどちらの線かを言う。**
    */
    const commercial = commercialPorts();
    expect(commercial.length, "Commercial 区分のポートが 1 つも読めていません").toBeGreaterThan(0);

    expect(
      commercial.filter((port) => touched.has(port)),
      "報酬額が記事づくりの入力になっています",
    ).toStrictEqual([]);

    /*
      触ってよいのはこの 3 つだけ。**ここが赤くなったら一覧を直す前に、
      足したポートが記事づくりに要るのかを先に考えること。**
      要らないものを一覧へ足すのは、線を引き直すのではなく消すのと同じである。
    */
    const ALLOWED = ["blogOps", "ids", "auditLog"];
    expect(
      [...touched].filter((port) => !ALLOWED.includes(port)).sort(),
      "ブログ運用の道具が、記事づくりに要らないポートを触っています",
    ).toStrictEqual([]);
  });
});

describe("ブログ運用の道具 — 人が押すもの", () => {
  const tools = blogOpsTools(createDeps());
  const byName = new Map(tools.map((t) => [t.name, t]));

  it("7 つの道具がそろっている（減っても増えても気づく）", () => {
    expect([...byName.keys()].sort()).toStrictEqual([
      "create_blog_article",
      "delete_blog_article",
      "get_blog_article",
      "list_blog_articles",
      "list_blog_tags",
      "set_blog_article_status",
      "update_blog_article",
    ]);
  });

  it.each(["set_blog_article_status", "delete_blog_article"])(
    "%s は承認を要すると宣言し、どの入口からも実行できない",
    (name) => {
      const tool = byName.get(name);
      expect(tool, `${name} が目録にありません`).toBeDefined();
      if (!tool) return;
      expect(tool.requiresHumanApproval).toBe(true);
      for (const scope of SCOPES) {
        expect(isToolAllowedForScope(tool, scope), `${name} が ${scope} から実行できます`).toBe(
          false,
        );
      }
    },
  );

  it.each(["create_blog_article", "update_blog_article"])(
    "%s は承認を要さない（取り消せる操作に承認を課すと、やがて誰も読まずに通す）",
    (name) => {
      expect(byName.get(name)?.requiresHumanApproval).toBe(false);
    },
  );

  it.each(["list_blog_articles", "get_blog_article", "list_blog_tags"])(
    "%s は読み取り専用である",
    (name) => {
      expect(byName.get(name)?.readOnly).toBe(true);
    },
  );

  it("記事を作る道具に、公開状態を渡す欄が無い（作られるものは必ず下書き）", () => {
    const source = readFileSync(join(ROOT, "src/presentation/tools/blog-ops-tools.ts"), "utf8");
    const create = source.slice(source.indexOf('name: "create_blog_article"'));
    const untilNext = create.slice(0, create.indexOf("defineTool({"));
    expect(untilNext).not.toContain("status");
  });
});
