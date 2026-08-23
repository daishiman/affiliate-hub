import { AdminShell } from "@/presentation/admin/admin-shell";
import { adminOperation } from "@/presentation/admin/admin-operation-manifest";
import { DeleteConfirm } from "@/presentation/admin/delete-confirm";
import { deleteContentVariantAction } from "@/presentation/admin/delete-form-action";
import { contentUseCases, currentActor, editorialContentNotice } from "@/presentation/composition";
import {
  ActionNote,
  ApprovalFlow,
  Callout,
  EmptyView,
  ErrorView,
  FactList,
  Note,
  Prose,
  Section,
  Stack,
  StorageNotice,
  SubSection,
  TextLink,
  type ApprovalState,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 記事 1 本の画面。
 *
 * **読んで判断するための画面。** 押して動かす操作は
 * `/admin/content/[variant]/progress` へ移した。本文を読みに来た人の目の前に
 * 「承認」と「配信を作る」が並んでいると、読み終える前に手が出る。
 *
 * **自動確認の結果を「合格」だけで済ませない。**
 * 実行しなかった項目も理由つきで並べる。
 * 出さないと「17 項目すべて確認済み」と読まれ、
 * 実際には見ていない観点が見落とされる。
 */
export default async function ContentDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly variant: string }>;
}) {
  const operation = adminOperation("content.delete");
  const { variant: variantId } = await params;
  const actor = await currentActor();
  const result = await (await contentUseCases()).getContent.execute(actor, { variantId });

  const title = result.ok ? (result.value.variant.title ?? "（見出し未設定）") : "記事";

  return (
    <AdminShell
      routeId="content/[variant]"
      routeParams={{ variant: variantId }}
      title={title}
      lead="本文と、自動確認の指摘。"
      actions={
        <>
          <TextLink href={`/admin/content/${encodeURIComponent(variantId)}/edit`}>
            この記事を直す
          </TextLink>
          <TextLink href="/admin/content">記事の一覧へ戻る</TextLink>
        </>
      }
    >
      {!result.ok ? (
        <ErrorView
          title="この記事を表示できませんでした"
          body={result.error.message}
          suggestedAction={result.error.suggestedAction ?? null}
          action={<TextLink href="/admin/content">記事の一覧へ戻る</TextLink>}
        />
      ) : (
        <>
          <StorageNotice status={await editorialContentNotice()} />

          <Section title="いまの段階">
            <ApprovalFlow current={approvalStateOf(result.value.variant.status)} />
            <Prose>
              いまは「{result.value.stateLabel}」です。書き手:{" "}
              {result.value.authorName ?? "未設定"} / 媒体: {result.value.variant.channel} /
              作成に使った指示: {result.value.variant.generationPromptVersion}（
              {result.value.variant.modelId}）
            </Prose>
            <Note>
              <TextLink href={`/admin/content/${encodeURIComponent(variantId)}/progress`}>
                進行と配信の操作へ
              </TextLink>
            </Note>
          </Section>

          <QualitySection quality={result.value.quality} />

          <Section title="表現のきまり">
            {result.value.policy === null ? (
              // 確認できなかったことを「指摘なし」と並べて出さない。
              // 同じ見た目にすると、見ていない記事が見た記事と区別できなくなる。
              <Callout
                tone="warn"
                title="確認できていません"
                reason={result.value.policyUncheckedReason ?? "理由が分かりません。"}
                action={<TextLink href="/admin/content">記事の一覧へ戻る</TextLink>}
              />
            ) : result.value.policy.violations.length === 0 ? (
              <EmptyView
                title="当たった項目はありません"
                body="この記事の分野で登録されているきまりには当たりませんでした。登録されていない法令は確認していません。"
              />
            ) : (
              <Stack>
                {result.value.policy.violations.map((v, i) => (
                  <ActionNote
                    key={`${String(v.ruleId)}-${i}`}
                    tone={v.severity === "block" ? "danger" : "neutral"}
                  >
                    {/* 禁止だけ示すと執筆が止まる。根拠と言い換えを必ず添える。 */}
                    {v.ruleName}: {`「${v.excerpt}」— ${v.basis}。${v.suggestion}`}
                  </ActionNote>
                ))}
              </Stack>
            )}
            {result.value.policy !== null && result.value.policy.unevaluatedRuleIds.length > 0 && (
              /*
                実行できなかったルールを黙って飛ばさない。ただし `Callout` にはしない。
                この画面には既に「確認できていません」の告知があり、告知を重ねると
                どちらが記事の判断に効くのかが読み取れなくなる。
              */
              <ActionNote tone="danger">
                {result.value.policy.unevaluatedRuleIds.length}
                件のきまりが実行できませんでした。設定した検出条件を見直してください。
              </ActionNote>
            )}
          </Section>

          <Section title="本文">
            <Prose>{result.value.variant.summary}</Prose>
            {result.value.variant.body.split("\n").map((line, i) => (
              <Prose key={`${i}-${line.slice(0, 8)}`}>{line}</Prose>
            ))}
          </Section>

          {result.value.variant.assumptions.length === 0 ? null : (
            <Section
              title="AI が置いた仮定"
              lead="確かめられた内容ではありません。読者にも仮定として示します。"
            >
              <ListOfText items={result.value.variant.assumptions} />
            </Section>
          )}

          <Section title="この記事を消す">
            <DeleteConfirm
              action={deleteContentVariantAction}
              toolName={operation.tool}
              toolDescription="記事を消す（公開中の記事は断られる）"
              idName="variantId"
              idValue={variantId}
              label={title}
              verb="消す"
              consequence="公開中の記事は断られます。先に取り下げてください。消すと本文ごと無くなり、後から中身を確かめる手段は残りません。"
            />
          </Section>
        </>
      )}
    </AdminShell>
  );
}

type Quality = {
  readonly issues: readonly {
    readonly check: string;
    readonly severity: string;
    readonly message: string;
  }[];
  readonly skipped: readonly { readonly check: string; readonly reason: string }[];
};

/**
 * 自動確認の結果。
 *
 * 「確認しなかった項目」を同じ塊の中へ入れている。別の節に切ると、
 * 指摘 0 件を見た時点で読み終える人が出て、見ていない観点が見落とされる。
 */
function QualitySection({ quality }: { readonly quality: Quality }) {
  const errors = quality.issues.filter((i) => i.severity === "error");
  const warnings = quality.issues.filter((i) => i.severity !== "error");

  return (
    <Section
      title="自動確認の結果"
      lead={`直すべき指摘 ${errors.length}件 / 気をつける点 ${warnings.length}件 / 確認しなかった項目 ${quality.skipped.length}件`}
    >
      {quality.issues.length === 0 ? (
        <EmptyView
          title="指摘はありません"
          body="自動で確認できる範囲では問題は見つかりませんでした。人の目での確認は別に必要です。"
        />
      ) : (
        <Stack>
          {quality.issues.map((issue, i) => (
            <ActionNote
              key={`${issue.check}-${i}`}
              tone={issue.severity === "error" ? "danger" : "neutral"}
            >
              {CHECK_LABEL[issue.check] ?? issue.check}: {issue.message}
            </ActionNote>
          ))}
        </Stack>
      )}

      <SubSection title="確認しなかった項目">
        {quality.skipped.length === 0 ? (
          <Prose>すべての項目を確認しました。</Prose>
        ) : (
          <FactList
            rows={quality.skipped.map((s) => ({
              key: s.check,
              label: CHECK_LABEL[s.check] ?? s.check,
              value: s.reason,
            }))}
          />
        )}
      </SubSection>
    </Section>
  );
}

/** 行き先を持たない文字列の並び。`ListView` の行き先なし版として使う。 */
function ListOfText({ items }: { readonly items: readonly string[] }) {
  return (
    <Stack>
      {items.map((item) => (
        <Prose key={item}>{item}</Prose>
      ))}
    </Stack>
  );
}

/** 記事の状態を、承認の流れの現在地へ読み替える。 */
function approvalStateOf(status: string): ApprovalState {
  switch (status) {
    case "review":
      return "review";
    case "approved":
      return "approved";
    case "published":
      return "published";
    case "rejected":
      return "archived";
    default:
      return "draft";
  }
}

/** 検査の識別子をそのまま出さない。編集者が読んで直せる言葉にする。 */
const CHECK_LABEL: Readonly<Record<string, string>> = {
  unsourced_number: "根拠のない数値",
  stale_price: "古い価格",
  fabricated_experience: "書ける範囲を超えた体験",
  nonexistent_feature: "登録にない機能名",
  exaggeration: "言い過ぎの表現",
  prohibited_phrase: "この書き手では使わない言葉",
  disclosure_present: "広告表示",
  link_present: "リンクの欠落",
  length_fit: "文字数",
  hashtag_fit: "ハッシュタグの数",
  channel_fit: "媒体のきまりとの不一致",
  duplicate_text: "既存記事との重複",
  brand_fit: "書き手らしさ",
  audience_fit: "読者との合い方",
  cta_overuse: "行動を促す文の多さ",
  missing_drawback: "デメリットの欠落",
  missing_citation: "出典の欠落",
};
