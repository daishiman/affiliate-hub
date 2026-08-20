/**
 * 生成 AI の鍵についての決まりごと。
 *
 * **ここに鍵の値そのものは一度も現れない。**
 * この文脈が扱うのは「登録されているか」「いつ誰が入れたか」「末尾 4 文字は何か」
 * までで、値を持つのは `LlmCredentialVaultPort` の実装だけである。
 *
 * --- なぜ値を型から締め出すか ---
 * 「入れないように気をつける」は必ず破られる。実際この案件では、
 * 口はあるのに呼ばれていない・一部の経路からしか呼ばれていない、という穴が
 * 4 回続いた。**気をつけることで守られている決まりは、守られていない。**
 *
 * 鍵の値は、画面にもエラー本文にも記録にもモデルへの入力にも出してはならない。
 * これを規約ではなく**型で**成り立たせる。値を受け取る型がここに無ければ、
 * うっかり詰めることができない。
 */

import type { UserId, WorkspaceId } from "@/domain/shared";
import { domainError, err, ok, validationError } from "@/domain/shared";
import type { DomainError, Result } from "@/domain/shared";

/**
 * 鍵の状態。
 *
 * 消さずに `revoked` を残すのは、**いつ失効させたかが後から要る**ためである。
 * 行ごと消すと「登録された事実」まで消え、漏れたときに何が起きたか追えない。
 */
export type LlmCredentialStatus = "active" | "revoked";

/** 疎通確認の結果。まだ確かめていない状態と、失敗した状態を区別する。 */
export type LlmCredentialVerification = "ok" | "failed";

/**
 * 画面と application 層が見てよい鍵の情報。**値は入っていない。**
 *
 * `last4` を持つのは、複数の鍵を入れ替えたときに
 * 「いま入っているのはどれか」を本人が見分けるためだけである。
 * これ以上を出すと、確認のためという理由で全文表示が復活する。
 */
export type LlmCredentialSummary = {
  readonly workspaceId: WorkspaceId;
  /** 提供元の識別子。名前の一覧はドメインが持たない（`LlmProviderCatalogPort`）。 */
  readonly providerId: string;
  readonly last4: string;
  readonly status: LlmCredentialStatus;
  readonly registeredBy: UserId | null;
  readonly registeredAt: Date;
  readonly lastVerifiedAt: Date | null;
  readonly lastVerification: LlmCredentialVerification | null;
};

/**
 * 鍵として受け付ける形。
 *
 * **提供元ごとの綴りをここに書かない。** `sk-` で始まるかどうかは提供元の都合で、
 * 増えるたびにドメインを直すことになる。ここで見るのは
 * 「秘密として扱えない明らかな形」だけに絞る。
 *
 * 綴りの検査を提供元ごとにやりたい場合は、提供元の目録側へ置く
 * （`LlmProviderCatalogPort` の `keyPattern`）。
 */
/**
 * 登録できる鍵の下限。**切れ端を貼り付けた事故を弾くための値。**
 *
 * 動かすとどちらへ倒れるか: **上げると安全側**（短い値をより多く弾く）。
 * 下げると、鍵の一部だけを貼った登録が通ってしまう。
 *
 * **`SECRET_MATCH_PREFIX_LENGTH` と同じ 20 だが、別の値である。**
 * 2026-08-19 まで 1 つの `MIN_KEY_LENGTH` を両方で使っていた。
 * その状態だと、ここを上げた日に漏洩検出（下記）が黙って鈍る。
 * 値が同じことは、束ねてよい理由にならない。
 */
const MIN_KEY_LENGTH = 20;
const MAX_KEY_LENGTH = 512;

/**
 * 漏洩検出で、鍵の頭を何文字ぶん照合するか（`containsSecret`）。
 *
 * 動かすとどちらへ倒れるか: **上げると危険側。**
 * より長く一致しないと漏洩を検出しなくなる＝**検出が鈍る**。
 * 下げると検出は鋭くなるが、短いほど無関係な文字列に当たる
 * （偶然の一致で「漏れている」と言い出す）。
 *
 * **登録の下限 `MIN_KEY_LENGTH` と一緒に動かしてはいけない。**
 * 鍵の最小長を上げるのは正しい理由で起こりうるが、それに引きずられて
 * ここが上がると、安全性を上げたつもりで安全性を下げることになる。
 */
export const SECRET_MATCH_PREFIX_LENGTH = 20;

/** 空白や改行を含む鍵は、貼り付け事故（前後の空白・複数行の選択）である。 */
const HAS_WHITESPACE = /\s/;

/**
 * 鍵の形を確かめる。**戻り値に鍵を含めない。**
 *
 * 断り文にも鍵を出さない。「`sk-abc...` は短すぎます」と書くと、
 * 画面にもログにも鍵の一部が残る。長さや形だけを言う。
 */
export function checkApiKeyShape(apiKey: string): Result<void, DomainError> {
  if (apiKey === "") {
    return err(validationError("API キーが入力されていません。", "apiKey"));
  }
  if (HAS_WHITESPACE.test(apiKey)) {
    return err(
      validationError(
        "API キーに空白や改行が含まれています。前後の空白ごと貼り付けていないか確かめてください。",
        "apiKey",
      ),
    );
  }
  if (apiKey.length < MIN_KEY_LENGTH) {
    return err(
      validationError(
        `API キーが短すぎます（${MIN_KEY_LENGTH} 文字以上）。値の一部だけを貼り付けていないか確かめてください。`,
        "apiKey",
      ),
    );
  }
  if (apiKey.length > MAX_KEY_LENGTH) {
    return err(validationError(`API キーが長すぎます（${MAX_KEY_LENGTH} 文字以下）。`, "apiKey"));
  }
  return ok(undefined);
}

/**
 * 末尾 4 文字を取り出す。
 *
 * **短い鍵から取らない。** 4 文字しかない値の末尾 4 文字は値そのものである。
 * `checkApiKeyShape` を通っていれば 20 文字以上あるので、ここは念のための堰。
 */
export function last4Of(apiKey: string): Result<string, DomainError> {
  if (apiKey.length < MIN_KEY_LENGTH) {
    return err(
      domainError("VALIDATION_FAILED", "末尾を取り出せる長さがありません。", { field: "apiKey" }),
    );
  }
  return ok(apiKey.slice(-4));
}

/**
 * 文字列から、鍵らしき並びを塗り潰す。
 *
 * --- ここが一番漏れやすい ---
 * 鍵を画面に出さないようにしても、**提供元が返したエラー本文**に鍵が入って
 * そのままログへ流れる、という経路が残る。提供元は「api_key sk-… は無効です」と
 * 書いて返してくることがあり、こちらの都合で止まってくれない。
 *
 * だから出口で塗り潰す。**呼ぶ場所を覚えている必要がない形にする**のが要点で、
 * 記録とログの入口で必ず通す（`redactSensitive` が欄の名前を見るのに対し、
 * こちらは**本文の中身**を見る。両方要る）。
 */
const SECRET_LIKE = [
  // 提供元ごとの接頭辞つきの鍵（sk-…, xai-…, AIza…, sk-ant-…）
  /\b(?:sk|pk|rk|xai|gsk|ak)-[A-Za-z0-9_-]{16,}/g,
  /\bAIza[A-Za-z0-9_-]{20,}/g,
  // Bearer トークン
  /\bBearer\s+[A-Za-z0-9._-]{16,}/gi,
];

export const SECRET_REDACTED = "[伏せました]";

export function redactSecretsInText(text: string): string {
  let out = text;
  for (const pattern of SECRET_LIKE) out = out.replace(pattern, SECRET_REDACTED);
  return out;
}

/**
 * 与えられた鍵の値が、その文字列に出てきていないかを見る。
 *
 * 上の塗り潰しは**形が分かっているものにしか効かない**。提供元が増えれば
 * 知らない形の鍵が来る。呼び出しの場では本物の値を持っているので、
 * そのときは形ではなく**値そのもの**で確かめられる。強いのはこちら。
 *
 * `true` が返ったら、その文字列は外へ出してはいけない。
 */
export function containsSecret(text: string, apiKey: string): boolean {
  // 照合幅に満たない値は、頭を取っても意味のある一致にならないので見ない。
  // ここは登録の下限ではなく、**下の照合幅そのものの前提**である。
  if (apiKey.length < SECRET_MATCH_PREFIX_LENGTH) return false;
  if (text.includes(apiKey)) return true;
  // 末尾を落として貼られる（`sk-abc…` と省略される）ことがあるので、頭も見る
  return text.includes(apiKey.slice(0, SECRET_MATCH_PREFIX_LENGTH));
}
