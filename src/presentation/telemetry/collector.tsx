"use client";

import { useEffect } from "react";
import { TELEMETRY_ATTR } from "../ui/telemetry-attrs";

/**
 * 計測を拾って送る側。**画面全体で 1 つだけ置く。**
 *
 * --- なぜ 1 箇所なのか ---
 * 画面ごとに送信を書くと、新しい画面だけ計測が抜ける。抜けても画面は動くので
 * 気づけない。ここでは部品が名乗った `data-tel-*` を document 全体で拾うので、
 * 共通UIの部品を使っている限り、計測は自動的に付いてくる。
 *
 * --- 読む体験を悪くしない ---
 *   - まとめて送る (`FLUSH_EVERY_MS` / `MAX_QUEUE`)
 *   - ページを離れるときは `sendBeacon`。離脱の妨げにしない
 *   - 送信に失敗しても**何も起きない**。記事の表示はこの成否と無関係
 *   - 同意が無いときは、そもそも詳しいイベントを作らない
 *     （作ってからサーバーで捨てると、通信だけが起きる）
 *
 * --- 測らないもの ---
 * 位置・IP・端末の指紋は一切扱わない。目印は使い捨ての乱数で、
 * 同意がなければ付けない。
 */

const FLUSH_EVERY_MS = 15_000;
const MAX_QUEUE = 20;
const READER_KEY_STORAGE = "ah_rk";

type QueuedEvent = {
  key: string;
  occurredAt: string;
  payload: Record<string, unknown>;
};

export type CollectorProps = {
  readonly siteSlug: string;
  readonly path: string;
  readonly endpoint?: string;
  /** サーバー側で決まった同意の結論。ここで判定し直さない。 */
  readonly allowBehaviour: boolean;
  readonly suppressAll: boolean;
};

/** 参照元の粗い区分。URL 全体は持たない。 */
function referrerKind(): string {
  const ref = typeof document === "undefined" ? "" : document.referrer;
  if (ref === "") return "直接";
  try {
    const host = new URL(ref).hostname;
    if (host === window.location.hostname) return "サイト内";
    if (/google|bing|yahoo|duckduckgo/.test(host)) return "検索";
    if (/x\.com|twitter|facebook|instagram|youtube|note\.com/.test(host)) return "SNS";
    return "その他サイト";
  } catch {
    return "不明";
  }
}

function readerKey(allow: boolean): string | null {
  if (!allow) return null;
  try {
    const existing = sessionStorage.getItem(READER_KEY_STORAGE);
    if (existing !== null) return existing;
    // 使い捨ての乱数。端末情報からは作らない（それは指紋であって仮名ではない）。
    const made = crypto.randomUUID();
    sessionStorage.setItem(READER_KEY_STORAGE, made);
    return made;
  } catch {
    // ストレージが使えない設定でも計測は続ける（回数として数える）。
    return null;
  }
}

export function TelemetryCollector({
  siteSlug,
  path,
  endpoint = "/api/telemetry",
  allowBehaviour,
  suppressAll,
}: CollectorProps) {
  useEffect(() => {
    if (suppressAll) return;

    const queue: QueuedEvent[] = [];
    const base = { path, siteSlug };
    const key = readerKey(allowBehaviour);
    let maxPercent = 0;
    const startedAt = Date.now();
    /** 節ごとの累計滞在時間 (ミリ秒) と、いま見え始めた時刻。 */
    const dwell = new Map<string, { kind: string; total: number; since: number | null }>();

    const push = (k: string, payload: Record<string, unknown>): void => {
      queue.push({ key: k, occurredAt: new Date().toISOString(), payload });
      if (queue.length >= MAX_QUEUE) flush(false);
    };

    const flush = (viaBeacon: boolean): void => {
      if (queue.length === 0) return;
      const body = JSON.stringify({ events: queue.splice(0, queue.length), readerKey: key });
      try {
        if (viaBeacon && typeof navigator.sendBeacon === "function") {
          navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }));
          return;
        }
        void fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {
          // 握りつぶす。計測の失敗を読者に見せない。
        });
      } catch {
        // 同上。
      }
    };

    // --- ページを開いた（同意が無くても数える） ---
    push("page_view", { ...base, referrerKind: referrerKind() });

    // --- ここから下は同意が要る ---
    const listeners: (() => void)[] = [];

    const onClick = (ev: MouseEvent): void => {
      const target = ev.target as Element | null;
      const marked = target?.closest?.(`[${TELEMETRY_ATTR.kind}]`);
      if (!marked) return;
      const kind = marked.getAttribute(TELEMETRY_ATTR.kind) ?? "";
      const id = marked.getAttribute(TELEMETRY_ATTR.id) ?? "";
      const label = marked.getAttribute(TELEMETRY_ATTR.label) ?? undefined;
      const placement = marked.getAttribute(TELEMETRY_ATTR.placement) ?? "本文";
      const rank = marked.getAttribute(TELEMETRY_ATTR.rank);

      // 成果リンクは同意が無くても回数だけ数える（誰のものかは持たない）。
      if (kind === "affiliate_link") {
        push("affiliate_click", { ...base, linkId: id, placement });
        flush(true);
        return;
      }
      if (!allowBehaviour) return;

      if (kind === "ranking_row" && rank !== null) {
        push("ranking_row_click", { ...base, productId: id, rank: Number(rank) });
        return;
      }
      if (kind === "internal_link") {
        push("internal_link_click", { ...base, toPath: id, placement });
        return;
      }
      push("element_click", { ...base, elementKind: kind, elementId: id, label });
    };

    document.addEventListener("click", onClick, { capture: true });
    listeners.push(() => document.removeEventListener("click", onClick, { capture: true }));

    if (allowBehaviour) {
      // --- どこまで読んだか ---
      const onScroll = (): void => {
        const doc = document.documentElement;
        const scrollable = doc.scrollHeight - window.innerHeight;
        if (scrollable <= 0) return;
        const percent = Math.min(100, Math.round(((window.scrollY + 0) / scrollable) * 100));
        if (percent > maxPercent) maxPercent = percent;
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      listeners.push(() => window.removeEventListener("scroll", onScroll));

      // --- 節ごとの滞在時間 ---
      // 見えている間だけ時間を足す。スクロールで通り過ぎた節を
      // 「読んだ」と数えないよう、見え終わった時点で確定させる。
      const sections = document.querySelectorAll(`[${TELEMETRY_ATTR.section}]`);
      let observer: IntersectionObserver | null = null;
      if (sections.length > 0 && typeof IntersectionObserver === "function") {
        observer = new IntersectionObserver(
          (entries) => {
            const now = Date.now();
            for (const entry of entries) {
              const id = entry.target.getAttribute(TELEMETRY_ATTR.section);
              if (id === null) continue;
              const kind = entry.target.getAttribute(TELEMETRY_ATTR.sectionKind) ?? "lead";
              const state = dwell.get(id) ?? { kind, total: 0, since: null };
              if (entry.isIntersecting) {
                state.since = now;
              } else if (state.since !== null) {
                state.total += now - state.since;
                state.since = null;
              }
              dwell.set(id, state);
            }
          },
          // 画面の半分以上入ったら「見ている」とみなす。
          // 端が少し入っただけを滞在に数えると、通り過ぎた節が上位に来る。
          { threshold: 0.5 },
        );
        for (const s of sections) observer.observe(s);
        listeners.push(() => observer?.disconnect());
      }

      const finishDwell = (): void => {
        const now = Date.now();
        for (const [id, state] of dwell) {
          const total = state.total + (state.since === null ? 0 : now - state.since);
          state.since = null;
          state.total = 0;
          // 1 秒未満は捨てる。通り過ぎただけの節を記録に残さない。
          if (total < 1000) continue;
          push("section_dwell", {
            ...base,
            sectionId: id,
            sectionKind: state.kind,
            seconds: Math.round(total / 1000),
          });
        }
      };

      const onLeave = (): void => {
        if (document.visibilityState !== "hidden") return;
        finishDwell();
        push("scroll_depth", { ...base, percent: maxPercent });
        push("page_exit", {
          ...base,
          percent: maxPercent,
          seconds: Math.round((Date.now() - startedAt) / 1000),
        });
        flush(true);
      };
      document.addEventListener("visibilitychange", onLeave);
      listeners.push(() => document.removeEventListener("visibilitychange", onLeave));
    }

    const timer = window.setInterval(() => flush(false), FLUSH_EVERY_MS);

    return () => {
      window.clearInterval(timer);
      for (const off of listeners) off();
      flush(true);
    };
  }, [siteSlug, path, endpoint, allowBehaviour, suppressAll]);

  // 表示は持たない。置いた場所によって見た目が変わらないようにするため。
  return null;
}
