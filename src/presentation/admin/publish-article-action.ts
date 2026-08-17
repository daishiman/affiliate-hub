"use server";

import { revalidatePath } from "next/cache";
import type { ArticleType } from "@/domain/authoring";
import type { RelationshipType } from "@/domain/compliance";
import { currentActor, distributionUseCases } from "@/presentation/composition";
import type { PublishArticleFormState } from "./publish-article-state";

/** 1 行 1 件のものを配列にする。空行は落とす。 */
function toLines(value: string): readonly string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

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
 * 自分のブログへ記事を出す操作。
 *
 * ここは画面からの入口で、REST・WebMCP・バックエンド MCP と同じ
 * `publishArticle` ユースケースを呼ぶ。出してよいかの判定（広告表記・
 * 書き手・次回確認日・根拠）は全てユースケースの向こう側にあり、
 * 画面へ写さない。写した時点で「画面からは止まるが AI からは出せる」が生まれる。
 */
export async function publishArticleAction(
  _prev: PublishArticleFormState,
  formData: FormData,
): Promise<PublishArticleFormState> {
  const publicationId = String(formData.get("publicationId") ?? "");
  const relationship = String(formData.get("relationshipType") ?? "");
  const nextReviewOn = String(formData.get("nextReviewOn") ?? "").trim();

  const result = await (await distributionUseCases()).publishArticle.execute(await currentActor(), {
    publicationId,
    siteSlug: String(formData.get("siteSlug") ?? ""),
    categorySlug: String(formData.get("categorySlug") ?? ""),
    articleType: String(formData.get("articleType") ?? "guide") as ArticleType,
    slug: String(formData.get("slug") ?? "").trim(),
    title: String(formData.get("title") ?? "").trim(),
    conclusion: String(formData.get("conclusion") ?? "").trim(),
    authorName: String(formData.get("authorName") ?? "").trim(),
    authorBio: String(formData.get("authorBio") ?? "").trim(),
    authorCredentials: toLines(String(formData.get("authorCredentials") ?? "")),
    relationshipType: relationship === "" ? null : (relationship as RelationshipType),
    disclosureMessage: String(formData.get("disclosureMessage") ?? "").trim(),
    nextReviewOn: nextReviewOn === "" ? null : nextReviewOn,
    claims: readClaims(formData),
    sectionBodies: readSectionBodies(formData),
  });

  if (!result.ok) {
    return {
      status: "failed",
      // **理由と次にすることを両方出す。**
      // 次にすることだけを出すと「上記を直してから」のように、
      // 見えていない文を指す案内が画面に残る。
      // 理由だけを出すと、直し方が分からないまま止まる。
      message:
        result.error.suggestedAction === undefined
          ? result.error.message
          : `${result.error.message} ${result.error.suggestedAction}`,
      field: result.error.field,
    };
  }

  revalidatePath(`/admin/distribution/${publicationId}`);
  revalidatePath("/admin/distribution");
  revalidatePath(result.value.url);

  return {
    status: "done",
    message: "記事を公開しました。下のリンクから、読者に見える形を確かめられます。",
    url: result.value.url,
    skipped: result.value.skipped,
  };
}
