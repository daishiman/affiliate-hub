/**
 * @tier 1
 * @req REQ-BOPS06
 * @types decision-table, screen-states
 *
 * 読者が記事に点を付ける欄。**押した結果が画面に出るか**だけを見る。
 *
 * この欄は 0/12 分岐が無検査のまま公開面に置かれていた（2026-09-02 実測）。
 * 部品として正しくても、状態の出し分けを 1 つ取り違えると
 * 「押しても何も変わらない画面」になり、読者は同じ操作を繰り返す。
 *
 * 特に固定したいのは**「まだ 1 票も無い」と「全員が 1 点を付けた」を混ぜない**こと。
 * 平均 0 と平均なしを同じ「0.0」に潰すと、記事の良し悪しの判断を誤らせる。
 * 画面のコメントはそう書いてあるのに、それを守る検査が無かった。
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ReaderRatingState } from "@/presentation/site/reader-rating-action";

/*
  `useActionState` は state と pending の 2 つを同時に返す。
  この欄の分岐はその両方から出るので、片方だけ差し替えられる形にしておく。
  render のたびに読み直すため、`let` をテスト側に置いて mock から参照する。
*/
let currentState: ReaderRatingState = { status: "idle", message: "" };
let currentPending = false;

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useActionState: () => [currentState, () => undefined, currentPending],
  };
});

const { ReaderRatingForm } = await import("@/presentation/site/reader-rating-form");

function render(
  over: {
    readonly state?: ReaderRatingState;
    readonly pending?: boolean;
    readonly initialCount?: number;
    readonly initialAverage?: number | null;
  } = {},
): string {
  currentState = over.state ?? { status: "idle", message: "" };
  currentPending = over.pending ?? false;
  return renderToStaticMarkup(
    <ReaderRatingForm
      siteSlug="test"
      articleSlug="chair-review"
      initialCount={over.initialCount ?? 0}
      initialAverage={over.initialAverage ?? null}
    />,
  );
}

describe("読者の評価欄", () => {
  it("どの記事への評価かを一緒に送る", () => {
    // 記事を指す値が欠けると、票だけが宙に浮いた記録が残る。
    const html = render();

    expect(html).toContain('value="test"');
    expect(html).toContain('value="chair-review"');
  });

  it("点の選択肢はドメインの上限・下限から作る", () => {
    // 1〜5 を画面で手打ちすると、幅が変わった日にここだけ古いまま残る。
    const html = render();

    for (const score of [1, 2, 3, 4, 5]) {
      expect(html, `${score} 点の選択肢`).toContain(`value="${score}"`);
    }
    expect(html).not.toContain('value="6"');
    expect(html).not.toContain('value="0"');
  });
});

describe("いまの評価の出し方", () => {
  it("1 票も無いときは「ありません」と言い、0.0 と書かない", () => {
    expect(render({ initialCount: 0, initialAverage: null })).toContain("まだ評価はありません。");
  });

  it("全員が最低点でも「ありません」にしない", () => {
    /*
      ここがこの検査の主題である。平均 1.0 が 3 件ある記事と、
      1 票も無い記事は**別のこと**を意味する。前者は読者に届いたが
      役に立たなかった記事で、後者はまだ誰にも読まれていない記事である。
      `count === 0 || average === null` の左右を取り違えると混ざる。
    */
    const html = render({ initialCount: 3, initialAverage: 1 });

    expect(html).toContain("いまの評価: 1（3 件）");
    expect(html).not.toContain("まだ評価はありません。");
  });

  it("送った直後は、返ってきた集計で上書きする", () => {
    // 送信の前後で表示が変わらないと、押しても何も起きていないように見える。
    const html = render({
      initialCount: 3,
      initialAverage: 1,
      state: {
        status: "done",
        message: "ありがとうございました。",
        summary: { count: 4, average: 2 },
      },
    });

    expect(html).toContain("いまの評価: 2（4 件）");
    expect(html).not.toContain("（3 件）");
  });

  it("集計が返ってこない失敗では、送る前の値を保つ", () => {
    /*
      `state.summary` が無いときに 0 件へ落とすと、
      失敗するたびに「まだ評価はありません」へ巻き戻り、
      それまでの票が消えたように見える。
    */
    const html = render({
      initialCount: 3,
      initialAverage: 1,
      state: { status: "failed", message: "送れませんでした。" },
    });

    expect(html).toContain("いまの評価: 1（3 件）");
  });
});

describe("押した結果を必ず出す", () => {
  it("送信中は釦の文字を変え、二度押しを塞ぐ", () => {
    const html = render({ pending: true });

    expect(html).toContain("送信中…");
    expect(html).toContain("disabled");
    expect(html).not.toContain(">送る<");
  });

  it("送信中でなければ押せる", () => {
    const html = render({ pending: false });

    expect(html).toContain("送る");
    expect(html).not.toContain("送信中…");
  });

  it("点の欄への指摘は、その欄の傍に 1 回だけ出す", () => {
    /*
      欄の名前と結び付かない指摘は、どこを直せばよいか分からない。
      逆に、欄の下と form の頭の両方へ同じ文言を出すと、
      直したあとに片方だけ消えて「まだ直っていない」ように見える。
      だから `field` 付きの断りは欄の下だけに出す（`FormResult` の契約）。
    */
    const html = render({
      state: { status: "failed", message: "点を選んでください。", field: "score" },
    });

    expect(html.split("点を選んでください。")).toHaveLength(2);
  });

  it("点の欄以外を指す失敗を、点の欄へ出さない", () => {
    /*
      `field` が別の欄を指しているのに点の欄へ出すと、
      読者は正しく入れた欄を直そうとして先へ進めなくなる。
    */
    const html = render({
      state: { status: "failed", message: "ひとことが長すぎます。", field: "comment" },
    });

    expect(html).not.toContain("ひとことが長すぎます。");
  });

  it("どの欄でもない失敗は、form の頭で伝える", () => {
    // 欄に紐づかない断り（通信の失敗など）をどこにも出さないと、
    // 押しても何も起きない画面になる。
    const html = render({
      state: { status: "failed", message: "いま送れませんでした。時間をおいて試してください。" },
    });

    expect(html).toContain("いま送れませんでした。時間をおいて試してください。");
  });
});
