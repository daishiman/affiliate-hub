/**
 * @tier 2
 * @req REQ-P01, REQ-P02, REQ-P03, REQ-P04, REQ-P05
 * @req REQ-P06, REQ-P07, REQ-P08, REQ-P09, REQ-P10, REQ-TH01
 * @req REQ-B01, REQ-B02, REQ-B03, REQ-B04, REQ-B05, REQ-B06
 * @req REQ-B07, REQ-B08, REQ-B09, REQ-B10, REQ-B11, REQ-B12
 * @req REQ-B13, REQ-B14, REQ-B15, REQ-B16, REQ-B17, REQ-B18
 * @req REQ-S01, REQ-S02, REQ-S03, REQ-S04, REQ-S05
 * @req REQ-S06, REQ-S07, REQ-S08, REQ-S09, REQ-S10
 * @types screen-states
 */
import { describe, expect, it, vi } from "vitest";
import { RENDERABLE_ROUTE_CASES, importPathOf, propsOf } from "./route-table";
import { headingLevels, intoDom, renderRoute, textOf } from "../support/render";
import { describeViolations, findA11yViolations } from "../support/a11y";

/**
 * 読み出しが全部だめなときの画面。
 *
 * --- ここで固定したいこと ---
 * 見本データが動いている間、画面はいつも成功した姿しか見せない。
 * ところが公開後に最も多く起きるのは**取れなかったとき**で、そこだけ誰も見ていない。
 * 取れなかったときに白紙や 0 件を出す画面は、利用者から見て「壊れた」と
 * 「そういうものだ」の区別がつかない、最も直しにくい壊れ方になる。
 *
 * そこで、つなぎ目を全部失敗させたうえで全画面を描き、
 * **見出しが残ること・理由の文が出ること・読み上げが壊れないこと**だけを見る。
 * 文言そのものは固定しない（言い回しを直すたびに落ちるテストを増やさないため）。
 *
 * 1 枚ずつ手で書かないのは page-render.test.tsx と同じ理由で、
 * 画面を足した時点で自動的にこの検査へ入るようにするため。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §3-4（画面の 4 状態）
 */

/**
 * つなぎ目を通ったかどうかの記録。
 *
 * 画面のなかには、保存先を一切見ないもの（部品の見本・道具の一覧）がある。
 * それを名前で除外すると、**後から保存先を見るようになっても除外されたまま**になる。
 * 「通ったかどうか」を実際に見て切り替えれば、その取りこぼしが起きない。
 */
const seen = vi.hoisted(() => ({ used: false }));

vi.mock("@/presentation/composition", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const { domainError } = await import("@/domain/shared/errors");
  const { err } = await import("@/domain/shared/result");

  const refusal = () =>
    err(
      domainError("NOT_IMPLEMENTED", "保存先にまだ繋がっていません。", {
        suggestedAction: "接続の設定が済むまで、この一覧は表示できません。",
      }),
    );

  /**
   * 本文ではなく、画面の骨格の脇にだけ出るもの。
   *
   * これも失敗させる（本物を通すと、失敗した骨格を一度も描かないことになる）が、
   * **「本文が保存先を見た」とは数えない。** 数えると、保存先を一切見ない画面
   * （固定文の案内など）まで「取れなかった」扱いになり、
   * 正しく本文が出ているのに「表示できません」を出せと要求してしまう。
   *
   * 骨格の脇が欠けたときに本文が無事であることは、これらの画面が
   * 下の「中身が空では困る」検査を通ることで確かめられる。
   */
  const FRAME_ONLY = new Set(["listBrands"]);

  /** 中身の「実行できるもの」だけを、必ず失敗するものに置き換える。 */
  const degrade = (bundle: unknown): unknown => {
    if (bundle === null || typeof bundle !== "object") return bundle;
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(bundle as Record<string, unknown>)) {
      const hasExecute =
        value !== null &&
        typeof value === "object" &&
        typeof (value as { execute?: unknown }).execute === "function";
      // ブログの設計図だけは本物を通す（下の「読者側の扱い」を見よ）。
      out[key] = hasExecute && key !== "getSite"
        ? {
            ...(value as object),
            execute: async () => {
              if (!FRAME_ONLY.has(key)) seen.used = true;
              return refusal();
            },
          }
        : value;
    }
    return out;
  };

  const patched: Record<string, unknown> = { ...actual };
  for (const [name, value] of Object.entries(actual)) {
    if (typeof value !== "function" || !name.endsWith("UseCases")) continue;
    patched[name] = (...args: unknown[]) => {
      const built = (value as (...a: unknown[]) => unknown)(...args);
      // 受信箱だけは非同期に組み立てる。呼び出し側の書き方に合わせる。
      return built instanceof Promise ? built.then(degrade) : degrade(built);
    };
  }
  return patched;
});

/**
 * 運営側の画面と、読者側の画面。
 *
 * 読者側を長らく外していた（「そのブログが無いときは 404 が正しい応答だから」）。
 * だがそれは**ブログの設計図**が読めないときの話で、
 * 記事・カテゴリー・人・文書・道具が読めないときの話ではない。
 * 外していた間、読者側の 9 本は取り出しが失敗すると
 * 「その記事は存在しません」と読者へ言っていた（`ah-cry` で実測して直した）。
 *
 * 設計図そのものが読めないときは、いまも 404 に潰れる。
 * 画面の骨格（ヘッダー・配色・パンくず）が設計図から作られるためで、
 * ここを直すには骨格に既定値が要る。別の課題として残す。
 * だからこの検査では設計図だけ本物を通す。
 */
const DEGRADED_CASES = RENDERABLE_ROUTE_CASES.filter(
  (r) => r.file.startsWith("admin/") || r.file.startsWith("s/"),
);

const isReader = (file: string): boolean => file.startsWith("s/");

describe("対象の画面", () => {
  it("運営側と読者側の両方が入っている（絞り込みが効かなくなったら気づけるように）", () => {
    expect(DEGRADED_CASES.filter((r) => !isReader(r.file)).length).toBeGreaterThan(10);
    expect(DEGRADED_CASES.filter((r) => isReader(r.file)).length).toBeGreaterThan(10);
  });
});

describe.each(DEGRADED_CASES.map((r) => [r.file, r] as const))(
  "%s（読み出しが全部だめなとき）",
  (_file, route) => {
    it("白紙にならず、見出しと理由が残る", async () => {
      seen.used = false;
      const html = await renderRoute(importPathOf(route.file), propsOf(route));
      const { document, cleanup } = intoDom(html);
      try {
        // 見出しが消えると、読み上げでは「どこにいるのか」が分からなくなる。
        expect(headingLevels(document).filter((l) => l === 1)).toHaveLength(1);
      } finally {
        cleanup();
      }

      const text = textOf(html);
      if (!seen.used) {
        // 保存先を見ない画面（部品の見本など）。それでも中身が空では困る。
        expect(text.length).toBeGreaterThan(100);
        return;
      }

      if (isReader(route.file)) {
        /*
          読者向けの言い方は 1 つに決めてある（`UNAVAILABLE_NOTICE`）。
          運営向けの「保存先に繋がっていません／接続の設定」をそのまま読者へ
          出さないのは、読者にできることが 1 つも無いからである。

          「見つかりませんでした」が出ていないことのほうが本題である。
          ここで**取れなかったことを、無いことにすり替えていない**かを見る。
          すり替えると読者は探すのをやめ、運営は気づけない。
          しかも画面は最後まできれいに見えるので、目視では発見できない。
        */
        expect(text).toContain("表示できません");
        expect(text, "取れなかったものを『無い』と言っています").not.toContain(
          "見つかりませんでした",
        );
        return;
      }

      // 「0 件」と「取れていない」を同じ見た目にしないための一文。
      expect(text).toContain("繋がっていません");
      expect(text).toContain("接続の設定");
    });

    it("読み上げと操作の自動検査に違反がない", async () => {
      const html = await renderRoute(importPathOf(route.file), propsOf(route));
      const violations = await findA11yViolations(html);
      expect(violations, describeViolations(violations)).toEqual([]);
    });
  },
);
