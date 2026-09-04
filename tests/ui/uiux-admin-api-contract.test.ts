/**
 * @tier 2
 * @req REQ-UX02
 * @types equivalence, decision-table
 *
 * A2: 管理対象 4 種すべてに一覧・新規作成・編集・削除の操作と対応 API がある。
 *
 * この system に「管理画面用の REST route を書く」作業は無い。道具を目録へ 1 つ足すと
 * REST・ページ内 AI・外部 AI の 3 入口へ同時に現れる。だから A2 の「対応 API がある」は
 * **目録に道具が載っていること**で満たされる。ここではそれを名前で引く。
 *
 * 見るのは 4 つ。
 *   1. 16 組の道具が全部ある（1 つでも欠けたら A2 は未達）
 *   2. 各操作の読み取り専用・人の承認の宣言が道具目録と一致する
 *   3. 人の承認を要する操作は、鍵を持っていても入口から実行できない
 *   4. 取り消せる変更に承認を課さない（形骸化を避けるため）
 *
 * 3 を見る理由は、2 を宣言しただけでは何も起きないため。宣言と入口の判定が
 * つながっていることを確かめないと、`requiresHumanApproval` はただの飾りになる。
 *
 * 規範: docs/spec/feat-uiux-overhaul/admin-api-contract.md
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createDeps } from "@/infrastructure/composition";
import {
  ADMIN_OPERATION_MANIFEST,
  adminOperation,
  adminOperationRouteId,
} from "@/presentation/admin/admin-operation-manifest";
import { isToolAllowedForScope, type CallerScope } from "@/presentation/http/tool-scope";
import { buildToolCatalog } from "@/presentation/tools/catalog";
import { ADMIN_ROUTE_METADATA } from "@/presentation/ui";

const catalog = buildToolCatalog(createDeps());
const byName = new Map(catalog.map((t) => [t.name, t]));

/** 16 組の正本は production の意味 task manifest。テスト内に別表を持たない。 */
const MATRIX = ADMIN_OPERATION_MANIFEST;

const HUMAN_APPROVAL = MATRIX.filter((task) => task.permission.requiresHumanApproval).map(
  (task) => task.tool,
);
const REVERSIBLE_MUTATIONS = MATRIX.filter(
  (task) => !task.permission.readOnly && !task.permission.requiresHumanApproval,
).map((task) => task.tool);

const SCOPES: readonly CallerScope[] = ["bearer", "same-origin"];

describe("A2 §1 16 組すべてに道具がある", () => {
  it("対象 4 種 × 操作 4 種が重複なく揃う", () => {
    expect(MATRIX).toHaveLength(16);
    expect(new Set(MATRIX.map((task) => task.id)).size).toBe(16);
    expect(new Set(MATRIX.map((task) => `${task.subjectKey}:${task.operation}`))).toEqual(
      new Set(
        ["site", "content", "product", "publication"].flatMap((subject) =>
          ["list", "create", "update", "delete"].map((operation) => `${subject}:${operation}`),
        ),
      ),
    );
  });

  it.each(MATRIX)("$subject の $label は $tool が担う", ({ subject, label, tool }) => {
    expect(byName.has(tool), `${subject} の${label}に対応する道具 ${tool} が目録にありません`).toBe(
      true,
    );
  });

  it("道具の名前が動詞_対象で揃っている", () => {
    // 揃っていないと、AI が名前から役目を推し量れず、目録を全部読む羽目になる。
    const verbs = /^(list|get|create|update|delete|check|filter|schedule|cancel|reschedule|draft)_/;
    const odd = MATRIX.map((m) => m.tool).filter((n) => !verbs.test(n));
    expect(odd, `動詞で始まらない道具: ${odd.join(", ")}`).toEqual([]);
  });
});

describe("A2 §1b 16 組の意味 edge が結線されている", () => {
  it.each(MATRIX)("$id の ui_entry / ui_route / form_action が実在する", (task) => {
    const routeModule = join(process.cwd(), `src/app${task.uiRoute}/page.tsx`);
    const entryModule = join(process.cwd(), task.uiEntry.module);

    expect(existsSync(routeModule), `${task.id}: ui_route ${task.uiRoute} の page.tsx がありません`).toBe(
      true,
    );
    expect(
      ADMIN_ROUTE_METADATA.find((route) => route.id === adminOperationRouteId(task))?.pattern,
      `${task.id}: ui_route が route metadata と一致しません`,
    ).toBe(task.uiRoute);
    expect(existsSync(entryModule), `${task.id}: ui_entry ${task.uiEntry.module} がありません`).toBe(
      true,
    );

    const routeSource = readFileSync(routeModule, "utf8");
    const entrySource = readFileSync(entryModule, "utf8");
    expect(entrySource).toMatch(
      new RegExp(
        `export\\s+(?:default\\s+)?(?:async\\s+)?function\\s+${task.uiEntry.exportName}\\b`,
      ),
    );
    if (task.uiEntry.module !== `src/app${task.uiRoute}/page.tsx`) {
      expect(
        routeSource,
        `${task.id}: ui_route が ui_entry ${task.uiEntry.exportName} を描画していません`,
      ).toMatch(new RegExp(`<${task.uiEntry.exportName}\\b`));
    }
    expect(
      entrySource,
      `${task.id}: ui_entry が意味 task を参照していません`,
    ).toContain(`adminOperation("${task.id}")`);
    expect(adminOperation(task.id)).toBe(task);

    if (task.formAction.kind === "server-action") {
      const actionModule = join(process.cwd(), task.formAction.module);
      expect(
        existsSync(actionModule),
        `${task.id}: form_action ${task.formAction.module} がありません`,
      ).toBe(true);
      const actionSource = readFileSync(actionModule, "utf8");
      expect(actionSource).toMatch(
        new RegExp(`export\\s+async\\s+function\\s+${task.formAction.exportName}\\b`),
      );
      expect(entrySource).toContain(task.formAction.exportName);
    } else {
      expect(entrySource).toContain(task.formAction.expression);
    }
  });

  it.each(MATRIX)("$id の permission が tool catalog の宣言と一致する", (task) => {
    const tool = byName.get(task.tool);
    expect(tool, `${task.tool} が目録にありません`).toBeDefined();
    expect(tool?.readOnly).toBe(task.permission.readOnly);
    expect(tool?.requiresHumanApproval).toBe(task.permission.requiresHumanApproval);
  });
});

describe("A2 §2 人の承認を要する操作は入口から実行できない", () => {
  it.each(HUMAN_APPROVAL)("%s は承認を要すると宣言している", (name) => {
    const tool = byName.get(name);
    expect(tool, `${name} が目録にありません`).toBeDefined();
    expect(tool?.requiresHumanApproval, `${name} は取り消せないので承認が要ります`).toBe(true);
  });

  it.each(HUMAN_APPROVAL)("%s はどの入口からも実行できない", (name) => {
    // 宣言と入口の判定がつながっていることを見る。
    // つながっていないと、宣言は書いてあるだけで誰も止めない。
    const tool = byName.get(name);
    if (!tool) {
      expect.fail(`${name} が目録にありません`);
      return;
    }
    for (const scope of SCOPES) {
      expect(isToolAllowedForScope(tool, scope), `${name} が ${scope} から実行できます`).toBe(false);
    }
  });
});

describe("A2 §3 取り消せる操作に承認を課さない", () => {
  it.each(REVERSIBLE_MUTATIONS)("%s は承認を要さない", (name) => {
    // ここを true にすると、押すたびに承認が挟まり、やがて誰も読まずに通す。
    // 承認が形骸化すると、本当に止めたい削除まで一緒に素通りする。
    const tool = byName.get(name);
    expect(tool, `${name} が目録にありません`).toBeDefined();
    expect(tool?.requiresHumanApproval, `${name} は取り消せるので承認は不要です`).toBe(false);
  });
});

describe("A3 §1 配信状態の参照は読み取りである", () => {
  it("get_content_channel_status が読み取り専用で、ページ内 AI からも引ける", () => {
    // 状態を見るだけの道具が書き込み扱いだと、画面の中の AI から引けなくなる。
    const tool = byName.get("get_content_channel_status");
    expect(tool, "get_content_channel_status が目録にありません").toBeDefined();
    expect(tool?.readOnly).toBe(true);
    if (tool) expect(isToolAllowedForScope(tool, "same-origin")).toBe(true);
  });
});

/*
 * --- §4 を足した理由（2026-08-22）-----------------------------------------
 *
 * A2 の述語は 3 つを要求する。(a) 到達可能な画面上の操作、(b) API、(c) 権限の宣言。
 * §1〜§3 が見ていたのは **(b) と (c) だけ**だった。目録に名前が載っていれば
 * 16 組すべて緑になる。
 *
 * その状態で実測したところ、`cancel_publication` は目録にありながら
 * **押せる場所がどこにも無かった**。配信詳細には「取りやめ・再送は担当者の操作で
 * 行います」と書いてあり、その操作が無い。文だけが先に置かれていた。
 *
 * ㉝ **述語が 3 つある条件を、2 つ見て緑と言ってはいけない。**
 * 見ていない 1 つは「まだ調べていない」ではなく「無い」側へ倒れる。
 */

/**
 * 作成・編集画面へ入る親画面。
 *
 * route ファイルがあるだけでは、人はその画面へ辿り着けない。仕様で決めた
 * 「一覧から作成」「詳細から編集」の入口が、親画面の `href` として実在することを見る。
 * 動的 route は、表示中の識別子を URL 用に変換してから渡すところまでを入口とする。
 */
const FORM_ROUTE_ENTRIES = [
  {
    subject: "記事",
    op: "作成",
    parent: "src/app/admin/content/page.tsx",
    child: "/admin/content/new",
    href: /href\s*=\s*["']\/admin\/content\/new["']/,
  },
  {
    subject: "記事",
    op: "編集",
    parent: "src/app/admin/content/[variant]/page.tsx",
    child: "/admin/content/[variant]/edit",
    href: /href\s*=\s*\{`\/admin\/content\/\$\{encodeURIComponent\(variantId\)\}\/edit`\}/,
  },
  {
    subject: "ブログ",
    op: "編集",
    parent: "src/app/admin/sites/[site]/page.tsx",
    child: "/admin/sites/[site]/edit",
    href: /href\s*=\s*\{`\/admin\/sites\/\$\{encodeURIComponent\(siteSlug\)\}\/edit`\}/,
  },
  {
    subject: "SNS投稿",
    op: "作成",
    parent: "src/app/admin/distribution/page.tsx",
    child: "/admin/distribution/new",
    href: /href\s*=\s*["']\/admin\/distribution\/new["']/,
  },
  {
    subject: "SNS投稿",
    op: "編集",
    parent: "src/app/admin/distribution/[publication]/page.tsx",
    child: "/admin/distribution/[publication]/edit",
    href: /href\s*=\s*\{`\/admin\/distribution\/\$\{encodeURIComponent\(publicationId\)\}\/edit`\}/,
  },
] as const;

describe("A2 §4 16 組すべてに画面上の操作がある", () => {
  it.each(FORM_ROUTE_ENTRIES)(
    "$subject の $op 画面 $child へ $parent から入れる",
    ({ subject, op, parent, child, href }) => {
      const parentSource = readFileSync(join(process.cwd(), parent), "utf8");
      expect(
        parentSource,
        `${subject}の${op}画面 ${child} へ入る href が親画面 ${parent} にありません`,
      ).toMatch(href);
    },
  );
});
