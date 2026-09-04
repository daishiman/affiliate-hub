"use client";

import { useEffect } from "react";
import {
  MAX_DWELL_SECONDS,
  MAX_ELEMENT_KEY_LENGTH,
  MAX_SESSION_KEY_LENGTH,
  type ReaderInteractionWireEnvelope,
  type ReaderInteractionWireEvent,
  type ReaderSegment,
  type ViewportBand,
} from "@/domain/analytics/reader-interaction";
import { TELEMETRY_ATTR } from "../ui/telemetry-attrs";

/**
 * 読者の行動を観測して `/api/reader-events` へ送る側。**画面全体で 1 つだけ置く。**
 *
 * --- `/api/telemetry` の collector と何が違うのか ---
 * あちらは「画面の使われ方」（管理画面を含む）を数える。こちらは
 * **公開されたブログの読者の読み方**だけを扱う。保存先も読み口も違い、
 * 生の記録が 90 日で消えるのはこちらだけである (AD-4)。
 * 同じ `data-tel-*` の印を拾うが、送り先と形が別なので独立して置く。
 *
 * --- 何を測るか（4 種）---
 *   - `view`   開いた 1 回。母数になる。
 *   - `scroll` 到達の刻みを越えたとき。**どこで読むのをやめたか**が分かる。
 *   - `dwell`  離れるまでの、画面が見えていた時間。裏のタブは数えない。
 *   - `click`  印の付いた部品の押下。位置の比率を添える。
 *   - `exit`   離脱 1 回。`view` との差が「開いたが何もしなかった」になる。
 *
 * --- 読む体験を悪くしない ---
 * ぜんぶ `useEffect` の中で、かつ全体を try/catch で包む。
 * **計測が落ちても本文は描かれる。** 送信は離脱時の `sendBeacon` が主で、
 * 溜まりすぎたときだけ `keepalive` の fetch で先に流す。
 *
 * --- 測らないもの ---
 * 位置・IP・端末の指紋は扱わない。目印は使い捨ての乱数で、同意が無ければ
 * 付けないどころか**イベントを作らない**（作ってからサーバーで捨てると、
 * 通信だけが起きる）。
 */

/** 束ねる上限。受け口が 1 回に受けるのは 50 件なので、それより下に置く。 */
const MAX_QUEUE = 40;
/** 到達を刻む位置。連続値を送ると 1 人の細かい上下で件数が膨らむ。 */
const SCROLL_MARKS = [0.25, 0.5, 0.75, 1] as const;
/** 目印の置き場所。`/api/telemetry` の collector と同じ鍵を使い、2 本作らない。 */
const READER_KEY_STORAGE = "ah_rk";

type QueuedEventInput = Omit<
  ReaderInteractionWireEvent,
  "eventId" | "segment" | "viewportBand" | "sessionKey" | "articleSlug" | "occurredAt"
>;

export type BehaviorProbeProps = {
  readonly siteSlug: string;
  /** 記事を見ているなら、その名前。ブログの表紙などでは省く。 */
  readonly articleSlug?: string;
  readonly endpoint?: string;
  /** サーバー側で決まった同意の結論。ここで判定し直さない。 */
  readonly allowBehaviour: boolean;
  readonly suppressAll: boolean;
};

/**
 * どこから来たか。**URL 全体は持たない。**
 *
 * 区分の名前は `READER_SEGMENTS` と同じ英語の id にする。日本語の見出しは
 * 画面側 (`READER_SEGMENT_LABEL`) が持つので、ここで訳さない。
 */
function segmentOf(): ReaderSegment {
  const ref = typeof document === "undefined" ? "" : document.referrer;
  if (ref === "") return "direct";
  try {
    const host = new URL(ref).hostname;
    if (host === window.location.hostname) return "internal";
    if (/google|bing|yahoo|duckduckgo/.test(host)) return "search";
    if (/x\.com|twitter|facebook|instagram|youtube|note\.com/.test(host)) return "social";
    return "referral";
  } catch {
    return "direct";
  }
}

/**
 * 画面幅の区分。**実寸ではなく区分だけを持つ。**
 *
 * 実寸を送ると、珍しい幅の組み合わせがそれだけで個人を指せてしまう。
 * 区分が 3 つなら、どの読者も必ず誰かと同じ値になる。
 */
function viewportBandOf(): ViewportBand {
  const width = window.innerWidth;
  if (width < 640) return "narrow";
  if (width < 1024) return "medium";
  return "wide";
}

/**
 * 使い捨ての目印。同意確認後にだけ呼ぶ。
 *
 * storage が拒否されても、この effect の event は同じ一時鍵で束ねる。鍵を
 * null にすると受け口の匿名集計契約を破るため、永続化の成否とは分ける。
 */
function sessionKeyOf(): string {
  const made = crypto.randomUUID().slice(0, MAX_SESSION_KEY_LENGTH);
  try {
    const existing = sessionStorage.getItem(READER_KEY_STORAGE);
    if (existing !== null) return existing.slice(0, MAX_SESSION_KEY_LENGTH);
    sessionStorage.setItem(READER_KEY_STORAGE, made);
  } catch {
    // 永続化できない場合も、effect 内だけの匿名なまとまりとして数える。
  }
  return made;
}

/** いま何割まで読み進んだか。上端が 0、下端が 1。 */
function scrollRatio(): number {
  const doc = document.documentElement;
  const scrollable = doc.scrollHeight - window.innerHeight;
  if (scrollable <= 0) return 1;
  const ratio = window.scrollY / scrollable;
  return Math.min(1, Math.max(0, ratio));
}

/**
 * 押された部品の名前。**印の付いた部品だけを数える。**
 *
 * 印が無いものまで拾うと、`div` の入れ子の深さが変わっただけで
 * 別の名前になり、日をまたいだ比較ができなくなる。
 */
function elementKeyOf(target: EventTarget | null): string | undefined {
  if (!(target instanceof Element)) return undefined;
  const marked = target.closest(`[${TELEMETRY_ATTR.kind}]`);
  if (marked === null) return undefined;
  const kind = marked.getAttribute(TELEMETRY_ATTR.kind) ?? "";
  const id = marked.getAttribute(TELEMETRY_ATTR.id) ?? "";
  if (kind === "") return undefined;
  return `${kind}:${id}`.slice(0, MAX_ELEMENT_KEY_LENGTH);
}

/** 押された場所が、記事全体のどのあたりか。 */
function positionOf(element: Element): number {
  const doc = document.documentElement;
  const box = element.getBoundingClientRect();
  const centre = window.scrollY + box.top + box.height / 2;
  const height = doc.scrollHeight;
  if (height <= 0) return 0;
  return Math.min(1, Math.max(0, centre / height));
}

export function ReaderBehaviorProbe({
  siteSlug,
  articleSlug,
  endpoint = "/api/reader-events",
  allowBehaviour,
  suppressAll,
}: BehaviorProbeProps) {
  useEffect(() => {
    // 同意が無い、または一切を止める設定なら、イベントを 1 つも作らない。
    if (suppressAll || !allowBehaviour) return;

    /*
     * 計測の準備そのものが落ちても本文は描かれていなければならない。
     * `useEffect` は描画の後に走るので描画は既に済んでいるが、
     * ここで投げると後続の effect（同意の表示など）まで巻き込む。
     */
    try {
      const queue: ReaderInteractionWireEvent[] = [];
      const segment = segmentOf();
      const viewportBand = viewportBandOf();
      const sessionKey = sessionKeyOf();
      const offs: Array<() => void> = [];

      /** 越えた到達の刻み。同じ刻みを 2 回送らない。 */
      const passed = new Set<number>();
      /** 画面が見えていた時間の累計（ミリ秒）と、いま見え始めた時刻。 */
      let visibleMs = 0;
      let since: number | null = document.visibilityState === "visible" ? Date.now() : null;
      let done = false;

      const push = (event: QueuedEventInput): void => {
        queue.push({
          ...event,
          eventId: crypto.randomUUID(),
          sessionKey,
          ...(articleSlug === undefined ? {} : { articleSlug }),
          segment,
          viewportBand,
          occurredAt: new Date().toISOString(),
        });
        if (queue.length >= MAX_QUEUE) flush(false);
      };

      const flush = (leaving: boolean): void => {
        if (queue.length === 0) return;
        const envelope: ReaderInteractionWireEnvelope = {
          siteSlug,
          events: queue.splice(0, queue.length),
        };
        const body = JSON.stringify(envelope);
        try {
          if (leaving && typeof navigator.sendBeacon === "function") {
            navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }));
            return;
          }
          void fetch(endpoint, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body,
            keepalive: true,
          }).catch(() => {
            // 送れなくても読者の画面は動く。再送もしない（壊れているときほど負荷が上がる）。
          });
        } catch {
          // 同上。
        }
      };

      push({ kind: "view" });

      const onScroll = (): void => {
        const ratio = scrollRatio();
        for (const mark of SCROLL_MARKS) {
          if (ratio >= mark && !passed.has(mark)) {
            passed.add(mark);
            push({ kind: "scroll", positionRatio: mark });
          }
        }
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      offs.push(() => window.removeEventListener("scroll", onScroll));
      // 短い記事は最初から下端が見えている。開いた時点で 1 回数える。
      onScroll();

      const onClick = (event: MouseEvent): void => {
        const key = elementKeyOf(event.target);
        if (key === undefined) return;
        const marked = (event.target as Element).closest(`[${TELEMETRY_ATTR.kind}]`);
        push({
          kind: "click",
          elementKey: key,
          ...(marked === null ? {} : { positionRatio: positionOf(marked) }),
        });
      };
      // capture で拾うのは、途中で伝播を止める部品があっても数えるため。
      document.addEventListener("click", onClick, true);
      offs.push(() => document.removeEventListener("click", onClick, true));

      const onVisibility = (): void => {
        if (document.visibilityState === "visible") {
          since = Date.now();
          return;
        }
        if (since !== null) visibleMs += Date.now() - since;
        since = null;
        // 裏に回った時点で送る。ここで送らないと、戻らない読者の分が消える。
        finish();
      };
      document.addEventListener("visibilitychange", onVisibility);
      offs.push(() => document.removeEventListener("visibilitychange", onVisibility));

      /**
       * 離脱の 1 回。**2 度送らない。**
       *
       * 裏に回った後そのまま閉じると `visibilitychange` と `pagehide` が
       * 続けて来る。`done` を見ないと滞在も離脱も 2 件になり、
       * 平均滞在が半分に見える。
       */
      const finish = (): void => {
        if (done) return;
        done = true;
        if (since !== null) visibleMs += Date.now() - since;
        since = null;
        const seconds = Math.min(MAX_DWELL_SECONDS, Math.round(visibleMs / 1000));
        push({ kind: "dwell", dwellSeconds: seconds, positionRatio: scrollRatio() });
        push({ kind: "exit", positionRatio: scrollRatio() });
        flush(true);
      };
      window.addEventListener("pagehide", finish);
      offs.push(() => window.removeEventListener("pagehide", finish));

      return () => {
        for (const off of offs) off();
        // 画面内の移動でこの effect が捨てられるときも、そこまでを 1 回分として送る。
        finish();
      };
    } catch {
      // 計測の準備に失敗しても、記事の表示はこの成否と無関係。
      return;
    }
  }, [siteSlug, articleSlug, endpoint, allowBehaviour, suppressAll]);

  // 表示は持たない。置いた場所によって見た目が変わらないようにするため。
  return null;
}
