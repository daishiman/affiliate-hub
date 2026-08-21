import {
  ChangeMemberRolesForm,
  InviteMemberForm,
  RevokeMemberForm,
} from "@/presentation/admin/member-forms";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  auditLogNotice,
  currentActor,
  settingsNotice,
  settingsUseCases,
} from "@/presentation/composition";
import { AdminShell } from "@/presentation/admin/admin-shell";
import { appearanceOptions, readAppearance } from "@/presentation/appearance";
import {
  AppearancePicker,
  Callout,
  Card,
  DataTable,
  DefinitionList,
  DisclosureNotice,
  EmptyView,
  ErrorView,
  Note,
  Page,
  SectionHeading,
  SeeAlso,
  StackedList,
  StackedRow,
  StorageNotice,
  StubNotice,
} from "@/presentation/ui";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";

/**
 * 設定。
 *
 * この画面の役目は値を並べることではなく、
 * **「いま何ができない状態か」と「その理由」を同じ場所に出す**こと。
 * 上限・未参加・問い合わせ先の未設定は、どれも後で公開を止める原因になる。
 * 公開直前に初めて知るのでは遅い。
 */
export default async function SettingsPage() {
  const actor = await currentActor();
  const uc = await settingsUseCases();

  const appearance = await readAppearance();
  const options = appearanceOptions();

  const [overview, roles, members, brands, disclosures, audit] = await Promise.all([
    uc.getOverview.execute(actor, {}),
    uc.listRoles.execute(actor, {}),
    uc.listMembers.execute(actor, {}),
    uc.listBrands.execute(actor, {}),
    uc.listDisclosures.execute(actor, {}),
    uc.listAuditLog.execute(actor, { limit: 20 }),
  ]);

  /*
   * 招待と役割の変更で選べる役割。**機械の役割（AI）はここに出さない。**
   * 機械にはログインするアドレスが無いので、招待の形では作れない。
   * 出すと「招待したのに永久に参加が成立しない行」を作れてしまう。
   * 役割の一覧を出せなかったときは空になり、下の操作欄そのものが出ない
   * （選べる役割が分からないまま権限を配らせない）。
   */
  const roleOptions = roles.ok
    ? roles.value.rows
        .filter((r) => !r.isMachine)
        .map((r) => ({ value: r.role as string, label: r.label }))
    : [];

  if (!overview.ok) {
    return (
      <Shell>
        <ErrorView
          title="設定を出せませんでした"
          body={overview.error.message}
          suggestedAction={overview.error.suggestedAction ?? null}
          action={<Link href="/admin">ホームへ戻る</Link>}
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <StubNotice
        what="作業場所・ブランド・広告表記の保存先"
        blockedBy="workspaces / brands / disclosures テーブルの追加"
        stubId="persistence:settings-sample"
      >
        <span>{settingsNotice()}</span>
      </StubNotice>

      <Card>
        <SectionHeading level={2}>ログイン</SectionHeading>
        <p className={styles.sectionLead}>
          いまは見本の担当者として動いています。Google でのログインをつなぐと、
          許可した人だけが入れる状態になります。
        </p>
        <SeeAlso>
          <Link href="/signin">いま誰として動いているかを見る</Link>
        </SeeAlso>
      </Card>

      <Card>
        <SectionHeading level={2}>生成 AI の API キー</SectionHeading>
        <p className={styles.sectionLead}>
          記事を書かせるために使う鍵を登録します。鍵が 1 つも入っていないあいだは、下書きの生成が
          呼び出しの手前で止まります。
        </p>
        <SeeAlso>
          <Link href="/admin/settings/llm">API キーの登録と状態を見る</Link>
        </SeeAlso>
      </Card>

      <Card>
        <SectionHeading level={2}>画面の見た目</SectionHeading>
        <p className={styles.sectionLead}>
          ここでの選択はあなたの手元だけに効きます。ブログの見た目（読者に見える色）は、
          各ブログの設定で決まります。
        </p>
        {/*
          読者向けブログでも同じ部品を使う（明るさだけを出す）。
          管理画面用の見た目切り替えを別に作らないこと。
        */}
        <AppearancePicker
          current={appearance}
          schemeOptions={options.schemeOptions}
          modeOptions={options.modeOptions}
          description="選ぶとすぐ変わります。次に開いたときも同じ見た目になります（この端末のブラウザに覚えさせています）。"
        />
      </Card>

      {overview.value.blockedReason !== null && (
        <Callout
          tone="warn"
          title="いま止まっていること"
          reason={overview.value.blockedReason}
        />
      )}

      <Card>
        <SectionHeading level={2}>この作業場所</SectionHeading>
        {/*
          **これは表ではなかった。**`<thead>` を持たない「項目と値の対」なので
          `<dl>` へ寄せた。管理画面の 22 箇所で既に同じ中身が `<dl>` で
          書かれていて、そちらが多数派である（残課題 142）。
        */}
        <DefinitionList
          items={[
            { term: "名前", description: overview.value.workspaceName },
            { term: "契約の区分", description: overview.value.planLabel },
            {
              term: "時間帯",
              description: `${overview.value.timezone}（公開予約と締めの基準）`,
            },
            { term: "通貨", description: overview.value.currency },
          ]}
        />

        <SectionHeading level={3}>使用数と上限</SectionHeading>
        <DataTable
          caption="契約の区分ごとに決まっている上限と、いまの使用数です。上限に達すると新しく作れません。"
          columns={[
            { key: "label", header: "種類", rowHeader: true, cell: (c) => c.label },
            { key: "used", header: "いま", align: "numeric", cell: (c) => c.used },
            { key: "max", header: "上限", align: "numeric", cell: (c) => c.max },
            {
              key: "state",
              header: "状態",
              cell: (c) =>
                c.full ? "上限に達しています（これ以上増やせません）" : "追加できます",
            },
          ]}
          rows={overview.value.capacities}
          rowKey={(c) => c.label}
        />
      </Card>

      <Card>
        <SectionHeading level={2}>担当者</SectionHeading>
        {/*
         * 招待は**入口の許可とは別**である。ここで足すのは「この作業場所の担当者だ」
         * という 1 行で、ログインできる人の名簿（`AUTH_ALLOWED_EMAILS`）ではない。
         * 2 つを 1 つにまとめない。まとめると、画面から書ける表が入口の許可そのものになり、
         * 担当者を管理できる人が誰でも自分でログインできる人を増やせる。
         */}
        <Callout
          tone="info"
          title="招待しただけでは、まだ入れません"
          reason="入口は 2 段になっています。ここでの招待に加えて、ログインを許可する名簿にもそのアドレスが必要です。名簿は運用側で設定します。"
        />
        {!members.ok ? (
          <ErrorView
            title="担当者を出せませんでした"
            body={members.error.message}
            suggestedAction={members.error.suggestedAction ?? null}
          />
        ) : members.value.rows.length === 0 ? (
          <EmptyView
            title="担当者がいません"
            body={members.value.emptyReason ?? "招待するとここに並びます。"}
          />
        ) : (
          <>
            {members.value.ownerMissing && (
              <Callout
                tone="warn"
                title="運営者が決まっていません"
                reason="運営者がいないと、契約と支払いに関する操作を誰も行えません。"
              />
            )}
            {/* 「変える」列は `DataTable` の行内操作の仕組みではなく、ただの列。
                部品側に操作用の口を作らなかったので、操作を出すかどうかの判断
                （役割の選択肢が無いなら列ごと出さない）がこの画面に残る。
                部品に持たせると、この判断が別の画面からも見えない場所へ移る。 */}
            <DataTable
              caption="この作業場に招いた担当者と、それぞれの役割"
              columns={[
                { key: "name", header: "名前", rowHeader: true, cell: (m) => m.displayName },
                { key: "email", header: "招待したアドレス", cell: (m) => m.invitedEmail },
                { key: "roles", header: "役割", cell: (m) => m.roleLabels.join("・") },
                { key: "state", header: "状態", cell: (m) => m.stateLabel },
                { key: "scope", header: "担当の範囲", cell: (m) => m.scopeLabel },
                ...(roleOptions.length > 0
                  ? [
                      {
                        key: "change",
                        header: "変える",
                        cell: (m: (typeof members.value.rows)[number]) => (
                          <>
                            <ChangeMemberRolesForm
                              membershipId={m.membershipId}
                              displayName={m.displayName}
                              currentRoles={[...m.roles]}
                              roleOptions={roleOptions}
                            />
                            {/* 外した人には出さない。押せる形で残すと「もう一度外す」操作が
                                記録にだけ増える。 */}
                            {m.active && (
                              <RevokeMemberForm
                                membershipId={m.membershipId}
                                displayName={m.displayName}
                              />
                            )}
                          </>
                        ),
                      },
                    ]
                  : []),
              ]}
              rows={members.value.rows}
              rowKey={(m) => m.membershipId}
            />
          </>
        )}

        {members.ok && roleOptions.length > 0 && (
          <>
            <SectionHeading level={3}>担当者を招く</SectionHeading>
            <InviteMemberForm roleOptions={roleOptions} />
          </>
        )}
      </Card>

      <Card>
        <SectionHeading level={2}>役割ごとにできること</SectionHeading>
        {!roles.ok ? (
          <ErrorView
            title="役割を出せませんでした"
            body={roles.error.message}
            suggestedAction={roles.error.suggestedAction ?? null}
          />
        ) : (
          <>
            <Callout
              tone="info"
              title="人だけが行える操作"
              reason={`${roles.value.humanOnlyNote}。これらは AI からは呼べません。役割の設定に関係なく、機械には渡りません。`}
            />
            <div className={styles.catalogStack}>
              {roles.value.rows.map((r) => (
                <div key={r.role} className={styles.catalogRow}>
                  <SectionHeading level={3}>{r.label}</SectionHeading>
                  <StackedList>
                    {r.capabilities.map((c) => (
                      <StackedRow key={c.key}>{c.label}</StackedRow>
                    ))}
                  </StackedList>
                  {r.humanOnlyBlocked.length > 0 && (
                    <Note>
                      役割の表には入っていますが、機械には渡していません:{" "}
                      {r.humanOnlyBlocked.join("・")}
                    </Note>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <Card>
        <SectionHeading level={2}>ブランド</SectionHeading>
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
              <Callout
                tone="warn"
                title={`公開の前に埋める項目が残っています（${brands.value.notReadyCount}件）`}
                reason="運営者の表示名と問い合わせ先が無いと、訂正の連絡先を読者に示せません。この状態では記事を公開できません。"
              />
            )}
            <div className={styles.catalogStack}>
              {brands.value.rows.map((b) => (
                <div key={b.brandId} className={styles.catalogRow}>
                  <SectionHeading level={3}>{b.displayName}</SectionHeading>
                  <p className={styles.sectionLead}>{b.positioning}</p>
                  <DefinitionList
                    items={[
                      { term: "運営者の表示名", description: b.legalName ?? "未設定" },
                      { term: "問い合わせ先", description: b.contactEmail ?? "未設定" },
                      { term: "文体", description: b.voiceLabel },
                      {
                        term: "使わない言い回し",
                        description:
                          b.avoidPhrases.length === 0 ? "指定なし" : b.avoidPhrases.join("・"),
                      },
                      { term: "記事末尾の断り書き", description: b.disclaimer ?? "未設定" },
                      { term: "言語", description: b.locale },
                      {
                        term: "時間帯",
                        description: `${b.timeZone}（投稿の予定日時はこの時間帯で読み書きします）`,
                      },
                      { term: "標準の行動文言", description: b.defaultCta },
                    ]}
                  />
                  {b.missing.length > 0 && (
                    <Note>
                      公開の前に必要: {b.missing.join("・")}
                    </Note>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <Card>
        <SectionHeading level={2}>広告であることの表示</SectionHeading>
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
            <p className={styles.sectionLead}>
              下の文言は、記事・SNS・AI の回答など次の場所すべてに同じものが出ます。画面ごとに書き換えることはできません。
            </p>
            <StackedList>
              {disclosures.value.surfaces.map((s) => (
                <StackedRow key={s.key}>{s.label}</StackedRow>
              ))}
            </StackedList>
            <div className={styles.catalogStack}>
              {disclosures.value.rows.map((d) => (
                <div key={d.disclosureId} className={styles.catalogRow}>
                  <SectionHeading level={3}>
                    {d.relationshipLabel}
                    {d.required ? "（表示が必要）" : "（表示は不要）"}
                  </SectionHeading>
                  {/* 読者に出るものと同じ見た目で確かめる。別の書き方を画面用に作らない。
                      一覧なので目印にはしない（同じ名前の目印が行の数だけ並ぶため）。 */}
                  <DisclosureNotice asLandmark={false} message={d.visibleMessage} />
                  <DefinitionList
                    items={[
                      { term: "提供元", description: d.advertiserOrSupplier ?? "なし" },
                      { term: "リンクに付ける印", description: d.relAttribute },
                      {
                        term: "AI を使ったか",
                        description: d.aiAssisted
                          ? "使った（本文に明記されます）"
                          : "使っていない",
                      },
                    ]}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <Card>
        <SectionHeading level={2}>操作の記録</SectionHeading>
        {/*
         * **ここを消さない。** 記録は「残った」と言えること自体が意味を持つ
         * 唯一の種類なので、控え（この実行中だけ覚える置き場）で動いている
         * あいだは必ず文字で出す。黙って控えへ落ちる記録は、
         * 残っていると思われて残っていないぶん、無いより悪い。
         */}
        <StorageNotice status={await auditLogNotice()} />
        {!audit.ok ? (
          // 権限が無い場合はここに入る。「空」ではなく「見られない理由」を出す。
          <Callout
            tone="info"
            title="操作の記録は表示できません"
            reason={`${audit.error.message}${
              audit.error.suggestedAction === undefined ? "" : ` ${audit.error.suggestedAction}`
            }`}
          />
        ) : audit.value.rows.length === 0 ? (
          <EmptyView
            title="まだ記録がありません"
            body={audit.value.emptyReason ?? "操作を行うとここに並びます。"}
          />
        ) : (
          <>
            {/* 行の見出しは 3 列目（何をしたか）。この表で行を名指すのは日時でも
                人でもなく操作なので、`rowHeader` を 1 列目に寄せない。 */}
            <DataTable
              caption="この作業場で行われた操作の記録"
              columns={[
                {
                  key: "occurredAt",
                  header: "いつ",
                  cell: (r) => r.occurredAt.toLocaleString("ja-JP"),
                },
                {
                  key: "actor",
                  header: "誰が",
                  cell: (r) => (r.byHuman ? r.actorLabel : `${r.actorLabel}・人ではありません`),
                },
                { key: "action", header: "何を", rowHeader: true, cell: (r) => r.action },
                { key: "target", header: "対象", cell: (r) => r.targetLabel },
                { key: "reason", header: "理由", cell: (r) => r.reason ?? "—" },
              ]}
              rows={audit.value.rows}
              rowKey={(r) => `${r.occurredAt.toISOString()}-${r.targetLabel}-${r.action}`}
            />
            <Note>
              この記録は後から書き換えられません。承認が人によるものであることを、あとから確かめるために残しています。
            </Note>
          </>
        )}
      </Card>
    </Shell>
  );
}

function Shell({ children }: { readonly children: ReactNode }) {
  return (
    <AdminShell
      currentPath="/admin/settings"
      breadcrumbs={[{ label: "ホーム", href: "/admin" }, { label: "設定" }]}
      actions={<Link href="/admin">ホームへ戻る</Link>}
    >
      <Page
        title="設定"
        lead="この作業場所の契約・担当者・ブランド・広告表記と、これまでの操作の記録を見る画面です。"
      >
        {children}
      </Page>
    </AdminShell>
  );
}
