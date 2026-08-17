import { afterAll, describe, expect, it, vi } from "vitest";
import { ROUTE_CASES, importPathOf, propsOf } from "./route-table";
import { headingLevels, intoDom, renderRoute, textOf } from "../support/render";
import { describeViolations, findA11yViolations } from "../support/a11y";

/**
 * 何も登録されていないときの画面。
 *
 * --- ここで固定したいこと ---
 * 見本データが入っている間、画面はいつも「中身がある姿」しか見せない。
 * ところが最初に使う人が必ず見るのは**空っぽの状態**で、
 * ここだけ誰も見ていない、ということが起きる。
 *
 * 空の一覧を白紙で出すと、利用者からは
 * 「まだ登録していない」のか「壊れている」のか区別がつかない。
 * だから **見出しが残ること・次に何をすればよいかが書いてあること** を見る。
 *
 * 取れなかったとき（page-degraded）と分けているのは、
 * この 2 つは**同じ見た目にしてはいけない**ものだから。
 * 片方だけ用意して満足すると、必ずもう片方が白紙になる。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §3-4（画面の 4 状態）
 */

/**
 * 差し替えた保存先を何回読んだか。
 *
 * ここが 0 のまま全部緑になる、という失敗の仕方がある。
 * 差し替えが効いていなければ、画面は見本データを出したまま通ってしまい、
 * 「空っぽのときも大丈夫」という保証だけが嘘になる。
 */
const seen = vi.hoisted(() => ({ used: false }));

vi.mock("@/infrastructure/composition", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const { ok } = await import("@/domain/shared/result");

  /**
   * 「1 件も無い」を表す値。
   *
   * 一覧の口は、配列を返すものと `{ items, nextCursor }` などの入れ物を返すものが混在している。
   * どちらの読み方でも空に見える値を 1 つ作れば、口ごとの場合分けが要らない。
   *
   * `values` を明示して空配列で覆っているのは、
   * **配列がもともと `values` という別物（繰り返し用の関数）を持っている**ため。
   * 覆わないと「中身の一覧」を読んだつもりで関数が返り、
   * 画面が「配列ではない」と言って落ちる。ここは踏みやすい。
   */
  const emptyList = () =>
    Object.assign([] as unknown[], {
      items: [],
      values: [],
      rows: [],
      total: 0,
      nextCursor: null,
      unavailableReason: null,
    });

  /** 呼び名から「空っぽの答え」を決める。 */
  const emptyAnswer = (name: string, args: readonly unknown[]): unknown => {
    seen.used = true;
    if (/^(count|total)/.test(name)) return ok(0);
    if (/^(find|get|load|read|resolve)/.test(name)) return ok(null);
    if (/^(list|search|query|recent)/.test(name)) return ok(emptyList());
    if (/^(save|record|publish|emit|put|write)/.test(name)) return ok(args[0] ?? true);
    return ok(emptyList());
  };

  /** 印（Editorial / Commercial）を落とさずに、中身の関数だけ差し替える。 */
  const emptyPort = (port: unknown): unknown => {
    if (port === null || typeof port !== "object") return port;
    const copy = Object.defineProperties({}, Object.getOwnPropertyDescriptors(port));
    for (const [name, value] of Object.entries(port as Record<string, unknown>)) {
      if (typeof value !== "function") continue;
      Object.defineProperty(copy, name, {
        value: async (...args: unknown[]) => emptyAnswer(name, args),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    return copy;
  };

  return {
    ...actual,
    createDeps: () => {
      const real = (actual.createDeps as () => Record<string, unknown>)();
      const out: Record<string, unknown> = {};
      for (const [key, port] of Object.entries(real)) out[key] = emptyPort(port);
      return out;
    },
  };
});

/** 読者側は「そのブログが無い」ときに 404 を返す作りなので、同じ物差しでは測らない。 */
const EMPTY_CASES = ROUTE_CASES.filter((r) => r.file.startsWith("admin/"));

describe("対象の画面", () => {
  it("運営側の画面が並んでいる（絞り込みが効かなくなったら気づけるように）", () => {
    expect(EMPTY_CASES.length).toBeGreaterThan(10);
  });
});

afterAll(() => {
  // 差し替えが効いていたことの裏づけ。何回呼ばれたかは見ない（見ると中身の作りに縛られる）。
  expect(seen.used, "空っぽの保存先が一度も読まれていない（差し替えが効いていない）").toBe(true);
});

describe.each(EMPTY_CASES.map((r) => [r.file, r] as const))(
  "%s（何も登録されていないとき）",
  (_file, route) => {
    it("白紙にならず、見出しと次の一歩が残る", async () => {
      const html = await renderRoute(importPathOf(route.file), propsOf(route));

      const { document, cleanup } = intoDom(html);
      try {
        expect(headingLevels(document).filter((l) => l === 1)).toHaveLength(1);
      } finally {
        cleanup();
      }

      // 空でも、何の画面で次に何ができるかは読み取れる分量が要る。
      expect(textOf(html).length).toBeGreaterThan(100);
    });

    it("読み上げと操作の自動検査に違反がない", async () => {
      const html = await renderRoute(importPathOf(route.file), propsOf(route));
      const violations = await findA11yViolations(html);
      expect(violations, describeViolations(violations)).toEqual([]);
    });
  },
);
