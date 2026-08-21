/**
 * 鍵を包む・開ける（AES-GCM）。
 *
 * ここと `secret-resolver.ts` だけが秘密の値に触れてよい。
 * 違いは出どころで、あちらは**実行環境の設定**（開発者が入れる）、
 * こちらは**利用者が画面から入れた値**を保管庫（D1）へ置くためのものである。
 *
 * --- 決めごと ---
 * - 元締めの鍵（`LLM_KEY_ENCRYPTION_SECRET`）は SHA-256 で 256bit へ均す。
 *   長さがまちまちの文字列をそのまま鍵に使えないため。
 * - IV は 12 バイトの乱数を**毎回**作る。使い回すと AES-GCM は解ける。
 * - 保存する形は `base64(iv || 暗号文)` の 1 本の文字列。
 *   欄を 2 つに分けると、片方だけ移す事故が起きる。
 * - **元締めの鍵が無いときは、平文で置くのではなく機能ごと止める。**
 *   「とりあえず動くように平文で」は、一度やると誰も戻さない。
 *
 * --- 開けられなくなったとき ---
 * 元締めの鍵を替えると、それ以前に包んだ値は開けられない。
 * そのときは復旧を試みず、**利用者に入れ直してもらう**。
 * 旧鍵を残して両方で試す作りにすると、旧鍵を捨てる日が永遠に来ない。
 */

const IV_BYTES = 12;

/** 元締めの鍵が無い／短すぎるときに投げる。呼び出し側はこれを見て機能を止める。 */
export class SecretBoxUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecretBoxUnavailableError";
  }
}

/** 開けられなかった。中身の推測につながることを書かない。 */
export class SecretBoxOpenError extends Error {
  constructor() {
    super("保管されている値を開けませんでした。登録し直してください。");
    this.name = "SecretBoxOpenError";
  }
}

/**
 * 元締めの鍵の下限。
 * 短い合言葉は総当たりで通るため、包んでいる意味が無くなる。
 */
export const MIN_MASTER_SECRET_LENGTH = 32;

async function deriveKey(masterSecret: string): Promise<CryptoKey> {
  if (masterSecret === "") {
    throw new SecretBoxUnavailableError(
      "LLM_KEY_ENCRYPTION_SECRET が設定されていません。API キーの保管は行いません。",
    );
  }
  if (masterSecret.length < MIN_MASTER_SECRET_LENGTH) {
    throw new SecretBoxUnavailableError(
      `LLM_KEY_ENCRYPTION_SECRET が短すぎます（${MIN_MASTER_SECRET_LENGTH} 文字以上）。`,
    );
  }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(masterSecret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** 包む。戻り値は保存してよい文字列で、これ単体からは中身が出ない。 */
export async function sealSecret(plainValue: string, masterSecret: string): Promise<string> {
  const key = await deriveKey(masterSecret);
  const iv = new Uint8Array(IV_BYTES);
  crypto.getRandomValues(iv);
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plainValue)),
  );
  const packed = new Uint8Array(iv.length + cipher.length);
  packed.set(iv, 0);
  packed.set(cipher, iv.length);
  return toBase64(packed);
}

/**
 * 開ける。
 *
 * **失敗の理由を細かく分けない。** 「IV が壊れている」「認証タグが合わない」を
 * 出し分けると、そこから中身を絞り込める。呼び出し側にとっても
 * やることは「入れ直してもらう」の 1 つで変わらない。
 */
export async function openSecret(sealed: string, masterSecret: string): Promise<string> {
  const key = await deriveKey(masterSecret);
  try {
    const packed = fromBase64(sealed);
    if (packed.length <= IV_BYTES) throw new SecretBoxOpenError();
    const iv = packed.slice(0, IV_BYTES);
    const cipher = packed.slice(IV_BYTES);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
    return new TextDecoder().decode(plain);
  } catch {
    throw new SecretBoxOpenError();
  }
}
