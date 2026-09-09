import { capabilitiesOf } from "@/domain/identity";
import { AdminShell } from "@/presentation/admin/admin-shell";
import { hiddenEntryCount, workObjectBoard } from "@/presentation/admin/work-object-board";
import {
  actorNotice,
  createToolCatalog,
  currentActor,
  dashboardUseCases,
} from "@/presentation/composition";
import {
  ActionNote,
  Callout,
  Code,
  EmptyView,
  ErrorView,
  ListView,
  Note,
  Prose,
  Section,
  SubSection,
  TextLink,
  WorkBoard,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 管理画面のホーム (§22.1)。
 *
 * ここに並ぶ 11 個の数字は、どれも
 * 「値」「その数が何を意味するか」「解消できる画面」の 3 点セットで出す。
 * 数字だけを並べた画面は、見ても次の操作が決まらないので誰も見なくなる。
 *
 * 数え方は application 層の 1 つのユースケースが持っている。
 * 同じ答えが AI からも `get_dashboard` で返るため、
 * 「画面では 3 件なのに AI は 5 件と言う」が起きない。
 */
export default async function AdminHome() {
  const actor = await currentActor();
  const tools = await createToolCatalog();
  const board = await (await dashboardUseCases()).getDashboard.execute(actor, {});
  /*
    サイドバーと同じ `nav.group` から射影する。ホーム側に第 2 の表を作らない。
    権限で見えない入口はここでも落とすので、サイドバーと見える顔ぶれが食い違わない。
  */
  const capabilities = [...capabilitiesOf(actor.roles)].map(String);
  const objects = workObjectBoard(capabilities);
  const hidden = hiddenEntryCount(capabilities);

  return (
    <AdminShell
      routeId=""
      title="管理"
      lead="いま手当てが要ることから始めます。"
    >
      <Callout
        tone="warn"
        title="たたき台です"
        reason={await actorNotice()}
        action={<TextLink href="/admin/settings">設定を見る</TextLink>}
      />

      <Section title="いま手当てが要ること">
        {!board.ok ? (
          <ErrorView
            title="いまの状況を出せませんでした"
            body={board.error.message}
            suggestedAction={board.error.suggestedAction ?? null}
            action={<TextLink href="/admin/settings">設定を見る</TextLink>}
          />
        ) : (
          <>
            <Prose>
              {board.value.period} 時点の状況です。数字を押すと、そこで手当てできる画面へ移ります。
            </Prose>

            {board.value.allClearReason === null ? (
              <ActionNote tone="danger">
                {board.value.attentionCount}
                件の数字に手当てが要ります。色が付いているものが対象です。上から順に片付ければ、公開が止まっている原因はなくなります。
              </ActionNote>
            ) : (
              <EmptyView title="手当てが要るものはありません" body={board.value.allClearReason} />
            )}

            {board.value.unavailableCount === 0 ? null : (
              /*
                数えられないものを 0 件と書かない。0 件は「片付いた」と読まれる。
                告知は 1 つに留め、内訳は各枠の `unavailableReason` が持つ。
              */
              <Callout
                tone="info"
                title={`${board.value.unavailableCount}件は、まだ数えられません`}
                reason="保存先の接続か、見る権限がまだ揃っていないためです。0 件とは書かず「いま数えられません」と出しています。"
              />
            )}

            <WorkBoard
              caption="いま手当てが要ることの一覧"
              items={board.value.widgets.map((w) => ({
                key: w.key,
                label: w.label,
                valueLabel: w.valueLabel,
                reason: w.reason,
                tone: w.tone,
                href: w.href,
                actionLabel: w.actionLabel,
                unavailableReason: w.unavailableReason,
              }))}
              renderLink={(href, label) => <TextLink href={href}>{label}</TextLink>}
            />
          </>
        )}
      </Section>

      <Section
        title="何について作業しますか"
        lead="管理画面でできることは、この 5 つの対象物のどれかについての作業です。目当てのものを選ぶと、その下の画面が出ます。"
      >
        {objects.map((object) => (
          <SubSection
            key={object.id}
            title={`${object.label}（画面 ${object.screenCount} 枚）`}
          >
            <ListView
              rows={object.entries.map((entry) => ({
                key: entry.href,
                label: entry.label,
                href: entry.href,
              }))}
            />
          </SubSection>
        ))}
        {hidden === 0 ? null : (
          /*
            **減ったなら、代わりに何かが増えていなければならない。**
            権限で入口が落ちただけだと、その人には最初から無かったのと同じに見え、
            誰に頼めば増えるのかが分からない。何が隠れているかは書かない
            (伏せた意味が消える)。数と頼み先だけを出す。
          */
          <Note>
            いまの権限では出していない入口が {hidden} 件あります。必要な場合は、
            ワークスペースの管理者に権限を頼んでください。
          </Note>
        )}
      </Section>

      <Section title="いま試せること">
        <ListView
          rows={[
            {
              key: "new-site",
              label: "新しいブログを作る",
              href: "/admin/sites/new",
              note: "13 の質問に答えると、コードを書かずにブログが 1 本増えます。",
            },
            {
              key: "rankings",
              label: "評価基準で商品を並べる",
              href: "/admin/rankings",
              note: "同じ結果が、画面からも AI からも返ることを確かめられます。",
            },
            {
              key: "ui-catalog",
              label: "部品の見本帳を見る",
              href: "/admin/ui-catalog",
              note: "すべての画面で使う部品と、その状態の見え方をまとめてあります。",
            },
          ]}
        />
      </Section>

      <Section
        title="AI から使える操作"
        lead="この画面と同じ計算をそのまま使っています。画面と AI で違う答えは返りません。"
      >
        <ListView
          rows={tools.map((tool) => ({
            key: tool.name,
            label: <Code>{tool.name}</Code>,
            note: tool.description,
          }))}
        />
      </Section>
    </AdminShell>
  );
}
