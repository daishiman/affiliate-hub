"use server";

import { revalidatePath } from "next/cache";
import type { ArticleType } from "@/domain/authoring";
import type { RelationshipType } from "@/domain/compliance";
import { auditArticleForAiSearch } from "@/application/seo/ai-search-audit";
import {
  distributionUseCases,
  notifyIndexNowOfPublish,
  readerActor,
  signedInActor,
  siteUseCases,
} from "@/presentation/composition";
import { requestOriginFromNextHeaders } from "@/presentation/http/request-origin";
import type { PublishArticleFormState } from "./publish-article-state";
import { parseNonEmptyLines } from "./non-empty-lines";
import { failureFromDomainError, notSignedInFailure } from "./use-case-result";

/**
 * 記事に添える言い切りを組み立てる。
 *
 * 欄は行ごとに 4 つ（言い切り・出典名・出典 URL・確認日）並んでおり、
 * 同じ名前で複数回送られてくる。**言い切りが空の行は丸ごと捨てる**。
 * 捨てないと、出典だけ書かれた中身の無い根拠が記事に並ぶ。
 */
function readClaims(formData: FormData) {
  const statements = formData.getAll("claimStatement").map(String);
  const labels = formData.getAll("claimSourceLabel").map(String);
  const urls = formData.getAll("claimSourceUrl").map(String);
  const checkedOn = formData.getAll("claimCheckedOn").map(String);
  return statements
    .map((statement, i) => ({
      statement: statement.trim(),
      sourceLabel: (labels[i] ?? "").trim(),
      sourceUrl: (urls[i] ?? "").trim() === "" ? null : (urls[i] ?? "").trim(),
      checkedOn: (checkedOn[i] ?? "").trim(),
    }))
    .filter((claim) => claim.statement !== "");
}

/**
 * よくある質問を読む。
 *
 * 問いと答えが同じ名前で複数回送られてくる（言い切りと同じ形）。
 * **片方だけの行は捨てる**判断はユースケース側（`buildArticle`）に置いてある。
 * ここで捨てると、AI 経路から呼んだときだけ片側だけの質問が通る。
 */
function readFaq(formData: FormData) {
  const questions = formData.getAll("faqQuestion").map(String);
  const answers = formData.getAll("faqAnswer").map(String);
  return questions.map((question, i) => ({ question, answer: answers[i] ?? "" }));
}

/**
 * 原稿の各節を読む。
 *
 * 欄の名前は `section:<節の識別子>` で、**どの節があるかは画面が決めない**。
 * 画面は `preparePublishArticle` が返した一覧から欄を作るだけなので、
 * ここでは前置きの付いた名前を全部拾えばよい。節が増減しても直さずに済む。
 */
function readSectionBodies(formData: FormData): Record<string, string> {
  const bodies: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("section:")) bodies[key.slice("section:".length)] = String(value);
  }
  return bodies;
}

/**
 * 送られてきた欄を、ユースケースの入力へ写す。
 *
 * 公開（`publishArticleAction`）と公開前の点検（同じ action の分岐）で
 * **同じ関数を通す**。点検のほうへ写しを書くと、点検が見ている記事と
 * 実際に出る記事が別物になり、「点検は通ったのに出たものが違う」が起きる。
 */
function readInput(formData: FormData) {
  const relationship = String(formData.get("relationshipType") ?? "");
  const nextReviewOn = String(formData.get("nextReviewOn") ?? "").trim();
  return {
    publicationId: String(formData.get("publicationId") ?? ""),
    siteSlug: String(formData.get("siteSlug") ?? ""),
    categorySlug: String(formData.get("categorySlug") ?? ""),
    articleType: String(formData.get("articleType") ?? "guide") as ArticleType,
    slug: String(formData.get("slug") ?? "").trim(),
    title: String(formData.get("title") ?? "").trim(),
    conclusion: String(formData.get("conclusion") ?? "").trim(),
    authorName: String(formData.get("authorName") ?? "").trim(),
    authorBio: String(formData.get("authorBio") ?? "").trim(),
    authorCredentials: parseNonEmptyLines(String(formData.get("authorCredentials") ?? "")),
    relationshipType: relationship === "" ? null : (relationship as RelationshipType),
    disclosureMessage: String(formData.get("disclosureMessage") ?? "").trim(),
    nextReviewOn: nextReviewOn === "" ? null : nextReviewOn,
    claims: readClaims(formData),
    // 要点は 1 行 1 項目。裏づけ欄と同じ読み方（`parseNonEmptyLines`）に
    // 揃える。行ごとの欄にすると、書き手が項目数を先に決めることになる。
    keyPoints: parseNonEmptyLines(String(formData.get("keyPoints") ?? "")),
    faq: readFaq(formData),
    sectionBodies: readSectionBodies(formData),
  };
}

/**
 * 自分のブログへ記事を出す操作。
 *
 * ここは画面からの入口で、REST・WebMCP・バックエンド MCP と同じ
 * `publishArticle` ユースケースを呼ぶ。出してよいかの判定（広告表記・
 * 書き手・次回確認日・根拠）は全てユースケースの向こう側にあり、
 * 画面へ写さない。写した時点で「画面からは止まるが AI からは出せる」が生まれる。
 *
 * --- 身元の取り方について ---
 * `currentActor()` ではなく `signedInActor()` を使う。前者は身元を
 * 確かめられないとき**見本の身元へ落ちる**ので、ログインしていない人の操作が
 * ユースケースまで届く。届いた先で断られる回もあるが、断っているのは
 * **役の一覧**（`src/domain/identity/permissions.ts`）で、あれは人が編集する表である。
 * 表に 1 行足せば戻る場所を、唯一の砦にしない。
 *
 * 記事の公開は**押した後に元へ戻す口が無い**。出た記事は読者から見え、
 * 検索にも載る。だから読む前に断る（`ah-dao`）。
 */
export async function publishArticleAction(
  _prev: PublishArticleFormState,
  formData: FormData,
): Promise<PublishArticleFormState> {
  const actor = await signedInActor();
  if (actor === null) {
    // **`formData` を読む前に断る。** 読んでから断ると、断り文が
    // 「この欄が足りません」に化けて、押した人は欄を埋めて何度も試す。
    return notSignedInFailure("記事の公開");
  }

  const input = readInput(formData);
  const useCases = await distributionUseCases();

  /*
   * 押されたのが「公開前に点検する」なら、**何も出さずに点検だけ返す**。
   * 分岐を押したボタン（`name="intent"`）で決めるのは、欄が 1 組しか無い
   * ためである。点検用の画面を別に作ると、そこに写した欄が本番の欄から
   * 遅れて、点検した内容と出す内容がずれる。
   */
  if (String(formData.get("intent") ?? "") === "check") {
    const checked = await useCases.auditArticleDraft.execute(actor, input);
    if (!checked.ok) return failureFromDomainError(checked.error);
    return {
      status: "done",
      phase: "checked",
      // **「公開しました」と読み違えられない文にする。** ここで出したものは
      // まだ読者に見えていない。読者ページへの導線も付かない（url が無い）。
      message: "点検しました。まだ公開していません。直してから、下の「いまサイトに出す」を押してください。",
      skipped: checked.value.skipped,
      aiSearch: checked.value.aiSearch,
    };
  }

  const { publicationId, siteSlug, slug } = input;
  const result = await useCases.publishArticle.execute(actor, input);

  if (!result.ok) {
    /*
     * **理由と次にすることを両方出す。**
     * 次にすることだけを出すと「上記を直してから」のように、
     * 見えていない文を指す案内が画面に残る。
     * 理由だけを出すと、直し方が分からないまま止まる。
     *
     * 共通変換は `refusalText()` を通すので、存在を隠す潰し
     * （`maskExistence`）も操作ごとに書き忘れない。
     */
    return failureFromDomainError(result.error);
  }

  revalidatePath(`/admin/distribution/${publicationId}`);
  revalidatePath("/admin/distribution");
  revalidatePath(result.value.url);

  // 公開できた記事を IndexNow で検索エンジンへ知らせる（feat-blog-ui-builder §SEO/AI 検索）。
  // 通知は公開の条件ではない。skipped/failed でも公開の結果は変えず、記録だけ残す。
  // origin は届いたリクエストから作る（環境変数に持つと環境ごとの値がずれたまま気づけない）。
  const origin = await requestOriginFromNextHeaders();
  const indexNow = await notifyIndexNowOfPublish(actor, origin, result.value.url);

  // 公開した記事を**読者と同じ読み取り口**から読み直し、AI 検索への備え
  // （結論が先か・更新日・著者・出典・説明文の長さ）を点検する。
  // 点検は公開の条件ではない。読み直せなかったときは点検ごと出さない
  // （送った値から推測で点検すると、保存で変わった形とずれた診断を出す）。
  let aiSearch: PublishArticleFormState["aiSearch"];
  if (siteSlug !== "" && slug !== "") {
    const published = await (await siteUseCases()).getArticle.execute(readerActor(), {
      siteSlug,
      slug,
    });
    if (published.ok) aiSearch = auditArticleForAiSearch(published.value);
  }

  return {
    status: "done",
    phase: "published",
    message: "記事を公開しました。下のリンクから、読者に見える形を確かめられます。",
    url: result.value.url,
    skipped: result.value.skipped,
    aiSearch,
    indexNow,
  };
}
