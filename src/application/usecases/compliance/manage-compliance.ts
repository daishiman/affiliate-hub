import type { AuditLogPort, DisclosureRepositoryPort, PolicyRuleRepositoryPort } from "@/application/ports/compliance";
import { type AuditClock, auditWriteFailure, buildAuditEntry } from "@/application/audit";
import type { Disclosure, PolicyRule } from "@/domain/compliance";
import {
  type PolicyChannelScope,
  type PolicyDomainScope,
  type PolicySeverity,
  createDisclosure,
  createPolicyRule,
  isEditorialInfluence,
  isPolicyChannelScope,
  isPolicyDomainScope,
  isPolicySeverity,
  isRelationshipType,
} from "@/domain/compliance";
import { requireCapability } from "@/domain/identity";
import {
  type ActorContext,
  type DisclosureId,
  type DomainError,
  type PolicyRuleId,
  type Result,
  domainError,
  err,
  ok,
  taggedString,
  validationError,
} from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * 広告表記と表記のきまりを**変える**口（REQ-SEC07 / REQ-SEC09 / REQ-QC11）。
 *
 * --- なぜこの 2 つを 1 つのファイルに置くか ---
 * どちらも「読者へ何をどう示すか」の取り決めで、必要な権限も同じ
 * （`workspace.manage`。人だけが行える）。分けると、権限の確認と
 * 記録の書き出しが 2 か所に散り、片方だけ緩いまま残る。
 * 担当者の 3 操作を 1 つの口にしてあるのと同じ理由である。
 *
 * --- なぜ AI に開かないか ---
 * `workspace.manage` は `HUMAN_ONLY_CAPABILITIES` に入っている。
 * ここで変えられるのは**違反を検出するきまりそのもの**なので、
 * AI に開くと「自分が書いた文に当たるきまりを外す」経路が生まれる。
 * 検出される側が検出の条件を変えられる形にしない。
 *
 * --- 記録が書けなければ、操作を成功として返さない ---
 * 仕様 §26 が必ず記録すると定めている 3 つのうちの 1 つが
 * 「広告表記・ランキング基準の変更」である。規制対応で提出を求められうる記録で、
 * **後から書き足せない**。連絡（`events`）とは扱いが逆で、こちらは fail-closed。
 */
export type ManageComplianceDeps = {
  readonly disclosures: DisclosureRepositoryPort;
  readonly policyRules: PolicyRuleRepositoryPort;
  readonly auditLog: AuditLogPort;
} & AuditClock;

// --- 広告表記 ---------------------------------------------------------------

export type EditDisclosureInput = {
  /** 空なら新規。既にある表記を直すときは、その ID。 */
  readonly disclosureId?: string;
  /**
   * 関係の種類と関与の範囲は、**文字列で受けて domain の判定で落とす。**
   * 型で受けると、画面から来た綴りの違う値が型の上でだけ正しくなり、
   * 読者に出る文の先頭が `undefined` のまま保存される。
   */
  readonly relationshipType: string;
  readonly advertiserOrSupplier?: string | null;
  readonly editorialInfluence: string;
  readonly aiAssisted: boolean;
  readonly reason?: string;
};

export type EditDisclosureOutput = {
  readonly disclosureId: string;
  /** 読者に出る文。**画面で組み立て直させない**ので、ここから返す。 */
  readonly visibleMessage: string;
  readonly message: string;
};

/**
 * 空白だけの理由は「書かれていない」と同じに扱う。
 *
 * 画面の入力欄は未入力でも空文字を送ってくるので `?? 既定値` では拾えない。
 * 空のまま記録へ渡すと、`disclosure.changed` は理由が要る操作なので断られ、
 * **保存は済んでいるのに操作全体が失敗したように見える。**
 */
function reasonOr(given: string | undefined, fallback: string): string {
  const trimmed = (given ?? "").trim();
  return trimmed === "" ? fallback : trimmed;
}

/** 記録に残す形。表示文は入れる（**何が読者に出ることになったか**が記録の要点）。 */
function disclosureSnapshot(d: Disclosure): Readonly<Record<string, unknown>> {
  return {
    relationshipType: d.relationshipType,
    advertiserOrSupplier: d.advertiserOrSupplier,
    editorialInfluence: d.editorialInfluence,
    aiAssisted: d.aiAssisted,
    visibleMessage: d.visibleMessage,
  };
}

/**
 * 広告表記を登録・変更する。
 *
 * 表示文は受け取らない。domain の `buildVisibleMessage()` が組み立てたものを保存する。
 * 画面から文を受け取れる形にすると必ず短縮され、「PR」だけの判別しにくい表示になる。
 */
export function createEditDisclosureUseCase(
  deps: ManageComplianceDeps,
): UseCase<EditDisclosureInput, EditDisclosureOutput> {
  return {
    async execute(
      actor: ActorContext,
      input: EditDisclosureInput,
    ): Promise<Result<EditDisclosureOutput, DomainError>> {
      const allowed = requireCapability(actor, "workspace.manage", "広告表記の変更");
      if (!allowed.ok) return allowed;

      if (!isRelationshipType(input.relationshipType)) {
        return err(
          validationError(
            "その関係の種類は選べません。一覧にあるものから選んでください。",
            "relationshipType",
          ),
        );
      }
      if (!isEditorialInfluence(input.editorialInfluence)) {
        return err(
          validationError(
            "その関与の範囲は選べません。一覧にあるものから選んでください。",
            "editorialInfluence",
          ),
        );
      }

      const givenId = (input.disclosureId ?? "").trim();
      const isNew = givenId === "";

      /*
       * 直すときは先に引く。引かずに保存すると、**変更前が記録に残らない**。
       * 前が無い記録は「いつからその表記だったか」に答えられず、
       * 規制対応で出せる記録にならない。
       */
      let before: Disclosure | null = null;
      if (!isNew) {
        const found = await deps.disclosures.findById(
          actor.workspaceId,
          taggedString<"DisclosureId">(givenId) as DisclosureId,
        );
        if (!found.ok) return found;
        if (found.value === null) {
          return err(
            domainError("NOT_FOUND", "その広告表記は見つかりませんでした。", {
              field: "disclosureId",
              suggestedAction: "一覧を開き直して、直したい行からやり直してください。",
            }),
          );
        }
        before = found.value;
      }

      const built = createDisclosure({
        id: isNew
          ? (taggedString<"DisclosureId">(`dc_${deps.ids.newId()}`) as DisclosureId)
          : (taggedString<"DisclosureId">(givenId) as DisclosureId),
        workspaceId: actor.workspaceId,
        relationshipType: input.relationshipType,
        advertiserOrSupplier: input.advertiserOrSupplier ?? null,
        editorialInfluence: input.editorialInfluence,
        aiAssisted: input.aiAssisted,
      });
      if (!built.ok) return built;

      const saved = await deps.disclosures.save(built.value);
      if (!saved.ok) return saved;

      const entry = buildAuditEntry(deps, actor, {
        action: "disclosure.changed",
        targetType: "disclosure",
        targetId: String(built.value.id),
        before: before === null ? null : disclosureSnapshot(before),
        after: disclosureSnapshot(built.value),
        reason: reasonOr(input.reason, isNew ? "広告表記を登録した" : "広告表記を変えた"),
      });
      if (!entry.ok) return entry;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(
          auditWriteFailure(
            isNew ? "広告表記は保存されています" : "広告表記の変更は保存されています",
            { disclosureId: String(built.value.id) },
          ),
        );
      }

      return ok({
        disclosureId: String(built.value.id),
        visibleMessage: built.value.visibleMessage,
        message:
          `${isNew ? "広告表記を登録しました" : "広告表記を変えました"}。` +
          "この文は記事の冒頭・比較表・AI の回答で同じものが出ます。",
      });
    },
  };
}

// --- 表記のきまり -----------------------------------------------------------

export type PolicyRuleRow = {
  readonly ruleId: string;
  readonly name: string;
  readonly domainScope: PolicyDomainScope;
  readonly channelScope: PolicyChannelScope;
  readonly severity: PolicySeverity;
  readonly pattern: string;
  readonly basis: string;
  readonly suggestion: string;
  readonly enabled: boolean;
};

export type ListPolicyRulesOutput = {
  readonly rows: readonly PolicyRuleRow[];
  readonly emptyReason: string | null;
};

/**
 * 効いている表記のきまりの一覧。
 *
 * **止まっているきまりは出てこない。** 読み口（`listEnabled`）が
 * 効いているものだけを返すためで、これは意図した形である。
 * 画面が見せるのは「いま記事に当たるきまり」で、止めたものを並べると
 * どれが実際に効いているのかが読めなくなる。止めたものを戻すのは
 * 記録（`policy_rule.changed`）から ID を引いて行う。
 */
export function createListPolicyRulesUseCase(
  deps: Pick<ManageComplianceDeps, "policyRules">,
): UseCase<Record<string, never>, ListPolicyRulesOutput> {
  return {
    async execute(actor: ActorContext): Promise<Result<ListPolicyRulesOutput, DomainError>> {
      const allowed = requireCapability(actor, "content.read", "表記のきまりの参照");
      if (!allowed.ok) return allowed;

      const listed = await deps.policyRules.listEnabled(actor.workspaceId);
      if (!listed.ok) return listed;

      const rows = listed.value.map((r): PolicyRuleRow => ({
        ruleId: String(r.id),
        name: r.name,
        domainScope: r.domainScope,
        channelScope: r.channelScope,
        severity: r.severity,
        pattern: r.pattern,
        basis: r.basis,
        suggestion: r.suggestion,
        enabled: r.enabled,
      }));

      return ok({
        rows,
        /*
         * ここが空になるのは**普通ではない**。初期ルール 13 件が常に返るので、
         * 0 件は「全部止めた」か「読み出しが壊れている」のどちらかである。
         * 「まだ登録されていません」とは書かない。書くと、
         * 確認が効いていない状態を「これから始めるところ」に見せてしまう。
         */
        emptyReason:
          rows.length === 0
            ? "効いているきまりが 1 件もありません。この状態では、記事の表現は何も確認されません。"
            : null,
      });
    },
  };
}

export type EditPolicyRuleInput =
  /** 足す・直す。既にあるきまり（初期ルールを含む）を直すときは、その ID。 */
  | {
      readonly action: "save";
      readonly ruleId?: string;
      readonly name: string;
      readonly domainScope: string;
      readonly channelScope: string;
      readonly severity: string;
      readonly pattern: string;
      readonly ignoreCase?: boolean;
      readonly basis: string;
      readonly suggestion: string;
      readonly reason?: string;
    }
  /** 効かせる・止める。**行は消さない**（消すと過去の確認の根拠が読めなくなる）。 */
  | {
      readonly action: "set_enabled";
      readonly ruleId: string;
      readonly enabled: boolean;
      readonly reason?: string;
    };

export type EditPolicyRuleOutput = {
  readonly ruleId: string;
  readonly message: string;
};

function ruleSnapshot(r: PolicyRule): Readonly<Record<string, unknown>> {
  return {
    name: r.name,
    domainScope: r.domainScope,
    channelScope: r.channelScope,
    severity: r.severity,
    pattern: r.pattern,
    ignoreCase: r.ignoreCase,
    basis: r.basis,
    suggestion: r.suggestion,
    enabled: r.enabled,
  };
}

/**
 * 表記のきまりを足す・直す・止める。
 *
 * --- 語彙を型で通さない ---
 * 分野・出力先・強さは画面から文字列で来る。そのまま `PolicyRule` へ入れると
 * 型の上でだけ正しい別物が保存され、**そのきまりはどの記事にも当たらないまま
 * 一覧に並ぶ**。domain の判定関数（`isPolicyDomainScope` など）で先に落とす。
 *
 * --- 止めるのは `enabled: false` の保存である ---
 * 行を消す口は保存先にも置いていない。消せる形にすると、
 * 過去の記事がどのきまりで確認されたのかが後から辿れなくなる。
 */
export function createEditPolicyRuleUseCase(
  deps: ManageComplianceDeps,
): UseCase<EditPolicyRuleInput, EditPolicyRuleOutput> {
  return {
    async execute(
      actor: ActorContext,
      input: EditPolicyRuleInput,
    ): Promise<Result<EditPolicyRuleOutput, DomainError>> {
      const allowed = requireCapability(actor, "workspace.manage", "表記のきまりの変更");
      if (!allowed.ok) return allowed;

      if (input.action === "set_enabled") {
        const found = await deps.policyRules.findById(
          actor.workspaceId,
          taggedString<"PolicyRuleId">(input.ruleId) as PolicyRuleId,
        );
        if (!found.ok) return found;
        if (found.value === null) {
          return err(
            domainError("NOT_FOUND", "そのきまりは見つかりませんでした。", {
              field: "ruleId",
              suggestedAction: "一覧を開き直して、対象の行からやり直してください。",
            }),
          );
        }
        const before = found.value;
        if (before.enabled === input.enabled) {
          /*
           * 変わらない保存を**記録として残さない**。
           * 残すと、押した回数だけ「変えた」行が積み上がり、
           * 一覧から「実際に何が変わった日か」を読めなくなる。
           */
          return ok({
            ruleId: String(before.id),
            message: `「${before.name}」は、すでに${input.enabled ? "効いています" : "止まっています"}。`,
          });
        }
        const next: PolicyRule = { ...before, enabled: input.enabled };
        const saved = await deps.policyRules.save(next);
        if (!saved.ok) return saved;

        const entry = buildAuditEntry(deps, actor, {
          action: "policy_rule.changed",
          targetType: "policy_rule",
          targetId: String(next.id),
          before: ruleSnapshot(before),
          after: ruleSnapshot(next),
          reason: reasonOr(
            input.reason,
            input.enabled ? "表記のきまりを効かせた" : "表記のきまりを止めた",
          ),
        });
        if (!entry.ok) return entry;
        const appended = await deps.auditLog.append(entry.value);
        if (!appended.ok) {
          return err(
            auditWriteFailure(`「${before.name}」の変更は保存されています`, {
              ruleId: String(next.id),
            }),
          );
        }

        return ok({
          ruleId: String(next.id),
          message: input.enabled
            ? `「${next.name}」を効かせました。これから確認する記事に当たります。`
            : `「${next.name}」を止めました。**すでに承認された記事は確認し直されません。**`,
        });
      }

      if (!isPolicyDomainScope(input.domainScope)) {
        return err(
          validationError(
            "分野が語彙にありません。知らない分野のきまりは、どの記事にも当たりません。",
            "domainScope",
          ),
        );
      }
      if (!isPolicyChannelScope(input.channelScope)) {
        return err(
          validationError(
            "出力先が語彙にありません。知らない出力先のきまりは、どの記事にも当たりません。",
            "channelScope",
          ),
        );
      }
      if (!isPolicySeverity(input.severity)) {
        return err(
          validationError("強さが語彙にありません（止める・注意する・記録するのどれか）。", "severity"),
        );
      }
      const domainScope: PolicyDomainScope = input.domainScope;
      const channelScope: PolicyChannelScope = input.channelScope;
      const severity: PolicySeverity = input.severity;

      const givenId = (input.ruleId ?? "").trim();
      const isNew = givenId === "";

      let before: PolicyRule | null = null;
      if (!isNew) {
        const found = await deps.policyRules.findById(
          actor.workspaceId,
          taggedString<"PolicyRuleId">(givenId) as PolicyRuleId,
        );
        if (!found.ok) return found;
        if (found.value === null) {
          return err(
            domainError("NOT_FOUND", "そのきまりは見つかりませんでした。", {
              field: "ruleId",
              suggestedAction: "一覧を開き直して、対象の行からやり直してください。",
            }),
          );
        }
        before = found.value;
      }

      const built = createPolicyRule({
        id: isNew
          ? (taggedString<"PolicyRuleId">(`pol_${deps.ids.newId()}`) as PolicyRuleId)
          : (taggedString<"PolicyRuleId">(givenId) as PolicyRuleId),
        workspaceId: actor.workspaceId,
        name: input.name,
        domainScope,
        channelScope,
        severity,
        pattern: input.pattern,
        ignoreCase: input.ignoreCase,
        basis: input.basis,
        suggestion: input.suggestion,
        // 直すときは効いている／止まっているを引き継ぐ。保存のたびに復活させない。
        enabled: before?.enabled ?? true,
      });
      if (!built.ok) return built;

      const saved = await deps.policyRules.save(built.value);
      if (!saved.ok) return saved;

      const entry = buildAuditEntry(deps, actor, {
        action: "policy_rule.changed",
        targetType: "policy_rule",
        targetId: String(built.value.id),
        before: before === null ? null : ruleSnapshot(before),
        after: ruleSnapshot(built.value),
        reason: reasonOr(input.reason, isNew ? "表記のきまりを足した" : "表記のきまりを直した"),
      });
      if (!entry.ok) return entry;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(
          auditWriteFailure(`「${built.value.name}」は保存されています`, {
            ruleId: String(built.value.id),
          }),
        );
      }

      return ok({
        ruleId: String(built.value.id),
        message:
          `「${built.value.name}」を${isNew ? "足しました" : "直しました"}。` +
          "これから確認する記事に当たります。すでに承認された記事は確認し直されません。",
      });
    },
  };
}
