import { AdminShell } from "@/presentation/admin/admin-shell";
import { auditLogNotice, currentActor, settingsUseCases } from "@/presentation/composition";
import {
  Callout,
  ListView,
  SeeAlso,
  Prose,
  Section,
  StorageNotice,
  TextLink,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 設定の索引。
 *
 * **ここでは何も設定しない。** 以前は 8 つの用途（ログイン・鍵・見た目・作業場所・
 * 担当者・役割・ブランド・記録）を 1 枚に積んでいたので、
 * 「上限を確かめに来た人」も「鍵を入れに来た人」も同じ長い画面を上から読んでいた。
 *
 * 分けた先はサイドバーに載せない（A9）。**索引からだけ入る**ことで、
 * 子画面にいるあいだも「設定の中にいる」が分かる。
 *
 * 例外は「いま止まっていること」の 1 行で、これだけはここに残す。
 * 止まっている理由は、どの子画面を開くかを決めるための情報だからである。
 */

type Entry = {
  readonly href: string;
  readonly label: string;
  /** 何ができるか。1 行。ここで決めるのは「どれを開くか」だけ。 */
  readonly summary: string;
};

const ENTRIES: readonly Entry[] = [
  {
    href: "/admin/settings/appearance",
    label: "画面の見た目",
    summary: "この端末だけの明るさと色。",
  },
  {
    href: "/admin/settings/workspaces",
    label: "この作業場所",
    summary: "契約・上限・ブランド・広告表記。",
  },
  { href: "/admin/settings/members", label: "担当者", summary: "誰が何を担当しているか。" },
  {
    href: "/admin/settings/roles",
    label: "役割ごとにできること",
    summary: "役割で許される操作の一覧。",
  },
  { href: "/admin/settings/llm", label: "生成 AI の API キー", summary: "記事を書かせるための鍵。" },
  {
    href: "/admin/settings/integration-access",
    label: "取得用の鍵",
    summary: "外から読むための鍵の発行と失効。",
  },
  { href: "/admin/settings/audit", label: "操作の記録", summary: "誰がいつ何をしたかの記録。" },
];

export default async function SettingsPage() {
  const actor = await currentActor();
  const overview = await (await settingsUseCases()).getOverview.execute(actor, {});

  /*
    索引が開けないことは無い。上限や名前が読めないときも、行き先の一覧は出す。
    ただし**読めなかったことは黙らない**。読めなかったのを「止まっていない」と
    同じ見た目にすると、上限に当たっていても索引はいつもどおり静かに並ぶ。
  */
  const blocked = overview.ok
    ? overview.value.blockedReason
    : `${overview.error.message}${
        overview.error.suggestedAction === null ? "" : ` ${overview.error.suggestedAction}`
      }`;

  return (
    <AdminShell
      routeId="settings"
      title="設定"
      lead="設定したい対象を選びます。"
      actions={<TextLink href="/admin">ホームへ戻る</TextLink>}
    >
      {blocked !== null && (
        <Callout
          tone="warn"
          title={overview.ok ? "いま止まっていること" : "いまの状態を確かめられません"}
          reason={blocked}
        />
      )}

      <Section title="設定する対象">
        <ListView
          rows={ENTRIES.map((e) => ({
            key: e.href,
            label: e.label,
            href: e.href,
            note: e.summary,
          }))}
        />

        {/*
          操作の記録がどこに残るかは、子画面ではなく**索引に**出す。
          記録の一覧そのものは `audit.read` を持つ人しか開けないので、
          子画面へ寄せると、開けない大多数には「記録は残っている」としか
          見えない。残っていると思われて残っていない記録は、記録が無い
          状態より悪い。ここは権限の外側に置く。
        */}
        <StorageNotice status={await auditLogNotice()} />
      </Section>

      <Section title="ログイン">
        <Prose>
          いまは見本の担当者として動いています。Google でのログインをつなぐと、
          許可した人だけが入れる状態になります。
        </Prose>
        <SeeAlso>
          <TextLink href="/signin">いま誰として動いているかを見る</TextLink>
        </SeeAlso>
      </Section>
    </AdminShell>
  );
}
