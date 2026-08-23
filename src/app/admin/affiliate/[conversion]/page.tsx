import { AdjustConversionForm } from "@/presentation/admin/adjust-conversion-form";
import { AdminShell } from "@/presentation/admin/admin-shell";
import {
  affiliateStorageNotice,
  affiliateUseCases,
  currentActor,
} from "@/presentation/composition";
import {
  Callout,
  ErrorView,
  FactList,
  Note,
  Prose,
  Section,
  StorageNotice,
  TextLink,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 成果 1 件。
 *
 * 取り込んだ額と手で直した額を並べて出す。
 * 上書きしてしまうと、次の取り込みとの差が出せず、誤りに気づけない。
 *
 * 直せないときは、ボタンを消すのではなく理由を出す。
 * 押せないものが黙って消えていると、壊れているのか制限なのか分からない。
 */
export default async function ConversionPage({
  params,
}: {
  readonly params: Promise<{ readonly conversion: string }>;
}) {
  const { conversion: conversionId } = await params;
  const actor = await currentActor();
  const uc = await affiliateUseCases();
  const result = await uc.getConversion.execute(actor, { conversionId });

  const title = result.ok ? `${result.value.advertiserName}の成果` : "成果";

  return (
    <AdminShell
      routeId="affiliate/[conversion]"
      routeParams={{ conversion: conversionId }}
      title={title}
      lead="内訳と、金額を直せるかどうかを見ます。"
      actions={<TextLink href="/admin/affiliate">提携と成果へ戻る</TextLink>}
    >
      {!result.ok ? (
        <ErrorView
          title="この成果を表示できませんでした"
          body={result.error.message}
          suggestedAction={result.error.suggestedAction ?? null}
          action={<TextLink href="/admin/affiliate">提携と成果へ戻る</TextLink>}
        />
      ) : (
        <>
          <StorageNotice status={await affiliateStorageNotice()} />

          <Section title="内訳">
            <FactList
              rows={[
                { key: "asp", label: "提携先", value: result.value.view.aspLabel },
                { key: "advertiser", label: "広告主", value: result.value.advertiserName },
                { key: "status", label: "状態", value: result.value.view.statusLabel },
                {
                  key: "occurred",
                  label: "発生日",
                  value: result.value.view.occurredAt.toLocaleString("ja-JP"),
                },
                {
                  key: "ingested",
                  label: "取り込んだ額",
                  value: result.value.view.ingestedLabel,
                },
                {
                  key: "adjusted",
                  label: "手で直した額",
                  value: result.value.view.adjustedLabel ?? "直していません",
                },
                {
                  key: "effective",
                  label: "実際に使う額",
                  value: result.value.view.effectiveLabel,
                },
              ]}
            />
            {result.value.view.adjustmentReason === null ? null : (
              <Note>直した理由: {result.value.view.adjustmentReason}</Note>
            )}
            <Prose>
              手で直しても、取り込んだ額はそのまま残します。
              残しておかないと、次の取り込みとの差が出せず、どちらが正しいか分からなくなるためです。
            </Prose>
          </Section>

          <Section title="金額を直す">
            {result.value.adjustable ? (
              <>
                <Prose>
                  この成果の金額は直せます。直すときは理由も一緒に残してください。
                  直す操作は担当者ご本人が行います。AI からは実行できません。
                </Prose>
                <AdjustConversionForm
                  conversionId={result.value.view.conversionId}
                  currency={result.value.view.currency}
                />
              </>
            ) : (
              <Callout
                tone="info"
                title="いまは直せません"
                reason={result.value.notAdjustableReason ?? ""}
              />
            )}
          </Section>
        </>
      )}
    </AdminShell>
  );
}
