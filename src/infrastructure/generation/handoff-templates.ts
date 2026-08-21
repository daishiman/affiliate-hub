import type { HandoffTemplatePort } from "@/application/ports/feedback";
import { ok } from "@/domain/shared";

/**
 * 作業する側（Claude Code）へ渡す指示文のひな型。版番号つき。
 *
 * ここにあるのは**文面だけ**。何を入れてよいか・利用者の文章をどう囲うかという
 * 規則は `domain/feedback/handoff-prompt.ts` にある。分けてあるのは、
 * 文面を直すたびに安全の判断をやり直さずに済むようにするため。
 *
 * 差し込めるのは `{{...}}` で、使える名前は `HandoffEnvelope` にあるものだけ。
 * 名前を増やすときは domain 側の一覧を先に直す（直さないと組み立てが失敗する）。
 *
 * **この文面には、こちらが持っている値しか出てこない。**
 * 送った人の名乗りや連絡先、画面の写しはここを通らない。
 *
 * 版を上げると指紋が変わる。指紋が変わると、同じ要望でも
 * 「前と違う指示文になった」と払い出しの記録が拒む（handoff.ts）。
 * したがって版を上げるのは、文面を実際に直したときだけにする。
 */
export const HANDOFF_TEMPLATE_VERSION = "1";

const TEMPLATE = [
  "# 改善要望の引き継ぎ",
  "",
  "利用中のアプリから届いた改善要望です。下の「利用者が書いた文章」を読んで、",
  "直すべき箇所を調べ、直し方を提案してください。",
  "",
  "## どこから届いたか",
  "",
  "- 種類: {{kind}}",
  "- 画面: {{screenName}}",
  "- 画面の場所: {{route}}",
  "- URL: {{url}}",
  "- 作業場所: {{workspaceId}}",
  "- ブランド: {{brandId}}",
  "- サイト: {{siteId}}",
  "",
  "## そのとき自動で分かったこと",
  "",
  "- 画面側で出ていたエラー: {{jsErrorCount}} 件",
  "- 失敗した通信: {{failedRequestCount}} 件",
  "- 伏せた項目: {{redactedCount}} 件",
  "",
  "件数が 0 でない場合は、まず該当の画面をその場所で開いて再現を試してください。",
  "",
  "## 進め方",
  "",
  "1. 再現する手順を先に確かめる（再現しないなら、その旨を報告する）",
  "2. 直す範囲を 1 つに絞る",
  "3. 直す前に、壊れたことが分かる検査を足す",
  "",
].join("\n");

/**
 * いまの文面を返す。
 *
 * 保存先を持たないのは、文面がコードと一緒に版管理されているため。
 * 画面から編集できるようにすると、どの文面で渡したものかを別に記録する必要が出る。
 */
export function createHandoffTemplates(): HandoffTemplatePort {
  return {
    async current() {
      return ok({ version: HANDOFF_TEMPLATE_VERSION, template: TEMPLATE });
    },
  };
}
