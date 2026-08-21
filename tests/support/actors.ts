import type { ActorContext, Role } from "@/domain/shared/tenancy";
import type { WorkspaceId } from "@/domain/shared/ids";

/**
 * テストで使う実行主体。
 *
 * **各テストが自分で `{ workspaceId: "ws-1", userId: ..., roles: [...] }` を書かない。**
 * 書くと、ActorContext に項目が 1 つ増えたときに全テストを直すことになり、
 * 「型を変えるとテストが壊れる」＝変更しにくい状態を、テスト側が作ってしまう。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §4
 */

/** 既定の作業場所。テナント境界の検査では、これと `OTHER_WORKSPACE` を突き合わせる。 */
export const WORKSPACE = "ws-test-main" as WorkspaceId;

/** もう 1 つの作業場所。**他人のデータが見えないこと**を確かめるためだけに存在する。 */
export const OTHER_WORKSPACE = "ws-test-other" as WorkspaceId;

type ActorOverrides = {
  readonly workspaceId?: WorkspaceId;
  readonly userId?: string;
  readonly roles?: readonly Role[];
  readonly isAiServiceAccount?: boolean;
  readonly identified?: boolean;
};

function actor(userId: string, roles: readonly Role[], over: ActorOverrides = {}): ActorContext {
  return {
    workspaceId: over.workspaceId ?? WORKSPACE,
    userId: over.userId ?? userId,
    roles: over.roles ?? roles,
    isAiServiceAccount: over.isAiServiceAccount ?? roles.includes("ai_service_account"),
    /**
     * ここの既定は `true`。**ここに並ぶのは全員、身元を確かめてある人**である。
     *
     * `aNobody` も含めて `true` にしてあるのは、あれが「権限を 1 つも持たない人」で
     * あって「ログインしていない人」ではないため。両者はよく混ざるが、
     * 断られ方が違う（前者は権限で、後者は身元で断られる）。
     *
     * 確かめていない身元でテストしたいときは、本番のコードが実際に返すもの
     * （`readerActor()` / `SAMPLE_ACTOR`）を使う。ここに偽物を足すと、
     * 本番に無い形だけを直して通せてしまう。
     */
    identified: over.identified ?? true,
  };
}

/** 何でもできる人。「権限があれば通る」側の確認に使う。 */
export const anOwner = (over: ActorOverrides = {}) => actor("user-owner", ["owner"], over);

/** 書けるが公開できない人。公開ゲートの確認に使う。 */
export const aWriter = (over: ActorOverrides = {}) => actor("user-writer", ["writer"], over);

/** 公開だけできる人。編集と公開を分けている決まり（§25）の確認に使う。 */
export const aPublisher = (over: ActorOverrides = {}) => actor("user-publisher", ["publisher"], over);

/** 数字を見るだけの人。読み取り専用の確認に使う。 */
export const anAnalyst = (over: ActorOverrides = {}) => actor("user-analyst", ["analyst"], over);

/**
 * AI のサービスアカウント。
 *
 * **原則として公開操作を許可しない**（§25）。
 * ページ内の文章を命令として読み込んだ AI が、勝手に公開まで進める経路を作らないため。
 */
export const anAiAccount = (over: ActorOverrides = {}) =>
  actor("ai-service", ["ai_service_account"], over);

/** 権限を 1 つも持たない人。「拒否される側」の確認に使う。 */
export const aNobody = (over: ActorOverrides = {}) => actor("user-nobody", [], over);

/**
 * 別の作業場所の所有者。
 *
 * テナント分離の検査は、**権限が無い人**ではなく
 * **権限はあるが別の作業場所にいる人**で確かめないと意味がない。
 * 前者は権限検査で落ちるので、テナント検査が抜けていても気づけない。
 */
export const anOutsider = (over: ActorOverrides = {}) =>
  actor("user-outsider", ["owner"], { ...over, workspaceId: over.workspaceId ?? OTHER_WORKSPACE });
