"use server";

import { revalidatePath } from "next/cache";
import { FEEDBACK_DISPOSITIONS, FEEDBACK_STATUSES, KEY_SCOPES } from "@/domain/feedback";
import type { FeedbackDisposition, FeedbackStatus, KeyScope } from "@/domain/feedback";
import { currentActor, feedbackUseCases } from "@/presentation/composition";
import type { FeedbackSubmission } from "@/presentation/ui";
import { refusalText } from "@/presentation/refusal-text";
import type {
  FeedbackHandoffState,
  FeedbackStatusState,
  IntegrationAccessState,
} from "./feedback-state";

/**
 * 改善したいことを受け取る。
 *
 * 画面から呼ぶのはこの関数だけで、中身は
 * **REST / バックエンド MCP と同じユースケース**（`submit_feedback`）を呼ぶ。
 * 画面用の受け口を別に作らない。作った時点で、
 * 「画面から送ったものだけ形式が違う」が静かに生まれる。
 *
 * 権限（`feedback.submit` を持っているか）はユースケース側が見る。
 * ここで見ると、入口ごとに判定が分かれて片方が緩くなる。
 */
export async function submitFeedbackAction(
  submission: FeedbackSubmission,
): Promise<{ readonly message: string }> {
  const capture = submission.capture;
  const image = capture === null ? null : base64ToBytes(capture.imageBase64);
  const result = await (await feedbackUseCases()).submit.execute(await currentActor(), {
    kind: submission.kind,
    body: submission.body,
    wish: submission.wish,
    origin: submission.origin,
    technical: submission.technical,
    capture:
      capture === null || image === null
        ? null
        : {
            image,
            submission: {
              redactionsBurnedIn: capture.redactionsBurnedIn,
              retainsOriginal: capture.retainsOriginal,
              redactionCount: capture.redactionCount,
              maskedElementCount: capture.maskedElementCount,
              byteLength: image.byteLength,
              mimeType: capture.mimeType,
            },
          },
  });

  if (!result.ok) {
    // 「送れません」だけで終わらせない。次にどうすればよいかまで返す。
    return { message: refusalText(result.error) };
  }
  // 画像だけ落ちたことを黙らない。黙ると「隠したはずの箇所」の扱いが分からなくなる。
  const issue = result.value.captureIssue;
  return {
    message:
      issue === null
        ? "送りました。ありがとうございます。"
        : `要望は受け取りました。画面の写しだけは付けられませんでした（${issue}）。`,
  };
}

const LIST_PATH = "/admin/feedback";

/** 一覧と、その 1 件の詳細を作り直す。片方だけ直すと古い方が残る。 */
function refresh(id: string): void {
  revalidatePath(LIST_PATH);
  revalidatePath(`${LIST_PATH}/${id}`);
}

/**
 * 対応状況を変える／扱いを決める／扱いを取り消す。
 *
 * 3 つを 1 つの関数にしてあるのは、ユースケース側が 1 つの口だからである
 * （`update_feedback_status`）。画面側だけ 3 つに割ると、
 * 「状態は変わったが扱いは変わっていない」中途半端な結果が生まれる道ができる。
 */
export async function changeFeedbackStatusAction(
  _prev: FeedbackStatusState,
  formData: FormData,
): Promise<FeedbackStatusState> {
  const id = String(formData.get("id") ?? "");
  const intent = String(formData.get("intent") ?? "");
  const note = String(formData.get("note") ?? "");

  if (id === "") {
    return { status: "failed", message: "どの要望かが分かりませんでした。", field: "id" };
  }

  const input: {
    id: string;
    status?: FeedbackStatus;
    note?: string | null;
    disposition?: { kind: FeedbackDisposition; reason: string; duplicateOf?: string | null };
    undoDisposition?: boolean;
  } = { id, note: note === "" ? null : note };

  if (intent === "status") {
    const raw = String(formData.get("status") ?? "");
    const status = FEEDBACK_STATUSES.find((s) => s === raw);
    if (status === undefined) {
      return { status: "failed", message: "変更後の状態を選んでください。", field: "status" };
    }
    input.status = status;
  } else if (intent === "dispose") {
    const raw = String(formData.get("disposition") ?? "");
    const kind = FEEDBACK_DISPOSITIONS.find((d) => d === raw);
    if (kind === undefined) {
      return { status: "failed", message: "扱いを選んでください。", field: "disposition" };
    }
    const duplicateOf = String(formData.get("duplicateOf") ?? "");
    input.disposition = {
      kind,
      // 理由の必須判定は domain が持つ。ここで先回りして弾くと判定が二重になる。
      reason: String(formData.get("reason") ?? ""),
      duplicateOf: duplicateOf === "" ? null : duplicateOf,
    };
  } else if (intent === "undo") {
    input.undoDisposition = true;
  } else {
    return { status: "failed", message: "何をするかが分かりませんでした。", field: "intent" };
  }

  const result = await (await feedbackUseCases()).updateStatus.execute(await currentActor(), input);
  if (!result.ok) {
    return {
      status: "failed",
      message: refusalText(result.error),
      field: result.error.field,
    };
  }

  refresh(id);
  const disposition = result.value.dispositionLabel;
  return {
    status: "done",
    message:
      disposition === null
        ? `「${result.value.statusLabel}」にしました。`
        : `「${result.value.statusLabel}」・扱いは「${disposition}」です。`,
  };
}

/**
 * 指示文を作る。1 件でも複数件でも同じ道を通る。
 *
 * 下読み（`preview`）と払い出し（`handoff`）を分けてあるのは、
 * **見ただけで「渡した」ことにしない**ため。渡した記録は、
 * 後から「これは誰が持って行ったのか」を答えるための唯一の手がかりになる。
 */
export async function handOffFeedbackAction(
  _prev: FeedbackHandoffState,
  formData: FormData,
): Promise<FeedbackHandoffState> {
  const ids = formData.getAll("ids").map(String).filter((v) => v !== "");
  const previewOnly = String(formData.get("intent") ?? "preview") !== "handoff";

  if (ids.length === 0) {
    return {
      status: "failed",
      message: "先に、渡したい要望を選んでください。",
      prompts: [],
      skipped: [],
      idempotencyText: "",
      previewOnly,
    };
  }

  const result = await (await feedbackUseCases()).handOff.execute(await currentActor(), {
    ids,
    route: "copied_by_human",
    previewOnly,
  });

  if (!result.ok) {
    return {
      status: "failed",
      message: refusalText(result.error),
      prompts: [],
      skipped: [],
      idempotencyText: "",
      previewOnly,
    };
  }

  if (!previewOnly) for (const id of ids) refresh(id);

  const { prompts, skipped, idempotencyText } = result.value;
  return {
    status: "done",
    message: previewOnly
      ? `${prompts.length} 件分の指示文です。まだ「渡した」記録は残していません。`
      : `${prompts.length} 件を払い出し済みにしました。`,
    prompts: prompts.map((p) => ({
      reportId: p.reportId,
      text: p.text,
      templateVersion: p.templateVersion,
    })),
    skipped,
    idempotencyText,
    previewOnly,
  };
}

/**
 * 取りに来るときの鍵を一覧・発行・失効する。
 *
 * 平文が通るのは戻り値の 1 か所だけ。**ここでログに出さない・保存しない。**
 * 出した瞬間、鍵を知る必要のない場所が鍵を知ることになる。
 */
export async function manageIntegrationAccessAction(
  _prev: IntegrationAccessState,
  formData: FormData,
): Promise<IntegrationAccessState> {
  const intent = String(formData.get("intent") ?? "list");

  const input =
    intent === "issue"
      ? {
          action: "issue" as const,
          label: String(formData.get("label") ?? ""),
          scopes: formData
            .getAll("scopes")
            .map(String)
            .filter((s): s is KeyScope => (KEY_SCOPES as readonly string[]).includes(s)),
        }
      : intent === "revoke"
        ? { action: "revoke" as const, id: String(formData.get("id") ?? "") }
        : { action: "list" as const };

  const result = await (await feedbackUseCases()).keys.execute(await currentActor(), input);
  if (!result.ok) {
    return {
      status: "failed",
      message: refusalText(result.error),
      field: result.error.field,
      issuedValue: null,
    };
  }

  revalidatePath("/admin/settings/integration-access");
  return {
    status: "done",
    message:
      input.action === "issue"
        ? result.value.shownOnceText
        : input.action === "revoke"
          ? "この鍵を失効させました。記録は残ります。"
          : "最新の一覧にしました。",
    issuedValue: result.value.issuedValue,
  };
}

/** 画面から来た文字列を、そのまま保存できる形に戻す。判断はここでしない。 */
function base64ToBytes(value: string): ArrayBuffer {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
