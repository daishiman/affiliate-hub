/** @tier 2 @req REQ-S09 */
import { describe, expect, it } from "vitest";
import { workObjectBoard } from "@/presentation/admin/work-object-board";
import { ADMIN_NAV, ADMIN_NAV_GROUPS, ADMIN_ROUTE_METADATA } from "@/presentation/ui";

/**
 * ホームの「作業の対象物」ボード (受入 A5)。
 *
 * ここで守りたいのは **ホームがサイドバーの写しではなく射影であること**。
 * 写しだと、ルートを 1 本足した日に片方だけ古くなる。
 *
 * 規範: docs/spec/feat-site-scoped-authoring-ia/entry-consolidation-contract.md
 */

describe("workObjectBoard", () => {
  it("対象物は 5 つで、サイドバーの分類とラベルまで一致する", () => {
    const board = workObjectBoard(undefined);
    expect(board.map((g) => g.id)).toEqual(ADMIN_NAV_GROUPS.map((g) => g.id));
    expect(board.map((g) => g.label)).toEqual(ADMIN_NAV_GROUPS.map((g) => g.label));
    expect(board).toHaveLength(5);
  });

  it("入口の顔ぶれがサイドバーと同じ（ホームだけに出る入口を作らない）", () => {
    /*
      ホームに独自の入口を足すと、そこからしか行けない画面が生まれる。
      サイドバーを畳んで使っている人には、その画面が無いのと同じになる。
    */
    const fromBoard = workObjectBoard(undefined).flatMap((g) => g.entries.map((e) => e.href));
    const fromNav = ADMIN_NAV_GROUPS.flatMap((g) => g.hrefs);
    expect([...fromBoard].sort()).toEqual([...fromNav].sort());
  });

  it("見えない入口はホームにも出ない", () => {
    /*
      権限で隠すというのは存在を伏せること。サイドバーで伏せてホームで見せると、
      伏せた意味が無くなる。`visibleNav` と同じ判定を通していることを見る。
    */
    const board = workObjectBoard([]);
    const shown = board.flatMap((g) => g.entries.map((e) => e.href));
    const alwaysVisible = ADMIN_NAV.filter((item) => item.requires === null).map(
      (item) => item.href,
    );
    expect([...shown].sort()).toEqual(
      [...alwaysVisible.filter((href) => ADMIN_NAV_GROUPS.some((g) => g.hrefs.includes(href)))]
        .sort(),
    );
  });

  it("入口が 1 つも残らない対象物は、見出しごと落ちる", () => {
    // 見出しだけ残ると「ここに何かあるが自分には見えない」と伝わる。
    const board = workObjectBoard([]);
    expect(board.filter((g) => g.entries.length === 0)).toEqual([]);
  });

  it("画面の枚数は、入口だけでなくその下の子まで数える", () => {
    /*
      入口の数を出すと、どの対象物も 2〜7 になって厚みの差が消える。
      ここで見せたいのは「この対象物にはこれだけの画面がある」なので、子まで数える。
    */
    const board = workObjectBoard(undefined);
    for (const group of board) {
      expect(group.screenCount, group.id).toBeGreaterThanOrEqual(group.entries.length);
    }
    const blog = board.find((g) => g.id === "blog");
    expect(blog?.screenCount).toBeGreaterThan(blog?.entries.length ?? 0);
  });

  it("同じ画面を 2 つの対象物で数えていない", () => {
    /*
      重複して数えると合計が実在の画面数を超え、
      「93 本を 5 つに畳んだ」という説明そのものが成り立たなくなる。
    */
    const board = workObjectBoard(undefined);
    const counted = board.reduce((sum, g) => sum + g.screenCount, 0);
    expect(counted).toBeLessThanOrEqual(ADMIN_ROUTE_METADATA.length);
  });
});
