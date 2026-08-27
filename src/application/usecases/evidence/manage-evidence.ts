import type {
  EditorialClaimRepositoryPort,
  EditorialEvidenceRepositoryPort,
  EditorialTestRunRepositoryPort,
} from "@/application/ports";
import type { IdGeneratorPort } from "@/application/ports/common";
import type { MembershipRepositoryPort } from "@/application/ports/identity";
import type { EditorialProductRepositoryPort } from "@/application/ports/product";
import { ensureOwnedReference } from "@/application/owned-reference";
import { requireCapability, requireWorkspaceWideCapability } from "@/domain/identity";
import {
  type Claim,
  type ClaimType,
  type Evidence,
  type EvidenceType,
  type TestRun,
  createClaim,
  createEvidence,
  createTestRun,
} from "@/domain/evidence";
import {
  type ClaimId,
  type DomainError,
  type EvidenceId,
  type ProductId,
  type Result,
  type TestRunId,
  type UserId,
  domainError,
  err,
  ok,
  taggedString,
  validationError,
} from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * 根拠・言えること・検証記録を登録する（ブログ層 §12・プラットフォーム層 §21）。
 *
 * --- なぜこの 3 つが 1 つの文脈か ---
 *
 * 「実際に測ったら 12 時間もった」と書けるかどうかは、次の 3 つが
 * **つながっているとき**だけ決まる。
 *   1. 検証記録（TestRun）……いつ・誰が・どの方法で測ったか
 *   2. 根拠（Evidence）……その結果や公式資料そのもの
 *   3. 言えること（Claim）……根拠を指した上での 1 文
 *
 * 1 つでも欠けると、残りは形だけになる。根拠だけあれば誰も読まない資料の山、
 * 主張だけあれば出所不明の断定、記録だけあれば使われない測定値になる。
 * だから登録の口も 3 つ揃えて出す。
 *
 * --- Editorial 区分 ---
 *
 * ここは読者向けの並び順（順位）へ流れ込む。報酬のつなぎ目は型で入らない
 * （`affiliateLinks?: never`）。「よく売れる根拠を上に」が事故として成立しない。
 */
export type ManageEvidenceDeps = {
  readonly evidence: EditorialEvidenceRepositoryPort;
  readonly claims: EditorialClaimRepositoryPort;
  readonly testRuns: EditorialTestRunRepositoryPort;
  readonly products: EditorialProductRepositoryPort;
  readonly memberships: MembershipRepositoryPort;
  /** ID の作り方。**登録のときだけ要る。** 参照だけの経路には持たせない。 */
  readonly ids?: IdGeneratorPort;
  readonly affiliateLinks?: never;
};

/** 登録の口が ID の作り方を持たずに組まれたとき（`manage-rankings.ts` と同じ理由）。 */
function idsMissing(what: string) {
  return err(
    domainError("NOT_IMPLEMENTED", `${what}は、この画面からは行えません。`, {
      suggestedAction: "公開した環境（pnpm run preview か本番）で開いてください。",
    }),
  );
}

/** 根拠の種類を、人が読める言葉にする。 */
export const EVIDENCE_TYPE_LABELS: Readonly<Record<EvidenceType, string>> = {
  official_source: "公式の資料",
  test_result: "測った結果",
  photo: "写真",
  video: "動画",
  dataset: "数表・データ",
  expert_review: "専門家の評",
};

/**
 * 言えることの種類。並び順は**根拠が要る順**にしてある。
 *
 * 画面の選択肢はこの並びで出す。上から読むと「事実として言うほど根拠が要る」が
 * 順番そのものから分かり、選ぶ人が種類の意味を説明文で読まなくて済む。
 */
export const CLAIM_TYPE_LABELS: Readonly<Record<ClaimType, string>> = {
  official: "公式が言っていること",
  measured: "自分たちで測ったこと",
  experience: "使った人の感想",
  external: "外部の評価",
  inference: "複数の根拠から考えたこと",
  commercial: "値段・売っている場所",
};

// --- 根拠をさがす ----------------------------------------------------------

export type SearchEvidenceInput = { readonly text?: string; readonly limit?: number };

export type EvidenceSummary = {
  readonly evidenceId: string;
  readonly typeLabel: string;
  readonly title: string;
  readonly sourceOwner: string;
  readonly capturedAt: string;
  readonly url: string | null;
  readonly excerpt: string;
};

export type SearchEvidenceOutput = {
  readonly items: readonly EvidenceSummary[];
  readonly emptyReason: string | null;
};

function formatDate(value: Date): string {
  return `${value.getFullYear()}年${value.getMonth() + 1}月${value.getDate()}日`;
}

function toEvidenceSummary(e: Evidence): EvidenceSummary {
  return {
    evidenceId: String(e.id),
    typeLabel: EVIDENCE_TYPE_LABELS[e.type],
    title: e.title,
    sourceOwner: e.sourceOwner,
    capturedAt: formatDate(e.capturedAt),
    // 画像や PDF を指す `assetId` は開けない。開けない文字列をリンクに
    // すると、押しても何も起きない箇所が一覧に混ざる。
    url: e.urlOrAssetId.startsWith("http") ? e.urlOrAssetId : null,
    excerpt: e.excerptOrSummary,
  };
}

export function createSearchEvidenceUseCase(
  deps: ManageEvidenceDeps,
): UseCase<SearchEvidenceInput, SearchEvidenceOutput> {
  return {
    async execute(actor, input): Promise<Result<SearchEvidenceOutput, DomainError>> {
      const allowed = requireWorkspaceWideCapability(actor, "content.read", "根拠の参照");
      if (!allowed.ok) return allowed;

      const found = await deps.evidence.search(
        actor.workspaceId,
        { text: input.text },
        { limit: Math.min(input.limit ?? 50, 100), cursor: null },
      );
      if (!found.ok) return found;

      const items = found.value.items.map(toEvidenceSummary);
      const searched = (input.text ?? "").trim() !== "";
      return ok({
        items,
        emptyReason:
          items.length > 0
            ? null
            : searched
              ? "その言葉を含む根拠はありませんでした。題名の一部で探し直してください。"
              : "まだ根拠が 1 つも登録されていません。先に根拠を登録してください。",
      });
    },
  };
}

// --- 根拠を登録する --------------------------------------------------------

export type SaveEvidenceInput = {
  readonly type: string;
  readonly title: string;
  readonly sourceOwner: string;
  readonly urlOrAssetId: string;
  readonly excerptOrSummary: string;
  readonly licenseOrPermission: string;
  /** いつ取った資料か。空なら「今」。 */
  readonly capturedAt: string;
};

export type SavedEvidence = { readonly evidenceId: string; readonly title: string };

/**
 * 改ざんを見つけるための指紋。
 *
 * **保存した後に中身が書き換わったかを確かめるための値**であって、
 * 秘密を守る値ではない。出所・題名・抜粋・取得日を並べて 1 本にする。
 * `sample-xxx` という決め打ちの文字列を入れていた頃は、
 * **どの根拠も同じ確かめ方で「無傷」に見えた。**
 */
async function integrityHashOf(input: {
  readonly title: string;
  readonly sourceOwner: string;
  readonly urlOrAssetId: string;
  readonly excerptOrSummary: string;
  readonly capturedAt: Date;
}): Promise<string> {
  const source = JSON.stringify([
    input.title.normalize("NFC"),
    input.sourceOwner.normalize("NFC"),
    input.urlOrAssetId,
    input.excerptOrSummary.normalize("NFC"),
    input.capturedAt.toISOString(),
  ]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  return `sha256:${hex}`;
}

function readEvidenceType(value: string): EvidenceType | null {
  return value in EVIDENCE_TYPE_LABELS ? (value as EvidenceType) : null;
}

export function createSaveEvidenceUseCase(
  deps: ManageEvidenceDeps,
): UseCase<SaveEvidenceInput, SavedEvidence> {
  return {
    async execute(actor, input): Promise<Result<SavedEvidence, DomainError>> {
      const allowed = requireCapability(actor, "evidence.write", "根拠の登録");
      if (!allowed.ok) return allowed;
      if (deps.ids === undefined) return idsMissing("根拠の登録");

      const type = readEvidenceType(input.type);
      if (type === null) {
        return err(validationError("根拠の種類を選んでください。", "type"));
      }

      const capturedAt =
        input.capturedAt.trim() === "" ? new Date() : new Date(input.capturedAt);
      if (Number.isNaN(capturedAt.getTime())) {
        return err(validationError("資料を取った日の形が読めません。", "capturedAt"));
      }

      const fields = {
        title: input.title.trim(),
        sourceOwner: input.sourceOwner.trim(),
        urlOrAssetId: input.urlOrAssetId.trim(),
        excerptOrSummary: input.excerptOrSummary.trim(),
        capturedAt,
      };

      const built = createEvidence({
        id: taggedString<"EvidenceId">(`ev_${deps.ids.newId()}`) as EvidenceId,
        workspaceId: actor.workspaceId,
        type,
        licenseOrPermission: input.licenseOrPermission.trim(),
        integrityHash: await integrityHashOf(fields),
        ...fields,
      });
      if (!built.ok) return built;

      const saved = await deps.evidence.save(built.value);
      if (!saved.ok) return saved;
      return ok({ evidenceId: String(saved.value.id), title: saved.value.title });
    },
  };
}

// --- 言えることを登録する --------------------------------------------------

export type SaveClaimInput = {
  readonly productId: string;
  readonly statement: string;
  readonly type: string;
  readonly evidenceIds: readonly string[];
  /** どれだけ確かか。0〜100 で受け取り、中で 0.0〜1.0 へ直す。 */
  readonly confidencePercent: number;
  readonly validFrom: string;
  readonly validUntil: string;
};

export type SavedClaim = { readonly claimId: string; readonly statement: string };

function readClaimType(value: string): ClaimType | null {
  return value in CLAIM_TYPE_LABELS ? (value as ClaimType) : null;
}

/**
 * 商品 1 つについて言えることを登録する。
 *
 * **根拠が要る種類で根拠が空なら断る**のは domain（`createClaim`）。
 * ここへ写すと写した側だけが古くなる。
 *
 * 指した根拠が本当に在るかはここで確かめる。domain は ID の並びしか見えず、
 * 「登録されていない根拠を指した主張」を止められない。止めないと、
 * 画面上は根拠付きに見えて、開くと何も無い主張ができる。
 */
export function createSaveClaimUseCase(
  deps: ManageEvidenceDeps,
): UseCase<SaveClaimInput, SavedClaim> {
  return {
    async execute(actor, input): Promise<Result<SavedClaim, DomainError>> {
      const allowed = requireCapability(actor, "evidence.write", "言えることの登録");
      if (!allowed.ok) return allowed;
      if (deps.ids === undefined) return idsMissing("言えることの登録");

      const type = readClaimType(input.type);
      if (type === null) {
        return err(validationError("言えることの種類を選んでください。", "type"));
      }
      if (input.productId.trim() === "") {
        return err(validationError("どの商品について言うのかを選んでください。", "productId"));
      }

      const productId = taggedString<"ProductId">(input.productId.trim()) as ProductId;
      const product = ensureOwnedReference(
        await deps.products.findById(actor.workspaceId, productId),
        actor.workspaceId,
        "productId",
        "その商品はこの作業場所に見つかりません。商品の一覧から選び直してください。",
      );
      if (!product.ok) return product;

      const evidenceIds = input.evidenceIds
        .map((id) => id.trim())
        .filter((id) => id !== "")
        .map((id) => taggedString<"EvidenceId">(id) as EvidenceId);

      for (const evidenceId of evidenceIds) {
        const evidence = ensureOwnedReference(
          await deps.evidence.findById(actor.workspaceId, evidenceId),
          actor.workspaceId,
          "evidenceIds",
          "指した根拠がこの作業場所に見つかりません。根拠の一覧から選び直してください。",
        );
        if (!evidence.ok) return evidence;
      }

      const validFrom = input.validFrom.trim() === "" ? new Date() : new Date(input.validFrom);
      if (Number.isNaN(validFrom.getTime())) {
        return err(validationError("いつから言えるかの形が読めません。", "validFrom"));
      }
      const validUntil = input.validUntil.trim() === "" ? null : new Date(input.validUntil);
      if (validUntil !== null && Number.isNaN(validUntil.getTime())) {
        return err(validationError("いつまで言えるかの形が読めません。", "validUntil"));
      }

      const percent = input.confidencePercent;
      if (Number.isNaN(percent) || percent < 0 || percent > 100) {
        return err(validationError("確かさは 0〜100 で入れてください。", "confidencePercent"));
      }

      const built = createClaim({
        id: taggedString<"ClaimId">(`claim_${deps.ids.newId()}`) as ClaimId,
        workspaceId: actor.workspaceId,
        statement: input.statement.trim(),
        type,
        evidenceIds,
        confidence: percent / 100,
        validFrom,
        validUntil,
      });
      if (!built.ok) return built;

      const saved = await deps.claims.saveForProduct(
        actor.workspaceId,
        productId,
        built.value,
      );
      if (!saved.ok) return saved;
      return ok({ claimId: String(saved.value.id), statement: saved.value.statement });
    },
  };
}

// --- 検証記録を登録する ----------------------------------------------------

export type SaveTestRunInput = {
  readonly productId: string;
  readonly methodVersion: string;
  /** 誰が測ったか。1 人も書かなければ domain が断る。 */
  readonly testerIds: readonly string[];
  readonly equipment: readonly string[];
  /** 「気温: 25度」のような測ったときの条件。 */
  readonly environment: Readonly<Record<string, string>>;
  /** 測った生の値。単位つきの文字列も入る（「12.4時間」）。 */
  readonly rawResults: Readonly<Record<string, string>>;
  /** 順位に使う点。0〜100 で受け取り、中で 0.0〜1.0 へ直す。 */
  readonly normalizedScorePercents: Readonly<Record<string, number>>;
  readonly evidenceIds: readonly string[];
  readonly startedAt: string;
  readonly completedAt: string;
};

export type SavedTestRun = { readonly testRunId: string; readonly methodVersion: string };

/**
 * 検証記録を 1 件登録する。
 *
 * **測定方法の版（`methodVersion`）を必ず書かせる**のは domain の決まり。
 * 方法を変えたのに版を据え置くと、違う方法で出た数字が同じ列に並び、
 * 「去年より良くなった」が方法の違いなのか実際の差なのか永久に分からなくなる。
 */
export function createSaveTestRunUseCase(
  deps: ManageEvidenceDeps,
): UseCase<SaveTestRunInput, SavedTestRun> {
  return {
    async execute(actor, input): Promise<Result<SavedTestRun, DomainError>> {
      const allowed = requireCapability(actor, "evidence.write", "検証記録の登録");
      if (!allowed.ok) return allowed;
      if (deps.ids === undefined) return idsMissing("検証記録の登録");

      if (input.productId.trim() === "") {
        return err(validationError("どの商品を測ったのかを選んでください。", "productId"));
      }

      const productId = taggedString<"ProductId">(input.productId.trim()) as ProductId;
      const product = ensureOwnedReference(
        await deps.products.findById(actor.workspaceId, productId),
        actor.workspaceId,
        "productId",
        "その商品はこの作業場所に見つかりません。商品の一覧から選び直してください。",
      );
      if (!product.ok) return product;

      const testerIds = input.testerIds.map((id) => id.trim()).filter((id) => id !== "");
      for (const testerId of testerIds) {
        const tester = ensureOwnedReference(
          await deps.memberships.findByUser(
            actor.workspaceId,
            taggedString<"UserId">(testerId) as UserId,
          ),
          actor.workspaceId,
          "testerIds",
          "選んだ検証者がこの作業場所に見つかりません。担当者の一覧から選び直してください。",
        );
        if (!tester.ok) return tester;
      }

      const evidenceIds = input.evidenceIds
        .map((id) => id.trim())
        .filter((id) => id !== "")
        .map((id) => taggedString<"EvidenceId">(id) as EvidenceId);
      for (const evidenceId of evidenceIds) {
        const evidence = ensureOwnedReference(
          await deps.evidence.findById(actor.workspaceId, evidenceId),
          actor.workspaceId,
          "evidenceIds",
          "選んだ根拠がこの作業場所に見つかりません。根拠の一覧から選び直してください。",
        );
        if (!evidence.ok) return evidence;
      }

      const startedAt = input.startedAt.trim() === "" ? new Date() : new Date(input.startedAt);
      if (Number.isNaN(startedAt.getTime())) {
        return err(validationError("測り始めた日の形が読めません。", "startedAt"));
      }
      const completedAt =
        input.completedAt.trim() === "" ? null : new Date(input.completedAt);
      if (completedAt !== null && Number.isNaN(completedAt.getTime())) {
        return err(validationError("測り終えた日の形が読めません。", "completedAt"));
      }

      const normalizedScores: Record<string, number> = {};
      for (const [key, percent] of Object.entries(input.normalizedScorePercents)) {
        if (Number.isNaN(percent) || percent < 0 || percent > 100) {
          return err(validationError(`「${key}」の点は 0〜100 で入れてください。`, key));
        }
        normalizedScores[key] = percent / 100;
      }

      const built = createTestRun({
        id: taggedString<"TestRunId">(`tr_${deps.ids.newId()}`) as TestRunId,
        workspaceId: actor.workspaceId,
        productId,
        methodVersion: input.methodVersion.trim(),
        environment: input.environment,
        equipment: input.equipment.map((e) => e.trim()).filter((e) => e !== ""),
        testerIds,
        startedAt,
        completedAt,
        rawResults: input.rawResults,
        normalizedScores,
        evidenceIds,
      });
      if (!built.ok) return built;

      const saved = await deps.testRuns.save(built.value);
      if (!saved.ok) return saved;
      return ok({ testRunId: String(saved.value.id), methodVersion: saved.value.methodVersion });
    },
  };
}

// --- 型だけの再輸出（画面が domain を直接読まないようにする） ---------------

export type { Claim, Evidence, TestRun };
