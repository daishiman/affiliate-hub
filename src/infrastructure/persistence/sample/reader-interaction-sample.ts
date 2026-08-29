import type {
  EditorialContactPort,
  EditorialReaderToolPort,
  EditorialShortlistPort,
  ReaderToolDefinition,
  ShortlistItem,
} from "@/application/ports/reader-interaction";
import { domainError, err, markEditorial, ok } from "@/domain/shared";
import { registerStub } from "../../stub-registry";

/**
 * ★ これは仮置きの見本です（スタブ）。★
 *
 * 「気になる商品」「診断・計算」「問い合わせ」の 3 つは、
 * どれも**外側の用意が終わっていない**ため本物にできない:
 *
 *   気になる商品 … 読者ごとの保存先 (KV) を用意していない。
 *                  ここでは処理中のメモリに置くので、再起動で消える。
 *   診断・計算   … 計算に使う商品データの取込が終わっていない。
 *   問い合わせ   … 自動送信よけ (Turnstile) と送信元メールの登録が済んでいない。
 *
 * 動いているように見せない。画面には必ず見本の表示を出す。
 */

const shortlistStub = registerStub({
  id: "reader:shortlist-memory",
  port: "ShortlistPort",
  label: "気になる商品の保存（処理中のメモリ）",
  blockedBy: "読者ごとの保存先 (KV 名前空間) の作成",
});

const toolStub = registerStub({
  id: "reader:tools-sample",
  port: "ReaderToolPort",
  label: "診断・計算の道具（見本の定義のみ）",
  blockedBy: "商品データの取込と、道具ごとの計算式の登録",
});

const contactStub = registerStub({
  id: "reader:contact-sink",
  port: "ContactPort",
  label: "問い合わせの受け取り（送信せず記録のみ）",
  blockedBy: "Turnstile の鍵と送信元メールアドレスの登録（利用者本人が登録する）",
});

export const READER_STUB_IDS = {
  shortlist: shortlistStub.id,
  tools: toolStub.id,
  contact: contactStub.id,
} as const;

/**
 * 処理中のメモリに置く保存先。
 *
 * Workers では処理ごとに消える可能性がある。**それでよい。**
 * ここで localStorage や cookie に逃がすと、保存先が決まったつもりになり、
 * 本物の実装（KV）を用意する動機が消える。
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
 * 見本の道具。
 *
 * 定義（入力欄と読み方）は本物の形にし、計算だけを見本にする。
 * 定義の形が決まっていれば、計算式を登録するだけで本物になる。
 *
 * **ブログごとに違う道具を置く。** 道具は「そのブログの読者が最初につまずくこと」
 * に対応して初めて意味を持つ。全ブログに同じ道具が出る状態では、
 * 「道具を持つブログと持たないブログで案内がどう変わるか」を確かめられない。
 * 道具を 1 つも持たないブログ（`first-camera`・`run-and-recover`）も残してある。
 * 空のときの見え方は、道具を足したあとには確かめられない。
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

function toolsFor(siteSlug: string): readonly ReaderToolDefinition[] {
  return TOOLS_BY_SITE[siteSlug] ?? [];
}

export function createSampleReaderToolRepository(): EditorialReaderToolPort {
  return markEditorial({
    async find(siteSlug: string, slug: string) {
      return ok(toolsFor(siteSlug).find((t) => t.slug === slug) ?? null);
    },
    async list(siteSlug: string) {
      return ok(toolsFor(siteSlug));
    },
    async run(_siteSlug: string, slug: string, _values: Readonly<Record<string, string>>) {
      // 計算式をでっち上げた数字で返すと、読者がそれを信じて機材を買う。
      // 出せないものは出せないと返す。
      return err(
        domainError("NOT_IMPLEMENTED", `「${slug}」の計算はまだ登録されていません。`, {
          suggestedAction:
            "計算式の登録が済むと結果が出ます。それまでは入力欄と結果の読み方だけをご覧ください。",
          retryable: false,
        }),
      );
    },
  });
}

export function createSampleContactSink(): EditorialContactPort {
  return markEditorial({
    async submit(message) {
      // 本文はログにも残さない。個人情報が入りうるため。
      return err(
        domainError("NOT_IMPLEMENTED", "問い合わせの送信先がまだ設定されていません。", {
          suggestedAction: `お手数ですが、${message.siteSlug} の運営者へ直接ご連絡ください。設定が済み次第この画面から送れるようになります。`,
          retryable: false,
        }),
      );
    },
  });
}
