"use server";

import { revalidatePath } from "next/cache";
import { FEEDBACK_DISPOSITIONS, FEEDBACK_STATUSES, KEY_SCOPES } from "@/domain/feedback";
import type { FeedbackDisposition, FeedbackStatus, KeyScope } from "@/domain/feedback";
// `currentActor` はもう使わない。このファイルの 4 つの操作はすべて
// `signedInActor()` を通す（`ah-dao`）。import を残すと、次に書く人が
// 「使ってよいもの」と読んで戻してしまう。
import { feedbackUseCases, signedInActor } from "@/presentation/composition";
import type { FeedbackSubmission } from "@/presentation/ui";
import { notSignedInText, refusalText } from "@/presentation/refusal-text";
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
 *
 * --- 身元の取り方について ---
 * `currentActor()` ではなく `signedInActor()` を使う。前者は身元を
 * 確かめられないとき**見本の身元へ落ちる**ので、ログインしていない人の操作が
 * ユースケースまで届く。届いた先の砦は**役の一覧**で、あれは人が編集する表である。
 *
 * 要望は消せるので「取り返しがつく」側だが、開いていると
 * **誰でも書ける置き場**になり、画面の写し（画像）まで一緒に預かってしまう。
 * 2026-08-19 の実測では、ログインしていない状態で要望が本当に 1 件増えた（`ah-dao`）。
 */
export async function submitFeedbackAction(
  submission: FeedbackSubmission,
): Promise<{ readonly message: string }> {
  const actor = await signedInActor();
  if (actor === null) {
    // **`submission` を読む前に断る。** 読んでから断ると、断り文が
    // 「本文を書いてください」に化けて、押した人は本文を直して何度も試す。
    return { message: notSignedInText("要望の送信") };
  }

  const capture = submission.capture;
  const image = capture === null ? null : base64ToBytes(capture.imageBase64);
  const result = await (await feedbackUseCases()).submit.execute(actor, {
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
 *
 * --- 身元の取り方について ---
 * `currentActor()` は身元を確かめられないとき見本の身元へ落ちるため、
 * `signedInActor()` を使う。状態は戻せるので「取り返しがつく」側だが、
 * **「対応済み」にされた要望は誰も見に来なくなる**。消されるより静かに効く。
 * 2026-08-19 の実測では、ログインしていない状態で状態が本当に「対応中」へ変わった（`ah-dao`）。
 */
export async function changeFeedbackStatusAction(
  _prev: FeedbackStatusState,
  formData: FormData,
): Promise<FeedbackStatusState> {
  const actor = await signedInActor();
  if (actor === null) {
    // **`formData` を読む前に断る。** 読んでから断ると、断り文が
    // 「変更後の状態を選んでください」に化けて、押した人は選び直して何度も試す。
    return { status: "failed", message: notSignedInText("対応状況の変更") };
  }

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

  const result = await (await feedbackUseCases()).updateStatus.execute(actor, input);
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
 *
 * --- 身元の取り方について ---
 * `currentActor()` は身元を確かめられないとき見本の身元へ落ちるため、
 * `signedInActor()` を使う。ここは**中身を外の道具（AI）へ出す口**で、
 * 出てしまえば戻せない。渡した記録に残る名前も、誰か分からないまま
 * 見本の身元で埋まってしまい、「誰が持って行ったのか」に答えられなくなる。
 * 2026-08-19 の実測では、ログインしていない状態で渡した回数が本当に増えた（`ah-dao`）。
 *
 * 断るときの `previewOnly` は `true` にする。`formData` を読む前に断るので
 * 押した人がどちらを押したかは分からないが、**渡していない**ことだけは確かで、
 * `true` はそれを指す。`false` にすると「渡した」と読める状態が画面に残る。
 */
export async function handOffFeedbackAction(
  _prev: FeedbackHandoffState,
  formData: FormData,
): Promise<FeedbackHandoffState> {
  const actor = await signedInActor();
  if (actor === null) {
    // **`formData` を読む前に断る。** 読んでから断ると、断り文が
    // 「先に、渡したい要望を選んでください」に化けて、押した人は選び直して何度も試す。
    return {
      status: "failed",
      message: notSignedInText("要望の受け渡し"),
      prompts: [],
      skipped: [],
      idempotencyText: "",
      previewOnly: true,
    };
  }

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

  const result = await (await feedbackUseCases()).handOff.execute(actor, {
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
 *
 * --- ログインを見るのは、いちばん先である ---
 * `currentActor()` ではなく `signedInActor()` を使う。前者は確かめられないとき
 * **見本の身元へ落ちる**ので、ログインしていない人の操作が預かり所まで届く。
 * 2026-08-19 の実測では、未ログインのまま鍵が発行されて平文が戻り値に載り、
 * 既に在る鍵を失効させることもできていた（`ah-3xv`）。
 *
 * そのとき本番で断られていたのは、見本の身元が持つ役（`analyst`）が
 * `integration_key.manage` を持たないからである。だが役の一覧は人が編集する表で、
 * **1 行足せば戻る。** 断りが役に寄りかかっている限り、塞がっているように見えて、
 * 塞いでいるのは別の場所である。
 *
 * `ah-5lo`（生成 AI の鍵）と直し方は同じだが、**危ないものの向きが逆である。**
 * あちらは鍵の値が `formData` から入ってくる側で、こちらは `issuedValue` に
 * 平文が入って**出ていく**側である。同じ理由で危ないと書くと、次に読む人が向きを取り違える。
 *
 * 確かめられないとき（`unavailable`）も断る。渡してよいか分からないものは渡さない。
 */
export async function manageIntegrationAccessAction(
  _prev: IntegrationAccessState,
  formData: FormData,
): Promise<IntegrationAccessState> {
  const actor = await signedInActor();
  if (actor === null) {
    // 断り文はここに書かず `notSignedInText()` から取る。同じ文を各所へ写すと、
    // 直すときに片方だけ古くなり、**同じ断りなのに画面ごとに言うことが違う**状態になる。
    return {
      status: "failed",
      message: notSignedInText("取りに来るときの鍵の一覧・発行・失効"),
      issuedValue: null,
    };
  }

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

  const result = await (await feedbackUseCases()).keys.execute(actor, input);
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
