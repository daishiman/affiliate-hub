import { cookies, headers } from "next/headers";
import { CONSENT_COOKIE } from "../ui/consent";
import { DEFAULT_CONSENT_SIGNALS, decideConsent, type ConsentChoice, type ConsentDecision, type ConsentSignals } from "@/domain/analytics/consent";

/**
 * 同意の材料をサーバー側で集める。**ここが唯一の集め場所。**
 *
 * 画面ごとに cookie とヘッダを読むと、片方だけ DNT を見ない画面ができる。
 * 「見ているつもりで見ていない」が最も起きやすいのがここなので、1 箇所に閉じる。
 *
 * 決め方そのものは domain (`decideConsent`) が持つ。ここは材料を渡すだけ。
 */

// 名前の正本は共通UI側 (書く側と同じものを見る)。ここで二重に書かない。
export { CONSENT_COOKIE, CONSENT_COOKIE_MAX_AGE } from "../ui/consent";

function parseChoice(raw: string | undefined): ConsentChoice {
  return raw === "granted" || raw === "denied" ? raw : "unset";
}

/**
 * 自動巡回かどうか。
 *
 * 名乗っている巡回だけを見る。名乗らない巡回を当てにいくと、
 * 普通の読者を巡回と誤判定して数字から落とす方が害が大きい。
 */
function looksLikeBot(userAgent: string): boolean {
  return /bot|crawler|spider|crawling|headlesschrome|lighthouse|preview/i.test(userAgent);
}

export async function readConsentSignals(options: { isPreview?: boolean } = {}): Promise<ConsentSignals> {
  try {
    const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
    const dnt = headerList.get("dnt");
    const gpc = headerList.get("sec-gpc");
    return {
      ...DEFAULT_CONSENT_SIGNALS,
      choice: parseChoice(cookieStore.get(CONSENT_COOKIE)?.value),
      doNotTrack: dnt === "1",
      globalPrivacyControl: gpc === "1",
      isBot: looksLikeBot(headerList.get("user-agent") ?? ""),
      isPreview: options.isPreview ?? false,
    };
  } catch {
    // 画面の外（試験・組み立て時）では読めない。
    // 読めないときは**同意なし**として扱う。安全側に倒す。
    return DEFAULT_CONSENT_SIGNALS;
  }
}

export async function readConsentDecision(options: { isPreview?: boolean } = {}): Promise<ConsentDecision> {
  return decideConsent(await readConsentSignals(options));
}

/** いまの回答。設定画面と読者向けの案内が同じ値を見る。 */
export async function readConsentChoice(): Promise<ConsentChoice> {
  return (await readConsentSignals()).choice;
}
