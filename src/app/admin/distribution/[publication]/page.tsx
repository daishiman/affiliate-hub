import { AdminShell } from "@/presentation/admin/admin-shell";
import { adminOperation } from "@/presentation/admin/admin-operation-manifest";
import { cancelPublicationAction } from "@/presentation/admin/delete-form-action";
import { DeleteConfirm } from "@/presentation/admin/delete-confirm";
import { ManualDraftCopy } from "@/presentation/admin/manual-draft-copy";
import { PublishArticleForm } from "@/presentation/admin/publish-article-form";
import type { SuccessOf } from "@/presentation/admin/use-case-result";
import { currentActor, distributionNotice, distributionUseCases } from "@/presentation/composition";
import {
  Callout,
  Code,
  CodeBlock,
  ErrorView,
  ExternalLink,
  FactList,
  ListView,
  Note,
  Prose,
  Section,
  StorageNotice,
  SubSection,
  TextLink,
  UI_COPY,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 配信 1 件。
 *
 * 自動で投稿できない先のときは、投稿の操作を出さずに
 * 貼り付け用の下書きをその場で出す。
 * 「押しても何も起きないボタン」を作らないため。
 */
export default async function PublicationPage({
  params,
}: {
  readonly params: Promise<{ readonly publication: string }>;
}) {
  const { publication: publicationId } = await params;
  const actor = await currentActor();
  const uc = await distributionUseCases();
  const result = await uc.getPublication.execute(actor, { publicationId });

  const title = result.ok ? `${result.value.card.channelLabel}への配信` : "配信";

  return (
    <AdminShell
      routeId="distribution/[publication]"
      routeParams={{ publication: publicationId }}
      title={title}
      lead="いまどこまで進んでいるかを見ます。"
      actions={
        <>
          <TextLink href={`/admin/distribution/${encodeURIComponent(publicationId)}/edit`}>
            この配信を直す
          </TextLink>
          <TextLink href="/admin/distribution">配信の一覧へ戻る</TextLink>
        </>
      }
    >
      {!result.ok ? (
        <ErrorView
          title="この配信を表示できませんでした"
          body={result.error.message}
          suggestedAction={result.error.suggestedAction ?? null}
          action={<TextLink href="/admin/distribution">配信の一覧へ戻る</TextLink>}
        />
      ) : (
        <PublicationBody publicationId={publicationId} value={result.value} />
      )}
    </AdminShell>
  );
}

type Publication = SuccessOf<
  ReturnType<Awaited<ReturnType<typeof distributionUseCases>>["getPublication"]["execute"]>
>;

async function PublicationBody({
  publicationId,
  value,
}: {
  readonly publicationId: string;
  readonly value: Publication;
}) {
  const operation = adminOperation("publication.delete");
  const actor = await currentActor();
  const uc = await distributionUseCases();
  const { card, canDirectPublish, publishModeLabel, nextStates, blockedReason, canPublishFromScreen } =
    value;

  // 自動で投稿できない先だけ、下書きを出す。
  const draft = canDirectPublish
    ? null
    : await uc.exportManualDraft.execute(actor, { publicationId });

  // この画面で体裁を整えて出せるときだけ「いまサイトに出す」を用意する。
  // **配信先の名前で分岐しない。** 名前で分けると、同じ性質の配信先を足すたびに
  // この行を探して直すことになり、「表に 1 エントリ足すだけ」が崩れる。
  // 出し終わったかどうかの判断も含めて、ユースケースが 1 つの真偽で返す。
  // 選択肢の中身（種類ごとの欄・出し先・広告表記の文）も画面では組み立てず、
  // ユースケースから受け取る。組み立てを画面へ写すと、AI 経路と食い違う。
  const publishOptions = canPublishFromScreen
    ? await uc.preparePublishArticle.execute(actor, { publicationId })
    : null;

  return (
    <>
      <StorageNotice status={await distributionNotice()} />

      <Section title="いまの状態">
        <FactList
          rows={[
            { key: "state", label: "状態", value: card.stateLabel },
            { key: "mode", label: "出し方", value: publishModeLabel },
            {
              key: "scheduled",
              label: "予定",
              value:
                card.scheduledAt === null
                  ? "すぐに出す"
                  : card.scheduledAt.toLocaleString("ja-JP"),
            },
            { key: "attempts", label: "送信を試した回数", value: `${card.attempts}回` },
            {
              key: "variant",
              label: "もとの記事",
              value: (
                <TextLink href={`/admin/content/${encodeURIComponent(card.variantId)}`}>
                  記事を見る
                </TextLink>
              ),
            },
          ]}
        />

        {card.lastError === null ? null : (
          <Callout tone="danger" title="送信できませんでした" reason={card.lastError} />
        )}
        {blockedReason === null ? null : (
          <Callout tone="info" title="自動では投稿できません" reason={blockedReason} />
        )}
        {card.externalUrl === null ? null : (
          <Note>
            公開先: <ExternalLink href={card.externalUrl}>
              <Code>{card.externalUrl}</Code>
            </ExternalLink> です。
          </Note>
        )}
      </Section>

      <Section title="ここから進める先">
        {nextStates.length === 0 ? (
          <Prose>この配信はここで終わりです。進める先はありません。</Prose>
        ) : (
          <ListView rows={nextStates.map((s) => ({ key: s.state, label: s.label }))} />
        )}
        <Note>取りやめ・再送は担当者の操作で行います。AI からは実行できません。</Note>
      </Section>

      {/*
       * 取りやめは、**遷移表が許すときだけ**出す。`nextStates` は domain が
       * 返したもので、画面はそこに `CANCELLED` が並んでいるかを見るだけ。
       * ここで状態名を並べて条件を書くと、遷移表が 1 行変わった日に
       * 画面だけが古いまま「取りやめられます」と言う。
       */}
      {nextStates.some((s) => s.state === "CANCELLED") ? (
        <Section title="配信を取りやめる">
          <DeleteConfirm
            action={cancelPublicationAction}
            toolName={operation.tool}
            toolDescription="予定していた配信を取りやめる（すでに出たものには使えない）"
            idName="publicationId"
            idValue={publicationId}
            label={`${card.channelLabel}への配信`}
            verb="取りやめる"
            consequence="この予定は実行されなくなります。記録は残るので、出さなかったことは後から辿れます。もう一度出したいときは、予約を作り直してください。"
            // 取りやめの口は識別子しか受け取らない。理由を書かせても届かない。
            requiresReason={false}
            acknowledgement="この予定が実行されなくなることを確かめました"
          />
        </Section>
      ) : null}

      {publishOptions === null ? null : (
        <Section title="いまサイトに出す">
          {!publishOptions.ok ? (
            <ErrorView
              title="出す画面を用意できませんでした"
              body={publishOptions.error.message}
              suggestedAction={publishOptions.error.suggestedAction ?? null}
            />
          ) : (
            <>
              <Prose>
                読者に見える形に整えてから出します。書き手・広告表記・次に見直す日が
                そろっていないものは出せません。
              </Prose>
              <PublishArticleForm publicationId={publicationId} options={publishOptions.value} />
            </>
          )}
        </Section>
      )}

      {draft === null ? null : (
        <Section title={UI_COPY.distribution.draftTitle}>
          {!draft.ok ? (
            <ErrorView
              title="下書きを書き出せませんでした"
              body={draft.error.message}
              suggestedAction={draft.error.suggestedAction ?? null}
            />
          ) : (
            <>
              <SubSection title={UI_COPY.distribution.draftSteps}>
                <Prose>{draft.value.instructions}</Prose>
              </SubSection>

              <SubSection title={UI_COPY.distribution.draftBodyTitle}>
                {/*
                 * コピーのボタンと本文の枠を**両方**出す。
                 * クリップボードは環境によっては使えず、ボタンだけだとそこで道が終わる。
                 *
                 * 広告表記の注意は、注意書きの枠を増やさず**押す物の隣**に置く。
                 * 上に注意書きを積むほど、どれも読まれなくなる。
                 * ここは「これから持ち出す」ちょうどその場所なので、いちばん届く。
                 */}
                <ManualDraftCopy
                  markdown={draft.value.markdown}
                  instructions={draft.value.instructions}
                />
                <Note>{UI_COPY.distribution.draftDisclosureWarning}</Note>
                <Note>{UI_COPY.distribution.draftManualHint}</Note>
                <CodeBlock>{draft.value.markdown}</CodeBlock>
              </SubSection>

              <Note>{UI_COPY.distribution.draftExportedNote}</Note>
            </>
          )}
        </Section>
      )}
    </>
  );
}
