/**
 * @tier 1
 * @types equivalence, boundary, permission-matrix, fault-injection
 * @req REQ-G11
 *
 * 「いま選べるモデル」の一覧と、画面から届いた選択の受け取り。
 *
 * この一覧の値打ちは、並べることではなく**並べない理由を言うこと**にある。
 * 空の一覧は画面では全部同じ空白に見えるが、利用者がやることは
 * 鍵を登録する・設定を入れる・そもそも使えない、で全部違う。
 */
import { describe, expect, it } from "vitest";
import {
  MODEL_CHOICE_SEPARATOR,
  createListSelectableModelsUseCase,
  selectModelFromRows,
  type SelectableModelRow,
} from "@/application/usecases/generation/list-selectable-models";
import type {
  LlmCredentialVaultPort,
  LlmModelDescriptor,
  LlmProviderCatalogPort,
} from "@/application/ports";
import type { ActorContext } from "@/domain/shared";
import { domainError, err, ok, taggedString } from "@/domain/shared";

const writer: ActorContext = {
  userId: taggedString("user_writer"),
  workspaceId: taggedString("ws_test"),
  roles: ["writer"],
  isAiServiceAccount: false,
};

/** 生成の権限を持たない役（読むことと分析だけ）。 */
const analyst: ActorContext = { ...writer, roles: ["analyst"] };

/** 鍵は管理できるが、記事を書く権限は持たない役。 */
const keyAdmin: ActorContext = { ...writer, roles: ["feedback_admin"] };

const aModel: LlmModelDescriptor = {
  modelId: "model-a",
  label: "モデル A",
  inputPricePerMillionMinor: 450,
  outputPricePerMillionMinor: 2250,
  currency: "JPY",
  sourceUrl: "https://platform.claude.com/docs/en/about-claude/pricing",
  pricedOn: "2026-08-18",
};

function catalogWith(
  models: Readonly<Record<string, readonly LlmModelDescriptor[]>>,
  options: { readonly optionalProviders?: readonly string[] } = {},
): LlmProviderCatalogPort {
  const optional = new Set(options.optionalProviders ?? []);
  return {
    async listProviders() {
      return ok(
        Object.keys(models).map((providerId) => ({
          providerId,
          label: `${providerId} の表示名`,
          keyIssueUrl: "https://example.invalid/keys",
          required: !optional.has(providerId),
        })),
      );
    },
    async listModels(providerId) {
      return ok(models[providerId] ?? []);
    },
  };
}

function vaultWith(activeProviders: readonly string[]): LlmCredentialVaultPort {
  return {
    async list(workspaceId) {
      return ok(
        activeProviders.map((providerId) => ({
          workspaceId,
          providerId,
          last4: "1234",
          status: "active" as const,
          registeredBy: null,
          registeredAt: new Date("2026-08-18T00:00:00.000Z"),
          lastVerifiedAt: null,
          lastVerification: null,
        })),
      );
    },
    async store() {
      throw new Error("この検査では呼ばない");
    },
    async revoke() {
      throw new Error("この検査では呼ばない");
    },
    async recordVerification() {
      throw new Error("この検査では呼ばない");
    },
  };
}

function useCaseWith(input: {
  readonly catalog: LlmProviderCatalogPort;
  readonly vault?: LlmCredentialVaultPort;
  readonly unavailableReason?: string;
}) {
  return createListSelectableModelsUseCase({
    catalog: input.catalog,
    credentials:
      input.vault === undefined
        ? { available: false, reason: input.unavailableReason ?? "鍵を預かれません。" }
        : { available: true, vault: input.vault },
  });
}

describe("選べるかどうか", () => {
  it("鍵が入っていて、モデルの設定もあれば選べる", async () => {
    const uc = useCaseWith({
      catalog: catalogWith({ anthropic: [aModel] }),
      vault: vaultWith(["anthropic"]),
    });
    const result = await uc.execute(writer, {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rows[0]?.unavailableReason).toBeNull();
    expect(result.value.emptyReason).toBeNull();
  });

  it("鍵が入っていなければ選べない。理由は鍵のことを言う", async () => {
    const uc = useCaseWith({
      catalog: catalogWith({ anthropic: [aModel] }),
      vault: vaultWith([]),
    });
    const result = await uc.execute(writer, {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 一覧から消さない。消すと「そもそも使えない提供元」と区別がつかない。
    expect(result.value.rows[0]?.models).toHaveLength(1);
    expect(result.value.rows[0]?.unavailableReason).toContain("API キー");
  });

  it("モデルの設定が無ければ、鍵の話をしない", async () => {
    // ここで「鍵を登録してください」と出すと、登録しても直らない。
    const uc = useCaseWith({
      catalog: catalogWith({ anthropic: [] }),
      vault: vaultWith(["anthropic"]),
    });
    const result = await uc.execute(writer, {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rows[0]?.unavailableReason).toContain("目録");
    expect(result.value.rows[0]?.unavailableReason).not.toContain("API キー");
  });

  it("鍵もモデルも無いときは、鍵ではなく設定の話をする", async () => {
    // ここが「見る順」がいちばん効く場所。鍵を先に見る作りにすると
    // 「API キーを登録してください」と出るが、**登録しても直らない**
    // （モデルが 1 つも設定されていないため）。
    // 上の「鍵はあるがモデルが無い」だけでは順の入れ替えを捕まえられない。
    const uc = useCaseWith({ catalog: catalogWith({ anthropic: [] }), vault: vaultWith([]) });
    const result = await uc.execute(writer, {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rows[0]?.unavailableReason).toContain("目録");
    expect(result.value.rows[0]?.unavailableReason).not.toContain("API キー");
  });

  it("鍵の要らない提供元にも、鍵の登録を求めない", async () => {
    // 枠として残してある提供元（登録する先が無いので、求めても直しようがない）。
    const uc = useCaseWith({
      catalog: catalogWith({ workers_ai: [aModel] }, { optionalProviders: ["workers_ai"] }),
      vault: vaultWith([]),
    });
    const result = await uc.execute(writer, {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rows[0]?.unavailableReason).not.toContain("API キー");
  });

  it("失効させた鍵は、入っていないのと同じに扱う", async () => {
    const revoked: LlmCredentialVaultPort = {
      ...vaultWith([]),
      async list(workspaceId) {
        return ok([
          {
            workspaceId,
            providerId: "anthropic",
            last4: "1234",
            status: "revoked" as const,
            registeredBy: null,
            registeredAt: new Date("2026-08-18T00:00:00.000Z"),
            lastVerifiedAt: null,
            lastVerification: null,
          },
        ]);
      },
    };
    const uc = useCaseWith({ catalog: catalogWith({ anthropic: [aModel] }), vault: revoked });
    const result = await uc.execute(writer, {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rows[0]?.unavailableReason).not.toBeNull();
  });
});

describe("1 つも選べないとき", () => {
  it("鍵が 1 つも無いなら、登録の話をする", async () => {
    const uc = useCaseWith({
      catalog: catalogWith({ anthropic: [aModel], google: [aModel] }),
      vault: vaultWith([]),
    });
    const result = await uc.execute(writer, {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.emptyReason).toContain("登録");
  });

  it("モデルが 1 つも設定されていないなら、設定の話をする", async () => {
    const uc = useCaseWith({
      catalog: catalogWith({ anthropic: [], google: [] }),
      vault: vaultWith(["anthropic", "google"]),
    });
    const result = await uc.execute(writer, {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.emptyReason).toContain("目録");
  });

  it("鍵の預かり所につながっていなくても、一覧は返す", async () => {
    // 使えないときほど「何が使えるはずか」を読みたい。
    const uc = useCaseWith({
      catalog: catalogWith({ anthropic: [aModel] }),
      unavailableReason: "保存先につながっていないため、鍵を預かれません。",
    });
    const result = await uc.execute(writer, {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rows).toHaveLength(1);
    expect(result.value.rows[0]?.models).toHaveLength(1);
    expect(result.value.emptyReason).toContain("保存先");
  });

  it("目録が読めないときは、空の一覧にせず失敗を返す", async () => {
    // 空にすると「まだ設定していない」と読まれ、設定済みでも同じ画面になる。
    const broken: LlmProviderCatalogPort = {
      async listProviders() {
        return err(domainError("UPSTREAM_UNAVAILABLE", "目録を読めませんでした。"));
      },
      async listModels() {
        return ok([]);
      },
    };
    const result = await useCaseWith({ catalog: broken, vault: vaultWith([]) }).execute(writer, {});
    expect(result.ok).toBe(false);
  });

  it("鍵の一覧が読めないときも、空の一覧にしない", async () => {
    // ここで空にすると、**鍵が入っているのに「未登録です」と出る**。
    const broken: LlmCredentialVaultPort = {
      ...vaultWith([]),
      async list() {
        return err(domainError("UPSTREAM_UNAVAILABLE", "鍵の一覧を読めませんでした。"));
      },
    };
    const result = await useCaseWith({
      catalog: catalogWith({ anthropic: [aModel] }),
      vault: broken,
    }).execute(writer, {});
    expect(result.ok).toBe(false);
  });
});

describe("誰が見られるか", () => {
  it("生成の権限が無い役は、一覧を見られない", async () => {
    const uc = useCaseWith({
      catalog: catalogWith({ anthropic: [aModel] }),
      vault: vaultWith(["anthropic"]),
    });
    const result = await uc.execute(analyst, {});
    expect(result.ok).toBe(false);
  });

  it("鍵を管理する権限があっても、生成の権限が無ければ見られない", async () => {
    // 見えるのは「これから書く人」に要るからで、鍵を配る人に要るのではない。
    const result = await useCaseWith({
      catalog: catalogWith({ anthropic: [aModel] }),
      vault: vaultWith(["anthropic"]),
    }).execute(keyAdmin, {});
    expect(result.ok).toBe(false);
  });

  it("書く人は、鍵を管理する権限を持たなくても見られる", async () => {
    // 書く人にモデルを選ばせるために鍵の管理権限を配る、という形にしない。
    const result = await useCaseWith({
      catalog: catalogWith({ anthropic: [aModel] }),
      vault: vaultWith(["anthropic"]),
    }).execute(writer, {});
    expect(result.ok).toBe(true);
  });
});

describe("画面から届いた選択を受け取る", () => {
  const rows: readonly SelectableModelRow[] = [
    { providerId: "anthropic", label: "A", models: [aModel], unavailableReason: null },
    {
      providerId: "google",
      label: "G",
      models: [aModel],
      unavailableReason: "API キーがまだ登録されていません。",
    },
  ];

  it("一覧にある組み合わせだけを通す", () => {
    expect(selectModelFromRows(rows, `anthropic${MODEL_CHOICE_SEPARATOR}model-a`)).toEqual({
      providerId: "anthropic",
      modelId: "model-a",
    });
  });

  it("一覧に無いモデル名は通さない", () => {
    // URL は誰でも書ける。届いた文字列をそのまま指定として使わない。
    expect(selectModelFromRows(rows, `anthropic${MODEL_CHOICE_SEPARATOR}model-x`)).toBeNull();
  });

  it("知らない提供元は通さない", () => {
    expect(selectModelFromRows(rows, `unknown${MODEL_CHOICE_SEPARATOR}model-a`)).toBeNull();
  });

  it("画面で選べない提供元は、URL からも選べない", () => {
    // ここを通すと、画面には「選べません」と出ているのに実際は選べる。
    expect(selectModelFromRows(rows, `google${MODEL_CHOICE_SEPARATOR}model-a`)).toBeNull();
  });

  it("形が違う値は通さない", () => {
    for (const value of ["", "anthropic", MODEL_CHOICE_SEPARATOR, `${MODEL_CHOICE_SEPARATOR}model-a`, `anthropic${MODEL_CHOICE_SEPARATOR}`]) {
      expect(selectModelFromRows(rows, value)).toBeNull();
    }
  });
});
