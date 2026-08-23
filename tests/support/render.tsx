import type { ReactElement } from "react";
import { renderToReadableStream } from "react-dom/server.browser";
import { JSDOM } from "jsdom";
import { vi } from "vitest";

/**
 * 画面と部品を実際に描いて、出てきたものを見る。
 *
 * 型が通ることと、必要なものが出ることは別である。
 * `rel="sponsored"` が消えても、見出しが `<div>` になっても、型は通る。
 * **だから出力そのものを見る。**
 *
 * ここで環境を jsdom に切り替えないのは、テストファイルごとに
 * 実行環境が分かれると「このファイルはどっちで動くのか」を毎回考えることになるため。
 * Node のまま描いて、必要なときだけこの関数の中で DOM を作る。
 *
 * 規範: docs/architecture/testing-architecture.md §8
 */

/**
 * サーバーコンポーネント（`async function`）も描ける描画。
 *
 * Next.js の画面は `async` なことが多く、`renderToStaticMarkup` にそのまま渡すと
 * Promise が描かれて中身が空になる。**空でも例外にならない**ので、
 * 気づかないまま「テストは通っているのに何も確かめていない」状態になりやすい。
 */
export async function renderMarkup(node: ReactElement | Promise<ReactElement>): Promise<string> {
  const resolved = await node;
  // `renderToStaticMarkup` は同期のため、中に `async` の部品が 1 つでもあると
  // 「A component suspended while responding to synchronous input」で落ちる。
  // 画面はほぼすべて中で await するので、流し込み方式でないと 1 枚も描けない。
  const stream = await renderToReadableStream(resolved);
  const html = await new Response(stream).text();
  if (html.trim() === "") {
    throw new Error(
      "描画結果が空です。サーバーコンポーネントを await せずに渡していないか確認してください。",
    );
  }
  return html;
}

/**
 * 画面（`page.tsx`）を経路から読み込んで描く。
 *
 * 1 枚ずつ手で import しない。書くと、画面を足すたびにテストを足す作業が発生し、
 * **足し忘れた画面だけが確認されないまま残る**（抜けるのはいつも新しい画面である）。
 * 経路の一覧から回すことで、画面を足した時点で自動的に検査対象に入る。
 */
export async function renderRoute(
  importPath: string,
  props: Record<string, unknown> = {},
): Promise<string> {
  const mod = (await import(/* @vite-ignore */ importPath)) as {
    default?: (p: unknown) => ReactElement | Promise<ReactElement>;
  };
  if (typeof mod.default !== "function") {
    throw new Error(`${importPath} が画面を既定の書き出しとして持っていません。`);
  }
  return renderMarkup(mod.default(props));
}

/**
 * 画面を描く前に置き換えておく「前提」の名前。
 *
 * **なぜ表に置けない情報を名前で持つのか。**
 * `route-table.ts` は入力の値（`params` / `searchParams`）しか持てない。
 * ところが画面の分岐は値だけで決まらず、**ログインしているか**・**設定が済んでいるか**
 * のように、画面の外にあるものを見て決まるものがある。
 * この種の状態は、URL をどう組んでも再現できない。
 *
 * その結果どうなるか。ルート表に載っている画面でも、**描かれるのはいつも同じ 1 本の枝**
 * になる。走査は「違反 0 件」を返して緑で通るので、**測れていないことに誰も気づかない**。
 * 実際に `/signin` のログアウトボタンがそうだった（残課題 141）。
 *
 * 置き換え方そのものを表に書かないのは、表を vitest から切り離しておくため。
 * **表は名前だけを言い、置き換え方はここが持つ。**
 */
export type RouteWorld = "signed-in" | "auth-configured" | "authorized" | "no-audience";

/**
 * 前提ごとの置き換え。
 *
 * **`vi.mock` ではなく `vi.doMock` を使う。**前者はファイルの先頭へ巻き上げられるので
 * 「この 1 件だけ差し替える」ができない。後者は呼んだ時点から効くが、
 * **すでに読み込み済みの版が残っていると効かない**ので、前後で `vi.resetModules()` が要る。
 *
 * 置き換えの深さは、**画面がその値を受け取る口のいちばん近く**にしてある。
 * `signedInActor()` の本物は合言葉 → 保存先 → 権限の 3 段を通るが、
 * そこまで偽物にすると「認証が通ること」を測っていることになり、
 * ここで見たい「その枝が描けること」から離れる。
 * **だからここが確かめているのは、認証の成立ではなく描画の到達である。**
 */
const WORLDS: Record<RouteWorld, () => void> = {
  /** ログインできている人として描く。身元は見本のものをそのまま使う（値を手で作らない）。 */
  "signed-in": () => {
    vi.doMock("@/presentation/composition", async (importOriginal) => {
      const actual = await importOriginal<Record<string, unknown>>();
      const { SAMPLE_ACTOR } = await import("@/infrastructure/identity/sample-actor");
      return { ...actual, signedInActor: async () => SAMPLE_ACTOR };
    });
  },
  /**
   * **運営画面を、それを見る役の人として描く。**
   *
   * --- なぜ要るのか（2026-08-21 の実測）---
   *
   * 見本の身元は `analyst` の役しか持たない。ところが運営画面の 13 枚は
   * `feedback.read` / `product.read` などを要求するので、走査は**画面ではなく
   * 「権限がありません」の 1 枚**を描いていた。`main` の中の `h2` が 0 本、
   * リンクが 1 本だけの姿である。**それでも例外にならないので、走査は緑で通る。**
   *
   * --- **なぜ `sample-actor.ts` に足さないのか（ここが肝）** ---
   *
   * 見本の身元は 2026-08-18 に**書き込みの役を全部外してある**。認証がまだ無く、
   * 管理画面の入口は誰でも開けるためで、経緯は `docs/product/open-doors.md`。
   *
   * そして `permissions.ts` を数えると、**`feedback.read` を持つ役は
   * `feedback_admin` / `owner` / `workspace_admin` の 3 つしかなく、
   * どれも `integration_key.manage` を一緒に持つ。**`product.read` も同じで、
   * 必ず `product.write` か `evidence.write` が付いてくる。
   * **読むためだけの役が存在しない。**
   *
   * つまり見本の身元にこの 13 枚を開かせると、**その瞬間に「アドレスを知って
   * いる人なら誰でも鍵を発行できる」状態が戻る。**2026-08-18 に外したものが
   * そのまま戻ることになる。だから**製品側ではなくここで**足す。
   *
   * --- 役を名指しで並べてある理由 ---
   *
   * `owner` 1 つで済むが、それだと**権限で表示が変わる部分が全部見えてしまい**、
   * 「権限による表示制御」（REQ-S09）を測る側が測れなくなる。
   * 必要なものだけを名前で並べ、足すときは**なぜその画面に要るのか**を書くこと。
   */
  authorized: () => {
    vi.doMock("@/presentation/composition", async (importOriginal) => {
      const actual = await importOriginal<Record<string, unknown>>();
      const { SAMPLE_ACTOR } = await import("@/infrastructure/identity/sample-actor");
      const actor = {
        ...SAMPLE_ACTOR,
        roles: [
          // 見本が元から持っている（記事・数字・成果の読み取り）。
          "analyst",
          // 改善要望の 9 枚と、外部連携の鍵の画面。
          "feedback_admin",
          // 商品・裏づけの画面（`product.read` は単独では取れない）。
          "researcher",
          // 記事の生成と、ブログの下書き作成。
          "writer",
          // ブログの設定と配信の予定表。
          "brand_manager",
        ],
      };
      return {
        ...actual,
        currentActor: async () => actor,
        signedInActor: async () => actor,
      };
    });
  },
  /**
   * ログインの設定が済んでいる状態で描く。
   *
   * 値は `readAuthConfig` に通して作る。手で組み立てると、設定の形が増えたときに
   * ここだけ古い形のまま残り、型が通るぶん気づけない。
   * 中身は `example-` で始まる架空の値で、秘密の走査（`secrets-not-in-repo`）にも当たらない。
   */
  "auth-configured": () => {
    vi.doMock("@/infrastructure/identity/better-auth", async (importOriginal) => {
      const actual = await importOriginal<Record<string, unknown>>();
      const readAuthConfig = actual.readAuthConfig as (
        env: Readonly<Record<string, unknown>>,
      ) => unknown;
      const ready = readAuthConfig({
        BETTER_AUTH_URL: "https://example.invalid",
        BETTER_AUTH_SECRET: "example-not-a-real-value",
        GOOGLE_CLIENT_ID: "example-not-a-real-value",
        GOOGLE_CLIENT_SECRET: "example-not-a-real-value",
        AUTH_ALLOWED_EMAILS: "someone@example.invalid",
      });
      return { ...actual, authAvailability: async () => ready };
    });
  },
  /**
   * **読者像が 1 つも登録されていない状態で描く。**（2026-08-21、UX-14）
   *
   * --- なぜ要るのか ---
   *
   * `admin/content/matrix/page.tsx:164` の `EmptyView`（「読者像が 1 つも
   * 登録されていません」）は、**書かれてから一度も描かれたことが無かった。**
   * 見本の企画は 1 本きりで、`content-editorial-sample-repository.ts:221` が
   * `audiencePersonaIds: AUDIENCES.map(a => a.id)` と全部入れているため、
   * `?axis=audience` を渡しても行は必ず埋まる。**URL では作れない。**
   *
   * 上の 3 つの世界（身元を差し替えるもの）では届かない。**枝が通らない理由が
   * 身元ではなく見本データの側にある**ためで、`docs/product/ui-ux-tasks.md` の
   * 「14 つ目の形：分岐は在るが、一度も通っていない」の 3 例目がこれである。
   *
   * --- **結果を偽装していない。企画を 1 か所だけ空にしている** ---
   *
   * `getMatrix` の戻りを `rows: []` に差し替えるほうが短いが、**それでは
   * 「分岐が通ること」しか測れない。**本物の `rowIdsFor` が本物の企画を見て
   * 0 行になるところまで測りたいので、差し替えるのは
   * `packages.findById` が返す企画の `audiencePersonaIds` **1 フィールドだけ**である。
   * 残りは見本のまま通る。`route-table.ts` の「値を手で作らない」と同じ理由——
   * 手で作った空は、**実際には起きない空**かもしれない。
   *
   * --- 置き換えの深さ ---
   *
   * ここだけ `@/presentation/composition` ではなく usecase のファイルを差し替えている。
   * 口（`generationMatrixUseCases`）が中で `createDeps` を呼んで保存先を組むので、
   * **外から `packages` だけを渡す隙間が無い**ため。組み立てる関数を包めば、
   * 本物の deps がそのまま入ってきて 1 枚だけ被せられる。
   */
  "no-audience": () => {
    vi.doMock("@/application/usecases/authoring/plan-generation-matrix", async (importOriginal) => {
      const actual = await importOriginal<Record<string, unknown>>();
      const create = actual.createGetGenerationMatrixUseCase as (
        deps: Record<string, unknown>,
      ) => unknown;
      return {
        ...actual,
        createGetGenerationMatrixUseCase: (deps: Record<string, unknown>) => {
          const packages = deps.packages as {
            readonly findById: (...args: readonly unknown[]) => Promise<unknown>;
          };
          return create({
            ...deps,
            packages: {
              ...packages,
              findById: async (...args: readonly unknown[]) => {
                const found = (await packages.findById(...args)) as {
                  ok: boolean;
                  value?: Record<string, unknown> | null;
                };
                // 失敗と「企画が無い」はそのまま通す。**空にするのは在る企画だけ。**
                // ここで null を作ると、測りたい `EmptyView` ではなく
                // 「企画が見つかりません」の側が描かれる。
                if (!found.ok || found.value === null || found.value === undefined) return found;
                return { ok: true, value: { ...found.value, audiencePersonaIds: [] } };
              },
            },
          });
        },
      };
    });
  },
};

/**
 * 前提を置き換えてから画面を描く。
 *
 * **後始末まで含めて 1 つの関数にしてある。**置き換えっぱなしにすると、
 * 同じファイルの後ろのテストが「ログインしている世界」で描かれ続け、
 * しかも**赤にならない**（描けてしまうので）。気づく手がかりが結果の中に無い形なので、
 * 呼ぶ側の規律に任せず、ここで必ず戻す。
 */
export async function renderRouteIn(
  world: RouteWorld,
  importPath: string,
  props: Record<string, unknown> = {},
): Promise<string> {
  vi.resetModules();
  WORLDS[world]();
  try {
    return await renderRoute(importPath, props);
  } finally {
    vi.doUnmock("@/presentation/composition");
    vi.doUnmock("@/infrastructure/identity/better-auth");
    // **世界を足したら、ここにも足すこと。**外し忘れは赤にならない
    // ——同じファイルの後ろのテストがその世界のまま描かれ、しかも描けてしまう。
    vi.doUnmock("@/application/usecases/authoring/plan-generation-matrix");
    vi.resetModules();
  }
}

/** 描いた結果を DOM にする。要素を役割（role）や見出しで探すときに使う。 */
export async function renderDom(
  node: ReactElement | Promise<ReactElement>,
): Promise<{ document: Document; html: string; cleanup: () => void }> {
  const html = await renderMarkup(node);
  return { ...intoDom(html), html };
}

/** すでに文字列になっている HTML を DOM にする。 */
export function intoDom(html: string): { document: Document; cleanup: () => void } {
  const dom = new JSDOM(`<!doctype html><html lang="ja"><body>${html}</body></html>`);
  return {
    document: dom.window.document as unknown as Document,
    cleanup: () => dom.window.close(),
  };
}

/**
 * 文字だけを取り出す。
 *
 * 「この文言が出ているか」を HTML 文字列に対する `toContain` で見ると、
 * 属性値や class 名にたまたま同じ文字列があるだけで通ってしまう。
 */
export function textOf(html: string): string {
  const { document, cleanup } = intoDom(html);
  const text = document.body.textContent ?? "";
  cleanup();
  return text.replace(/\s+/g, " ").trim();
}

/**
 * キーボードだけで辿れる要素を、出てくる順に返す。
 *
 * マウスで押せることは確かめやすく、キーボードで辿れることは確かめにくい。
 * **確かめにくいほうが壊れる**ので、こちらを機械で見る。
 */
export function focusableOrder(document: Document): readonly string[] {
  const selector = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled]):not([type=hidden])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");
  // `<label for="…">` は入力欄の**正式な名前**であり、読み上げもこれを読む。
  // ここで拾わないと、正しく名前の付いた欄まで「名前が無い」と見えてしまう。
  // id は React の `useId()` が作るため記号を含む。属性セレクタで引くと
  // 書き方によっては壊れるので、先に一覧を作って引き当てる。
  const byFor = new Map<string, string>();
  for (const label of document.querySelectorAll("label[for]")) {
    const target = label.getAttribute("for");
    if (target !== null) byFor.set(target, label.textContent?.trim() ?? "");
  }

  return [...document.querySelectorAll(selector)].map((el) => {
    // 空文字を「名前がある」と見なさない。`??` だけだと入力欄が必ず無名になる。
    const label =
      [
        el.getAttribute("aria-label"),
        byFor.get(el.getAttribute("id") ?? ""),
        el.closest("label")?.textContent?.trim(),
        el.textContent?.trim(),
        el.getAttribute("name"),
      ].find((candidate) => candidate !== null && candidate !== undefined && candidate !== "") ??
      el.tagName.toLowerCase();
    return `${el.tagName.toLowerCase()}:${label.slice(0, 40)}`;
  });
}

/** 見出しの階層を上から順に返す。飛び級（h2 の次が h4）を見つけるのに使う。 */
export function headingLevels(document: Document): readonly number[] {
  return [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((el) =>
    Number(el.tagName.slice(1)),
  );
}
