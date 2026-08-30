/**
 * @tier 1
 * @req REQ-SEC09, REQ-M03, REQ-E13
 * @types permission-matrix, tenant-isolation, audit-log, contract
 *
 * production の `buildToolCatalog` から入った拒否が、入口の種類に関係なく
 * request ID つきで 1 回だけ記録されることを固定する。
 *
 * `auditDenials` 単体だけを動かしても、実際のカタログが包み忘れていれば緑になる。
 * そのため、この検査は本物の catalog と本物のランキング use case を呼ぶ。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { EditorialRankingModelRepositoryPort } from "@/application/ports/ranking";
import type { ActorContext, WorkspaceId } from "@/domain/shared";
import { markEditorial, ok } from "@/domain/shared";
import { createDeps } from "@/infrastructure/composition";
import {
  SAMPLE_MODEL_ID,
  SAMPLE_WORKSPACE_ID,
} from "@/infrastructure/persistence/sample/ranking-sample-repository";
import { buildToolCatalog, findTool } from "@/presentation/tools/catalog";
import { invokeTool } from "@/presentation/tools/tool-definition";
import { aNobody, anAnalyst } from "../support/actors";
import { recordingAuditLog } from "../support/doubles";
import { validInputFor } from "./tool-inputs";

const RANK_INPUT = {
  modelId: String(SAMPLE_MODEL_ID),
  productIds: ["p_alpha_15", "p_beta_14"],
};

function toolOrThrow(catalog: ReturnType<typeof buildToolCatalog>, name: string) {
  const tool = findTool(catalog, name);
  if (tool === null) throw new Error(`${name} という道具がありません`);
  return tool;
}

describe("production tool catalog の拒否監査", () => {
  it("use case の FORBIDDEN を request ID つきで 1 回だけ残す", async () => {
    const audit = recordingAuditLog();
    const catalog = buildToolCatalog({ ...createDeps(), auditLog: audit.port });
    const actor: ActorContext = {
      ...aNobody({ workspaceId: SAMPLE_WORKSPACE_ID as WorkspaceId }),
      requestId: "req-tool-forbidden-1",
    };

    const result = await invokeTool(toolOrThrow(catalog, "rank_products"), actor, RANK_INPUT);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
    expect(audit.entries()).toHaveLength(1);
    expect(audit.entries()[0]).toMatchObject({
      action: "access.denied",
      requestId: "req-tool-forbidden-1",
      after: { result: "denied", code: "FORBIDDEN", attempted: "rank_products" },
    });
  });

  it("use case の TENANT_MISMATCH を外向きに潰す前の種類で 1 回だけ残す", async () => {
    const base = createDeps();
    const found = await base.rankingModels.findById(SAMPLE_WORKSPACE_ID, SAMPLE_MODEL_ID);
    if (!found.ok || found.value === null) throw new Error("ランキングの見本がありません");
    const model = found.value;
    // 保存先が誤って別 workspace の行を返した場合でも、use case の境界検査が止める。
    // 本番配線がその拒否を記録するところまでを、この漏れる保存先で再現する。
    const leakyRankingModels: EditorialRankingModelRepositoryPort = markEditorial({
      async findById() {
        return ok(model);
      },
      list: base.rankingModels.list.bind(base.rankingModels),
      save: base.rankingModels.save.bind(base.rankingModels),
    });
    const audit = recordingAuditLog();
    const catalog = buildToolCatalog({
      ...base,
      auditLog: audit.port,
      rankingModels: leakyRankingModels,
    });
    const actor: ActorContext = {
      ...anAnalyst({ workspaceId: "ws-other-company" as WorkspaceId }),
      requestId: "req-tool-tenant-1",
    };

    const result = await invokeTool(toolOrThrow(catalog, "rank_products"), actor, RANK_INPUT);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("TENANT_MISMATCH");
    expect(audit.entries()).toHaveLength(1);
    expect(audit.entries()[0]).toMatchObject({
      action: "access.cross_workspace_blocked",
      requestId: "req-tool-tenant-1",
      after: { result: "denied", code: "TENANT_MISMATCH", attempted: "rank_products" },
    });
  });

  it("AI を止める承認ゲートは use case 拒否の監査へ二重計上しない", async () => {
    const audit = recordingAuditLog();
    const catalog = buildToolCatalog({ ...createDeps(), auditLog: audit.port });
    const actor: ActorContext = {
      ...anAnalyst({ workspaceId: SAMPLE_WORKSPACE_ID as WorkspaceId }),
      isAiServiceAccount: true,
      requestId: "req-tool-approval-1",
    };

    const result = await invokeTool(toolOrThrow(catalog, "submit_affiliate_url"), actor, {
      url: "https://example.invalid/affiliate",
      source: "paste",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FORBIDDEN");
    expect(audit.entries()).toHaveLength(0);
  });
});

describe("成果リンク登録の画面宣言と tool catalog", () => {
  it("ToolForm が名乗る register_affiliate_link を catalog が同じ名前で 1 件配る", () => {
    const formSource = readFileSync(
      new URL("../../src/presentation/admin/earn/inbox-forms.tsx", import.meta.url),
      "utf8",
    );
    const declared = [...formSource.matchAll(/toolName="([a-z0-9_]+)"/g)].map((match) => match[1]);
    const catalog = buildToolCatalog(createDeps());
    const catalogNames = catalog.map((tool) => tool.name);

    expect(declared.filter((name) => name === "register_affiliate_link")).toHaveLength(1);
    expect(catalogNames.filter((name) => name === "register_affiliate_link")).toHaveLength(1);
    const registered = toolOrThrow(catalog, "register_affiliate_link");
    const input = validInputFor(registered);
    expect(input).toEqual({
      linkIngestionId: "li_matched_1",
      productName: "ErgoOne Pro",
    });
    expect(registered.parse(input).ok).toBe(true);
  });
});
