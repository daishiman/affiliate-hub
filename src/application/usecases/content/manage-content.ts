import type {
  EditorialContentPackageRepositoryPort,
  EditorialContentVariantRepositoryPort,
  EditorialPersonaRepositoryPort,
} from "@/application/ports/authoring";
import type { EventPublisherPort } from "@/application/ports/common";
import type { PolicyRuleRepositoryPort } from "@/application/ports/compliance";
import {
  CONTENT_STATES,
  type ContentPackage,
  type ContentState,
  type ContentVariant,
  type ContentVariantStatus,
  type QualityReport,
  HUMAN_APPROVAL_REQUIRED,
  allowedNextStates,
  approveVariant,
  runQualityChecks,
  transition,
} from "@/domain/authoring";
import {
  type PolicyCheckResult,
  checkPolicies,
  isPolicyChannelScope,
} from "@/domain/compliance";
import { CHANNEL_CAPABILITIES, type ChannelKind } from "@/domain/distribution";
import { can, requireCapability } from "@/domain/identity";
import {
  type ActorContext,
  type ContentVariantId,
  type DomainError,
  type Result,
  assertSameTenant,
  buildEvent,
  containsCommercial,
  domainError,
  err,
  ok,
  taggedString,
} from "@/domain/shared";
import type { DomainEventName } from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * 記事（媒体別の文章）を運ぶユースケース。
 *
 * 仕様の中心は「承認を飛ばして公開できないこと」。
 * 状態の進み方は domain の `transition` が唯一の判断者で、
 * ここでも画面でも if 文を書き足さない。書き足した瞬間に抜け道ができる。
 *
 * 依存は Editorial 印のポートだけ。報酬のポートは型でも実行時でも入らない。
 */
export type ManageContentDeps = {
  readonly packages: EditorialContentPackageRepositoryPort;
  readonly variants: EditorialContentVariantRepositoryPort;
  readonly personas: EditorialPersonaRepositoryPort;
  /**
   * 表現ポリシー（言ってはいけない書き方の一覧）の読み出し先。
   *
   * **ここを外すと違反は 1 件も出なくなる。**登録されているルールの件数ではなく、
   * この経路が実際に呼ばれていることを検査で固定している
   *（`tests/application/manage-content.test.ts` の「表現ポリシーの検査」）。
   */
  readonly policyRules: PolicyRuleRepositoryPort;
  /**
   * 起きたことの発行先。
   *
   * 記事の文脈から配信や通知の関数を直接呼ばないために置いている。
   * 受け手が増えても、この行より上のコードは変わらない。
   */
  readonly events: EventPublisherPort;
};

/**
 * 起きたことを流す。
 *
 * **流せなかったことを理由に、済んだ操作を失敗にしない。**
 * 承認は保存された時点で成立している。伝達の失敗で承認が消えると、
 * 利用者は「押したのに承認されていない」という最も分かりにくい壊れ方に出会う。
 */
async function emit(
  deps: ManageContentDeps,
  actor: ActorContext,
  name: DomainEventName,
  payload: Readonly<Record<string, unknown>>,
): Promise<void> {
  const event = buildEvent(name, String(actor.workspaceId), new Date(), payload);
  if (!event.ok) return;
  await deps.events.publish(event.value);
}

function guardEditorial(deps: Record<string, unknown>, where: string): void {
  const commercial = containsCommercial(deps);
  if (commercial.length > 0) {
    throw new Error(
      `${where}に商業データのポートが渡されています: ${commercial.join(", ")}。` +
        "記事の並びや承認の判断に報酬を入れることはできません。",
    );
  }
}

/** 内部の状態名を、そのまま画面に出さないための対応表。 */
export const CONTENT_STATE_LABEL: Readonly<Record<ContentState, string>> = {
  IDEA: "着想",
  RESEARCHING: "調査中",
  BRIEF_READY: "構成ができた",
  GENERATED: "下書きができた",
  FACT_CHECK: "事実確認中",
  COMPLIANCE_REVIEW: "表示のきまりを確認中",
  APPROVED: "承認済み",
  SCHEDULED: "公開予約済み",
  PUBLISHED: "公開中",
  MONITORING: "様子を見ている",
  REFRESH_DUE: "見直しの時期",
  ARCHIVED: "取り下げ済み",
};

// --- 進行の一覧（かんばん） -------------------------------------------------

export type ContentCard = {
  readonly variantId: string;
  readonly title: string;
  readonly channel: string;
  readonly summary: string;
  readonly complianceStatus: ContentVariant["complianceStatus"];
  readonly factualityScore: number;
};

export type ContentColumn = {
  readonly state: ContentState;
  readonly label: string;
  readonly items: readonly ContentCard[];
  /** この列から進める先。画面はここを見てボタンを出す。 */
  readonly nextStates: readonly { readonly state: ContentState; readonly label: string }[];
  /** 人の操作が要る移動先かどうか。 */
  readonly humanOnlyNext: readonly ContentState[];
};

export type ContentBoard = {
  readonly columns: readonly ContentColumn[];
  readonly total: number;
  /** 1 本も無いときに、無言の空白ではなく理由を出すための一文。 */
  readonly emptyReason: string | null;
};

export type ListContentBoardInput = { readonly limitPerState?: number };

export function createListContentBoardUseCase(
  deps: ManageContentDeps,
): UseCase<ListContentBoardInput, ContentBoard> {
  guardEditorial(deps, "記事の一覧");
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "content.read", "記事の参照");
      if (!allowed.ok) return allowed;

      const limit = input.limitPerState ?? 20;
      const columns: ContentColumn[] = [];
      let total = 0;

      for (const state of CONTENT_STATES) {
        const listed = await deps.variants.listByState(actor.workspaceId, state, {
          limit,
          cursor: null,
        });
        if (!listed.ok) return listed;

        total += listed.value.items.length;
        const next = allowedNextStates(state);
        columns.push({
          state,
          label: CONTENT_STATE_LABEL[state],
          items: listed.value.items.map(toCard),
          nextStates: next.map((s) => ({ state: s, label: CONTENT_STATE_LABEL[s] })),
          // AI だけでは進められない先。画面で灰色にするのではなく、理由を出すために渡す。
          humanOnlyNext: next.filter((s) => s === "APPROVED" || s === "SCHEDULED" || s === "PUBLISHED"),
        });
      }

      return ok({
        columns,
        total,
        emptyReason:
          total === 0
            ? "まだ記事がありません。商品と根拠を選んで企画を作るところから始めます。"
            : null,
      });
    },
  };
}

function toCard(v: ContentVariant): ContentCard {
  return {
    variantId: String(v.id),
    title: v.title ?? "（見出し未設定）",
    channel: v.channel,
    summary: v.summary,
    complianceStatus: v.complianceStatus,
    factualityScore: v.factualityScore,
  };
}

// --- 記事 1 本 -------------------------------------------------------------

export type GetContentInput = { readonly variantId: string };

export type ContentDetail = {
  readonly variant: ContentVariant;
  readonly package: ContentPackage | null;
  readonly authorName: string | null;
  /** 17 項目の自動確認の結果。実行しなかった項目も理由つきで含む。 */
  readonly quality: QualityReport;
  /**
   * 表現のきまり（薬機法など）に照らした結果。
   *
   * `null` は「違反が無い」ではなく「**確認できていない**」。
   * 理由は `policyUncheckedReason` に入る。画面はこの 2 つを別の見え方にする。
   */
  readonly policy: PolicyCheckResult | null;
  readonly policyUncheckedReason: string | null;
  /**
   * いまの進行の段階（かんばんのどの列にいるか）。
   *
   * `null` は「まだ記録が無い」であって、最初の段階という意味ではない。
   * 分からないものを既定値で埋めると、画面には出発点にいるように見えて、
   * 実際には進めない（保存先の値と食い違う）ことが起きる。
   */
  readonly state: ContentState | null;
  readonly stateLabel: string | null;
  /**
   * ここから進める先。**画面はここを見てボタンを出す。**
   * 画面側で遷移表を書き写すと、進めない先のボタンが出る。
   */
  readonly nextStates: readonly {
    readonly state: ContentState;
    readonly label: string;
    /** 人の操作でしか進めない先。AI の代行では進めない。 */
    readonly humanOnly: boolean;
  }[];
  /** 承認に進めるか。進めない場合は理由。 */
  readonly approvalBlockedReason: string | null;
  /**
   * 配信を作れるか。作れない場合は理由。
   *
   * **画面で判定しない。** 判定を画面へ写すと、REST や AI から呼んだときに
   * 同じ理由が返らず、「画面では出せないのに AI からは出せる」が生まれる。
   * 断る本体は配信のユースケース側にあり、ここは**押す前に伝えるため**の写し。
   */
  readonly publishBlockedReason: string | null;
};

/**
 * 表現のきまりに照らした結果。
 *
 * `result` が `null` のときは**違反 0 件ではない。確認できていない**。
 * この 2 つを同じ形で返すと、確認していないことが緑に見える。
 */
export type PolicyOutcome = {
  readonly result: PolicyCheckResult | null;
  /** 確認できなかった理由。確認できたなら null。 */
  readonly uncheckedReason: string | null;
};

/**
 * 記事 1 本を表現ポリシーに当てる。
 *
 * 分野は企画（`ContentPackage`）が持っている。**企画が読めないときは確認しない**。
 * ここで分野を `general` で埋めると、薬機法・金融・賭博のルールが 1 件も当たらないまま
 * 「違反 0 件」になる。分からないことは分からないまま返す。
 *
 * 参照と承認の両方から呼ぶ。片方だけにすると、画面には違反が出ているのに
 * 承認は通る（またはその逆）という、どちらが本当か決められない状態になる。
 */
async function checkContentPolicies(
  deps: ManageContentDeps,
  actor: ActorContext,
  variant: ContentVariant,
  pkg: ContentPackage | null,
): Promise<Result<PolicyOutcome, DomainError>> {
  if (pkg === null) {
    return ok({
      result: null,
      uncheckedReason:
        "この記事がどの企画のものか分からないため、表現のきまりを確認できていません。企画を選び直してください。",
    });
  }

  const rules = await deps.policyRules.listEnabled(actor.workspaceId);
  if (!rules.ok) return rules;

  /*
   * 出力先の語彙にない値のときは、その媒体固有のルールを当てられない。
   * `tests/domain/policy-channel-scope.test.ts` が配信できる出力先を全部
   * 語彙に入れているので、ここに来るのは保存先の値が壊れているときだけ。
   */
  const channelScope = isPolicyChannelScope(variant.channel) ? variant.channel : "any";

  // 見出しも本文と同じく人が読む。見出しだけ規制を素通りする道を作らない。
  const text = [variant.title ?? "", variant.body].join("\n");

  return ok({
    result: checkPolicies(rules.value, {
      text,
      domainScope: pkg.domainScope,
      channelScope,
    }),
    uncheckedReason: null,
  });
}

export function createGetContentUseCase(
  deps: ManageContentDeps,
): UseCase<GetContentInput, ContentDetail> {
  guardEditorial(deps, "記事の参照");
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "content.read", "記事の参照");
      if (!allowed.ok) return allowed;

      const loaded = await loadVariant(deps, actor, input.variantId);
      if (!loaded.ok) return loaded;
      const variant = loaded.value;

      const pkg = await deps.packages.findById(actor.workspaceId, variant.contentPackageId);
      if (!pkg.ok) return pkg;

      const persona = await deps.personas.findAuthor(actor.workspaceId, variant.authorPersonaId);
      if (!persona.ok) return persona;
      if (persona.value === null) {
        // 書き手が分からないと「書いてよい範囲」を判定できない。
        // 判定できないまま合格を返さない。
        return err(
          domainError("NOT_FOUND", "この記事の書き手の設定が見つかりません。", {
            suggestedAction: "書き手を選び直してから確認してください。",
          }),
        );
      }

      const capability = CHANNEL_CAPABILITIES[variant.channel as ChannelKind];
      const quality = runQualityChecks({
        variant,
        persona: persona.value,
        constraints: {
          channel: capability?.label ?? variant.channel,
          maxBodyLength: capability?.maxBodyLength ?? null,
          // ハッシュタグの上限は能力表に持っていない。
          // 「上限なし」と偽らず、確認しない項目として扱わせる。
          maxHashtags: null,
          allowsAffiliateLink: capability?.allowsAffiliateLinks ?? false,
          requiresInlineDisclosure: capability?.disclosurePlacement !== "platform_tag",
        },
        hasVerifiedTestRun: persona.value.verifiedExperienceIds.length > 0,
        knownFeatureNames: [],
        existingBodies: [],
        priceCheckedAt: null,
        now: new Date(),
      });

      const policy = await checkContentPolicies(deps, actor, variant, pkg.value);
      if (!policy.ok) return policy;

      // いまどこにいるかは保存先に聞く。本文の `status` から言い当てない
      //（承認済みの記事が「公開予約済み」なのか「公開中」なのかは status では分からない）。
      const stored = await deps.variants.findState(actor.workspaceId, variant.id);
      if (!stored.ok) return stored;
      const state = stored.value;

      return ok({
        variant,
        package: pkg.value,
        authorName: persona.value.displayName,
        quality,
        policy: policy.value.result,
        policyUncheckedReason: policy.value.uncheckedReason,
        state,
        stateLabel: state === null ? null : CONTENT_STATE_LABEL[state],
        nextStates:
          state === null
            ? []
            : allowedNextStates(state).map((s) => ({
                state: s,
                label: CONTENT_STATE_LABEL[s],
                humanOnly: HUMAN_APPROVAL_REQUIRED.has(s),
              })),
        approvalBlockedReason: approvalBlockedReasonFor(
          quality.status,
          policy.value,
          variant.status,
          state,
        ),
        publishBlockedReason: publishBlockedReasonFor(actor, variant.status),
      });
    },
  };
}

/**
 * 承認できない理由。できるなら null。
 *
 * 順番は「中身 → 済んでいるか → 段階」。中身に直すべき指摘があるうちは、
 * 段階を進めても承認できないので、そちらを先に伝える。
 *
 * **段階の条件をここに書くのは、承認の本体と同じ理由を押す前に出すため。**
 * 画面だけで判定すると、AI や REST から呼んだときに違う理由が返る。
 */
function approvalBlockedReasonFor(
  qualityStatus: QualityReport["status"],
  policy: PolicyOutcome,
  status: ContentVariantStatus,
  state: ContentState | null,
): string | null {
  const policyReason = policyBlockedReasonFor(policy);
  if (policyReason !== null) return policyReason;
  if (qualityStatus === "fail") {
    return "自動確認で直すべき指摘が出ています。指摘を解消するまで承認できません。";
  }
  if (status === "approved" || status === "published") return "すでに承認済みです。";
  // 記録が無いときは段階で断らない。分からないことを理由にすると、直しようがない。
  if (state === null || state === "COMPLIANCE_REVIEW" || state === "APPROVED") return null;
  return `この記事はまだ「${CONTENT_STATE_LABEL[state]}」です。上の欄で「${CONTENT_STATE_LABEL.COMPLIANCE_REVIEW}」まで進めると承認できます。`;
}

/**
 * 表現のきまりを理由に承認できないときの一文。進めるなら null。
 *
 * **確認できていない場合も止める。** 分野が分からないまま通すと、
 * 薬機法のルールが 1 件も当たっていない記事が「指摘なし」で承認される。
 * 止まったときに何をすればよいかが分かるよう、当たったルール名を出す。
 *
 * 参照（押す前の案内）と承認（実際の拒否）が同じ関数を呼ぶ。
 * 別々に書くと、画面には出ない理由で承認だけが失敗する。
 */
function policyBlockedReasonFor(policy: PolicyOutcome): string | null {
  if (policy.result === null) return policy.uncheckedReason;
  const blocking = policy.result.violations.filter((v) => v.severity === "block");
  if (blocking.length === 0) return null;
  const names = [...new Set(blocking.map((v) => v.ruleName))].join("・");
  return `表現のきまりに反する書き方が ${blocking.length} 件あります（${names}）。直すまで承認できません。`;
}

/**
 * 配信を作れない理由。作れるなら null。
 *
 * 順番は「権限 → 承認」。権限が無い人に「承認してください」と出すと、
 * 承認しても状況が変わらず、直しようのない案内になる。
 */
function publishBlockedReasonFor(actor: ActorContext, status: ContentVariantStatus): string | null {
  if (!can(actor, "content.publish")) {
    return "この記事を出す権限がありません。配信を始められるのは公開の担当だけです。設定の担当者管理で権限を付けてもらってください。";
  }
  if (status !== "approved" && status !== "published") {
    return "承認が済んでいない記事は配信できません。上の自動確認の結果を見て内容を直し、人の目で承認すると、この欄で出し先を選べるようになります。";
  }
  return null;
}

async function loadVariant(
  deps: ManageContentDeps,
  actor: ActorContext,
  variantId: string,
): Promise<Result<ContentVariant, DomainError>> {
  const found = await deps.variants.findById(
    actor.workspaceId,
    taggedString<"ContentVariantId">(variantId) as ContentVariantId,
  );
  if (!found.ok) return found;
  if (found.value === null) {
    return err(
      domainError("NOT_FOUND", "その記事は見つかりませんでした。", {
        suggestedAction: "記事の一覧から選び直してください。",
      }),
    );
  }
  return assertSameTenant(actor, found.value, "記事");
}

// --- 見直しの時期が来たもの -------------------------------------------------

export type ListReviewOverdueInput = { readonly limit?: number };

export type ReviewOverdueOutput = {
  readonly items: readonly ContentCard[];
  readonly emptyReason: string | null;
};

export function createListReviewOverdueUseCase(
  deps: ManageContentDeps,
): UseCase<ListReviewOverdueInput, ReviewOverdueOutput> {
  guardEditorial(deps, "見直し対象の一覧");
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "content.read", "記事の参照");
      if (!allowed.ok) return allowed;

      const listed = await deps.variants.listReviewOverdue(
        actor.workspaceId,
        new Date(),
        input.limit ?? 20,
      );
      if (!listed.ok) return listed;

      return ok({
        items: listed.value.map(toCard),
        emptyReason:
          listed.value.length === 0
            ? "見直しの期日を過ぎた記事はありません。公開済みの記事はすべて期日内です。"
            : null,
      });
    },
  };
}

// --- 状態を進める -----------------------------------------------------------

export type AdvanceContentInput = {
  readonly variantId: string;
  readonly from: ContentState;
  readonly to: ContentState;
};

export type AdvanceContentOutput = {
  readonly variantId: string;
  readonly state: ContentState;
  readonly label: string;
};

/**
 * 状態を進める。
 *
 * 進めてよいかの判断は domain の `transition` だけが持つ。
 * AI サービスアカウントは承認・予約・公開へ進められない（そこで弾かれる）。
 */
export function createAdvanceContentStateUseCase(
  deps: ManageContentDeps,
): UseCase<AdvanceContentInput, AdvanceContentOutput> {
  guardEditorial(deps, "記事の状態変更");
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "content.write", "記事の編集");
      if (!allowed.ok) return allowed;

      const loaded = await loadVariant(deps, actor, input.variantId);
      if (!loaded.ok) return loaded;

      /*
       * いまどこにいるかは**保存先に聞く**。呼び出し側が渡してきた `from` を
       * そのまま信じない。画面を開いたまま別の人が先へ進めていた場合、
       * 古い `from` からの遷移が通ってしまい、後から押したほうが勝つ。
       * 記録がまだ無い場合だけ、渡された `from` を出発点として受け入れる。
       */
      const stored = await deps.variants.findState(actor.workspaceId, loaded.value.id);
      if (!stored.ok) return stored;
      if (stored.value !== null && stored.value !== input.from) {
        return err(
          domainError(
            "CONFLICT",
            `この記事はすでに「${CONTENT_STATE_LABEL[stored.value]}」まで進んでいます。`,
            { suggestedAction: "画面を開き直してから操作してください。" },
          ),
        );
      }

      const moved = transition(input.from, input.to, actor);
      if (!moved.ok) return moved;

      /*
       * **進んだ位置を保存してから成功を返す。** 保存を省くと、押した直後だけ
       * 進んだように見えて、開き直すと元の列に戻る。これは画面から見ると
       * 「操作が効いていない」のか「保存が壊れている」のかを区別できない。
       */
      const kept = await deps.variants.saveState(actor.workspaceId, loaded.value.id, moved.value);
      if (!kept.ok) return kept;

      // 進んだ先そのものが、他の文脈にとっての「起きたこと」になる。
      if (moved.value === "GENERATED") {
        await emit(deps, actor, "content_variant.generated", { variantId: input.variantId });
      }
      if (moved.value === "REFRESH_DUE") {
        await emit(deps, actor, "content.refresh_due", { variantId: input.variantId });
      }

      return ok({
        variantId: input.variantId,
        state: moved.value,
        label: CONTENT_STATE_LABEL[moved.value],
      });
    },
  };
}

// --- 承認 -------------------------------------------------------------------

export type ApproveContentInput = { readonly variantId: string };

export type ApproveContentOutput = {
  readonly variantId: string;
  readonly status: ContentVariant["status"];
};

/**
 * 承認する。
 *
 * `approveVariant` に「人が承認したか」を必ず渡す。
 * ここで `true` を決め打ちにすると AI が単独で承認できてしまうため、
 * 実行している主体が AI サービスアカウントでないことを条件にしている。
 */
export function createApproveContentUseCase(
  deps: ManageContentDeps,
): UseCase<ApproveContentInput, ApproveContentOutput> {
  guardEditorial(deps, "記事の承認");
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "content.approve", "記事の承認");
      if (!allowed.ok) return allowed;

      const loaded = await loadVariant(deps, actor, input.variantId);
      if (!loaded.ok) return loaded;

      /*
       * 表現のきまりは**ここで断る**。画面の案内文だけにすると、
       * REST や AI から直接呼んだときに素通りする。
       * 断る本体は必ず、押した先（ユースケース）に置く。
       */
      const pkg = await deps.packages.findById(actor.workspaceId, loaded.value.contentPackageId);
      if (!pkg.ok) return pkg;
      const policy = await checkContentPolicies(deps, actor, loaded.value, pkg.value);
      if (!policy.ok) return policy;
      const policyReason = policyBlockedReasonFor(policy.value);
      if (policyReason !== null) {
        return err(
          domainError("CONFLICT", policyReason, {
            suggestedAction: "記事の画面で、指摘された書き方を直してから承認してください。",
          }),
        );
      }

      const approved = approveVariant(loaded.value, !actor.isAiServiceAccount);
      if (!approved.ok) return approved;

      /*
       * 承認は**進行の現在地も一緒に動かす**。
       *
       * 片方だけ動かすと、記事は「承認済み」なのにかんばんでは
       * 「表示のきまりを確認中」の列に残る。同じ 1 本について
       * 2 つの答えが同時に見える状態は、どちらが本当か誰にも決められない。
       *
       * 進めてよいかの判断は domain の `transition` に任せる。ここで
       * 「承認済みなら常に APPROVED」と書くと、確認前の記事を承認する道が開く。
       */
      const stored = await deps.variants.findState(actor.workspaceId, loaded.value.id);
      if (!stored.ok) return stored;
      const from = stored.value;
      if (from !== null && from !== "APPROVED") {
        const moved = transition(from, "APPROVED", actor);
        if (!moved.ok) {
          /*
           * ここで残るのは「確認をまだ通っていない記事の承認」だけ
           *（AI 単独の承認は上の権限判定で止まっている）。
           * 遷移表の言葉をそのまま出すと、押した人には何をすればよいか分からない。
           */
          if (moved.error.code === "FORBIDDEN") return moved;
          return err(
            domainError(
              "CONFLICT",
              `この記事はまだ「${CONTENT_STATE_LABEL[from]}」です。「${CONTENT_STATE_LABEL.COMPLIANCE_REVIEW}」まで進めてから承認してください。`,
              { suggestedAction: "記事の進行の画面で、表示のきまりの確認まで進めてください。" },
            ),
          );
        }
      }

      const saved = await deps.variants.save(approved.value);
      if (!saved.ok) return saved;
      if (from !== null && from !== "APPROVED") {
        const kept = await deps.variants.saveState(actor.workspaceId, loaded.value.id, "APPROVED");
        if (!kept.ok) return kept;
      }

      await emit(deps, actor, "content_variant.approved", {
        variantId: input.variantId,
        approvedBy: String(actor.userId ?? "unknown"),
      });

      return ok({ variantId: input.variantId, status: saved.value.status });
    },
  };
}
