/*
  `@types` は登録された名前だけを使う（`quality-gates.config.mjs` の `TEST_TYPES`）。
  **`unit` と書いて弾かれた。**一覧に無い名前は、表記ゆれで別の種別に見えてしまう
  ——「単体は書いてある」と読める印が、どの門も満たしていない状態になる。

  ここで実際に見ているのは 2 つ。`secrets` は落とす側（クエリ・打った文字を
  控えに入れない）、`boundary` は上限のちょうど際（`DIAGNOSTICS_LIMIT` を跨いで
  古いほうから捨てる）である。
*/
/** @tier 2 @req REQ-S09 @types secrets, boundary */
// @vitest-environment jsdom
// 既定は node なので、これが無いと `window` が無く**全件が赤になる**。
// 赤の理由が「実装が壊れた」に見えるので、宣言はファイルの頭に置いておく。
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DIAGNOSTICS_LIMIT,
  safeUrl,
  startPageDiagnostics,
} from "@/presentation/ui/patterns/page-diagnostics";

/*
  画面で起きたことの控えが、**渡してよいものだけを控えている**ことを見る。

  ここの主眼は「集まること」ではなく「**混ざらないこと**」である。集まらなければ
  控えが空になるだけだが、混ざれば秘密が指示文に乗って作業する側へ渡る。
  だから件数の検査より先に、落とす側の検査を置いてある。

  **`window.fetch` を包む道具を試すので、必ず外す。**外し忘れると、後から走る
  検査の `fetch` にこの包みが残る——検査どうしが漏れ合う形は、直しにくい赤の
  代表である（原因が自分のファイルの中に無い）。`afterEach` で始末する。
*/

let running: { readonly stop: () => void } | null = null;

afterEach(() => {
  running?.stop();
  running = null;
  vi.unstubAllGlobals();
});

function start() {
  const collector = startPageDiagnostics();
  running = collector;
  return collector;
}

describe("宛先から、渡してよいところだけを取り出す", () => {
  /*
    **クエリを落とす。**`?token=…` や `?email=…` の形で秘密が混ざりうる。
    落とすと「どのクエリで失敗したか」は分からなくなるが、
    **分からないことと、漏らすことは釣り合わない。**
  */
  it("クエリと断片を落とす", () => {
    expect(safeUrl("https://example.test/api/save?token=abc123#part")).toBe(
      "https://example.test/api/save",
    );
  });

  it("パスは残る（残らないと、直す側に当たりが付かない）", () => {
    expect(safeUrl("https://example.test/admin/sites/new")).toContain("/admin/sites/new");
  });

  /*
    **読めなかったものを素通ししない。**`catch` でそのまま返すと、
    落としたはずのクエリが例外の側から出ていく。**穴は、正しい経路ではなく
    「例外のときだけ通る経路」に空く。**
  */
  it("読めない宛先を、そのまま返さない", () => {
    const weird = "javascript:alert(1)?token=abc123";
    const result = safeUrl(weird, "");
    expect(result).not.toContain("abc123");
    // **解釈に成功しても、渡してよいことにはならない。**`new URL` は
    // `javascript:` を受け付け、`origin` に文字列の `"null"` を入れて返す。
    // 素直に繋ぐと `nullalert(1)` という意味のない行が控えに並ぶ。
    expect(result).toBe("（読めない宛先）");
  });

  it("サーバー描画中はブラウザの場所を推測せず、空の控えとして安全に止められる", () => {
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("location", undefined);

    expect(safeUrl("/relative-only")).toBe("（読めない宛先）");
    const collector = startPageDiagnostics();
    expect(collector.read()).toEqual({
      jsErrors: [],
      failedRequests: [],
      recentActions: [],
      redactedCount: 0,
    });
    expect(() => collector.stop()).not.toThrow();
  });
});

describe("画面で起きたことを控える", () => {
  it("投げられた例外を控える", () => {
    const collector = start();
    window.dispatchEvent(
      new ErrorEvent("error", {
        message: "token=abc123 user@example.test",
        error: new TypeError("token=abc123 user@example.test"),
      }),
    );
    expect(collector.read().jsErrors).toEqual(["TypeError"]);
    expect(JSON.stringify(collector.read())).not.toContain("abc123");
    expect(collector.read().redactedCount).toBe(1);
  });

  /*
    **4xx / 5xx は `fetch` にとって成功である。**約束は果たされたので例外も飛ばず、
    `window` の `error` にも来ない。包まなければ、画面が「保存できません」と
    出している最中でも控えは空のままになる——**そこが一番手掛かりの要る場面である。**
  */
  it("失敗した通信を控える（例外が飛ばない 4xx も）", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 500 })),
    );
    const collector = start();
    await window.fetch("https://example.test/api/save?token=abc123");
    const [line] = collector.read().failedRequests;
    expect(line).toContain("500");
    expect(line).toContain("/api/save");
  });

  /** 届かなかった側。状態番号が無いので、番号のふりをしない。 */
  it("届かなかった通信も控え、例外はそのまま通す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("切れました");
      }),
    );
    const collector = start();
    await expect(window.fetch("https://example.test/api/save")).rejects.toThrow("切れました");
    expect(collector.read().failedRequests[0]).toContain("届きませんでした");
  });

  it("押したものの呼び名を控える", () => {
    const collector = start();
    const button = document.createElement("button");
    button.textContent = "顧客 user@example.test の secret-token を保存する";
    document.body.appendChild(button);
    button.click();
    expect(collector.read().recentActions).toContain("ボタンを操作した");
    expect(JSON.stringify(collector.read())).not.toContain("user@example.test");
    button.remove();
  });

  it("リンク・詳細・ボタンを固定語彙で区別し、変化の通知をその都度出す", () => {
    const onChange = vi.fn();
    const collector = startPageDiagnostics({ onChange });
    running = collector;

    const link = document.createElement("a");
    link.href = "/admin/sites";
    link.addEventListener("click", (event) => event.preventDefault());
    const linkChild = document.createElement("span");
    link.appendChild(linkChild);
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    details.appendChild(summary);
    const roleButton = document.createElement("span");
    roleButton.setAttribute("role", "button");
    const plain = document.createElement("span");
    document.body.appendChild(link);
    document.body.appendChild(details);
    document.body.appendChild(roleButton);
    document.body.appendChild(plain);

    linkChild.click();
    summary.click();
    roleButton.click();
    plain.click();
    document.dispatchEvent(new Event("click", { bubbles: true }));

    expect(collector.read().recentActions).toEqual([
      "リンクを操作した",
      "詳細を操作した",
      "ボタンを操作した",
    ]);
    expect(onChange).toHaveBeenCalledTimes(3);
    link.remove();
    details.remove();
    roleButton.remove();
    plain.remove();
  });

  it("未処理の拒否は生の理由を残さず、固定語彙だけを控える", () => {
    const collector = start();
    window.dispatchEvent(new Event("unhandledrejection"));
    expect(collector.read().jsErrors).toEqual(["未処理の失敗"]);
    expect(collector.read().redactedCount).toBe(1);
  });

  it("URL と Request の通信も扱い、成功は失敗一覧に加えない", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 200 })),
    );
    const collector = start();

    await window.fetch(new URL("https://example.test/api/url?token=hidden"));
    await window.fetch(new Request("https://example.test/api/request?email=hidden"));

    expect(collector.read().failedRequests).toEqual([]);
  });

  /*
    **入力欄に打った文字は控えない。**ここが集めてよいのは「こちらが観測した事実」
    だけで、利用者が打った文字は 1 つも入れない。控えたものは指示文へ添えられ、
    そのまま作業する側へ渡る。

    押されたのが入力欄なら、そもそも呼び名を取らない（`labelOf` が `null` を返す）。
    **値を伏せ字にするのではなく、行そのものを作らない**——伏せ字は「何かが在った」
    ことを伝えてしまい、次に「中身も要る」と言われたときに断る理由が無くなる。
  */
  it("入力欄を押しても、打った文字は控えない", () => {
    const collector = start();
    const input = document.createElement("input");
    input.value = "ひみつの合言葉";
    document.body.appendChild(input);
    input.click();
    const recorded = collector.read().recentActions.join("\n");
    expect(recorded).not.toContain("ひみつの合言葉");
    input.remove();
  });

  /*
    **古いほうから捨てる。**控えが伸び続けると指示文が長くなり、読まれなくなる。
    読まれない情報は、無い情報と同じである。
  */
  it("上限を超えたら、古いほうから捨てる", () => {
    const collector = start();
    for (let i = 0; i < DIAGNOSTICS_LIMIT + 3; i += 1) {
      window.dispatchEvent(new ErrorEvent("error", { message: `壊れました${i}` }));
    }
    const errors = collector.read().jsErrors;
    expect(errors).toHaveLength(DIAGNOSTICS_LIMIT);
    expect(errors[errors.length - 1]).toBe("Error");
    expect(errors).toHaveLength(DIAGNOSTICS_LIMIT);
  });

  /*
    **`read` は呼んだ瞬間を返す。**開いた時点の写しを渡すと、開いてから送るまでに
    起きたことが落ちる。要望を書いている最中に起きた失敗こそ渡したい。
  */
  it("読んだ後に起きたことも、次に読めば入っている", () => {
    const collector = start();
    expect(collector.read().jsErrors).toHaveLength(0);
    window.dispatchEvent(new ErrorEvent("error", { message: "あとから" }));
    expect(collector.read().jsErrors).toEqual(["Error"]);
  });
});

describe("控えるのをやめたら、あとに何も残さない", () => {
  /*
    **`fetch` の包みを外す。**外さないと、要望のボタンを出す画面を開き直すたびに
    包みが重なる。重なった包みは互いを知らないので、1 回の通信が何度も控えられ、
    やがて控えが失敗だけで埋まる。
  */
  it("止めたら `fetch` が元に戻る", async () => {
    const original = vi.fn(async () => new Response("", { status: 500 }));
    vi.stubGlobal("fetch", original);
    const before = window.fetch;
    const collector = startPageDiagnostics();
    expect(window.fetch).not.toBe(before);
    collector.stop();
    expect(window.fetch).toBe(before);
  });

  it("止めたら、その後の例外を控えない", () => {
    const collector = startPageDiagnostics();
    collector.stop();
    window.dispatchEvent(new ErrorEvent("error", { message: "止めた後" }));
    expect(collector.read().jsErrors).toEqual([]);
  });

  /*
    **自分が置いたものだけを外す。**別の何かが後から包んでいた場合、
    元へ戻すとその包みごと消える。**後始末が、他人の仕事を消してはいけない。**
  */
  it("後から誰かが包んでいたら、元へ戻さない", () => {
    const original = vi.fn(async () => new Response(""));
    vi.stubGlobal("fetch", original);
    const collector = startPageDiagnostics();
    const later = vi.fn(async () => new Response(""));
    window.fetch = later as unknown as typeof window.fetch;
    collector.stop();
    expect(window.fetch).toBe(later);
  });
});
