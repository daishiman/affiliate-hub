/** @tier 2 @req REQ-S09 @types screen-states */
/*
 * **`@types` について。**元は `has-screen, has-permission` と書いてあったが、
 * どちらも `TEST_TYPES`（`quality-gates.config.mjs`）に無い名前で、
 * `scripts/required-test-types.mjs` が落ちていた（2026-08-21 に直した）。
 *
 * **`permission-matrix` は書かない。**この検査は権限を見ているように読めるが、
 * `permission-matrix` の定義は**「できてはいけない側」**である。ここが見ているのは
 * 逆で、**できるはずの画面が実際に描かれているか**——断りの 1 枚に化けていないか、
 * である。**表記は近いが、向きが反対なので当てると嘘になる。**
 * （`.linkNote` を役C に当てると「表示は合って意味が嘘になる」と書いたのと同じ形。）
 *
 * `screen-states` だけを名乗る。語彙の正本に無い名前を足すかどうかは
 * 仕様 §13 の表を動かす話なので、この検査 1 本の都合では決めない。
 */
import { describe, expect, it } from "vitest";
import { ROUTE_CASES, ROUTE_STATE_CASES, renderCase } from "./route-table";
import { intoDom } from "../support/render";

/**
 * **走査が画面の中身に届いているか**を見る。押しどころは見ない。
 *
 * ==========================================================================
 * なぜ別のファイルなのか
 * ==========================================================================
 *
 * `screen-hit-and-current.test.tsx` は**押しどころ**を見ている。そこへ
 * 「測れていない」を混ぜると、**赤の意味が 2 つになって、どちらが直ったのか
 * 分からなくなる。**測れていないことは押しどころの事実ではない。
 *
 * ==========================================================================
 * この検査が置かれた理由（2026-08-21）
 * ==========================================================================
 *
 * `admin/feedback/page.tsx` の 150 行目に、押しどころの下限を持たないリンクが
 * 在った。**それが走査の赤に出てこなかった。**理由を辿ると、この画面は
 * 走査の中で**一度も描かれていなかった**——描かれていたのは「権限がありません」
 * の 1 枚だけだった。見本の身元（`SAMPLE_ACTOR`）は `analyst` の役しか持たず、
 * `feedback.read` を持っていない。
 *
 * 数えると **69 件中 18 件に断りが混ざり、うち 13 件は画面が丸ごと断りに
 * 置き換わっていた**（`main` の中の `h2` が 0 本、リンクが 1 本だけ）。
 *
 * --- **登録を増やすことは、描く枝を増やすことではない** ---
 *
 * `route-table.ts` は `admin/feedback/page.tsx` について、既定に加えて
 * **状態を 4 つ登録している。**「絞り込みの説明文・件数・空の案内という最も
 * 読まれる部分が一度も描かれない」という理由まで書いてある。
 * **その 5 件は全部、1 文字も違わない同じ断りの画面を描いていた。**
 *
 * 理由が丁寧なほど、次に読む人は「ここは測れている」と読む。
 * **理由の質と、その理由が実現しているかは無関係なのに、読む側は前者から
 * 後者を推定してしまう。**（残課題 141 の 3 例目）
 *
 * --- なぜ「doc に書く」で終わらせないのか ---
 *
 * doc の記述は**いま分かっていることを残すが、戻ったときに教えてくれない。**
 * 権限の設定が変わった日に 13 件がまた黙って断りを描き、押しどころの走査は
 * **緑のまま**通る。**空振りは赤にならない。**だから見張りが要る。
 *
 * --- 判定していないもの ---
 *
 * ここが見ているのは**断りに置き換わっていないこと**だけである。
 * 「その画面の全部の枝が描かれた」ではない。**枝の網羅は別の話で、
 * ここを緑にしても測れていない枝は残る。**
 *
 * 規範: docs/product/traceability.md REQ-S09（権限による表示制御）
 */

/** 断りの画面が使う文言。`ErrorView` の題ではなく、権限側の決まり文句。 */
const DENIED = "権限がありません";

type Case = (typeof ROUTE_STATE_CASES)[number] | (typeof ROUTE_CASES)[number];

function labelOf(route: Case): string {
  return "state" in route && route.state !== undefined
    ? `${route.file} — ${route.state}`
    : route.file;
}

/**
 * 画面の姿を数で表す。**探りとして使ったものを、そのまま見張りにしてある。**
 *
 * 見出しが 0 本でリンクが 1 本、という形は「画面が 1 枚の断りに置き換わった」
 * ときの姿である。中身のある画面はこの形にならない（`h2` が必ず立つ）。
 */
function shapeOf(html: string): { headings: number; links: number; denied: boolean } {
  const { document, cleanup } = intoDom(html);
  try {
    return {
      headings: document.querySelectorAll("h2").length,
      links: document.querySelectorAll("a[href]").length,
      denied: (document.body.textContent ?? "").includes(DENIED),
    };
  } finally {
    cleanup();
  }
}

/**
 * 節の一部が断られたまま描かれている画面。**丸ごとの置き換えとは別に扱う。**
 *
 * 丸ごとは直せる（役を足せば中身が出る）。一部は**直すと別のものが壊れる**
 * ことがあるので、理由を書いて残す。ここに載っていない画面で断りが出たら赤。
 */
const PARTIAL: Record<string, string> = {
  "admin/settings/audit/page.tsx":
    "「操作の記録」の 1 節だけが断られている（`audit.read`）。**この能力を持つ役は " +
    "`owner` と `workspace_admin` の 2 つしかなく、どちらも書き込みを全部持つ。**" +
    "渡すと権限で表示が変わる部分が全部見えてしまい、REQ-S09 の「権限による表示制御」を" +
    "測る側が測れなくなる。2026-08-21 実測: 残り 7 節（h2 15 本 / リンク 23 本）は描けている",
};

const ALL: readonly Case[] = [...ROUTE_CASES, ...ROUTE_STATE_CASES];

describe("走査が、権限の断りではなく画面の中身に届いている", () => {
  it("走査そのものが空振りしていない（母集団の床）", () => {
    expect(ALL.length, "画面の表が空です。ここが 0 でも下の検査は全部緑になります").toBeGreaterThan(
      60,
    );
  });

  it.each(ALL.map((r) => [labelOf(r), r] as const))(
    "%s が、権限の断りに置き換わっていない",
    async (_label, route) => {
      const shape = shapeOf(await renderCase(route));
      const excused = PARTIAL[route.file] !== undefined && shape.headings > 0;
      expect(
        shape.denied && !excused,
        `権限の断りが混ざっています（h2 ${shape.headings} 本 / リンク ${shape.links} 本）。` +
          (shape.headings === 0
            ? "**画面が丸ごと断りの 1 枚に置き換わっています。**走査が見ているのは" +
              "その 1 枚で、画面の中身ではありません。身元の役を " +
              "tests/support/render.tsx の WORLDS へ足すこと——" +
              "**src/infrastructure/identity/sample-actor.ts へ足さないこと。**" +
              "あちらへ足すと、認証がまだ無いまま「誰でもできること」が増えます"
            : "画面は描けていますが、**節の一部が断りに置き換わっています。**" +
              "その節の中は走査に一度も出ていません。役を足して開けるか、" +
              "開けない理由を PARTIAL へ書くこと"),
      ).toBe(false);
    },
    20_000,
  );

  it("一部だけ断られている画面の一覧が、いまも当たっている", async () => {
    // **片方向だけ見ると、もう直った画面が理由つきで居座る。**
    for (const [file, reason] of Object.entries(PARTIAL)) {
      const route = ALL.find((r) => r.file === file);
      expect(route, `${file} が表から消えています`).toBeDefined();
      const shape = shapeOf(await renderCase(route!));
      expect(shape.denied, `${file} はもう断られていません。PARTIAL から外すこと`).toBe(true);
      expect(reason.length, `${file} の理由が空です`).toBeGreaterThan(20);
    }
  }, 20_000);
});
