/**
 * 同意の保存場所の名前。
 *
 * 読む側 (`src/presentation/telemetry/consent-server.ts`) と
 * 書く側 (`patterns/consent-banner.tsx`) が同じ名前を見るために、
 * ここ 1 箇所に置く。名前を二重に書くと、書いたのに読まれない状態になり、
 * **同意したのに毎回聞かれる**という形で読者に迷惑がかかる。
 */
export const CONSENT_COOKIE = "ah_consent";

/** 半年。長くしすぎると「いつ同意したか」が古くなりすぎる。 */
export const CONSENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

export type ConsentAnswer = "granted" | "denied" | "unset";
