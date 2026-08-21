/**
 * 画面で起きたことを控えておく道具。改善要望に添えて渡す。
 *
 * --- なぜ要るのか ---
 *
 * 要望を送る人は再現手順を書けないことが多い。「なんとなく動かない」だけが届き、
 * 受け取った側は何も始められない。**開発者が DevTools で最初に見る 3 つ**
 * ——投げられた例外・失敗した通信・その直前にした操作——を控えておけば、
 * 書けない人の要望でも手掛かりが付く。
 *
 * --- 控えるものと、控えないもの ---
 *
 * ここが集めるのは**こちらが観測した事実**だけで、利用者が打った文字は 1 つも入れない。
 * 入力欄の値・貼り付けた内容・選んだ値は控えない。控えたものは指示文へ添えられ、
 * そのまま作業する側へ渡るためである。
 *
 * **通信先の URL からクエリを落とす。**`?token=…` や `?email=…` の形で秘密が
 * 混ざりうる。落とすと「どのクエリで失敗したか」が分からなくなるが、
 * **分からないことと、漏らすことは釣り合わない。**パスまでで、直す側は当たりを付けられる。
 *
 * --- なぜ `fetch` を包むのか ---
 *
 * 通信の失敗は `window` の `error` に来ない。4xx / 5xx は `fetch` にとって
 * 成功（約束は果たされた）なので、例外も飛ばない。**包まないと、
 * 画面が「保存できません」と出している最中でも、控えは空のままになる。**
 *
 * 包むのは要望を送れる人が居るときだけで、外すときは元へ戻す。戻さないと、
 * 画面を開き直すたびに包みが重なる。
 */

/** 控えておく上限。古いほうから捨てる。多いほど指示文が長くなり、読まれなくなる。 */
export const DIAGNOSTICS_LIMIT = 8;

/** 操作の説明に使う文字数の上限。長い見出しをそのまま入れると 1 件で埋まる。 */
const LABEL_MAX = 60;

export type PageDiagnostics = {
  readonly jsErrors: readonly string[];
  readonly failedRequests: readonly string[];
  readonly recentActions: readonly string[];
};

/**
 * URL から、渡してよいところだけを取り出す。
 *
 * **クエリと断片（`#…`）を落とす。**残すのはオリジンとパスだけ。
 * 解釈できない文字列（相対 URL など）は、そのまま返さず「（読めない宛先）」にする
 * ——読めなかったものを素通しすると、落としたはずのクエリが `catch` の側から出ていく。
 */
export function safeUrl(raw: string, base?: string): string {
  try {
    const url = new URL(raw, base ?? (typeof location === "undefined" ? undefined : location.href));
    /*
     * **`http(s)` 以外は宛先として扱わない。**`new URL` は `javascript:` も
     * `data:` も解釈に成功するが、そこには「オリジン」も「パス」も無い
     * （`origin` は文字列の `"null"` になり、繋ぐと `nullalert(1)` のような
     * 意味のない行が控えに並ぶ）。**解釈できたことは、渡してよいことではない。**
     */
    if (url.protocol !== "http:" && url.protocol !== "https:") return "（読めない宛先）";
    return `${url.origin}${url.pathname}`;
  } catch {
    return "（読めない宛先）";
  }
}

/** 押されたものの呼び名。**値は取らない**（入力欄の中身を控えないため）。 */
function labelOf(element: Element): string | null {
  const actionable = element.closest("button, a[href], [role='button'], summary");
  if (!actionable) return null;
  const aria = actionable.getAttribute("aria-label");
  const text = (aria ?? actionable.textContent ?? "").replace(/\s+/g, " ").trim();
  if (text === "") return null;
  return text.length > LABEL_MAX ? `${text.slice(0, LABEL_MAX)}…` : text;
}

type Ring = { readonly push: (line: string) => void; readonly read: () => readonly string[] };

function ring(): Ring {
  let lines: string[] = [];
  return {
    push: (line) => {
      lines = [...lines.slice(-(DIAGNOSTICS_LIMIT - 1)), line];
    },
    read: () => lines,
  };
}

/**
 * 控え始める。返ってきた `stop` を必ず呼ぶこと（`fetch` の包みを外すため）。
 *
 * `read` は**呼んだ瞬間**の控えを返す。開いた時点の写しを渡すと、
 * 開いてから送るまでに起きたことが落ちる（そこが一番効く場面である）。
 */
export function startPageDiagnostics(): {
  readonly read: () => PageDiagnostics;
  readonly stop: () => void;
} {
  const errors = ring();
  const requests = ring();
  const actions = ring();

  if (typeof window === "undefined") {
    return { read: () => ({ jsErrors: [], failedRequests: [], recentActions: [] }), stop: () => {} };
  }

  const onError = (event: ErrorEvent): void => errors.push(event.message);
  /** 約束が捨てられた側。`await` を書き忘れた失敗はこちらにしか来ない。 */
  const onRejection = (event: PromiseRejectionEvent): void =>
    errors.push(`未処理の失敗: ${String(event.reason)}`);
  const onClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const label = labelOf(target);
    if (label !== null) actions.push(`「${label}」を押した`);
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  // 捕捉の段で聞く。押されたものが自分で伝播を止めても、控えは残る。
  document.addEventListener("click", onClick, true);

  const original = window.fetch;
  const patched: typeof window.fetch = async (input, init) => {
    const target = safeUrl(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
    );
    try {
      const response = await original(input, init);
      // 4xx / 5xx は `fetch` にとって成功なので、ここで見なければ誰も見ない。
      if (!response.ok) requests.push(`${response.status} ${target}`);
      return response;
    } catch (cause) {
      // 届かなかった側（切断・CORS・中断）。状態番号が無いので、そう書く。
      requests.push(`届きませんでした ${target}`);
      throw cause;
    }
  };
  window.fetch = patched;

  return {
    read: () => ({
      jsErrors: errors.read(),
      failedRequests: requests.read(),
      recentActions: actions.read(),
    }),
    stop: () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      document.removeEventListener("click", onClick, true);
      // **自分が置いたものだけを外す。**別の何かが後から包んでいた場合、
      // ここで元へ戻すとその包みごと消える。
      if (window.fetch === patched) window.fetch = original;
    },
  };
}
