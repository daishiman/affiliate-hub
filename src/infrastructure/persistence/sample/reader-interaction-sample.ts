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
 * 「必要な保存容量の目安」だけを 1 つ置く。定義（入力欄と読み方）は本物の形にし、
 * 計算だけを見本にする。定義の形が決まっていれば、
 * 計算式を登録するだけで本物になる。
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

export function createSampleReaderToolRepository(): EditorialReaderToolPort {
  return markEditorial({
    async find(_siteSlug: string, slug: string) {
      return ok(slug === STORAGE_ESTIMATOR.slug ? STORAGE_ESTIMATOR : null);
    },
    async list(_siteSlug: string) {
      return ok([STORAGE_ESTIMATOR]);
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
