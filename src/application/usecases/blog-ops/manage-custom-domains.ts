import type {
  CustomDomainRepositoryPort,
  CustomHostnameProviderPort,
  DomainVerificationInstruction,
} from "@/application/ports/blog-domains";
import type { AuditLogPort } from "@/application/ports/compliance";
import type { IdGeneratorPort } from "@/application/ports/common";
import { auditWriteFailure, buildAuditEntry } from "@/application/audit";
import {
  type CustomDomain,
  defaultHostPath,
  resolveCanonicalHost,
  validateHostname,
} from "@/domain/domains";
import { requireCapability } from "@/domain/identity";
import {
  type ActorContext,
  type DomainError,
  type Result,
  type WorkspaceId,
  err,
  ok,
  validationError,
} from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * ブログの住所（独自ドメイン）を管理画面から扱う。
 *
 * --- 正本が 2 つあることを、この層で吸収する ---
 * 「このドメインを使う」という**意思**はこちら (D1) の正本で、
 * 「所有権が確認できたか・証明書が出たか」という**事実**は向こう
 * (Cloudflare) の正本である。ユースケースの仕事は、その 2 つを
 * 混ぜずに順序どおり運ぶことに尽きる。
 *
 * だから外部呼び出しの失敗を、そのまま操作全体の失敗にしない。
 * 登録の意思は保存できているのに「失敗しました」と返すと、運用者は
 * もう一度登録を押し、同じドメインで `CONFLICT` を受け取る。
 * 済んだことと済んでいないことを分けて `notice` に出す。
 *
 * --- 取り下げは、こちらを先に止める ---
 * `revoke` は保存先を先に落としてから外部の登録を消しに行く。逆順に
 * すると、外部 API が落ちている間は取り下げが一切できなくなる。
 * 読者の配信先を決めているのは `resolveSiteSlugByHost`（`active` の行だけ
 * を見る）なので、こちらを落とした時点で配信は止まる。外部に残った
 * 登録は課金対象になるだけで、読者には届かない。**止めることを外部の
 * 可用性に依存させない。**
 *
 * --- 権限 ---
 * 一覧は `content.read`（記事を書く人も、自分の記事がどの住所で
 * 読まれているかを知る必要がある）。変更は `site.manage`。
 */

export type ManageCustomDomainsDeps = {
  readonly domains: CustomDomainRepositoryPort;
  readonly provider: CustomHostnameProviderPort;
  readonly auditLog: AuditLogPort;
  readonly ids: IdGeneratorPort;
  readonly now: () => Date;
};

export type ManageCustomDomainsInput =
  /** `siteSlug` を省くと workspace 全体の住所一式を返す。 */
  | { readonly action: "read"; readonly siteSlug?: string }
  | { readonly action: "register"; readonly siteSlug: string; readonly hostname: string }
  /** 外部の状態を今すぐ写し取る。定期同期を待たずに確かめたいとき。 */
  | { readonly action: "sync"; readonly siteSlug: string; readonly domainId: string }
  | { readonly action: "set_canonical"; readonly siteSlug: string; readonly domainId: string }
  | {
      readonly action: "revoke";
      readonly siteSlug: string;
      readonly domainId: string;
      readonly reason: string;
    };

export type BlogDomainsView = {
  /** workspace 全体を見ているときは `null`。 */
  readonly siteSlug: string | null;
  readonly domains: readonly CustomDomain[];
  /**
   * いま読者へ見せる住所。独自ドメインが無い／正規が定まらないときは
   * 既定住所 (`/s/<ブログ>`) を指す。画面はこれを出すだけでよい。
   */
  readonly canonical:
    | { readonly kind: "custom"; readonly hostname: string }
    | { readonly kind: "default"; readonly path: string }
    | null;
  /** 直前の操作で受け取った、DNS に置いてもらう設定。 */
  readonly instructions: readonly DomainVerificationInstruction[];
  /**
   * 「済んだが、ここは済んでいない」を伝える一文。失敗ではないので
   * `Result` の err にはしない。
   */
  readonly notice: string | null;
};

export function createManageCustomDomainsUseCase(
  deps: ManageCustomDomainsDeps,
): UseCase<ManageCustomDomainsInput, BlogDomainsView> {
  const { domains, provider } = deps;

  async function record(
    actor: ActorContext,
    entryInput: {
      readonly action:
        | "blog_domain.registered"
        | "blog_domain.synced"
        | "blog_domain.canonical_changed"
        | "blog_domain.revoked";
      readonly targetId: string;
      readonly after: Readonly<Record<string, unknown>>;
      readonly reason?: string;
      readonly doneAlready: string;
    },
  ): Promise<Result<null, DomainError>> {
    const entry = buildAuditEntry(deps, actor, {
      action: entryInput.action,
      targetType: "blog_domain",
      targetId: entryInput.targetId,
      after: entryInput.after,
      reason: entryInput.reason ?? null,
    });
    if (!entry.ok) return entry;
    const appended = await deps.auditLog.append(entry.value);
    if (!appended.ok) {
      return err(auditWriteFailure(entryInput.doneAlready, { targetId: entryInput.targetId }));
    }
    return ok(null);
  }

  /** 変更のあとは必ず読み直す。画面が自前で行を継ぎ足さない。 */
  async function view(
    workspaceId: WorkspaceId,
    siteSlug: string | null,
    extra: {
      readonly instructions?: readonly DomainVerificationInstruction[];
      readonly notice?: string | null;
    } = {},
  ): Promise<Result<BlogDomainsView, DomainError>> {
    const listed =
      siteSlug === null
        ? await domains.listForWorkspace(workspaceId)
        : await domains.listForSite(workspaceId, siteSlug);
    if (!listed.ok) return listed;
    return ok({
      siteSlug,
      domains: listed.value,
      // 正規の住所はブログ 1 本に対してしか決まらない。workspace 全体の
      // 一覧では答えが無いので、でっち上げずに null を返す。
      canonical: siteSlug === null ? null : resolveCanonicalHost(siteSlug, listed.value),
      instructions: extra.instructions ?? [],
      notice: extra.notice ?? null,
    });
  }

  /** 一覧から 1 件を引く。id だけで別ブログの行を触らせない。 */
  async function findOne(
    workspaceId: WorkspaceId,
    siteSlug: string,
    domainId: string,
  ): Promise<Result<CustomDomain, DomainError>> {
    const listed = await domains.listForSite(workspaceId, siteSlug);
    if (!listed.ok) return listed;
    const found = listed.value.find((d) => d.id === domainId);
    return found === undefined
      ? /*
           **欄の名前を付けない。** 対象の住所は行の隠し欄から来るので、
           画面に直せる入力欄が無い。名前を付けると、その欄が出す約束の
           断りになり (`FormResult` は `field` 付きを出さない)、
           断りが正しく作られたまま誰にも見えずに捨てられる。
        */
        err(validationError("このドメインは見つかりませんでした。"))
      : ok(found);
  }

  return {
    async execute(
      actor: ActorContext,
      input: ManageCustomDomainsInput,
    ): Promise<Result<BlogDomainsView, DomainError>> {
      const allowed = requireCapability(
        actor,
        input.action === "read" ? "content.read" : "site.manage",
        "ブログの住所（独自ドメイン）の管理",
      );
      if (!allowed.ok) return allowed;

      const workspaceId = actor.workspaceId;

      if (input.action === "register") {
        /*
         * 形の検証をここでも通す。保存先も同じ検証をするが、外部へ
         * 申し込む前に弾いておかないと、明らかに壊れたホスト名で
         * Cloudflare に行を作ってしまい、あとで掃除が要る。
         */
        const hostname = validateHostname(input.hostname);
        if (!hostname.ok) return hostname;

        const registered = await domains.register(workspaceId, input.siteSlug, hostname.value);
        if (!registered.ok) return registered;

        const recorded = await record(actor, {
          action: "blog_domain.registered",
          targetId: registered.value.id,
          after: { siteSlug: input.siteSlug, hostname: registered.value.hostname },
          doneAlready: `ドメイン「${registered.value.hostname}」を登録しました`,
        });
        if (!recorded.ok) return recorded;

        /*
         * 外部への申し込み。ここが落ちても登録は消さない。
         * 消すと、鍵が未設定の環境では 1 件も登録できないことになり、
         * 「あとで連携する」という運用ができなくなる。
         */
        const requested = await provider.request(registered.value.hostname);
        if (!requested.ok) {
          return view(workspaceId, input.siteSlug, {
            notice:
              `ドメインを登録しました。ただし外部への申し込みができていません` +
              `（${requested.error.message}）。設定を確かめてから「状態を確認」を押してください。`,
          });
        }

        const applied = await domains.applySnapshot(
          workspaceId,
          registered.value.id,
          requested.value,
          deps.now(),
        );
        if (!applied.ok) return applied;
        return view(workspaceId, input.siteSlug, { instructions: requested.value.instructions });
      }

      if (input.action === "sync") {
        const current = await findOne(workspaceId, input.siteSlug, input.domainId);
        if (!current.ok) return current;

        /*
         * 外部 id がまだ無い行は、申し込み自体が済んでいない。
         * `fetch` は空の id で呼べないので、申し込みからやり直す。
         * ここを分けずに片方だけ呼ぶと、登録時に外部が落ちていた行が
         * 永久に `pending` のまま取り残される。
         */
        const external = current.value.externalHostnameId;
        const snapshot =
          external === null
            ? await provider.request(current.value.hostname)
            : await provider.snapshot(external);
        if (!snapshot.ok) return snapshot;

        const applied = await domains.applySnapshot(
          workspaceId,
          input.domainId,
          snapshot.value,
          deps.now(),
        );
        if (!applied.ok) return applied;

        const recorded = await record(actor, {
          action: "blog_domain.synced",
          targetId: input.domainId,
          after: {
            hostname: applied.value.hostname,
            status: applied.value.status,
            certificateStatus: applied.value.certificateStatus,
            lastError: applied.value.lastError,
          },
          doneAlready: `ドメイン「${applied.value.hostname}」の状態を取り直しました`,
        });
        if (!recorded.ok) return recorded;
        return view(workspaceId, input.siteSlug, { instructions: snapshot.value.instructions });
      }

      if (input.action === "set_canonical") {
        const set = await domains.setCanonical(workspaceId, input.siteSlug, input.domainId);
        if (!set.ok) return set;
        const recorded = await record(actor, {
          action: "blog_domain.canonical_changed",
          targetId: input.domainId,
          after: { siteSlug: input.siteSlug, hostname: set.value.hostname, canonical: true },
          doneAlready: `正規の住所を「${set.value.hostname}」にしました`,
        });
        if (!recorded.ok) return recorded;
        return view(workspaceId, input.siteSlug);
      }

      if (input.action === "revoke") {
        const reason = input.reason.trim();
        if (reason === "") {
          return err(
            validationError(
              "取り下げる理由を書いてください。あとで「なぜ止めたか」を辿れなくなります。",
              "reason",
            ),
          );
        }
        const current = await findOne(workspaceId, input.siteSlug, input.domainId);
        if (!current.ok) return current;

        // 先にこちらを止める。外部が落ちていても配信は止まる。
        const revoked = await domains.revoke(workspaceId, input.domainId, reason);
        if (!revoked.ok) return revoked;

        const recorded = await record(actor, {
          action: "blog_domain.revoked",
          targetId: input.domainId,
          after: { hostname: current.value.hostname, status: "revoked" },
          reason,
          doneAlready: `ドメイン「${current.value.hostname}」を取り下げました`,
        });
        if (!recorded.ok) return recorded;

        const external = current.value.externalHostnameId;
        if (external !== null) {
          const released = await provider.release(external);
          if (!released.ok) {
            return view(workspaceId, input.siteSlug, {
              notice:
                `ドメインを取り下げました（読者には届かなくなっています）。` +
                `ただし外部側の登録が残っています（${released.error.message}）。` +
                `課金が続くことがあるため、時間をおいてもう一度お試しください。`,
            });
          }
        }
        return view(workspaceId, input.siteSlug);
      }

      return view(workspaceId, input.siteSlug ?? null);
    },
  };
}

/** 既定住所の見せ方。画面が `/s/` を直接組み立てないための再輸出。 */
export { defaultHostPath };
