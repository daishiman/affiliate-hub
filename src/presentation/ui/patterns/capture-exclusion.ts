/**
 * 撮影のあいだだけ、本文の上に浮いている操作を写しの対象から外す。
 *
 * --- なぜ要るのか ---
 *
 * `getDisplayMedia` はタブ全体を写す。**自分自身も写る。**改善したい箇所を
 * 伝えるために撮った写しの真ん中に、伝える側の画面（送信モーダル）が載る。
 * 写しの用途は「利用者が伝えたい箇所」の提示であり、送信 UI 自身はその情報を
 * 1 ビットも運ばない。**観測器を被写体に含めない。**
 *
 * --- なぜ属性で見分けるのか ---
 *
 * 見分ける手掛かりを class 名で持つと、見た目の都合で名前が変わった日に
 * 静かに写り込みが戻る。`data-floating-overlay` は既に重なり監査
 * (`tests/e2e/app-routes.spec.ts`) が同じ意味で使っている名乗りなので、
 * **写し除外と重なり監査で同じ 1 つの手掛かりを共有する。**
 * 手掛かりが 2 系統に割れると、片方だけ付けた要素が生まれる。
 *
 * --- なぜ React の外で隠すのか ---
 *
 * 浮いている要素は将来この部品の外にも生まれる（通知・案内・戻るボタン）。
 * 描画の状態で隠すと、隠す責任がそれぞれの部品へ散らばり、付け忘れが起きる。
 * 文書へ印を 1 つ立て、CSS が名乗った要素すべてを一律に退避させる。
 */

/** 本文の上に浮くことを、要素が自分で名乗る属性。 */
export const FLOATING_OVERLAY_ATTR = "data-floating-overlay";

/** いま撮影中であることを、文書が名乗る属性。CSS はこれを見て退避させる。 */
export const CAPTURING_ATTR = "data-capturing";

type CaptureLease = {
  readonly root: Element;
  readonly before: string | null;
  activeCount: number;
};

/** Document 全体の印は、同じ Document 上の全撮影で共有する。 */
const captureLeases = new WeakMap<Document, CaptureLease>();

/**
 * 撮影中の退避を始め、**元へ戻す手続き**を返す。
 *
 * 戻す手続きを返り値にしているのは、始めた側が必ず終わらせられるようにするため。
 * 「隠す」と「戻す」を別の関数として外へ出すと、途中で例外が出た経路だけが
 * 戻し忘れ、**画面から操作が消えたまま残る。**呼ぶ側は `try/finally` で囲む。
 */
export function hideFloatingOverlays(doc: Document = document): () => void {
  /*
   * **消すのではなく、元の値へ戻す。**
   *
   * 重なった撮影は、始めた順と逆順のどちらで終わるとも限らない。
   * 各呼び出しが自分の開始時の値を戻すと、先に始めた撮影が先に終わった
   * だけで活動中の退避が解ける。そこで Document ごとに lease 数を共有し、
   * **最初の1件で元値を覚え、最後の1件だけが復元する。**
   */
  const existing = captureLeases.get(doc);
  const lease =
    existing ??
    ({
      root: doc.documentElement,
      before: doc.documentElement.getAttribute(CAPTURING_ATTR),
      activeCount: 0,
    } satisfies CaptureLease);
  if (!existing) captureLeases.set(doc, lease);
  lease.activeCount += 1;
  lease.root.setAttribute(CAPTURING_ATTR, "true");

  let restored = false;
  return () => {
    // 2 回呼ばれても他人の印を消さない。呼ぶ側の `finally` は重なりうる。
    if (restored) return;
    restored = true;
    lease.activeCount -= 1;
    if (lease.activeCount > 0) return;

    captureLeases.delete(doc);
    if (lease.before === null) lease.root.removeAttribute(CAPTURING_ATTR);
    else lease.root.setAttribute(CAPTURING_ATTR, lease.before);
  };
}

/**
 * 隠した状態が実際に画面へ描かれるまで待つ。
 *
 * 属性を立てた直後は、まだ前の絵が出ている。そこで `drawImage` すると
 * **隠したはずのものが写る。**描き直しを 2 回待つ（1 回目は属性の反映、
 * 2 回目はその結果が合成されるまで）。`requestAnimationFrame` が無い環境
 * （テスト・古い端末）では待たずに進む——待てないことは失敗ではない。
 * 撮影期限が来たら `signal` で待ちを解く。非表示タブは rAF 自体が止まるため、
 * ここが解けないと退避も MediaStream も返せない。
 */
export async function afterNextPaint(view: Window = window, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return;
  const raf = view.requestAnimationFrame?.bind(view);
  if (typeof raf !== "function") return;
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", finish);
      resolve();
    };
    signal?.addEventListener("abort", finish, { once: true });
    raf(() => raf(finish));
  });
}

/**
 * 退避後の DOM が映像側へ取り込まれた、次の 1 フレームを待つ。
 *
 * `requestAnimationFrame` が教えるのは画面の描画時点で、画面共有の映像が
 * その新しい姿を取り込んだ時点ではない。対応ブラウザでは
 * `requestVideoFrameCallback` で**次に compositor へ提示される映像フレーム**を
 * 1 回待ってから取り出す。
 *
 * 非対応環境は DOM の描画待ちだけで続行する。これは撮影を利用不可に
 * しないための明示的 fallback であり、fresh-frame 保証が同等という意味ではない。
 * 期限や後続撮影で中断された場合は callback を取り消し、待ちを必ず解く。
 */
export async function afterNextVideoFrame(
  video: HTMLVideoElement,
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted) return;
  const request = video.requestVideoFrameCallback?.bind(video);
  if (typeof request !== "function") return;

  await new Promise<void>((resolve) => {
    let handle: number | null = null;
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", onAbort);
      resolve();
    };
    const onAbort = (): void => {
      if (handle !== null) {
        try {
          video.cancelVideoFrameCallback?.(handle);
        } catch {
          // 取消しの失敗で、撮影全体の後始末を止めない。
        }
      }
      finish();
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    try {
      handle = request(() => finish());
    } catch {
      // API が名乗っていても登録できない環境は、非対応と同じ扱いにする。
      finish();
    }
  });
}
