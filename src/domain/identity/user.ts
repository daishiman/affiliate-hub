import {
  type DomainError,
  type Result,
  type UserId,
  err,
  ok,
  validationError,
} from "../shared";

/**
 * Identity & Tenancy コンテキスト / User (§21 E02)。
 *
 * **ここに認証情報 (パスワード・トークン・OAuth の秘密) を持たない。**
 * 本人確認は認証基盤 (Better Auth) の仕事で、ドメインが知るのは
 * 「その人が誰か」を表示・記録するために必要な最小限だけ。
 *
 * 分けておく理由は 2 つ。
 *   1. 認証方式が変わっても (Google → 社内 SSO)、このコンテキストは変わらない。
 *   2. 秘密の値がドメインの型に無ければ、ログや監査に漏れる経路も無い。
 *
 * 「どのワークスペースで何ができるか」は [[Membership]] が持つ。
 * User は複数のワークスペースに属しうるので、ここに WorkspaceId は無い。
 */
export type User = {
  readonly id: UserId;
  /** 画面と監査ログに出す名前。 */
  readonly displayName: string;
  /**
   * 連絡先。認証には使わない (認証基盤側の識別子と一致する保証を置かない)。
   * 承認依頼や公開通知の宛先として使う。
   */
  readonly email: string;
  /**
   * AI サービスアカウントか。
   * 人の判断が要る操作を機械が実行することを止めるため、
   * 役割 (Role) とは別に、アカウント自体の種別としても持つ。
   */
  readonly isServiceAccount: boolean;
  readonly createdAt: Date;
  readonly deactivatedAt: Date | null;
};

/** 秘密の値を取り違えて入れられないよう、名前で弾く。 */
const SECRET_LIKE = /password|secret|token|apikey|api_key/i;

export function createUser(input: {
  id: UserId;
  displayName: string;
  email: string;
  isServiceAccount?: boolean;
  createdAt: Date;
}): Result<User, DomainError> {
  const displayName = input.displayName.trim();
  const email = input.email.trim().toLowerCase();

  if (displayName === "") {
    return err(
      validationError(
        "表示名が必要です。監査ログに誰の操作か残せなくなります。",
        "displayName",
      ),
    );
  }
  if (SECRET_LIKE.test(displayName)) {
    return err(
      validationError(
        "表示名に秘密の値らしき語を含められません。認証情報はここに保存しません。",
        "displayName",
      ),
    );
  }
  // 形式の細かい判定はしない。宛先として使えるかは送信側が確かめる。
  // ここで見るのは「宛先として成立しない形」だけ。
  if (!email.includes("@") || email.startsWith("@") || email.endsWith("@")) {
    return err(
      validationError("連絡先のメールアドレスの形式が正しくありません。", "email"),
    );
  }

  return ok({
    id: input.id,
    displayName,
    email,
    isServiceAccount: input.isServiceAccount ?? false,
    createdAt: input.createdAt,
    deactivatedAt: null,
  });
}

export function isActiveUser(user: User, at: Date): boolean {
  return user.deactivatedAt === null || user.deactivatedAt > at;
}

/**
 * 人の判断として扱えるか。
 * 承認・公開・秘密の登録は、これが false のアカウントには許さない。
 */
export function canActAsHuman(user: User): boolean {
  return !user.isServiceAccount;
}
