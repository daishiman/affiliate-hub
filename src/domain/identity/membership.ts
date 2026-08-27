import {
  type BrandId,
  type DomainError,
  type MembershipId,
  type Result,
  type Role,
  type UserId,
  type WorkspaceId,
  coversBrandScope,
  err,
  ok,
  validationError,
} from "../shared";

/**
 * Identity & Tenancy コンテキスト / Membership。
 *
 * 「誰が、どのワークスペースで、何をできるか」を持つ。
 * ユーザー本体 (認証情報) は認証基盤 (Better Auth) 側にあり、
 * ドメインが知っているのは `UserId` と、**招待を出した先のアドレス**だけである。
 *
 * --- なぜアドレスをドメインが持つのか（2026-08-21 に足した） ---
 * 招待は「まだ一度も入っていない人」に対して出す。その時点で `UserId` は無い
 * （認証基盤の利用者は、初回ログインで初めて出来る）。アドレスを持たないと
 * **招待という状態そのものを表せず**、入ってよい人の行を画面から作れない。
 * 実際そうなっていて、担当者の行は seed か手作業でしか作れなかった。
 *
 * アドレスは認証方式ではない。Google をやめてメールリンクに変えても、
 * 「誰宛に出した招待か」は残る。ここに置いてよいのはそのためである。
 *
 * **`AUTH_ALLOWED_EMAILS`（名簿）とは別物。** 名簿は「Google の確認を通してよいか」、
 * こちらは「どの作業場所の何の役か」。片方だけでは入れない。
 * 1 つにまとめると、環境変数を書き換えるだけで権限が変わる状態になる。
 */
export type Membership = {
  readonly id: MembershipId;
  readonly workspaceId: WorkspaceId;
  /** 認証基盤の利用者。`null` は「招待したが、まだ一度も入っていない」。 */
  readonly userId: UserId | null;
  /**
   * 招待したアドレス。**小文字で持つ**（`normalizeInvitedEmail`）。
   * 初回ログインのとき、Google が返したアドレスと突き合わせる唯一の手がかり。
   */
  readonly invitedEmail: string;
  readonly roles: readonly Role[];
  /**
   * 権限を及ぼす範囲。空配列は「ワークスペース全体」。
   * ブランド単位で担当を分けるとき (外部ライターなど) に使う。
   */
  readonly scopedBrandIds: readonly BrandId[];
  /** 表示名。監査ログや承認履歴に人の名前を出すため。 */
  readonly displayName: string;
  readonly invitedAt: Date;
  readonly acceptedAt: Date | null;
  readonly revokedAt: Date | null;
};

/**
 * 招待アドレスの正規化。**保存する前に必ず通す。**
 *
 * 大文字小文字を揃えるのは、Google が返すアドレスと突き合わせる側
 * （`session-issuer`）が小文字で引くため。片方だけ揃えると、
 * 「招待したのに入れない」という、画面からは何も見えない壊れ方になる。
 */
export function normalizeInvitedEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * アドレスの形の確認。
 *
 * **ここで見るのは形だけ**である。実在するかは分からないし、確かめない。
 * 確かめられるのは「その人が Google の確認を通って入ってきたとき」だけで、
 * それは招待を出す時点より後になる。形だけを見るのは、
 * `a@b` のような打ち間違いを保存させないため。
 */
function isEmailShaped(email: string): boolean {
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email);
}

export function createMembership(input: {
  id: MembershipId;
  workspaceId: WorkspaceId;
  /** 省略時は `null`（＝招待しただけで、まだ誰も受け取っていない）。 */
  userId?: UserId | null;
  invitedEmail: string;
  roles: readonly Role[];
  scopedBrandIds?: readonly BrandId[];
  displayName: string;
  invitedAt: Date;
}): Result<Membership, DomainError> {
  const invitedEmail = normalizeInvitedEmail(input.invitedEmail);
  if (invitedEmail === "") {
    return err(
      validationError(
        "招待するアドレスが必要です。アドレスが無いと、入ってきた人とこの行を結び付けられません。",
        "invitedEmail",
      ),
    );
  }
  if (!isEmailShaped(invitedEmail)) {
    return err(
      validationError("メールアドレスの形になっていません。", "invitedEmail"),
    );
  }
  if (input.roles.length === 0) {
    return err(validationError("役割を 1 つ以上指定してください。", "roles"));
  }
  if (input.displayName.trim() === "") {
    return err(
      validationError(
        "表示名が必要です。承認履歴に誰の操作か残せなくなります。",
        "displayName",
      ),
    );
  }
  // owner は 1 ワークスペースに 1 人。ここでは単独指定であることだけ確認し、
  // 「既存の owner がいないか」は application 層のユースケースが確認する
  // (ドメインは他のメンバーを知らないため)。
  if (input.roles.includes("owner") && input.roles.length > 1) {
    return err(
      validationError("owner は他の役割と併用できません。", "roles"),
    );
  }
  if (input.roles.includes("ai_service_account") && input.roles.length > 1) {
    return err(
      validationError(
        "AI サービスアカウントに人の役割を併せて付けることはできません。",
        "roles",
      ),
    );
  }
  return ok({
    id: input.id,
    workspaceId: input.workspaceId,
    userId: input.userId ?? null,
    invitedEmail,
    roles: input.roles,
    scopedBrandIds: input.scopedBrandIds ?? [],
    displayName: input.displayName.trim(),
    invitedAt: input.invitedAt,
    acceptedAt: null,
    revokedAt: null,
  });
}

/**
 * 役割を差し替える。
 *
 * **新しく作り直さない。** 作り直すと `acceptedAt` が `null` に戻り、
 * 参加済みの人が「招待中」へ巻き戻る。役割を変えただけで
 * その人が入り直しになるのは、画面からは理由の分からない壊れ方である。
 *
 * 役割の組み合わせの決まり（owner の単独指定など）は `createMembership` と
 * 同じものを使う。同じ規則を 2 か所に書くと、片方だけ直る。
 */
export function changeMembershipRoles(
  m: Membership,
  roles: readonly Role[],
): Result<Membership, DomainError> {
  if (m.revokedAt !== null) {
    return err(
      validationError(
        "担当から外した人の役割は変えられません。もう一度招待してください。",
        "roles",
      ),
    );
  }
  const rebuilt = createMembership({
    id: m.id,
    workspaceId: m.workspaceId,
    invitedEmail: m.invitedEmail,
    roles,
    scopedBrandIds: m.scopedBrandIds,
    displayName: m.displayName,
    invitedAt: m.invitedAt,
  });
  if (!rebuilt.ok) return rebuilt;
  // 検査だけ借りて、状態は元の行から引き継ぐ。
  return ok({ ...m, roles: rebuilt.value.roles });
}

/**
 * 担当から外す。**行は消さない。**
 *
 * 消すと、その人が過去に承認した記録が誰のものか分からなくなる。
 * 外した日を入れることで、記録は残ったまま、次のログインから入れなくなる
 * （`session-issuer` は `revoked_at` の入った行を招待として数えない）。
 */
export function revokeMembership(m: Membership, at: Date): Membership {
  return m.revokedAt === null ? { ...m, revokedAt: at } : m;
}

export function isActiveMembership(m: Membership, at: Date): boolean {
  if (m.revokedAt !== null && m.revokedAt <= at) return false;
  return m.acceptedAt !== null;
}

/** そのブランドを扱えるか。scopedBrandIds が空なら全ブランド。 */
export function coversBrand(m: Membership, brandId: BrandId): boolean {
  return coversBrandScope(m, brandId);
}
