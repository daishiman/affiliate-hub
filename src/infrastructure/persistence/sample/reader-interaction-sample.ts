import type {
  EditorialContactPort,
  EditorialReaderToolPort,
  EditorialShortlistPort,
  ReaderToolDefinition,
  ShortlistItem,
} from "@/application/ports/reader-interaction";
import {
  type ReaderToolFormula,
  runReaderToolFormula,
} from "@/domain/authoring/reader-tool-formula";
import { domainError, err, markEditorial, ok } from "@/domain/shared";
import { registerStub } from "../../stub-registry";

/**
 * 読者向けの 3 つの控え。
 *
 *   気になる商品 … 保存先 (D1) が無い環境の控え。本物は `d1/reader-shortlist-repository.ts`。
 *   診断・計算   … 保存先が無い環境の控え。計算そのものは本物と同じ読み取り機で解く。
 *   問い合わせ   … 保存先が無い環境の控え。本物は `d1/contact-repository.ts`。
 *                  **ここは受け取ったふりをしない。** メモリに置けば読者には
 *                  送れたように見えるが、運営者が読む前に消える。
 *
 * まだ残っている外の作業は、問い合わせの**メール通知**だけ
 * （自動送信よけ (Turnstile) の鍵と送信元アドレスの登録。利用者本人が登録する）。
 * 通知が無くても、届いた分は /admin/contact で読める。
 */

const shortlistStub = registerStub({
  id: "reader:shortlist-memory",
  port: "ShortlistPort",
  label: "気になる商品の保存（処理中のメモリ）",
  blockedBy: "保存先 (D1) がつながっていない環境での控え",
  // 本物ができたので控えへ格下げ。保存先がある環境では
  // `d1/reader-shortlist-repository.ts` が使われ、ここは通らない。
  fallbackFor: "src/infrastructure/persistence/d1/reader-shortlist-repository.ts",
});

const toolStub = registerStub({
  id: "reader:tools-sample",
  port: "ReaderToolPort",
  label: "診断・計算の道具（作り付けの 1 つだけ）",
  blockedBy: "保存先 (D1) がつながっていない環境での控え",
  // 本物ができたので控えへ格下げ。保存先がある環境では
  // `d1/reader-tool-repository.ts` が使われ、運営者が道具を増やせる。
  fallbackFor: "src/infrastructure/persistence/d1/reader-tool-repository.ts",
});

const contactStub = registerStub({
  id: "reader:contact-sink",
  port: "ContactPort",
  label: "問い合わせの受け取り（保存先が無い環境では断る）",
  blockedBy: "保存先 (D1) がつながっていない環境での控え",
  // 本物ができたので控えへ格下げ。保存先がある環境では
  // `d1/contact-repository.ts` が受け取り、/admin/contact で読める。
  // メール通知はまだ無い（Turnstile の鍵と送信元アドレスの登録は利用者本人の作業）。
  fallbackFor: "src/infrastructure/persistence/d1/contact-repository.ts",
});

export const READER_STUB_IDS = {
  shortlist: shortlistStub.id,
  tools: toolStub.id,
  contact: contactStub.id,
} as const;

/**
 * 処理中のメモリに置く保存先。**保存先 (D1) が無い環境だけの控え。**
 *
 * Workers では処理ごとに消える可能性がある。控えなので、それでよい。
 * ここで localStorage や cookie に逃がすと、控えのほうが本物より
 * よく残るようになり、D1 が繋がっていない状態に誰も気づかなくなる。
 */
const memory = new Map<string, ShortlistItem[]>();

function key(siteSlug: string, readerKey: string): string {
  return `${siteSlug}::${readerKey}`;
}

export function createSampleShortlistRepository(): EditorialShortlistPort {
  return markEditorial({
    async list(siteSlug: string, readerKey: string) {
      return ok(memory.get(key(siteSlug, readerKey)) ?? []);
    },
    async add(siteSlug: string, readerKey: string, item: ShortlistItem) {
      const k = key(siteSlug, readerKey);
      const current = memory.get(k) ?? [];
      // 同じ商品を 2 回押しても増やさない。読者から見て「押せてしまう」だけの操作にしない。
      memory.set(k, [...current.filter((i) => i.productId !== item.productId), item]);
      return ok(true as const);
    },
    async remove(siteSlug: string, readerKey: string, productId: string) {
      const k = key(siteSlug, readerKey);
      memory.set(k, (memory.get(k) ?? []).filter((i) => i.productId !== productId));
      return ok(true as const);
    },
  });
}

/**
 * 作り付けの道具（1 つだけ）。
 *
 * **計算はもう見本ではない。** 式は本物と同じ読み取り機
 * (`domain/authoring/reader-tool-formula.ts`) が解くので、
 * 保存先が無い環境でも読者は正しい数字を受け取る。
 * 保存先がある環境では、運営者が登録した道具がこれに置き換わる。
 */
const STORAGE_ESTIMATOR: ReaderToolDefinition = {
  slug: "storage-estimator",
  name: "必要な保存容量の目安",
  purpose: "撮影する時間と画質から、編集に必要な保存容量のおおよその大きさを出す。",
  inputs: [
    { key: "minutes", label: "1 か月に撮影する時間", unit: "分", hint: "半角数字で入力してください。" },
    { key: "bitrate", label: "映像の記録レート", unit: "Mbps", hint: "カメラの説明書に書かれています。" },
    { key: "months", label: "手元に残しておきたい期間", unit: "か月" },
  ],
  howToRead:
    "出てくるのは素材だけの大きさです。編集中の一時ファイルと書き出し先を別に用意してください。",
};

/**
 * 「必要な保存容量の目安」の計算式。
 *
 * 1 秒あたり `bitrate` メガビット → 8 で割ってメガバイト → 1000 で割ってギガバイト。
 * 段を分けているのは、**読者が「どこで大きくなったか」を追えるようにするため**。
 * 1 行で最終値だけ出すと、桁が思ったより大きくても理由が見えない。
 */
const STORAGE_ESTIMATOR_FORMULA: ReaderToolFormula = {
  rows: [
    {
      label: "1 か月あたりの素材",
      expression: "minutes * 60 * bitrate / 8 / 1000",
      unit: " GB",
      decimals: 1,
      as: "monthly",
    },
    {
      label: "残しておく期間ぶん",
      expression: "monthly * months",
      unit: " GB",
      decimals: 0,
      as: "total",
    },
    {
      // 実際には編集中の一時ファイルと書き出し先が要る。素材ちょうどの容量を
      // 買うと必ず足りなくなるので、余裕を見た数字も一緒に出す。
      label: "余裕を見た目安",
      expression: "total * 1.5",
      unit: " GB",
      decimals: 0,
    },
  ],
  summary:
    "素材だけで {残しておく期間ぶん} になります。編集の作業ぶんを足すと {余裕を見た目安} ほど見ておくと安心です。",
};

/**
 * 作り付けの道具の一覧。**保存先がある環境からも参照する。**
 *
 * 保存先を繋いだ瞬間に、それまで動いていた道具が一覧から消えるのは
 * 「登録し忘れ」ではなく壊れたようにしか見えない。
 * D1 側はここへ重ねる（同じ `slug` を登録すれば運営者の定義が勝つ）。
 */
export const BUILT_IN_READER_TOOLS: readonly {
  readonly definition: ReaderToolDefinition;
  readonly formula: ReaderToolFormula;
}[] = [{ definition: STORAGE_ESTIMATOR, formula: STORAGE_ESTIMATOR_FORMULA }];

export function createSampleReaderToolRepository(): EditorialReaderToolPort {
  return markEditorial({
    async find(_siteSlug: string, slug: string) {
      return ok(slug === STORAGE_ESTIMATOR.slug ? STORAGE_ESTIMATOR : null);
    },
    async list(_siteSlug: string) {
      return ok([STORAGE_ESTIMATOR]);
    },
    async run(_siteSlug: string, slug: string, values: Readonly<Record<string, string>>) {
      if (slug !== STORAGE_ESTIMATOR.slug) {
        // 知らない道具の数字をでっち上げると、読者はそれを信じて機材を買う。
        // 出せないものは出せないと返す。
        return err(
          domainError("NOT_FOUND", `「${slug}」という道具は登録されていません。`, {
            suggestedAction: "トップから探し直してください。",
            retryable: false,
          }),
        );
      }
      return runReaderToolFormula(STORAGE_ESTIMATOR_FORMULA, STORAGE_ESTIMATOR.inputs, values);
    },
  });
}

/**
 * 保存先が無い環境の控え。
 *
 * **ここは受け付けない。** 気になる商品と違い、問い合わせを処理中のメモリに
 * 置くと、読者には「送れた」と見えたまま、運営者が読む前に消える。
 * 消えたことは誰にも分からない。受け取れないなら、受け取れないと言うほうがよい。
 */
export function createSampleContactSink(): EditorialContactPort {
  return markEditorial({
    async submit(_workspaceId, message, _rateLimitKey) {
      // 本文はログにも残さない。個人情報が入りうるため。
      return err(
        domainError("UPSTREAM_UNAVAILABLE", "問い合わせの保存先につながっていません。", {
          suggestedAction: `お手数ですが、${message.siteSlug} の運営者へ直接ご連絡ください。つながり次第この画面から送れるようになります。`,
          retryable: true,
        }),
      );
    },
    async list(_workspaceId, _ownedSiteSlugs: readonly string[], _siteSlug?: string) {
      // 受け付けていないので、いつも空。「まだ 0 件」ではなく「入る場所が無い」。
      return ok([]);
    },
    async markHandled(
      _workspaceId,
      _ownedSiteSlugs: readonly string[],
      _id: string,
      _handled: boolean,
      _at: string,
    ) {
      return err(
        domainError("UPSTREAM_UNAVAILABLE", "問い合わせの保存先につながっていません。", {
          suggestedAction: "保存先 (D1) をつないでから操作してください。",
          retryable: true,
        }),
      );
    },
  });
}
