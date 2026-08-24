/**
 * @tier 2
 * @req REQ-UX09
 * @types screen-states, a11y, keyboard
 *
 * A9: サイドバーの全項目にアイコンが付き、アイコンを押すと折りたたみ／展開が
 * 切り替わり、折りたたんでいる間もアイコンで項目を識別できる。
 *
 * 要点は最後の 1 つにある。**畳んだときに読み上げの名前まで消えないこと**。
 * 見える文字を消してアイコンだけ残す作りは、目で見る人には成立するが、
 * 読み上げで使う人には「押せる何かが 19 個並んでいる」だけになる。
 * 見えるものを減らすために、聞こえるものまで減らさない。
 *
 * 見るのは 5 つ。
 *   1. 全項目にアイコンの指定がある
 *   2. 同じアイコンを 2 つの項目に使っていない（畳むと見分けが付かない）
 *   3. 折りたたみの操作点に、押せることと今の状態が出ている
 *   4. 畳んだ状態でも、19 項目すべてのアクセシブル名が残る
 *   5. 子画面にいるとき、親の項目が現在地になる
 *
 * 規範: docs/spec/feat-uiux-overhaul/component-contract.md,
 *       docs/spec/feat-uiux-overhaul/screen-architecture.md
 */
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { ADMIN_NAV } from "@/presentation/ui";
import { AppShell } from "@/presentation/ui/templates/app-shell";
import { focusableOrder, intoDom } from "../support/render";

/**
 * `icon` は `NavItem` の必須フィールドなので、書き忘れは型検査で止まる。
 * ここでは型の存在だけでなく、**全項目に空でない実値が入ること**を見る。
 */
function iconOf(item: (typeof ADMIN_NAV)[number]): string {
  return item.icon;
}

/**
 * Unicode の絵文字を UI に直接置くと、OS ごとに色・線幅・大きさが変わる。
 * 単色ストロークアイコンへ統一したあとに戻らないよう、画面を作る正本を走査する。
 */
const UNICODE_ICON = /[\p{Emoji_Presentation}\p{Extended_Pictographic}\u25a0-\u25ff\u2600-\u27bf]/u;

function typescriptSources(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return typescriptSources(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

function uiSources(): readonly string[] {
  return ["src/app", "src/presentation"].flatMap((directory) =>
    typescriptSources(join(process.cwd(), directory)),
  );
}

/** コメント中の例示は除き、実際に画面へ出せる文字列と JSX だけを検査する。 */
function unicodeIconsIn(path: string): readonly string[] {
  const source = readFileSync(path, "utf8");
  const file = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const offenders: string[] = [];
  const visit = (node: ts.Node) => {
    if ((ts.isStringLiteralLike(node) || ts.isJsxText(node)) && UNICODE_ICON.test(node.text)) {
      offenders.push(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return offenders;
}

/** 折りたたみを含む props。実装で `AppShell` の props に加わる。 */
function shell(extra: Record<string, unknown> = {}): string {
  const props = {
    actualRoutePath: "/admin",
    navContextPath: "/admin",
    breadcrumbs: [{ label: "ホーム" }],
    ...extra,
  } as unknown as Parameters<typeof AppShell>[0];
  return renderToStaticMarkup(<AppShell {...props}>本文</AppShell>);
}

describe("A9 §1 全項目にアイコンがある", () => {
  it.each(ADMIN_NAV.map((i) => [i.label, i] as const))("%s にアイコンがある", (label, item) => {
    const icon = iconOf(item);
    expect(icon, `${label} にアイコンの指定がありません`).toBeTruthy();
  });

  it("同じアイコンを 2 つの項目に使っていない", () => {
    // 畳むとアイコンだけが残る。重なった時点で、その 2 つは見分けが付かない。
    const icons = ADMIN_NAV.map(iconOf).filter((i): i is string => Boolean(i));
    const seen = new Map<string, number>();
    for (const i of icons) seen.set(i, (seen.get(i) ?? 0) + 1);
    const dup = [...seen.entries()].filter(([, n]) => n > 1).map(([i]) => i);
    expect(dup, `重なっているアイコン: ${dup.join(", ")}`).toEqual([]);
  });

  it("文字の絵文字ではなく、単色の SVG アイコンを描画する", () => {
    const { document, cleanup } = intoDom(shell());
    try {
      const nav = document.querySelector('nav[aria-label="主な案内"]');
      expect(nav, "主な案内がありません").not.toBeNull();
      expect(nav?.textContent ?? "", "案内に文字の絵文字が残っています").not.toMatch(UNICODE_ICON);
      expect(nav?.querySelectorAll("a svg").length, "全項目が同じアイコン体系を使っていません").toBe(
        ADMIN_NAV.length,
      );
      expect(
        [...(nav?.querySelectorAll("a svg") ?? [])].every(
          (icon) => icon.getAttribute("aria-hidden") === "true",
        ),
        "隣の項目名と二重に読み上げられるアイコンがあります",
      ).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("今後追加する UI に Unicode の絵文字や手製の絵柄を直接書けない", () => {
    const sources = uiSources();
    expect(sources.length, "UI の走査対象が失われています").toBeGreaterThan(100);
    const offenders = sources.flatMap((path) => {
      const found = unicodeIconsIn(path);
      return found.length > 0
        ? found.map((icon) => `${path.replace(`${process.cwd()}/`, "")}: ${icon}`)
        : [];
    });
    expect(offenders, `Unicode の絵柄が残る UI: ${offenders.join(", ")}`).toEqual([]);
  });
});

describe("A9 §2 折りたたみを操作できる", () => {
  it("操作点に、押せることと今の状態が出ている", () => {
    const html = shell();
    expect(html, "折りたたみの操作点がありません").toMatch(/aria-expanded="(true|false)"/);
    expect(html, "操作点にアクセシブル名がありません").toMatch(
      /aria-(label|labelledby)="[^"]*"[^>]*aria-expanded|aria-expanded[^>]*aria-(label|labelledby)="[^"]*"/,
    );
  });

  it("畳んだ状態と開いた状態で、状態の表示が入れ替わる", () => {
    const open = shell({ navCollapsed: false });
    const closed = shell({ navCollapsed: true });
    expect(open).toContain('aria-expanded="true"');
    expect(closed).toContain('aria-expanded="false"');
  });
});

describe("A9 §3 畳んでも項目を識別できる", () => {
  it("畳んだ状態でも 19 項目すべての名前が残る", () => {
    // ここが本題。文字が消えても、名前は消さない。
    const html = shell({ navCollapsed: true });
    const missing = ADMIN_NAV.filter((item) => !html.includes(item.label)).map((i) => i.label);
    expect(missing, `畳むと名前が消える項目: ${missing.join(", ")}`).toEqual([]);
  });

  it("畳んだ状態でも 19 項目すべてへ行ける", () => {
    const html = shell({ navCollapsed: true });
    const unreachable = ADMIN_NAV.filter((i) => !html.includes(`href="${i.href}"`)).map(
      (i) => i.href,
    );
    expect(unreachable, `畳むと行けなくなる項目: ${unreachable.join(", ")}`).toEqual([]);
  });
});

describe("A9 §5 畳む・開くをキーボードだけでできる", () => {
  /**
   * --- なぜ別に見るのか ---
   *
   * §2 は `aria-expanded` が出ていることしか見ていない。**その属性は
   * `<div>` にも書ける。**読み上げには「折りたたみ、展開済み」と出るのに、
   * Tab では素通りし、Enter でも Space でも何も起きない、という作りが通る。
   * 見た目と読み上げの両方が正しく、操作だけができない状態は、
   * 画面を見ても分からない。
   *
   * --- ここで見ていないこと（正直に書く）---
   *
   * 実際に Tab や Enter を押してはいない。`<button>` であることと
   * `tabindex` に手を入れていないことから、**到達順と押下の効きを推定している**。
   * 既存の `keyboard-operation.test.tsx` と同じ前提に立っている。
   */
  it("折りたたみの操作点が button である", () => {
    const { document, cleanup } = intoDom(shell({ navCollapsed: false }));
    try {
      const toggles = [...document.querySelectorAll("[aria-expanded]")];
      expect(toggles.length, "折りたたみの操作点がありません").toBeGreaterThan(0);
      // `<div aria-expanded>` は読み上げには出るが、Tab でも Enter でも触れない。
      const notButton = toggles
        .filter((el) => el.tagName.toLowerCase() !== "button")
        .map((el) => el.tagName.toLowerCase());
      expect(
        notButton,
        `押せない要素に折りたたみを持たせています: ${notButton.join(", ")}。` +
          `<button> にすると Tab で到達し Enter と Space の両方が効きます`,
      ).toEqual([]);
    } finally {
      cleanup();
    }
  });

  it("畳んだ状態でも 19 項目すべてが Tab の順路に残る", () => {
    const { document, cleanup } = intoDom(shell({ navCollapsed: true }));
    try {
      const order = focusableOrder(document);
      // 0 件だと以下が「外された項目が無い」で緑になる。
      expect(order.length, "辿れる要素が 1 つもありません").toBeGreaterThan(0);
      // 見えなくするために `tabindex="-1"` を足すのが、この要件のいちばんありそうな壊し方。
      const dropped = ADMIN_NAV.filter((item) => {
        const link = document.querySelector(`a[href="${item.href}"]`);
        return link === null || link.getAttribute("tabindex") === "-1";
      }).map((i) => i.label);
      expect(
        dropped,
        `畳むと Tab で辿れなくなる項目: ${dropped.join(", ")}。` +
          `見えるものを減らすために、辿れるものまで減らさないでください`,
      ).toEqual([]);
    } finally {
      cleanup();
    }
  });

  it("移動の順番を手で決めていない", () => {
    const { document, cleanup } = intoDom(shell({ navCollapsed: true }));
    try {
      const withIndex = [...document.querySelectorAll("[tabindex]")];
      expect(
        document.querySelectorAll("a[href],button").length,
        "辿れる要素が 1 つもありません",
      ).toBeGreaterThan(0);
      // 正の `tabindex` は書いてある順と移動する順を切り離す。
      // 項目を 1 つ足すたびに全部ずれるので、足した人以外には直せなくなる。
      const positive = withIndex
        .map((el) => el.getAttribute("tabindex") ?? "")
        .filter((v) => Number(v) > 0);
      expect(positive, `正の tabindex: ${positive.join(", ")}`).toEqual([]);
    } finally {
      cleanup();
    }
  });
});

describe("A9 §4 子画面では親が現在地になる", () => {
  it.each([
    ["/admin/settings/appearance", "/admin/settings"],
    ["/admin/products/new", "/admin/products"],
    ["/admin/content/new", "/admin/content"],
    ["/admin/sites/new", "/admin/sites"],
  ])("%s にいるとき %s が現在地", (current, parent) => {
    // 現在地が消えると、自分がどの分類の中にいるか分からなくなる。
    // サイドバーに載せない画面を作った以上、親が代わりに現在地を示す。
    const html = renderToStaticMarkup(
      <AppShell
        actualRoutePath={current}
        navContextPath={parent}
        breadcrumbs={[{ label: "ホーム" }]}
      >
        本文
      </AppShell>,
    );
    const marked = new RegExp(`href="${parent.replace(/[/[\]]/g, "\\$&")}"[^>]*aria-current="page"`);
    const markedAlt = new RegExp(
      `aria-current="page"[^>]*href="${parent.replace(/[/[\]]/g, "\\$&")}"`,
    );
    expect(
      marked.test(html) || markedAlt.test(html),
      `${current} にいるとき ${parent} が現在地になっていません`,
    ).toBe(true);
  });
});
