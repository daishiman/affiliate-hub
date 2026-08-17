import {
  type BrandId,
  type CampaignId,
  type DomainError,
  type Result,
  type WorkspaceId,
  err,
  ok,
  validationError,
} from "../shared";

/**
 * Distribution コンテキスト / Campaign (§21 E22)。
 *
 * **「いつからいつまで、何のためにまとめて出すか」だけを持つ。**
 * 記事の中身も、順位も、報酬額もここには入らない。
 *
 * 入れてはいけない理由は 1 つ。キャンペーンは商用の都合で作られるもので、
 * ここに「報酬が高い商品」を書けるようにすると、
 * 順位を決める処理から辿れてしまう経路ができる。
 * Campaign は配信のまとまりであって、評価の材料ではない。
 */
export const CAMPAIGN_STATUSES = ["planned", "running", "finished", "cancelled"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_STATUS_LABELS: Readonly<Record<CampaignStatus, string>> = {
  planned: "予定",
  running: "実施中",
  finished: "終了",
  cancelled: "取りやめ",
};

export type Campaign = {
  readonly id: CampaignId;
  readonly workspaceId: WorkspaceId;
  readonly brandId: BrandId;
  readonly name: string;
  /** 何を確かめたいのか。空だと、終わったあとに成否を判断できない。 */
  readonly goal: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly status: CampaignStatus;
  readonly createdAt: Date;
};

export function createCampaign(input: {
  id: CampaignId;
  workspaceId: WorkspaceId;
  brandId: BrandId;
  name: string;
  goal: string;
  startsAt: Date;
  endsAt: Date;
  createdAt: Date;
}): Result<Campaign, DomainError> {
  const name = input.name.trim();
  const goal = input.goal.trim();

  if (name === "") {
    return err(validationError("キャンペーンの名前が必要です。", "name"));
  }
  if (goal === "") {
    return err(
      validationError(
        "目的が必要です。終わったあとに成否を判断できなくなります。",
        "goal",
      ),
    );
  }
  if (input.endsAt <= input.startsAt) {
    return err(
      validationError("終了日は開始日より後にしてください。", "endsAt"),
    );
  }
  return ok({
    id: input.id,
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    name,
    goal,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    status: "planned",
    createdAt: input.createdAt,
  });
}

/** その時点で実施中か。表示と、配信予定の受け入れ判定に使う。 */
export function isCampaignActive(campaign: Campaign, at: Date): boolean {
  if (campaign.status === "cancelled") return false;
  return campaign.startsAt <= at && at < campaign.endsAt;
}

/**
 * 配信予定をこのキャンペーンに入れてよいか。
 * 期間の外に置いた予定は、集計のときに必ず食い違いの原因になる。
 */
export function acceptsPublicationAt(
  campaign: Campaign,
  scheduledAt: Date,
): Result<true, DomainError> {
  if (campaign.status === "cancelled") {
    return err(
      validationError("取りやめたキャンペーンには追加できません。", "status"),
    );
  }
  if (scheduledAt < campaign.startsAt || scheduledAt >= campaign.endsAt) {
    return err(
      validationError(
        "キャンペーンの期間外の日時です。期間を延ばすか、別のキャンペーンを選んでください。",
        "scheduledAt",
      ),
    );
  }
  return ok(true);
}
