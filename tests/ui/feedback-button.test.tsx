/**
 * @tier 2
 * @req REQ-FB02, REQ-FB03, REQ-FB04
 * @types screen-states, a11y, keyboard, permission-matrix
 */
// @vitest-environment jsdom
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BRAND_THEMES, COLOR_MODES } from "@/domain/authoring/site-blueprint";
import { capabilitiesOf } from "@/domain/identity";
import type { Role } from "@/domain/shared";
import { appearanceAttributes } from "@/presentation/ui/appearance";
import { UI_COPY } from "@/presentation/ui/copy";
import {
  FeedbackButton,
  type FeedbackSubmission,
} from "@/presentation/ui/patterns/feedback-button";
import { describeViolations, findA11yViolations } from "../support/a11y";

/**
 * 改善したいことを送るボタン。
 *
 * --- ここで固定したいこと ---
 *
 * 1. **権限を持たない人には何も出ない。** 出しておいて押したら断る、にしない。
 * 2. **文章だけで必ず送れる。** 画面の写しを撮れない環境は普通にある。
 *    撮れないことを理由に送れなくすると、そこで諦められる。
 * 3. **何が一緒に送られるかを、送る前に見せている。**——文だけでなく、
 *    いま何件控えているかの数まで出す。0 件のときと 12 件のときが同じ文だと、
 *    控えが働いているかどうかが本人に分からない。
 * 4. 送ったあとに、送れたことが分かる。
 * 5. **控えると言ったものが、実際に送られている。**添える形が在ることと、
 *    添える中身が在ることは別で、**型が見るのは前者だけである**
 *    （現に `failedRequests: []` が直書きのまま型も検査も通っていた）。
 * 6. **入力欄に打った文字は、控えのどこにも入らない。**控えは指示文へ添えられ、
 *    そのまま作業する側へ渡る。ここが漏れると、要望を送るほど秘密が出ていく。
 *
 * 3〜6 は文言や中身が消えても型は通る。だから出力を見る。
 */

afterEach(cleanup);

function submissions(): {
  readonly calls: FeedbackSubmission[];
  readonly onSubmit: (s: FeedbackSubmission) => Promise<{ message: string }>;
} {
  const calls: FeedbackSubmission[] = [];
  return {
    calls,
    onSubmit: async (s) => {
      calls.push(s);
      return { message: UI_COPY.feedback.sent };
    },
  };
}

function mount(canSubmit = true) {
  const { calls, onSubmit } = submissions();
  render(
    <FeedbackButton screenName="順位表" route="/admin/rankings" canSubmit={canSubmit} onSubmit={onSubmit} />,
  );
  return calls;
}

function openDialog(): void {
  fireEvent.click(screen.getByRole("button", { name: UI_COPY.feedback.openButton }));
}

it("見本帳では固定ボタンと重ならない inline 配置を選べる", () => {
  const { onSubmit } = submissions();
  render(
    <FeedbackButton
      screenName="部品の見本帳"
      route="/admin/ui-catalog"
      canSubmit
      placement="inline"
      onSubmit={onSubmit}
    />,
  );

  expect(screen.getByRole("button", { name: UI_COPY.feedback.openButton }).className).toContain(
    "feedbackLauncherInline",
  );
});

/**
 * 押した瞬間に撮る経路と、画面で起きたことの控え。
 *
 * --- ここで固定したいこと ---
 *
 * **撮影を始めるのは launcher の `onClick` である。**ブラウザは画面の共有を
 * 「押した勢いが残っているあいだ」しか許さない（transient activation）。
 * 開いてから `useEffect` で呼ぶ形へ書き換えると、**型も検査も通ったまま、
 * 実機でだけ許可の窓が出なくなる。** jsdom には勢いの概念が無いので、
 * ここで見られるのは「押した時点で呼ばれていること」までである。
 * それを見ておくと、書き換えたときに少なくとも呼び出し位置の移動には当たる。
 */
describe("押した瞬間に、画面の写しを撮りにいく", () => {
  function stubDisplayMedia(): { readonly calls: number[] } {
    const calls: number[] = [];
    vi.stubGlobal("navigator", {
      ...window.navigator,
      mediaDevices: {
        getDisplayMedia: async () => {
          calls.push(1);
          // 実際の映像は作れない。呼ばれたことだけを見て、あとは撮れなかった扱いにする。
          throw new Error("この環境では映像を作れません");
        },
      },
    });
    return { calls };
  }

  it("ボタンを押すと、撮影を始める（開いてから待たない）", () => {
    const { calls } = stubDisplayMedia();
    mount();
    openDialog();
    expect(calls.length, "開いた時点で撮影が始まっていません").toBe(1);
    vi.unstubAllGlobals();
  });

  /*
    **押しただけで断りの文を出さない。**写しを付けるつもりの無い人にまで
    「失敗した」と読める。撮り直しのボタンから撮ったときは出す（下の別の it）。
  */
  it("撮れなくても、断りの文は出さない", async () => {
    stubDisplayMedia();
    mount();
    openDialog();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: UI_COPY.feedback.submit })).not.toBeNull(),
    );
    expect(screen.queryByText(UI_COPY.feedback.captureUnavailable)).toBeNull();
    vi.unstubAllGlobals();
  });
});

describe("画面で起きたことが、実際に送られる", () => {
  /*
    **ここが空のままだった。**`failedRequests: []` が直書きされていて、
    型も検査も通っていた。**「渡す形が在ること」と「渡す中身が在ること」は別で、
    型が見るのは前者だけである。**だから中身を見る。

    送信画面の文（`disclosureBody`）は前から「エラーの記録・直前の操作を
    一緒に送ります」と言っていた。**言っていたほうが正しく、実物が空だった。**
  */
  it("失敗した通信が、送る中身に入っている", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 500 })),
    );
    const calls = mount();
    // ボタンが出た時点から控えている。**開く前に起きたことこそ渡したい。**
    await window.fetch("https://example.test/api/save?token=abc123");
    openDialog();
    fireEvent.change(screen.getByLabelText(UI_COPY.feedback.bodyLabel), {
      target: { value: "保存できません。" },
    });
    fireEvent.click(screen.getByRole("button", { name: UI_COPY.feedback.submit }));
    await waitFor(() => expect(calls).toHaveLength(1));

    const sent = calls[0]?.technical.failedRequests ?? [];
    expect(sent.join("\n"), "失敗した通信が 1 件も入っていません").toContain("500");
    // **クエリは落ちている。**指示文はそのまま作業する側へ渡る。
    expect(sent.join("\n")).not.toContain("abc123");
    vi.unstubAllGlobals();
  });

  /*
    **押したものは、画面を開いたことの後ろに並ぶ。**押した操作だけだと
    「どこで」が本文頼みになるので、開いた 1 行を必ず先頭に置いている。
  */
  it("直前に押したものが、画面の名前の後ろに並ぶ", async () => {
    const calls = mount();
    openDialog();
    fireEvent.change(screen.getByLabelText(UI_COPY.feedback.bodyLabel), {
      target: { value: "押しても何も起きません。" },
    });
    fireEvent.click(screen.getByRole("button", { name: UI_COPY.feedback.submit }));
    await waitFor(() => expect(calls).toHaveLength(1));

    const actions = calls[0]?.technical.recentActions ?? [];
    expect(actions[0]).toBe("順位表 を開いた");
    expect(actions.join("\n"), "押したものが 1 件も控えられていません").toContain(
      "ボタンを操作した",
    );
    expect(actions.join("\n")).not.toContain(UI_COPY.feedback.openButton);
  });

  /*
    **入力欄に打った文字は送らない。**控えは指示文へ添えられ、そのまま作業する
    側へ渡る。ここが漏れると、要望を送るほど秘密が出ていく仕組みになる。
  */
  it("入力欄に打った文字は、送る中身のどこにも入らない", async () => {
    const calls = mount();
    openDialog();
    const secret = "ひみつの合言葉";
    // 呼び名に手引きの一文が続くので、頭で当てる（丸ごと一致では見つからない）。
    fireEvent.change(screen.getByLabelText(new RegExp(UI_COPY.feedback.wishLabel)), {
      target: { value: secret },
    });
    fireEvent.change(screen.getByLabelText(UI_COPY.feedback.bodyLabel), {
      target: { value: "使いにくいです。" },
    });
    fireEvent.click(screen.getByRole("button", { name: UI_COPY.feedback.submit }));
    await waitFor(() => expect(calls).toHaveLength(1));

    // **`wish` には入る**（本人が書いて送っているもの）。控えのほうに入らない。
    expect(calls[0]?.wish).toBe(secret);
    expect(JSON.stringify(calls[0]?.technical)).not.toContain(secret);
  });

  /*
    **数を出す。**「送ります」とだけ書いてあると、0 件のときも 12 件のときも
    同じ文になり、控えが働いているかどうかが本人に分からない。
  */
  it("いま何件控えているかを、送る前に見せている", () => {
    mount();
    openDialog();
    expect(screen.getByText(new RegExp(UI_COPY.feedback.disclosureCounts))).not.toBeNull();
  });

  it("開いた後に増えた診断件数も、送信前表示へすぐ反映する", async () => {
    mount();
    openDialog();
    expect(screen.getByText(/エラー 0 件/)).not.toBeNull();

    window.dispatchEvent(
      new ErrorEvent("error", { message: "token=abc123", error: new TypeError("token=abc123") }),
    );

    await waitFor(() => expect(screen.getByText(/エラー 1 件/)).not.toBeNull());
  });

  it("画面 URL のクエリと断片は送らない", async () => {
    window.history.pushState({}, "", "/admin/rankings?token=abc123#private");
    const calls = mount();
    openDialog();
    fireEvent.change(screen.getByLabelText(UI_COPY.feedback.bodyLabel), {
      target: { value: "URL に秘密が混ざっています。" },
    });
    fireEvent.click(screen.getByRole("button", { name: UI_COPY.feedback.submit }));
    await waitFor(() => expect(calls).toHaveLength(1));

    expect(calls[0]?.origin.url).toBe(`${window.location.origin}/admin/rankings`);
    expect(calls[0]?.technical.redactedCount).toBeGreaterThan(0);
    window.history.pushState({}, "", "/");
  });
});

describe("出す・出さない", () => {
  it("権限が無い人には、ボタンごと出ない", () => {
    mount(false);
    expect(screen.queryByRole("button", { name: UI_COPY.feedback.openButton })).toBeNull();
  });

  it("権限がある人には、押せるボタンが出る", () => {
    mount(true);
    expect(screen.getByRole("button", { name: UI_COPY.feedback.openButton })).not.toBeNull();
  });
});

/**
 * 役割 × 出す／出さない を、全部の役割で埋める。
 *
 * 上の 2 件は `canSubmit` を真偽で直に渡していて、
 * **どの役割が真になるのかには何も触れていない。** 権限で困るのはそちら側で、
 * 役割を 1 つ足した日に「送れるはずの人に出ない」「送れない人に出る」が生まれる。
 *
 * 行の抜けは型で止める。`Record<Role, boolean>` にしてあるので、
 * `Role` に 1 つ足した時点で**この表が埋まるまで型検査が通らない**。
 * 期待値そのものは権限表から作るのではなく手で書く。
 * 権限表から作ると、権限表が壊れたときに期待値も一緒に壊れて緑のままになる。
 */
describe("役割ごとの出す・出さない", () => {
  const EXPECTED: Record<Role, boolean> = {
    owner: true,
    workspace_admin: true,
    brand_manager: true,
    researcher: false,
    writer: false,
    reviewer: false,
    publisher: false,
    analyst: false,
    contributor: false,
    feedback_admin: true,
    // 取りに来る側は読むところまで。送る側には回さない。
    ai_service_account: false,
  };

  for (const [role, expected] of Object.entries(EXPECTED) as [Role, boolean][]) {
    it(`${role}: ${expected ? "出る" : "出ない"}`, () => {
      const capabilities = capabilitiesOf([role]);
      expect(
        capabilities.has("feedback.submit"),
        `${role} の権限表と、この表の期待値がずれています`,
      ).toBe(expected);

      cleanup();
      mount(capabilities.has("feedback.submit"));
      const button = screen.queryByRole("button", { name: UI_COPY.feedback.openButton });
      expect(button === null, `${role} への出し方が期待と逆です`).toBe(!expected);
    });
  }

  it("役割から出し分けているのは 1 箇所だけ", () => {
    // 出し分けを画面ごとに書けるようになった瞬間、書き忘れた画面の不満が消える。
    // ここは「無い」ではなく「これだけ」を固定している。
    // 見るのは「権限を持っているか」を出し分けへ変換している場所だけ。
    // 権限名そのものは、権限表・使い道・記録の名前としても現れる。
    const hits = execSync(
      String.raw`git grep -l 'canSubmit' -- src || true`,
      { cwd: process.cwd(), encoding: "utf8" },
    )
      .split("\n")
      .filter(Boolean)
      .filter((path) => /includes\("feedback\.submit"\)/.test(readFileSync(path, "utf8")))
      .sort();
    expect(hits).toEqual(["src/presentation/admin/admin-shell.tsx"]);
  });
});

describe("送る", () => {
  it("いま開いている画面の名前が、書かせずに入っている", () => {
    mount();
    openDialog();
    // 画面名を人に書かせると表記がばらつき、あとで同じ画面の要望をまとめられない。
    expect(screen.getByText(/順位表/)).not.toBeNull();
  });

  it("何が一緒に送られるかを、送る前に出している", () => {
    mount();
    openDialog();
    expect(screen.getByText(UI_COPY.feedback.disclosureBody)).not.toBeNull();
  });

  it("画像を付けなくても送れて、そのとき capture は空になる", async () => {
    const calls = mount();
    openDialog();
    fireEvent.change(screen.getByLabelText(UI_COPY.feedback.bodyLabel), {
      target: { value: "並び替えが効いているか分かりません。" },
    });
    fireEvent.click(screen.getByRole("button", { name: UI_COPY.feedback.submit }));

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]?.body).toBe("並び替えが効いているか分かりません。");
    expect(calls[0]?.capture).toBeNull();
    expect(calls[0]?.origin.screenName).toBe("順位表");
    // 送れたことを画面で伝える。無言で閉じると、送れたのか分からない。
    await waitFor(() => expect(screen.getByText(UI_COPY.feedback.sent)).not.toBeNull());
  });

  it("「どうなってほしいか」は空のままでも送れる", async () => {
    const calls = mount();
    openDialog();
    fireEvent.change(screen.getByLabelText(UI_COPY.feedback.bodyLabel), {
      target: { value: "受信箱が白いままです。" },
    });
    fireEvent.click(screen.getByRole("button", { name: UI_COPY.feedback.submit }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]?.wish).toBe("");
  });

  it("改善したいことが空なら送らず、何を書けばよいか伝える", () => {
    const calls = mount();
    openDialog();
    fireEvent.click(screen.getByRole("button", { name: UI_COPY.feedback.submit }));
    expect(calls).toHaveLength(0);
    expect(screen.getByText(/「改善したいこと」を書いてください。/)).not.toBeNull();
  });

  /*
    **押した瞬間に撮る側では、この案内を出さない。**押しただけで断りの文が出ると、
    写しを付けるつもりの無い人にまで「失敗した」と読める。ここが見ているのは
    **本人が「撮り直す」を押した**場合で、そのときは黙って何も起きないほうが困る。

    `await` が要るのは、撮影が `captureScreen` の中で 1 拍おいて返るようになった
    ため（押した勢いを保つために、撮影を launcher の `onClick` へ出した副作用）。
    **出ないことと、まだ出ていないことは違う。**待たずに見ると前者に化ける。
  */
  it("写しを撮れない環境では、断ったうえで文章の道を残す", async () => {
    // `getDisplayMedia` を持たない環境（古い端末・許可されていない場面）を作る。
    vi.stubGlobal("navigator", { ...window.navigator, mediaDevices: {} });
    mount();
    openDialog();
    fireEvent.click(screen.getByRole("button", { name: UI_COPY.feedback.captureTake }));
    await waitFor(() =>
      expect(screen.getByText(UI_COPY.feedback.captureUnavailable)).not.toBeNull(),
    );
    // 送るボタンは生きたまま。撮れないことは送れないことではない。
    expect(screen.getByRole("button", { name: UI_COPY.feedback.submit }).hasAttribute("disabled")).toBe(
      false,
    );
    vi.unstubAllGlobals();
  });
});

/**
 * キーボードだけで開いて閉じられるか。
 *
 * 全画面を回す `tests/ui/keyboard-operation.test.tsx` は
 * 「書いてある順・`tabindex`・要素の種類」しか見ていない（あちらの冒頭に書いてある）。
 * **押した結果どうなるかは、そちらの作りでは原理的に出ない。**
 * 重ねて出す部品はまさにそこが壊れるので、押した結果はここで見る。
 *
 * 重ねた中に閉じ込められること自体は、閉じる道があって初めて許される。
 * だから Esc と Tab の回り込みは、片方だけ通っても意味が無い対で見る。
 */
describe("キーボードだけで操作できる", () => {
  it("Esc で閉じる（重ねたものに、マウス以外の降り口がある）", () => {
    mount();
    openDialog();
    expect(screen.queryByRole("dialog")).not.toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("開いた時点で、居場所が重ねた中へ移る", () => {
    mount();
    openDialog();
    const panel = screen.getByRole("dialog");
    expect(panel.contains(document.activeElement)).toBe(true);
  });

  it("Tab は端で回り込み、後ろの画面へ抜けない", () => {
    mount();
    openDialog();
    const panel = screen.getByRole("dialog");
    const items = [...panel.querySelectorAll<HTMLElement>("a[href], button, input, select, textarea")];
    expect(items.length).toBeGreaterThan(1);
    const first = items[0];
    const last = items[items.length - 1];

    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement, "最後から次へ進むと先頭へ戻る").toBe(first);

    first.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement, "先頭から戻ると末尾へ回る").toBe(last);
  });

  it("途中の移動には手を出さない（順番を部品が決め直さない）", () => {
    mount();
    openDialog();
    const panel = screen.getByRole("dialog");
    const items = [...panel.querySelectorAll<HTMLElement>("a[href], button, input, select, textarea")];
    // 端でないところで Tab を押しても、居場所を動かさない（素の移動に任せる）。
    items[1].focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(items[1]);
  });
});

describe("読み上げと配色", () => {
  it("開いた状態に、機械で分かる読み上げの問題が無い", async () => {
    mount();
    openDialog();
    const violations = await findA11yViolations(
      `<main><h1>順位表</h1>${document.body.innerHTML}</main>`,
    );
    expect(describeViolations(violations)).toBe("");
  });

  it("配色 5 種 × 明暗 3 種のどれでも、同じ中身が出る", () => {
    // 見た目はトークン側が解く。**部品側で配色ごとに出し分けない**ことの実測。
    // 出し分けると、配色を 1 つ足すたびに部品を直すことになる。
    for (const brandTheme of BRAND_THEMES) {
      for (const colorMode of COLOR_MODES) {
        cleanup();
        const attrs = appearanceAttributes({ brandTheme, colorMode });
        for (const [name, value] of Object.entries(attrs)) {
          document.documentElement.setAttribute(name, String(value));
        }
        mount();
        expect(
          screen.getByRole("button", { name: UI_COPY.feedback.openButton }),
          `${brandTheme} / ${colorMode} でボタンが出ていません`,
        ).not.toBeNull();
      }
    }
  });
});
