import { AdminShell } from "@/presentation/admin/admin-shell";
import { currentActor, settingsNotice, settingsUseCases } from "@/presentation/composition";
import {
  ActionNote,
  Callout,
  DataTable,
  DisclosureNotice,
  EmptyView,
  ErrorView,
  FactList,
  ListView,
  Note,
  Prose,
  Section,
  StubNotice,
  SubSection,
  TextLink,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * この作業場所。
 *
 * `/admin/settings` から移出した。契約の区分・上限・ブランド・広告表記を
 * ここへまとめている。**ばらばらの画面にしない**のは、この 4 つが
 * 「公開できるか」という 1 つの問いに対する答えだからである。
 * 上限に達していても、問い合わせ先が空でも、止まるのは同じ公開である。
 */
export default async function WorkspaceSettingsPage() {
  const actor = await currentActor();
  const uc = await settingsUseCases();

  const [overview, brands, disclosures] = await Promise.all([
    uc.getOverview.execute(actor, {}),
    uc.listBrands.execute(actor, {}),
    uc.listDisclosures.execute(actor, {}),
  ]);

  return (
    <AdminShell
      routeId="settings/workspaces"
      title="この作業場所"
      lead="契約・上限・ブランド・広告表記。"
      actions={
        <>
          <TextLink href="/admin/settings/workspaces/edit">設定を直す</TextLink>
          <TextLink href="/admin/settings/brands/new">ブランドを作る</TextLink>
          <TextLink href="/admin/settings">設定へ戻る</TextLink>
        </>
      }
    >
      {!overview.ok ? (
        <ErrorView
          title="作業場所を出せませんでした"
          body={overview.error.message}
          suggestedAction={overview.error.suggestedAction ?? null}
          action={<TextLink href="/admin/settings">設定へ戻る</TextLink>}
        />
      ) : (
        <>
          {overview.value.blockedReason !== null && (
            <Callout
              tone="warn"
              title="いま止まっていること"
              reason={overview.value.blockedReason}
            />
          )}

          <Section title="基本">
            <FactList
              rows={[
                { key: "name", label: "名前", value: overview.value.workspaceName },
                { key: "plan", label: "契約の区分", value: overview.value.planLabel },
                {
                  key: "tz",
                  label: "時間帯",
                  value: `${overview.value.timezone}（公開予約と締めの基準）`,
                },
                { key: "currency", label: "通貨", value: overview.value.currency },
              ]}
            />
          </Section>

          <Section title="使用数と上限">
            <DataTable
              caption="いくつまで作れるかと、いまの数"
              columns={[
                { key: "label", label: "種類" },
                { key: "used", label: "いま", numeric: true },
                { key: "max", label: "上限", numeric: true },
                { key: "state", label: "状態" },
              ]}
              rows={overview.value.capacities.map((c) => ({
                key: c.label,
                cells: [
                  c.label,
                  c.used,
                  c.max,
                  c.full ? "上限に達しています（これ以上増やせません）" : "追加できます",
                ],
              }))}
            />
          </Section>

          <Section title="ブランド">
            {!brands.ok ? (
              <ErrorView
                title="ブランドを出せませんでした"
                body={brands.error.message}
                suggestedAction={brands.error.suggestedAction ?? null}
              />
            ) : brands.value.rows.length === 0 ? (
              <EmptyView
                title="ブランドがありません"
                body={brands.value.emptyReason ?? "登録するとここに並びます。"}
              />
            ) : (
              <>
                {brands.value.notReadyCount > 0 && (
                  <ActionNote tone="danger">
                    公開の前に埋める項目が {brands.value.notReadyCount}{" "}
                    件残っています。運営者の表示名と問い合わせ先が無いと、訂正の連絡先を読者に示せません。この状態では記事を公開できません。
                  </ActionNote>
                )}
                {brands.value.rows.map((b) => (
                  <SubSection key={b.brandId} title={b.displayName} lead={b.positioning}>
                    <FactList
                      rows={[
                        { key: "legal", label: "運営者の表示名", value: b.legalName ?? "未設定" },
                        { key: "mail", label: "問い合わせ先", value: b.contactEmail ?? "未設定" },
                        { key: "voice", label: "文体", value: b.voiceLabel },
                        {
                          key: "avoid",
                          label: "使わない言い回し",
                          value:
                            b.avoidPhrases.length === 0 ? "指定なし" : b.avoidPhrases.join("・"),
                        },
                        {
                          key: "disclaimer",
                          label: "記事末尾の断り書き",
                          value: b.disclaimer ?? "未設定",
                        },
                        { key: "locale", label: "言語", value: b.locale },
                        {
                          key: "tz",
                          label: "時間帯",
                          value: `${b.timeZone}（投稿の予定日時はこの時間帯で読み書きします）`,
                        },
                        { key: "cta", label: "標準の行動文言", value: b.defaultCta },
                      ]}
                    />
                    {b.missing.length > 0 && (
                      <Note>公開の前に必要: {b.missing.join("・")}</Note>
                    )}
                    {/* 行ごとに入口を置く。一覧の外に「直す」を 1 つだけ置くと、
                        どれを直すのかを別の欄で選び直すことになる。 */}
                    <TextLink href={`/admin/settings/brands/${encodeURIComponent(b.brandId)}`}>
                      このブランドを直す
                    </TextLink>
                  </SubSection>
                ))}
              </>
            )}
          </Section>

          <Section title="広告であることの表示">
            {/* 作業場所とブランドは本物の保存先へ移った。ここだけがまだ見本なので、
                断りもここだけに置く。画面の頭に出したままにすると、
                直したブランドが保存されていないように読める。 */}
            <StubNotice
              what="広告表記の保存先"
              blockedBy="disclosures テーブルの追加"
              stubId="persistence:settings-sample"
            >
              {settingsNotice()}
            </StubNotice>
            {!disclosures.ok ? (
              <ErrorView
                title="広告表記を出せませんでした"
                body={disclosures.error.message}
                suggestedAction={disclosures.error.suggestedAction ?? null}
              />
            ) : disclosures.value.rows.length === 0 ? (
              <EmptyView
                title="広告表記がありません"
                body={disclosures.value.emptyReason ?? "登録するとここに並びます。"}
              />
            ) : (
              <>
                <Prose>
                  下の文言は、記事・SNS・AI の回答など次の場所すべてに同じものが出ます。画面ごとに書き換えることはできません。
                </Prose>
                <ListView
                  rows={disclosures.value.surfaces.map((s) => ({ key: s.key, label: s.label }))}
                />
                {disclosures.value.rows.map((d) => (
                  <SubSection
                    key={d.disclosureId}
                    title={`${d.relationshipLabel}${d.required ? "（表示が必要）" : "（表示は不要）"}`}
                  >
                    {/* 読者に出るものと同じ見た目で確かめる。別の書き方を画面用に作らない。
                        一覧なので目印にはしない（同じ名前の目印が行の数だけ並ぶため）。 */}
                    <DisclosureNotice asLandmark={false} message={d.visibleMessage} />
                    <FactList
                      rows={[
                        {
                          key: "advertiser",
                          label: "提供元",
                          value: d.advertiserOrSupplier ?? "なし",
                        },
                        { key: "rel", label: "リンクに付ける印", value: d.relAttribute },
                        {
                          key: "ai",
                          label: "AI を使ったか",
                          value: d.aiAssisted ? "使った（本文に明記されます）" : "使っていない",
                        },
                      ]}
                    />
                  </SubSection>
                ))}
              </>
            )}
          </Section>
        </>
      )}
    </AdminShell>
  );
}
