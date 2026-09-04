"use server";

import { revalidatePath } from "next/cache";
import {
  evidenceUseCases,
  rankingCriteriaOptions,
  signedInActor,
} from "@/presentation/composition";
import type {
  ClaimFormState,
  EvidenceFormState,
  TestRunFormState,
} from "./evidence-form-state";
import { readKeyValueLines, readLines } from "./evidence-form-state";
import { failureFromDomainError, notSignedInFailure } from "../use-case-result";

/**
 * 根拠・言えること・検証記録を登録する操作。
 *
 * `currentActor()` ではなく `signedInActor()` を使う理由は
 * `ranking-form-action.ts` と同じで、前者は身元を確かめられないとき
 * **見本の身元へ落ちる**。落ちた身元で根拠が登録されると、
 * 誰が確かめた資料なのか分からないまま記事の裏付けになる。
 *
 * 抜粋の長さ・根拠の要否・点の範囲を断るのはすべて domain 側。
 * 画面へ写すと写した側だけが古くなる。
 */

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

export async function createEvidenceAction(
  _prev: EvidenceFormState,
  formData: FormData,
): Promise<EvidenceFormState> {
  const actor = await signedInActor();
  if (actor === null) return notSignedInFailure("根拠の登録");

  const result = await (await evidenceUseCases()).saveEvidence.execute(actor, {
    type: text(formData, "type"),
    title: text(formData, "title"),
    sourceOwner: text(formData, "sourceOwner"),
    urlOrAssetId: text(formData, "urlOrAssetId"),
    excerptOrSummary: text(formData, "excerptOrSummary"),
    licenseOrPermission: text(formData, "licenseOrPermission"),
    capturedAt: text(formData, "capturedAt"),
  });

  if (!result.ok) return failureFromDomainError(result.error);

  revalidatePath("/admin/evidence");

  return {
    status: "done",
    // 番号を本文に入れる。「登録しました」だけだと、次の画面で
    // 何を指せばよいのか分からず、一覧へ戻って探すことになる。
    message: `根拠「${result.value.title}」を登録しました。番号は ${result.value.evidenceId} です。`,
    evidenceId: result.value.evidenceId,
    claimEntryPath: `/admin/evidence/claims/new?evidence=${encodeURIComponent(result.value.evidenceId)}`,
  };
}

export async function createClaimAction(
  _prev: ClaimFormState,
  formData: FormData,
): Promise<ClaimFormState> {
  const actor = await signedInActor();
  if (actor === null) return notSignedInFailure("言えることの登録");

  const confidenceRaw = text(formData, "confidencePercent");
  const productId = text(formData, "productId");

  const result = await (await evidenceUseCases()).saveClaim.execute(actor, {
    productId,
    statement: text(formData, "statement"),
    type: text(formData, "type"),
    // 1 つの主張が複数の資料に支えられることは普通にある。
    evidenceIds: readLines(String(formData.get("evidenceIds") ?? "")),
    // 空欄は 0% ではなく「決めていない」。0% は「まったく確かでない」で、
    // 意味が違う。決めていないときは、まんなかから始める。
    confidencePercent: confidenceRaw === "" ? 50 : Number(confidenceRaw),
    validFrom: text(formData, "validFrom"),
    validUntil: text(formData, "validUntil"),
  });

  if (!result.ok) return failureFromDomainError(result.error);

  revalidatePath("/admin/evidence");
  revalidatePath(`/admin/products/${encodeURIComponent(productId)}`);

  return {
    status: "done",
    message: `「${result.value.statement}」を登録しました。確かめる人が承認するまでは記事に使えません。`,
    productPath: `/admin/products/${encodeURIComponent(productId)}`,
  };
}

export async function createTestRunAction(
  _prev: TestRunFormState,
  formData: FormData,
): Promise<TestRunFormState> {
  const actor = await signedInActor();
  if (actor === null) return notSignedInFailure("検証記録の登録");

  const normalizedScorePercents: Record<string, number> = {};
  for (const option of rankingCriteriaOptions()) {
    const raw = text(formData, `score_${option.key}`);
    // 空欄は「この観点では測っていない」。0 点と読み替えない。
    if (raw === "") continue;
    normalizedScorePercents[option.key] = Number(raw);
  }

  const result = await (await evidenceUseCases()).saveTestRun.execute(actor, {
    productId: text(formData, "productId"),
    methodVersion: text(formData, "methodVersion"),
    testerIds: readLines(String(formData.get("testerIds") ?? "")),
    equipment: readLines(String(formData.get("equipment") ?? "")),
    environment: readKeyValueLines(String(formData.get("environment") ?? "")),
    rawResults: readKeyValueLines(String(formData.get("rawResults") ?? "")),
    normalizedScorePercents,
    evidenceIds: readLines(String(formData.get("evidenceIds") ?? "")),
    startedAt: text(formData, "startedAt"),
    completedAt: text(formData, "completedAt"),
  });

  if (!result.ok) return failureFromDomainError(result.error);

  revalidatePath("/admin/evidence");
  // 点を入れる画面はこの記録の番号を根拠として書く。
  revalidatePath("/admin/rankings/scores");

  return {
    status: "done",
    message: `検証記録（方法 ${result.value.methodVersion}）を登録しました。番号は ${result.value.testRunId} です。`,
    testRunId: result.value.testRunId,
  };
}
