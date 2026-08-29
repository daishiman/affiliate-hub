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
 * 定義（入力欄と読み方）は本物の形にし、式が登録されたものから計算も本物になる。
 *
 * **ブログごとに違う道具を置く。** 道具は「そのブログの読者が最初につまずくこと」
 * に対応して初めて意味を持つ。全ブログに同じ道具が出る状態では、
 * 「道具を持つブログと持たないブログで案内がどう変わるか」を確かめられない。
 * 道具を 1 つも持たないブログ（`first-camera`・`run-and-recover`）も残してある。
 * 空のときの見え方は、道具を足したあとには確かめられない。
 *
 * **式を持つ道具の計算は見本ではない。** 式は本物と同じ読み取り機
 * (`domain/authoring/reader-tool-formula.ts`) が解くので、保存先が無い環境でも
 * 読者は正しい数字を受け取る。式が無い道具は、数字をでっち上げずに未登録と答える。
 */
const TOOLS_BY_SITE: Readonly<Record<string, readonly ReaderToolDefinition[]>> = {
  "home-office-desk": [
    {
      slug: "desk-fit",
      name: "机と椅子の高さの目安",
      purpose: "身長と机の高さから、椅子の座面をどこに合わせればよいかを出す。",
      inputs: [
        { key: "height", label: "身長", unit: "cm", hint: "半角数字で入力してください。" },
        { key: "desk_height", label: "いま使っている机の高さ", unit: "cm" },
        { key: "shoe", label: "室内で靴を履くか", hint: "「はい」か「いいえ」で入力してください。" },
      ],
      howToRead:
        "出てくるのは出発点の数字です。座って肘が 90 度になるかを必ず確かめ、合わなければ 1cm ずつ動かしてください。",
    },
    {
      slug: "monitor-distance",
      name: "画面までの距離の目安",
      purpose: "画面の大きさと解像度から、目が疲れにくい距離を出す。",
      inputs: [
        { key: "inch", label: "画面の大きさ", unit: "インチ" },
        { key: "resolution", label: "横方向の画素数", unit: "px", hint: "例: 2560" },
      ],
      howToRead: "距離を取れない場合は、文字の大きさを上げるほうが先です。",
    },
  ],
  "compact-kitchen-gear": [
    {
      slug: "counter-space",
      name: "調理台に置けるかの確認",
      purpose: "調理台の寸法と、置きたい機器の寸法から、作業できる場所が残るかを出す。",
      inputs: [
        { key: "counter_width", label: "調理台の幅", unit: "cm" },
        { key: "counter_depth", label: "調理台の奥行き", unit: "cm" },
        { key: "device_width", label: "置きたい機器の幅", unit: "cm" },
        { key: "device_depth", label: "置きたい機器の奥行き", unit: "cm" },
      ],
      howToRead:
        "本体の寸法だけでは足りません。蒸気の逃げ道として、上方向に 10cm 以上あるかも確かめてください。",
    },
  ],
  "mobile-plan-navi": [
    {
      slug: "data-plan-fit",
      name: "必要なデータ量の目安",
      purpose: "動画や地図の使い方から、月に必要なデータ量を出す。",
      inputs: [
        { key: "video_minutes", label: "1 日に外で見る動画の時間", unit: "分" },
        { key: "map_days", label: "1 か月に地図を使う日数", unit: "日" },
        { key: "wifi", label: "自宅に固定回線があるか", hint: "「はい」か「いいえ」で入力してください。" },
      ],
      howToRead:
        "出てくるのは平均の月の目安です。旅行のある月は 1.5 倍で見てください。上限を超えた月の速度制限は、プランごとに違います。",
    },
  ],
};

/**
 * 作り付けの道具の定義。
 *
 * これはブログ別の一覧とは別枠で、**保存先がある環境からも重ねて使う**。
 * どのブログにも属さないので `TOOLS_BY_SITE` には載せない。
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

/**
 * そのブログで読者に出す道具。
 *
 * ブログ別に置いたものへ、作り付けの道具を重ねる。重ねる順は作り付けが後で、
 * 同じ `slug` があればブログ側の定義が勝つ（D1 側と同じ重ね方にしてある）。
 */
function toolsFor(siteSlug: string): readonly ReaderToolDefinition[] {
  const own = TOOLS_BY_SITE[siteSlug] ?? [];
  const ownSlugs = new Set(own.map((t) => t.slug));
  return [...own, ...BUILT_IN_READER_TOOLS.map((t) => t.definition).filter((d) => !ownSlugs.has(d.slug))];
}

export function createSampleReaderToolRepository(): EditorialReaderToolPort {
  return markEditorial({
    async find(siteSlug: string, slug: string) {
      return ok(toolsFor(siteSlug).find((t) => t.slug === slug) ?? null);
    },
    async list(siteSlug: string) {
      return ok(toolsFor(siteSlug));
    },
    async run(siteSlug: string, slug: string, values: Readonly<Record<string, string>>) {
      const definition = toolsFor(siteSlug).find((t) => t.slug === slug);
      if (definition === undefined) {
        // 知らない道具の数字をでっち上げると、読者はそれを信じて機材を買う。
        // 出せないものは出せないと返す。
        return err(
          domainError("NOT_FOUND", `「${slug}」という道具は登録されていません。`, {
            suggestedAction: "トップから探し直してください。",
            retryable: false,
          }),
        );
      }
      const builtIn = BUILT_IN_READER_TOOLS.find((t) => t.definition.slug === slug);
      if (builtIn === undefined) {
        // 道具はあるが式がまだ無い。入力欄と読み方までは見せて、数字は出さない。
        return err(
          domainError("NOT_IMPLEMENTED", `「${slug}」の計算はまだ登録されていません。`, {
            suggestedAction:
              "計算式の登録が済むと結果が出ます。それまでは入力欄と結果の読み方だけをご覧ください。",
            retryable: false,
          }),
        );
      }
      return runReaderToolFormula(builtIn.formula, definition.inputs, values);
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
